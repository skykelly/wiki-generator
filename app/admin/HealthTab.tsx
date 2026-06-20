'use client'
import { useEffect, useState } from 'react'
import type { ConceptItem, IngestLogEntry, LintIssue } from '@/lib/types'

const TYPE_STYLES: Record<LintIssue['type'], string> = {
  empty_content: 'bg-red-950/60 text-red-400 border-red-900/50',
  no_topics: 'bg-yellow-950/60 text-yellow-400 border-yellow-900/50',
  no_sources: 'bg-yellow-950/60 text-yellow-400 border-yellow-900/50',
  stale: 'bg-yellow-950/60 text-yellow-400 border-yellow-900/50',
  orphan: 'bg-orange-950/60 text-orange-400 border-orange-900/50',
}

export default function HealthTab({
  ingestLog, onEditConcept, wikiId,
}: {
  concepts: ConceptItem[]
  ingestLog: IngestLogEntry[]
  onEditConcept: (slug: string) => void
  wikiId?: string
}) {
  const [issues, setIssues] = useState<LintIssue[] | null>(null)
  const [linting, setLinting] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [expandedLog, setExpandedLog] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const runLint = async () => {
    setLinting(true)
    try {
      const res = await fetch('/api/admin/lint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wiki_id: wikiId }),
      })
      if (!res.ok) throw new Error()
      setIssues(await res.json())
    } catch {
      setToast('점검에 실패했습니다')
    } finally {
      setLinting(false)
    }
  }

  const runRebuild = async () => {
    setRebuilding(true)
    try {
      const res = await fetch('/api/admin/rebuild-embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wiki_id: wikiId }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setToast(`${data.rebuilt}개 레코드의 embeddings를 재빌드했습니다`)
    } catch {
      setToast('재빌드에 실패했습니다')
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <div className="space-y-10">
      {/* 위키 점검 */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-white">위키 점검</h2>
          <div className="flex gap-2">
            <button
              onClick={runLint} disabled={linting}
              className="text-sm bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {linting ? '점검 중…' : '점검 실행'}
            </button>
            <button
              onClick={runRebuild} disabled={rebuilding}
              className="text-sm bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {rebuilding ? '재빌드 중…' : '전체 Embeddings 재빌드'}
            </button>
          </div>
        </div>

        {issues === null ? (
          <p className="text-sm text-neutral-600">점검 실행 버튼을 눌러 위키 상태를 확인하세요.</p>
        ) : issues.length === 0 ? (
          <p className="text-sm text-emerald-500">발견된 이슈가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">유형</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">개념</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">상세</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {issues.map((issue, i) => (
                  <tr key={i} className="border-b border-neutral-800/60">
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded-md border ${TYPE_STYLES[issue.type]}`}>{issue.type}</span>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-200">{issue.title}</td>
                    <td className="px-3 py-2.5 text-neutral-500 text-xs">{issue.detail}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => onEditConcept(issue.concept_slug)} className="text-xs text-accent-500 hover:text-accent-400 transition-colors">
                        편집 →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ingest Log */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-4">Ingest Log</h2>
        {ingestLog.length === 0 ? (
          <p className="text-sm text-neutral-600">아직 ingest 기록이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {ingestLog.slice(0, 50).map((entry, i) => {
              const isOpen = expandedLog === i
              return (
                <div key={i}>
                  <button
                    onClick={() => setExpandedLog(isOpen ? null : i)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${isOpen ? 'bg-neutral-800' : 'hover:bg-neutral-900'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-neutral-200 truncate">{entry.title}</span>
                      <span className="text-xs text-neutral-600 shrink-0">
                        {entry.date ? new Date(entry.date).toLocaleDateString('ko-KR') : '-'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 mt-1">
                      업데이트 {entry.concepts_updated.length}개 · 신규 {entry.concepts_created.length}개
                    </p>
                  </button>
                  {isOpen && (
                    <div className="px-4 py-3 bg-neutral-900/60 rounded-b-lg -mt-1 space-y-2">
                      {entry.concepts_updated.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-neutral-600">업데이트</span>
                          {entry.concepts_updated.map((slug) => (
                            <span key={slug} className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-md">{slug}</span>
                          ))}
                        </div>
                      )}
                      {entry.concepts_created.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-neutral-600">신규</span>
                          {entry.concepts_created.map((slug) => (
                            <span key={slug} className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-md">{slug}</span>
                          ))}
                        </div>
                      )}
                      {entry.concepts_updated.length === 0 && entry.concepts_created.length === 0 && (
                        <p className="text-xs text-neutral-600">변경된 개념이 없습니다.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-neutral-800 border border-neutral-700 text-white text-sm px-4 py-3 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
