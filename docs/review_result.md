# Team CalTalk 문서 간 일관성 검토 결과

## 검토 개요

| 항목 | 내용 |
|------|------|
| 검토일 | 2026-04-08 |
| 검토 대상 | `docs/` 디렉토리 내 10개 문서 전체 |
| 발견 이슈 | 총 10건 (Critical 4, Warning 3, Minor 3) |
| 근본 원인 | 2026-04-08 `TeamInvitation → TeamJoinRequest` 변경 시 4개 문서 업데이트 누락 |

---

## 문서 버전 현황

| 문서 | 현재 버전 | 최종 수정일 | 상태 |
|------|-----------|-------------|------|
| `1-domain-definition.md` | 1.2 | 2026-04-08 | ✅ 갱신 완료 |
| `2-prd.md` | 1.1 | 2026-04-08 | ✅ 갱신 완료 |
| `3-user-scenarios.md` | 1.1 | 2026-04-08 | ✅ 갱신 완료 |
| `4-project-structure.md` | **1.0** | **2026-04-07** | 🔴 **미갱신** |
| `5-tech-arch-diagram.md` | **1.0** | **2026-04-07** | 🔴 **미갱신** |
| `6-erd.md` | 1.1 | 2026-04-08 | ✅ 갱신 완료 |
| `7-api-spec.md` | 1.1 | 2026-04-08 | ✅ 갱신 완료 |
| `8-execution-plan.md` | **1.0** | **2026-04-07** | 🔴 **미갱신** |
| `9-wireframes.md` | **1.0** | **2026-04-07** | 🔴 **미갱신** |
| `10-style-guide.md` | 1.0 | 2026-04-07 | ✅ 영향 없음 |

---

## 이슈 목록

### 🔴 Critical (4건)

---

#### C-01: `team_invitations` 잔존 — 프로젝트 구조, 아키텍처 다이어그램

| 항목 | 내용 |
|------|------|
| 관련 문서 | `4-project-structure.md`, `5-tech-arch-diagram.md` |
| 설명 | 프론트엔드/백엔드 디렉토리 구조, API 라우트, DB 쿼리 파일, 아키텍처 다이어그램 전부가 초대(`invitations`) 기반으로 되어 있음. 정작 도메인 정의서, ERD, API명세서는 `join_requests`로 변경 완료 |
| 영향 | 개발자가 잘못된 디렉토리/파일명으로 구현 시작 가능 |
| 수정 방향 | `4-project-structure.md`: `invitations` 관련 디렉토리·파일 전부를 `join-requests` 기반으로 교체. 신규 라우트(`app/api/teams/public`, `app/api/teams/[teamId]/join-requests`, `app/api/me/tasks`) 및 화면(`app/(main)/teams/explore`, `app/(main)/me/tasks`) 추가.<br>`5-tech-arch-diagram.md`: 다이어그램 4(프론트엔드), 5(백엔드)에서 `invitations` → `join-requests` 반영 |
| 세부 변경 사항 | **삭제 대상**: `app/api/teams/[teamId]/invitations/route.ts`, `app/api/invitations/[invitationId]/route.ts`, `app/(main)/invitations/[invitationId]/page.tsx`, `app/(main)/teams/[teamId]/invite/page.tsx`, `invitationQueries.ts`, `TeamInviteForm.tsx`, `InvitationStatus` enum<br>**추가 대상**: `app/api/teams/public/route.ts`, `app/api/teams/[teamId]/join-requests/route.ts`, `app/api/me/tasks/route.ts`, `app/(main)/teams/explore/page.tsx`, `app/(main)/me/tasks/page.tsx`, `joinRequestQueries.ts` |

---

#### C-02: S-04B, S-04C 와이어프레임 누락

| 항목 | 내용 |
|------|------|
| 관련 문서 | `9-wireframes.md` |
| 설명 | PRD(`2-prd.md` Section 8)와 도메인 정의서(`1-domain-definition.md`)에 정의된 **팀 공개 목록(S-04B, `/teams/explore`)**과 **나의 할 일(S-04C, `/me/tasks`)** 화면의 와이어프레임이 전혀 작성되지 않음. 대신 폐기된 S-07(팀원 초대), S-08(초대 수락/거절)이 전체 분량을 차지하고 있음 |
| 영향 | UI 개발자가 S-04B, S-04C 화면을 어떻게 만들어야 할지 명세 없음 |
| 수정 방향 | S-04B 와이어프레임 신규 작성 (공개 팀 목록 카드, 구성원 수, 가입 신청 버튼 포함)<br>S-04C 와이어프레임 신규 작성 (PENDING 신청 목록, 신청자 정보, 승인/거절 버튼)<br>S-07, S-08 삭제 또는 "폐기됨" 명시적 표시<br>화면 흐름도(Screen Flow)에서 S-07/S-08 제거, S-04B/S-04C 추가 |

---

#### C-03: 실행계획 전체가 초대 기반

| 항목 | 내용 |
|------|------|
| 관련 문서 | `8-execution-plan.md` |
| 설명 | DB, BE, FE, E2E **모든 레이어의 Task**가 `team_invitations` 기준으로 작성되어 있음. 2026-04-08 변경 사항이 전혀 반영되지 않음 |
| 영향 | 개발자가 이 계획대로 진행하면 완전히 잘못된 구현으로 이어짐 |
| 수정 방향 | 아래 표의 전 Task를 `join_requests` 기반으로 변경 |

**변경 대상 Task 일람:**

| Task | 파일/엔드포인트 | 현재 상태 (초대) | 변경 후 (가입 신청) |
|------|-----------------|------------------|---------------------|
| DB-03 | `db/schema.sql` | `team_invitations` 테이블 생성 | `team_join_requests` 테이블 생성 |
| DB-06 | `lib/db/queries/invitationQueries.ts` | `createInvitation`, `getInvitationById`, `updateInvitationStatus`, `getPendingInvitation` | `lib/db/queries/joinRequestQueries.ts`: `createJoinRequest`, `getJoinRequestById`, `updateJoinRequestStatus`, `getPendingJoinRequests` |
| BE-08~10 | `app/api/teams/[teamId]/invitations/route.ts` | `POST /api/teams/:teamId/invitations` | `POST /api/teams/:teamId/join-requests` |
| BE-08~10 | `app/api/invitations/[invitationId]/route.ts` | `GET, PATCH /api/invitations/:invitationId` | `GET, PATCH /api/teams/:teamId/join-requests/:requestId` |
| BE-08~10 | — | — | `GET /api/teams/public` 추가 |
| BE-08~10 | — | — | `GET /api/me/tasks` 추가 |
| FE-02 | `hooks/query/useInvitations.ts` | `useInvitations` 훅 | `hooks/query/useJoinRequests.ts`: `useJoinRequests` 훅 |
| FE-02 | — | — | `hooks/query/useTasks.ts`: `useMyTasks` 훅 추가 |
| FE-08 | `app/(main)/teams/[teamId]/invite/page.tsx` (S-07) | 팀원 초대 화면 | `app/(main)/teams/explore/page.tsx` (S-04B): 팀 공개 목록 화면 |
| FE-08 | `app/(main)/invitations/[invitationId]/page.tsx` (S-08) | 초대 수락/거절 화면 | `app/(main)/me/tasks/page.tsx` (S-04C): 나의 할 일 화면 |
| FE-11 | E2E 시나리오 | "SC-02/03: 팀 생성 → 팀원 초대 → 초대 수락 → 팀 합류" | "SC-02/SC-02B/SC-02C: 팀 생성 → 팀 탐색/가입 신청 → 팀장 승인 → 팀 합류" |

---

#### C-04: 일정 수정 HTTP 메서드 불일치 (PUT vs PATCH)

| 항목 | 내용 |
|------|------|
| 관련 문서 | `7-api-spec.md`, `3-user-scenarios.md`, `4-project-structure.md`, `8-execution-plan.md` |
| 설명 | 일정 수정 API의 HTTP 메서드가 문서마다 다름 |
| 상세 | |

| 문서 | 사용 메서드 | 비고 |
|------|-------------|------|
| `7-api-spec.md` (상세 정의) | `PUT` | "전달된 필드만 수정합니다" — 부분 수정 의미이나 PUT는 전체 교체 의미 |
| `7-api-spec.md` (요약 테이블) | `PUT` | — |
| `3-user-scenarios.md` (SC-06) | `PATCH` | — |
| `3-user-scenarios.md` (API 요약表) | `PATCH` | — |
| `4-project-structure.md` | `PUT` | — |
| `8-execution-plan.md` (BE-11) | `PUT` | — |

**권장 수정 방향:** "전달된 필드만 수정"이라는 명세에 맞게 **`PATCH`로 통일**할 것. `7-api-spec.md`, `4-project-structure.md`, `8-execution-plan.md`의 `PUT`를 `PATCH`로 변경.

---

### 🟡 Warning (3건)

---

#### W-01: 프로젝트 구조 — 신규 라우트 디렉토리 누락

| 항목 | 내용 |
|------|------|
| 관련 문서 | `4-project-structure.md` |
| 설명 | API 명세(`7-api-spec.md`)에 정의된 신규 엔드포인트에 해당하는 라우트 디렉토리가 구조도에 없음 |
| 누락된 프론트엔드 디렉토리 | `app/(main)/teams/explore/page.tsx` (S-04B), `app/(main)/me/tasks/page.tsx` (S-04C) |
| 누락된 백엔드 디렉토리 | `app/api/teams/public/route.ts`, `app/api/teams/[teamId]/join-requests/route.ts`, `app/api/me/tasks/route.ts` |
| 수정 방향 | Section 6(프론트엔드), Section 7(백엔드) 디렉토리 구조에 위 파일 추가 |

---

#### W-02: `team_members` 타임스탬프 컬럼명 불일치

| 항목 | 내용 |
|------|------|
| 관련 문서 | `8-execution-plan.md` (DB-03), `6-erd.md` (Section 2.3) |
| 설명 | `team_members` 테이블의 생성 일시 컬럼명이 문서마다 다름 |

| 문서 | 컬럼명 |
|------|--------|
| `8-execution-plan.md` (DB-03) | `joined_at` |
| `6-erd.md` (Section 2.3) | `created_at` |

**권장 수정 방향:** ERD 기준 `created_at`으로 통일 (다른 테이블들과 네이밍 일관성). `8-execution-plan.md`의 `joined_at`을 `created_at`으로 변경.

---

#### W-03: 4개 문서 버전 히스토리 미갱신

| 항목 | 내용 |
|------|------|
| 관련 문서 | `4-project-structure.md`, `5-tech-arch-diagram.md`, `8-execution-plan.md`, `9-wireframes.md` |
| 설명 | 2026-04-08 대대적 변경 시 4개 문서의 버전 히스토리가 v1.0 그대로임 |
| 수정 방향 | 각 문서의 "문서 이력" 테이블에 v1.1 행 추가. 변경 내용은 "TeamInvitation → TeamJoinRequest 반영, 관련 구조/화면/Task 갱신" |

---

### 🟢 Minor (3건)

---

#### M-01: 시나리오 번호 공백 (SC-03 결번)

| 항목 | 내용 |
|------|------|
| 관련 문서 | `3-user-scenarios.md` |
| 설명 | SC-02C 다음 시나리오가 SC-04로 바로 넘어감. 구 SC-03(초대 수락) 삭제 후 리넘버링하지 않음 |
| 영향 | 추적성(traceability)에서 혼란 가능 |
| 수정 방향 | 두 가지 옵션 중 선택:<br>1. SC-04~SC-09를 SC-03~SC-08로 리넘버링<br>2.SC-03 위치에 "(폐기 — 구 초대 수락 시나리오)" 명시적 표기 |

---

#### M-02: 일정 삭제 엔드포인트 사용자 시나리오 누락

| 항목 | 내용 |
|------|------|
| 관련 문서 | `3-user-scenarios.md`, `7-api-spec.md` |
| 설명 | `DELETE /api/teams/:teamId/schedules/:scheduleId`에 해당하는 독립 시나리오가 없음. SC-06(일정 수정)에 삭제 흐름이 포함되지 않음 |
| 영향 | E2E 테스트 시 삭제 흐름 누락 가능 |
| 수정 방향 | SC-06에 삭제 단계를 추가하거나, 별도 SC-XX(일정 삭제) 시나리오 추가 |

---

#### M-03: 와이어프레임 권한 표에 S-07/S-08 잔존

| 항목 | 내용 |
|------|------|
| 관련 문서 | `9-wireframes.md` |
| 설명 | 문서 말미 "권한별 UI 차이 종합 요약" 표에 S-07(팀원 초대), S-08(초대 수락) 관련 행이 남아있음 |
| 수정 방향 | S-07, S-08 행 삭제. 필요 시 S-04B, S-04C 행 추가 |

---

## 이슈 요약

| 심각도 | 건수 | 주요 내용 |
|--------|------|-----------|
| 🔴 Critical | 4 | (1) 4개 문서에 `team_invitations` 잔존, (2) S-04B/S-04C 와이어프레임 누락, (3) 실행계획 전체가 초대 기반, (4) 일정 수정 PUT vs PATCH 불일치 |
| 🟡 Warning | 3 | (1) 프로젝트 구조에 신규 라우트 누락, (2) `team_members` 컬럼명 불일치, (3) 4개 문서 버전 히스토리 미갱신 |
| 🟢 Minor | 3 | (1) SC-03 번호 공백, (2) 일정 삭제 시나리오 누락, (3) 와이어프레임 권한 표에 구 화면 잔존 |

---

## 수정 우선순위

| 순위 | 대상 문서 | 필요한 작업 |
|------|-----------|-------------|
| 1 | `8-execution-plan.md` | 모든 Task를 `join_requests` 기반으로 전면 수정, 버전 1.1로 갱신 |
| 2 | `9-wireframes.md` | S-04B, S-04C 와이어프레임 추가, S-07/S-08 삭제 또는 폐기 표시, 버전 1.1로 갱신 |
| 3 | `4-project-structure.md` | 디렉토리 구조에 join-request 관련 라우트 추가, invitations 관련 제거, 버전 1.1로 갱신 |
| 4 | `5-tech-arch-diagram.md` | 다이어그램 4, 5에서 invitations → join-requests 반영, 버전 1.1로 갱신 |
| 5 | `7-api-spec.md` | 일정 수정 메서드를 `PUT` → `PATCH`로 통일 |
| 6 | `3-user-scenarios.md` | SC-03 번호 공백 정리, DELETE 시나리오 추가 또는 SC-06에 통합 |
| 7 | `8-execution-plan.md` (재언급) | `team_members` 컬럼명 `joined_at` → `created_at`으로 수정 |
| 8 | `9-wireframes.md` (재언급) | 권한별 UI 차이 요약 표에서 S-07/S-08 행 제거, S-04B/S-04C 행 추가 |

---

## 관련 문서

| 문서 | 경로 |
|------|------|
| 도메인 정의서 | `docs/1-domain-definition.md` |
| PRD | `docs/2-prd.md` |
| 사용자 시나리오 | `docs/3-user-scenarios.md` |
| 프로젝트 구조 | `docs/4-project-structure.md` |
| 기술 아키텍처 | `docs/5-tech-arch-diagram.md` |
| ERD | `docs/6-erd.md` |
| API 명세서 | `docs/7-api-spec.md` |
| 실행계획 | `docs/8-execution-plan.md` |
| 와이어프레임 | `docs/9-wireframes.md` |
| 스타일 가이드 | `docs/10-style-guide.md` |
