export interface SourceItem {
  id: string
  title: string
  url?: string
  publisher?: string
  published_at?: string
  source_type: string
  raw_content?: string
  ai_summary?: string
  one_line_summary?: string
  topics: string[]
  status: string
  synthesis_result: SynthesisResult
  created_at: string
}

export interface SynthesisResult {
  concepts_updated: string[]
  concepts_created: string[]
  synthesized_at: string
}

export interface ConceptItem {
  id: string
  title: string
  slug: string
  brief?: string
  aliases: string[]
  topics: string[]
  related_concepts: string[]
  concept_type?: string
  concept_status: string
  confidence: number
  content?: string
  source_count: number
  image_url?: string
  image_source_url?: string
  last_synthesized_at?: string
  updated_at: string
}

export interface WikiPageItem {
  id: string
  slug: string
  title: string
  chapter_number: string
  subsections: { number: string; title: string }[]
  summary?: string
  topics: string[]
  content?: string
  image_url?: string
  image_source_url?: string
  updated_at: string
}

export interface KnowledgeItem {
  id: string
  type: 'source' | 'concept' | 'page'
  title: string
  slug: string
  summary?: string
  topics: string[]
  updated_at: string
}

export interface TopicNode {
  number: string
  title: string
  label: string
  subtopics: string[]
}

export interface MetricCard {
  id: string
  title: string
  stat: string
  definition: string
  source: string
  message: string
  url: string
}

export interface KnowledgeGraphLink {
  source: string
  target: string
}

export interface KnowledgeGraphNode {
  id: string
  type: 'topic' | 'source' | 'concept'
  label: string
  slug?: string
  brief?: string
  description?: string
  publisher?: string
  published_at?: string
  topics?: string[]
  source_count?: number
  last_synthesized_at?: string
  synthesis_result?: SynthesisResult
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[]
  links: KnowledgeGraphLink[]
  built_at: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  created_at: string
}

export interface Citation {
  ref_type: string
  ref_id: string
  title: string
  slug?: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  updated_at: string
}

export interface IngestLogEntry {
  source_id: string
  title: string
  concepts_updated: string[]
  concepts_created: string[]
  date: string
}

export interface EditorialVersion {
  label: string
  content: string
  saved_at: string
  is_draft: boolean
}

export interface WikiItem {
  id: string
  slug: string
  title: string
  description?: string
  topic?: string
  language: string
  status: string
  scaffold_result?: ScaffoldResult
  seed_progress?: SeedProgress
  created_at: string
  updated_at: string
}

export interface ScaffoldChapter {
  number: string
  title: string
  description: string
  subsections: { number: string; title: string }[]
  key_concepts: string[]
}

export interface ScaffoldConcept {
  slug: string
  title: string
  brief: string
  topics: string[]
  concept_type: string
}

export interface ScaffoldResult {
  wiki_title: string
  description: string
  chapters: ScaffoldChapter[]
  concepts: ScaffoldConcept[]
  topics_config: TopicNode[]
  suggested_rss_feeds: { url: string; label: string }[]
}

export interface SeedProgress {
  phase: 'scaffold' | 'drafting' | 'extracting' | 'activating' | 'done'
  completed_chapters: number
  total_chapters: number
  completed_concepts: number
  total_concepts: number
  last_updated: string
}

export interface LintIssue {
  type: 'empty_content' | 'no_topics' | 'no_sources' | 'stale' | 'orphan'
  concept_slug: string
  title: string
  detail: string
}
