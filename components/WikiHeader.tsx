'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import type { Session } from 'next-auth'
import SearchBox from './SearchBox'
import WikiIndexDrawer from './WikiIndexDrawer'
import type { WikiPageItem, TopicNode, ConceptItem } from '@/lib/types'

interface Props {
  session: Session | null
  wikiSlug: string
  wikiTitle: string
  wikiPages: WikiPageItem[]
  wikiTopics: TopicNode[]
  concepts: ConceptItem[]
}

export default function WikiHeader({ session, wikiSlug, wikiTitle, wikiPages, wikiTopics, concepts }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [indexOpen, setIndexOpen] = useState(false)
  const pathname = usePathname()
  const base = `/w/${wikiSlug}`
  const wikiBase = `${base}/wiki`
  const currentSlug = pathname.startsWith(wikiBase + '/') ? pathname.slice(wikiBase.length + 1) : undefined

  const linkClass = (href: string) =>
    `text-sm transition-colors ${
      pathname === href || pathname.startsWith(href + '/')
        ? 'text-white'
        : 'text-neutral-400 hover:text-white'
    }`

  const closeMobile = () => setMobileOpen(false)

  const knowledgeItems = [
    { href: `${base}/knowledge`, label: '그래프' },
    { href: `${base}/concepts`,  label: '개념'   },
    { href: `${base}/wiki`,      label: '위키'   },
  ]

  return (
    <header className="bg-neutral-950 border-b border-neutral-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">

        {/* 좌측: 위키 목록 + 로고 */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-neutral-500 hover:text-white text-sm transition-colors">
            ←
          </Link>
          <button
            onClick={() => setIndexOpen(true)}
            aria-label="전체 위키 목록 열기"
            className="text-neutral-400 hover:text-white text-lg w-8 text-center"
          >
            ☰
          </button>
          <Link href={base} className="text-white font-semibold tracking-tight">
            {wikiTitle}
          </Link>
        </div>

        {/* 데스크탑 nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href={base}              className={linkClass(base)}>Home</Link>
          <Link href={`${base}/sources`} className={linkClass(`${base}/sources`)}>Sources</Link>

          <div className="group relative">
            <button className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white transition-colors">
              Knowledge <span className="text-xs opacity-70">▾</span>
            </button>
            <div className="hidden group-hover:block absolute top-full left-0 pt-2 min-w-[9rem]">
              <div className="bg-neutral-900 border border-neutral-700 rounded-lg py-1 shadow-xl">
                {knowledgeItems.map(({ href, label }) => (
                  <Link key={href} href={href}
                    className="block px-4 py-2 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <Link href={`${base}/metrics`} className={linkClass(`${base}/metrics`)}>Metrics</Link>
          <Link href={`${base}/chat`}    className={linkClass(`${base}/chat`)}>Chat</Link>
          {session && (
            <Link href={`${base}/admin`} className={linkClass(`${base}/admin`)}>Admin</Link>
          )}
        </nav>

        {/* 데스크탑 검색 + 로그인 */}
        <div className="hidden md:flex items-center gap-4">
          <SearchBox className="w-40" searchPath={`${base}/search`} />
          {session ? (
            <button
              onClick={() => signOut({ callbackUrl: base })}
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              로그아웃
            </button>
          ) : (
            <Link href="/auth/signin" className="text-sm text-neutral-400 hover:text-white transition-colors">
              로그인
            </Link>
          )}
        </div>

        {/* 모바일 햄버거 */}
        <button
          className="md:hidden text-neutral-400 hover:text-white text-lg w-8 text-center"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="메뉴 열기"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* 모바일 메뉴 */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-neutral-800 px-4 py-4 flex flex-col gap-4">
          <SearchBox searchPath={`${base}/search`} />
          <Link href={base}              className="text-sm text-neutral-300 hover:text-white" onClick={closeMobile}>Home</Link>
          <Link href={`${base}/sources`} className="text-sm text-neutral-300 hover:text-white" onClick={closeMobile}>Sources</Link>
          <div className="border-t border-neutral-800 pt-3 flex flex-col gap-3">
            <span className="text-xs text-neutral-600 uppercase tracking-widest">Knowledge</span>
            {knowledgeItems.map(({ href, label }) => (
              <Link key={href} href={href} className="text-sm text-neutral-300 hover:text-white pl-2" onClick={closeMobile}>
                {label}
              </Link>
            ))}
          </div>
          <Link href={`${base}/metrics`} className="text-sm text-neutral-300 hover:text-white" onClick={closeMobile}>Metrics</Link>
          <Link href={`${base}/chat`}    className="text-sm text-neutral-300 hover:text-white" onClick={closeMobile}>Chat</Link>
          {session && (
            <Link href={`${base}/admin`} className="text-sm text-neutral-300 hover:text-white" onClick={closeMobile}>Admin</Link>
          )}
          <div className="border-t border-neutral-800 pt-3">
            {session ? (
              <button onClick={() => { signOut({ callbackUrl: base }); closeMobile() }}
                className="text-sm text-neutral-400 hover:text-white">로그아웃</button>
            ) : (
              <Link href="/auth/signin" className="text-sm text-neutral-300 hover:text-white" onClick={closeMobile}>로그인</Link>
            )}
          </div>
        </nav>
      )}

      <WikiIndexDrawer
        open={indexOpen}
        onClose={() => setIndexOpen(false)}
        pages={wikiPages}
        topics={wikiTopics}
        concepts={concepts}
        currentSlug={currentSlug}
        basePath={`${base}/wiki`}
      />
    </header>
  )
}
