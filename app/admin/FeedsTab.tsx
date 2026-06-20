'use client'
import { useState, useRef } from 'react'
import type { FeedConfig } from '@/lib/feeds'

interface Props {
  wikiId?: string
  initialFeeds?: FeedConfig[]
}

export default function FeedsTab({ wikiId = 'wiki_homestyle', initialFeeds = [] }: Props) {
  const [feeds, setFeeds] = useState<FeedConfig[]>(initialFeeds)
  const [newUrl, setNewUrl] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [result, setResult] = useState<{ ingested?: number; skipped?: number; errors?: number } | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  function appendLog(msg: string) {
    setLog((prev) => [...prev, msg])
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50)
  }

  function addFeed() {
    if (!newUrl.trim()) return
    setFeeds((prev) => [...prev, { url: newUrl.trim(), label: newLabel.trim() || newUrl.trim() }])
    setNewUrl('')
    setNewLabel('')
  }

  function removeFeed(i: number) {
    setFeeds((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function saveFeeds() {
    setSaving(true)
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'rss_feeds', value: JSON.stringify(feeds), wiki_id: wikiId }),
    })
    setSaving(false)
  }

  async function startSync() {
    setSyncing(true)
    setLog([])
    setResult(null)

    const res = await fetch(`/api/wikis/${wikiId}/sync-feeds`, { method: 'POST' })
    if (!res.ok || !res.body) {
      appendLog('API 요청 실패')
      setSyncing(false)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6))
          if (event.message) appendLog(event.message)
          if (event.step === 'complete') {
            setResult({ ingested: event.ingested, skipped: event.skipped, errors: event.errors })
          }
        } catch { /* ignore */ }
      }
    }
    setSyncing(false)
  }

  return (
    <div className="space-y-6">
      {/* Feed list */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">RSS 피드 목록</h3>
          <button
            onClick={saveFeeds}
            disabled={saving}
            className="text-xs bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>

        {feeds.length === 0 ? (
          <p className="text-sm text-neutral-500 py-4 text-center">
            등록된 RSS 피드가 없습니다.<br />
            <span className="text-xs">스캐폴드에서 제안된 피드는 동기화 시 자동으로 사용됩니다.</span>
          </p>
        ) : (
          <ul className="space-y-2 mb-4">
            {feeds.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-3 bg-neutral-800 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{f.label}</p>
                  <p className="text-xs text-neutral-500 truncate">{f.url}</p>
                </div>
                <button onClick={() => removeFeed(i)} className="text-neutral-600 hover:text-red-400 shrink-0 text-sm">✕</button>
              </li>
            ))}
          </ul>
        )}

        {/* Add feed */}
        <div className="border-t border-neutral-800 pt-4 space-y-2">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="RSS 피드 URL"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="피드 이름 (선택)"
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={addFeed}
              disabled={!newUrl.trim()}
              className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              추가
            </button>
          </div>
        </div>
      </div>

      {/* Sync action */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">피드 동기화</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              스캐폴드 추천 피드 + 커스텀 피드에서 새 소스를 자동 수집합니다.
            </p>
          </div>
          <button
            onClick={startSync}
            disabled={syncing}
            className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-black disabled:text-neutral-500 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {syncing ? '동기화 중…' : '지금 동기화'}
          </button>
        </div>

        {result && (
          <div className="flex gap-4 mb-3">
            <span className="text-sm text-green-400">수집: {result.ingested}</span>
            <span className="text-sm text-neutral-400">스킵: {result.skipped}</span>
            {(result.errors ?? 0) > 0 && <span className="text-sm text-red-400">오류: {result.errors}</span>}
          </div>
        )}

        {log.length > 0 && (
          <div
            ref={logRef}
            className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 h-40 overflow-y-auto font-mono text-xs text-neutral-400 space-y-0.5"
          >
            {log.map((line, i) => <p key={i}>{line}</p>)}
          </div>
        )}
      </div>
    </div>
  )
}
