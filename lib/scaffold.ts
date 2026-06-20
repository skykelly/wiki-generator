import { eq, sql } from 'drizzle-orm'
import { db } from './db'
import { wikis } from './db/schema'
import { getOpenAI } from './openai'
import { upsertSetting } from './settings'
import type { ScaffoldResult, TopicNode } from './types'

type ProgressCallback = (event: { step: string; message: string }) => void

// ─── Tavily research (optional) ───────────────────────────────────────────────

async function tavilyResearch(topic: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return ''

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: topic,
        search_depth: 'advanced',
        max_results: 8,
        include_answer: true,
      }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    const answer = data.answer ? `## 개요\n${data.answer}\n\n` : ''
    const results = (data.results ?? []).slice(0, 6).map((r: { title: string; url: string; content: string }) =>
      `### ${r.title}\n${r.url}\n${r.content}`
    ).join('\n\n')
    return answer + results
  } catch {
    return ''
  }
}

// ─── Main scaffold function ───────────────────────────────────────────────────

export async function runScaffold(
  wikiId: string,
  topic: string,
  language: string,
  onProgress?: ProgressCallback,
): Promise<ScaffoldResult> {
  const emit = (step: string, message: string) => onProgress?.({ step, message })

  // 1. Research phase
  emit('research', `"${topic}" 주제 리서치 중…`)
  const researchContext = await tavilyResearch(topic)
  emit('research', researchContext ? '리서치 완료' : '리서치 생략 (API 키 없음)')

  const langLabel = language === 'ko' ? '한국어' : 'English'
  const researchSection = researchContext
    ? `\n\n## 리서치 참고 자료\n${researchContext.slice(0, 6000)}`
    : ''

  // 2. Scaffold generation
  emit('scaffold', 'LLM으로 위키 구조 생성 중…')

  const systemPrompt = `당신은 전문 위키 설계자입니다.
주어진 주제를 분석해서 체계적인 위키 목차와 개념 목록을 JSON으로 반환하세요.
언어: ${langLabel}

반드시 아래 JSON 스키마를 그대로 사용하세요:
{
  "wiki_title": "string",
  "description": "string (2~3문장)",
  "chapters": [
    {
      "number": "01",
      "title": "string",
      "description": "string",
      "subsections": [{"number": "01-1", "title": "string"}],
      "key_concepts": ["string"]
    }
  ],
  "concepts": [
    {
      "slug": "string (영문 소문자-하이픈)",
      "title": "string",
      "brief": "string (한 줄 정의)",
      "topics": ["string"],
      "concept_type": "style|lifestyle|spatial|functional|material|market|general"
    }
  ],
  "topics_config": [
    {
      "number": "01",
      "title": "string",
      "label": "string",
      "subtopics": ["string"]
    }
  ],
  "suggested_rss_feeds": [{"url": "string", "label": "string"}]
}

요구사항:
- 챕터 5~8개
- 각 챕터당 subsection 3~5개
- concepts 20~40개 (위키에서 반복 등장할 핵심 용어/개념)
- topics_config: 챕터와 연결되는 주제 분류 (챕터 수와 동일하게)
- suggested_rss_feeds: 주제 관련 영문/한국어 RSS 3~5개`

  const userPrompt = `주제: ${topic}${researchSection}`

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4.1',
    response_format: { type: 'json_object' },
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  let result: ScaffoldResult
  try {
    result = JSON.parse(completion.choices[0].message.content ?? '{}') as ScaffoldResult
    if (!Array.isArray(result.chapters)) result.chapters = []
    if (!Array.isArray(result.concepts)) result.concepts = []
    if (!Array.isArray(result.topics_config)) result.topics_config = []
    if (!Array.isArray(result.suggested_rss_feeds)) result.suggested_rss_feeds = []
  } catch {
    throw new Error('스캐폴드 JSON 파싱 실패')
  }

  emit('saving', '결과 저장 중…')

  // 3. Persist to DB
  await db.update(wikis).set({
    scaffold_result: result as unknown as Record<string, unknown>,
    title: result.wiki_title || topic,
    description: result.description,
    status: 'reviewing',
    updated_at: sql`now()`,
  }).where(eq(wikis.id, wikiId))

  // 4. Save topics_config to settings
  if ((result.topics_config as TopicNode[]).length > 0) {
    await upsertSetting('topics_config', JSON.stringify(result.topics_config), wikiId)
  }

  emit('done', `스캐폴드 완료: 챕터 ${result.chapters.length}개, 개념 ${result.concepts.length}개`)

  return result
}
