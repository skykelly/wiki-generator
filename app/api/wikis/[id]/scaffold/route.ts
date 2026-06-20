import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { wikis } from '@/lib/db/schema'
import { runScaffold } from '@/lib/scaffold'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: wikiId } = await params
  const [wiki] = await db.select().from(wikis).where(eq(wikis.id, wikiId))
  if (!wiki) return Response.json({ error: 'Wiki not found' }, { status: 404 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        await runScaffold(wikiId, wiki.topic ?? wiki.title, wiki.language ?? 'ko', (event) => {
          send(event)
        })
        send({ step: 'complete', message: '스캐폴드 생성 완료' })
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
