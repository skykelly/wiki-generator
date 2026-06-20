import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import {
  getEditorialContent, getEditorialVersions, getConceptItems,
  getWikiPages, getMetricsContent, getIngestLog, getKnowledgeGraph, getRssFeeds,
} from '@/lib/data'
import AdminTabs from './AdminTabs'

export default async function AdminPage() {
  const session = await auth()
  if (!session) redirect('/auth/signin?callbackUrl=/admin')

  const [editorialContent, editorialVersions, concepts, pages, metrics, ingestLog, graph, rssFeeds] = await Promise.all([
    getEditorialContent(),
    getEditorialVersions(),
    getConceptItems(),
    getWikiPages(),
    getMetricsContent(),
    getIngestLog(),
    getKnowledgeGraph(),
    getRssFeeds(),
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
        rssFeeds={rssFeeds}
      />
    </div>
  )
}
