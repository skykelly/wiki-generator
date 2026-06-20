'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MetricCard } from '@/lib/types'

const inputClass = 'w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500'

const FIELDS: { key: Exclude<keyof MetricCard, 'id'>; label: string }[] = [
  { key: 'title', label: '제목' },
  { key: 'stat', label: '수치' },
  { key: 'definition', label: '정의' },
  { key: 'source', label: '출처' },
  { key: 'message', label: '메시지' },
  { key: 'url', label: 'URL' },
]

function emptyMetric(): MetricCard {
  return { id: `metric_${Date.now()}`, title: '', stat: '', definition: '', source: '', message: '', url: '' }
}

export default function MetricsTab({ metrics: initialMetrics, wikiId }: { metrics: MetricCard[]; wikiId?: string }) {
  const router = useRouter()
  const [metrics, setMetrics] = useState(initialMetrics)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { setMetrics(initialMetrics) }, [initialMetrics])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const update = (idx: number, key: Exclude<keyof MetricCard, 'id'>, value: string) => {
    setMetrics((prev) => prev.map((m, i) => (i === idx ? { ...m, [key]: value } : m)))
  }

  const addRow = () => setMetrics((prev) => [...prev, emptyMetric()])
  const removeRow = (idx: number) => setMetrics((prev) => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/metrics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics, wiki_id: wikiId }),
      })
      if (!res.ok) throw new Error()
      setToast('저장되었습니다')
      router.refresh()
    } catch {
      setToast('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">{metrics.length}개 지표</p>
        <div className="flex gap-2">
          <button onClick={addRow} className="text-sm bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1.5 rounded-lg transition-colors">+ 추가</button>
          <button onClick={handleSave} disabled={saving} className="text-sm bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors">
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      {metrics.length === 0 ? (
        <p className="text-center py-12 text-neutral-600 text-sm">등록된 지표가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-800">
                {FIELDS.map((f) => (
                  <th key={f.key} className="px-2 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">{f.label}</th>
                ))}
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, idx) => (
                <tr key={m.id} className="border-b border-neutral-800/60">
                  {FIELDS.map((f) => (
                    <td key={f.key} className="px-2 py-2 min-w-[120px]">
                      <input className={inputClass} value={m[f.key]} onChange={(e) => update(idx, f.key, e.target.value)} />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right">
                    <button onClick={() => removeRow(idx)} className="text-neutral-700 hover:text-red-500 transition-colors" aria-label="삭제">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-neutral-800 border border-neutral-700 text-white text-sm px-4 py-3 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
