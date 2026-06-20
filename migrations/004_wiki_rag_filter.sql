-- match_knowledge_chunks에 wiki_id 필터 추가 (멀티위키 RAG 격리)
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding  vector(1536),
  match_threshold  float   DEFAULT 0.32,
  match_count      int     DEFAULT 8,
  filter_wiki_id   text    DEFAULT NULL
) RETURNS TABLE (
  id         uuid,
  ref_type   text,
  ref_id     text,
  content    text,
  similarity float,
  metadata   jsonb
) LANGUAGE sql STABLE AS $$
  SELECT id, ref_type, ref_id, content,
    1 - (embedding <=> query_embedding) AS similarity,
    metadata
  FROM knowledge_embeddings
  WHERE
    1 - (embedding <=> query_embedding) > match_threshold
    AND (filter_wiki_id IS NULL OR wiki_id = filter_wiki_id)
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
