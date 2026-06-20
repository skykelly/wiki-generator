import { and, eq, sql } from 'drizzle-orm'
import { db } from './db'
import { settings } from './db/schema'

const DEFAULT_WIKI = 'wiki_homestyle'

export async function getSetting(key: string, wikiId = DEFAULT_WIKI): Promise<string | null> {
  const [row] = await db.select().from(settings)
    .where(and(eq(settings.key, key), eq(settings.wiki_id, wikiId)))
  return row?.value ?? null
}

export async function getSettingJson<T>(key: string, fallback: T, wikiId = DEFAULT_WIKI): Promise<T> {
  try {
    const value = await getSetting(key, wikiId)
    return value ? (JSON.parse(value) as T) : fallback
  } catch { return fallback }
}

export async function upsertSetting(key: string, value: string, wikiId = DEFAULT_WIKI): Promise<void> {
  await db.insert(settings)
    .values({ key, wiki_id: wikiId, value })
    .onConflictDoUpdate({
      target: [settings.key, settings.wiki_id],
      set: { value, updated_at: sql`now()` },
    })
}
