import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { wikis } from '@/lib/db/schema'
import { syncFeeds, getFeedsFromScaffold, type FeedConfig } from '@/lib/feeds'
import { getSettingJson } from '@/lib/settings'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: wikiId } = await params
  const [wiki] = await db.select().from(wikis).where(eq(wikis.id, wikiId))
  if (!wiki) return Response.json({ error: 'Wiki not found' }, { status: 404 })

  // Feed sources: scaffold suggested feeds + custom feeds from settings
  const scaffoldFeeds = getFeedsFromScaffold(wiki.scaffold_result)
  const customFeeds = await getSettingJson<FeedConfig[]>('rss_feeds', [], wikiId)
  const allFeeds = [...scaffoldFeeds, ...customFeeds]

  if (allFeeds.length === 0) {
    return Response.json({ error: 'RSS 피드가 설정되어 있지 않습니다' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        send({ step: 'start', message: `피드 ${allFeeds.length}개 동기화 시작…` })
        const result = await syncFeeds(wikiId, allFeeds, (event) => send(event))
        send({ step: 'complete', ...result })
      } catch (err) {
        send({ step: 'error', message: err instanceof Error ? err.message : String(err) })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
