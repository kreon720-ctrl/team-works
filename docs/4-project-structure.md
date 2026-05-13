# TEAM WORKS — 프로젝트 구조 설계 원칙

## 문서 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2026-04-07 | 최초 작성 |
| 1.1 | 2026-04-08 | TeamInvitation → TeamJoinRequest 반영: invitations 관련 디렉토리·엔드포인트 제거, join-requests·teams/public·me/tasks 라우트 추가, ERD/API 명세 경로 수정 |
| 1.2 | 2026-04-08 | 컴포넌트명 예시의 TeamInviteModal → JoinRequestActions 로 수정 |
| 1.3 | 2026-04-09 | 디렉토리 구조 개편: backend/ · frontend/ · database/ 3-tier 분리 |
| 1.4 | 2026-04-09 | Vercel 단독 배포 적합성 검토 반영: backend/·frontend/ 각각에 next.config.ts·package.json·tsconfig.json 위치 명시, swagger/ 를 backend/ 내로 이동·Swagger UI route 추가, 환경변수를 서비스별 루트에 분리 명시, NEXT_PUBLIC_API_URL 구조 추가, frontend/lib/apiClient.ts 에 API URL 환경변수 참조 명시 |
| 1.5 | 2026-04-09 | DB/ 디렉토리명을 database/ 로 변경 |
| 1.6 | 2026-04-09 | FE-01 완료: frontend/ 초기 세팅 반영 - Providers.tsx 추가, test/ 디렉토리 및 Vitest 설정, globals.css 커스텀 컬러 시스템, Tailwind CSS v4 CSS 기반 적용 |
| 1.7 | 2026-04-18 | 앱명 Team CalTalk → TEAM WORKS 반영. SCHEDULE_REQUEST → WORK_PERFORMANCE 변경. postits/work-permissions 엔드포인트 추가 |
| 1.8 | 2026-04-20 | 실제 구현 반영: 백엔드 API Routes(notices/postits/projects/sub-schedules/work-permissions/members/auth/me), 쿼리 파일(notice/permission/postit/project/projectSchedule/subSchedule), 에러 모듈, 테스트 파일 추가. 프론트엔드 app/_components·_hooks 코-로케이션 패턴, project 컴포넌트 전체, chat(NoticeBanner·WorkPermissionModal·useChatPanel), schedule(PostItCard·PostItColorPalette·ScheduleTooltip), common(ResizableSplit), store(noticeStore/projectStore/projectScheduleStore/subScheduleStore), hooks/query(usePostits·useWorkPermissions·useRemoveTeamMember 등), lib/api(noticeApi/projectApi), lib/authInterceptor·tokenManager, types(postit·project) 추가 |
| 1.9 | 2026-04-29 | docs/1 v2.0·docs/2 v1.6 동기화 — Vercel 가정 폐기 → Docker Compose 단일 호스트 운영 반영. P-06 갱신. 신규 디렉토리: 자료실(`backend/app/api/teams/.../board`, `app/api/files/[fileId]`, `lib/files/`, `frontend/components/board/`, `lib/api/boardApi.ts`, `types/board.ts`), 프로젝트 컨텍스트 격리(`projects/[projectId]/messages`, `/notices`), AI 버틀러(`frontend/app/api/ai-assistant/chat·execute/route.ts`, `components/ai-assistant/AIAssistantPanel.tsx`, `lib/mcp/{pgClient,scheduleQueries}.ts`). 프로젝트 루트에 `docker-compose.yml`·`docker/`·`rag/`·`ollama/`·`files/` 추가. §10 신규(Docker/AI/RAG 인프라). §부록 핵심 제약 갱신, 관련 문서에 docs/13~19 링크 |
| 1.10 | 2026-05-12 | docs/1 v2.1·docs/2 v1.7 동기화. AI 4-way → 6-way 분류(`schedule_update`/`schedule_delete` 추가). **음성 입력(STT)** 추가: `frontend/hooks/useSpeechRecognition.ts`(hybrid wrapper) + `useWebSpeechRecognition.ts`(브라우저 내장) + `useWhisperRecognition.ts`(자체 호스팅 분기), `frontend/app/api/stt/route.ts`(multipart → Whisper 컨테이너 프록시). **Whisper 컨테이너** (`onerahmet/openai-whisper-asr-webservice` :9000, `faster_whisper` 엔진, CPU INT8, `whisper_cache` volume) docker-compose 추가. **모바일 UX**: `frontend/hooks/useSwipeGesture.ts`(좌우 swipe), `MobileLayout.tsx`(이미 있음, 음성 입력·분할 화면 키보드 억제 책임 보강). RAG 실구현 경로 정정 — `rag/server.js`(Express, 6-way 분류기 + `/parse-schedule-args`·`/parse-schedule-query` + `/chat`). schedule_update/delete 는 별도 RAG endpoint 없이 frontend `chat/route.ts` 가 `/parse-schedule-query` 재활용 + `tryParseDirectDatetime` + LLM fallback 으로 직접 처리. **AI 로직 실 위치 정정** — `backend/lib/ai/`(미존재) 표기 폐기, 실제는 `frontend/lib/mcp/{pgClient,scheduleQueries}.ts` + `frontend/app/api/ai-assistant/{chat,execute}/route.ts`(BFF). 임베딩 CPU 분리(별도 ollama 인스턴스) `docs/embeding-cpu.md` 참조 |
| 1.11 | 2026-05-12 | Ghost file 정정 — 실제 코드에 없는 파일 표기 제거. `frontend/components/ai-assistant/` 는 `AIAssistantPanel.tsx` 단일 파일이며 `AIAssistantMessageList`·`ConfirmCard`·`AwaitingInputForm` 은 inline 구현임을 명시. `frontend/components/board/` 는 `BoardPanel.tsx` 단일 파일(PostEditor·PostDetail inline). `frontend/lib/api/aiAssistantApi.ts` 와 `frontend/lib/sse/streamReader.ts` 는 미존재 — AI SSE 클라이언트는 `AIAssistantPanel.tsx` 에 inline. 누락 추가: `frontend/lib/openWebUiModel.ts` (Open WebUI `/api/models` 동적 해석), `frontend/lib/mcp/` 명시. docs/5 다이어그램 4 도 동일 정정 |

---

## 1. 최상위 공통 원칙

| # | 원칙 | 설명 |
|---|------|------|
| P-01 | 단일 책임 | 파일 하나는 하나의 역할만 담당. 컴포넌트·함수·쿼리 파일 혼합 금지 |
| P-02 | 레이어 격리 | UI는 Store/Query만 호출. API Route는 DB 쿼리만 실행. 레이어 건너뛰기 금지 |
| P-03 | 명시적 의존성 | import 경로는 항상 명시적으로 작성. barrel index 남용 금지 |
| P-04 | 과도한 추상화 금지 | 1인 5일 MVP 기준. 실제 중복이 3회 이상 발생할 때만 추상화 |
| P-05 | 서버 사이드 권한 검증 필수 | LEADER/MEMBER 역할 및 teamId 격리는 반드시 API Route에서 검증. 클라이언트 검증만으로 대체 불가 |
| P-06 | Docker 컨테이너 격리 | 서비스 간 통신은 docker-compose 네트워크 명(`postgres-db`, `ollama`, `searxng`, `open-webui` 등)으로만. 호스트 의존(`localhost`/특정 경로) 금지. 영구 보존 데이터(파일/모델/DB)는 host volume mount 로 외부화 |

---

## 2. 의존성 / 레이어 원칙

### 레이어 구조

```
[UI Layer]
  React 컴포넌트 (frontend/app/, frontend/components/)
    ↓ 데이터 읽기/쓰기
[Store / Query Layer]
  Zustand 스토어 (frontend/store/)          ← 클라이언트 전역 상태
  TanStack Query 훅 (frontend/hooks/query/) ← 서버 상태, 폴링
    ↓ HTTP 요청
[API Layer]
  Next.js API Routes (backend/app/api/)
  JWT 검증 미들웨어
  역할/팀 권한 검증
    ↓ SQL
[DB Layer]
  pg 쿼리 함수 (backend/lib/db/queries/)
  PostgreSQL (database/schema.sql)
```

### 의존 방향 규칙

- UI → Store/Query 단방향만 허용
- API Route → DB 쿼리 함수 단방향만 허용
- UI에서 pg 직접 호출 절대 금지
- DB 쿼리 함수에서 HTTP fetch 절대 금지
- 순환 의존(A → B → A) 발생 시 즉시 중간 레이어로 분리

---

## 3. 코드 / 네이밍 원칙

### 파일명

| 대상 | 규칙 | 예시 |
|------|------|------|
| React 컴포넌트 | PascalCase | `CalendarView.tsx`, `ChatPanel.tsx` |
| 훅 | camelCase, `use` 접두사 | `useSchedules.ts`, `useAuth.ts` |
| 유틸/헬퍼 | camelCase | `formatDate.ts`, `verifyJwt.ts` |
| DB 쿼리 파일 | camelCase | `scheduleQueries.ts`, `chatQueries.ts` |
| API Route | Next.js 규칙 준수 | `route.ts` (디렉토리로 구분) |

### 컴포넌트명

- PascalCase 필수
- 도메인 + 역할 조합: `ScheduleForm`, `JoinRequestActions`, `ChatMessageList`

### 함수명

- 동사 + 명사 조합: `createSchedule`, `getTeamMembers`, `sendChatMessage`
- 불리언 반환: `is` / `has` 접두사: `isLeader`, `hasTeamAccess`
- 이벤트 핸들러: `handle` 접두사: `handleSubmit`, `handleDateSelect`

### TypeScript 타입 네이밍

- 도메인 엔티티: PascalCase 명사: `User`, `Team`, `Schedule`, `ChatMessage`
- API 요청/응답 DTO: `~Request`, `~Response`: `CreateScheduleRequest`, `LoginResponse`
- Zustand 스토어 타입: `~Store`: `AuthStore`, `TeamStore`
- Enum: PascalCase: `UserRole`, `MessageType`, `JoinRequestStatus`

### API 엔드포인트 네이밍 (RESTful)

```
# 인증
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/auth/me
PATCH  /api/auth/me

# 팀 관리
GET    /api/teams
POST   /api/teams
GET    /api/teams/public
GET    /api/teams/[teamId]
POST   /api/teams/[teamId]/join-requests
GET    /api/teams/[teamId]/join-requests
PATCH  /api/teams/[teamId]/join-requests/[requestId]
DELETE /api/teams/[teamId]/members/[userId]

# 나의 작업
GET    /api/me/tasks

# 일정
GET    /api/teams/[teamId]/schedules
POST   /api/teams/[teamId]/schedules
GET    /api/teams/[teamId]/schedules/[scheduleId]
PATCH  /api/teams/[teamId]/schedules/[scheduleId]
DELETE /api/teams/[teamId]/schedules/[scheduleId]

# 포스트잇
GET    /api/teams/[teamId]/postits
POST   /api/teams/[teamId]/postits
PATCH  /api/teams/[teamId]/postits/[postitId]
DELETE /api/teams/[teamId]/postits/[postitId]

# 채팅 메시지 (팀 일자별)
GET    /api/teams/[teamId]/messages
POST   /api/teams/[teamId]/messages

# 채팅 메시지 (프로젝트별 — projectId 격리)
GET    /api/teams/[teamId]/projects/[projectId]/messages
POST   /api/teams/[teamId]/projects/[projectId]/messages

# 공지사항 (팀 일자별)
GET    /api/teams/[teamId]/notices
POST   /api/teams/[teamId]/notices
DELETE /api/teams/[teamId]/notices/[noticeId]

# 공지사항 (프로젝트별 — projectId 격리)
GET    /api/teams/[teamId]/projects/[projectId]/notices
POST   /api/teams/[teamId]/projects/[projectId]/notices
DELETE /api/teams/[teamId]/projects/[projectId]/notices/[noticeId]

# 업무보고 조회 권한
GET    /api/teams/[teamId]/work-permissions
PATCH  /api/teams/[teamId]/work-permissions

# 프로젝트
GET    /api/teams/[teamId]/projects
POST   /api/teams/[teamId]/projects
GET    /api/teams/[teamId]/projects/[projectId]
PATCH  /api/teams/[teamId]/projects/[projectId]
DELETE /api/teams/[teamId]/projects/[projectId]

# 프로젝트 일정
GET    /api/teams/[teamId]/projects/[projectId]/schedules
POST   /api/teams/[teamId]/projects/[projectId]/schedules
GET    /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]
PATCH  /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]
DELETE /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]

# 세부 일정
GET    /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]/sub-schedules
POST   /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]/sub-schedules
GET    /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]/sub-schedules/[subId]
PATCH  /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]/sub-schedules/[subId]
DELETE /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]/sub-schedules/[subId]

# 자료실 (board) — 팀 일자별/프로젝트별 query param 으로 분기
GET    /api/teams/[teamId]/board                # ?projectId=<id> 옵션, 미지정 시 팀 일자별
POST   /api/teams/[teamId]/board                # multipart/form-data, projectId 필드 옵션
GET    /api/teams/[teamId]/board/[postId]
PATCH  /api/teams/[teamId]/board/[postId]       # multipart, 작성자만
DELETE /api/teams/[teamId]/board/[postId]       # 작성자만

# 첨부파일 다운로드 (StorageAdapter 분기)
GET    /api/files/[fileId]                      # Local: stream, S3: 302 redirect

# AI 버틀러 (SSE 스트리밍) — frontend BFF
POST   /api/ai-assistant/chat                   # 6-way intent + RAG/검색/일정 CRUD 분기
                                                #   usage / general / schedule_query
                                                #   schedule_create / schedule_update / schedule_delete / blocked
POST   /api/ai-assistant/execute                # confirm card 승인 후 도구 실행
                                                #   TOOL_WHITELIST = {createSchedule, updateSchedule, deleteSchedule}

# 음성 입력 STT (multipart → Whisper 컨테이너) — frontend BFF
POST   /api/stt                                 # MediaRecorder blob → Whisper :9000 → { text }
                                                #   브라우저 내장 Web Speech API 분기는 호출 없음
                                                #   (Galaxy/SM-XXXX/Samsung Internet/Firefox 만 이 endpoint 사용)
```

### DB 테이블/컬럼 네이밍

- 테이블명: snake_case 복수형: `users`, `teams`, `team_members`, `team_join_requests`, `schedules`, `chat_messages`
- 컬럼명: snake_case: `team_id`, `leader_id`, `created_by`, `start_at`, `end_at`, `sent_at`
- PK: `id` (UUID)
- FK: 참조 테이블 단수형 + `_id`: `team_id`, `user_id`, `sender_id`
- Enum 컬럼 값: UPPER_SNAKE_CASE: `LEADER`, `MEMBER`, `PENDING`, `APPROVED`, `REJECTED`, `NORMAL`, `WORK_PERFORMANCE`

---

## 4. 테스트 / 품질 원칙

### 테스트 전략 (1인 5일 MVP 기준)

과도한 테스트 커버리지 목표 설정 금지. 아래 최소 전략만 적용:

| 대상 | 방식 | 비고 |
|------|------|------|
| 인증 API | curl / Postman 수동 테스트 | 회원가입·로그인·토큰 갱신 |
| 권한 검증 로직 | curl로 403 응답 확인 | MEMBER의 일정 생성 시도 등 |
| DB 쿼리 함수 | 개발 중 console.log 확인 | 자동화 테스트 미적용 |
| UI | 브라우저 직접 확인 | 모바일/데스크탑 반응형 |
| E2E | Day 5에 주요 유스케이스 수동 시나리오 테스트 | UC-01~UC-07 흐름 |

단위 테스트 / 통합 테스트 자동화는 Post-MVP에서 적용.

### 린트 / 포맷

- ESLint: Next.js 기본 설정 (`eslint-config-next`) 사용
- Prettier: 기본값 사용 (세미콜론, 작은따옴표, trailing comma)
- TypeScript: `strict: true` 필수, `any` 사용 금지 (부득이한 경우 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 주석 명시)
- 커밋 전 `next build` 통과 필수

---

## 5. 설정 / 보안 / 운영 원칙

### 환경변수 관리

환경변수 파일은 **각 서비스 루트**에 분리하여 관리합니다. Docker Compose 운영 환경에서는 `docker-compose.yml` 의 `env_file:` 또는 `environment:` 블록을 통해 컨테이너로 주입합니다.

```bash
# backend/.env.local (로컬 개발 전용, .gitignore에 반드시 포함)
# 컨테이너 내부 → DB 호스트는 docker-compose 서비스명 'postgres-db'
DATABASE_URL=postgresql://teamworks-manager:Nts123%21%40%23@postgres-db:5432/teamworks
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# 자료실(board) 파일 저장 — StorageAdapter 토글
STORAGE_BACKEND=local                  # local | s3 (운영 클라우드 전환 시 s3)
STORAGE_LOCAL_DIR=/app/files           # backend 컨테이너 내부 경로. host의 ./files 와 mount
# STORAGE_S3_BUCKET=...                # s3 모드 전용
# STORAGE_S3_REGION=...
# STORAGE_S3_PRESIGN_TTL_SEC=300

# AI 버틀러 — Ollama / RAG / Open WebUI / SearxNG (모두 docker-compose 서비스명)
OLLAMA_BASE_URL=http://ollama:11434          # 채팅 모델용 (GPU)
OLLAMA_EMBED_URL=http://ollama-embed:11434   # 임베딩 모델용 (CPU 분리, docs/embeding-cpu.md)
OLLAMA_MODEL=gemma4:26b
OLLAMA_NUM_CTX=32768
RAG_BASE_URL=http://rag:8787
SEARXNG_BASE_URL=http://searxng:8080
OPEN_WEBUI_BASE_URL=http://open-webui:8080

# 음성 입력 STT — Whisper 컨테이너 (faster_whisper, CPU INT8 default)
WHISPER_URL=http://whisper:9000              # frontend BFF /api/stt 가 이 URL 로 multipart 전달
WHISPER_MODEL=small                          # small | medium | large-v3-turbo (VRAM/RAM 기준 선택)
WHISPER_ENGINE=faster_whisper                # 엔진 토글 (openai_whisper / faster_whisper)
```

```bash
# frontend/.env.local (로컬 개발 전용, .gitignore에 반드시 포함)
NEXT_PUBLIC_API_URL=http://localhost:3001   # 로컬 개발: 호스트에서 브라우저로 접근
# 프로덕션: 운영 도메인 (예: https://teamworks.example.com/api), nginx reverse proxy 경유
```

- `.env.local` 은 절대 git 에 커밋하지 않음
- `backend/.env.example`, `frontend/.env.example` 각각에 키 목록만 (값 없이) 커밋
- 환경변수 접근은 `process.env.VARIABLE_NAME` 으로만, 하드코딩 금지
- 프론트엔드에서 브라우저에 노출되어야 하는 환경변수는 반드시 `NEXT_PUBLIC_` 접두사 사용
- 운영 환경: 호스트의 `.env.production` 등을 `docker-compose.yml` `env_file` 로 주입. AWS Secrets Manager / GitHub Actions secrets 등으로 시크릿 관리

### JWT 처리 방식

- Access Token: 만료 15분, HTTP 요청 Authorization 헤더 (`Bearer <token>`)
- Refresh Token: 만료 7일, HttpOnly 쿠키로 저장
- 모든 API Route에서 Access Token 검증 미들웨어 통과 필수
- 토큰 검증 실패 시 401 반환, 권한 부족 시 403 반환
- 비밀번호는 bcrypt (saltRounds: 12) 해싱 필수

### pg 연결 풀 관리 (Docker Compose 단일 호스트 기준)

```typescript
// backend/lib/db/pool.ts
// Docker Compose 단일 호스트 운영 — backend 컨테이너는 long-running 프로세스이므로
// 글로벌 싱글턴 패턴 자체로 충분히 재사용. 운영 시 max 는 worker 수에 맞춰 조정.
import { Pool } from 'pg'

const globalForPg = global as unknown as { pgPool: Pool }

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,                         // 단일 backend 컨테이너 기준 (멀티 인스턴스 시 PgBouncer 권장)
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPool = pool
}
```

### Docker Compose 운영 시 주의사항

| 항목 | 주의 내용 |
|------|-----------|
| 서비스 간 호스트 이름 | 컨테이너에서 다른 서비스를 가리킬 때 항상 docker-compose 서비스명 사용 (`postgres-db`, `ollama`, `searxng`, `open-webui`, `rag`). `localhost` 금지 |
| 채팅 폴링 | TanStack Query `refetchInterval: 3000` 유지. 단, AI 버틀러는 SSE 직접 사용(컨테이너 내 long-lived connection 가능) |
| 영구 보존 데이터 | DB(`postgres_data`), 자료실 파일(`./files:/app/files`), Ollama 모델(`./ollama:/root/.ollama`) 모두 host volume mount 필수. anonymous volume 금지 |
| 로컬 파일 쓰기 | `STORAGE_BACKEND=local` 시 backend 컨테이너의 `/app/files` 에 쓰기. 운영 클라우드 전환 시 `STORAGE_BACKEND=s3` 로만 토글 (호출처 코드 0건 변경) |
| 컨테이너 재기동 정책 | `restart: unless-stopped` 권장. AI/RAG 워크로드 OOM 대비 host 메모리 여유 확보 |
| 헬스체크 | `postgres-db` `pg_isready`, `ollama` `/api/tags`, `backend` `/api/auth/me` (401 정상). docker-compose `healthcheck` + `depends_on.condition: service_healthy` 활용 |
| 자료실 파일 검증 | `request.formData()` 메모리 풀로딩 (Next.js 16 App Router). 10MB cap + Content-Length 사전 거부 + magic-bytes 사후 검증 필수 |

---

## 6. 최상위 디렉토리 구조

```
/ (프로젝트 루트)
├── docker-compose.yml          # 전체 컨테이너 오케스트레이션 (backend, frontend, postgres-db, ollama, rag, searxng, open-webui)
├── docker/                     # 컨테이너 빌드/구성 자산
│   ├── nginx.dev.conf          # 로컬 reverse proxy 구성 (frontend ↔ backend)
│   └── backend.Dockerfile      # backend 이미지 빌드 (frontend.Dockerfile 동일 패턴)
├── files/                      # 자료실 첨부파일 영구 저장 (host ↔ backend:/app/files mount). .gitignore
├── ollama/                     # Ollama 모델 캐시 영구 저장 (host ↔ ollama:/root/.ollama mount). .gitignore
├── rag/                        # RAG 서버 소스 (FastAPI/Express 기반, :8787)
│   ├── server.py               # /retrieve, /index 엔드포인트
│   ├── chunker.ts              # 문서 분할 정책
│   └── vectorstore/            # 벡터 인덱스 (Chroma/pgvector)
├── scripts/                    # 운영 스크립트
│   ├── backup-db.sh            # pg_dump 정기 백업
│   ├── backup-files.sh         # files/ rsync 백업
│   └── migrate-files-to-s3.ts  # 클라우드 전환 시 1회 실행 (idempotent)
├── backend/                    # 서버사이드: API Routes + 서버 전용 라이브러리
│   ├── Dockerfile              # backend 이미지 빌드 정의
│   ├── next.config.ts          # backend 전용 Next.js 설정
│   ├── tsconfig.json           # backend 전용 TypeScript 경로 매핑
│   ├── package.json            # backend 전용 의존성 (pg, jsonwebtoken, bcryptjs, swagger-ui-react 등)
│   └── .env.example            # backend 전용 환경변수 키 목록
├── frontend/                   # 클라이언트사이드: 페이지 · 컴포넌트 · 훅 · 스토어
│   ├── Dockerfile              # frontend 이미지 빌드 정의
│   ├── next.config.ts          # frontend 전용 Next.js 설정
│   ├── tsconfig.json           # frontend 전용 TypeScript 경로 매핑
│   ├── package.json            # frontend 전용 의존성 (React 19, TanStack Query 5, Zustand 5, Lucide React 등)
│   └── .env.example            # frontend 전용 환경변수 키 목록 (NEXT_PUBLIC_API_URL 등)
├── database/                   # 데이터베이스: DDL 스키마 + 증분 마이그레이션
└── docs/                       # 설계 문서 (1~19, 30 docker-container-gen)
```

> **Docker Compose 단일 호스트 운영 구조**
> `backend/`·`frontend/` 는 각각 독립 Next.js 프로젝트로 컨테이너 빌드 됨.
> 두 컨테이너 모두 `postgres-db` 컨테이너를 docker-compose 네트워크로 공유.
> 운영 환경 전환 시 `docker-compose.yml` 만으로 GPU 호스트 1대에 단일 호스트 배포 가능 (자세한 운영 절차는 docs/19-deploy-guide.md 참고).

> **Next.js 경로 설정 주의**
> Next.js App Router 는 `app/` 디렉토리를 루트 또는 `src/` 내에서만 인식.
> `backend/app/api/` 와 `frontend/app/` 을 Next.js 가 올바르게 인식하도록
> 각 서비스의 `next.config.ts` 및 `tsconfig.json` 의 `paths` alias 를 반드시 구성.

---

## 7. 프론트엔드 디렉토리 구조

```
frontend/
├── Dockerfile                         # 컨테이너 이미지 빌드 정의
├── next.config.ts                     # Next.js 설정 (Turbopack 활성)
├── tsconfig.json                      # TypeScript 경로 매핑
├── package.json                       # 의존성 (React 19, TanStack Query 5, Zustand 5, Lucide React, Tailwind CSS v4 등)
├── .env.example                       # 환경변수 키 목록 (NEXT_PUBLIC_API_URL 등)
├── vitest.config.ts                   # Vitest 테스트 설정
│
├── app/
│   ├── globals.css                    # Tailwind CSS v4 + 커스텀 컬러 시스템
│   ├── layout.tsx                     # 루트 레이아웃 (Providers 포함)
│   ├── api/                           # 프론트엔드 BFF 라우트 (AI 버틀러 SSE 프록시, STT 등)
│   │   ├── ai-assistant/
│   │   │   ├── chat/route.ts          # POST /api/ai-assistant/chat — SSE 스트리밍, 6-way intent 분기
│   │   │   │                          #   (usage / general / schedule_query / schedule_create
│   │   │   │                          #    schedule_update / schedule_delete / blocked)
│   │   │   │                          #   awaiting-input · pending-action 이벤트 처리
│   │   │   └── execute/route.ts       # POST /api/ai-assistant/execute — confirm card 승인 후
│   │   │                              #   TOOL_WHITELIST {createSchedule, updateSchedule, deleteSchedule}
│   │   └── stt/route.ts               # POST /api/stt — multipart 오디오 blob → Whisper :9000 → {text}
│   │                                  #   (Galaxy/SM-XXXX/Samsung Internet/Firefox 분기만 호출)
│   ├── (auth)/                        # 인증 불필요 라우트 그룹
│   │   ├── layout.tsx
│   │   ├── login/
│   │   │   └── page.tsx               # S-01 로그인 화면
│   │   └── signup/
│   │       └── page.tsx               # S-02 회원가입 화면
│   └── (main)/                        # 인증 필요 라우트 그룹
│       ├── layout.tsx                 # 인증 가드 레이아웃
│       ├── page.tsx                   # S-03 팀 목록 (홈)
│       ├── teams/
│       │   ├── new/
│       │   │   └── page.tsx           # 팀 생성
│       │   ├── explore/
│       │   │   └── page.tsx           # 팀 공개 목록 (탐색)
│       │   └── [teamId]/
│       │       ├── page.tsx           # S-05 팀 메인 (캘린더 + 채팅/AI 버틀러 + 프로젝트)
│       │       ├── __tests__/         # 팀 메인 페이지 테스트
│       │       ├── _components/       # 팀 페이지 전용 코-로케이션 컴포넌트
│       │       │   ├── CalendarSection.tsx   # 캘린더 + 포스트잇 영역
│       │       │   ├── PostitSection.tsx     # 포스트잇 패널
│       │       │   ├── TeamPageHeader.tsx    # 팀 헤더 (이름, 프로젝트 탭)
│       │       │   └── MobileLayout.tsx      # 모바일 레이아웃 분기 (teamName prop)
│       │       └── _hooks/            # 팀 페이지 전용 훅
│       │           ├── useScheduleActions.ts # 일정 생성/수정/삭제 핸들러
│       │           └── usePostitActions.ts   # 포스트잇 CRUD 핸들러
│       └── me/
│           └── tasks/
│               ├── page.tsx           # S-04C 나의 할 일
│               └── __tests__/
│
├── components/
│   ├── Providers.tsx                  # TanStack Query QueryClientProvider 래퍼
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   └── __tests__/
│   ├── team/
│   │   ├── TeamList.tsx
│   │   ├── TeamCard.tsx
│   │   ├── TeamCreateForm.tsx
│   │   ├── TeamExploreList.tsx        # 공개 팀 목록 카드
│   │   ├── JoinRequestActions.tsx     # 가입 신청 승인/거절 컴포넌트
│   │   └── __tests__/
│   ├── schedule/
│   │   ├── CalendarView.tsx           # 월/주/일 뷰 컨테이너
│   │   ├── CalendarMonthView.tsx
│   │   ├── CalendarWeekView.tsx
│   │   ├── CalendarDayView.tsx
│   │   ├── ScheduleForm.tsx
│   │   ├── ScheduleDetailModal.tsx
│   │   ├── ScheduleTooltip.tsx        # 일정 호버 툴팁
│   │   ├── PostItCard.tsx             # 포스트잇 카드 컴포넌트
│   │   ├── PostItColorPalette.tsx     # 포스트잇 색상 선택
│   │   └── __tests__/
│   ├── chat/
│   │   ├── ChatPanel.tsx              # 채팅/자료실 sub-tab + 팀 일자별/프로젝트별 분기
│   │   ├── ChatMessageList.tsx
│   │   ├── ChatMessageItem.tsx        # NORMAL/WORK_PERFORMANCE 시각적 구분
│   │   ├── ChatInput.tsx
│   │   ├── NoticeBanner.tsx           # 채팅 상단 고정 공지 배너 (projectId 격리)
│   │   ├── WorkPermissionModal.tsx    # 업무보고 조회 권한 설정 모달
│   │   ├── useChatPanel.ts            # 채팅 패널 로직 훅
│   │   └── __tests__/
│   ├── ai-assistant/                  # AI 찰떡이 — 단일 컴포넌트 + inline 서브 UI
│   │   ├── AIAssistantPanel.tsx       # 메인 패널 — 6-way intent SSE 핸들러, ConfirmCard·AwaitingInputForm·메시지 리스트 모두 inline 구현
│   │   │                              #   STT 마이크 버튼·캘린더 분할 화면·키보드 억제 책임 보유
│   │   │                              #   (분리 컴포넌트로 추출은 향후 리팩터링 시점에)
│   │   └── __tests__/
│   ├── board/                         # 자료실 (게시판) — 단일 컴포넌트 + inline 폼/상세
│   │   ├── BoardPanel.tsx             # 글 목록 + 등록·수정·삭제 액션·첨부 처리 모두 inline 구현
│   │   └── __tests__/
│   ├── project/
│   │   ├── ProjectGanttView.tsx       # 프로젝트 목록 + 간트차트 컨테이너
│   │   ├── GanttChart.tsx             # 간트차트 렌더러
│   │   ├── GanttBar.tsx               # 간트차트 바 단위
│   │   ├── SubBar.tsx                 # 세부 일정 바
│   │   ├── SubScheduleTimeline.tsx    # 세부 일정 타임라인
│   │   ├── ganttUtils.ts              # 날짜/위치 계산 유틸
│   │   ├── ProjectCreateModal.tsx     # 프로젝트 생성 모달
│   │   ├── ProjectScheduleModal.tsx   # 프로젝트 일정 생성/수정 모달
│   │   ├── ProjectScheduleDetailModal.tsx  # 프로젝트 일정 상세 모달
│   │   ├── SubScheduleCreateModal.tsx # 세부 일정 생성 모달
│   │   ├── SubScheduleDetailPopup.tsx # 세부 일정 상세 팝업
│   │   ├── useGanttModals.ts          # 간트차트 모달 상태 관리 훅
│   │   ├── useProjectActions.ts       # 프로젝트 CRUD 핸들러
│   │   ├── useScheduleActions.ts      # 프로젝트 일정 CRUD 핸들러
│   │   ├── useSubScheduleEditor.ts    # 세부 일정 편집 핸들러
│   │   └── __tests__/
│   └── common/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       ├── ResizableSplit.tsx         # 좌우 패널 리사이즈 컴포넌트
│       ├── ErrorBoundary.tsx
│       └── __tests__/
│
├── hooks/
│   ├── query/                         # TanStack Query 훅 (서버 상태)
│   │   ├── useAuth.ts
│   │   ├── useTeams.ts
│   │   ├── useSchedules.ts
│   │   ├── useMessages.ts             # 팀 일자별 채팅, refetchInterval 폴링 포함
│   │   ├── useProjectMessages.ts      # 프로젝트별 채팅 (projectId 격리)
│   │   ├── useBoard.ts                # 자료실 hooks (useBoardPosts/usePostDetail/useCreatePost…)
│   │                                  #   queryKey: ['board', teamId, projectId ?? '__team__']
│   │   ├── useJoinRequests.ts         # 가입 신청 조회/처리
│   │   ├── useMyTasks.ts              # 나의 할 일 (PENDING 신청 목록)
│   │   ├── usePostits.ts              # 포스트잇 CRUD
│   │   ├── useWorkPermissions.ts      # 업무보고 조회 권한 조회/수정
│   │   ├── useRemoveTeamMember.ts     # 팀원 강제 탈퇴
│   │   ├── useUpdateProfile.ts        # 내 프로필 수정
│   │   └── useUpdateJoinRequestFromTasks.ts  # 나의 할 일에서 가입 신청 처리
│   ├── useBreakpoint.ts               # 반응형 분기 훅 — isMobile(<640px) / isDesktop(>=1024px)
│   ├── useLeaderRole.ts               # 팀장 여부 확인 훅
│   ├── useSwipeGesture.ts             # 좌우/상하 swipe 감지 (threshold 50px). 캘린더 페이지 네비게이션용
│   ├── useSpeechRecognition.ts        # STT hybrid wrapper — UA 검사로 webspeech / whisper 자동 분기
│   │                                  #   Samsung Galaxy(SM-XXXX) / Samsung Internet / Web Speech 미지원
│   │                                  #   → whisper, 그 외 → webspeech
│   ├── useWebSpeechRecognition.ts     # 브라우저 내장 Web Speech API hook
│   │                                  #   continuous=false, lang=ko-KR, interimResults=true
│   │                                  #   confidence==0 무시(Android Chrome 중복 emit), cumulative 패턴 감지
│   ├── useWhisperRecognition.ts       # 자체 호스팅 Whisper hook
│   │                                  #   MediaRecorder → AudioContext VAD (1초 침묵) → POST /api/stt
│   └── __tests__/
│
├── store/                             # Zustand 스토어 (클라이언트 전역 상태)
│   ├── authStore.ts                   # 현재 로그인 유저, 토큰
│   ├── teamStore.ts                   # 선택된 팀, 선택된 날짜
│   ├── noticeStore.ts                 # 팀별 공지사항 목록 — (teamId, projectId?) scopeKey 격리
│   ├── projectStore.ts                # 선택된 프로젝트, 프로젝트 목록
│   ├── projectScheduleStore.ts        # 프로젝트 일정 목록
│   ├── subScheduleStore.ts            # 세부 일정 목록
│   └── __tests__/
│
├── types/
│   ├── auth.ts                        # User, LoginRequest, LoginResponse 등
│   ├── team.ts                        # Team, TeamMember, TeamJoinRequest 등
│   ├── schedule.ts                    # Schedule, CreateScheduleRequest 등
│   ├── chat.ts                        # ChatMessage, MessageType (NORMAL/WORK_PERFORMANCE) 등
│   ├── postit.ts                      # Postit, CreatePostitRequest 등
│   ├── project.ts                     # Project, ProjectSchedule, SubSchedule 등
│   ├── board.ts                       # BoardPost, BoardAttachment, CreatePostRequest 등
│   └── ai.ts                          # AssistantIntent, AssistantStreamEvent (token/awaiting-input/pending-action/done) 등
│
└── lib/
    ├── apiClient.ts                   # fetch 래퍼 (Authorization 헤더 자동 주입)
    ├── authInterceptor.ts             # 401 응답 시 토큰 자동 갱신 인터셉터
    ├── tokenManager.ts                # Access/Refresh Token 인메모리 관리
    ├── openWebUiModel.ts              # Open WebUI `/api/models` 동적 해석 (채팅 모델명 자동 감지)
    ├── api/                           # 도메인별 API 호출 모듈
    │   ├── noticeApi.ts               # 공지사항 API 함수 (projectId 옵션)
    │   ├── projectApi.ts              # 프로젝트/일정/세부일정 API 함수
    │   └── boardApi.ts                # 자료실 CRUD (multipart FormData 업로드)
    │                                  # ※ AI 버틀러 SSE 클라이언트는 별도 파일 없이
    │                                  #   `AIAssistantPanel.tsx` 안에 inline 으로 구현됨
    ├── mcp/                           # AI 버틀러 도구 (frontend BFF execute 가 호출)
    │   ├── pgClient.ts                # backend Schedule API 호출 래퍼 (READ 가드)
    │   └── scheduleQueries.ts         # createSchedule / updateSchedule / deleteSchedule 함수
    ├── utils/
    │   └── timezone.ts                # UTC ↔ KST 변환 (클라이언트용)
    └── __tests__/
```

> **프론트엔드 API 연결 주의**
> `frontend/lib/apiClient.ts` 에서 모든 API 요청의 base URL 은 `process.env.NEXT_PUBLIC_API_URL` 환경변수로 참조합니다.
> 로컬 개발 시 `frontend/.env.local`, 운영 환경에서는 nginx reverse proxy 또는 동일 도메인 운영 시 빈 문자열을 두어 상대 경로 사용.
> 예: `const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'`

---

## 8. 백엔드 디렉토리 구조

```
backend/
├── Dockerfile                         # 컨테이너 이미지 빌드 정의 (Node 22 Alpine)
├── next.config.ts                     # Next.js 16 설정 (Turbopack)
├── tsconfig.json                      # TypeScript 경로 매핑
├── package.json                       # 의존성 (pg, jsonwebtoken, bcryptjs, swagger-ui-react 등)
├── .env.example                       # 환경변수 키 목록 (DATABASE_URL, JWT_*, STORAGE_*, OLLAMA_*, RAG_* 등)
│
├── app/
│   ├── api-docs/
│   │   └── page.tsx                   # Swagger UI 페이지 (/api-docs, swagger-ui-react)
│   └── api/
│       ├── auth/
│       │   ├── signup/route.ts        # POST /api/auth/signup
│       │   ├── login/route.ts         # POST /api/auth/login (Access 15m + Refresh 7d HttpOnly cookie)
│       │   ├── refresh/route.ts       # POST /api/auth/refresh
│       │   ├── me/route.ts            # GET, PATCH /api/auth/me
│       │   └── auth.test.ts
│       ├── teams/
│       │   ├── route.ts               # GET, POST /api/teams
│       │   ├── public/route.ts        # GET /api/teams/public
│       │   ├── teams.test.ts
│       │   └── [teamId]/
│       │       ├── route.ts           # GET /api/teams/[teamId]
│       │       ├── join-requests/
│       │       │   ├── route.ts       # POST, GET /api/teams/[teamId]/join-requests
│       │       │   └── [requestId]/
│       │       │       └── route.ts   # PATCH /api/teams/[teamId]/join-requests/[requestId]
│       │       ├── members/
│       │       │   └── [userId]/
│       │       │       └── route.ts   # DELETE /api/teams/[teamId]/members/[userId]
│       │       ├── schedules/
│       │       │   ├── route.ts       # GET, POST /api/teams/[teamId]/schedules
│       │       │   ├── [scheduleId]/
│       │       │   │   └── route.ts   # GET, PATCH, DELETE
│       │       │   └── schedules.test.ts
│       │       ├── postits/
│       │       │   ├── route.ts       # GET, POST /api/teams/[teamId]/postits
│       │       │   └── [postitId]/
│       │       │       └── route.ts   # PATCH, DELETE
│       │       ├── messages/
│       │       │   ├── route.ts       # GET, POST /api/teams/[teamId]/messages (팀 일자별)
│       │       │   └── messages.test.ts
│       │       ├── notices/
│       │       │   ├── route.ts       # GET, POST /api/teams/[teamId]/notices (팀 일자별)
│       │       │   └── [noticeId]/
│       │       │       └── route.ts   # DELETE
│       │       ├── board/             # 자료실 — 팀 일자별·프로젝트별 query param projectId 분기
│       │       │   ├── route.ts       # GET ?projectId=, POST (multipart, projectId 옵션)
│       │       │   └── [postId]/
│       │       │       └── route.ts   # GET, PATCH (multipart, 작성자만), DELETE (작성자만 + unlink)
│       │       ├── work-permissions/
│       │       │   └── route.ts       # GET, PATCH /api/teams/[teamId]/work-permissions
│       │       └── projects/
│       │           ├── route.ts       # GET, POST /api/teams/[teamId]/projects
│       │           └── [projectId]/
│       │               ├── route.ts   # GET, PATCH, DELETE
│       │               ├── messages/
│       │               │   └── route.ts    # GET, POST (프로젝트별 채팅, projectId 격리)
│       │               ├── notices/
│       │               │   ├── route.ts    # GET, POST (프로젝트별 공지)
│       │               │   └── [noticeId]/
│       │               │       └── route.ts  # DELETE
│       │               └── schedules/
│       │                   ├── route.ts    # GET, POST
│       │                   └── [scheduleId]/
│       │                       ├── route.ts   # GET, PATCH, DELETE
│       │                       └── sub-schedules/
│       │                           ├── route.ts    # GET, POST
│       │                           └── [subId]/
│       │                               └── route.ts  # GET, PATCH, DELETE
│       ├── files/
│       │   └── [fileId]/route.ts      # GET — StorageAdapter download 결과로 분기:
│       │                              #   Local: stream + Content-Disposition: attachment + nosniff
│       │                              #   S3: 302 redirect to presigned URL
│       │                              #   호출자 팀 멤버십 검증 (attachment → post → team_id 조인)
│       └── me/
│           ├── route.ts               # GET /api/me
│           └── tasks/route.ts         # GET /api/me/tasks
│
├── swagger/
│   └── swagger.json                   # OpenAPI 명세 파일
│
└── lib/
    ├── db/
    │   ├── pool.ts                    # pg Pool 글로벌 싱글턴 (max: 10, Docker 단일 호스트 기준)
    │   └── queries/
    │       ├── userQueries.ts
    │       ├── teamQueries.ts
    │       ├── joinRequestQueries.ts  # 가입 신청 CRUD
    │       ├── scheduleQueries.ts
    │       ├── chatQueries.ts         # KST 날짜 그룹핑 + (teamId, projectId?) 격리
    │       ├── postitQueries.ts       # 포스트잇 CRUD
    │       ├── noticeQueries.ts       # 공지사항 CRUD + (teamId, projectId?) 격리
    │       ├── boardQueries.ts        # 자료실 글/첨부 CRUD (getPosts·getPostById·createPost·updatePost·deletePost·addAttachment·getAttachmentForDownload·removeAttachmentsByPost)
    │       ├── permissionQueries.ts   # 업무보고 조회 권한 조회/수정
    │       ├── projectQueries.ts      # 프로젝트 CRUD
    │       ├── projectScheduleQueries.ts  # 프로젝트 일정 CRUD
    │       └── subScheduleQueries.ts  # 세부 일정 CRUD
    ├── files/                         # 자료실 첨부파일 — StorageAdapter 추상화
    │   ├── storage.ts                 # StorageAdapter 인터페이스 + createStorageAdapter() factory
    │   │                              #   env STORAGE_BACKEND=local|s3 토글
    │   ├── localStorage.ts            # LocalStorageAdapter — host volume mount (UUID 파일명, fs.promises)
    │   ├── s3Storage.ts               # S3StorageAdapter (운영 전환 시 구현, 1단계는 placeholder throw)
    │   └── validate.ts                # MIME 화이트리스트 + 크기 cap(10MB) + magic-bytes 검증
    │                                  #   허용: jpg/png/gif/webp/pdf/docx/xlsx/pptx/txt/md/zip
    │
    │   # ⚠ 주의: AI 버틀러 로직은 backend 가 아닌 frontend BFF + frontend/lib/mcp/ 에 있음.
    │   # backend/lib/ai/ 디렉토리는 현재 코드에 존재하지 않으며, 향후 추가될 수도 있음.
    │   # 실제 위치 — frontend/lib/mcp/{pgClient,scheduleQueries}.ts +
    │   #              frontend/app/api/ai-assistant/{chat,execute}/route.ts
    ├── auth/
    │   ├── jwt.ts                     # Access/Refresh Token 발급·검증
    │   ├── jwt.test.ts
    │   ├── password.ts                # bcryptjs 해싱·검증
    │   └── password.test.ts
    ├── errors/
    │   └── databaseError.ts           # DB 에러 표준화 처리
    ├── middleware/
    │   ├── withAuth.ts                # JWT 검증 (401 처리)
    │   ├── withAuth.test.ts
    │   ├── withTeamRole.ts            # 팀 내 역할 검증 (403 처리)
    │   └── withTeamRole.test.ts
    └── utils/
        ├── apiResponse.ts             # 표준 응답 형식 헬퍼
        ├── apiResponse.test.ts
        ├── timezone.ts               # UTC ↔ KST 변환 (서버용)
        └── timezone.test.ts
```

> **Swagger UI 서빙 주의**
> `swagger/swagger.json` 은 backend 컨테이너 빌드 시 함께 포함됩니다. `app/api-docs/page.tsx` 가 swagger-ui-react 로 명세를 렌더.
> 운영 환경에서 외부 CDN 제약(인트라넷 등)이 있다면 `backend/public/swagger-ui/` 정적 자산으로 self-host.

> **AI 버틀러 호출 흐름**
> `POST /api/ai-assistant/chat` 은 frontend BFF route(`frontend/app/api/ai-assistant/chat/route.ts`)에서 받아 backend `lib/ai/*` 모듈을 거쳐 Ollama/RAG/SearxNG 컨테이너에 호출.
> intent 가 `schedule_create` 인 경우 `pending-action` SSE 이벤트로 confirm card 데이터를 내려보내고, 사용자 승인 후 `/api/ai-assistant/execute` 가 실제 일정 INSERT 수행.
> `blocked` 의도(SQL 변조·시스템 프롬프트 노출 등)는 즉시 차단 메시지 반환.

---

## 9. DB 디렉토리 구조

```
database/
├── schema.sql                     # 전체 테이블 DDL (초기 부트스트랩용 — users, teams, team_members,
│                                  #   team_join_requests, schedules, postits, chat_messages(+project_id),
│                                  #   notices(+project_id), work_permissions, projects, project_schedules,
│                                  #   sub_schedules, board_posts, board_attachments)
├── add-project-chat.sql           # 마이그레이션 — chat_messages 에 project_id 컬럼·인덱스 추가
├── add-project-notice.sql         # 마이그레이션 — notices 에 project_id 컬럼·인덱스 추가
└── add-board.sql                  # 마이그레이션 — board_posts + board_attachments 신규 (자료실)
```

> **운영 DB 마이그레이션 원칙**
> 운영 DB 에 적용하는 변경은 항상 `add-*.sql` 형태의 idempotent (`IF NOT EXISTS`) 증분 스크립트로 추가하고,
> `schema.sql` 은 같은 결과가 나오도록 동기 갱신. 이미 적용된 환경에서는 증분 스크립트만 실행.

---

## 10. Docker / AI / RAG 인프라

### docker-compose.yml — 핵심 서비스

| 서비스 | 컨테이너 이미지 | 호스트 노출 | 영구 mount | 비고 |
|--------|----------------|-------------|------------|------|
| `frontend` | 자체 빌드 (`frontend/Dockerfile`) | `:3000` | — | Next.js 16 (Turbopack) |
| `backend` | 자체 빌드 (`backend/Dockerfile`) | `:3001` | `./files:/app/files` | 자료실 첨부파일 영속 |
| `postgres-db` | `postgres:18-alpine` | `:5432` (개발 시) | `postgres_data:/var/lib/postgresql/data` | PostgreSQL 18 |
| `ollama` | `ollama/ollama:latest` | `:11434` (내부) | `./ollama:/root/.ollama` | gemma4:26b, nomic-embed-text |
| `rag` | 자체 빌드 (`rag/Dockerfile`) | `:8787` (내부) | `./rag/vectorstore:/app/vectorstore` | RAG 서버 (Express, `server.js`) |
| `searxng` | `searxng/searxng:latest` | `:8080` (내부) | `./searxng:/etc/searxng` | 메타 검색 |
| `open-webui` | `ghcr.io/open-webui/open-webui:main` | `:8081` (내부, 옵션) | `open_webui_data:/app/backend/data` | 관리자 콘솔 |
| `whisper` | `onerahmet/openai-whisper-asr-webservice:latest` | `:9000` (내부) | `whisper_cache:/root/.cache/whisper` | 음성 입력 STT. `faster_whisper` 엔진, CPU INT8 default. env `WHISPER_MODEL`(small/medium/large-v3-turbo), `WHISPER_ENGINE`. HF xet storage TLS 회피용 `HF_HUB_DISABLE_XET=1` 강제 |
| `nginx` (운영 시) | `nginx:alpine` | `:80`, `:443` | `./docker/nginx.conf:ro`, `./certbot/conf` | Let's Encrypt + reverse proxy |

### docker/ 디렉토리

```
docker/
├── nginx.dev.conf            # 로컬 개발용 reverse proxy (frontend ↔ backend)
├── nginx.conf                # 운영 reverse proxy (HTTPS + cert)
└── healthcheck.sh            # 컨테이너 헬스체크 공용 스크립트
```

### rag/ 디렉토리 (실제 구현)

```
rag/
├── Dockerfile
├── server.js                 # Express — POST /classify, /parse-schedule-args,
│                             #   /parse-schedule-query, /parse-schedule-update,
│                             #   /parse-schedule-delete, /chat (RAG SSE)
├── index.js                  # 인덱스 빌드 (1회) — chunks.json 생성
├── ask.js                    # CLI 검색 (개발용)
├── bm25.js                   # BM25 통계 계산
├── chunker.js                # ollama/*.md 문서 chunk 분할
├── modelResolver.js          # Open WebUI /api/models 로 채팅 모델명 자동 해석
├── config.js                 # SERVER_PORT(8787) 등 환경 설정
├── data/chunks.json          # 인덱스 산출물 (chunk + 임베딩 + BM25 + parents)
└── docs/                     # README 등
```

> **주의**: 이전 문서엔 `server.py`(FastAPI) 로 표기되어 있었으나, 실제 구현은 Node.js Express(`server.js`)임. 임베딩은 Ollama `/api/embed` 호출로 위임.

### 운영 전환 체크포인트
- `STORAGE_BACKEND=local` → `s3` 토글 시 `backend/lib/files/s3Storage.ts` 구현 + `scripts/migrate-files-to-s3.ts` 1회 실행. 호출처 코드 0건 변경.
- Ollama 모델은 첫 부팅 시 `ollama pull gemma4:26b` 와 `ollama pull nomic-embed-text` 자동 실행 (compose `entrypoint` 또는 init container).
- GPU 호스트 권장 사양은 `docs/19-deploy-guide.md` 참고 (NVIDIA RTX 4090 / A10 이상).

---

## 부록: 핵심 제약 요약

| 항목 | 결정 |
|------|------|
| 운영 형태 | Docker Compose 단일 호스트. Vercel 가정은 폐기됨 (1.9 갱신) |
| 실시간 채팅 | TanStack Query `refetchInterval: 3000` 폴링 유지 (단순성 우선) |
| AI 버틀러 스트리밍 | SSE 직접 사용 (컨테이너 내 long-lived connection 가능) |
| DB 클라이언트 | Prisma 미사용. `pg` 직접 + 글로벌 Pool 싱글턴 |
| 자료실 파일 저장 | StorageAdapter 추상화 — Local(host mount) ↔ S3 토글로 swap. 호출처 코드 변경 0 |
| 첨부파일 cap | 10MB, MIME 화이트리스트 + magic-bytes 검증, `Content-Disposition: attachment` 강제 |
| 추상화 수준 | 최소. Repository 패턴, DI 컨테이너 등 도입 금지 |
| 테스트 | 자동화 테스트 최소(jwt/withAuth/withTeamRole 등 핵심만). 수동 시나리오 테스트로 대체 |
| Docker 주의 | 서비스 간 호스트 이름은 항상 docker-compose 서비스명 사용. host volume mount 외부화 필수 |

---

## 관련 문서

| 문서 | 경로 |
|------|------|
| 도메인 정의서 | docs/1-domain-definition.md |
| PRD | docs/2-prd.md |
| 사용자 시나리오 | docs/3-user-scenarios.md |
| ERD | docs/6-erd.md |
| API 명세 | docs/7-api-spec.md |
| AI 버틀러 가이드 | docs/13-ai-butler-guide.md |
| MCP / 일정 자연어 처리 | docs/14-mcp-schedule-guide.md |
| RAG 파이프라인 가이드 | docs/15-rag-pipeline-guide.md |
| 4-way 의도 분류 가이드 | docs/16-intent-classification.md |
| 다중 턴 일정 등록 가이드 | docs/17-multi-turn-schedule.md |
| 자료실 가이드 | docs/18-board-guide.md |
| 운영 배포 가이드 | docs/19-deploy-guide.md |
| 배포 가이드 (STT 포함) | docs/20-easy-deploy.md |
| 음성 입력(STT) 가이드 | docs/22-voice-input.md |
| 임베딩 모델 CPU 분리 | docs/embeding-cpu.md |
| Docker 컨테이너 구성 가이드 | docs/30-docker-container-gen.md |
