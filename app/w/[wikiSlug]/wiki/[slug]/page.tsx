import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPageBySlug, getWikiPages, getTopicsConfig } from '@/lib/data'
import { renderMarkdown } from '@/lib/markdown'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import WikiChapterDrawer from '@/app/wiki/WikiChapterDrawer'

export default async function WikiPageDetail({
  params,
}: {
  params: Promise<{ wikiSlug: string; slug: string }>
}) {
  const { wikiSlug, slug } = await params
  const wikiId = `wiki_${wikiSlug}`
  const base = `/w/${wikiSlug}`

  const [page, allPages, topics] = await Promise.all([
    getPageBySlug(slug, wikiId),
    getWikiPages(wikiId),
    getTopicsConfig(wikiId),
  ])
  if (!page) notFound()

  const contentHtml = page.content ? await renderMarkdown(page.content) : ''
  const chapterTitle = topics.find((t) => t.number === page.chapter_number)?.title

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Link href={`${base}/wiki`} className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors mb-4 inline-block">
        ← Wiki
      </Link>

      <div className="grid lg:grid-cols-[240px_1fr] gap-10 mt-1 items-start">
        <WikiChapterDrawer pages={allPages} topics={topics} currentSlug={slug} basePath={`${base}/wiki`} />

        <div className="min-w-0">
          {page.chapter_number && (
            <h3 className="text-sm text-neutral-500 mb-1.5">
              {page.chapter_number}{chapterTitle ? ` ${chapterTitle}` : ''}
            </h3>
          )}
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-semibold text-white leading-snug">{page.title}</h1>
            {page.draft_status === 'generated' && (
              <span className="text-xs bg-yellow-400/10 border border-yellow-800/50 text-yellow-400 px-2 py-0.5 rounded-md shrink-0">AI 초안</span>
            )}
          </div>

          {page.image_url && (
            <div className="mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={page.image_url} alt={page.title}
                className="max-w-full h-auto max-h-[28rem] object-contain rounded-xl border border-neutral-800 bg-neutral-950" />
            </div>
          )}

          {contentHtml ? (
            <MarkdownRenderer html={contentHtml} />
          ) : (
            <p className="text-sm text-neutral-600">아직 작성된 내용이 없습니다.</p>
          )}

          {page.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-8 pt-6 border-t border-neutral-800">
              {page.topics.map((t) => (
                <span key={t} className="text-xs bg-neutral-900 border border-neutral-800 text-neutral-400 px-2 py-0.5 rounded-md">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
