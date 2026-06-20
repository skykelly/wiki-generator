import Link from 'next/link'
import { getWikis } from '@/lib/data'

const STATUS_LABEL: Record<string, string> = {
  scaffolding: '스캐폴드 생성 중',
  reviewing: '검토 대기',
  drafting: '초안 생성 중',
  ready: '공개',
  error: '오류',
}

const STATUS_COLOR: Record<string, string> = {
  scaffolding: 'text-yellow-400 bg-yellow-400/10',
  reviewing: 'text-cyan-400 bg-cyan-400/10',
  drafting: 'text-purple-400 bg-purple-400/10',
  ready: 'text-green-400 bg-green-400/10',
  error: 'text-red-400 bg-red-400/10',
}

export default async function PlatformHomePage() {
  const wikis = await getWikis()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-white mb-2">Wiki Generator</h1>
        <p className="text-sm text-neutral-400">주제를 입력하면 LLM이 자동으로 위키를 생성하고 지속 업데이트합니다.</p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest">위키 목록</h2>
        <Link
          href="/create"
          className="text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + 새 위키 만들기
        </Link>
      </div>

      {wikis.length === 0 ? (
        <div className="text-center py-20 border border-neutral-800 rounded-2xl">
          <p className="text-neutral-500 text-sm mb-4">아직 생성된 위키가 없습니다.</p>
          <Link href="/create" className="text-sm text-cyan-500 hover:text-cyan-400 transition-colors">
            첫 번째 위키 만들기 →
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {wikis.map((wiki) => {
            const href = wiki.status === 'ready'
              ? `/w/${wiki.slug}`
              : `/w/${wiki.slug}/admin/seed`
            return (
              <Link
                key={wiki.id}
                href={href}
                className="group block bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 rounded-xl p-5 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-base font-semibold text-white leading-tight">{wiki.title}</h3>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLOR[wiki.status] ?? 'text-neutral-400 bg-neutral-800'}`}>
                    {STATUS_LABEL[wiki.status] ?? wiki.status}
                  </span>
                </div>
                {wiki.description && (
                  <p className="text-sm text-neutral-400 leading-relaxed line-clamp-2">{wiki.description}</p>
                )}
                {wiki.topic && (
                  <p className="text-xs text-neutral-600 mt-3">주제: {wiki.topic}</p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
