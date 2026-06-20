import { auth } from '@/auth'
import { runIngest } from '@/lib/ingest'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const fd = await req.formData()
    const file = fd.get('file') as File | null
    const title = (fd.get('title') as string) || ''
    const url = (fd.get('url') as string) || undefined
    const wikiId = (fd.get('wiki_id') as string) || 'wiki_homestyle'
    if (!file) return Response.json({ error: 'file required' }, { status: 400 })
    const content = await file.text()
    const sourceId = await runIngest({
      title: title || file.name.replace(/\.[^.]+$/, ''),
      raw_content: content,
      url,
      source_type: 'internal',
      wiki_id: wikiId,
    })
    return Response.json({ source_id: sourceId })
  }

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'invalid body' }, { status: 400 })

  let { title, content } = body as { title?: string; content?: string }
  const url: string | undefined = body.url
  const wikiId: string = body.wiki_id ?? 'wiki_homestyle'

  // URL만 있고 content가 없으면 Jina Reader로 서버사이드 fetch
  if (url && !content) {
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/plain', 'X-Return-Format': 'markdown' },
    }).catch(() => null)
    if (!jinaRes?.ok) {
      return Response.json({ error: `URL fetch 실패 (${jinaRes?.status ?? 'network error'})` }, { status: 400 })
    }
    content = await jinaRes.text()
    if (!title) {
      const titleMatch = content.match(/^Title:\s*(.+)$/m)
      title = titleMatch?.[1]?.trim() || new URL(url).hostname
    }
  }

  if (!title || !content) {
    return Response.json({ error: 'title and content required' }, { status: 400 })
  }

  const sourceId = await runIngest({
    title,
    raw_content: content,
    url,
    source_type: 'internal',
    wiki_id: wikiId,
  })
  return Response.json({ source_id: sourceId })
}
