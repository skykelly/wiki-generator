'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { renderMarkdown } from '@/lib/markdown'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import type { WikiPageItem } from '@/lib/types'

const inputClass = 'w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500'
const labelClass = 'block text-xs text-neutral-400 mb-1.5'

interface FormState {
  id: string
  title: string
  slug: string
  chapter_number: string
  summary: string
  subsections: string
  topics: string
  content: string
}

function toForm(p: WikiPageItem): FormState {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    chapter_number: p.chapter_number,
    summary: p.summary ?? '',
    subsections: JSON.stringify(p.subsections, null, 2),
    topics: p.topics.join('\n'),
    content: p.content ?? '',
  }
}

export default function PagesTab({ pages: initialPages, wikiId }: { pages: WikiPageItem[]; wikiId?: string }) {
  const router = useRouter()
  const [pages, setPages] = useState(initialPages)
  const [selectedId, setSelectedId] = useState<string | null>(initialPages[0]?.id ?? null)
  const [form, setForm] = useState<FormState | null>(initialPages[0] ? toForm(initialPages[0]) : null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { setPages(initialPages) }, [initialPages])

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

  const selectPage = (p: WikiPageItem) => {
    setSelectedId(p.id)
    setForm(toForm(p))
    setShowPreview(false)
  }

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  const handleSave = async () => {
    if (!form) return

    let subsections: { number: string; title: string }[]
    try {
      subsections = JSON.parse(form.subsections)
      if (!Array.isArray(subsections)) throw new Error()
    } catch {
      setToast('subsections JSON 형식이 올바르지 않습니다')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          title: form.title,
          slug: form.slug,
          chapter_number: form.chapter_number || undefined,
          subsections,
          summary: form.summary || undefined,
          topics: form.topics.split('\n').map((s) => s.trim()).filter(Boolean),
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
      <div className="flex flex-col gap-1 max-h-[70vh] overflow-y-auto pr-1">
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => selectPage(p)}
            className={`text-left rounded-lg px-3 py-2 transition-colors ${
              selectedId === p.id ? 'bg-neutral-800' : 'hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-600 shrink-0">{p.chapter_number}</span>
              <span className="text-sm text-white truncate">{p.title}</span>
            </div>
          </button>
        ))}
        {pages.length === 0 && <p className="text-xs text-neutral-600 px-3 py-4">등록된 페이지가 없습니다.</p>}
      </div>

      {/* 우: 편집 폼 */}
      <div>
        {form ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-[1fr_120px_1fr] gap-4">
              <div>
                <label className={labelClass}>제목</label>
                <input className={inputClass} value={form.title} onChange={(e) => updateField('title', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>chapter_number</label>
                <input className={inputClass} value={form.chapter_number} onChange={(e) => updateField('chapter_number', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Slug</label>
                <input className={inputClass} value={form.slug} onChange={(e) => updateField('slug', e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelClass}>요약</label>
              <input className={inputClass} value={form.summary} onChange={(e) => updateField('summary', e.target.value)} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>topics (줄바꿈 구분)</label>
                <textarea rows={4} className={`${inputClass} resize-y font-mono`} value={form.topics} onChange={(e) => updateField('topics', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>subsections (JSON)</label>
                <textarea rows={4} className={`${inputClass} resize-y font-mono`} value={form.subsections} onChange={(e) => updateField('subsections', e.target.value)} />
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
          <p className="text-sm text-neutral-600">왼쪽에서 페이지를 선택하세요.</p>
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
