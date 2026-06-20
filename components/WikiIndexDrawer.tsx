'use client'
import Link from 'next/link'
import type { WikiPageItem, TopicNode, ConceptItem } from '@/lib/types'
import { topicsForConceptType } from '@/lib/topicMapping'

export default function WikiIndexDrawer({
  open, onClose, pages, topics, concepts, currentSlug, basePath = '/wiki',
}: {
  open: boolean
  onClose: () => void
  pages: WikiPageItem[]
  topics: TopicNode[]
  concepts: ConceptItem[]
  currentSlug?: string
  basePath?: string
}) {
  const groups = new Map<string, WikiPageItem[]>()
  for (const p of pages) {
    const key = p.chapter_number || '00'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }
  const sortedKeys = [...groups.keys()].sort()
  const chapterTitle = (num: string) => topics.find((t) => t.number === num)?.title

  // 챕터(topic number)별로 매칭되는 concepts 그룹핑 (concept_type → topic 키워드)
  const conceptGroups = new Map<string, ConceptItem[]>()
  for (const c of concepts) {
    for (const topic of topicsForConceptType(c.concept_type, topics)) {
      if (!conceptGroups.has(topic.number)) conceptGroups.set(topic.number, [])
      conceptGroups.get(topic.number)!.push(c)
    }
  }

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 드로어 */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 max-w-[85vw] bg-neutral-950 border-r border-neutral-800 z-50 flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-neutral-800 shrink-0">
          <h2 className="text-sm font-semibold text-white">전체 위키 목록</h2>
          <button onClick={onClose} aria-label="닫기" className="text-neutral-500 hover:text-white text-lg">✕</button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4">
          {pages.length === 0 ? (
            <p className="text-sm text-neutral-600">등록된 위키 문서가 없습니다.</p>
          ) : (
            sortedKeys.map((num) => (
              <div key={num} className="mb-5">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2">
                  {num}{chapterTitle(num) ? ` · ${chapterTitle(num)}` : ''}
                </p>
                <div className="flex flex-col gap-0.5">
                  {groups.get(num)!.map((p) => (
                    <Link
                      key={p.slug}
                      href={`${basePath}/${p.slug}`}
                      onClick={onClose}
                      className={`text-sm px-2 py-1 rounded-md transition-colors leading-snug ${
                        p.slug === currentSlug
                          ? 'bg-neutral-800 text-white'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                      }`}
                    >
                      {p.title}
                    </Link>
                  ))}
                </div>

                {conceptGroups.has(num) && (
                  <div className="mt-2 pt-2 border-t border-neutral-900">
                    <p className="text-xs text-neutral-600 px-2 mb-1">관련 개념</p>
                    <div className="flex flex-col gap-0.5">
                      {conceptGroups.get(num)!.map((c) => (
                        <Link
                          key={c.slug}
                          href={`${basePath.replace('/wiki', '/concepts')}/${c.slug}`}
                          onClick={onClose}
                          className="text-sm px-2 py-1 rounded-md transition-colors leading-snug text-accent-500 hover:text-accent-400 hover:bg-neutral-900"
                        >
                          {c.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </nav>
      </aside>
    </>
  )
}
