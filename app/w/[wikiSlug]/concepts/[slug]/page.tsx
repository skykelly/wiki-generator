import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getConceptBySlug } from '@/lib/data'
import { renderMarkdown } from '@/lib/markdown'
import MarkdownRenderer from '@/components/MarkdownRenderer'

export default async function ConceptDetailPage({
  params,
}: {
  params: Promise<{ wikiSlug: string; slug: string }>
}) {
  const { wikiSlug, slug } = await params
  const wikiId = `wiki_${wikiSlug}`
  const base = `/w/${wikiSlug}`

  const concept = await getConceptBySlug(slug, wikiId)
  if (!concept) notFound()

  const contentHtml = concept.content ? await renderMarkdown(concept.content) : ''

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Link href={`${base}/concepts`} className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors mb-4 inline-block">
        ← Concepts
      </Link>

      <div className="grid lg:grid-cols-[1fr_280px] gap-10 mt-1">
        <div>
          <h1 className="text-xl font-semibold text-white mb-2 leading-snug">{concept.title}</h1>

          {concept.image_url && (
            <div className="mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={concept.image_url} alt={concept.title}
                className="max-w-full h-auto max-h-[28rem] object-contain rounded-xl border border-neutral-800 bg-neutral-950" />
            </div>
          )}

          {concept.brief && <p className="text-sm text-neutral-400 leading-relaxed mb-5">{concept.brief}</p>}

          <div className="flex flex-wrap items-center gap-1.5 mb-6">
            {concept.concept_status === 'canonical' && (
              <span className="text-xs bg-emerald-950/60 text-emerald-600 border border-emerald-900/50 px-1.5 py-0.5 rounded-md">canonical</span>
            )}
            {concept.concept_type && (
              <span className="text-xs bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded-md">{concept.concept_type}</span>
            )}
            {concept.topics.map((t) => (
              <span key={t} className="text-xs bg-neutral-900 border border-neutral-800 text-neutral-400 px-2 py-0.5 rounded-md">{t}</span>
            ))}
          </div>

          {contentHtml ? <MarkdownRenderer html={contentHtml} /> : <p className="text-sm text-neutral-600">아직 작성된 내용이 없습니다.</p>}
        </div>

        <aside className="space-y-6">
          {concept.aliases.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2">별칭</h2>
              <div className="flex flex-wrap gap-1.5">
                {concept.aliases.map((a) => (
                  <span key={a} className="text-xs bg-neutral-900 border border-neutral-800 text-neutral-400 px-2 py-0.5 rounded-md">{a}</span>
                ))}
              </div>
            </div>
          )}

          {concept.related_concepts.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2">관련 개념</h2>
              <div className="flex flex-col gap-1.5 items-start">
                {concept.related_concepts.map((relSlug) => (
                  <Link key={relSlug} href={`${base}/concepts/${relSlug}`}
                    className="text-sm text-accent-400 hover:text-accent-300 transition-colors">
                    {relSlug} →
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2">메타</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-600">참조 소스</dt>
                <dd className="text-neutral-300">{concept.source_count}개</dd>
              </div>
              {concept.last_synthesized_at && (
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-600">마지막 합성</dt>
                  <dd className="text-neutral-300">{new Date(concept.last_synthesized_at).toLocaleDateString('ko-KR')}</dd>
                </div>
              )}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}
