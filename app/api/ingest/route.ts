import { runIngest } from '@/lib/ingest'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  const auth = req.headers.get('Authorization')
  if (!process.env.INGEST_SECRET || auth !== `Bearer ${process.env.INGEST_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.title || !body?.raw_content) {
    return Response.json({ error: 'title and raw_content required' }, { status: 400 })
  }

  const sourceId = await runIngest({
    title: body.title,
    raw_content: body.raw_content,
    url: body.url,
    publisher: body.publisher,
    source_type: body.source_type ?? 'external',
    wiki_id: body.wiki_id,
  })

  return Response.json({ source_id: sourceId })
}
