import { and, eq, sql } from 'drizzle-orm'
import { db } from './db'
import { wikis, pages, concepts } from './db/schema'
import { getOpenAI } from './openai'
import { slugify } from './slug'
import { chunkText, rebuildEmbeddings } from './embed'
import type { ScaffoldResult, ScaffoldChapter, ScaffoldConcept, SeedProgress } from './types'

type ProgressCallback = (event: { step: string; message: string }) => void

// ─── Tavily chapter research ─────────────────────────────────────────────────

async function tavilyChapterResearch(chapter: ScaffoldChapter, topic: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return ''
  const query = `${topic} ${chapter.title} ${chapter.key_concepts.slice(0, 3).join(' ')}`
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: 'advanced', max_results: 5 }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return (data.results ?? []).slice(0, 5)
      .map((r: { title: string; url: string; content: string }) => `### ${r.title}\n${r.url}\n${r.content}`)
      .join('\n\n')
  } catch {
    return ''
  }
}

// ─── Generate one chapter draft ───────────────────────────────────────────────

export async function generateChapterDraft(
  wikiId: string,
  wikiTitle: string,
  wikiTopic: string,
  chapter: ScaffoldChapter,
  language: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const emit = (step: string, message: string) => onProgress?.({ step, message })
  const langLabel = language === 'ko' ? '한국어' : 'English'

  emit('research', `챕터 ${chapter.number} "${chapter.title}" 리서치 중…`)
  const research = await tavilyChapterResearch(chapter, wikiTopic)

  emit('generate', `챕터 ${chapter.number} 초안 생성 중…`)

  const subsectionList = chapter.subsections
    .map((s) => `- ${s.number}. ${s.title}`)
    .join('\n')

  const researchSection = research
    ? `\n\n## 참고 자료\n${research.slice(0, 5000)}`
    : ''

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4.1',
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content: `당신은 "${wikiTitle}" 위키의 콘텐츠 작성자입니다.
주어진 챕터 구조에 따라 ${langLabel}로 마크다운 초안을 작성하세요.
- 각 subsection을 ## 헤딩으로 구분
- 핵심 개념은 **볼드** 처리
- 구체적인 예시와 설명 포함
- 전문적이지만 읽기 쉬운 톤
- 각 섹션 300~600자 분량`,
      },
      {
        role: 'user',
        content: `## 챕터 정보
번호: ${chapter.number}
제목: ${chapter.title}
설명: ${chapter.description}

## 포함할 섹션
${subsectionList}

## 핵심 개념 (반드시 언급)
${chapter.key_concepts.join(', ')}${researchSection}`,
      },
    ],
  })

  return completion.choices[0].message.content ?? ''
}

// ─── Run batch draft generation (all chapters) ───────────────────────────────

export async function runDraftGeneration(
  wikiId: string,
  onProgress?: ProgressCallback,
): Promise<void> {
  const emit = (step: string, message: string) => onProgress?.({ step, message })

  const [wiki] = await db.select().from(wikis).where(eq(wikis.id, wikiId))
  if (!wiki?.scaffold_result) throw new Error('scaffold_result 없음 — 먼저 스캐폴드를 생성하세요')

  const scaffold = wiki.scaffold_result as unknown as ScaffoldResult
  const chapters = scaffold.chapters
  const total = chapters.length

  // Mark wiki as drafting
  await db.update(wikis).set({ status: 'drafting', updated_at: sql`now()` }).where(eq(wikis.id, wikiId))

  let completed = 0

  for (const chapter of chapters) {
    try {
      const content = await generateChapterDraft(
        wikiId,
        wiki.title,
        wiki.topic ?? wiki.title,
        chapter,
        wiki.language ?? 'ko',
        onProgress,
      )

      const pageId = `page_${wikiId}_${slugify(chapter.title)}`
      const pageSlug = `${chapter.number}-${slugify(chapter.title)}`

      await db.insert(pages).values({
        id: pageId,
        wiki_id: wikiId,
        slug: pageSlug,
        title: chapter.title,
        chapter_number: chapter.number,
        subsections: chapter.subsections,
        topics: chapter.key_concepts,
        content,
        draft_status: 'generated',
      }).onConflictDoUpdate({
        target: pages.id,
        set: { content, draft_status: 'generated', subsections: chapter.subsections, updated_at: sql`now()` },
      })

      completed++
      const progress: SeedProgress = {
        phase: 'drafting',
        completed_chapters: completed,
        total_chapters: total,
        completed_concepts: 0,
        total_concepts: scaffold.concepts.length,
        last_updated: new Date().toISOString(),
      }
      await db.update(wikis).set({
        seed_progress: progress as unknown as Record<string, unknown>,
        updated_at: sql`now()`,
      }).where(eq(wikis.id, wikiId))

      emit('progress', `챕터 ${completed}/${total} 완료: ${chapter.title}`)
    } catch (err) {
      emit('error', `챕터 ${chapter.number} 실패: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  await db.update(wikis).set({ status: 'reviewing', updated_at: sql`now()` }).where(eq(wikis.id, wikiId))
  emit('done', `초안 생성 완료: ${completed}/${total} 챕터`)
}

// ─── Phase C: concept extraction ─────────────────────────────────────────────

export async function runConceptExtraction(
  wikiId: string,
  onProgress?: ProgressCallback,
): Promise<void> {
  const emit = (step: string, message: string) => onProgress?.({ step, message })

  const [wiki] = await db.select().from(wikis).where(eq(wikis.id, wikiId))
  if (!wiki?.scaffold_result) throw new Error('scaffold_result 없음')

  const scaffold = wiki.scaffold_result as unknown as ScaffoldResult
  const scaffoldConcepts: ScaffoldConcept[] = scaffold.concepts ?? []
  const total = scaffoldConcepts.length
  emit('start', `개념 ${total}개 추출 시작…`)

  await db.update(wikis).set({ status: 'extracting' as string, updated_at: sql`now()` }).where(eq(wikis.id, wikiId))

  // Process in batches of 10
  const BATCH = 10
  let done = 0

  for (let i = 0; i < scaffoldConcepts.length; i += BATCH) {
    const batch = scaffoldConcepts.slice(i, i + BATCH)
    emit('generate', `개념 ${i + 1}~${Math.min(i + BATCH, total)}번 초안 생성 중…`)

    const batchList = batch.map((c, idx) =>
      `${i + idx + 1}. ${c.title} (${c.slug}): ${c.brief}`
    ).join('\n')

    let generated: Array<{
      slug: string; title: string; brief: string; content: string; topics: string[]; concept_type: string
    }> = []

    try {
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4.1',
        response_format: { type: 'json_object' },
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `당신은 "${wiki.title}" 위키의 개념 작성자입니다.
개념 목록을 받아 각 개념에 대한 마크다운 콘텐츠를 생성하세요.
JSON으로 응답: { "concepts": [{ "slug": "...", "title": "...", "brief": "...", "content": "마크다운 3~5문단", "topics": [...], "concept_type": "..." }] }`,
          },
          { role: 'user', content: `다음 개념들의 초기 콘텐츠를 작성하세요:\n${batchList}` },
        ],
      })

      const parsed = JSON.parse(completion.choices[0].message.content ?? '{}')
      generated = Array.isArray(parsed.concepts) ? parsed.concepts : []
    } catch {
      // Fall back to scaffold data with empty content
      generated = batch.map((c) => ({ ...c, content: c.brief }))
    }

    for (const c of generated) {
      const conceptId = `concept_${wikiId}_${slugify(c.slug || c.title)}`
      await db.insert(concepts).values({
        id: conceptId,
        wiki_id: wikiId,
        slug: slugify(c.slug || c.title),
        title: c.title,
        brief: c.brief,
        content: c.content,
        topics: c.topics ?? [],
        concept_type: c.concept_type,
        concept_status: 'candidate',
        confidence: 50,
        aliases: [],
        related_concepts: [],
        source_count: 0,
      }).onConflictDoUpdate({
        target: concepts.id,
        set: { brief: c.brief, content: c.content, topics: c.topics ?? [], updated_at: sql`now()` },
      })
      done++
    }

    const progress: SeedProgress = {
      phase: 'extracting',
      completed_chapters: scaffold.chapters.length,
      total_chapters: scaffold.chapters.length,
      completed_concepts: done,
      total_concepts: total,
      last_updated: new Date().toISOString(),
    }
    await db.update(wikis).set({
      seed_progress: progress as unknown as Record<string, unknown>,
      updated_at: sql`now()`,
    }).where(eq(wikis.id, wikiId))

    emit('progress', `개념 ${done}/${total} 완료`)
  }

  await db.update(wikis).set({ status: 'reviewing', updated_at: sql`now()` }).where(eq(wikis.id, wikiId))
  emit('done', `개념 추출 완료: ${done}개`)
}

// ─── Phase D: activate ───────────────────────────────────────────────────────

export async function runActivation(
  wikiId: string,
  onProgress?: ProgressCallback,
): Promise<void> {
  const emit = (step: string, message: string) => onProgress?.({ step, message })

  emit('start', '임베딩 빌드 중…')

  // Embed all pages
  const wikiPages = await db.select({ id: pages.id, content: pages.content, title: pages.title })
    .from(pages)
    .where(and(eq(pages.wiki_id, wikiId), eq(pages.draft_status, 'generated')))

  for (const p of wikiPages) {
    const chunks = chunkText(p.content ?? p.title)
    await rebuildEmbeddings('page', p.id, chunks).catch(() => {})
  }
  emit('embed', `페이지 ${wikiPages.length}개 임베딩 완료`)

  // Embed all concepts
  const wikiConcepts = await db.select({ id: concepts.id, content: concepts.content, title: concepts.title })
    .from(concepts)
    .where(eq(concepts.wiki_id, wikiId))

  for (const c of wikiConcepts) {
    const chunks = chunkText(c.content ?? c.title)
    await rebuildEmbeddings('concept', c.id, chunks).catch(() => {})
  }
  emit('embed', `개념 ${wikiConcepts.length}개 임베딩 완료`)

  // synthesizeEditorial
  emit('editorial', '에디토리얼 초안 생성 중…')
  try {
    const { synthesizeEditorial } = await import('./synthesize')
    await synthesizeEditorial(wikiId)
    emit('editorial', '에디토리얼 초안 완료')
  } catch (err) {
    emit('editorial', `에디토리얼 생략: ${err instanceof Error ? err.message : String(err)}`)
  }

  // rebuildGraph
  emit('graph', '지식 그래프 빌드 중…')
  try {
    const { rebuildGraph } = await import('./graph')
    await rebuildGraph(wikiId)
    emit('graph', '지식 그래프 완료')
  } catch (err) {
    emit('graph', `그래프 생략: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Activate wiki
  await db.update(wikis).set({
    status: 'ready',
    seed_progress: {
      phase: 'done',
      completed_chapters: wikiPages.length,
      total_chapters: wikiPages.length,
      completed_concepts: wikiConcepts.length,
      total_concepts: wikiConcepts.length,
      last_updated: new Date().toISOString(),
    } as unknown as Record<string, unknown>,
    updated_at: sql`now()`,
  }).where(eq(wikis.id, wikiId))

  emit('done', '위키 활성화 완료 🎉')
}
