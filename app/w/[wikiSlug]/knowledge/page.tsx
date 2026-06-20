import { getKnowledgeGraph } from '@/lib/data'
import KnowledgeGraph from '@/components/KnowledgeGraph'

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ wikiSlug: string }>
}) {
  const { wikiSlug } = await params
  const graph = await getKnowledgeGraph(`wiki_${wikiSlug}`)
  const base = `/w/${wikiSlug}`

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">지식 그래프</h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          토픽 · 개념 · 소스 간의 연결 관계를 탐색합니다.
          {graph.built_at && ` · 마지막 생성: ${new Date(graph.built_at).toLocaleString('ko-KR')}`}
        </p>
      </div>
      {graph.nodes.length === 0 ? (
        <p className="text-center py-16 text-neutral-600 text-sm">
          아직 생성된 그래프가 없습니다. Admin → Graph 탭에서 &quot;그래프 재생성&quot;을 실행하세요.
        </p>
      ) : (
        <KnowledgeGraph data={graph} basePath={base} />
      )}
    </div>
  )
}
