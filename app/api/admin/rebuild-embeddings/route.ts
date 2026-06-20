import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { concepts, pages } from '@/lib/db/schema'
import { chunkText, rebuildEmbeddings } from '@/lib/embed'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let wikiId = 'wiki_homestyle'
  try { const body = await req.json(); wikiId = body.wiki_id ?? wikiId } catch { /* no body */ }

  const allConcepts = await db.select({ id: concepts.id, content: concepts.content }).from(concepts).where(eq(concepts.wiki_id, wikiId))
  const allPages = await db.select({ id: pages.id, content: pages.content }).from(pages).where(eq(pages.wiki_id, wikiId))

  let rebuilt = 0
  for (const c of allConcepts) {
    await rebuildEmbeddings('concept', c.id, chunkText(c.content ?? ''))
    rebuilt++
  }
  for (const p of allPages) {
    await rebuildEmbeddings('page', p.id, chunkText(p.content ?? ''))
    rebuilt++
  }

  return Response.json({ rebuilt })
}
