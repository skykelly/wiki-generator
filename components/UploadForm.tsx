'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tab = 'url' | 'text' | 'file'

export default function UploadForm({ wikiId }: { wikiId?: string }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('url')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // URL tab
  const [url, setUrl] = useState('')
  const [urlTitle, setUrlTitle] = useState('')

  // Text tab
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [textUrl, setTextUrl] = useState('')

  // File tab
  const [fileTitle, setFileTitle] = useState('')
  const [fileUrl, setFileUrl] = useState('')

  const submit = async (body: object | FormData) => {
    setLoading(true)
    setError('')
    try {
      let finalBody = body
      if (wikiId) {
        if (body instanceof FormData) {
          body.set('wiki_id', wikiId)
        } else {
          finalBody = { ...(body as object), wiki_id: wikiId }
        }
      }
      const res = await fetch('/api/sources/upload', {
        method: 'POST',
        ...(finalBody instanceof FormData
          ? { body: finalBody }
          : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalBody) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `오류 ${res.status}`)
      router.back()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }

  const handleUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return
    await submit({ url, title: urlTitle || undefined })
  }

  const handleText = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!textTitle || !textContent) return
    await submit({ title: textTitle, content: textContent, url: textUrl || undefined })
  }

  const handleFile = async (e: React.FormEvent) => {
    e.preventDefault()
    const input = (e.currentTarget as HTMLFormElement).querySelector('input[type="file"]') as HTMLInputElement
    const file = input?.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    if (fileTitle) fd.append('title', fileTitle)
    if (fileUrl) fd.append('url', fileUrl)
    await submit(fd)
  }

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm rounded-lg transition-colors ${
      tab === t ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
    }`

  const inputClass = 'w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500'
  const labelClass = 'block text-xs text-neutral-400 mb-1.5'
  const submitClass = `w-full mt-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2.5 transition-colors ${loading ? 'cursor-not-allowed' : ''}`

  return (
    <div className="max-w-xl">
      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-neutral-900 p-1 rounded-xl w-fit">
        <button className={tabClass('url')}  onClick={() => setTab('url')}>URL</button>
        <button className={tabClass('text')} onClick={() => setTab('text')}>텍스트</button>
        <button className={tabClass('file')} onClick={() => setTab('file')}>파일</button>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {/* URL 탭 */}
      {tab === 'url' && (
        <form onSubmit={handleUrl} className="space-y-4">
          <div>
            <label className={labelClass}>URL <span className="text-red-500">*</span></label>
            <input
              type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article" required
              className={inputClass}
            />
            <p className="text-xs text-neutral-600 mt-1">Jina Reader를 통해 본문을 자동으로 추출합니다.</p>
          </div>
          <div>
            <label className={labelClass}>제목 (선택 — 비우면 페이지 제목 사용)</label>
            <input
              type="text" value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)}
              placeholder="소스 제목" className={inputClass}
            />
          </div>
          <button type="submit" disabled={loading || !url} className={submitClass}>
            {loading ? '처리 중…' : '소스 추가'}
          </button>
        </form>
      )}

      {/* 텍스트 탭 */}
      {tab === 'text' && (
        <form onSubmit={handleText} className="space-y-4">
          <div>
            <label className={labelClass}>제목 <span className="text-red-500">*</span></label>
            <input
              type="text" value={textTitle} onChange={(e) => setTextTitle(e.target.value)}
              placeholder="소스 제목" required className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>원문 <span className="text-red-500">*</span></label>
            <textarea
              value={textContent} onChange={(e) => setTextContent(e.target.value)}
              rows={10} placeholder="분석할 텍스트를 붙여넣으세요…" required
              className={`${inputClass} resize-y min-h-[200px]`}
            />
          </div>
          <div>
            <label className={labelClass}>출처 URL (선택)</label>
            <input
              type="url" value={textUrl} onChange={(e) => setTextUrl(e.target.value)}
              placeholder="https://..." className={inputClass}
            />
          </div>
          <button type="submit" disabled={loading || !textTitle || !textContent} className={submitClass}>
            {loading ? '처리 중…' : '소스 추가'}
          </button>
        </form>
      )}

      {/* 파일 탭 */}
      {tab === 'file' && (
        <form onSubmit={handleFile} className="space-y-4">
          <div>
            <label className={labelClass}>파일 (.md / .txt) <span className="text-red-500">*</span></label>
            <input
              type="file" accept=".md,.txt" required
              className="w-full text-sm text-neutral-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:text-neutral-300 file:text-sm hover:file:bg-neutral-700 cursor-pointer"
            />
          </div>
          <div>
            <label className={labelClass}>제목 (선택 — 비우면 파일명 사용)</label>
            <input
              type="text" value={fileTitle} onChange={(e) => setFileTitle(e.target.value)}
              placeholder="소스 제목" className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>출처 URL (선택)</label>
            <input
              type="url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://..." className={inputClass}
            />
          </div>
          <button type="submit" disabled={loading} className={submitClass}>
            {loading ? '처리 중…' : '소스 추가'}
          </button>
        </form>
      )}
    </div>
  )
}
