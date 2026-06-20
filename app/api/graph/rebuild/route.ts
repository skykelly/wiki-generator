import { auth } from '@/auth'
import { rebuildGraph } from '@/lib/graph'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let wikiId = 'wiki_homestyle'
  try { const body = await req.json(); wikiId = body.wiki_id ?? wikiId } catch { /* no body */ }

  const data = await rebuildGraph(wikiId)
  return Response.json({
    built_at: data.built_at,
    nodes: data.nodes.length,
    links: data.links.length,
  })
}
