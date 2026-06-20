import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { wikis } from '@/lib/db/schema'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const bearer = req.headers.get('Authorization')
  const secret = process.env.INGEST_SECRET
  const isBearer = secret && bearer === `Bearer ${secret}`
  if (!session && !isBearer) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [row] = await db.select().from(wikis).where(eq(wikis.id, id))
  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json(row)
}
