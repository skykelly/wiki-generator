import { and, desc, eq, sql, isNotNull } from 'drizzle-orm'
import { db } from './db'
import { concepts, sources } from './db/schema'
import { getSetting, upsertSetting } from './settings'
import type { SynthesisResult, LintIssue, EditorialVersion } from './types'
import { chunkText, rebuildEmbeddings } from './embed'
import { getOpenAI } from './openai'

// ─── synthesizeConcepts ───────────────────────────────────

export async function synthesizeConcepts(params: {
  sourceId: string
  aiSummary: string
  topics: string[]
  wikiId?: string
}): Promise<SynthesisResult> {
  const { aiSummary, topics, wikiId = 'wiki_homestyle' } = params

  // 1. concepts 전체 로드
  const allConcepts = await db.select({
    id: concepts.id,
    title: concepts.title,
    slug: concepts.slug,
    brief: concepts.brief,
    topics: concepts.topics,
    content: concepts.content,
  }).from(concepts).where(eq(concepts.wiki_id, wikiId))

  // 2. topics 기반 1차 후보 필터 (교집합이 3개 미만이면 전체 사용)
  const topicsLower = new Set(topics.map((t) => t.toLowerCase()))
  const filtered = topicsLower.size > 0
    ? allConcepts.filter((c) =>
        ((c.topics as string[]) ?? []).some((t) => topicsLower.has(t.toLowerCase()))
      )
    : []
  const candidates = filtered.length >= 3 ? filtered : allConcepts

  const candidateList = candidates.slice(0, 30).map((c) => ({
    slug: c.slug,
    title: c.title,
    brief: c.brief ?? '',
    content_preview: (c.content ?? '').slice(0, 500),
  }))

  // 3. GPT-4.1 호출
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4.1',
    response_format: { type: 'json_object' },
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `당신은 Homestyle Wiki의 지식 합성 에이전트입니다.
새 소스 요약을 읽고 기존 개념 중 업데이트가 필요한 것을 파악하세요.
기존 개념에 없는 새로운 Homestyle 개념이 발견되면 신규 생성을 제안하세요.
각 개념의 content는 마크다운으로, 기존 내용과 충돌 없이 새 정보를 추가합니다.
반드시 JSON으로만 응답하세요:
{
  "updates": [{"slug": "기존-slug", "additions": "## 섹션 제목\n내용..."}],
  "new_concepts": [{"title": "신규 개념명", "slug": "sin-gyu-slug", "brief": "한 줄 정의", "content": "마크다운 내용"}]
}`,
      },
      {
        role: 'user',
        content: `## 새 소스 요약\n${aiSummary}\n\n## 기존 개념 목록\n${JSON.stringify(candidateList, null, 2)}`,
      },
    ],
  })

  let synthesisData: {
    updates: Array<{ slug: string; additions: string }>
    new_concepts: Array<{ title: string; slug: string; brief: string; content: string }>
  }
  try {
    synthesisData = JSON.parse(response.choices[0].message.content ?? '{}')
    if (!Array.isArray(synthesisData.updates)) synthesisData.updates = []
    if (!Array.isArray(synthesisData.new_concepts)) synthesisData.new_concepts = []
  } catch {
    synthesisData = { updates: [], new_concepts: [] }
  }

  const slugToId = new Map(allConcepts.map((c) => [c.slug, c.id]))
  const updatedSlugs: string[] = []
  const createdSlugs: string[] = []

  // 4. updates 처리
  for (const update of synthesisData.updates) {
    const conceptId = slugToId.get(update.slug)
    if (!conceptId) continue
    const current = allConcepts.find((c) => c.slug === update.slug)
    if (!current) continue

    const newContent = (current.content ?? '') + '\n\n' + update.additions
    await db.update(concepts).set({
      content: newContent,
      source_count: sql`source_count + 1`,
      last_synthesized_at: sql`now()`,
      updated_at: sql`now()`,
    }).where(eq(concepts.id, conceptId))

    await rebuildEmbeddings('concept', conceptId, chunkText(newContent))
    updatedSlugs.push(update.slug)
  }

  // 5. new_concepts 처리
  for (const nc of synthesisData.new_concepts) {
    if (!nc.slug || !nc.title) continue
    const id = `concept_${nc.slug}`
    await db.insert(concepts).values({
      id,
      wiki_id: wikiId,
      title: nc.title,
      slug: nc.slug,
      brief: nc.brief,
      content: nc.content,
      concept_status: 'candidate',
      source_count: 1,
      last_synthesized_at: sql`now()`,
    }).onConflictDoNothing()

    await rebuildEmbeddings('concept', id, chunkText(nc.content ?? ''))
    createdSlugs.push(nc.slug)
  }

  return {
    concepts_updated: updatedSlugs,
    concepts_created: createdSlugs,
    synthesized_at: new Date().toISOString(),
  }
}

// ─── synthesizeEditorial ──────────────────────────────────

export async function synthesizeEditorial(wikiId = 'wiki_homestyle'): Promise<string> {
  const [currentEditorial, recentConcepts, recentSources] = await Promise.all([
    getSetting('editorial_content', wikiId).then((v) => v ?? ''),
    db.select({ title: concepts.title, brief: concepts.brief, topics: concepts.topics })
      .from(concepts)
      .where(and(eq(concepts.wiki_id, wikiId), isNotNull(concepts.last_synthesized_at)))
      .orderBy(desc(concepts.last_synthesized_at))
      .limit(10),
    db.select({ title: sources.title, one_line_summary: sources.one_line_summary, topics: sources.topics })
      .from(sources)
      .where(and(eq(sources.wiki_id, wikiId), eq(sources.status, 'done')))
      .orderBy(desc(sources.created_at))
      .limit(5),
  ])

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4.1',
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: `당신은 Homestyle Wiki의 수석 에디터입니다.
최신 Homestyle 지식 동향을 반영해서 홈 에디토리얼을 업데이트하세요.
기존 에디토리얼의 구조와 톤을 유지하면서, 새로 추가된 지식을 자연스럽게 통합하세요.
마크다운으로 작성하고, 특정 개념과 소스를 구체적으로 언급하세요.`,
      },
      {
        role: 'user',
        content: `## 현재 에디토리얼\n${currentEditorial || '(비어 있음 — 새로 작성해주세요)'}

## 최근 업데이트된 개념 (10개)
${recentConcepts.map((c) => `- ${c.title}: ${c.brief ?? ''}`).join('\n')}

## 최신 소스 (5개)
${recentSources.map((s) => `- ${s.title}: ${s.one_line_summary ?? ''}`).join('\n')}`,
      },
    ],
  })

  const newContent = response.choices[0].message.content ?? ''

  // editorial_versions에 draft 추가 (최대 20개)
  const versionsRaw = await getSetting('editorial_versions', wikiId)
  const versions: EditorialVersion[] = versionsRaw ? JSON.parse(versionsRaw) : []
  const draft: EditorialVersion = {
    label: `AI 초안 (${new Date().toLocaleDateString('ko-KR')})`,
    content: newContent,
    saved_at: new Date().toISOString(),
    is_draft: true,
  }
  const updated = [draft, ...versions].slice(0, 20)
  await upsertSetting('editorial_versions', JSON.stringify(updated), wikiId)

  return newContent
}

// ─── lintWiki ─────────────────────────────────────────────

export async function lintWiki(wikiId = 'wiki_homestyle'): Promise<LintIssue[]> {
  const allConcepts = await db.select({
    id: concepts.id,
    slug: concepts.slug,
    title: concepts.title,
    content: concepts.content,
    topics: concepts.topics,
    source_count: concepts.source_count,
    related_concepts: concepts.related_concepts,
    last_synthesized_at: concepts.last_synthesized_at,
  }).from(concepts).where(eq(concepts.wiki_id, wikiId))

  const allSlugs = new Set(allConcepts.map((c) => c.slug))
  const issues: LintIssue[] = []

  for (const c of allConcepts) {
    const content = c.content ?? ''
    const topicsArr = (c.topics as string[]) ?? []
    const relatedArr = (c.related_concepts as string[]) ?? []

    if (content.length < 100) {
      issues.push({ type: 'empty_content', concept_slug: c.slug, title: c.title, detail: `content ${content.length}자` })
    }
    if (topicsArr.length === 0) {
      issues.push({ type: 'no_topics', concept_slug: c.slug, title: c.title, detail: 'topics 배열이 비어 있음' })
    }
    if ((c.source_count ?? 0) === 0) {
      issues.push({ type: 'no_sources', concept_slug: c.slug, title: c.title, detail: 'source_count = 0' })
    }
    if (c.last_synthesized_at) {
      const days = (Date.now() - c.last_synthesized_at.getTime()) / 86_400_000
      if (days > 90) {
        issues.push({ type: 'stale', concept_slug: c.slug, title: c.title, detail: `${Math.floor(days)}일 전 합성` })
      }
    }
    const orphans = relatedArr.filter((slug) => !allSlugs.has(slug))
    if (orphans.length > 0) {
      issues.push({ type: 'orphan', concept_slug: c.slug, title: c.title, detail: `존재하지 않는 slug: ${orphans.join(', ')}` })
    }
  }

  return issues
}
