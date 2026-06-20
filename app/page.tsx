import Link from 'next/link'
import { getWikis, getWikiStats } from '@/lib/data'
import type { WikiStats } from '@/lib/data'
import type { WikiItem } from '@/lib/types'

const STATUS_LABEL: Record<string, string> = {
  scaffolding: '스캐폴딩',
  reviewing:   '검토 중',
  drafting:    '초안 생성',
  extracting:  '개념 추출',
  ready:       '공개',
  error:       '오류',
}

const STATUS_COLOR: Record<string, string> = {
  scaffolding: 'text-yellow-400 bg-yellow-400/10 border-yellow-800/50',
  reviewing:   'text-cyan-400   bg-cyan-400/10   border-cyan-800/50',
  drafting:    'text-yellow-400 bg-yellow-400/10 border-yellow-800/50',
  extracting:  'text-purple-400 bg-purple-400/10 border-purple-800/50',
  ready:       'text-green-400  bg-green-400/10  border-green-800/50',
  error:       'text-red-400    bg-red-400/10    border-red-800/50',
}

function WikiCard({ wiki, stats }: { wiki: WikiItem; stats: WikiStats }) {
  const isReady = wiki.status === 'ready'
  const href = isReady ? `/w/${wiki.slug}` : `/w/${wiki.slug}/admin/seed`
  const badge = STATUS_COLOR[wiki.status] ?? 'text-neutral-400 bg-neutral-800 border-neutral-700'

  return (
    <Link
      href={href}
      className="group block bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 rounded-xl p-5 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-base font-semibold text-white leading-tight group-hover:text-white">{wiki.title}</h3>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded border font-medium ${badge}`}>
          {STATUS_LABEL[wiki.status] ?? wiki.status}
        </span>
      </div>

      {wiki.description && (
        <p className="text-sm text-neutral-400 leading-relaxed line-clamp-2 mb-3">{wiki.description}</p>
      )}

      {wiki.topic && !wiki.description && (
        <p className="text-sm text-neutral-500 mb-3">주제: {wiki.topic}</p>
      )}

      {isReady && (stats.page_count > 0 || stats.concept_count > 0) && (
        <div className="flex gap-4 text-xs text-neutral-600 border-t border-neutral-800 pt-3 mt-1">
          {stats.page_count > 0 && <span>챕터 {stats.page_count}</span>}
          {stats.concept_count > 0 && <span>개념 {stats.concept_count}</span>}
          {stats.source_count > 0 && <span>소스 {stats.source_count}</span>}
        </div>
      )}

      {!isReady && (
        <p className="text-xs text-neutral-600 mt-1">
          시드 생성 진행 중 — 클릭해서 계속하기
        </p>
      )}
    </Link>
  )
}

export default async function PlatformHomePage() {
  const wikis = await getWikis()
  const statsMap = await Promise.all(wikis.map((w) => getWikiStats(w.id)))

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-3">Wiki Generator</h1>
        <p className="text-neutral-400 max-w-xl">
          주제를 입력하면 AI가 목차를 설계하고, 챕터 초안을 생성하며, 개념을 추출해
          지속 업데이트되는 위키를 자동으로 만듭니다.
        </p>
      </div>

      {/* Stats bar */}
      {wikis.length > 0 && (
        <div className="flex gap-6 mb-8 text-sm text-neutral-500">
          <span><strong className="text-white">{wikis.length}</strong> 위키</span>
          <span><strong className="text-white">{wikis.filter((w) => w.status === 'ready').length}</strong> 공개</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">위키 목록</h2>
        <Link
          href="/create"
          className="text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + 새 위키 만들기
        </Link>
      </div>

      {wikis.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-neutral-800 rounded-2xl">
          <p className="text-4xl mb-4">📖</p>
          <p className="text-neutral-400 mb-2">아직 위키가 없습니다</p>
          <p className="text-neutral-600 text-sm mb-6">첫 번째 위키를 만들어 시작하세요.</p>
          <Link href="/create" className="text-sm text-cyan-500 hover:text-cyan-400 transition-colors">
            위키 만들기 →
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {wikis.map((wiki, i) => (
            <WikiCard key={wiki.id} wiki={wiki} stats={statsMap[i]} />
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="mt-16 border-t border-neutral-800 pt-10">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-6">워크플로우</h2>
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            { step: 'A', title: '스캐폴드', desc: '주제 → AI가 목차 + 개념 구조 설계' },
            { step: 'B', title: '초안 생성', desc: '챕터별 심층 리서치 + 마크다운 초안' },
            { step: 'C', title: '개념 추출', desc: '핵심 개념 자동 추출 + 콘텐츠 생성' },
            { step: 'D', title: '활성화',   desc: '임베딩 빌드 → RAG 챗봇 + 위키 공개' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="text-xs font-mono text-neutral-600 mb-2">Phase {step}</div>
              <p className="font-semibold text-white text-sm mb-1">{title}</p>
              <p className="text-xs text-neutral-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
