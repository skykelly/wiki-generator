'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import type { WikiItem, ScaffoldResult, ScaffoldChapter, ScaffoldConcept, SeedProgress } from '@/lib/types'

interface Props {
  wiki: WikiItem & { scaffold_result?: ScaffoldResult; seed_progress?: SeedProgress }
  wikiSlug: string
}

type UIPhase = 'idle' | 'scaffolding' | 'scaffold_done' | 'drafting' | 'draft_done' | 'extracting' | 'extract_done' | 'activating' | 'ready' | 'error'

function statusToPhase(status: string, seedProgress?: SeedProgress): UIPhase {
  if (status === 'ready') return 'ready'
  if (status === 'reviewing') {
    const p = seedProgress?.phase
    if (p === 'drafting' || p === 'done') return 'draft_done'
    if (p === 'extracting') return 'extract_done'
    return 'scaffold_done'
  }
  if (status === 'drafting') return 'drafting'
  if (status === 'extracting') return 'extracting'
  if (status === 'scaffolding') return 'scaffolding'
  return 'idle'
}

const STEP_LABELS: Record<UIPhase, string> = {
  idle: '대기 중',
  scaffolding: 'A. 스캐폴드 생성 중…',
  scaffold_done: 'A. 스캐폴드 검토',
  drafting: 'B. 초안 생성 중…',
  draft_done: 'B. 초안 완료 — 개념 추출 가능',
  extracting: 'C. 개념 추출 중…',
  extract_done: 'C. 개념 추출 완료 — 활성화 가능',
  activating: 'D. 임베딩 & 활성화 중…',
  ready: '완료 — 위키 공개 중',
  error: '오류 발생',
}

const PHASE_COLOR: Record<UIPhase, string> = {
  idle: 'text-neutral-400',
  scaffolding: 'text-yellow-400',
  scaffold_done: 'text-cyan-400',
  drafting: 'text-yellow-400',
  draft_done: 'text-cyan-400',
  extracting: 'text-yellow-400',
  extract_done: 'text-cyan-400',
  activating: 'text-purple-400',
  ready: 'text-green-400',
  error: 'text-red-400',
}

export default function SeedManager({ wiki, wikiSlug }: Props) {
  const [phase, setPhase] = useState<UIPhase>(() =>
    statusToPhase(wiki.status, wiki.seed_progress)
  )
  const [log, setLog] = useState<string[]>([])
  const [scaffold, setScaffold] = useState<ScaffoldResult | null>(wiki.scaffold_result ?? null)
  const [progress, setProgress] = useState<SeedProgress | null>(wiki.seed_progress ?? null)
  const [activeTab, setActiveTab] = useState<'chapters' | 'concepts' | 'feeds'>('chapters')
  const [elapsed, setElapsed] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isRunning = ['scaffolding', 'drafting', 'extracting', 'activating'].includes(phase)

  useEffect(() => {
    if (isRunning) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRunning])

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => [...prev, msg])
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50)
  }, [])

  async function runSSE(url: string, onComplete: () => void, errorPhase: UIPhase = 'error') {
    const res = await fetch(url, { method: 'POST' })
    if (!res.ok || !res.body) {
      appendLog('API 요청 실패')
      setPhase(errorPhase)
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
          if (event.message) appendLog(event.message)
          if (event.step === 'complete') onComplete()
          if (event.step === 'error') setPhase('error')
        } catch { /* ignore */ }
      }
    }
  }

  async function refreshWiki() {
    const res = await fetch(`/api/wikis/${wiki.id}`)
    if (!res.ok) return
    const data = await res.json()
    setScaffold(data.scaffold_result ?? null)
    setProgress(data.seed_progress ?? null)
  }

  async function startScaffold() {
    setPhase('scaffolding')
    setLog([])
    appendLog('스캐폴드 생성 시작…')
    await runSSE(`/api/wikis/${wiki.id}/scaffold`, async () => {
      await refreshWiki()
      setPhase('scaffold_done')
    })
  }

  async function startDraft() {
    setPhase('drafting')
    appendLog('챕터 초안 생성 시작…')
    await runSSE(`/api/wikis/${wiki.id}/draft`, async () => {
      await refreshWiki()
      setPhase('draft_done')
    })
  }

  async function startExtract() {
    setPhase('extracting')
    appendLog('개념 추출 시작…')
    await runSSE(`/api/wikis/${wiki.id}/extract-concepts`, async () => {
      await refreshWiki()
      setPhase('extract_done')
    })
  }

  async function startActivate() {
    setPhase('activating')
    appendLog('임베딩 & 활성화 시작…')
    await runSSE(`/api/wikis/${wiki.id}/activate`, () => {
      setPhase('ready')
    })
  }

  const chapterCount = scaffold?.chapters.length ?? 0
  const conceptCount = scaffold?.concepts.length ?? 0

  return (
    <div className="space-y-5">
      {/* Pipeline steps */}
      <div className="grid grid-cols-4 gap-2">
        {(['A. 스캐폴드', 'B. 초안', 'C. 개념 추출', 'D. 활성화'] as const).map((label, i) => {
          const done = (
            (i === 0 && ['scaffold_done', 'drafting', 'draft_done', 'extracting', 'extract_done', 'activating', 'ready'].includes(phase)) ||
            (i === 1 && ['draft_done', 'extracting', 'extract_done', 'activating', 'ready'].includes(phase)) ||
            (i === 2 && ['extract_done', 'activating', 'ready'].includes(phase)) ||
            (i === 3 && phase === 'ready')
          )
          const active = (
            (i === 0 && phase === 'scaffolding') ||
            (i === 1 && phase === 'drafting') ||
            (i === 2 && phase === 'extracting') ||
            (i === 3 && phase === 'activating')
          )
          return (
            <div
              key={label}
              className={`rounded-lg border px-3 py-2.5 text-center text-xs font-medium ${
                done ? 'border-green-800 bg-green-900/20 text-green-400' :
                active ? 'border-yellow-800 bg-yellow-900/20 text-yellow-400' :
                'border-neutral-800 text-neutral-600'
              }`}
            >
              {done ? '✓ ' : ''}{label}
            </div>
          )
        })}
      </div>

      {/* Status + action button */}
      <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
        <div className="flex items-center gap-3">
          {isRunning && (
            <svg className="animate-spin h-4 w-4 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <p className={`font-semibold ${PHASE_COLOR[phase]}`}>{STEP_LABELS[phase]}</p>
          {isRunning && (
            <span className="text-xs text-neutral-500 font-mono">
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} 경과
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {(phase === 'idle' || phase === 'error') && (
            <button onClick={startScaffold}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              스캐폴드 생성
            </button>
          )}
          {phase === 'scaffold_done' && (
            <button onClick={startDraft}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              초안 생성 시작 ({chapterCount}챕터)
            </button>
          )}
          {phase === 'draft_done' && (
            <button onClick={startExtract}
              className="bg-purple-500 hover:bg-purple-400 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              개념 추출 ({conceptCount}개)
            </button>
          )}
          {phase === 'extract_done' && (
            <button onClick={startActivate}
              className="bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              위키 활성화
            </button>
          )}
          {phase === 'ready' && (
            <div className="flex items-center gap-3 flex-wrap">
              <Link href={`/w/${wikiSlug}`}
                className="bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
                위키 보기 →
              </Link>
              <Link href={`/w/${wikiSlug}/admin`}
                className="text-sm text-cyan-400 hover:text-cyan-300 border border-cyan-800/50 px-3 py-2 rounded-lg transition-colors">
                Admin → Editorial에서 AI 초안 발행 →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar for drafting/extracting */}
      {progress && ['drafting', 'draft_done', 'extracting', 'extract_done'].includes(phase) && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 space-y-3">
          {progress.total_chapters > 0 && (
            <div>
              <div className="flex justify-between text-xs text-neutral-500 mb-1.5">
                <span>챕터 초안</span>
                <span>{progress.completed_chapters}/{progress.total_chapters}</span>
              </div>
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all"
                  style={{ width: `${(progress.completed_chapters / progress.total_chapters) * 100}%` }}
                />
              </div>
            </div>
          )}
          {progress.total_concepts > 0 && (
            <div>
              <div className="flex justify-between text-xs text-neutral-500 mb-1.5">
                <span>개념 추출</span>
                <span>{progress.completed_concepts}/{progress.total_concepts}</span>
              </div>
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${(progress.completed_concepts / progress.total_concepts) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div
          ref={logRef}
          className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 h-36 overflow-y-auto font-mono text-xs text-neutral-400 space-y-1"
        >
          {log.map((line, i) => <p key={i}>{line}</p>)}
        </div>
      )}

      {/* Scaffold review (tabs) */}
      {scaffold && ['scaffold_done', 'drafting', 'draft_done', 'extracting', 'extract_done', 'activating', 'ready'].includes(phase) && (
        <div className="space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <h2 className="font-semibold text-white text-lg">{scaffold.wiki_title}</h2>
            <p className="mt-1 text-neutral-400 text-sm">{scaffold.description}</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {(['chapters', 'concepts', 'feeds'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'
                }`}>
                {tab === 'chapters' && `챕터 (${scaffold.chapters.length})`}
                {tab === 'concepts' && `개념 (${scaffold.concepts.length})`}
                {tab === 'feeds' && `RSS (${scaffold.suggested_rss_feeds.length})`}
              </button>
            ))}
            {['draft_done', 'extract_done', 'ready'].includes(phase) && (
              <Link href={`/w/${wikiSlug}/admin`}
                className="ml-auto px-4 py-1.5 rounded-lg text-sm font-medium text-neutral-500 hover:text-neutral-300 transition-colors">
                어드민에서 편집 →
              </Link>
            )}
          </div>

          {activeTab === 'chapters' && (
            <div className="space-y-3">
              {scaffold.chapters.map((ch: ScaffoldChapter) => (
                <div key={ch.number} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-neutral-500 mt-0.5 shrink-0 w-8">{ch.number}</span>
                    <div className="min-w-0 flex-1">
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
                            <span key={kc} className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">{kc}</span>
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
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-xs bg-cyan-900/40 text-cyan-400 border border-cyan-800/50 px-2 py-0.5 rounded">{c.concept_type}</span>
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
        </div>
      )}
    </div>
  )
}
