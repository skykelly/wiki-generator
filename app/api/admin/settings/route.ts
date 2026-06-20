import { auth } from '@/auth'
import { upsertSetting } from '@/lib/settings'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.key || body?.value === undefined) {
    return Response.json({ error: 'key and value required' }, { status: 400 })
  }

  await upsertSetting(body.key, String(body.value), body.wiki_id)
  return Response.json({ ok: true })
}
