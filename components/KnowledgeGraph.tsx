'use client'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ForceGraphMethods, ForceGraphProps, NodeObject } from 'react-force-graph-2d'
import type { KnowledgeGraphData, KnowledgeGraphNode } from '@/lib/types'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false }) as unknown as React.ComponentType<
  ForceGraphProps<KnowledgeGraphNode, object> & {
    ref?: React.MutableRefObject<ForceGraphMethods<KnowledgeGraphNode, object> | undefined>
  }
>

type GNode = NodeObject<KnowledgeGraphNode>
type NodeType = KnowledgeGraphNode['type']

const TYPE_COLOR: Record<NodeType, string> = { topic: '#d4d4d8', source: '#ec4899', concept: '#22d3ee' }
const TYPE_LABEL: Record<NodeType, string> = { topic: '토픽', concept: '개념', source: '소스' }
const BASE_RADIUS: Record<NodeType, number> = { topic: 10, concept: 6.3, source: 5.6 }
const NODE_VAL: Record<NodeType, number> = { topic: 100, concept: 40, source: 31 }

export default function KnowledgeGraph({ data, basePath = '' }: { data: KnowledgeGraphData; basePath?: string }) {
  const fgRef = useRef<ForceGraphMethods<KnowledgeGraphNode, object> | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const hasFittedRef = useRef(false)

  const [width, setWidth] = useState(800)
  const [selected, setSelected] = useState<KnowledgeGraphNode | null>(null)
  const [filters, setFilters] = useState<Record<NodeType, boolean>>({ topic: true, concept: true, source: true })
  const [query, setQuery] = useState('')

  const HEIGHT = 600

  // 컨테이너 너비 추적
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 노드/링크 조회용 맵
  const nodeById = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes])

  const maxSourceCount = useMemo(
    () => Math.max(1, ...data.nodes.filter((n) => n.type === 'concept').map((n) => n.source_count ?? 0)),
    [data.nodes]
  )

  const radiusOf = useCallback((node: KnowledgeGraphNode): number => {
    const base = BASE_RADIUS[node.type] ?? 6
    if (node.type === 'concept') {
      const ratio = (node.source_count ?? 0) / maxSourceCount
      return base * (1 + 0.2 * ratio)
    }
    return base
  }, [maxSourceCount])

  // 토픽별 연결 개념/소스 수
  const topicStats = useMemo(() => {
    const stats = new Map<string, { concepts: number; sources: number }>()
    for (const n of data.nodes) {
      if (n.type === 'topic') stats.set(n.id, { concepts: 0, sources: 0 })
    }
    for (const l of data.links) {
      const sNode = nodeById.get(l.source)
      const tNode = nodeById.get(l.target)
      if (sNode?.type === 'topic' && tNode) {
        const stat = stats.get(sNode.id)
        if (stat) {
          if (tNode.type === 'concept') stat.concepts++
          else if (tNode.type === 'source') stat.sources++
        }
      } else if (tNode?.type === 'topic' && sNode) {
        const stat = stats.get(tNode.id)
        if (stat) {
          if (sNode.type === 'concept') stat.concepts++
          else if (sNode.type === 'source') stat.sources++
        }
      }
    }
    return stats
  }, [data, nodeById])

  // 필터/검색 적용
  const graphData = useMemo(() => {
    const q = query.trim().toLowerCase()
    const nodes = data.nodes.filter((n) => {
      if (!filters[n.type]) return false
      if (q && !n.label.toLowerCase().includes(q)) return false
      return true
    })
    const ids = new Set(nodes.map((n) => n.id))
    const links = data.links
      .filter((l) => ids.has(l.source) && ids.has(l.target))
      .map((l) => ({ source: l.source, target: l.target }))
    return { nodes: nodes.map((n) => ({ ...n })), links }
  }, [data, filters, query])

  // 마운트 시 초기 줌
  useEffect(() => {
    const timer = setTimeout(() => fgRef.current?.zoom(0.35), 0)
    return () => clearTimeout(timer)
  }, [])

  // 토글/검색 시 350ms 후 fitView
  useEffect(() => {
    const timer = setTimeout(() => fgRef.current?.zoomToFit(220, 20), 350)
    return () => clearTimeout(timer)
  }, [filters, query])

  const handleEngineStop = useCallback(() => {
    if (!hasFittedRef.current) {
      hasFittedRef.current = true
      fgRef.current?.zoomToFit(250, 20)
    }
  }, [])

  const handleNodeClick = useCallback((node: GNode) => {
    setSelected(node as KnowledgeGraphNode)
  }, [])

  const handleNodeRightClick = useCallback((node: GNode) => {
    if (node.x == null || node.y == null) return
    fgRef.current?.centerAt(node.x, node.y, 1000)
    fgRef.current?.zoom(3, 1000)
  }, [])

  // 패널 외부 클릭 시 닫기
  useEffect(() => {
    if (!selected) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSelected(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [selected])

  const nodeCanvasObject = useCallback((node: GNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as KnowledgeGraphNode & { x: number; y: number }
    if (n.x == null || n.y == null) return
    const r = radiusOf(n)

    ctx.beginPath()
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI, false)
    ctx.fillStyle = TYPE_COLOR[n.type] ?? '#999'
    ctx.fill()

    if (selected?.id === n.id) {
      ctx.lineWidth = 1.5 / globalScale
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
    }

    const fontSize = Math.max(10 / globalScale, 1.5)
    ctx.font = `${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText(n.label, n.x, n.y + r + 1)
  }, [radiusOf, selected])

  const nodePointerAreaPaint = useCallback((node: GNode, color: string, ctx: CanvasRenderingContext2D) => {
    const n = node as KnowledgeGraphNode & { x: number; y: number }
    if (n.x == null || n.y == null) return
    const r = radiusOf(n)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI, false)
    ctx.fill()
  }, [radiusOf])

  const stat = selected?.type === 'topic' ? topicStats.get(selected.id) : undefined

  return (
    <div>
      {/* 필터 + 검색 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(Object.keys(TYPE_LABEL) as NodeType[]).map((type) => (
          <button
            key={type}
            onClick={() => setFilters((f) => ({ ...f, [type]: !f[type] }))}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
              filters[type]
                ? 'bg-white text-neutral-950'
                : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: TYPE_COLOR[type] }} />
            {TYPE_LABEL[type]}
          </button>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색…"
          className="ml-auto bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 w-40 sm:w-56"
        />
      </div>

      {/* 그래프 */}
      <div ref={containerRef} className="relative bg-[#080a12] border border-neutral-800 rounded-xl overflow-hidden" style={{ height: HEIGHT }}>
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={width}
          height={HEIGHT}
          backgroundColor="#080a12"
          nodeRelSize={1}
          nodeVal={(n) => NODE_VAL[(n as KnowledgeGraphNode).type] ?? 20}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={nodePointerAreaPaint}
          linkColor={() => 'rgba(255,255,255,0.12)'}
          cooldownTicks={80}
          warmupTicks={60}
          onEngineStop={handleEngineStop}
          onNodeClick={handleNodeClick}
          onNodeRightClick={handleNodeRightClick}
          onBackgroundClick={() => setSelected(null)}
        />

        {/* 노드 패널 */}
        {selected && (
          <div
            ref={panelRef}
            className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-80 bg-neutral-900/95 border border-neutral-700 rounded-xl p-4 backdrop-blur shadow-xl"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: TYPE_COLOR[selected.type] }} />
                <h3 className="text-sm font-semibold text-white leading-snug">{selected.label}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-500 hover:text-neutral-300 text-xs shrink-0">✕</button>
            </div>

            {selected.type === 'concept' && (
              <div className="space-y-2 text-sm">
                {selected.brief && <p className="text-neutral-300 leading-relaxed">{selected.brief}</p>}
                {(selected.topics?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.topics!.map((t) => (
                      <span key={t} className="text-xs bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-md">{t}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>참조 소스 {selected.source_count ?? 0}개</span>
                  {selected.last_synthesized_at && (
                    <span>{new Date(selected.last_synthesized_at).toLocaleDateString('ko-KR')}</span>
                  )}
                </div>
                {selected.slug && (
                  <Link href={`${basePath}/concepts/${selected.slug}`} className="text-xs text-accent-500 hover:text-accent-400 transition-colors inline-block">
                    전체 보기 →
                  </Link>
                )}
              </div>
            )}

            {selected.type === 'source' && (
              <div className="space-y-2 text-sm">
                {selected.description && <p className="text-neutral-300 leading-relaxed">{selected.description}</p>}
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  {selected.publisher && <span>{selected.publisher}</span>}
                  {selected.published_at && <span>{selected.publisher ? '· ' : ''}{selected.published_at}</span>}
                </div>
                {selected.synthesis_result && (
                  (selected.synthesis_result.concepts_created.length > 0 || selected.synthesis_result.concepts_updated.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {selected.synthesis_result.concepts_created.map((s) => (
                        <span key={`c-${s}`} className="text-xs bg-emerald-950/60 text-emerald-600 border border-emerald-900/50 px-1.5 py-0.5 rounded-md">+{s}</span>
                      ))}
                      {selected.synthesis_result.concepts_updated.map((s) => (
                        <span key={`u-${s}`} className="text-xs bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-md">{s}</span>
                      ))}
                    </div>
                  )
                )}
                <Link href={`${basePath}/sources/${selected.id}`} className="text-xs text-accent-500 hover:text-accent-400 transition-colors inline-block">
                  전체 보기 →
                </Link>
              </div>
            )}

            {selected.type === 'topic' && (
              <div className="text-xs text-neutral-500 flex items-center gap-3">
                <span>연결 개념 {stat?.concepts ?? 0}개</span>
                <span>연결 소스 {stat?.sources ?? 0}개</span>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-600 mt-2">
        좌클릭: 상세 정보 · 우클릭: 확대 · 노드 라벨/색상 — <span className="text-neutral-300">●</span> 토픽 ·{' '}
        <span style={{ color: TYPE_COLOR.concept }}>●</span> 개념 · <span style={{ color: TYPE_COLOR.source }}>●</span> 소스
      </p>
    </div>
  )
}
