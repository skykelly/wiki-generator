'use client'
import Link from 'next/link'
import { useState, useMemo } from 'react'
import type { SourceItem } from '@/lib/types'

type SortKey = 'title' | 'publisher' | 'published_at' | 'created_at'

const SORT_LABELS: Record<SortKey, string> = {
  title: 'Title', publisher: 'Publisher',
  published_at: 'Date', created_at: 'Ingested',
}

function SortHeader({
  label, sortKey, current, dir, onSort,
}: {
  label: string; sortKey: SortKey
  current: SortKey; dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <th
      className="px-3 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer select-none hover:text-neutral-300 transition-colors whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      {label}
      <span className="ml-1 opacity-50">{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  )
}

export default function SourceTable({ initialSources, basePath = '/sources' }: { initialSources: SourceItem[]; basePath?: string }) {
  const [sources, setSources] = useState(initialSources)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    return [...sources].sort((a, b) => {
      const av = (a[sortKey] ?? '') as string
      const bv = (b[sortKey] ?? '') as string
      const cmp = av.localeCompare(bv, 'ko')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [sources, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('이 소스를 삭제하시겠습니까?')) return
    setDeletingId(id)
    setSources((prev) => prev.filter((s) => s.id !== id))
    if (selectedId === id) setSelectedId(null)
    await fetch(`/api/source?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null)
    setDeletingId(null)
  }

  if (sources.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-600 text-sm">
        소스가 없습니다.{' '}
        <Link href={`${basePath}/upload`} className="text-accent-500 hover:text-accent-400">새 소스 추가 →</Link>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-neutral-800">
            <th className="px-3 py-2.5 text-left text-xs font-medium text-neutral-500 w-10">#</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider w-24">Topic</th>
            <SortHeader label="Title"     sortKey="title"        current={sortKey} dir={sortDir} onSort={handleSort} />
            <th className="px-3 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider hidden lg:table-cell">한 줄 요약</th>
            <SortHeader label="Publisher" sortKey="publisher"    current={sortKey} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Date"      sortKey="published_at" current={sortKey} dir={sortDir} onSort={handleSort} />
            <th className="px-3 py-2.5 w-10" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((source, idx) => {
            const isSelected = selectedId === source.id
            const firstTopic = (source.topics?.[0] ?? '').slice(0, 12)
            const sr = source.synthesis_result
            const hasSynth = (sr?.concepts_updated?.length ?? 0) + (sr?.concepts_created?.length ?? 0) > 0

            return (
              <>
                <tr
                  key={source.id}
                  className={`border-b border-neutral-800/60 cursor-pointer transition-colors ${isSelected ? 'bg-neutral-800/60' : 'hover:bg-neutral-900/60'}`}
                  onClick={() => setSelectedId(isSelected ? null : source.id)}
                >
                  <td className="px-3 py-3 text-neutral-600">{idx + 1}</td>
                  <td className="px-3 py-3">
                    {firstTopic && (
                      <span className="text-xs bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-md truncate max-w-[88px] inline-block">
                        {firstTopic}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 max-w-[240px]">
                    <span className="text-neutral-200 font-medium line-clamp-1">{source.title}</span>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell max-w-[280px]">
                    <span className="text-neutral-500 line-clamp-1 text-xs">{source.one_line_summary}</span>
                  </td>
                  <td className="px-3 py-3 text-neutral-500 text-xs whitespace-nowrap">{source.publisher ?? '-'}</td>
                  <td className="px-3 py-3 text-neutral-500 text-xs whitespace-nowrap">{source.published_at ?? '-'}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={(e) => handleDelete(source.id, e)}
                      disabled={deletingId === source.id}
                      className="text-neutral-700 hover:text-red-500 transition-colors text-base disabled:opacity-40"
                      aria-label="삭제"
                    >
                      ✕
                    </button>
                  </td>
                </tr>

                {/* 인라인 패널 */}
                {isSelected && (
                  <tr key={`${source.id}-panel`} className="border-b border-neutral-800">
                    <td colSpan={7} className="p-0">
                      <div className="bg-neutral-900/80 px-6 py-4 space-y-3">
                        {/* 메타 */}
                        <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
                          {source.url && (
                            <a href={source.url} target="_blank" rel="noopener noreferrer"
                               className="hover:text-accent-400 truncate max-w-xs" onClick={(e) => e.stopPropagation()}>
                              {source.url}
                            </a>
                          )}
                          {source.source_type && (
                            <span className="bg-neutral-800 px-2 py-0.5 rounded-md">{source.source_type}</span>
                          )}
                          {source.status !== 'done' && (
                            <span className={`px-2 py-0.5 rounded-md ${source.status === 'error' ? 'bg-red-950 text-red-400' : 'bg-yellow-950 text-yellow-400'}`}>
                              {source.status}
                            </span>
                          )}
                        </div>

                        {/* 한 줄 요약 */}
                        {source.one_line_summary && (
                          <p className="text-sm text-neutral-300">{source.one_line_summary}</p>
                        )}

                        {/* Topics */}
                        {source.topics?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {source.topics.map((t) => (
                              <span key={t} className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-md">{t}</span>
                            ))}
                          </div>
                        )}

                        {/* Synthesis result */}
                        {hasSynth && (
                          <p className="text-xs text-emerald-600">
                            개념 {sr?.concepts_updated?.length ?? 0}개 업데이트,{' '}
                            {sr?.concepts_created?.length ?? 0}개 신규 생성
                          </p>
                        )}

                        {/* 전체 보기 */}
                        <div>
                          <Link
                            href={`${basePath}/${source.id}`}
                            className="text-xs text-accent-500 hover:text-accent-400 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            전체 보기 →
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
