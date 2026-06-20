'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { renderMarkdown } from '@/lib/markdown'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import type { ConceptItem } from '@/lib/types'

const CONCEPT_TYPES = ['style', 'lifestyle', 'spatial', 'functional', 'material', 'market']
const CONCEPT_STATUSES = ['canonical', 'candidate', 'supporting']

const inputClass = 'w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500'
const labelClass = 'block text-xs text-neutral-400 mb-1.5'

interface FormState {
  id: string
  title: string
  slug: string
  brief: string
  concept_type: string
  concept_status: string
  confidence: number
  aliases: string
  topics: string
  related_concepts: string
  content: string
}

function toForm(c: ConceptItem): FormState {
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    brief: c.brief ?? '',
    concept_type: c.concept_type ?? '',
    concept_status: c.concept_status,
    confidence: c.confidence,
    aliases: c.aliases.join('\n'),
    topics: c.topics.join('\n'),
    related_concepts: c.related_concepts.join('\n'),
    content: c.content ?? '',
  }
}

export default function ConceptsTab({
  concepts: initialConcepts, focusSlug, onFocusConsumed, wikiId,
}: {
  concepts: ConceptItem[]
  focusSlug?: string | null
  onFocusConsumed?: () => void
  wikiId?: string
}) {
  const router = useRouter()
  const [concepts, setConcepts] = useState(initialConcepts)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(initialConcepts[0]?.id ?? null)
  const [form, setForm] = useState<FormState | null>(initialConcepts[0] ? toForm(initialConcepts[0]) : null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { setConcepts(initialConcepts) }, [initialConcepts])

  useEffect(() => {
    if (!focusSlug) return
    const c = concepts.find((c) => c.slug === focusSlug)
    if (c) selectConcept(c)
    onFocusConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSlug])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!showPreview || form?.content === undefined) return
    const content = form.content
    const timer = setTimeout(() => { renderMarkdown(content).then(setPreviewHtml) }, 250)
    return () => clearTimeout(timer)
  }, [form?.content, showPreview])

  const filtered = concepts.filter((c) =>
    !query || c.title.toLowerCase().includes(query.toLowerCase()) || c.slug.toLowerCase().includes(query.toLowerCase())
  )

  const selectConcept = (c: ConceptItem) => {
    setSelectedId(c.id)
    setForm(toForm(c))
    setShowPreview(false)
  }

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/concept', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          title: form.title,
          slug: form.slug,
          brief: form.brief || undefined,
          concept_type: form.concept_type || undefined,
          concept_status: form.concept_status,
          confidence: form.confidence,
          aliases: form.aliases.split('\n').map((s) => s.trim()).filter(Boolean),
          topics: form.topics.split('\n').map((s) => s.trim()).filter(Boolean),
          related_concepts: form.related_concepts.split('\n').map((s) => s.trim()).filter(Boolean),
          content: form.content,
          wiki_id: wikiId,
        }),
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
    <div className="grid lg:grid-cols-[280px_1fr] gap-6">
      {/* 좌: 목록 */}
      <div>
        <input
          type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="검색…" className={`${inputClass} mb-3`}
        />
        <div className="flex flex-col gap-1 max-h-[70vh] overflow-y-auto pr-1">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => selectConcept(c)}
              className={`text-left rounded-lg px-3 py-2 transition-colors ${
                selectedId === c.id ? 'bg-neutral-800' : 'hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-white truncate">{c.title}</span>
                <span className="text-xs text-neutral-600 shrink-0">{c.source_count}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                  c.concept_status === 'canonical'
                    ? 'bg-emerald-950/60 text-emerald-600 border border-emerald-900/50'
                    : 'bg-neutral-800 text-neutral-500'
                }`}>
                  {c.concept_status}
                </span>
                {c.last_synthesized_at && (
                  <span className="text-xs text-neutral-700">{new Date(c.last_synthesized_at).toLocaleDateString('ko-KR')}</span>
                )}
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-neutral-600 px-3 py-4">검색 결과가 없습니다.</p>}
        </div>
      </div>

      {/* 우: 편집 폼 */}
      <div>
        {form ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>제목</label>
                <input className={inputClass} value={form.title} onChange={(e) => updateField('title', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Slug</label>
                <input className={inputClass} value={form.slug} onChange={(e) => updateField('slug', e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelClass}>한 줄 정의</label>
              <input className={inputClass} value={form.brief} onChange={(e) => updateField('brief', e.target.value)} />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>concept_type</label>
                <select className={inputClass} value={form.concept_type} onChange={(e) => updateField('concept_type', e.target.value)}>
                  <option value="">(없음)</option>
                  {CONCEPT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>concept_status</label>
                <select className={inputClass} value={form.concept_status} onChange={(e) => updateField('concept_status', e.target.value)}>
                  {CONCEPT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>confidence (0-100)</label>
                <input
                  type="number" min={0} max={100} className={inputClass}
                  value={form.confidence} onChange={(e) => updateField('confidence', Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>aliases (줄바꿈 구분)</label>
                <textarea rows={4} className={`${inputClass} resize-y font-mono`} value={form.aliases} onChange={(e) => updateField('aliases', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>topics (줄바꿈 구분)</label>
                <textarea rows={4} className={`${inputClass} resize-y font-mono`} value={form.topics} onChange={(e) => updateField('topics', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>related_concepts (slug, 줄바꿈 구분)</label>
                <textarea rows={4} className={`${inputClass} resize-y font-mono`} value={form.related_concepts} onChange={(e) => updateField('related_concepts', e.target.value)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`${labelClass} mb-0`}>content (마크다운)</label>
                <button onClick={() => setShowPreview((v) => !v)} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
                  {showPreview ? '편집으로' : '미리보기'}
                </button>
              </div>
              {showPreview ? (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 min-h-[400px] max-h-[600px] overflow-y-auto">
                  <MarkdownRenderer html={previewHtml} />
                </div>
              ) : (
                <textarea
                  rows={20} className={`${inputClass} resize-y font-mono`}
                  value={form.content} onChange={(e) => updateField('content', e.target.value)}
                />
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={handleSave} disabled={saving} className="text-sm bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-600">왼쪽에서 개념을 선택하세요.</p>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-neutral-800 border border-neutral-700 text-white text-sm px-4 py-3 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
