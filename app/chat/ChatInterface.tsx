'use client'
import { useState } from 'react'
import ChatBox from '@/components/ChatBox'
import type { ChatMessage, ChatSession } from '@/lib/types'

export default function ChatInterface({ initialSessions, wikiId }: { initialSessions: ChatSession[]; wikiId?: string }) {
  const [sessions, setSessions] = useState(initialSessions)
  const [activeId, setActiveId] = useState<string | undefined>(initialSessions[0]?.id)

  const active = sessions.find((s) => s.id === activeId)

  const handleSessionUpdate = (updated: { id: string; title: string; messages: ChatMessage[] }) => {
    setSessions((prev) => {
      const existing = prev.find((s) => s.id === updated.id)
      const next: ChatSession = {
        id: updated.id,
        title: existing?.title || updated.title || '새 대화',
        messages: updated.messages,
        updated_at: new Date().toISOString(),
      }
      const others = prev.filter((s) => s.id !== updated.id)
      return [next, ...others]
    })
    setActiveId(updated.id)
  }

  return (
    <div className="grid lg:grid-cols-[240px_1fr] gap-6 h-[calc(100vh-10rem)]">
      <aside className="flex flex-col gap-2 min-h-0">
        <button
          onClick={() => setActiveId(undefined)}
          className="text-sm bg-accent-600 hover:bg-accent-700 text-white px-3 py-2 rounded-lg transition-colors"
        >
          + 새 대화
        </button>
        <div className="flex flex-col gap-1 overflow-y-auto">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`text-left text-sm px-3 py-2 rounded-lg truncate transition-colors ${
                activeId === s.id ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
              }`}
            >
              {s.title || '새 대화'}
            </button>
          ))}
          {sessions.length === 0 && (
            <p className="text-xs text-neutral-600 px-3 py-2">대화 내역이 없습니다.</p>
          )}
        </div>
      </aside>

      <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 min-h-0">
        <ChatBox
          key={activeId ?? 'new'}
          sessionId={active?.id}
          initialMessages={active?.messages}
          onSessionUpdate={handleSessionUpdate}
          wikiId={wikiId}
        />
      </div>
    </div>
  )
}
