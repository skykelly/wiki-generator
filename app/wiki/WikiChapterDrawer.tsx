'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { WikiPageItem, TopicNode } from '@/lib/types'

export default function WikiChapterDrawer({
  pages, topics, currentSlug, basePath = '/wiki',
}: {
  pages: WikiPageItem[]
  topics: TopicNode[]
  currentSlug: string
  basePath?: string
}) {
  const router = useRouter()

  const groups = new Map<string, WikiPageItem[]>()
  for (const p of pages) {
    const key = p.chapter_number || '00'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }
  const sortedKeys = [...groups.keys()].sort()
  const chapterTitle = (num: string) => topics.find((t) => t.number === num)?.title

  return (
    <>
      {/* 모바일: 챕터 선택 */}
      <div className="lg:hidden mb-4">
        <select
          value={currentSlug}
          onChange={(e) => router.push(`${basePath}/${e.target.value}`)}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600"
        >
          {sortedKeys.map((num) => (
            <optgroup key={num} label={`${num}${chapterTitle(num) ? ' · ' + chapterTitle(num) : ''}`}>
              {groups.get(num)!.map((p) => (
                <option key={p.slug} value={p.slug}>{p.title}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* 데스크탑: 고정 사이드바 */}
      <nav className="hidden lg:block sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
        {sortedKeys.map((num) => (
          <div key={num} className="mb-5">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2">
              {num}{chapterTitle(num) ? ` · ${chapterTitle(num)}` : ''}
            </p>
            <div className="flex flex-col gap-0.5">
              {groups.get(num)!.map((p) => (
                <Link
                  key={p.slug}
                  href={`${basePath}/${p.slug}`}
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
          </div>
        ))}
      </nav>
    </>
  )
}
