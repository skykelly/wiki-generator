import { getConceptItems, getTopicsConfig } from '@/lib/data'
import ConceptGrid from '@/app/concepts/ConceptGrid'

export default async function ConceptsPage({
  params,
}: {
  params: Promise<{ wikiSlug: string }>
}) {
  const { wikiSlug } = await params
  const wikiId = `wiki_${wikiSlug}`

  const [concepts, topics] = await Promise.all([
    getConceptItems(wikiId),
    getTopicsConfig(wikiId),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Concepts</h1>
        <p className="text-xs text-neutral-500 mt-0.5">{concepts.length}개 개념</p>
      </div>
      <ConceptGrid concepts={concepts} topics={topics} basePath={`/w/${wikiSlug}/concepts`} />
    </div>
  )
}
