import { inArray, sql } from 'drizzle-orm'
import { db } from './db'
import { concepts, pages, sources } from './db/schema'
import { getOpenAI } from './openai'
import type { Citation } from './types'

const EMBED_MODEL = 'text-embedding-3-small'

export async function embedQuery(text: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({ model: EMBED_MODEL, input: text })
  return res.data[0].embedding
}

export interface KnowledgeChunk {
  ref_type: string
  ref_id: string
  content: string
  similarity: number
}

export async function matchKnowledgeChunks(
  embedding: number[],
  threshold = 0.32,
  count = 8,
  wikiId?: string,
): Promise<KnowledgeChunk[]> {
  const result = await db.execute(sql`
    SELECT ref_type, ref_id, content, similarity
    FROM match_knowledge_chunks(
      ${JSON.stringify(embedding)}::vector,
      ${threshold},
      ${count},
      ${wikiId ?? null}
    )
  `)
  return result.rows as unknown as KnowledgeChunk[]
}

export async function buildCitations(chunks: KnowledgeChunk[]): Promise<Citation[]> {
  const conceptIds = [...new Set(chunks.filter((c) => c.ref_type === 'concept').map((c) => c.ref_id))]
  const pageIds = [...new Set(chunks.filter((c) => c.ref_type === 'page').map((c) => c.ref_id))]
  const sourceIds = [...new Set(chunks.filter((c) => c.ref_type === 'source').map((c) => c.ref_id))]

  const [conceptRows, pageRows, sourceRows] = await Promise.all([
    conceptIds.length
      ? db.select({ id: concepts.id, title: concepts.title, slug: concepts.slug }).from(concepts).where(inArray(concepts.id, conceptIds))
      : Promise.resolve([]),
    pageIds.length
      ? db.select({ id: pages.id, title: pages.title, slug: pages.slug }).from(pages).where(inArray(pages.id, pageIds))
      : Promise.resolve([]),
    sourceIds.length
      ? db.select({ id: sources.id, title: sources.title }).from(sources).where(inArray(sources.id, sourceIds))
      : Promise.resolve([]),
  ])

  const citations: Citation[] = []
  const seen = new Set<string>()

  for (const chunk of chunks) {
    const key = `${chunk.ref_type}:${chunk.ref_id}`
    if (seen.has(key)) continue
    seen.add(key)

    if (chunk.ref_type === 'concept') {
      const row = conceptRows.find((r) => r.id === chunk.ref_id)
      if (row) citations.push({ ref_type: 'concept', ref_id: row.id, title: row.title, slug: row.slug })
    } else if (chunk.ref_type === 'page') {
      const row = pageRows.find((r) => r.id === chunk.ref_id)
      if (row) citations.push({ ref_type: 'page', ref_id: row.id, title: row.title, slug: row.slug })
    } else if (chunk.ref_type === 'source') {
      const row = sourceRows.find((r) => r.id === chunk.ref_id)
      if (row) citations.push({ ref_type: 'source', ref_id: row.id, title: row.title })
    }
  }

  return citations
}
