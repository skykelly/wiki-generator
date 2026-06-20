'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GraphTab({ builtAt, wikiId }: { builtAt: string; wikiId?: string }) {
  const router = useRouter()
  const [rebuilding, setRebuilding] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleRebuild = async () => {
    setRebuilding(true)
    try {
      const res = await fetch('/api/graph/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wiki_id: wikiId }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setToast(`그래프를 재생성했습니다 (노드 ${data.nodes}개, 링크 ${data.links}개)`)
      router.refresh()
    } catch {
      setToast('그래프 재생성에 실패했습니다')
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Knowledge Graph</h2>
          <p className="text-xs text-neutral-500 mt-1">
            {builtAt ? `마지막 생성: ${new Date(builtAt).toLocaleString('ko-KR')}` : '아직 생성된 그래프가 없습니다.'}
          </p>
        </div>
        <button
          onClick={handleRebuild} disabled={rebuilding}
          className="text-sm bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {rebuilding ? '생성 중…' : '그래프 재생성'}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-neutral-800 border border-neutral-700 text-white text-sm px-4 py-3 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
