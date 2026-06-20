'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ConceptItem, TopicNode } from '@/lib/types'

function topicKeywords(topic: TopicNode): string[] {
  return [topic.title, topic.label, ...topic.subtopics]
    .filter(Boolean)
    .map((s) => s.toLowerCase())
}

export default function ConceptGrid({
  concepts, topics, basePath = '/concepts',
}: {
  concepts: ConceptItem[]
  topics: TopicNode[]
  basePath?: string
}) {
  const [activeTopic, setActiveTopic] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!activeTopic) return concepts
    const topic = topics.find((t) => t.title === activeTopic)
    if (!topic) return concepts
    const keywords = topicKeywords(topic)
    return concepts.filter((c) =>
      c.topics.some((t) => {
        const tl = t.toLowerCase()
        return keywords.some((k) => k.includes(tl) || tl.includes(k))
      })
    )
  }, [concepts, topics, activeTopic])

  if (concepts.length === 0) {
    return <p className="text-center py-16 text-neutral-600 text-sm">등록된 개념이 없습니다.</p>
  }

  return (
    <div>
      {/* 토픽 그룹 필터 */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTopic(null)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              activeTopic === null
                ? 'bg-white text-neutral-950'
                : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-700'
            }`}
          >
            전체
          </button>
          {topics.map((t) => (
            <button
              key={t.number}
              onClick={() => setActiveTopic((cur) => (cur === t.title ? null : t.title))}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                activeTopic === t.title
                  ? 'bg-white text-neutral-950'
                  : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-700'
              }`}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-center py-16 text-neutral-600 text-sm">해당 토픽의 개념이 없습니다.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((concept) => {
            const isOpen = selectedId === concept.id
            return (
              <div key={concept.id} className={isOpen ? 'sm:col-span-2 lg:col-span-3' : ''}>
                <button
                  onClick={() => setSelectedId(isOpen ? null : concept.id)}
                  className={`w-full text-left bg-neutral-900 hover:bg-neutral-800/80 border rounded-xl p-4 transition-all ${
                    isOpen ? 'border-neutral-600' : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-white leading-snug">{concept.title}</h3>
                    {concept.source_count > 0 && (
                      <span className="text-xs text-neutral-600 shrink-0 mt-0.5">{concept.source_count}</span>
                    )}
                  </div>
                  {concept.brief && (
                    <p className="text-xs text-neutral-500 mt-1.5 line-clamp-2 leading-relaxed">{concept.brief}</p>
                  )}
                  {(concept.concept_status === 'canonical' || concept.concept_type || concept.topics.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      {concept.concept_status === 'canonical' && (
                        <span className="text-xs bg-emerald-950/60 text-emerald-600 border border-emerald-900/50 px-1.5 py-0.5 rounded-md">
                          canonical
                        </span>
                      )}
                      {concept.concept_type && (
                        <span className="text-xs bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded-md">
                          {concept.concept_type}
                        </span>
                      )}
                      {concept.topics.slice(0, 3).map((t) => (
                        <span key={t} className="text-xs bg-neutral-800/60 border border-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded-md">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>

                {/* 인라인 패널 */}
                {isOpen && (
                  <div className="mt-2 bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 space-y-3">
                    {concept.brief && <p className="text-sm text-neutral-300 leading-relaxed">{concept.brief}</p>}

                    {concept.aliases.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-neutral-600">별칭</span>
                        {concept.aliases.map((a) => (
                          <span key={a} className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-md">{a}</span>
                        ))}
                      </div>
                    )}

                    {concept.related_concepts.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-neutral-600">관련 개념</span>
                        {concept.related_concepts.map((slug) => (
                          <Link
                            key={slug}
                            href={`${basePath}/${slug}`}
                            className="text-xs bg-neutral-800 hover:bg-neutral-700 text-accent-400 px-2 py-0.5 rounded-md transition-colors"
                          >
                            {slug}
                          </Link>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      {concept.last_synthesized_at ? (
                        <span className="text-xs text-neutral-600">
                          마지막 합성: {new Date(concept.last_synthesized_at).toLocaleDateString('ko-KR')}
                        </span>
                      ) : <span />}
                      <Link href={`${basePath}/${concept.slug}`} className="text-xs text-accent-500 hover:text-accent-400 transition-colors">
                        전체 보기 →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
