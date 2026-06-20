import Link from 'next/link'
import { getWikis } from '@/lib/data'

export default async function PlatformHomePage() {
  const wikis = await getWikis()
  const readyWikis = wikis.filter((w) => w.status === 'ready')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-white mb-2">Wiki Generator</h1>
        <p className="text-sm text-neutral-400">주제를 입력하면 LLM이 자동으로 위키를 생성하고 지속 업데이트합니다.</p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest">위키 목록</h2>
        <Link href="/create"
          className="text-sm bg-accent-600 hover:bg-accent-700 text-white px-4 py-2 rounded-lg transition-colors">
          + 새 위키 만들기
        </Link>
      </div>

      {readyWikis.length === 0 ? (
        <div className="text-center py-20 border border-neutral-800 rounded-2xl">
          <p className="text-neutral-500 text-sm mb-4">아직 생성된 위키가 없습니다.</p>
          <Link href="/create"
            className="text-sm text-accent-500 hover:text-accent-400 transition-colors">
            첫 번째 위키 만들기 →
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {readyWikis.map((wiki) => (
            <Link key={wiki.id} href={`/w/${wiki.slug}`}
              className="group block bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 rounded-xl p-5 transition-all">
              <h3 className="text-base font-semibold text-white group-hover:text-white transition-colors mb-1">
                {wiki.title}
              </h3>
              {wiki.description && (
                <p className="text-sm text-neutral-400 leading-relaxed line-clamp-2">{wiki.description}</p>
              )}
              {wiki.topic && (
                <p className="text-xs text-neutral-600 mt-3">주제: {wiki.topic}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
