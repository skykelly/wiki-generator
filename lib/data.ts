import { unstable_noStore as noStore } from 'next/cache'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from './db'
import { sources, concepts, pages, chat_sessions, wikis } from './db/schema'
import { getSetting, getSettingJson } from './settings'
import type {
  SourceItem, ConceptItem, WikiPageItem, KnowledgeItem,
  TopicNode, MetricCard, KnowledgeGraphData,
  IngestLogEntry, EditorialVersion, SynthesisResult,
  ChatSession, ChatMessage, WikiItem,
} from './types'

const DEFAULT_WIKI = 'wiki_homestyle'

// ─── mappers ──────────────────────────────────────────────

function mapSource(r: typeof sources.$inferSelect): SourceItem {
  return {
    id: r.id,
    title: r.title,
    url: r.url ?? undefined,
    publisher: r.publisher ?? undefined,
    published_at: r.published_at ?? undefined,
    source_type: r.source_type ?? 'external',
    raw_content: r.raw_content ?? undefined,
    ai_summary: r.ai_summary ?? undefined,
    one_line_summary: r.one_line_summary ?? undefined,
    topics: (r.topics as string[]) ?? [],
    status: r.status ?? 'done',
    synthesis_result: (r.synthesis_result as SynthesisResult) ?? {
      concepts_updated: [], concepts_created: [], synthesized_at: '',
    },
    created_at: r.created_at?.toISOString() ?? '',
  }
}

function mapConcept(r: typeof concepts.$inferSelect): ConceptItem {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    brief: r.brief ?? undefined,
    aliases: (r.aliases as string[]) ?? [],
    topics: (r.topics as string[]) ?? [],
    related_concepts: (r.related_concepts as string[]) ?? [],
    concept_type: r.concept_type ?? undefined,
    concept_status: r.concept_status ?? 'candidate',
    confidence: r.confidence ?? 0,
    content: r.content ?? undefined,
    source_count: r.source_count ?? 0,
    image_url: r.image_url ?? undefined,
    image_source_url: r.image_source_url ?? undefined,
    last_synthesized_at: r.last_synthesized_at?.toISOString() ?? undefined,
    updated_at: r.updated_at?.toISOString() ?? '',
  }
}

function mapPage(r: typeof pages.$inferSelect): WikiPageItem {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    chapter_number: r.chapter_number ?? '',
    subsections: (r.subsections as { number: string; title: string }[]) ?? [],
    summary: r.summary ?? undefined,
    topics: (r.topics as string[]) ?? [],
    content: r.content ?? undefined,
    image_url: r.image_url ?? undefined,
    image_source_url: r.image_source_url ?? undefined,
    updated_at: r.updated_at?.toISOString() ?? '',
  }
}

function mapWiki(r: typeof wikis.$inferSelect): WikiItem {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description ?? undefined,
    topic: r.topic ?? undefined,
    language: r.language ?? 'ko',
    status: r.status ?? 'ready',
    scaffold_result: r.scaffold_result as import('./types').ScaffoldResult | undefined,
    created_at: r.created_at?.toISOString() ?? '',
    updated_at: r.updated_at?.toISOString() ?? '',
  }
}

// ─── wikis ────────────────────────────────────────────────

export async function getWikis(): Promise<WikiItem[]> {
  noStore()
  try {
    const rows = await db.select().from(wikis).orderBy(desc(wikis.created_at))
    return rows.map(mapWiki)
  } catch { return [] }
}

export async function getWikiBySlug(slug: string): Promise<WikiItem | null> {
  noStore()
  try {
    const [row] = await db.select().from(wikis).where(eq(wikis.slug, slug))
    return row ? mapWiki(row) : null
  } catch { return null }
}

// ─── sources ──────────────────────────────────────────────

export async function getSources(wikiId = DEFAULT_WIKI): Promise<SourceItem[]> {
  noStore()
  try {
    const rows = await db.select().from(sources)
      .where(eq(sources.wiki_id, wikiId))
      .orderBy(desc(sources.created_at))
    return rows.map(mapSource)
  } catch { return [] }
}

export async function getSourceById(id: string): Promise<SourceItem | null> {
  noStore()
  try {
    const [row] = await db.select().from(sources).where(eq(sources.id, id))
    return row ? mapSource(row) : null
  } catch { return null }
}

// ─── concepts ─────────────────────────────────────────────

export async function getConceptItems(wikiId = DEFAULT_WIKI): Promise<ConceptItem[]> {
  noStore()
  try {
    const rows = await db.select().from(concepts)
      .where(eq(concepts.wiki_id, wikiId))
      .orderBy(asc(concepts.slug))
    return rows.map(mapConcept)
  } catch { return [] }
}

export async function getConceptBySlug(slug: string, wikiId = DEFAULT_WIKI): Promise<ConceptItem | null> {
  noStore()
  try {
    const [row] = await db.select().from(concepts)
      .where(and(eq(concepts.slug, slug), eq(concepts.wiki_id, wikiId)))
    return row ? mapConcept(row) : null
  } catch { return null }
}

// ─── pages ────────────────────────────────────────────────

export async function getWikiPages(wikiId = DEFAULT_WIKI): Promise<WikiPageItem[]> {
  noStore()
  try {
    const rows = await db.select().from(pages)
      .where(eq(pages.wiki_id, wikiId))
      .orderBy(asc(pages.chapter_number), asc(pages.slug))
    return rows.map(mapPage)
  } catch { return [] }
}

export async function getPageBySlug(slug: string, wikiId = DEFAULT_WIKI): Promise<WikiPageItem | null> {
  noStore()
  try {
    const [row] = await db.select().from(pages)
      .where(and(eq(pages.slug, slug), eq(pages.wiki_id, wikiId)))
    return row ? mapPage(row) : null
  } catch { return null }
}

// ─── knowledge view (unified search) ──────────────────────

export async function getKnowledgeItems(wikiId = DEFAULT_WIKI): Promise<KnowledgeItem[]> {
  noStore()
  try {
    const result = await db.execute(sql`
      SELECT id, type, title, slug, summary, topics, updated_at
      FROM knowledge_view
      WHERE wiki_id = ${wikiId}
      ORDER BY updated_at DESC
    `)
    return (result.rows as Array<{
      id: string; type: string; title: string; slug: string
      summary: string | null; topics: string[] | null; updated_at: Date
    }>).map(r => ({
      id: r.id,
      type: r.type as KnowledgeItem['type'],
      title: r.title,
      slug: r.slug,
      summary: r.summary ?? undefined,
      topics: r.topics ?? [],
      updated_at: r.updated_at?.toISOString?.() ?? String(r.updated_at),
    }))
  } catch { return [] }
}

// ─── editorial ────────────────────────────────────────────

export async function getEditorialContent(wikiId = DEFAULT_WIKI): Promise<string> {
  noStore()
  try { return (await getSetting('editorial_content', wikiId)) ?? '' }
  catch { return '' }
}

export async function getEditorialVersions(wikiId = DEFAULT_WIKI): Promise<EditorialVersion[]> {
  noStore()
  return getSettingJson<EditorialVersion[]>('editorial_versions', [], wikiId)
}

// ─── topics / metrics / graph / ingest_log ────────────────

export async function getTopicsConfig(wikiId = DEFAULT_WIKI): Promise<TopicNode[]> {
  noStore()
  return getSettingJson<TopicNode[]>('topics_config', [], wikiId)
}

export async function getMetricsContent(wikiId = DEFAULT_WIKI): Promise<MetricCard[]> {
  noStore()
  return getSettingJson<MetricCard[]>('metrics_content', [], wikiId)
}

export async function getKnowledgeGraph(wikiId = DEFAULT_WIKI): Promise<KnowledgeGraphData> {
  noStore()
  return getSettingJson<KnowledgeGraphData>('graph_data', {
    nodes: [], links: [], built_at: '',
  }, wikiId)
}

export async function getIngestLog(wikiId = DEFAULT_WIKI): Promise<IngestLogEntry[]> {
  noStore()
  return getSettingJson<IngestLogEntry[]>('ingest_log', [], wikiId)
}

// ─── chat sessions ─────────────────────────────────────────

function mapChatSession(r: typeof chat_sessions.$inferSelect): ChatSession {
  return {
    id: r.id,
    title: r.title ?? '새 대화',
    messages: (r.messages as ChatMessage[]) ?? [],
    updated_at: r.updated_at?.toISOString() ?? '',
  }
}

export async function getChatSessions(userEmail: string, wikiId = DEFAULT_WIKI): Promise<ChatSession[]> {
  noStore()
  try {
    const rows = await db.select()
      .from(chat_sessions)
      .where(and(eq(chat_sessions.user_email, userEmail), eq(chat_sessions.wiki_id, wikiId)))
      .orderBy(desc(chat_sessions.updated_at))
    return rows.map(mapChatSession)
  } catch { return [] }
}

export async function getChatSession(id: string, userEmail: string): Promise<ChatSession | null> {
  noStore()
  try {
    const [row] = await db.select()
      .from(chat_sessions)
      .where(and(eq(chat_sessions.id, id), eq(chat_sessions.user_email, userEmail)))
    return row ? mapChatSession(row) : null
  } catch { return null }
}
