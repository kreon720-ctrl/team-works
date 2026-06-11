# 26. 서비스 초기화 — 론칭 시점으로 리셋

데이터와 세션을 전부 비우고 **서비스 론칭 직후 상태**(빈 DB + 서비스 정상 가동)로 되돌리는 절차입니다.
개발/스테이징 환경 정리, 베타 테스트 후 클린 론칭, 데모 데이터 제거 등에 사용합니다.

> ⚠️ **되돌릴 수 없습니다.** 모든 사용자·팀·일정·프로젝트·채팅·자료실 파일이 삭제됩니다.
> 운영 데이터가 있다면 [0. 사전 백업](#0-사전-백업-선택)을 먼저 수행하세요.

---

## 무엇이 지워지고 무엇이 남나

| 구분 | 대상 | 초기화 | 비고 |
|---|---|---|---|
| DB 데이터 | users·teams·schedules·projects·chat·notices·board 등 전체 18 테이블 | ✅ 삭제 후 스키마 재생성 | `scripts/reset-dev.sh` |
| 로그인 세션 | 모든 access/refresh 토큰 | ✅ 전체 무효화 | JWT 시크릿 재생성 |
| 업로드 파일 | 자료실 첨부파일 `./files/` | ✅ 수동 삭제 필요 | reset-dev.sh 는 안 지움 |
| 앱 코드/스키마 | 테이블 구조·인덱스·제약 | ♻️ 재생성(동일 구조) | `database/` SQL |
| RAG 인덱스 | `rag/data/chunks.json` (docs 기반) | ⬜ 유지 | 사용자 데이터 아님 |
| Open WebUI | 관리자 계정·모델 선택 (`open_webui_data` 볼륨) | ⬜ 기본 유지 | [4단계](#4-선택--open-webui-상태-초기화)에서 선택적 초기화 |
| 인프라 | node_modules·whisper 캐시 볼륨 | ⬜ 유지 | — |

> **참고 — 론칭 상태의 정의:** 초기화 직후 DB는 완전히 비어 있습니다(팀 0·사용자 0).
> 이후 **첫 회원가입부터** 온보딩 로직이 가입자마다 "테스트팀"(샘플 일정·프로젝트 포함)을 자동 생성합니다 — 이것이 의도된 론칭 사용자 경험입니다.
> 데모용 `database/seed-dev.sql` 은 **적용하지 마세요**(개발용 가짜 데이터).

---

## 사전 조건

- Docker 컨테이너 `postgres-db` 가 실행 중 (`docker compose up -d db`)
- `backend/.env.local` 에 `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` 정의됨
- 저장소 루트에서 명령 실행

> 아래 `psql`/`pg_dump` 명령은 DB 비밀번호가 필요합니다. `docker-compose.yml` / `backend/.env.local` 의
> `POSTGRES_PASSWORD`(= `DATABASE_URL` 의 비밀번호)를 셸 변수로 한 번 지정해두면 편합니다:
> ```bash
> export PGPASSWORD='<backend/.env.local 의 DB 비밀번호>'
> ```
> (이 변수는 `docker exec -e PGPASSWORD=...` 로 컨테이너에 전달합니다.)

---

## 절차

### 0. 사전 백업 (선택)

운영/보존이 필요한 데이터가 있으면 먼저 백업합니다.

```bash
# DB 덤프
docker exec -e PGPASSWORD="$PGPASSWORD" postgres-db \
  pg_dump -U teamworks-manager -d teamworks > backup-$(date +%Y%m%d-%H%M%S).sql

# 업로드 파일 백업
tar czf files-backup-$(date +%Y%m%d-%H%M%S).tar.gz files/
```

### 1. DB + 토큰 초기화

`scripts/reset-dev.sh` 가 ① DB 전체 삭제 후 스키마 재생성, ② JWT 시크릿 재생성(전체 로그아웃)을 수행합니다.

```bash
bash scripts/reset-dev.sh
# 경고 확인 후 'yes' 입력
```

내부 동작:
- `database/reset-and-reapply.sql` → `add-postits.sql` → `add-board.sql` 순서로 적용 (코어 + 포스트잇 + 자료실 = 18 테이블)
- `backend/.env.local` 의 `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` 를 새 난수로 교체 → 기존 토큰 전부 무효

### 2. 업로드 파일 삭제

자료실 첨부파일은 DB와 별개로 호스트 `./files/` 에 저장됩니다. reset 스크립트가 지우지 않으므로 수동 삭제합니다.

```bash
# .gitkeep 만 남기고 첨부파일 전체 삭제
find files -type f ! -name '.gitkeep' -delete
```

### 3. 백엔드(프론트) 재시작

JWT 시크릿이 바뀌었으므로 **백엔드를 재시작**해야 새 시크릿이 적용됩니다.

```bash
docker compose up -d --force-recreate backend frontend
```

### 4. (선택) Open WebUI 상태 초기화

AI 비서의 웹검색·RAG 백엔드인 Open WebUI 의 관리자 계정·설정까지 초기화하려는 경우에만 수행합니다.
(보통은 인프라라 유지합니다. 초기화하면 첫 채팅 시 admin 재설정·모델 재선택이 필요합니다.)

```bash
docker compose stop open-webui
docker volume rm team-works_open_webui_data
docker compose up -d open-webui
```

### 5. 검증

```bash
# DB 비었는지 (0 이어야 함)
docker exec -e PGPASSWORD="$PGPASSWORD" postgres-db psql -U teamworks-manager -d teamworks \
  -tAc "select count(*) from users;"

# 테이블 18개 확인
docker exec -e PGPASSWORD="$PGPASSWORD" postgres-db psql -U teamworks-manager -d teamworks \
  -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"
```

브라우저에서 앱(`http://localhost:8080` 또는 운영 도메인)을 **새로고침** → 기존 세션이 자동 로그아웃됩니다.
새 계정으로 회원가입하면 "테스트팀"이 자동 생성되며 정상 동작을 확인할 수 있습니다.

---

## 빠른 실행 (복붙용)

```bash
export PGPASSWORD='<backend/.env.local 의 DB 비밀번호>'

# 0) (선택) 백업
docker exec -e PGPASSWORD="$PGPASSWORD" postgres-db pg_dump -U teamworks-manager -d teamworks > backup-$(date +%Y%m%d-%H%M%S).sql

# 1) DB + 토큰 초기화  (프롬프트에 yes 입력)
bash scripts/reset-dev.sh

# 2) 업로드 파일 삭제
find files -type f ! -name '.gitkeep' -delete

# 3) 백엔드/프론트 재시작 (JWT 반영)
docker compose up -d --force-recreate backend frontend

# 4) 검증 — users = 0, 테이블 = 18
docker exec -e PGPASSWORD="$PGPASSWORD" postgres-db psql -U teamworks-manager -d teamworks -tAc "select count(*) from users;"
```

---

## 주의 사항

- **운영 환경에서는 절대 가볍게 실행하지 마세요.** reset-dev.sh 는 확인 프롬프트(`yes`)가 있지만, DB 와 토큰은 복구 불가입니다.
- JWT 시크릿 재생성으로 **모든 사용자가 로그아웃**됩니다. 운영 중이라면 공지 후 진행하세요.
- `database/seed-dev.sql`(개발용 데모 데이터)은 론칭 리셋 시 **적용하지 않습니다**.
- 신규 셋업(빈 환경에서 한 번에 스키마 생성)만 필요하면 `database/schema.sql` 단일 파일을 적용하면 됩니다(DROP 없는 멱등 생성).
- AI 비서 기능을 쓰려면 호스트의 **Ollama(:11434)** 와 **RAG 서버(:8787)** 가 가동 중이어야 합니다(데이터 초기화 대상 아님 — `docs/13-RAG-pipeline-guide.md` 참고).

---

## 관련 문서

- `scripts/reset-dev.sh` — 초기화 스크립트
- `database/schema.sql` — 전체 스키마(단일 파일)
- `database/reset-and-reapply.sql` · `add-postits.sql` · `add-board.sql` — 리셋 적용 SQL
- [`docs/19-deploy-guide.md`](./19-deploy-guide.md) — 배포 가이드
- [`docs/13-RAG-pipeline-guide.md`](./13-RAG-pipeline-guide.md) — RAG/AI 서버
