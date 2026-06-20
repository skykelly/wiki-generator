import { auth } from '@/auth'
import { getEditorialVersions } from '@/lib/data'
import { upsertSetting } from '@/lib/settings'
import type { EditorialVersion } from '@/lib/types'

export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, wiki_id: wikiId = 'wiki_homestyle' } = await req.json()
  if (typeof content !== 'string') {
    return Response.json({ error: 'content required' }, { status: 400 })
  }

  const versions = await getEditorialVersions(wikiId)
  const entry: EditorialVersion = {
    label: new Date().toLocaleString('ko-KR'),
    content,
    saved_at: new Date().toISOString(),
    is_draft: false,
  }
  const updated = [entry, ...versions].slice(0, 20)

  await upsertSetting('editorial_versions', JSON.stringify(updated), wikiId)
  await upsertSetting('editorial_content', content, wikiId)

  return Response.json({ ok: true })
}
