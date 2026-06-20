import { auth } from '@/auth'
import { lintWiki } from '@/lib/synthesize'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let wikiId = 'wiki_homestyle'
  try { const body = await req.json(); wikiId = body.wiki_id ?? wikiId } catch { /* no body */ }

  const issues = await lintWiki(wikiId)
  return Response.json(issues)
}
