import { getMetricsContent } from '@/lib/data'

export default async function MetricsPage({
  params,
}: {
  params: Promise<{ wikiSlug: string }>
}) {
  const { wikiSlug } = await params
  const metrics = await getMetricsContent(`wiki_${wikiSlug}`)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Metrics</h1>
      </div>

      {metrics.length === 0 ? (
        <p className="text-center py-16 text-neutral-600 text-sm">
          등록된 지표가 없습니다. Admin → Metrics 탭에서 설정하세요.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <div key={m.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-medium text-neutral-300">{m.title}</h2>
                <p className="text-3xl font-bold text-white mt-1">{m.stat}</p>
              </div>
              {m.definition && <p className="text-xs text-neutral-500 leading-relaxed">{m.definition}</p>}
              {m.message && (
                <blockquote className="text-sm text-neutral-400 italic border-l-2 border-neutral-700 pl-3 leading-relaxed">
                  {m.message}
                </blockquote>
              )}
              {m.source && m.url && (
                <a href={m.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-accent-500 hover:text-accent-400 transition-colors mt-auto pt-1">
                  {m.source} →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
