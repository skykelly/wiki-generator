'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, Citation } from '@/lib/types'

function citationHref(c: Citation): string {
  if (c.ref_type === 'concept' && c.slug) return `/concepts/${c.slug}`
  if (c.ref_type === 'page' && c.slug) return `/wiki/${c.slug}`
  if (c.ref_type === 'source') return `/sources/${c.ref_id}`
  return '#'
}

interface Props {
  sessionId?: string
  initialMessages?: ChatMessage[]
  onSessionUpdate?: (session: { id: string; title: string; messages: ChatMessage[] }) => void
  compact?: boolean
  wikiId?: string
}

export default function ChatBox({ sessionId: initialSessionId, initialMessages, onSessionUpdate, compact, wikiId }: Props) {
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? [])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSessionId(initialSessionId)
    setMessages(initialMessages ?? [])
  }, [initialSessionId, initialMessages])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streamingContent])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    setError(null)
    setStreaming(true)
    setStreamingContent('')

    const userMessage: ChatMessage = { role: 'user', content: text, created_at: new Date().toISOString() }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId, wiki_id: wikiId }),
      })
      if (!res.ok || !res.body) throw new Error()

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantContent = ''
      let citations: Citation[] = []
      let resolvedSessionId = sessionId

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          const json = line.slice(5).trim()
          if (!json) continue

          let evt: { type: string; id?: string; content?: string; citations?: Citation[]; message?: string }
          try { evt = JSON.parse(json) } catch { continue }

          if (evt.type === 'session' && evt.id) {
            resolvedSessionId = evt.id
            setSessionId(evt.id)
          } else if (evt.type === 'delta' && evt.content) {
            assistantContent += evt.content
            setStreamingContent(assistantContent)
          } else if (evt.type === 'citations') {
            citations = evt.citations ?? []
          } else if (evt.type === 'error') {
            setError(evt.message ?? '오류가 발생했습니다.')
          }
        }
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantContent,
        citations,
        created_at: new Date().toISOString(),
      }
      const finalMessages = [...nextMessages, assistantMessage]
      setMessages(finalMessages)
      setStreamingContent('')

      if (resolvedSessionId) {
        onSessionUpdate?.({
          id: resolvedSessionId,
          title: nextMessages.length === 1 ? text.slice(0, 30) : '',
          messages: finalMessages,
        })
      }
    } catch {
      setError('메시지를 전송하지 못했습니다.')
      setMessages(nextMessages)
    } finally {
      setStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 px-1">
        {messages.length === 0 && !streaming && (
          <p className="text-sm text-neutral-600 text-center py-8">
            Homestyle Wiki에 대해 무엇이든 물어보세요.
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-accent-600 text-white'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-200'
            }`}>
              {m.content}
              {m.role === 'assistant' && m.citations && m.citations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-neutral-800">
                  {m.citations.map((c) => (
                    <Link
                      key={`${c.ref_type}:${c.ref_id}`}
                      href={citationHref(c)}
                      className="text-xs bg-neutral-800 hover:bg-neutral-700 text-accent-400 px-2 py-0.5 rounded-md transition-colors"
                    >
                      {c.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap bg-neutral-900 border border-neutral-800 text-neutral-200">
              {streamingContent || <span className="text-neutral-600">생각 중…</span>}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      </div>

      <div className="flex items-end gap-2 mt-3 pt-3 border-t border-neutral-800">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요…"
          rows={compact ? 1 : 2}
          className="flex-1 resize-none bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500"
        />
        <button
          onClick={handleSend}
          disabled={streaming || !input.trim()}
          className="text-sm bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          전송
        </button>
      </div>
    </div>
  )
}
