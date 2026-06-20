/**
 * RSS 피드 수집 → 스코어링 → runIngest 파이프라인
 * API 라우트와 GitHub Actions 스크립트 양쪽에서 재사용
 */
import { eq } from 'drizzle-orm'
import { db } from './db'
import { sources, wikis } from './db/schema'
import { runIngest } from './ingest'
import { getOpenAI } from './openai'
import type { ScaffoldResult } from './types'

export interface FeedConfig {
  url: string
  label: string
}

type ProgressCallback = (event: { step: string; message: string }) => void

// ─── RSS parse ────────────────────────────────────────────────────────────────

async function parseFeed(url: string): Promise<Array<{ title: string; link: string }>> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'WikiGeneratorBot/1.0' },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null)
  if (!res?.ok) return []
  const xml = await res.text()
  const items: Array<{ title: string; link: string }> = []

  // RSS 2.0
  for (const m of xml.matchAll(/<item[\s\S]*?<\/item>/g)) {
    const title = m[0].match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim()
    const link = m[0].match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1]?.trim()
      || m[0].match(/href="([^"]+)"/)?.[1]
    if (title && link) items.push({ title, link })
  }

  // Atom fallback
  if (items.length === 0) {
    for (const m of xml.matchAll(/<entry[\s\S]*?<\/entry>/g)) {
      const title = m[0].match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim()
      const link = m[0].match(/href="([^"]+)"/)?.[1]
      if (title && link) items.push({ title, link })
    }
  }

  return items.slice(0, 10)
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

async function scoreItem(title: string, topic: string): Promise<number> {
  try {
    const res = await getOpenAI().chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        { role: 'system', content: '위키 주제와 관련도를 0~10으로 평가하세요. JSON: {"score": 숫자}' },
        { role: 'user', content: `위키 주제: ${topic}\n기사 제목: ${title}` },
      ],
    })
    return Number(JSON.parse(res.choices[0].message.content ?? '{}').score ?? 0)
  } catch {
    return 0
  }
}

// ─── Jina Reader ─────────────────────────────────────────────────────────────

async function fetchContent(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' },
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null)
  return res?.ok ? res.text() : ''
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function syncFeeds(
  wikiId: string,
  feeds: FeedConfig[],
  onProgress?: ProgressCallback,
  scoreThreshold = 5,
): Promise<{ ingested: number; skipped: number; errors: number }> {
  const emit = (step: string, message: string) => onProgress?.({ step, message })

  const [wiki] = await db.select({ topic: wikis.topic, title: wikis.title })
    .from(wikis).where(eq(wikis.id, wikiId))
  const topic = wiki?.topic ?? wiki?.title ?? wikiId

  let ingested = 0, skipped = 0, errors = 0

  for (const feed of feeds) {
    emit('feed', `피드 파싱: ${feed.label}`)
    const items = await parseFeed(feed.url).catch(() => [])
    emit('feed', `→ ${items.length}개 항목 발견`)

    for (const item of items) {
      // Dedup by url
      const [existing] = await db.select({ id: sources.id }).from(sources)
        .where(eq(sources.url, item.link)).limit(1).catch(() => [])
      if (existing) { skipped++; continue }

      const score = await scoreItem(item.title, topic).catch(() => 0)
      emit('score', `[${score}/10] ${item.title}`)

      if (score < scoreThreshold) { skipped++; continue }

      try {
        emit('ingest', `ingest 중: ${item.title}`)
        const content = await fetchContent(item.link)
        if (!content) { errors++; continue }
        await runIngest({
          title: item.title,
          raw_content: content,
          url: item.link,
          publisher: feed.label,
          source_type: 'external',
          wiki_id: wikiId,
        })
        ingested++
        emit('ingest', `✓ 완료`)
      } catch (err) {
        errors++
        emit('error', `오류: ${err instanceof Error ? err.message : String(err)}`)
      }

      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  emit('done', `완료 — 수집: ${ingested}, 스킵: ${skipped}, 오류: ${errors}`)
  return { ingested, skipped, errors }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getFeedsFromScaffold(scaffoldResult: unknown): FeedConfig[] {
  const sr = scaffoldResult as ScaffoldResult | null
  return (sr?.suggested_rss_feeds ?? []).map((f) => ({ url: f.url, label: f.label }))
}
