'use client'
import { useState, useRef } from 'react'
import type { WikiItem, ScaffoldResult, ScaffoldChapter, ScaffoldConcept } from '@/lib/types'

interface Props {
  wiki: WikiItem & { scaffold_result?: ScaffoldResult }
}

type Phase = 'idle' | 'scaffolding' | 'reviewing' | 'drafting' | 'done' | 'error'

export default function SeedManager({ wiki }: Props) {
  const [phase, setPhase] = useState<Phase>(
    (wiki.status as Phase) === 'reviewing' ? 'reviewing' : 'idle'
  )
  const [log, setLog] = useState<string[]>([])
  const [scaffold, setScaffold] = useState<ScaffoldResult | null>(
    (wiki as Props['wiki']).scaffold_result ?? null
  )
  const [activeTab, setActiveTab] = useState<'chapters' | 'concepts' | 'feeds'>('chapters')
  const logRef = useRef<HTMLDivElement>(null)

  function appendLog(msg: string) {
    setLog((prev) => [...prev, msg])
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50)
  }

  async function startScaffold() {
    setPhase('scaffolding')
    setLog([])
    appendLog('스캐폴드 생성 시작…')

    const res = await fetch(`/api/wikis/${wiki.id}/scaffold`, { method: 'POST' })
    if (!res.ok || !res.body) {
      setPhase('error')
      appendLog('API 요청 실패')
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6))
          appendLog(event.message ?? '')
          if (event.step === 'complete') {
            setPhase('reviewing')
            // Reload scaffold from server
            const wRes = await fetch(`/api/wikis/${wiki.id}`)
            if (wRes.ok) {
              const data = await wRes.json()
              setScaffold(data.scaffold_result)
            }
          }
          if (event.step === 'error') setPhase('error')
        } catch { /* ignore */ }
      }
    }
  }

  const statusColor: Record<string, string> = {
    idle: 'text-neutral-400',
    scaffolding: 'text-yellow-400',
    reviewing: 'text-cyan-400',
    drafting: 'text-purple-400',
    done: 'text-green-400',
    error: 'text-red-400',
  }

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
        <div>
          <span className="text-xs text-neutral-500 uppercase tracking-wider">상태</span>
          <p className={`mt-0.5 font-semibold ${statusColor[phase] ?? 'text-neutral-300'}`}>
            {phase === 'idle' && '대기 중'}
            {phase === 'scaffolding' && '스캐폴드 생성 중…'}
            {phase === 'reviewing' && '검토 대기'}
            {phase === 'drafting' && '초안 생성 중…'}
            {phase === 'done' && '완료'}
            {phase === 'error' && '오류 발생'}
          </p>
        </div>
        {(phase === 'idle' || phase === 'error') && (
          <button
            onClick={startScaffold}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {phase === 'error' ? '다시 시도' : '스캐폴드 생성'}
          </button>
        )}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div
          ref={logRef}
          className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 h-32 overflow-y-auto font-mono text-xs text-neutral-400 space-y-1"
        >
          {log.map((line, i) => <p key={i}>{line}</p>)}
        </div>
      )}

      {/* Scaffold review */}
      {scaffold && phase === 'reviewing' && (
        <div className="space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <h2 className="font-semibold text-white text-lg">{scaffold.wiki_title}</h2>
            <p className="mt-1 text-neutral-400 text-sm">{scaffold.description}</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {(['chapters', 'concepts', 'feeds'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {tab === 'chapters' && `챕터 (${scaffold.chapters.length})`}
                {tab === 'concepts' && `개념 (${scaffold.concepts.length})`}
                {tab === 'feeds' && `RSS 피드 (${scaffold.suggested_rss_feeds.length})`}
              </button>
            ))}
          </div>

          {activeTab === 'chapters' && (
            <div className="space-y-3">
              {scaffold.chapters.map((ch: ScaffoldChapter) => (
                <div key={ch.number} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-neutral-500 mt-0.5 shrink-0">{ch.number}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-white">{ch.title}</p>
                      <p className="text-sm text-neutral-400 mt-0.5">{ch.description}</p>
                      {ch.subsections.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {ch.subsections.map((s) => (
                            <li key={s.number} className="text-xs text-neutral-500">
                              <span className="font-mono mr-2">{s.number}</span>{s.title}
                            </li>
                          ))}
                        </ul>
                      )}
                      {ch.key_concepts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {ch.key_concepts.map((kc) => (
                            <span key={kc} className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">
                              {kc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'concepts' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scaffold.concepts.map((c: ScaffoldConcept) => (
                <div key={c.slug} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <p className="font-medium text-white text-sm">{c.title}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{c.brief}</p>
                  <div className="mt-2 flex flex-wrap gap-1 items-center">
                    <span className="text-xs bg-cyan-900/40 text-cyan-400 border border-cyan-800/50 px-2 py-0.5 rounded">
                      {c.concept_type}
                    </span>
                    {c.topics.slice(0, 3).map((t) => (
                      <span key={t} className="text-xs bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'feeds' && (
            <div className="space-y-2">
              {scaffold.suggested_rss_feeds.map((f, i) => (
                <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
                  <p className="font-medium text-sm text-white">{f.label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5 break-all">{f.url}</p>
                </div>
              ))}
            </div>
          )}

          {/* Phase B trigger placeholder */}
          <div className="bg-neutral-900 border border-dashed border-neutral-700 rounded-xl p-5 text-center">
            <p className="text-sm text-neutral-400 mb-3">
              목차가 올바르다면 초안 생성을 시작하세요. (Phase B)
            </p>
            <button
              disabled
              className="bg-neutral-700 text-neutral-500 cursor-not-allowed font-semibold px-6 py-2.5 rounded-lg text-sm"
            >
              초안 생성 시작 (준비 중)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
