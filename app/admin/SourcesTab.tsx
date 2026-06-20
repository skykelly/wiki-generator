'use client'
import { useRouter } from 'next/navigation'
import UploadForm from '@/components/UploadForm'
import type { SourceItem } from '@/lib/types'

export default function SourcesTab({ sources, wikiId }: { sources: SourceItem[]; wikiId?: string }) {
  const router = useRouter()

  async function handleDelete(id: string) {
    if (!confirm('이 소스를 삭제하시겠습니까?')) return
    await fetch(`/api/source?id=${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-10">
      <div>
        <h2 className="text-sm font-semibold text-neutral-300 mb-4">소스 추가</h2>
        <UploadForm wikiId={wikiId} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-neutral-300 mb-4">
          소스 목록 <span className="text-neutral-600 font-normal">({sources.length})</span>
        </h2>
        <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto pr-1">
          {sources.length === 0 && (
            <p className="text-xs text-neutral-600 py-4">아직 소스가 없습니다.</p>
          )}
          {sources.map((s) => (
            <div key={s.id} className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{s.title}</p>
                {s.one_line_summary && (
                  <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{s.one_line_summary}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${
                    s.status === 'done' ? 'text-green-400 bg-green-400/10 border-green-800/50' :
                    s.status === 'error' ? 'text-red-400 bg-red-400/10 border-red-800/50' :
                    'text-yellow-400 bg-yellow-400/10 border-yellow-800/50'
                  }`}>{s.status}</span>
                  {s.topics.length > 0 && (
                    <span className="text-xs text-neutral-600">{s.topics.slice(0, 2).join(', ')}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(s.id)}
                className="shrink-0 text-xs text-neutral-600 hover:text-red-400 transition-colors mt-0.5"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
