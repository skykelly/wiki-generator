import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import {
  getEditorialContent, getEditorialVersions, getConceptItems,
  getWikiPages, getMetricsContent, getIngestLog, getKnowledgeGraph, getRssFeeds,
} from '@/lib/data'
import AdminTabs from '@/app/admin/AdminTabs'

export default async function WikiAdminPage({
  params,
}: {
  params: Promise<{ wikiSlug: string }>
}) {
  const { wikiSlug } = await params
  const wikiId = `wiki_${wikiSlug}`

  const session = await auth()
  if (!session) redirect(`/auth/signin?callbackUrl=/w/${wikiSlug}/admin`)

  const [editorialContent, editorialVersions, concepts, pages, metrics, ingestLog, graph, rssFeeds] = await Promise.all([
    getEditorialContent(wikiId),
    getEditorialVersions(wikiId),
    getConceptItems(wikiId),
    getWikiPages(wikiId),
    getMetricsContent(wikiId),
    getIngestLog(wikiId),
    getKnowledgeGraph(wikiId),
    getRssFeeds(wikiId),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-white">Admin — {wikiSlug}</h1>
        <a
          href={`/w/${wikiSlug}/admin/seed`}
          className="text-sm text-cyan-400 hover:text-cyan-300 border border-cyan-800/50 px-3 py-1.5 rounded-lg transition-colors"
        >
          시드 관리 →
        </a>
      </div>
      <AdminTabs
        editorialContent={editorialContent}
        editorialVersions={editorialVersions}
        concepts={concepts}
        pages={pages}
        metrics={metrics}
        ingestLog={ingestLog}
        graphBuiltAt={graph.built_at}
        rssFeeds={rssFeeds}
        wikiId={wikiId}
      />
    </div>
  )
}
