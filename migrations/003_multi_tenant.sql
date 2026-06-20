-- Migration 003: Multi-tenant support
-- Adds wikis table and wiki_id to all tables.
-- Existing homestyle-wiki data is migrated to wiki_id = 'wiki_homestyle'.

-- 1. Create wikis master table
CREATE TABLE IF NOT EXISTS wikis (
  id              text PRIMARY KEY,
  slug            text UNIQUE NOT NULL,
  title           text NOT NULL,
  description     text,
  topic           text,
  language        text DEFAULT 'ko',
  owner_id        text,
  status          text DEFAULT 'ready',
  scaffold_result jsonb,
  seed_progress   jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 2. Seed the default homestyle wiki
INSERT INTO wikis (id, slug, title, description, topic, status)
VALUES (
  'wiki_homestyle',
  'homestyle',
  'Homestyle Wiki',
  '한국 리빙 시장 스타일·트렌드·카테고리 지식체계',
  '한국 홈스타일 & 인테리어',
  'ready'
) ON CONFLICT (id) DO NOTHING;

-- 3. Add wiki_id to sources
ALTER TABLE sources ADD COLUMN IF NOT EXISTS wiki_id text NOT NULL DEFAULT 'wiki_homestyle' REFERENCES wikis(id);

-- 4. Add wiki_id to concepts, drop old unique constraint, add composite unique
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS wiki_id text NOT NULL DEFAULT 'wiki_homestyle' REFERENCES wikis(id);
ALTER TABLE concepts DROP CONSTRAINT IF EXISTS concepts_slug_unique;
CREATE UNIQUE INDEX IF NOT EXISTS concepts_wiki_id_slug_unique ON concepts (wiki_id, slug);

-- 5. Add wiki_id and draft_status to pages, drop old unique constraint, add composite unique
ALTER TABLE pages ADD COLUMN IF NOT EXISTS wiki_id text NOT NULL DEFAULT 'wiki_homestyle' REFERENCES wikis(id);
ALTER TABLE pages ADD COLUMN IF NOT EXISTS draft_status text NOT NULL DEFAULT 'approved';
ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_slug_unique;
CREATE UNIQUE INDEX IF NOT EXISTS pages_wiki_id_slug_unique ON pages (wiki_id, slug);

-- 6. Add wiki_id to knowledge_embeddings
ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS wiki_id text NOT NULL DEFAULT 'wiki_homestyle' REFERENCES wikis(id);

-- 7. settings: add wiki_id, migrate PK from (key) to (key, wiki_id)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS wiki_id text NOT NULL DEFAULT 'wiki_homestyle' REFERENCES wikis(id);
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE settings ADD PRIMARY KEY (key, wiki_id);

-- 8. Add wiki_id to chat_sessions
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS wiki_id text NOT NULL DEFAULT 'wiki_homestyle' REFERENCES wikis(id);

-- 9. Update knowledge_view to include wiki_id
DROP VIEW IF EXISTS knowledge_view;
CREATE VIEW knowledge_view AS
  SELECT id, wiki_id, 'source' AS type, title, id AS slug,
         one_line_summary AS summary, topics, updated_at
  FROM sources WHERE status = 'done'
  UNION ALL
  SELECT id, wiki_id, 'concept' AS type, title, slug,
         brief AS summary, topics, updated_at
  FROM concepts
  UNION ALL
  SELECT id, wiki_id, 'page' AS type, title, slug,
         summary, topics, updated_at
  FROM pages;
