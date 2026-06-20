'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CreateWikiPage() {
  const router = useRouter()
  const [topic, setTopic] = useState('')
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState<'ko' | 'en'>('ko')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/wikis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), title: title.trim() || topic.trim(), language }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '오류 발생')
      router.push(`/w/${data.slug}/admin/seed`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류 발생')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <Link href="/" className="text-neutral-500 hover:text-neutral-300 text-sm">← 플랫폼 홈</Link>
          <h1 className="mt-4 text-2xl font-bold text-white">새 위키 만들기</h1>
          <p className="mt-2 text-neutral-400 text-sm">
            주제를 입력하면 AI가 목차와 개념 구조를 자동 생성합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">
              주제 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 홈스타일 인테리어 트렌드"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
              required
            />
            <p className="mt-1 text-xs text-neutral-500">위키가 다룰 주제를 구체적으로 입력하세요.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">위키 제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={topic || '주제와 동일하게 사용됩니다'}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">언어</label>
            <div className="flex gap-3">
              {(['ko', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    language === lang
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-500'
                  }`}
                >
                  {lang === 'ko' ? '한국어' : 'English'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-neutral-700 disabled:cursor-not-allowed text-black disabled:text-neutral-500 font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? '생성 중…' : '위키 생성 시작'}
          </button>
        </form>
      </div>
    </div>
  )
}
