'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Session } from 'next-auth'
import ChatBox from './ChatBox'

export default function ChatPopup({ session, wikiId, chatPath = '/chat' }: {
  session: Session | null
  wikiId?: string
  chatPath?: string
}) {
  const [open, setOpen] = useState(false)

  if (!session) return null

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-[360px] max-w-[calc(100vw-3rem)] h-[480px] bg-neutral-950 border border-neutral-700 rounded-xl shadow-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h2 className="text-sm font-semibold text-white">Wiki Chat</h2>
            <div className="flex items-center gap-3">
              <Link href={chatPath} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
                전체 화면
              </Link>
              <button onClick={() => setOpen(false)} className="text-neutral-500 hover:text-neutral-300 text-sm">✕</button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ChatBox compact wikiId={wikiId} />
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="채팅 열기"
        className="w-12 h-12 rounded-full bg-accent-600 hover:bg-accent-700 text-white shadow-xl flex items-center justify-center transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4.5 4.5A.5.5 0 0 1 3 21V5a1 1 0 0 1 1-1Z" />
        </svg>
      </button>
    </div>
  )
}
