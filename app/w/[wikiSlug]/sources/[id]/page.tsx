import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSourceById } from '@/lib/data'
import { renderMarkdown } from '@/lib/markdown'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import CollapseSection from '@/app/sources/[id]/CollapseSection'

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ wikiSlug: string; id: string }>
}) {
  const { wikiSlug, id } = await params
  const base = `/w/${wikiSlug}`
  const source = await getSourceById(id)
  if (!source) notFound()

  const [summaryHtml, rawHtml] = await Promise.all([
    source.ai_summary ? renderMarkdown(source.ai_summary) : Promise.resolve(''),
    source.raw_content ? renderMarkdown(source.raw_content) : Promise.resolve(''),
  ])

  const sr = source.synthesis_result
  const updatedConcepts = sr?.concepts_updated ?? []
  const createdConcepts = sr?.concepts_created ?? []
  const hasSynth = updatedConcepts.length > 0 || createdConcepts.length > 0

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link href={`${base}/sources`} className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors mb-4 inline-block">
        ← Sources
      </Link>

      <h1 className="text-xl font-semibold text-white mt-1 mb-4 leading-snug">{source.title}</h1>

      <div className="flex flex-wrap gap-2 mb-5">
        {source.publisher && <span className="text-xs bg-neutral-800 text-neutral-400 px-2 py-1 rounded-md">{source.publisher}</span>}
        {source.published_at && <span className="text-xs bg-neutral-800 text-neutral-400 px-2 py-1 rounded-md">{source.published_at}</span>}
        {source.source_type && <span className="text-xs bg-neutral-800 text-neutral-500 px-2 py-1 rounded-md">{source.source_type}</span>}
        {source.url && (
          <a href={source.url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-accent-500 hover:text-accent-400 px-2 py-1 rounded-md border border-neutral-800 hover:border-neutral-700 transition-colors truncate max-w-xs">
            원문 보기 ↗
          </a>
        )}
      </div>

      {source.topics?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {source.topics.map((t) => (
            <span key={t} className="text-xs bg-neutral-900 border border-neutral-800 text-neutral-400 px-2 py-0.5 rounded-md">{t}</span>
          ))}
        </div>
      )}

      {hasSynth && (
        <div className="mb-6 p-4 bg-emerald-950/30 border border-emerald-900/40 rounded-xl">
          <p className="text-xs text-emerald-500 font-medium mb-2">이 소스로 업데이트된 개념</p>
          <div className="flex flex-wrap gap-1.5">
            {[...updatedConcepts, ...createdConcepts].map((slug) => (
              <Link key={slug} href={`${base}/concepts/${slug}`}
                className="text-xs bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 px-2 py-0.5 rounded-md transition-colors">
                {slug}{createdConcepts.includes(slug) && <span className="ml-1 opacity-60">(신규)</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {summaryHtml ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">AI 요약</h2>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
            <MarkdownRenderer html={summaryHtml} />
          </div>
        </section>
      ) : null}

      {rawHtml ? (
        <section>
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">원문</h2>
          <CollapseSection html={rawHtml} />
        </section>
      ) : null}
    </div>
  )
}
