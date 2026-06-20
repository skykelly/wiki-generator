import Link from 'next/link'
import { getEditorialContent, getConceptItems, getSources } from '@/lib/data'
import { renderMarkdown } from '@/lib/markdown'
import MarkdownRenderer from '@/components/MarkdownRenderer'

export default async function WikiHomePage({
  params,
}: {
  params: Promise<{ wikiSlug: string }>
}) {
  const { wikiSlug } = await params
  const wikiId = `wiki_${wikiSlug}`
  const base = `/w/${wikiSlug}`

  const [editorialContent, allConcepts, allSources] = await Promise.all([
    getEditorialContent(wikiId),
    getConceptItems(wikiId),
    getSources(wikiId),
  ])

  const editorialHtml = editorialContent ? await renderMarkdown(editorialContent) : ''
  const topConcepts = [...allConcepts]
    .sort((a, b) => b.source_count - a.source_count || b.confidence - a.confidence)
    .slice(0, 6)
  const latestSources = allSources.slice(0, 4)
  const lastUpdated = allConcepts.length > 0
    ? new Date(allConcepts.reduce((max, c) =>
        new Date(c.updated_at) > new Date(max) ? c.updated_at : max,
        allConcepts[0].updated_at
      )).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <>
      <div className="border-b border-neutral-800 bg-neutral-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-10 flex items-center gap-4 text-xs text-neutral-500">
          <span>Sources <strong className="text-neutral-300">{allSources.length}</strong>개</span>
          <span className="text-neutral-700">·</span>
          <span>Concepts <strong className="text-neutral-300">{allConcepts.length}</strong>개</span>
          {lastUpdated && (
            <>
              <span className="text-neutral-700">·</span>
              <span>업데이트 <strong className="text-neutral-300">{lastUpdated}</strong></span>
            </>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid lg:grid-cols-[1fr_300px] gap-10">
          <section>
            {editorialHtml ? (
              <MarkdownRenderer html={editorialHtml} />
            ) : (
              <div className="space-y-4">
                <p className="text-neutral-600 text-xs">Admin → Editorial 탭에서 에디토리얼 콘텐츠를 작성하세요.</p>
              </div>
            )}
          </section>

          <aside className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">핵심 개념</h2>
                <Link href={`${base}/concepts`} className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">전체 보기 →</Link>
              </div>
              <div className="flex flex-col gap-2">
                {topConcepts.map((concept) => (
                  <Link key={concept.id} href={`${base}/concepts/${concept.slug}`}
                    className="group block bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 rounded-xl p-3 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors leading-snug">{concept.title}</span>
                      {concept.source_count > 0 && <span className="text-xs text-neutral-600 shrink-0 mt-0.5">{concept.source_count}</span>}
                    </div>
                    {concept.brief && <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">{concept.brief}</p>}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">최신 소스</h2>
                <Link href={`${base}/sources`} className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">전체 보기 →</Link>
              </div>
              {latestSources.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {latestSources.map((source) => (
                    <Link key={source.id} href={`${base}/sources/${source.id}`}
                      className="group block bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 rounded-xl p-3 transition-all">
                      <p className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors leading-snug line-clamp-2">{source.title}</p>
                      {source.one_line_summary && <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{source.one_line_summary}</p>}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-600 py-2">Sources 탭에서 새 소스를 추가하세요.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
