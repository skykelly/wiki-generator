'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { KnowledgeItem } from '@/lib/types'

const TABS: { key: 'all' | KnowledgeItem['type']; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'source', label: 'Sources' },
  { key: 'concept', label: 'Concepts' },
  { key: 'page', label: 'Wiki' },
]

const TYPE_LABELS: Record<KnowledgeItem['type'], string> = {
  source: 'Source',
  concept: 'Concept',
  page: 'Wiki',
}

function itemHref(item: KnowledgeItem, basePath: string): string {
  switch (item.type) {
    case 'source': return `${basePath}/sources/${item.id}`
    case 'concept': return `${basePath}/concepts/${item.slug}`
    case 'page': return `${basePath}/wiki/${item.slug}`
  }
}

export default function SearchResults({
  items, initialQuery, basePath = '',
}: {
  items: KnowledgeItem[]
  initialQuery: string
  basePath?: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<'all' | KnowledgeItem['type']>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (activeTab !== 'all' && item.type !== activeTab) return false
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) ||
        (item.summary?.toLowerCase().includes(q) ?? false) ||
        item.topics.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [items, activeTab, query])

  return (
    <div>
      {/* 검색어 입력 */}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="제목, 요약, 토픽으로 검색…"
        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 mb-4"
      />

      {/* 탭 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-neutral-950'
                : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 결과 */}
      {filtered.length === 0 ? (
        <p className="text-center py-16 text-neutral-600 text-sm">검색 결과가 없습니다.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <Link
              key={`${item.type}:${item.id}`}
              href={itemHref(item, basePath)}
              className="group block bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 rounded-xl p-4 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-white leading-snug group-hover:text-white">{item.title}</h3>
                <span className="text-xs bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded-md shrink-0">
                  {TYPE_LABELS[item.type]}
                </span>
              </div>
              {item.summary && (
                <p className="text-xs text-neutral-500 mt-1.5 line-clamp-2 leading-relaxed">{item.summary}</p>
              )}
              {item.topics.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {item.topics.slice(0, 3).map((t) => (
                    <span key={t} className="text-xs bg-neutral-800/60 border border-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded-md">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
