import { eq, ne } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { wikis } from '@/lib/db/schema'
import { slugify } from '@/lib/slug'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.topic) return Response.json({ error: 'topic required' }, { status: 400 })

  const topic: string = String(body.topic).trim()
  const title: string = String(body.title ?? topic).trim()
  const language: string = body.language === 'en' ? 'en' : 'ko'

  const slug = slugify(title)
  const wikiId = `wiki_${slug}`

  await db.insert(wikis).values({
    id: wikiId,
    slug,
    title,
    topic,
    language,
    status: 'scaffolding',
  }).onConflictDoNothing()

  const [row] = await db.select().from(wikis).where(eq(wikis.id, wikiId))

  return Response.json({ id: row.id, slug: row.slug, title: row.title, status: row.status })
}

export async function GET(req: Request) {
  // session auth 또는 INGEST_SECRET bearer 허용 (GitHub Actions discover script용)
  const session = await auth()
  const bearer = req.headers.get('Authorization')
  const secret = process.env.INGEST_SECRET
  const isBearer = secret && bearer === `Bearer ${secret}`
  if (!session && !isBearer) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select().from(wikis)
  return Response.json(rows)
}
