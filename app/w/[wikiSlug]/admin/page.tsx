import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import {
  getEditorialContent, getEditorialVersions, getConceptItems,
  getWikiPages, getMetricsContent, getIngestLog, getKnowledgeGraph,
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

  const [editorialContent, editorialVersions, concepts, pages, metrics, ingestLog, graph] = await Promise.all([
    getEditorialContent(wikiId),
    getEditorialVersions(wikiId),
    getConceptItems(wikiId),
    getWikiPages(wikiId),
    getMetricsContent(wikiId),
    getIngestLog(wikiId),
    getKnowledgeGraph(wikiId),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-lg font-semibold text-white mb-6">Admin</h1>
      <AdminTabs
        editorialContent={editorialContent}
        editorialVersions={editorialVersions}
        concepts={concepts}
        pages={pages}
        metrics={metrics}
        ingestLog={ingestLog}
        graphBuiltAt={graph.built_at}
        wikiId={wikiId}
      />
    </div>
  )
}
