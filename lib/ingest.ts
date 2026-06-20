import { and, eq, sql } from 'drizzle-orm'
import { db } from './db'
import { sources, settings } from './db/schema'
import { slugify } from './slug'
import { chunkText, rebuildEmbeddings } from './embed'
import { synthesizeConcepts } from './synthesize'
import { getOpenAI } from './openai'
import { upsertSetting } from './settings'
import type { SynthesisResult, IngestLogEntry } from './types'

async function getIngestLog(wikiId: string): Promise<IngestLogEntry[]> {
  const [row] = await db.select({ value: settings.value }).from(settings)
    .where(and(eq(settings.key, 'ingest_log'), eq(settings.wiki_id, wikiId)))
  try { return row?.value ? JSON.parse(row.value) : [] } catch { return [] }
}

async function appendIngestLog(entry: IngestLogEntry, wikiId: string): Promise<void> {
  const log = await getIngestLog(wikiId)
  const updated = [entry, ...log].slice(0, 50)
  await upsertSetting('ingest_log', JSON.stringify(updated), wikiId)
}

export async function runIngest(params: {
  title: string
  raw_content: string
  url?: string
  publisher?: string
  source_type?: string
  wiki_id?: string
}): Promise<string> {
  const { title, raw_content, url, publisher, source_type = 'external', wiki_id: wikiId = 'wiki_homestyle' } = params
  const sourceId = 'source_' + slugify(title)

  // 1. sources INSERT status='processing'
  await db.insert(sources).values({
    id: sourceId, wiki_id: wikiId, title, url, publisher,
    source_type, raw_content,
    status: 'processing', synthesis_result: {},
  }).onConflictDoUpdate({
    target: sources.id,
    set: { title, url, publisher, raw_content, status: 'processing', updated_at: sql`now()` },
  })

  try {
    // 2. gpt-4.1-mini → 6섹션 한국어 요약
    const summaryRes = await getOpenAI().chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `당신은 Homestyle(홈스타일) 인테리어 위키의 콘텐츠 분석가입니다.
제공된 텍스트를 분석해 한국어로 6섹션 마크다운 요약을 작성하세요. 반드시 아래 형식을 그대로 사용하세요.

## 한 줄 요약
(한 문장)

## 핵심 메시지
(3-5개 불릿)

## 주요 수치와 데이터
(수치나 통계, 없으면 "해당 없음")

## Homestyle 시사점
(인테리어 트렌드·소재·공간·스타일 관련 시사점)

## 액션 아이템
(브랜드·MD·마케터를 위한 구체적 액션 3-5개)

## 관련 개념
(쉼표 구분, Homestyle 개념 키워드)`,
        },
        { role: 'user', content: raw_content.slice(0, 8000) },
      ],
    })

    const aiSummary = summaryRes.choices[0].message.content ?? ''

    const oneLineMatch = aiSummary.match(/## 한 줄 요약\s*\n+([^\n#]+)/)
    const oneLineSummary = oneLineMatch ? oneLineMatch[1].trim() : ''

    const topicsMatch = aiSummary.match(/## 관련 개념\s*\n+([^\n#]+)/)
    const topics: string[] = topicsMatch
      ? topicsMatch[1].split(/[,，]/).map((t) => t.trim()).filter(Boolean)
      : []

    // 3. sources UPDATE ai_summary, status='done'
    await db.update(sources).set({
      ai_summary: aiSummary,
      one_line_summary: oneLineSummary,
      topics,
      status: 'done',
      updated_at: sql`now()`,
    }).where(eq(sources.id, sourceId))

    // 4. Embeddings (non-critical)
    try {
      const rawChunks = chunkText(raw_content)
      await rebuildEmbeddings('source', sourceId, [...rawChunks, aiSummary])
    } catch (e) {
      console.error('[ingest] embedding failed:', e)
    }

    // 5. synthesizeConcepts (non-critical)
    let synthResult: SynthesisResult = {
      concepts_updated: [], concepts_created: [], synthesized_at: new Date().toISOString(),
    }
    try {
      synthResult = await synthesizeConcepts({ sourceId, aiSummary, topics, wikiId })
    } catch (e) {
      console.error('[ingest] synthesizeConcepts failed:', e)
    }

    // 6. UPDATE synthesis_result
    await db.update(sources).set({
      synthesis_result: synthResult,
      updated_at: sql`now()`,
    }).where(eq(sources.id, sourceId))

    // 7. ingest_log prepend
    await appendIngestLog({
      source_id: sourceId,
      title,
      concepts_updated: synthResult.concepts_updated,
      concepts_created: synthResult.concepts_created,
      date: new Date().toISOString(),
    }, wikiId)

    return sourceId

  } catch (error) {
    // 8. error handling
    await db.update(sources).set({
      status: 'error',
      error_message: error instanceof Error ? error.message : String(error),
      updated_at: sql`now()`,
    }).where(eq(sources.id, sourceId))
    throw error
  }
}
