'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { renderMarkdown } from '@/lib/markdown'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import DiffView from '@/components/DiffView'
import type { EditorialVersion } from '@/lib/types'

export default function EditorialTab({
  content: initialContent, versions: initialVersions, wikiId,
}: {
  content: string
  versions: EditorialVersion[]
  wikiId?: string
}) {
  const router = useRouter()
  const [content, setContent] = useState(initialContent)
  const [publishedContent, setPublishedContent] = useState(initialContent)
  const [versions, setVersions] = useState(initialVersions)
  const [previewHtml, setPreviewHtml] = useState('')
  const [selectedVersion, setSelectedVersion] = useState('')
  const [viewMode, setViewMode] = useState<'preview' | 'diff'>('preview')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { setVersions(initialVersions) }, [initialVersions])
  useEffect(() => { setPublishedContent(initialContent) }, [initialContent])

  useEffect(() => {
    const timer = setTimeout(() => { renderMarkdown(content).then(setPreviewHtml) }, 250)
    return () => clearTimeout(timer)
  }, [content])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleVersionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = e.target.value
    setSelectedVersion(idx)
    if (idx === '') return
    const version = versions[Number(idx)]
    if (version) setContent(version.content)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/editorial', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, wiki_id: wikiId }),
      })
      if (!res.ok) throw new Error()
      setToast('저장되었습니다')
      setSelectedVersion('')
      router.refresh()
    } catch {
      setToast('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateDraft = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/synthesize-editorial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wiki_id: wikiId }),
      })
      if (!res.ok) throw new Error()
      setToast('초안이 생성되었습니다')
      router.refresh()
    } catch {
      setToast('초안 생성에 실패했습니다')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedVersion}
          onChange={handleVersionSelect}
          className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600"
        >
          <option value="">버전 선택…</option>
          {versions.map((v, i) => (
            <option key={i} value={i}>
              {v.is_draft ? v.label : `${v.label} (저장됨)`}
            </option>
          ))}
        </select>

        <button
          onClick={handleGenerateDraft}
          disabled={generating}
          className="text-sm bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {generating ? '생성 중…' : 'AI 초안 생성'}
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors ml-auto"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={24}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white font-mono resize-y focus:outline-none focus:border-neutral-600"
          placeholder="마크다운으로 작성하세요…"
        />
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('preview')}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                viewMode === 'preview'
                  ? 'bg-white text-neutral-950'
                  : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-700'
              }`}
            >
              미리보기
            </button>
            <button
              onClick={() => setViewMode('diff')}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                viewMode === 'diff'
                  ? 'bg-white text-neutral-950'
                  : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-700'
              }`}
            >
              Diff
            </button>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 overflow-y-auto max-h-[600px]">
            {viewMode === 'preview' ? (
              <MarkdownRenderer html={previewHtml} />
            ) : (
              <DiffView oldText={publishedContent} newText={content} />
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-neutral-800 border border-neutral-700 text-white text-sm px-4 py-3 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
