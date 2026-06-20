import { auth } from '@/auth'
import { synthesizeEditorial } from '@/lib/synthesize'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let wikiId = 'wiki_homestyle'
  try { const body = await req.json(); wikiId = body.wiki_id ?? wikiId } catch { /* no body */ }

  const draft = await synthesizeEditorial(wikiId)
  const draftLabel = `AI 초안 (${new Date().toLocaleDateString('ko-KR')})`

  return Response.json({
    draft_label: draftLabel,
    preview: draft.slice(0, 300),
  })
}
