import { desc, eq } from 'drizzle-orm'
import { db } from './db'
import { concepts, sources } from './db/schema'
import { getTopicsConfig } from './data'
import { upsertSetting } from './settings'
import { slugify } from './slug'
import { topicsForConceptType } from './topicMapping'
import type { KnowledgeGraphData, KnowledgeGraphLink, KnowledgeGraphNode, SynthesisResult, TopicNode } from './types'

function topicNodeId(topic: TopicNode): string {
  return `topic_${slugify(topic.label || topic.title)}`
}

export async function rebuildGraph(wikiId = 'wiki_homestyle'): Promise<KnowledgeGraphData> {
  const [allConcepts, doneSources, topics] = await Promise.all([
    db.select({
      id: concepts.id,
      title: concepts.title,
      slug: concepts.slug,
      brief: concepts.brief,
      topics: concepts.topics,
      related_concepts: concepts.related_concepts,
      source_count: concepts.source_count,
      concept_type: concepts.concept_type,
      last_synthesized_at: concepts.last_synthesized_at,
    }).from(concepts).where(eq(concepts.wiki_id, wikiId)),
    db.select({
      id: sources.id,
      title: sources.title,
      publisher: sources.publisher,
      published_at: sources.published_at,
      one_line_summary: sources.one_line_summary,
      topics: sources.topics,
      synthesis_result: sources.synthesis_result,
    }).from(sources).where(eq(sources.wiki_id, wikiId)).orderBy(desc(sources.created_at)).limit(50),
    getTopicsConfig(wikiId),
  ])

  const nodes: KnowledgeGraphNode[] = []
  const links: KnowledgeGraphLink[] = []

  // ─── 노드 ──────────────────────────────────────────────
  for (const t of topics) {
    nodes.push({ id: topicNodeId(t), type: 'topic', label: t.title })
  }
  for (const c of allConcepts) {
    nodes.push({
      id: c.id,
      type: 'concept',
      label: c.title,
      slug: c.slug,
      brief: c.brief ?? undefined,
      topics: (c.topics as string[] | null) ?? [],
      source_count: c.source_count ?? 0,
      last_synthesized_at: c.last_synthesized_at?.toISOString() ?? undefined,
    })
  }
  for (const s of doneSources) {
    nodes.push({
      id: s.id,
      type: 'source',
      label: s.title,
      publisher: s.publisher ?? undefined,
      published_at: s.published_at ?? undefined,
      description: s.one_line_summary ?? undefined,
      topics: (s.topics as string[] | null) ?? [],
      synthesis_result: (s.synthesis_result as SynthesisResult | null) ?? undefined,
    })
  }

  // ─── 링크 ──────────────────────────────────────────────

  // topic-concept (concept_type → topic 키워드 매칭)
  for (const c of allConcepts) {
    for (const topic of topicsForConceptType(c.concept_type, topics)) {
      links.push({ source: topicNodeId(topic), target: c.id })
    }
  }

  // topic-source (source.topics ∩ topic.label, 대소문자 무시)
  for (const s of doneSources) {
    const sourceTopics = new Set(((s.topics as string[] | null) ?? []).map((t) => t.toLowerCase()))
    for (const topic of topics) {
      if (sourceTopics.has(topic.label.toLowerCase())) {
        links.push({ source: topicNodeId(topic), target: s.id })
      }
    }
  }

  // concept-concept (related_concepts)
  const conceptIdBySlug = new Map(allConcepts.map((c) => [c.slug, c.id]))
  for (const c of allConcepts) {
    for (const relSlug of (c.related_concepts as string[] | null) ?? []) {
      const targetId = conceptIdBySlug.get(relSlug)
      if (targetId) links.push({ source: c.id, target: targetId })
    }
  }

  // concept-source (concept.topics ∩ source.topics, 1개 이상)
  for (const c of allConcepts) {
    const conceptTopics = new Set(((c.topics as string[] | null) ?? []).map((t) => t.toLowerCase()))
    if (conceptTopics.size === 0) continue
    for (const s of doneSources) {
      const sourceTopics = ((s.topics as string[] | null) ?? []).map((t) => t.toLowerCase())
      if (sourceTopics.some((t) => conceptTopics.has(t))) {
        links.push({ source: c.id, target: s.id })
      }
    }
  }

  const data: KnowledgeGraphData = { nodes, links, built_at: new Date().toISOString() }
  await upsertSetting('graph_data', JSON.stringify(data), wikiId)
  return data
}
