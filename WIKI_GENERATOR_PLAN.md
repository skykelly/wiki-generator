# Wiki Generator — 개발 계획

## 개요

임의 주제를 입력하면 자동으로 위키를 생성하고 지속적으로 업데이트하는 플랫폼.  
homestyle-wiki의 LLM 위키 파이프라인을 멀티 테넌트 SaaS로 확장한다.

### 핵심 전제

| 항목 | 결정 |
|---|---|
| 아키텍처 | 단일 플랫폼, 멀티 테넌시 (wiki_id 기반) |
| 리서치 API | Tavily API |
| 현재 목적 | 본인 사용 |
| 향후 계획 | 외부 SaaS 출시 |

### homestyle-wiki와의 차이

| | homestyle-wiki | wiki-generator |
|---|---|---|
| 주제 | 고정 (한국 인테리어) | 임의 주제, 사용자 입력 |
| 초안 방식 | 수동 (kb/wiki/*.md 시드) | 자동 리서치 → LLM 생성 |
| 위키 수 | 1개 | N개 (멀티 테넌트) |
| 사용자 | 단일 관리자 | 위키별 소유자 |
| RSS 설정 | 수동 | 주제 기반 자동 추천 |
| 지속 업데이트 | ✅ | ✅ (동일 패턴 재사용) |

---

## 전체 흐름

```
[주제 입력]
    │
    ▼
[Seed Phase A: 목차 설계]          ← 사람 검토 포인트 ①
Tavily 리서치 → GPT-4.1 → 챕터 구조 / 핵심 개념 목록 / 토픽 맵
사람이 목차를 확인·편집 후 승인
    │
    ▼
[Seed Phase B: 배치 초안 생성]     ← 사람 검토 포인트 ②
챕터별 배치 처리 (한 번에 1~2챕터)
  - 각 챕터: Tavily 심층 리서치 → GPT-4.1 → 마크다운 초안
  - 생성 완료된 챕터부터 미리보기 가능
사람이 전체 초안 검토 후 승인
    │
    ▼
[Seed Phase C: 개념 추출]          ← 사람 검토 포인트 ③
초안 전체 → GPT-4.1 → concepts 목록 추출 (slug, title, brief, topics)
사람이 concepts 목록 확인 및 불필요한 항목 제거·보완
    │
    ▼
[Seed Phase D: 임베딩 & 활성화]
pages + concepts 전체 임베딩 빌드
RAG 챗봇 활성화, editorial 초안 생성
    │
    ▼
[지속 업데이트 Phase] ←─────────────────────────┐
RSS / Tavily 모니터링 → ingest → synthesize      │
자동으로 반복                                    │
                                                └── GitHub Actions (일 1회)
```

---

## Seed 생성 상세 설계

### 왜 Seed가 중요한가

Karpathy LLM Wiki의 핵심은 **"정보를 한 번 처리해 축적"** 하는 것이다.  
초기 Seed의 품질이 이후 모든 `synthesize` 결과의 기준점이 된다.  
목차 구조가 잘못 잡히면 이후 자동 업데이트가 엉뚱한 방향으로 쌓인다.

### Phase A: 목차 설계 (Scaffold)

**입력**: 주제명, 설명, 언어, 목적(예: "취미용", "전문가용", "입문자용")

**처리**:
1. Tavily로 주제에 대한 상위 소스 20~30개 수집
2. GPT-4.1에 소스 요약 + 주제 입력 → `ScaffoldResult` JSON 생성

```ts
interface ScaffoldResult {
  wiki_title: string
  description: string
  chapters: {
    number: string        // "01", "02" …
    title: string
    description: string
    subsections: { number: string; title: string }[]
    key_concepts: string[]  // 이 챕터에서 다룰 핵심 개념 힌트
  }[]
  concepts: {
    slug: string
    title: string
    brief: string
    topics: string[]
    concept_type: string  // style/lifestyle/spatial/functional/material/market
  }[]
  topics_config: TopicNode[]
  suggested_rss_feeds: { url: string; label: string }[]
}
```

**UI**: 생성된 목차를 테이블/트리 형태로 표시, 인라인 편집 가능  
**사람 검토**: 챕터 추가/삭제/순서 변경, 개념 목록 수정, 승인 버튼

---

### Phase B: 배치 초안 생성 (Draft Generation)

목차 승인 후 챕터별로 순차 처리. 전체를 한 번에 생성하지 않는다.

**배치 단위**: 챕터 1개 (subsection이 많으면 subsection별로 분할)

**각 챕터 처리 순서**:
1. `subsections` + `key_concepts`를 기반으로 Tavily 심층 리서치 (챕터별 5~10개 소스)
2. 소스 내용 + 챕터 구조 → GPT-4.1 → 마크다운 초안 생성
3. DB(`pages`)에 저장, `draft_status: 'generated'` 표시
4. 다음 챕터로 이동

**진행상황**: SSE로 실시간 스트리밍 ("챕터 2/6 생성 중…")  
**부분 실패**: 실패한 챕터만 재시도 가능하도록 체크포인트 저장  
**미리보기**: 생성 완료된 챕터는 즉시 `/w/[slug]/wiki/[chapter]`에서 확인 가능

**사람 검토**: 전체 초안 완료 후 Admin 탭에서 챕터별 내용 편집·승인

---

### Phase C: 개념 추출 (Concept Extraction)

초안 승인 후 자동 실행 (또는 수동 트리거).

**처리**:
1. 모든 `pages` 내용 + Scaffold의 concepts 목록을 합산
2. GPT-4.1 → 중복 제거, 보강된 concepts 목록 반환
3. 각 concept에 대해 `brief` + 초기 `content`(3~5문단) 생성
4. DB(`concepts`) 삽입

**배치 처리**: 개념 10개 단위로 처리 (컨텍스트 한계 고려)

**사람 검토**:
- Admin `/admin` → Concepts 탭에서 목록 확인
- 불필요한 concept 삭제, brief 편집, concept_type 조정
- 승인 버튼 → Phase D 진행

---

### Phase D: 임베딩 & 활성화

1. `pages` + `concepts` 전체 임베딩 빌드 (`rebuildEmbeddings`)
2. `synthesizeEditorial()` → 에디토리얼 초안 생성 (사람이 검토 후 publish)
3. `rebuildGraph()` → 지식 그래프 생성
4. `wikis.status = 'ready'` → 위키 공개

---

## 아키텍처

### DB 스키마 (멀티 테넌트)

기존 homestyle-wiki 스키마에 `wikis` 마스터 테이블 추가 + 모든 테이블에 `wiki_id` 컬럼 추가.

```sql
-- 신규: 위키 마스터
wikis
  id              text PK          -- "wiki_{slug}"
  slug            text UNIQUE
  title           text
  description     text
  topic           text             -- 원본 주제 입력값
  language        text DEFAULT 'ko'
  owner_id        text             -- 향후 user 테이블 연결
  status          text             -- 'scaffolding' | 'drafting' | 'reviewing' | 'ready' | 'error'
  scaffold_result jsonb            -- ScaffoldResult 저장 (검토·편집용)
  seed_progress   jsonb            -- { phase, completed_chapters, total_chapters, ... }
  created_at      timestamp
  updated_at      timestamp

-- 기존 테이블에 wiki_id 추가
sources              + wiki_id text REFERENCES wikis(id)
concepts             + wiki_id text REFERENCES wikis(id)
pages                + wiki_id text REFERENCES wikis(id)
  pages              + draft_status text  -- 'generated' | 'reviewed' | 'approved'
settings             + wiki_id text REFERENCES wikis(id)
knowledge_embeddings + wiki_id text REFERENCES wikis(id)
chat_sessions        + wiki_id text REFERENCES wikis(id)
```

기존 homestyle-wiki 데이터는 `wiki_id = 'wiki_homestyle'`로 마이그레이션.

### URL 라우팅

```
/                             → 플랫폼 홈 (위키 목록)
/create                       → 위키 생성 마법사
/w/[wikiSlug]                 → 위키 홈 (에디토리얼)
/w/[wikiSlug]/wiki/[slug]     → 챕터 페이지
/w/[wikiSlug]/concepts        → 개념 목록
/w/[wikiSlug]/concepts/[slug] → 개념 상세
/w/[wikiSlug]/sources         → 소스 목록
/w/[wikiSlug]/chat            → RAG 챗봇
/w/[wikiSlug]/admin           → 관리자 (소유자 전용)
```

### API 라우팅

```
POST /api/wikis                           → 위키 생성 시작
GET  /api/wikis/[id]/status               → 생성 진행상황 (SSE)
POST /api/wikis/[id]/scaffold             → Scaffold 재실행 또는 업데이트
POST /api/wikis/[id]/draft/[chapterNum]   → 특정 챕터 초안 생성 (또는 재생성)
POST /api/wikis/[id]/extract-concepts     → 개념 추출 실행
POST /api/wikis/[id]/activate             → 임베딩 + 활성화
POST /api/wikis/[id]/ingest               → 소스 수동 추가
POST /api/wikis/[id]/admin/*              → 기존 admin API (wiki_id 필터 추가)
```

---

## 개발 단계

### Phase 1 — 스키마 & 라우팅 리팩터 (기반 작업)

**작업 목록**

- [ ] `wikis` 테이블 추가 + 기존 테이블 `wiki_id`/`draft_status` 컬럼 추가
- [ ] `lib/db/schema.ts` 업데이트
- [ ] `lib/data.ts` 전체 함수에 `wikiId` 파라미터 추가
- [ ] `app/` 라우팅을 `/w/[wikiSlug]/...` 구조로 재편
- [ ] `lib/settings.ts` — `getSetting(key, wikiId)` 형태로 변경
- [ ] 기존 homestyle-wiki 데이터 마이그레이션 스크립트

**완료 기준**: 기존 homestyle-wiki가 `/w/homestyle` 경로로 정상 동작

---

### Phase 2 — 리서치 & 목차 설계 파이프라인

**작업 목록**

- [ ] Tavily API 클라이언트 (`lib/research.ts`)
  ```ts
  researchTopic(topic: string, depth?: 'overview' | 'deep'): Promise<ResearchResult[]>
  researchChapter(chapter: ChapterDef, existingResults?: ResearchResult[]): Promise<ResearchResult[]>
  ```
- [ ] Scaffold LLM 프롬프트 (`lib/scaffold.ts`)
  - Tavily 결과 → GPT-4.1 → `ScaffoldResult` JSON
  - 프롬프트에 언어·목적·청중 반영
- [ ] `/create` 위키 생성 마법사 UI
  - Step 1: 주제 입력 (주제명, 설명, 언어, 목적)
  - Step 2: 리서치 & 목차 생성 (SSE 진행상황)
  - Step 3: 목차 확인·편집 (챕터 트리 + 개념 목록)
  - Step 4: 승인 → 배치 초안 생성 시작
- [ ] `POST /api/wikis` — `ScaffoldResult` 저장, `status='scaffolding'`
- [ ] `POST /api/wikis/[id]/scaffold` — 재실행 API

**완료 기준**: 주제 입력 → 챕터/개념 구조 JSON 생성 → 사람 검토 화면 표시

---

### Phase 3 — 배치 초안 생성

**작업 목록**

- [ ] `lib/generate.ts` — 배치 초안 생성 파이프라인
  ```ts
  generateChapterDraft(wikiId: string, chapter: ChapterDef, sources: ResearchResult[]): Promise<string>
  // → 마크다운 반환, pages 테이블에 저장
  
  runDraftGeneration(wikiId: string): Promise<void>
  // → 모든 챕터를 순차 배치 처리, seed_progress 업데이트
  ```
- [ ] 챕터별 체크포인트: `pages.draft_status` 추적, 실패 시 해당 챕터만 재시도
- [ ] SSE 진행상황 엔드포인트: `GET /api/wikis/[id]/status`
- [ ] Admin UI — 초안 검토 탭: 챕터별 마크다운 에디터, 승인 버튼
- [ ] `POST /api/wikis/[id]/draft/[chapterNum]` — 단일 챕터 재생성

**완료 기준**: 모든 챕터 초안 자동 생성, 챕터별 미리보기 가능

---

### Phase 4 — 개념 추출

**작업 목록**

- [ ] `lib/extract-concepts.ts`
  ```ts
  extractConcepts(wikiId: string): Promise<ConceptDraft[]>
  // pages 전체 + scaffold.concepts → GPT-4.1 → deduped concepts 목록
  // concepts 10개 단위 배치 처리
  ```
- [ ] `POST /api/wikis/[id]/extract-concepts` — 트리거 API
- [ ] Admin UI — Concepts 검토 탭:
  - 추출된 concepts 목록 (slug, title, brief, concept_type)
  - 개별 삭제·편집, concept_type 드롭다운 수정
  - 일괄 승인 버튼 → Phase 5 진행
- [ ] concepts 저장: `onConflictDoNothing`, `wiki_id` 태깅

**완료 기준**: concepts 목록 Admin에서 확인·편집 가능

---

### Phase 5 — 임베딩 & 활성화

**작업 목록**

- [ ] `POST /api/wikis/[id]/activate`
  1. 모든 `pages` + `concepts` 임베딩 빌드
  2. `synthesizeEditorial()` 실행 (draft로 저장)
  3. `rebuildGraph()` 실행
  4. `wikis.status = 'ready'`
- [ ] Admin UI — 활성화 탭: 에디토리얼 검토·편집·publish 버튼
- [ ] `/w/[slug]` 위키 홈 활성화 (status=ready 위키만 공개)

**완료 기준**: 주제 → 완성된 위키 (챕터, 개념, 에디토리얼) 공개 가능

---

### Phase 6 — 지속 업데이트 자동화

**작업 목록**

- [ ] `lib/ingest.ts` + `lib/synthesize.ts` — `wikiId` 파라미터 추가
- [ ] RSS 피드 관리 테이블 (`rss_feeds`: wikiId, url, label, last_fetched)
- [ ] Scaffold 시 Tavily 제안 RSS 피드 자동 등록
- [ ] GitHub Actions 워크플로우: 위키별 `wikiId` 기반 스케줄 수집
- [ ] `/api/wikis/[id]/admin/ingest` — 수동 소스 추가 API

**완료 기준**: 신규 소스 자동 수집 → 위키 자동 업데이트

---

### Phase 7 — 플랫폼 UI

**작업 목록**

- [ ] 플랫폼 홈 (`/`): 내 위키 목록 + 새 위키 만들기 CTA
- [ ] 위키 홈 (`/w/[slug]`): 에디토리얼 + 최근 업데이트
- [ ] 위키 내 네비게이션: 기존 Header/WikiIndexDrawer를 위키 컨텍스트 인식으로 수정
- [ ] 관리자 대시보드: 위키별 Admin 탭 (기존 `/admin` 구조 재사용)
- [ ] 위키 생성 상태 페이지: 단계별 진행상황 표시 (Scaffold → Draft → Concepts → 활성화)

---

### Phase 8 — SaaS 준비 (향후)

**작업 목록**

- [ ] 사용자 계정 (OAuth: Google, GitHub)
- [ ] 위키별 공개/비공개 설정
- [ ] 커스텀 도메인 지원
- [ ] 플랜 / 사용량 제한 (위키 수, 월 소스 수집 횟수)
- [ ] 결제 연동 (Stripe)
- [ ] 랜딩 페이지

---

## 기술 스택

### 신규 추가

| 역할 | 기술 | 비고 |
|---|---|---|
| 웹 리서치 | Tavily API | `@tavily/core` |
| 비동기 진행상황 | Server-Sent Events (SSE) | Next.js Route Handler |
| 작업 큐 (향후) | Vercel Queue 또는 Upstash QStash | 배치 생성 장시간 작업 |
| 사용자 인증 (Phase 8) | Auth.js v5 + Google/GitHub OAuth | 기존 구조 확장 |
| 결제 (Phase 8) | Stripe | |

### 재사용 (homestyle-wiki 그대로)

- Next.js 15 App Router + TypeScript + Tailwind CSS v4
- Neon Postgres + pgvector + Drizzle ORM
- OpenAI (`getOpenAI()` lazy init 패턴 유지)
- `lib/ingest.ts`, `lib/synthesize.ts`, `lib/embed.ts` 파이프라인
- `components/MarkdownRenderer`, `DiffView`, `SearchBox` 등 UI 컴포넌트

### 환경변수 추가

```env
TAVILY_API_KEY=
NEXT_PUBLIC_APP_URL=
# Phase 8
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## MVP 범위

Phase 1 → 2 → 3 → 4 → 5 → 6 완료 시 MVP.  
Phase 7은 병행 진행 (UI 없으면 개발/검증 불가).  
Phase 8은 외부 출시 시 진행.

**MVP 완료 기준**: 주제 입력 → 목차 확인 → 초안 생성 → 개념 추출 → 사람 검토 → 위키 공개 → 자동 업데이트

---

## 개발 순서

```
Week 1-2:  Phase 1 (스키마 리팩터)
Week 3:    Phase 2 (Tavily 리서치 + Scaffold)
Week 4-5:  Phase 3 (배치 초안 생성)
Week 6:    Phase 4 (개념 추출)
Week 7:    Phase 5 (임베딩 & 활성화)
Week 8:    Phase 6 (지속 업데이트 자동화)
Week 9:    Phase 7 (플랫폼 UI 정리)
이후:      Phase 8 (SaaS 준비, 외부 출시)
```

---

## 사람 검토 포인트 요약

| 단계 | 검토 내용 | 승인 시 다음 단계 |
|---|---|---|
| ① Scaffold 완료 | 챕터 구조, 개념 목록, 토픽 맵 | 배치 초안 생성 시작 |
| ② 초안 완료 | 챕터별 마크다운 내용 | 개념 추출 실행 |
| ③ 개념 추출 완료 | Concepts 목록, concept_type | 임베딩 & 활성화 |
| ④ 에디토리얼 초안 | AI 생성 에디토리얼 내용 | Publish (위키 공개) |
