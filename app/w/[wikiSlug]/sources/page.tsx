import Link from 'next/link'
import { getSources } from '@/lib/data'
import SourceTable from '@/components/SourceTable'

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ wikiSlug: string }>
}) {
  const { wikiSlug } = await params
  const wikiId = `wiki_${wikiSlug}`
  const base = `/w/${wikiSlug}`
  const sources = await getSources(wikiId)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Sources</h1>
          <p className="text-xs text-neutral-500 mt-0.5">{sources.length}개 소스</p>
        </div>
        <Link href={`${base}/sources/upload`}
          className="text-sm bg-accent-600 hover:bg-accent-700 text-white px-4 py-2 rounded-lg transition-colors">
          + 소스 추가
        </Link>
      </div>
      <SourceTable initialSources={sources} basePath={`${base}/sources`} />
    </div>
  )
}
