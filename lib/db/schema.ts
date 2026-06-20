import { pgTable, text, integer, jsonb, uuid, timestamp, customType, primaryKey } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() { return 'vector(1536)' },
  toDriver(value) { return JSON.stringify(value) },
  fromDriver(value) { return JSON.parse(value as string) },
})

export const wikis = pgTable('wikis', {
  id:              text('id').primaryKey(),          // "wiki_{slug}"
  slug:            text('slug').unique().notNull(),
  title:           text('title').notNull(),
  description:     text('description'),
  topic:           text('topic'),
  language:        text('language').default('ko'),
  owner_id:        text('owner_id'),
  status:          text('status').default('scaffolding'), // scaffolding|drafting|reviewing|ready|error
  scaffold_result: jsonb('scaffold_result'),
  seed_progress:   jsonb('seed_progress').default(sql`'{}'`),
  created_at:      timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:      timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const sources = pgTable('sources', {
  id:               text('id').primaryKey(),
  wiki_id:          text('wiki_id').notNull().default('wiki_homestyle').references(() => wikis.id),
  title:            text('title').notNull(),
  url:              text('url'),
  publisher:        text('publisher'),
  published_at:     text('published_at'),
  source_type:      text('source_type').default('external'),
  raw_content:      text('raw_content'),
  ai_summary:       text('ai_summary'),
  one_line_summary: text('one_line_summary'),
  topics:           text('topics').array().default(sql`'{}'`),
  status:           text('status').default('done'),
  error_message:    text('error_message'),
  synthesis_result: jsonb('synthesis_result').default(sql`'{}'`),
  created_at:       timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:       timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const concepts = pgTable('concepts', {
  id:                  text('id').primaryKey(),
  wiki_id:             text('wiki_id').notNull().default('wiki_homestyle').references(() => wikis.id),
  title:               text('title').notNull(),
  slug:                text('slug').notNull(),
  brief:               text('brief'),
  aliases:             text('aliases').array().default(sql`'{}'`),
  topics:              text('topics').array().default(sql`'{}'`),
  related_concepts:    text('related_concepts').array().default(sql`'{}'`),
  concept_type:        text('concept_type'),
  concept_status:      text('concept_status').default('candidate'),
  confidence:          integer('confidence').default(0),
  content:             text('content'),
  source_count:        integer('source_count').default(0),
  image_url:           text('image_url'),
  image_source_url:    text('image_source_url'),
  last_synthesized_at: timestamp('last_synthesized_at', { withTimezone: true }),
  updated_at:          timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const pages = pgTable('pages', {
  id:             text('id').primaryKey(),
  wiki_id:        text('wiki_id').notNull().default('wiki_homestyle').references(() => wikis.id),
  slug:           text('slug').notNull(),
  title:          text('title').notNull(),
  chapter_number: text('chapter_number'),
  subsections:    jsonb('subsections').default(sql`'[]'`),
  summary:        text('summary'),
  topics:         text('topics').array().default(sql`'{}'`),
  content:        text('content'),
  draft_status:   text('draft_status').default('approved'), // generated|reviewed|approved
  image_url:      text('image_url'),
  image_source_url: text('image_source_url'),
  updated_at:     timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const knowledge_embeddings = pgTable('knowledge_embeddings', {
  id:         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  wiki_id:    text('wiki_id').notNull().default('wiki_homestyle').references(() => wikis.id),
  ref_type:   text('ref_type').notNull(),
  ref_id:     text('ref_id').notNull(),
  content:    text('content').notNull(),
  embedding:  vector('embedding'),
  metadata:   jsonb('metadata').default(sql`'{}'`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const settings = pgTable('settings', {
  key:        text('key').notNull(),
  wiki_id:    text('wiki_id').notNull().default('wiki_homestyle').references(() => wikis.id),
  value:      text('value'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.key, t.wiki_id] }),
])

export const chat_sessions = pgTable('chat_sessions', {
  id:         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  wiki_id:    text('wiki_id').notNull().default('wiki_homestyle').references(() => wikis.id),
  user_email: text('user_email').notNull(),
  title:      text('title'),
  messages:   jsonb('messages').default(sql`'[]'`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
