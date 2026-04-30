# 자료실(게시판) 가이드 — 데이터 모델·첨부파일·보안

> 채팅방 sub-tab 으로 추가된 자료실 기능. 글쓰기·수정·삭제 + 첨부파일(최대 10MB).
> 스토리지는 환경변수 토글로 로컬↔클라우드 swap 가능 (운영 전환 대비).
> 관련: [`docs/16`](./16-mcp-server-plan.md), [`docs/17`](./17-ai-db-guide.md).

## 문서 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| 1.0 | 2026-04-29 | 최초 작성 — board_posts/board_attachments 데이터 모델, StorageAdapter 인터페이스, 첨부파일 검증 흐름, 클라우드 마이그레이션 |

---

## 1. 데이터 모델

```sql
board_posts (
  id          UUID PK,
  team_id     UUID NOT NULL  -- 채팅방의 팀 (격리 1차 키)
  project_id  UUID NULL      -- NULL → 팀 일자별, NOT NULL → 프로젝트 채팅방 (격리 2차 키)
  author_id   UUID NOT NULL  -- 작성자, 수정/삭제 권한 키
  title, content,
  created_at, updated_at
)

board_attachments (
  id            UUID PK,
  post_id       UUID NOT NULL → board_posts ON DELETE CASCADE
  original_name -- 사용자에게 보여줄 파일명
  stored_name   -- UUID + 확장자, 디스크/객체스토리지 식별자
  mime_type, size_bytes <= 10485760 (10MB)
)
```

격리 패턴은 `chat_messages` / `notices` 와 동일 — `project_id IS NULL` 으로 팀 채팅방, `project_id = ?` 로 프로젝트 채팅방 분리. 같은 코드 패턴 재사용.

## 2. Storage 추상화 — `backend/lib/files/`

```
storage.ts          ← StorageAdapter 인터페이스 + createStorageAdapter() 팩토리
localStorage.ts     ← LocalStorageAdapter (1단계 운영)
s3Storage.ts        ← S3StorageAdapter placeholder (운영 전환 시 구현)
validate.ts         ← MIME 화이트리스트 + magic bytes — 모든 어댑터 공통 사전 검증
```

### 인터페이스

```ts
interface StorageAdapter {
  save(buffer, opts): { storedName, sizeBytes }
  delete(storedName): void
  download(storedName, opts): { kind: 'stream'; body; ... } | { kind: 'redirect'; url }
}
```

`download` 가 두 형태 반환 — Local 은 stream(Backend 가 직접 응답), S3 는 redirect(presigned URL). 클라이언트는 항상 `/api/files/:fileId` 사용, backend 가 자동 분기.

### env 토글

| env | 값 | 설명 |
|---|---|---|
| `STORAGE_BACKEND` | `local` (default) / `s3` | 어댑터 선택 |
| `STORAGE_LOCAL_DIR` | `/app/files` (default) | LocalStorageAdapter 의 호스트 mount 디렉토리 |
| `STORAGE_S3_BUCKET` / `STORAGE_S3_REGION` / `STORAGE_S3_PRESIGN_TTL_SEC` | — | 운영 전환 시 |

## 3. 첨부파일 검증 파이프라인

`validate.ts` 의 `validateUpload(buffer, declaredMime, originalName)` 가 모든 어댑터 호출 전 적용:

1. **빈 파일·크기 cap** — `size === 0` 거부, `size > 10MB` 거부 (413).
2. **MIME 화이트리스트** — jpg/png/gif/webp/pdf/docx/xlsx/pptx/txt/md/zip 만. SVG 명시 제외 (XSS).
3. **Magic bytes** — 파일 첫 N byte 시그니처와 declared MIME 매치 검증. 확장자 위장 차단.
   - `0xFF 0xD8 0xFF` → JPEG
   - `0x89 PNG` → PNG
   - `%PDF` → PDF
   - `PK\x03\x04` → ZIP/docx/xlsx/pptx
   - `D0 CF 11 E0 ...` → 구형 OLE office
4. **텍스트 파일 sanity** — text/plain·text/markdown 은 magic 없으니 NUL 바이트 빈도로 binary 차단.

검증 실패 시 `ValidationError(status, message)` → 라우트가 그대로 반환.

## 4. 글 권한·격리

| 동작 | 권한 |
|---|---|
| 글 조회 | 팀 멤버 (backend `withTeamRole`) |
| 글 작성 | 팀 멤버 |
| 글 수정 | 작성자 본인만 (`UPDATE ... WHERE author_id = $userId` 강제) |
| 글 삭제 | 작성자 본인만 |
| 첨부 다운로드 | 첨부 → post → team_id 조인 후 사용자 멤버십 검증 |

타 팀 첨부 다운로드 시도 → 403. 작성자 외 PATCH/DELETE → 403.

## 5. 첨부 파일 라이프사이클

### 글 생성 + 첨부

1. multipart `request.formData()` 파싱.
2. `validateUpload` 통과.
3. `storage.save()` → `storedName` 반환.
4. DB INSERT board_posts + board_attachments. 실패 시 `storage.delete(storedName)` (best effort cleanup).

### 글 수정 (첨부 교체)

1. `UPDATE` 가 1 row 반환 시 작성자 검증 통과 → 본문 수정 적용.
2. 새 file 동봉 시 `removeAttachmentsByPost(postId)` → 기존 stored_name 들 받아 disk unlink.
3. 신규 파일 `storage.save()` + `addAttachment()` INSERT.

### 글 삭제

1. `DELETE FROM board_posts WHERE author_id = $userId` — 0 row 면 작성자 아님 → 403.
2. `board_attachments` 는 `ON DELETE CASCADE` 로 자동 row 정리.
3. backend 가 미리 가져온 stored_name 으로 `storage.delete()` — disk 파일 unlink.

## 6. 클라우드 마이그레이션 절차

운영 전환 시 단 4단계:

1. `backend/lib/files/s3Storage.ts` 의 `throw` 자리에 AWS SDK v3 호출 채움 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`).
2. env: `STORAGE_BACKEND=s3` + `STORAGE_S3_BUCKET=...` + region/IAM.
3. `scripts/migrate-files-to-s3.ts` 실행 — DB 의 모든 stored_name 을 `files/` → S3 PUT. idempotent (HEAD 후 skip).
4. backend 재기동. `docker-compose.yml` 의 `./files:/app/files` mount 제거.

**호출처 코드 변경 0** — `boardQueries.ts`, route handlers, frontend 는 그대로.

**롤백**: `STORAGE_BACKEND=local` 로 복귀 + `files/` 보존 (마이그레이션 스크립트가 origin 안 지움).

## 7. 운영 가이드

- **백업**: DB dump + `files/` rsync 같은 시점에 묶어 보관. 클라우드 전환 후 — S3 versioning + lifecycle.
- **권한**: 호스트 `chmod 755 files`. 컨테이너의 node user 가 쓰기 가능해야 함.
- **disk 가득 모니터**: 1단계 quota 없음. 운영 디스크 사용량 알람 권장. 후속 — 팀당 quota 도입.
- **악성 파일 antivirus**: 1단계 미적용. 후속 ClamAV 같은 검사기 통합 가능.

## 8. 검증 시나리오

- 단위
  - 11MB 파일 → 413
  - 확장자만 `.png` 인 실행파일 (magic bytes 미스매치) → 415
  - SVG 파일 → 415 (화이트리스트 외)
  - 다른 사용자 글 PATCH → 403
  - 다른 팀 사용자가 `/api/files/:fileId` 호출 → 403
- 통합
  - 글 + 첨부 등록 → DB row + `files/<uuid>.<ext>` 둘 다 존재
  - 글 삭제 → 둘 다 사라짐
  - 글 수정 (파일 교체) → 이전 파일 unlink + 신규 저장
  - backend 컨테이너 재기동 후 다운로드 정상 (volume mount)
- 격리
  - 팀 일자별 자료실 글 ↔ 프로젝트 자료실 글 안 보임
  - 프로젝트 A 의 글 ↔ 프로젝트 B 안 보임

## 9. 후속 (이번 phase 외)

- 다중 첨부 (DB 모델 1:N 그대로, UI 만 확장)
- 이미지 thumbnail inline preview
- 댓글 (`board_comments` 테이블 추가)
- 검색·페이지네이션
- nginx X-Accel-Redirect 직접 정적 서빙
- ClamAV antivirus 스캔
- 팀당 디스크 quota
