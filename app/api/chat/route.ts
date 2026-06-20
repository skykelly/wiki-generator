import { and, eq, sql } from 'drizzle-orm'
import type OpenAI from 'openai'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { chat_sessions, wikis } from '@/lib/db/schema'
import { embedQuery, matchKnowledgeChunks, buildCitations } from '@/lib/chat'
import { getOpenAI } from '@/lib/openai'
import type { ChatMessage } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

function buildSystemPrompt(wikiTitle: string, language: string) {
  const lang = language === 'en' ? 'English' : '한국어'
  return `당신은 ${wikiTitle} 위키의 AI 어시스턴트입니다.
제공된 컨텍스트(concepts, pages, sources)를 바탕으로 ${lang}로 답변하세요.
답변 말미에 참고한 위키 페이지나 소스를 간략히 언급하세요.
컨텍스트에 없는 내용은 솔직하게 모른다고 답하세요.`
}

export async function POST(req: Request) {
  const session = await auth()
  const userEmail = session?.user?.email
  if (!userEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const message = body?.message
  if (typeof message !== 'string' || !message.trim()) {
    return Response.json({ error: 'message required' }, { status: 400 })
  }

  let history: ChatMessage[] = []
  let sessionId: string = typeof body?.session_id === 'string' ? body.session_id : ''
  const wikiId: string = typeof body?.wiki_id === 'string' ? body.wiki_id : 'wiki_homestyle'
  let isNew = true

  if (sessionId) {
    const [row] = await db.select().from(chat_sessions)
      .where(and(eq(chat_sessions.id, sessionId), eq(chat_sessions.user_email, userEmail)))
    if (row) {
      history = (row.messages as ChatMessage[]) ?? []
      isNew = false
    }
  }
  if (isNew) sessionId = crypto.randomUUID()

  // 위키 메타데이터 (언어, 제목)
  const [wikiRow] = await db.select({ title: wikis.title, language: wikis.language })
    .from(wikis).where(eq(wikis.id, wikiId))
  const wikiTitle = wikiRow?.title ?? wikiId
  const wikiLanguage = wikiRow?.language ?? 'ko'

  // 1. 질문 임베딩
  const queryEmbedding = await embedQuery(message)
  // 2. RAG 검색 (wiki_id 필터로 해당 위키만 검색)
  const chunks = await matchKnowledgeChunks(queryEmbedding, 0.32, 8, wikiId)
  // 3. citations 구성
  const citations = await buildCitations(chunks)

  const contextText = chunks.length
    ? chunks.map((c) => `[${c.ref_type}:${c.ref_id}] ${c.content}`).join('\n\n---\n\n')
    : '(관련 컨텍스트 없음)'

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: `${buildSystemPrompt(wikiTitle, wikiLanguage)}\n\n## 컨텍스트\n${contextText}` },
    ...history.map((m): OpenAI.Chat.ChatCompletionMessageParam => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4.1',
    stream: true,
    messages,
  })

  const encoder = new TextEncoder()
  const userTurnAt = new Date().toISOString()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      send({ type: 'session', id: sessionId })

      let fullContent = ''
      try {
        for await (const part of completion) {
          const delta = part.choices[0]?.delta?.content ?? ''
          if (delta) {
            fullContent += delta
            send({ type: 'delta', content: delta })
          }
        }
      } catch {
        send({ type: 'error', message: '응답 생성 중 오류가 발생했습니다.' })
      }

      send({ type: 'citations', citations })
      send({ type: 'done' })
      controller.close()

      // 6. chat_sessions upsert
      const newMessages: ChatMessage[] = [
        ...history,
        { role: 'user', content: message, created_at: userTurnAt },
        { role: 'assistant', content: fullContent, citations, created_at: new Date().toISOString() },
      ]

      if (isNew) {
        await db.insert(chat_sessions).values({
          id: sessionId,
          wiki_id: wikiId,
          user_email: userEmail,
          title: message.slice(0, 30),
          messages: newMessages,
        })
      } else {
        await db.update(chat_sessions)
          .set({ messages: newMessages, updated_at: sql`now()` })
          .where(eq(chat_sessions.id, sessionId))
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
