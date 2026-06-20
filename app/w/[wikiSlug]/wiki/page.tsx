import Link from 'next/link'
import { getWikiPages, getTopicsConfig } from '@/lib/data'

export default async function WikiIndexPage({
  params,
}: {
  params: Promise<{ wikiSlug: string }>
}) {
  const { wikiSlug } = await params
  const wikiId = `wiki_${wikiSlug}`
  const base = `/w/${wikiSlug}`

  const [wikiPages, topics] = await Promise.all([getWikiPages(wikiId), getTopicsConfig(wikiId)])

  const groups = new Map<string, typeof wikiPages>()
  for (const p of wikiPages) {
    const key = p.chapter_number || '00'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }
  const sortedKeys = [...groups.keys()].sort()
  const chapterTitle = (num: string) => topics.find((t) => t.number === num)?.title

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Wiki</h1>
        <p className="text-xs text-neutral-500 mt-0.5">{wikiPages.length}개 문서</p>
      </div>

      {wikiPages.length === 0 ? (
        <p className="text-center py-16 text-neutral-600 text-sm">등록된 위키 문서가 없습니다.</p>
      ) : (
        <div className="space-y-10">
          {sortedKeys.map((num) => (
            <section key={num}>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">
                {num}{chapterTitle(num) ? ` · ${chapterTitle(num)}` : ''}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.get(num)!.map((p) => (
                  <Link key={p.id} href={`${base}/wiki/${p.slug}`}
                    className="group block bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 rounded-xl p-4 transition-all">
                    <h3 className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors leading-snug">{p.title}</h3>
                    {p.summary && <p className="text-xs text-neutral-500 mt-1.5 line-clamp-2 leading-relaxed">{p.summary}</p>}
                    {p.subsections.length > 0 && <p className="text-xs text-neutral-600 mt-3">{p.subsections.length}개 섹션</p>}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
