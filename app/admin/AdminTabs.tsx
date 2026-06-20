'use client'
import { useState } from 'react'
import type { ConceptItem, WikiPageItem, MetricCard, EditorialVersion, IngestLogEntry } from '@/lib/types'
import EditorialTab from './EditorialTab'
import ConceptsTab from './ConceptsTab'
import PagesTab from './PagesTab'
import MetricsTab from './MetricsTab'
import HealthTab from './HealthTab'
import GraphTab from './GraphTab'

const TABS = [
  { key: 'editorial', label: 'Editorial' },
  { key: 'concepts', label: 'Concepts' },
  { key: 'pages', label: 'Wiki Pages' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'health', label: 'Wiki Health' },
  { key: 'graph', label: 'Graph' },
] as const

type TabKey = typeof TABS[number]['key']

interface Props {
  editorialContent: string
  editorialVersions: EditorialVersion[]
  concepts: ConceptItem[]
  pages: WikiPageItem[]
  metrics: MetricCard[]
  ingestLog: IngestLogEntry[]
  graphBuiltAt: string
  wikiId?: string
}

export default function AdminTabs(props: Props) {
  const [tab, setTab] = useState<TabKey>('editorial')
  const [focusConceptSlug, setFocusConceptSlug] = useState<string | null>(null)

  const goToConcept = (slug: string) => {
    setTab('concepts')
    setFocusConceptSlug(slug)
  }

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-neutral-900 p-1 rounded-xl w-fit overflow-x-auto max-w-full">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'editorial' && <EditorialTab content={props.editorialContent} versions={props.editorialVersions} wikiId={props.wikiId} />}
      {tab === 'concepts' && (
        <ConceptsTab
          concepts={props.concepts}
          focusSlug={focusConceptSlug}
          onFocusConsumed={() => setFocusConceptSlug(null)}
        />
      )}
      {tab === 'pages' && <PagesTab pages={props.pages} wikiId={props.wikiId} />}
      {tab === 'metrics' && <MetricsTab metrics={props.metrics} wikiId={props.wikiId} />}
      {tab === 'health' && <HealthTab concepts={props.concepts} ingestLog={props.ingestLog} onEditConcept={goToConcept} wikiId={props.wikiId} />}
      {tab === 'graph' && <GraphTab builtAt={props.graphBuiltAt} wikiId={props.wikiId} />}
    </div>
  )
}
