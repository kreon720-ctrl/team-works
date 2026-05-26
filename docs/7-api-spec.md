# TEAM WORKS API 명세서

## 문서 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2026-04-07 | 최초 작성 |
| 1.1 | 2026-04-08 | 섹션 4(Invitations) 전면 제거 → 섹션 4(Join Requests)로 교체. GET /api/teams/public, POST /api/teams/:teamId/join-requests, GET /api/teams/:teamId/join-requests, PATCH /api/teams/:teamId/join-requests/:requestId, GET /api/me/tasks 추가. 엔드포인트 요약 테이블 갱신 |
| 1.2 | 2026-04-08 | POST /api/teams 비즈니스 규칙에서 잘못된 BR-03 참조 제거 (BR-01, FR-02-1 으로 수정) |
| 1.3 | 2026-04-18 | 앱명 Team CalTalk → TEAM WORKS 반영. 메시지 type WORK_PERFORMANCE → WORK_PERFORMANCE 변경 (실제 구현 반영). 섹션 7(업무보고 조회 권한) 추가: GET/PATCH /api/teams/:teamId/work-permissions |
| 1.4 | 2026-04-18 | 팀 응답에 description/isPublic 추가, 일정 응답에 color/creatorName 추가, 메시지 조회 쿼리파라미터 명확화, 일정 생성/수정/삭제 권한 실제 구현 반영, 포스트잇/인증/아키텍처 섹션 추가 |
| 1.5 | 2026-04-28 | 백엔드 구현 일치화: GET /api/auth/me, PATCH /api/me, PATCH/DELETE /api/teams/:teamId, DELETE /api/teams/:teamId/members/:userId, Notices/Postits/Projects/ProjectSchedules/SubSchedules 섹션 추가. 섹션 번호 재정렬 |
| 1.6 | 2026-04-29 | 신규: 프로젝트 채팅(§12), 프로젝트 공지(§13), 자료실 Board(§14), 파일 다운로드(§15). Messages/Notices 응답에 `projectId` 필드 추가 반영. AI 버틀러 SSE 참고 섹션(§16) 추가. 엔드포인트 요약 테이블 갱신. |
| 1.7 | 2026-04-30 | docs/1 v2.0 · docs/2 v1.6 동기화: §1 인증에 Refresh Token 7일 만료 + 갱신 실패 시 401 정책 명시. backend route 점검 — 프로젝트 일정/서브 일정 단건 GET 은 backend 미구현(PATCH·DELETE만)임을 §10 에 명시. swagger.json v1.7.1 동기 (없는 GET 2건 제거) |
| 1.8 | 2026-05-12 | backend route 정밀 재점검 결과 누락·오기 반영. **POST /api/teams** body 에 `description`(≤500자) · `isPublic`(boolean) 추가. **POST·PATCH /api/teams/:teamId/schedules** body 에 `color` 추가 (코드는 검증 없이 기본 `indigo` — 알려진 갭). **POST /api/teams/:teamId/projects** body 에 `progress`(0~100) · `manager`(≤100자) · `phases`(JSONB 배열) 명시. **POST /api/teams/:teamId/projects/:projectId/schedules** body 에 `phaseId`(UUID, nullable) 명시. **GET /api/teams/:teamId/messages** 쿼리에 `limit` · `before` 추가. **GET /api/me/tasks** 권한 표현 정정 — 인증 사용자 누구나 호출 가능, LEADER 외엔 빈 배열 반환. **§16 AI 버틀러** — 6-way 분류 + STT 엔드포인트(`POST /api/stt`, frontend BFF) 참조 추가. swagger.json v1.8.0 동기 (schedule CRUD 권한 description·403 메시지 정정, color 필드 보강, files 응답 헤더 명시) |
| 1.9 | 2026-05-16 | 카카오 소셜 인증 엔드포인트 추가 — `POST /api/auth/oauth/kakao/start`(인증 URL 발급, redirectAfter open-redirect 차단), `GET /api/auth/oauth/kakao/callback`(state 검증·code 교환·계정매칭·JWT fragment 302, baseUrl 해석 우선순위, error fragment 메시지표). 부록 요약 표 2행 추가 |

---

## 1. 공통 사항

### Base URL

```
/api
```

### 인증

로그인 후 발급된 Access Token을 모든 인증 필요 요청의 헤더에 포함합니다.

```
Authorization: Bearer <accessToken>
```

- Access Token 유효 기간: **15분** (`JWT_ACCESS_EXPIRES_IN`)
- Refresh Token 유효 기간: **7일** (`JWT_REFRESH_EXPIRES_IN`) — `POST /api/auth/login` 응답으로 함께 발급
- Access 만료 시 `POST /api/auth/refresh` 로 재발급. Refresh 도 만료/무효이면 `401 Unauthorized` → 클라이언트는 재로그인으로 유도

### 공통 에러 응답 형식

```json
{ "error": "에러 메시지" }
```

### 날짜 형식

- 모든 날짜/시각 값은 **ISO 8601 (UTC)** 형식으로 전송합니다.
- 예: `2026-04-07T09:00:00.000Z`
- DB 저장: UTC, API 응답: UTC (클라이언트에서 KST 변환 또는 서버 응답 시 KST 명시)
- 채팅 메시지 날짜 그룹핑은 `sentAt` 기준 **KST(UTC+9)** 날짜로 처리됩니다.
- 포스트잇·프로젝트·프로젝트 일정·서브 일정의 날짜 필드(`date`, `startDate`, `endDate`)는 시간 정보가 없는 **YYYY-MM-DD** 형식을 사용합니다.

### ID 형식

모든 ID는 **UUID v4** 형식입니다.

### 응답 필드 네이밍 컨벤션

- API 요청/응답 바디는 **camelCase** 를 사용합니다.
- DB 컬럼(snake_case)과 매핑하여 API 레이어에서 변환됩니다.

### HTTP 상태 코드 요약

| 코드 | 의미 |
|------|------|
| 200 | 성공 (조회, 수정) |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 (유효성 검증 실패) |
| 401 | 인증 실패 (토큰 없음 또는 만료) |
| 403 | 권한 없음 (역할 부족) |
| 404 | 리소스 없음 |
| 409 | 충돌 (중복 데이터) |
| 500 | 서버 내부 오류 |

---

## 2. Auth (인증)

---

### POST /api/auth/signup

**설명**: 신규 사용자 회원가입. 계정 생성 후 Access Token과 Refresh Token을 발급합니다.
**인증**: 불필요
**권한**: 없음

**Request**

- Headers: 없음
- Body:

```json
{
  "email": "user@example.com",
  "name": "홍길동",
  "password": "password1234"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| email | string | O | 이메일 형식, 최대 255자 |
| name | string | O | 표시 이름, 최대 50자 |
| password | string | O | 평문 비밀번호 (서버에서 bcrypt 해싱) |

**Response**

- 성공: `201 Created`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "name": "홍길동"
  }
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "이메일 형식이 올바르지 않습니다." | 이메일 유효성 검증 실패 |
| 400 | "이름은 최대 50자까지 입력 가능합니다." | name 길이 초과 |
| 400 | "필수 입력 항목이 누락되었습니다." | email, name, password 중 하나 이상 누락 |
| 409 | "이미 사용 중인 이메일입니다." | 이메일 중복 (FR-01-2) |

**비즈니스 규칙**: FR-01-1, FR-01-2, FR-01-4

---

### POST /api/auth/login

**설명**: 이메일과 비밀번호로 로그인하여 Access Token과 Refresh Token을 발급합니다.
**인증**: 불필요
**권한**: 없음

**Request**

- Headers: 없음
- Body:

```json
{
  "email": "user@example.com",
  "password": "password1234"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| email | string | O | 가입된 이메일 |
| password | string | O | 평문 비밀번호 |

**Response**

- 성공: `200 OK`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "name": "홍길동"
  }
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "필수 입력 항목이 누락되었습니다." | email 또는 password 누락 |
| 401 | "이메일 또는 비밀번호가 올바르지 않습니다." | 미가입 이메일 또는 비밀번호 불일치 |

**비즈니스 규칙**: BR-01, FR-01-3

---

### POST /api/auth/refresh

**설명**: Refresh Token을 이용해 만료된 Access Token을 재발급합니다.
**인증**: 불필요 (Refresh Token을 바디로 전달)
**권한**: 없음

**Request**

- Headers: 없음
- Body:

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| refreshToken | string | O | 로그인 또는 이전 refresh 시 발급받은 Refresh Token |

**Response**

- 성공: `200 OK`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "refreshToken이 누락되었습니다." | 바디에 refreshToken 없음 |
| 401 | "유효하지 않거나 만료된 Refresh Token입니다." | 토큰 검증 실패 또는 만료 |

**비즈니스 규칙**: FR-01-6

---

### POST /api/auth/oauth/kakao/start

**설명**: 카카오 OAuth 2.0(OIDC) 인증 URL을 발급합니다. CSRF 방지용 `state` 와 PKCE `code_verifier` 를 서버(`oauth_state`)에 저장하고, 클라이언트는 응답 `url` 로 `location` 이동합니다.
**인증**: 불필요
**권한**: 없음

**Request**

- Headers: 없음
- Body (선택):

```json
{
  "redirectAfter": "/teams/abc"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| redirectAfter | string | X | 로그인 후 복귀할 자도메인 절대경로(`/`로 시작, `//` 불가). 외부 URL 은 무시(open-redirect 차단) |

**Response**

- 성공: `200 OK`

```json
{
  "url": "https://kauth.kakao.com/oauth/authorize?client_id=...&response_type=code&scope=openid%20account_email%20profile_nickname%20profile_image&state=...&code_challenge=...&code_challenge_method=S256"
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 500 | "카카오 로그인 시작 중 오류가 발생했습니다." | state 저장 실패 / 환경변수(KAKAO_CLIENT_ID 등) 누락 |

**비즈니스 규칙**: BR-24, FR-01-7

---

### GET /api/auth/oauth/kakao/callback

**설명**: 카카오 인증 후 콜백. ① `state` 검증·1회 소비 → ② `code` + `code_verifier` 로 access_token 교환 → ③ 카카오 사용자 정보 조회 → ④ 계정 매칭/생성 → ⑤ 우리 JWT 발급 후 `/auth/oauth/success` 로 **302 redirect**. 토큰·사용자·에러는 URL **fragment(#)** 로 전달(서버 로그·Referer 노출 차단).
**인증**: 불필요 (카카오가 호출)
**권한**: 없음

**Request**

- Query: `code` (필수), `state` (필수), `error` (카카오가 거부 시)

**Response**

- 성공: `302 Found` → `Location: {baseUrl}/auth/oauth/success#accessToken=...&refreshToken=...&user={"id","email","name"}&redirectAfter=...`
- 실패: `302 Found` → `Location: {baseUrl}/auth/oauth/success#error=<사용자 친화 메시지>`

| error fragment 메시지 | 원인 |
|-----------------------|------|
| "카카오 로그인 거부: ..." | 사용자가 카카오 동의 거부 (`error` 쿼리) |
| "잘못된 콜백 요청입니다." | `code` 또는 `state` 누락 |
| "인증 세션이 만료되었거나 유효하지 않습니다. 다시 시도해주세요." | `oauth_state` 미발견 (TTL 만료/위조) |
| "카카오 계정 이메일 동의가 필요합니다. ..." | 이메일 미동의(`email_required`) — 가입 거절 |
| "서버 내부 오류가 발생했습니다." | token 교환/사용자 조회 실패 등 |

> **baseUrl 해석 우선순위**: `PUBLIC_BASE_URL` → `X-Forwarded-Host`+`X-Forwarded-Proto` → `Host` → `request.nextUrl.origin` (nginx 리버스 프록시 뒤 backend 컨테이너 host 오인 방지).
>
> **계정 매칭 규칙**: ① `provider_user_id` 매칭 → 기존 계정 로그인, ② 미매칭 + 동일 이메일 User 존재 → 자동 연결, ③ 미매칭 + 신규 이메일 → User 생성(`password_hash=NULL`), ④ 이메일 미제공 → `email_required` 거절.

**비즈니스 규칙**: BR-24, FR-01-7, FR-01-8, FR-01-9, FR-01-10

---

### GET /api/auth/me

**설명**: 현재 Access Token에 대응하는 로그인 사용자의 기본 정보를 반환합니다. 클라이언트 부팅 시 세션 복구·표시 이름 동기화 용도로 사용됩니다.
**인증**: 필요
**권한**: 없음 (모든 인증 사용자)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path/Query/Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "user@example.com",
  "name": "홍길동"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 사용자 UUID |
| email | string | 가입 이메일 |
| name | string | 표시 이름 |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Authorization 헤더 없음 |
| 401 | "유효하지 않은 토큰입니다." | Access Token 검증 실패 |
| 404 | "사용자를 찾을 수 없습니다." | 토큰의 userId가 DB에 없음(탈퇴 등) |

---

## 3. Profile (내 정보)

---

### PATCH /api/me

**설명**: 로그인 사용자의 프로필을 수정합니다. 현재는 표시 이름(`name`) 변경만 지원합니다.
**인증**: 필요
**권한**: 없음 (본인 프로필 한정)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Body:

```json
{
  "name": "홍길동"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | string | O | 새 표시 이름. 양 끝 공백은 trim 처리, 최대 50자 |

**Response**

- 성공: `200 OK`

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "user@example.com",
  "name": "홍길동"
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "이름은 필수입니다." | name 누락 또는 공백만 입력 |
| 400 | "이름은 최대 50자까지 입력 가능합니다." | trim 후 50자 초과 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 404 | "사용자를 찾을 수 없습니다." | 토큰의 userId에 해당하는 사용자 부재 |

---

## 4. Teams (팀 관리)

---

### GET /api/teams

**설명**: 현재 로그인한 사용자가 속한 팀 목록을 조회합니다. 공개 탐색용 전체 팀 목록은 `GET /api/teams/public`을 사용합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters: 없음
- Query Parameters: 없음
- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "teams": [
    {
      "id": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "name": "개발팀",
      "description": "백엔드·프론트엔드 개발팀",
      "leaderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "isPublic": true,
      "myRole": "LEADER",
      "createdAt": "2026-04-01T00:00:00.000Z"
    },
    {
      "id": "c2d3e4f5-a6b7-8901-cdef-ab2345678901",
      "name": "디자인팀",
      "description": null,
      "leaderId": "d4e5f6a7-b8c9-0123-defa-bc3456789012",
      "isPublic": false,
      "myRole": "MEMBER",
      "createdAt": "2026-04-03T00:00:00.000Z"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 팀 UUID |
| name | string | 팀 이름 |
| description | string \| null | 팀 설명 (nullable) |
| leaderId | string | 팀장 사용자 UUID |
| isPublic | boolean | 공개 팀 목록 노출 여부 |
| myRole | string | 요청자의 해당 팀 역할 (`LEADER` 또는 `MEMBER`) |
| createdAt | string | 팀 생성 일시 (UTC ISO 8601) |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |

**비즈니스 규칙**: BR-01, BR-06, FR-02-9

---

### POST /api/teams

**설명**: 새 팀을 생성합니다. 생성자는 자동으로 해당 팀의 LEADER로 등록됩니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (누구든 팀 생성 가능, 생성 시 LEADER 역할 부여)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Body:

```json
{
  "name": "개발팀",
  "description": "백엔드·프론트엔드 개발팀",
  "isPublic": true
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | string | O | 팀 이름, 최대 100자 |
| description | string | X | 팀 설명, 최대 500자. 생략 또는 빈 문자열이면 null 저장 |
| isPublic | boolean | X | 공개 팀 목록 노출 여부. 기본 `false`. true 면 `/api/teams/public` 에 노출되어 가입 신청 가능 |

**Response**

- 성공: `201 Created`

```json
{
  "id": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "name": "개발팀",
  "description": "백엔드·프론트엔드 개발팀",
  "leaderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "isPublic": true,
  "myRole": "LEADER",
  "createdAt": "2026-04-07T09:00:00.000Z"
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "팀 이름은 필수입니다." | name 누락 |
| 400 | "팀 이름은 최대 100자까지 입력 가능합니다." | name 길이 초과 |
| 400 | "팀 설명은 최대 500자까지 입력 가능합니다." | description 길이 초과 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |

**비즈니스 규칙**: BR-01, FR-02-1

---

### GET /api/teams/public

**설명**: 로그인한 모든 사용자가 가입을 고려하기 위해 전체 공개 팀 목록을 조회합니다. 각 팀의 현재 구성원 수를 포함합니다. 팀명 오름차순으로 정렬되며 최대 100개까지 반환합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (로그인한 모든 사용자)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters: 없음
- Query Parameters: 없음
- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "teams": [
    {
      "id": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "name": "개발팀",
      "leaderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "leaderName": "홍길동",
      "memberCount": 5,
      "createdAt": "2026-04-01T00:00:00.000Z"
    },
    {
      "id": "c2d3e4f5-a6b7-8901-cdef-ab2345678901",
      "name": "디자인팀",
      "leaderId": "d4e5f6a7-b8c9-0123-defa-bc3456789012",
      "leaderName": "이영희",
      "memberCount": 3,
      "createdAt": "2026-04-03T00:00:00.000Z"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 팀 UUID |
| name | string | 팀 이름 |
| leaderId | string | 팀장 사용자 UUID |
| leaderName | string | 팀장 표시 이름 |
| memberCount | number | 현재 팀 구성원 수 (LEADER + MEMBER 합산) |
| createdAt | string | 팀 생성 일시 (UTC ISO 8601) |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |

**비즈니스 규칙**: BR-01, BR-07, FR-02-2

---

### GET /api/teams/:teamId

**설명**: 특정 팀의 상세 정보를 조회합니다. 해당 팀의 구성원만 접근 가능합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (해당 팀 소속 구성원)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 조회할 팀의 UUID |

- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "id": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "name": "개발팀",
  "description": "백엔드·프론트엔드 개발팀",
  "leaderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "isPublic": true,
  "myRole": "LEADER",
  "createdAt": "2026-04-01T00:00:00.000Z",
  "members": [
    {
      "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "홍길동",
      "email": "leader@example.com",
      "role": "LEADER",
      "joinedAt": "2026-04-01T00:00:00.000Z"
    },
    {
      "userId": "d4e5f6a7-b8c9-0123-defa-bc3456789012",
      "name": "김철수",
      "email": "member@example.com",
      "role": "MEMBER",
      "joinedAt": "2026-04-02T00:00:00.000Z"
    }
  ]
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |

**비즈니스 규칙**: BR-01, BR-06

---

### PATCH /api/teams/:teamId

**설명**: 팀의 기본 정보를 수정합니다. 전달된 필드만 부분 갱신되며, 팀장만 호출할 수 있습니다.
**인증**: 필요
**권한**: LEADER만

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 수정할 팀의 UUID |

- Body:

```json
{
  "name": "개발팀 (리브랜딩)",
  "description": "백엔드·프론트엔드 통합 개발팀",
  "isPublic": false
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | string | X | 팀 이름 (최대 100자) |
| description | string \| null | X | 팀 설명 |
| isPublic | boolean | X | 공개 팀 목록 노출 여부 |

> 최소 1개 이상의 필드를 포함해야 합니다.

**Response**

- 성공: `200 OK`

```json
{
  "id": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "name": "개발팀 (리브랜딩)",
  "description": "백엔드·프론트엔드 통합 개발팀",
  "isPublic": false,
  "leaderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "createdAt": "2026-04-01T00:00:00.000Z"
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "팀장만 접근할 수 있습니다." | 요청자가 해당 팀의 LEADER가 아님 |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |
| 500 | "팀 수정에 실패했습니다." | DB 갱신 실패 |

**비즈니스 규칙**: BR-01, BR-03

---

### DELETE /api/teams/:teamId

**설명**: 팀을 삭제합니다. 팀에 종속된 모든 데이터(구성원·일정·메시지·공지·포스트잇·프로젝트 등)는 DB 외래키 정책(`ON DELETE CASCADE`)에 따라 함께 정리됩니다.
**인증**: 필요
**권한**: LEADER만

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 삭제할 팀의 UUID |

- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "message": "팀이 삭제되었습니다."
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "팀장만 접근할 수 있습니다." | 요청자가 해당 팀의 LEADER가 아님 |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |
| 500 | "팀 삭제에 실패했습니다." | DB 삭제 실패 |

**비즈니스 규칙**: BR-01, BR-03

---

### DELETE /api/teams/:teamId/members/:userId

**설명**: 팀장이 특정 팀원을 강제 탈퇴 처리합니다. 팀장 본인은 제거할 수 없습니다.
**인증**: 필요
**권한**: LEADER만

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| userId | string (UUID) | 탈퇴 처리할 팀원의 사용자 UUID |

- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "message": "팀원이 탈퇴 처리되었습니다."
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "팀장은 탈퇴시킬 수 없습니다." | 대상 userId가 팀의 leader_id 와 동일 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "팀장만 접근할 수 있습니다." | 요청자가 해당 팀의 LEADER가 아님 |
| 404 | "해당 팀원을 찾을 수 없습니다." | userId가 해당 팀의 멤버가 아님 |

**비즈니스 규칙**: BR-01, BR-03

---

## 5. Join Requests (팀 가입 신청)

---

### POST /api/teams/:teamId/join-requests

**설명**: 로그인한 사용자가 특정 팀에 가입 신청을 제출합니다. `TeamJoinRequest` 레코드를 `PENDING` 상태로 생성하며, 해당 팀 팀장의 나의 할 일 목록에 자동으로 표시됩니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (로그인한 모든 사용자, 단 해당 팀의 구성원이 아닌 경우에 한함)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 가입 신청할 팀의 UUID |

- Body: 없음 (신청자는 인증 토큰에서 추출)

**Response**

- 성공: `201 Created`

```json
{
  "id": "e5f6a7b8-c9d0-1234-efab-cd5678901234",
  "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "teamName": "개발팀",
  "requesterId": "d4e5f6a7-b8c9-0123-defa-bc3456789012",
  "status": "PENDING",
  "requestedAt": "2026-04-08T09:00:00.000Z",
  "respondedAt": null
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 가입 신청 UUID |
| teamId | string | 신청 대상 팀 UUID |
| teamName | string | 신청 대상 팀 이름 |
| requesterId | string | 신청자 사용자 UUID |
| status | string | 신청 상태: 항상 `PENDING` |
| requestedAt | string | 신청 일시 (UTC ISO 8601) |
| respondedAt | string \| null | 응답 일시. 신청 직후 `null` |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |
| 409 | "이미 해당 팀의 구성원입니다." | 요청자가 이미 team_members에 존재 (FR-02-4) |
| 409 | "이미 가입 신청이 진행 중입니다." | 동일 팀에 동일 사용자의 PENDING 신청이 이미 존재 (FR-02-5) |

**비즈니스 규칙**: BR-01, BR-07, FR-02-3, FR-02-4, FR-02-5

---

### GET /api/teams/:teamId/join-requests

**설명**: 특정 팀의 PENDING 상태 가입 신청 목록을 조회합니다. 팀장(LEADER)만 접근할 수 있으며, 나의 할 일 화면에서 팀별로 신청을 확인하는 용도로 사용됩니다.
**인증**: 필요
**권한**: LEADER만 (해당 팀의 팀장)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 조회할 팀의 UUID |

- Query Parameters: 없음
- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "teamName": "개발팀",
  "joinRequests": [
    {
      "id": "e5f6a7b8-c9d0-1234-efab-cd5678901234",
      "requesterId": "d4e5f6a7-b8c9-0123-defa-bc3456789012",
      "requesterName": "김철수",
      "requesterEmail": "kimcs@example.com",
      "status": "PENDING",
      "requestedAt": "2026-04-08T09:00:00.000Z",
      "respondedAt": null
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| teamId | string | 팀 UUID |
| teamName | string | 팀 이름 |
| joinRequests | array | PENDING 상태 가입 신청 배열 (`requestedAt` 오름차순 정렬) |
| joinRequests[].id | string | 가입 신청 UUID |
| joinRequests[].requesterId | string | 신청자 UUID |
| joinRequests[].requesterName | string | 신청자 표시 이름 |
| joinRequests[].requesterEmail | string | 신청자 이메일 |
| joinRequests[].status | string | 신청 상태: `PENDING` |
| joinRequests[].requestedAt | string | 신청 일시 (UTC ISO 8601) |
| joinRequests[].respondedAt | string \| null | 응답 일시. PENDING 상태에서 항상 `null` |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "팀장만 가입 신청 목록을 조회할 수 있습니다." | 요청자의 역할이 MEMBER 또는 해당 팀 구성원이 아님 |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |

**비즈니스 규칙**: BR-01, BR-03, FR-02-6

---

### PATCH /api/teams/:teamId/join-requests/:requestId

**설명**: 팀장이 PENDING 상태의 가입 신청을 승인(APPROVE) 또는 거절(REJECT)합니다. 승인 시 `team_members`에 MEMBER로 원자적 등록되고 `status`가 `APPROVED`로 갱신됩니다.
**인증**: 필요
**권한**: LEADER만 (해당 팀의 팀장)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| requestId | string (UUID) | 처리할 가입 신청 UUID |

- Body:

```json
{
  "action": "APPROVE"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| action | string | O | `APPROVE` 또는 `REJECT` |

**Response**

- 성공 (승인): `200 OK`

```json
{
  "id": "e5f6a7b8-c9d0-1234-efab-cd5678901234",
  "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "teamName": "개발팀",
  "requesterId": "d4e5f6a7-b8c9-0123-defa-bc3456789012",
  "requesterName": "김철수",
  "status": "APPROVED",
  "requestedAt": "2026-04-08T09:00:00.000Z",
  "respondedAt": "2026-04-08T09:10:00.000Z"
}
```

- 성공 (거절): `200 OK`

```json
{
  "id": "e5f6a7b8-c9d0-1234-efab-cd5678901234",
  "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "teamName": "개발팀",
  "requesterId": "d4e5f6a7-b8c9-0123-defa-bc3456789012",
  "requesterName": "김철수",
  "status": "REJECTED",
  "requestedAt": "2026-04-08T09:00:00.000Z",
  "respondedAt": "2026-04-08T09:10:00.000Z"
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "action은 APPROVE 또는 REJECT이어야 합니다." | 허용되지 않는 action 값 |
| 400 | "action은 필수입니다." | action 필드 누락 |
| 400 | "이미 처리된 가입 신청입니다." | status가 이미 APPROVED 또는 REJECTED |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "팀장만 가입 신청을 처리할 수 있습니다." | 요청자의 역할이 MEMBER 또는 해당 팀 구성원이 아님 |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |
| 404 | "가입 신청을 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 requestId |

**비즈니스 규칙**: BR-01, BR-03, FR-02-7

> 참고: `action=APPROVE` 처리 시 서버에서 원자적으로 `team_join_requests.status = APPROVED` + `team_members(role=MEMBER)` 등록이 이루어집니다.

---

### GET /api/me/tasks

**설명**: 현재 로그인한 사용자가 LEADER로 있는 **모든 팀**의 PENDING 가입 신청을 한 번에 조회합니다. 나의 할 일(My Tasks) 화면의 메인 데이터 소스입니다.
**인증**: 필요
**권한**: LEADER만 (MEMBER 역할만 가진 사용자는 빈 배열 반환)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters: 없음
- Query Parameters: 없음
- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "totalPendingCount": 2,
  "tasks": [
    {
      "id": "e5f6a7b8-c9d0-1234-efab-cd5678901234",
      "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "teamName": "개발팀",
      "requesterId": "d4e5f6a7-b8c9-0123-defa-bc3456789012",
      "requesterName": "김철수",
      "requesterEmail": "kimcs@example.com",
      "status": "PENDING",
      "requestedAt": "2026-04-08T09:00:00.000Z",
      "respondedAt": null
    },
    {
      "id": "f6a7b8c9-d0e1-2345-fabc-de6789012345",
      "teamId": "c2d3e4f5-a6b7-8901-cdef-ab2345678901",
      "teamName": "디자인팀",
      "requesterId": "e5f6a7b8-c9d0-1234-efab-cd5678901234",
      "requesterName": "박지수",
      "requesterEmail": "parkjs@example.com",
      "status": "PENDING",
      "requestedAt": "2026-04-08T10:30:00.000Z",
      "respondedAt": null
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| totalPendingCount | number | 전체 PENDING 가입 신청 수 |
| tasks | array | PENDING 가입 신청 배열 (`requestedAt` 오름차순 정렬) |
| tasks[].id | string | 가입 신청 UUID |
| tasks[].teamId | string | 신청 대상 팀 UUID |
| tasks[].teamName | string | 신청 대상 팀 이름 |
| tasks[].requesterId | string | 신청자 UUID |
| tasks[].requesterName | string | 신청자 표시 이름 |
| tasks[].requesterEmail | string | 신청자 이메일 |
| tasks[].status | string | 신청 상태: `PENDING` |
| tasks[].requestedAt | string | 신청 일시 (UTC ISO 8601) |
| tasks[].respondedAt | string \| null | 응답 일시. PENDING 상태에서 항상 `null` |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |

**비즈니스 규칙**: BR-01, BR-03, FR-02-8

---

## 6. Schedules (팀 일정)

---

### GET /api/teams/:teamId/schedules

**설명**: 팀의 일정을 조회합니다. 월/주/일 단위 뷰와 기준 날짜를 Query Parameter로 지정합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (해당 팀 소속 구성원)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 조회할 팀의 UUID |

- Query Parameters:

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| view | string | X | `month` | 조회 단위: `month`, `week`, `day`. 기본값: `month` |
| date | string | X | 오늘 | 기준 날짜 (YYYY-MM-DD, KST 기준). 기본값: 오늘. `month`는 해당 월 전체, `week`는 해당 주 전체(일~토), `day`는 해당 하루 |

- 요청 예시:
  ```
  GET /api/teams/b1c2d3e4-f5a6-7890-bcde-fa1234567890/schedules?view=month&date=2026-04-01
  GET /api/teams/b1c2d3e4-f5a6-7890-bcde-fa1234567890/schedules?view=week&date=2026-04-07
  GET /api/teams/b1c2d3e4-f5a6-7890-bcde-fa1234567890/schedules?view=day&date=2026-04-07
  ```

**Response**

- 성공: `200 OK`

```json
{
  "schedules": [
    {
      "id": "f6a7b8c9-d0e1-2345-fabc-de6789012345",
      "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "title": "주간 팀 미팅",
      "description": "이번 주 진행 상황 공유 및 다음 주 계획 수립",
      "color": "indigo",
      "startAt": "2026-04-07T01:00:00.000Z",
      "endAt": "2026-04-07T02:00:00.000Z",
      "createdBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "creatorName": "홍길동",
      "createdAt": "2026-04-05T10:00:00.000Z",
      "updatedAt": "2026-04-05T10:00:00.000Z"
    }
  ],
  "view": "month",
  "date": "2026-04-07"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| schedules | array | 일정 배열 |
| schedules[].id | string | 일정 UUID |
| schedules[].teamId | string | 소속 팀 UUID |
| schedules[].title | string | 일정 제목 |
| schedules[].description | string \| null | 일정 상세 설명 |
| schedules[].color | string | 일정 색상 (indigo, blue, emerald, amber, rose) |
| schedules[].startAt | string | 시작 일시 (UTC ISO 8601) |
| schedules[].endAt | string | 종료 일시 (UTC ISO 8601) |
| schedules[].createdBy | string | 생성한 사용자의 UUID |
| schedules[].creatorName | string | 생성한 사용자의 표시 이름 |
| schedules[].createdAt | string | 레코드 생성 일시 (UTC ISO 8601) |
| schedules[].updatedAt | string | 최종 수정 일시 (UTC ISO 8601) |
| view | string | 요청한 뷰 타입 (month/week/day) |
| date | string | 요청한 기준 날짜 (YYYY-MM-DD) |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "view 파라미터는 month, week, day 중 하나이어야 합니다." | 허용되지 않는 view 값 |
| 400 | "date 파라미터는 YYYY-MM-DD 형식이어야 합니다." | date 형식 오류 |
| 400 | "view와 date는 필수 파라미터입니다." | view 또는 date 누락 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |

**비즈니스 규칙**: BR-01, BR-06, FR-03-1, FR-03-2, FR-03-3, FR-03-4, FR-03-5

---

### POST /api/teams/:teamId/schedules

**설명**: 팀 일정을 생성합니다. 팀 구성원(LEADER/MEMBER) 모두 실행할 수 있습니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 일정을 생성할 팀의 UUID |

- Body:

```json
{
  "title": "주간 팀 미팅",
  "description": "이번 주 진행 상황 공유 및 다음 주 계획 수립",
  "color": "indigo",
  "startAt": "2026-04-07T01:00:00.000Z",
  "endAt": "2026-04-07T02:00:00.000Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | string | O | 일정 제목, 최대 200자 |
| description | string | X | 일정 상세 설명, 선택 입력 |
| color | string | X | 일정 색상. `indigo` / `blue` / `emerald` / `amber` / `rose` 중 하나. 기본 `indigo`. ⚠ 현재 backend 에서 enum 검증을 하지 않아 임의 문자열을 받으면 그대로 저장됨 — frontend 선에서 enum 강제 권장 |
| startAt | string | O | 시작 일시 (UTC ISO 8601) |
| endAt | string | O | 종료 일시 (UTC ISO 8601), `startAt`보다 이후여야 함 |

**Response**

- 성공: `201 Created`

```json
{
  "id": "f6a7b8c9-d0e1-2345-fabc-de6789012345",
  "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "title": "주간 팀 미팅",
  "description": "이번 주 진행 상황 공유 및 다음 주 계획 수립",
  "color": "indigo",
  "startAt": "2026-04-07T01:00:00.000Z",
  "endAt": "2026-04-07T02:00:00.000Z",
  "createdBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "creatorName": "홍길동",
  "createdAt": "2026-04-07T09:00:00.000Z",
  "updatedAt": "2026-04-07T09:00:00.000Z"
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "제목은 필수입니다." | title 누락 |
| 400 | "제목은 최대 200자까지 입력 가능합니다." | title 길이 초과 |
| 400 | "startAt과 endAt은 필수입니다." | startAt 또는 endAt 누락 |
| 400 | "종료 일시는 시작 일시보다 이후여야 합니다." | endAt <= startAt (FR-04-4) |
| 400 | "날짜 형식이 올바르지 않습니다. ISO 8601 UTC 형식을 사용하세요." | 날짜 파싱 실패 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |

**비즈니스 규칙**: BR-01, BR-02, BR-06, FR-04-1, FR-04-4, FR-04-6

### GET /api/teams/:teamId/schedules/:scheduleId

**설명**: 특정 팀 일정의 상세 정보를 조회합니다. LEADER와 MEMBER 모두 접근할 수 있습니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (해당 팀 소속 구성원)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| scheduleId | string (UUID) | 조회할 일정 UUID |

- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "id": "f6a7b8c9-d0e1-2345-fabc-de6789012345",
  "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "title": "팀 전체 회의",
  "description": "분기별 성과 공유 및 다음 스프린트 계획 논의",
  "startAt": "2026-04-14T06:00:00.000Z",
  "endAt": "2026-04-14T07:00:00.000Z",
  "createdBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "createdAt": "2026-04-05T10:00:00.000Z",
  "updatedAt": "2026-04-05T10:00:00.000Z"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 일정 UUID |
| teamId | string | 소속 팀 UUID |
| title | string | 일정 제목 |
| description | string \| null | 일정 상세 설명 |
| startAt | string | 시작 일시 (UTC ISO 8601) |
| endAt | string | 종료 일시 (UTC ISO 8601) |
| createdBy | string | 생성한 팀장의 사용자 UUID |
| createdAt | string | 레코드 생성 일시 (UTC ISO 8601) |
| updatedAt | string | 최종 수정 일시 (UTC ISO 8601) |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |
| 404 | "일정을 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 scheduleId |

**비즈니스 규칙**: BR-01, BR-06, FR-03-4, FR-03-5

---

### PATCH /api/teams/:teamId/schedules/:scheduleId

**설명**: 기존 팀 일정을 수정합니다. 일정 생성자만 실행할 수 있습니다. 전달된 필드만 수정합니다.
**인증**: 필요
**권한**: 일정 생성자 본인만

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| scheduleId | string (UUID) | 수정할 일정의 UUID |

- Body:

```json
{
  "title": "주간 팀 미팅 (일정 변경)",
  "description": "장소: 회의실 A",
  "color": "amber",
  "startAt": "2026-04-07T02:00:00.000Z",
  "endAt": "2026-04-07T03:00:00.000Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | string | X | 일정 제목, 최대 200자 |
| description | string \| null | X | 일정 상세 설명 (`null` 전달 시 비워짐) |
| color | string | X | `indigo`/`blue`/`emerald`/`amber`/`rose`. ⚠ 현재 backend enum 검증 미적용 |
| startAt | string | X | 변경할 시작 일시 (UTC ISO 8601) |
| endAt | string | X | 변경할 종료 일시 (UTC ISO 8601) |

> 최소 1개 이상의 필드를 포함해야 합니다. `startAt`과 `endAt` 중 하나만 변경하는 경우, 서버는 기존 값과 신규 값을 조합하여 `startAt < endAt` 조건을 검증합니다.

**Response**

- 성공: `200 OK`

```json
{
  "id": "f6a7b8c9-d0e1-2345-fabc-de6789012345",
  "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "title": "주간 팀 미팅 (일정 변경)",
  "description": "장소: 회의실 A",
  "startAt": "2026-04-07T02:00:00.000Z",
  "endAt": "2026-04-07T03:00:00.000Z",
  "createdBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "createdAt": "2026-04-07T09:00:00.000Z",
  "updatedAt": "2026-04-07T10:30:00.000Z"
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "수정할 항목이 없습니다." | 바디가 비어 있음 |
| 400 | "제목은 최대 200자까지 입력 가능합니다." | title 길이 초과 |
| 400 | "종료 일시는 시작 일시보다 이후여야 합니다." | 수정 후 endAt <= startAt (FR-04-4) |
| 400 | "날짜 형식이 올바르지 않습니다. ISO 8601 UTC 형식을 사용하세요." | 날짜 파싱 실패 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "일정 수정 권한이 없습니다." | 요청자가 일정의 생성자가 아님 (BR-02) |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |
| 404 | "일정을 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 scheduleId |

**비즈니스 규칙**: BR-01, BR-02, BR-06, FR-04-2, FR-04-4

---

### DELETE /api/teams/:teamId/schedules/:scheduleId

**설명**: 팀 일정을 삭제합니다. 일정 생성자만 실행할 수 있습니다.
**인증**: 필요
**권한**: 일정 생성자 본인만

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| scheduleId | string (UUID) | 삭제할 일정의 UUID |

- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "message": "일정이 삭제되었습니다."
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "일정 삭제 권한이 없습니다." | 요청자가 일정의 생성자가 아님 (BR-02) |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |
| 404 | "일정을 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 scheduleId |

**비즈니스 규칙**: BR-01, BR-02, BR-06, FR-04-3

---

## 7. Messages (채팅 메시지)

---

### GET /api/teams/:teamId/messages

**설명**: 특정 날짜(KST 기준)의 팀 채팅 메시지 목록을 조회합니다. 폴링 방식으로 주기적 호출을 통해 새 메시지를 수신합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (해당 팀 소속 구성원)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 조회할 팀의 UUID |

- Query Parameters:

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| date | string | X | 현재 KST 날짜 | KST 기준 날짜 (YYYY-MM-DD). 지정 시 해당 날짜 범위 메시지 반환 |
| limit | integer | X | 50 | `date` 미지정 시 반환할 최대 메시지 수 |
| before | string | X | - | `date` 미지정 시 이 시각(ISO 8601) 이전 메시지만 반환하는 커서 |

- 요청 예시:
  ```
  GET /api/teams/b1c2d3e4-f5a6-7890-bcde-fa1234567890/messages?date=2026-04-07
  GET /api/teams/b1c2d3e4-f5a6-7890-bcde-fa1234567890/messages?limit=50&before=2026-04-07T10:00:00.000Z
  ```

**Response**

- 성공: `200 OK`

```json
{
  "date": "2026-04-07",
  "messages": [
    {
      "id": "a7b8c9d0-e1f2-3456-abcd-ef7890123456",
      "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "type": "NORMAL",
      "senderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "senderName": "홍길동",
      "content": "오늘 미팅 시간 변경합니다. 오후 3시로 조정해주세요.",
      "sentAt": "2026-04-07T01:30:00.000Z",
      "createdAt": "2026-04-07T01:30:00.000Z"
    },
    {
      "id": "b8c9d0e1-f2a3-4567-bcde-fa8901234567",
      "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "type": "WORK_PERFORMANCE",
      "senderId": "d4e5f6a7-b8c9-0123-defa-bc3456789012",
      "senderName": "김철수",
      "content": "팀장님, 4월 10일 일정을 오후로 변경 부탁드립니다.",
      "sentAt": "2026-04-07T02:15:00.000Z",
      "createdAt": "2026-04-07T02:15:00.000Z"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| date | string | 조회 기준 날짜 (KST, YYYY-MM-DD). date 미제공 시 현재 KST 날짜 |
| messages | array | 해당 날짜의 메시지 배열, `sentAt` 오름차순 정렬 |
| messages[].id | string | 메시지 UUID |
| messages[].teamId | string | 소속 팀 UUID |
| messages[].type | string | 메시지 유형: `NORMAL` 또는 `WORK_PERFORMANCE` |
| messages[].senderId | string | 발신자 사용자 UUID |
| messages[].senderName | string | 발신자 표시 이름 |
| messages[].content | string | 메시지 본문 |
| messages[].sentAt | string | 전송 일시 (UTC ISO 8601) |
| messages[].createdAt | string | 레코드 생성 일시 (UTC ISO 8601) |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "date 파라미터는 YYYY-MM-DD 형식이어야 합니다." | date 형식 오류 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |

**비즈니스 규칙**: BR-01, BR-05, BR-06, FR-05-2, FR-05-6, FR-05-7

> 폴링 구현: 클라이언트(TanStack Query)에서 `refetchInterval: 3000~5000`(ms)으로 주기적 호출하여 준실시간 채팅을 구현합니다.

---

### POST /api/teams/:teamId/messages

**설명**: 팀 채팅 메시지를 전송합니다. `NORMAL` 타입의 일반 메시지와 `WORK_PERFORMANCE` 타입의 업무보고 메시지를 모두 처리합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (해당 팀 소속 구성원)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 메시지를 전송할 팀의 UUID |

- Body (일반 메시지):

```json
{
  "type": "NORMAL",
  "content": "오늘 미팅 시간 변경합니다. 오후 3시로 조정해주세요."
}
```

- Body (일정 변경 요청 메시지):

```json
{
  "type": "WORK_PERFORMANCE",
  "content": "팀장님, 4월 10일 일정을 오후로 변경 부탁드립니다."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| type | string | X | 메시지 유형: `NORMAL` 또는 `WORK_PERFORMANCE`(업무보고). 미입력 시 기본값 `NORMAL` |
| content | string | O | 메시지 본문, 최대 2000자 |

**Response**

- 성공: `201 Created`

```json
{
  "id": "a7b8c9d0-e1f2-3456-abcd-ef7890123456",
  "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "type": "WORK_PERFORMANCE",
  "senderId": "d4e5f6a7-b8c9-0123-defa-bc3456789012",
  "senderName": "김철수",
  "content": "팀장님, 4월 10일 일정을 오후로 변경 부탁드립니다.",
  "sentAt": "2026-04-07T02:15:00.000Z",
  "createdAt": "2026-04-07T02:15:00.000Z"
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "메시지 내용은 필수입니다." | content 누락 |
| 400 | "메시지는 최대 2000자까지 입력 가능합니다." | content 길이 초과 (FR-05-5) |
| 400 | "잘못된 메시지 타입입니다." | 허용되지 않는 type 값 (`NORMAL`, `WORK_PERFORMANCE` 외) |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |

**비즈니스 규칙**: BR-01, BR-04, BR-06, FR-05-1, FR-05-3, FR-05-5, FR-05-6

---

## 8. Notices (공지사항)

---

### GET /api/teams/:teamId/notices

**설명**: 팀의 공지사항 목록을 등록 시간 오름차순으로 조회합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (해당 팀 소속 구성원)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 조회할 팀의 UUID |

- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "notices": [
    {
      "id": "c9d0e1f2-a3b4-5678-cdef-ab9012345678",
      "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "senderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "senderName": "홍길동",
      "content": "다음 주 월요일은 휴무입니다.",
      "createdAt": "2026-04-20T01:00:00.000Z"
    }
  ]
}
```

> 팀 일자별 endpoint이므로 응답에 `projectId` 필드는 포함되지 않습니다. 프로젝트 공지는 §13을 사용하세요.

| 필드 | 타입 | 설명 |
|------|------|------|
| notices | array | 공지사항 배열 (`createdAt` 오름차순) |
| notices[].id | string | 공지 UUID |
| notices[].teamId | string | 소속 팀 UUID |
| notices[].senderId | string | 작성자 사용자 UUID |
| notices[].senderName | string | 작성자 표시 이름 |
| notices[].content | string | 공지 본문 |
| notices[].createdAt | string | 작성 일시 (UTC ISO 8601) |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |

---

### POST /api/teams/:teamId/notices

**설명**: 팀 공지사항을 등록합니다. 팀 구성원이면 누구나 작성할 수 있습니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 공지를 등록할 팀의 UUID |

- Body:

```json
{
  "content": "다음 주 월요일은 휴무입니다."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| content | string | O | 공지 본문, 최대 2000자 |

**Response**

- 성공: `201 Created`

```json
{
  "id": "c9d0e1f2-a3b4-5678-cdef-ab9012345678",
  "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "senderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "senderName": "홍길동",
  "content": "다음 주 월요일은 휴무입니다.",
  "createdAt": "2026-04-20T01:00:00.000Z"
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "내용은 필수입니다." | content 누락 |
| 400 | "내용은 최대 2000자까지 입력 가능합니다." | content 길이 초과 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |

---

### DELETE /api/teams/:teamId/notices/:noticeId

**설명**: 공지사항을 삭제합니다. 작성자 본인 또는 팀장만 삭제할 수 있습니다.
**인증**: 필요
**권한**: 작성자 본인 또는 LEADER

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| noticeId | string (UUID) | 삭제할 공지 UUID |

- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "message": "공지사항이 삭제되었습니다."
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 403 | "작성자 또는 팀 리더만 삭제할 수 있습니다." | 요청자가 작성자도 LEADER도 아님 |
| 404 | "공지사항을 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 noticeId |

---

## 9. Postits (포스트잇)

---

### GET /api/teams/:teamId/postits

**설명**: 특정 월(YYYY-MM)의 팀 포스트잇 목록을 조회합니다. 캘린더 위에 날짜별로 누적되는 메모용 카드입니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 조회할 팀의 UUID |

- Query Parameters:

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| month | string | O | 조회 대상 월(YYYY-MM). 예: `2026-04` |

**Response**

- 성공: `200 OK`

```json
{
  "postits": [
    {
      "id": "d0e1f2a3-b4c5-6789-defa-bc0123456789",
      "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "createdBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "creatorName": "홍길동",
      "date": "2026-04-12",
      "color": "amber",
      "content": "외부 미팅 자료 준비",
      "createdAt": "2026-04-10T03:00:00.000Z",
      "updatedAt": "2026-04-10T03:00:00.000Z"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| postits[].id | string | 포스트잇 UUID |
| postits[].teamId | string | 소속 팀 UUID |
| postits[].createdBy | string | 작성자 사용자 UUID |
| postits[].creatorName | string | 작성자 표시 이름 |
| postits[].date | string | 카드가 부착된 날짜 (YYYY-MM-DD) |
| postits[].color | string | 카드 색상 (`indigo`, `blue`, `emerald`, `amber`, `rose`) |
| postits[].content | string | 메모 본문 (생성 직후 빈 문자열일 수 있음) |
| postits[].createdAt | string | 생성 일시 (UTC ISO 8601) |
| postits[].updatedAt | string | 최종 수정 일시 (UTC ISO 8601) |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "month 파라미터가 필요합니다. (YYYY-MM)" | month 누락 또는 형식 오류 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |

---

### POST /api/teams/:teamId/postits

**설명**: 특정 날짜에 빈 포스트잇 카드를 생성합니다. 본문(`content`)은 별도 PATCH로 채웁니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 포스트잇을 등록할 팀의 UUID |

- Body:

```json
{
  "date": "2026-04-12",
  "color": "amber"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| date | string | O | 부착할 날짜 (YYYY-MM-DD) |
| color | string | O | 카드 색상 (`indigo`, `blue`, `emerald`, `amber`, `rose` 중 하나) |

**Response**

- 성공: `201 Created` (응답 본문은 GET 응답의 `postits[]` 항목과 동일)

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "date 파라미터가 필요합니다. (YYYY-MM-DD)" | date 누락 또는 형식 오류 |
| 400 | "유효하지 않은 색상입니다." | 허용되지 않는 color 값 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |

---

### PATCH /api/teams/:teamId/postits/:postitId

**설명**: 포스트잇의 본문을 수정합니다. 작성자 본인만 수정할 수 있습니다.
**인증**: 필요
**권한**: 작성자 본인만

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| postitId | string (UUID) | 수정할 포스트잇 UUID |

- Body:

```json
{
  "content": "외부 미팅 자료 작성 — 14시까지"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| content | string | O | 메모 본문(빈 문자열 허용) |

**Response**

- 성공: `200 OK`

```json
{
  "id": "d0e1f2a3-b4c5-6789-defa-bc0123456789",
  "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "createdBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "date": "2026-04-12",
  "color": "amber",
  "content": "외부 미팅 자료 작성 — 14시까지",
  "updatedAt": "2026-04-10T05:30:00.000Z"
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "content는 문자열이어야 합니다." | content가 문자열이 아님 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 403 | "포스트잇 생성자만 수정할 수 있습니다." | 요청자가 작성자가 아님 |
| 404 | "포스트잇을 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 postitId |

---

### DELETE /api/teams/:teamId/postits/:postitId

**설명**: 포스트잇을 삭제합니다. 작성자 본인만 삭제할 수 있습니다.
**인증**: 필요
**권한**: 작성자 본인만

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| postitId | string (UUID) | 삭제할 포스트잇 UUID |

- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "message": "포스트잇이 삭제되었습니다."
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 403 | "포스트잇 생성자만 삭제할 수 있습니다." | 요청자가 작성자가 아님 |
| 404 | "포스트잇을 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 postitId |

---

## 10. Projects (프로젝트)

프로젝트는 다음 3계층으로 구성됩니다.

```
Project
└─ ProjectSchedule (큰 단위 일정)
   └─ SubSchedule (세부 작업)
```

각 계층은 독립된 엔드포인트를 가지며 모두 `progress`, `color`, `leader/manager`, `isDelayed`(상위는 `phases`) 등의 메타데이터를 포함합니다. 모든 색상 필드의 허용값은 `indigo`, `blue`, `emerald`, `amber`, `rose` 입니다.

---

### GET /api/teams/:teamId/projects

**설명**: 팀의 프로젝트 목록을 조회합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 조회할 팀의 UUID |

- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "projects": [
    {
      "id": "e1f2a3b4-c5d6-7890-efab-cd1234567890",
      "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "createdBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "런칭 캠페인",
      "description": "Q2 신규 서비스 런칭",
      "startDate": "2026-04-01",
      "endDate": "2026-06-30",
      "progress": 35,
      "manager": "홍길동",
      "phases": [
        { "id": "p1", "name": "기획", "order": 1 },
        { "id": "p2", "name": "개발", "order": 2 }
      ],
      "createdAt": "2026-04-01T01:00:00.000Z",
      "updatedAt": "2026-04-15T02:30:00.000Z"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| projects[].id | string | 프로젝트 UUID |
| projects[].teamId | string | 소속 팀 UUID |
| projects[].createdBy | string | 생성자 사용자 UUID |
| projects[].name | string | 프로젝트 이름 |
| projects[].description | string \| null | 설명 |
| projects[].startDate | string | 시작일 (YYYY-MM-DD) |
| projects[].endDate | string | 종료일 (YYYY-MM-DD) |
| projects[].progress | number | 진행률 (0~100) |
| projects[].manager | string | 담당자(자유 문자열) |
| projects[].phases | array | 단계 목록 (`{ id, name, order }`) |
| projects[].createdAt | string | 생성 일시 (UTC ISO 8601) |
| projects[].updatedAt | string | 수정 일시 (UTC ISO 8601) |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |

---

### POST /api/teams/:teamId/projects

**설명**: 새 프로젝트를 생성합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 프로젝트를 생성할 팀의 UUID |

- Body:

```json
{
  "name": "런칭 캠페인",
  "description": "Q2 신규 서비스 런칭",
  "startDate": "2026-04-01",
  "endDate": "2026-06-30",
  "progress": 0,
  "manager": "홍길동",
  "phases": [
    { "name": "기획", "order": 1 },
    { "name": "개발", "order": 2 }
  ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | string | O | 프로젝트 이름, 최대 200자 |
| description | string \| null | X | 프로젝트 설명 |
| startDate | string | O | 시작일 (YYYY-MM-DD) |
| endDate | string | O | 종료일 (YYYY-MM-DD), `startDate` 이상이어야 함 |
| progress | number | X | 진행률(0~100), 기본 0 |
| manager | string | X | 담당자 |
| phases | array | X | 단계 목록. `id` 미지정 시 서버에서 UUID 발급, `order` 미지정 시 1부터 자동 부여 |

**Response**

- 성공: `201 Created` (응답 형식은 GET의 `projects[]` 항목과 동일)

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "프로젝트 이름은 필수입니다." | name 누락 |
| 400 | "프로젝트 이름은 최대 200자까지 입력 가능합니다." | name 길이 초과 |
| 400 | "시작일과 종료일은 필수입니다." | startDate/endDate 누락 |
| 400 | "종료일은 시작일보다 같거나 늦어야 합니다." | endDate < startDate |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |

---

### GET /api/teams/:teamId/projects/:projectId

**설명**: 프로젝트 상세를 조회합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| projectId | string (UUID) | 조회할 프로젝트 UUID |

- Body: 없음

**Response**

- 성공: `200 OK` (GET 목록의 `projects[]` 단건)
- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "프로젝트를 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 projectId |

---

### PATCH /api/teams/:teamId/projects/:projectId

**설명**: 프로젝트를 수정합니다. 생성자만 수정할 수 있습니다. 전달된 필드만 부분 갱신.
**인증**: 필요
**권한**: 생성자 본인만

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| projectId | string (UUID) | 수정할 프로젝트 UUID |

- Body: 모든 필드 선택. 키 존재 여부로 갱신 대상 결정.

| 필드 | 타입 | 설명 |
|------|------|------|
| name | string | 이름, 최대 200자 |
| description | string \| null | 설명 |
| startDate | string | 시작일 (YYYY-MM-DD) |
| endDate | string | 종료일 (YYYY-MM-DD) |
| progress | number | 진행률 |
| manager | string | 담당자 |
| phases | array | 단계 목록. `id` 미지정 시 신규 발급, `order` 미지정 시 1부터 부여 |

> `startDate`/`endDate` 중 하나만 수정해도, 서버는 기존 값과 합쳐 `startDate <= endDate` 를 검증합니다.

**Response**

- 성공: `200 OK` (단건 응답)

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "프로젝트 이름은 최대 200자까지 입력 가능합니다." | name 길이 초과 |
| 400 | "종료일은 시작일보다 같거나 늦어야 합니다." | 수정 후 endDate < startDate |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 403 | "프로젝트 생성자만 수정할 수 있습니다." | 요청자가 생성자가 아님 |
| 404 | "프로젝트를 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 projectId |

---

### DELETE /api/teams/:teamId/projects/:projectId

**설명**: 프로젝트를 삭제합니다. 종속된 프로젝트 일정·서브 일정은 DB CASCADE 정책으로 함께 정리됩니다.
**인증**: 필요
**권한**: 생성자 본인만

**Response**

- 성공: `200 OK` `{"message": "프로젝트가 삭제되었습니다."}`

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 403 | "프로젝트 생성자만 삭제할 수 있습니다." | 요청자가 생성자가 아님 |
| 404 | "프로젝트를 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 projectId |

---

### GET /api/teams/:teamId/projects/:projectId/schedules

**설명**: 프로젝트에 속한 일정(큰 단위) 목록을 조회합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두

**Response**

- 성공: `200 OK`

```json
{
  "schedules": [
    {
      "id": "f1a2b3c4-d5e6-7890-fabc-de1234567890",
      "projectId": "e1f2a3b4-c5d6-7890-efab-cd1234567890",
      "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "createdBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "프론트엔드 개발",
      "description": null,
      "color": "indigo",
      "startDate": "2026-04-15",
      "endDate": "2026-05-15",
      "leader": "이영희",
      "progress": 20,
      "isDelayed": false,
      "phaseId": "p2",
      "createdAt": "2026-04-10T03:00:00.000Z",
      "updatedAt": "2026-04-15T05:00:00.000Z"
    }
  ]
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "프로젝트를 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 projectId |

---

### POST /api/teams/:teamId/projects/:projectId/schedules

**설명**: 프로젝트 일정을 생성합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두

**Request Body**

```json
{
  "title": "프론트엔드 개발",
  "description": null,
  "color": "indigo",
  "startDate": "2026-04-15",
  "endDate": "2026-05-15",
  "leader": "이영희",
  "progress": 0,
  "isDelayed": false,
  "phaseId": "p2"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | string | O | 일정 제목, 최대 200자 |
| description | string \| null | X | 설명 |
| color | string | X | 색상 (`indigo` 기본) |
| startDate | string | O | 시작일 (YYYY-MM-DD) |
| endDate | string | O | 종료일 (YYYY-MM-DD), `startDate` 이상 |
| leader | string | X | 담당자 |
| progress | number | X | 진행률(0~100), 기본 0 |
| isDelayed | boolean | X | 지연 여부, 기본 false |
| phaseId | string \| null | X | 연결된 프로젝트 단계 ID. UUID 형식이어야 함 |

**Response**

- 성공: `201 Created` (단건)

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "제목은 필수입니다." | title 누락 |
| 400 | "제목은 최대 200자까지 입력 가능합니다." | title 길이 초과 |
| 400 | "시작일과 종료일은 필수입니다." | startDate/endDate 누락 |
| 400 | "종료일은 시작일보다 같거나 늦어야 합니다." | endDate < startDate |
| 400 | "color는 indigo, blue, emerald, amber, rose 중 하나여야 합니다." | 허용되지 않는 color |
| 400 | "유효하지 않은 단계 ID입니다." | phaseId가 UUID 형식이 아님 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "프로젝트를 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 projectId |

---

> **단건 GET 은 미구현** — 클라이언트는 목록(`GET .../schedules`) 응답을 캐시(TanStack Query)에서 사용. 필요 시 추후 추가.

### PATCH /api/teams/:teamId/projects/:projectId/schedules/:scheduleId

**설명**: 프로젝트 일정을 수정합니다. 생성자만 가능. 전달된 필드만 갱신.
**인증**: 필요
**권한**: 생성자 본인만

**Request Body**: POST와 동일한 필드 집합(모두 선택). `startDate`/`endDate` 중 하나만 변경 시 기존 값과 결합해 검증.

**Response**

- 성공: `200 OK` (단건)

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "제목은 최대 200자까지 입력 가능합니다." | title 길이 초과 |
| 400 | "color는 indigo, blue, emerald, amber, rose 중 하나여야 합니다." | 허용되지 않는 color |
| 400 | "종료일은 시작일보다 같거나 늦어야 합니다." | 수정 후 endDate < startDate |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 403 | "프로젝트 일정 생성자만 수정할 수 있습니다." | 요청자가 생성자가 아님 |
| 404 | "프로젝트 일정을 찾을 수 없습니다." | 존재하지 않거나 해당 프로젝트 소속이 아닌 scheduleId |

---

### DELETE /api/teams/:teamId/projects/:projectId/schedules/:scheduleId

**설명**: 프로젝트 일정을 삭제합니다. 종속된 서브 일정은 CASCADE로 함께 정리됩니다.
**인증**: 필요
**권한**: 생성자 본인만

**Response**

- 성공: `200 OK` `{"message": "프로젝트 일정이 삭제되었습니다."}`

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 403 | "프로젝트 일정 생성자만 삭제할 수 있습니다." | 요청자가 생성자가 아님 |
| 404 | "프로젝트 일정을 찾을 수 없습니다." | 존재하지 않거나 해당 프로젝트 소속이 아닌 scheduleId |

---

### GET /api/teams/:teamId/projects/:projectId/schedules/:scheduleId/sub-schedules

**설명**: 프로젝트 일정에 속한 서브 일정(세부 작업) 목록을 조회합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두

**Response**

- 성공: `200 OK`

```json
{
  "subSchedules": [
    {
      "id": "a2b3c4d5-e6f7-8901-abcd-ef2345678901",
      "scheduleId": "f1a2b3c4-d5e6-7890-fabc-de1234567890",
      "projectId": "e1f2a3b4-c5d6-7890-efab-cd1234567890",
      "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "createdBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "로그인 화면 구현",
      "description": null,
      "color": "blue",
      "startDate": "2026-04-15",
      "endDate": "2026-04-22",
      "leader": "이영희",
      "progress": 50,
      "isDelayed": false,
      "createdAt": "2026-04-12T01:00:00.000Z",
      "updatedAt": "2026-04-18T03:30:00.000Z"
    }
  ]
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "프로젝트 일정을 찾을 수 없습니다." | 존재하지 않거나 해당 프로젝트 소속이 아닌 scheduleId |

---

### POST /api/teams/:teamId/projects/:projectId/schedules/:scheduleId/sub-schedules

**설명**: 서브 일정을 생성합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두

**Request Body**

```json
{
  "title": "로그인 화면 구현",
  "description": null,
  "color": "blue",
  "startDate": "2026-04-15",
  "endDate": "2026-04-22",
  "leader": "이영희",
  "progress": 0,
  "isDelayed": false
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | string | O | 제목, 최대 200자 |
| description | string \| null | X | 설명 |
| color | string | X | 색상 (`indigo` 기본) |
| startDate | string | O | 시작일 (YYYY-MM-DD) |
| endDate | string | O | 종료일 (YYYY-MM-DD), `startDate` 이상 |
| leader | string | X | 담당자 |
| progress | number | X | 진행률, 기본 0 |
| isDelayed | boolean | X | 지연 여부, 기본 false |

**Response**

- 성공: `201 Created` (단건)

- 실패: 상위 일정의 색상/날짜 검증 룰과 동일. `404`는 `프로젝트 일정을 찾을 수 없습니다.` / `해당 팀에 접근 권한이 없습니다.`(상위 일정의 teamId 불일치).

---

> **단건 GET 은 미구현** — 상위 일정 단건 GET 과 동일 사유. 클라이언트는 목록 캐시를 사용.

### PATCH /api/teams/:teamId/projects/:projectId/schedules/:scheduleId/sub-schedules/:subId

**설명**: 서브 일정을 수정합니다. 생성자만 가능. 전달된 필드만 갱신.
**인증**: 필요
**권한**: 생성자 본인만

**Request Body**: POST와 동일한 필드 집합(모두 선택).

**Response**

- 성공: `200 OK` (단건)

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "제목은 최대 200자까지 입력 가능합니다." | title 길이 초과 |
| 400 | "color는 indigo, blue, emerald, amber, rose 중 하나여야 합니다." | 허용되지 않는 color |
| 400 | "종료일은 시작일보다 같거나 늦어야 합니다." | 수정 후 endDate < startDate |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 403 | "서브 일정 생성자만 수정할 수 있습니다." | 요청자가 생성자가 아님 |
| 404 | "서브 일정을 찾을 수 없습니다." | 존재하지 않거나 해당 프로젝트 일정 소속이 아닌 subId |

---

### DELETE /api/teams/:teamId/projects/:projectId/schedules/:scheduleId/sub-schedules/:subId

**설명**: 서브 일정을 삭제합니다.
**인증**: 필요
**권한**: 생성자 본인만

**Response**

- 성공: `200 OK` `{"message": "서브 일정이 삭제되었습니다."}`

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 403 | "서브 일정 생성자만 삭제할 수 있습니다." | 요청자가 생성자가 아님 |
| 404 | "서브 일정을 찾을 수 없습니다." | 존재하지 않거나 해당 프로젝트 일정 소속이 아닌 subId |

---

## 11. Work Permissions (업무보고 조회 권한)

---

### GET /api/teams/:teamId/work-permissions

**설명**: 팀의 업무보고(`WORK_PERFORMANCE`) 메시지 조회 권한 목록을 반환합니다. 허용된 사용자 ID 배열을 반환하며, 빈 배열이면 전체 구성원이 조회 가능합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (해당 팀 소속 구성원)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 조회할 팀의 UUID |

- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "permittedUserIds": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "d4e5f6a7-b8c9-0123-defa-bc3456789012"
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| permittedUserIds | string[] | 업무보고 조회가 허용된 사용자 UUID 배열 |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |

---

### PATCH /api/teams/:teamId/work-permissions

**설명**: 팀의 업무보고 조회 권한을 일괄 설정합니다. 전달된 `userIds`로 기존 권한을 전부 교체합니다. 빈 배열 전달 시 전체 권한 해제.
**인증**: 필요
**권한**: LEADER만 (해당 팀의 팀장)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 권한을 설정할 팀의 UUID |

- Body:

```json
{
  "userIds": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "d4e5f6a7-b8c9-0123-defa-bc3456789012"
  ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| userIds | string[] | O | 업무보고 조회를 허용할 사용자 UUID 배열 (기존 설정 전부 교체) |

**Response**

- 성공: `200 OK`

```json
{
  "permittedUserIds": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "d4e5f6a7-b8c9-0123-defa-bc3456789012"
  ]
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "userIds는 배열이어야 합니다." | userIds 필드가 배열이 아님 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 팀장이 아님 |
| 404 | "팀을 찾을 수 없습니다." | 존재하지 않는 teamId |

---

## 12. 프로젝트 채팅 (Project Messages)

프로젝트 전용 채팅 메시지 endpoint입니다. `chat_messages.project_id` 컬럼이 NOT NULL인 행만 조회/저장합니다.

---

### GET /api/teams/:teamId/projects/:projectId/messages

**설명**: 프로젝트 전용 채팅 메시지를 조회합니다. `sentAt` 오름차순, 최대 200건 반환. WORK_PERFORMANCE 타입은 LEADER 또는 업무보고 권한 보유자만 조회 가능합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (해당 팀 소속 구성원)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| projectId | string (UUID) | 조회할 프로젝트 UUID |

- Query Parameters: 없음
- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "projectId": "e1f2a3b4-c5d6-7890-efab-cd1234567890",
  "messages": [
    {
      "id": "a7b8c9d0-e1f2-3456-abcd-ef7890123456",
      "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "projectId": "e1f2a3b4-c5d6-7890-efab-cd1234567890",
      "type": "NORMAL",
      "senderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "senderName": "홍길동",
      "content": "프로젝트 진행 상황 공유합니다.",
      "sentAt": "2026-04-07T01:30:00.000Z",
      "createdAt": "2026-04-07T01:30:00.000Z"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| projectId | string | 조회한 프로젝트 UUID |
| messages | array | 메시지 배열, `sentAt` 오름차순 정렬, 최대 200건 |
| messages[].id | string | 메시지 UUID |
| messages[].teamId | string | 소속 팀 UUID |
| messages[].projectId | string | 소속 프로젝트 UUID |
| messages[].type | string | 메시지 유형: `NORMAL` 또는 `WORK_PERFORMANCE` |
| messages[].senderId | string | 발신자 사용자 UUID |
| messages[].senderName | string | 발신자 표시 이름 |
| messages[].content | string | 메시지 본문 |
| messages[].sentAt | string | 전송 일시 (UTC ISO 8601) |
| messages[].createdAt | string | 레코드 생성 일시 (UTC ISO 8601) |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "프로젝트를 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 projectId |

---

### POST /api/teams/:teamId/projects/:projectId/messages

**설명**: 프로젝트 전용 채팅 메시지를 전송합니다. `project_id`는 경로에서 자동 설정됩니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (해당 팀 소속 구성원)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| projectId | string (UUID) | 메시지를 전송할 프로젝트 UUID |

- Body:

```json
{
  "type": "NORMAL",
  "content": "프로젝트 진행 상황 공유합니다."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| type | string | X | 메시지 유형: `NORMAL` 또는 `WORK_PERFORMANCE`. 미입력 시 기본값 `NORMAL` |
| content | string | O | 메시지 본문, 최대 2000자 |

**Response**

- 성공: `201 Created`

```json
{
  "id": "a7b8c9d0-e1f2-3456-abcd-ef7890123456",
  "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "projectId": "e1f2a3b4-c5d6-7890-efab-cd1234567890",
  "type": "NORMAL",
  "senderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "senderName": "홍길동",
  "content": "프로젝트 진행 상황 공유합니다.",
  "sentAt": "2026-04-07T01:30:00.000Z",
  "createdAt": "2026-04-07T01:30:00.000Z"
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "메시지 내용은 필수입니다." | content 누락 |
| 400 | "메시지는 최대 2000자까지 입력 가능합니다." | content 길이 초과 |
| 400 | "잘못된 메시지 타입입니다." | 허용되지 않는 type 값 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "프로젝트를 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 projectId |

---

## 13. 프로젝트 공지 (Project Notices)

프로젝트 전용 공지 endpoint입니다. `notices.project_id` 컬럼이 NOT NULL인 행만 조회/저장합니다.

> **참고**: 프로젝트 공지 삭제(`DELETE .../notices/:noticeId`) endpoint는 현재 백엔드에 구현되어 있지 않습니다.

---

### GET /api/teams/:teamId/projects/:projectId/notices

**설명**: 프로젝트 전용 공지사항 목록을 조회합니다. `createdAt` 오름차순 정렬.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (해당 팀 소속 구성원)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| projectId | string (UUID) | 조회할 프로젝트 UUID |

- Body: 없음

**Response**

- 성공: `200 OK`

```json
{
  "projectId": "e1f2a3b4-c5d6-7890-efab-cd1234567890",
  "notices": [
    {
      "id": "c9d0e1f2-a3b4-5678-cdef-ab9012345678",
      "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "projectId": "e1f2a3b4-c5d6-7890-efab-cd1234567890",
      "senderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "senderName": "홍길동",
      "content": "이번 주 금요일까지 개발 완료해주세요.",
      "createdAt": "2026-04-20T01:00:00.000Z"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| projectId | string | 조회한 프로젝트 UUID |
| notices | array | 공지사항 배열 (`createdAt` 오름차순) |
| notices[].id | string | 공지 UUID |
| notices[].teamId | string | 소속 팀 UUID |
| notices[].projectId | string | 소속 프로젝트 UUID |
| notices[].senderId | string | 작성자 사용자 UUID |
| notices[].senderName | string | 작성자 표시 이름 |
| notices[].content | string | 공지 본문 |
| notices[].createdAt | string | 작성 일시 (UTC ISO 8601) |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "프로젝트를 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 projectId |

---

### POST /api/teams/:teamId/projects/:projectId/notices

**설명**: 프로젝트 전용 공지사항을 등록합니다. 팀 구성원이면 누구나 작성할 수 있습니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| projectId | string (UUID) | 공지를 등록할 프로젝트 UUID |

- Body:

```json
{
  "content": "이번 주 금요일까지 개발 완료해주세요."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| content | string | O | 공지 본문, 최대 2000자 |

**Response**

- 성공: `201 Created`

```json
{
  "id": "c9d0e1f2-a3b4-5678-cdef-ab9012345678",
  "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "projectId": "e1f2a3b4-c5d6-7890-efab-cd1234567890",
  "senderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "senderName": "홍길동",
  "content": "이번 주 금요일까지 개발 완료해주세요.",
  "createdAt": "2026-04-20T01:00:00.000Z"
}
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "내용은 필수입니다." | content 누락 |
| 400 | "내용은 최대 2000자까지 입력 가능합니다." | content 길이 초과 |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "프로젝트를 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 projectId |

---

## 14. 자료실 (Board)

팀 또는 프로젝트별 파일 첨부 게시판입니다. `projectId` 쿼리 파라미터로 프로젝트 자료실을 분리합니다.

**BR-09 파일 검증 규칙**:
- MIME 화이트리스트: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx), `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (xlsx), `application/vnd.openxmlformats-officedocument.presentationml.presentation` (pptx), `text/plain`, `text/markdown`, `application/zip`
- magic-bytes 헤더 검증 필수 (Content-Type 스푸핑 차단)
- 최대 파일 크기: 10MB
- SVG, 실행 파일 업로드 거부 (400 반환)

---

### GET /api/teams/:teamId/board

**설명**: 자료실 글 목록을 조회합니다. `projectId` 지정 시 프로젝트 자료실, 미지정 시 팀 일자별 자료실을 반환합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (해당 팀 소속 구성원)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |

- Query Parameters:

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| projectId | string (UUID) | X | 프로젝트 UUID. 지정 시 해당 프로젝트 자료실 조회 |

**Response**

- 성공: `200 OK`

```json
{
  "projectId": null,
  "posts": [
    {
      "id": "b3c4d5e6-f7a8-9012-bcde-fa3456789012",
      "teamId": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
      "projectId": null,
      "authorId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "authorName": "홍길동",
      "title": "프로젝트 계획서",
      "content": "프로젝트 초기 계획서를 첨부합니다.",
      "createdAt": "2026-04-20T01:00:00.000Z",
      "updatedAt": "2026-04-20T01:00:00.000Z",
      "attachments": [
        {
          "id": "c4d5e6f7-a8b9-0123-cdef-ab4567890123",
          "postId": "b3c4d5e6-f7a8-9012-bcde-fa3456789012",
          "originalName": "project-plan.pdf",
          "mimeType": "application/pdf",
          "sizeBytes": 204800,
          "uploadedAt": "2026-04-20T01:00:00.000Z"
        }
      ]
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| projectId | string \| null | 조회에 사용된 projectId (없으면 null) |
| posts | array | 게시글 배열 |
| posts[].id | string | 게시글 UUID |
| posts[].teamId | string | 소속 팀 UUID |
| posts[].projectId | string \| null | 소속 프로젝트 UUID (팀 일자별이면 null) |
| posts[].authorId | string | 작성자 사용자 UUID |
| posts[].authorName | string | 작성자 표시 이름 |
| posts[].title | string | 게시글 제목 (1~200자) |
| posts[].content | string | 게시글 본문 (최대 20000자) |
| posts[].createdAt | string | 생성 일시 (UTC ISO 8601) |
| posts[].updatedAt | string | 최종 수정 일시 (UTC ISO 8601) |
| posts[].attachments | array | 첨부파일 메타데이터 배열 (없으면 빈 배열) |
| posts[].attachments[].id | string | 첨부파일 UUID |
| posts[].attachments[].postId | string | 소속 게시글 UUID |
| posts[].attachments[].originalName | string | 원본 파일명 |
| posts[].attachments[].mimeType | string | MIME 타입 |
| posts[].attachments[].sizeBytes | number | 파일 크기 (바이트) |
| posts[].attachments[].uploadedAt | string | 업로드 일시 (UTC ISO 8601) |

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "프로젝트를 찾을 수 없습니다." | projectId가 지정되었으나 존재하지 않음 |

---

### POST /api/teams/:teamId/board

**설명**: 자료실에 새 게시글을 작성합니다. 선택적으로 단일 파일을 첨부할 수 있습니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (해당 팀 소속 구성원)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  Content-Type: multipart/form-data
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |

- Body (multipart/form-data):

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | string | O | 게시글 제목 (1~200자) |
| content | string | X | 게시글 본문 (최대 20000자) |
| projectId | string (UUID) | X | 프로젝트 자료실로 저장 시 지정 |
| file | File | X | 첨부파일 (단일, 최대 10MB, BR-09 화이트리스트) |

- fetch 예시:

```javascript
const formData = new FormData()
formData.append('title', '프로젝트 계획서')
formData.append('content', '초기 계획서를 공유합니다.')
formData.append('file', fileInput.files[0])

fetch(`/api/teams/${teamId}/board`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
  body: formData,
})
```

**Response**

- 성공: `201 Created` (응답 형식은 GET 목록의 `posts[]` 단건과 동일)

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "제목은 필수입니다." | title 누락 또는 공백만 입력 |
| 400 | "제목은 최대 200자까지 입력 가능합니다." | title 길이 초과 |
| 400 | "본문은 최대 20000자까지 입력 가능합니다." | content 길이 초과 |
| 400 | "허용되지 않는 파일 형식입니다." | MIME 화이트리스트 미충족 또는 magic-bytes 불일치 (BR-09) |
| 400 | "파일 크기는 최대 10MB입니다." | 파일 크기 초과 (BR-09) |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "프로젝트를 찾을 수 없습니다." | projectId가 지정되었으나 존재하지 않음 |
| 413 | "요청 본문이 너무 큽니다. 첨부파일은 최대 10MB." | Content-Length 초과 |

---

### GET /api/teams/:teamId/board/:postId

**설명**: 자료실 게시글 상세를 조회합니다. 첨부파일 메타데이터를 포함합니다.
**인증**: 필요
**권한**: LEADER·MEMBER 모두 (해당 팀 소속 구성원)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| postId | string (UUID) | 조회할 게시글 UUID |

**Response**

- 성공: `200 OK` (GET 목록의 `posts[]` 단건과 동일한 형식)

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 404 | "글을 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 postId |

---

### PATCH /api/teams/:teamId/board/:postId

**설명**: 자료실 게시글을 수정합니다. 작성자 본인만 수정할 수 있습니다. `file`이 포함되면 기존 첨부파일을 모두 제거하고 신규 파일로 교체합니다.
**인증**: 필요
**권한**: 작성자 본인만 (`authorId === 요청자 userId`)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  Content-Type: multipart/form-data
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| postId | string (UUID) | 수정할 게시글 UUID |

- Body (multipart/form-data):

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | string | X | 새 제목 (1~200자). 전달 시 변경 |
| content | string | X | 새 본문 (최대 20000자). 전달 시 변경 |
| file | File | X | 첨부파일 교체. 전달 시 기존 첨부 unlink 후 신규 저장 |

**Response**

- 성공: `200 OK` (수정 후 최신 게시글 단건)

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "제목은 비울 수 없습니다." | title 필드 전달 시 빈 문자열 |
| 400 | "제목은 최대 200자까지 입력 가능합니다." | title 길이 초과 |
| 400 | "본문은 최대 20000자까지 입력 가능합니다." | content 길이 초과 |
| 400 | "허용되지 않는 파일 형식입니다." | MIME 화이트리스트 미충족 또는 magic-bytes 불일치 (BR-09) |
| 400 | "파일 크기는 최대 10MB입니다." | 파일 크기 초과 (BR-09) |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 403 | "본인이 작성한 글만 수정할 수 있습니다." | 요청자가 작성자가 아님 |
| 404 | "글을 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 postId |
| 413 | "요청 본문이 너무 큽니다." | Content-Length 초과 |

---

### DELETE /api/teams/:teamId/board/:postId

**설명**: 자료실 게시글을 삭제합니다. 작성자 본인만 삭제할 수 있으며, 첨부파일도 함께 unlink합니다.
**인증**: 필요
**권한**: 작성자 본인만 (`authorId === 요청자 userId`)

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| teamId | string (UUID) | 소속 팀 UUID |
| postId | string (UUID) | 삭제할 게시글 UUID |

**Response**

- 성공: `200 OK`

```json
{ "ok": true }
```

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 팀의 구성원이 아님 |
| 403 | "본인이 작성한 글만 삭제할 수 있습니다." | 요청자가 작성자가 아님 |
| 404 | "글을 찾을 수 없습니다." | 존재하지 않거나 해당 팀 소속이 아닌 postId |

---

## 15. 파일 다운로드 (File Download)

자료실 첨부파일 다운로드 endpoint입니다. 스토리지 어댑터에 따라 응답 방식이 자동 분기됩니다.

---

### GET /api/files/:fileId

**설명**: 자료실 첨부파일을 다운로드합니다. 호출자가 해당 첨부파일의 팀 구성원이어야 접근할 수 있습니다.
- **로컬 스토리지**: 파일 스트림 응답 + `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`
- **S3 스토리지**: 302 redirect to presigned URL (TTL 5분)
**인증**: 필요
**권한**: 해당 파일이 속한 팀의 구성원

**Request**

- Headers:
  ```
  Authorization: Bearer <accessToken>
  ```
- Path Parameters:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| fileId | string (UUID) | 다운로드할 첨부파일 UUID |

- Body: 없음

**Response**

- 성공 (로컬): `200 OK` — 파일 바이너리 스트림

  ```
  Content-Type: <파일 MIME 타입>
  Content-Length: <파일 크기 바이트>
  Content-Disposition: attachment; filename*=UTF-8''<인코딩된 파일명>
  X-Content-Type-Options: nosniff
  Cache-Control: private, max-age=300
  ```

- 성공 (S3): `302 Found` — Location 헤더에 presigned URL

- 실패:

| 상태 코드 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 400 | "잘못된 fileId 입니다." | UUID 형식이 아닌 fileId |
| 401 | "인증이 필요합니다." | Access Token 없음 또는 만료 |
| 403 | "해당 팀에 접근 권한이 없습니다." | 요청자가 해당 파일 팀의 구성원이 아님 |
| 404 | "파일을 찾을 수 없습니다." | 존재하지 않는 fileId |
| 410 | "디스크에서 파일을 찾을 수 없습니다." | DB 메타데이터는 있으나 실제 파일 없음 |

---

## 16. AI 버틀러 SSE · STT — Frontend BFF (참고)

> 이 섹션은 **참고 목적**으로만 기술합니다. AI 버틀러·음성 입력(STT) 은 Next.js Frontend BFF route(`frontend/app/api/ai-assistant/`, `frontend/app/api/stt/`)로 구현되어 있으며, 별도의 백엔드 라우트나 Swagger 정의가 없습니다. 실제 데이터 변경은 본 문서의 `/api/teams/...` 엔드포인트를 BFF 에서 호출합니다.

### POST /api/ai-assistant/chat (Frontend BFF)

SSE(Server-Sent Events) 스트리밍으로 AI 응답을 반환합니다.

**6-way 의도 분류**: `usage` (앱 사용법, RAG) / `general` (일반 질답, SearxNG + Open WebUI) / `schedule_query` (일정 조회) / `schedule_create` (일정 등록) / `schedule_update` (일정 수정) / `schedule_delete` (일정 삭제) / `blocked` (일정 외 도메인 거절)

**SSE 이벤트 종류**:

| 이벤트명 | 설명 |
|----------|------|
| `meta` | 분류 결과·source(`rag`/`web`/`schedule`/`blocked`)·model 메타 |
| `token` | AI 응답 토큰 스트림 |
| `awaiting-input` | 다중 턴 — `needs: 'time' / 'date' / 'datetime' / 'title' / 'target'` 등 추가 입력 요청 |
| `pending-action` | 일정 등록·수정·삭제 confirm 카드 데이터 (tool: `createSchedule` / `updateSchedule` / `deleteSchedule`) |
| `sources` | 일반 질문 답변의 출처 URL 5건 (SearxNG) 또는 사용법 답변의 RAG 문서 N건 |
| `done` | 응답 완료 |
| `error` | 오류 발생 |

### POST /api/ai-assistant/execute (Frontend BFF)

`pending-action` 이벤트의 confirm 카드 ✓ 승인 후 도구를 실행합니다. TOOL_WHITELIST = `{createSchedule, updateSchedule, deleteSchedule}`. backend `withAuth`/`withTeamRole` 미들웨어 통과만 허용 (`created_by` 는 JWT userId 로 강제 — args 위조 무시).

### POST /api/stt (Frontend BFF) — 음성 입력

브라우저 `MediaRecorder` blob 을 multipart 로 업로드하면 Whisper 컨테이너(`onerahmet/openai-whisper-asr-webservice`, `faster_whisper`) 가 한국어 텍스트로 변환하여 반환합니다. 노트북 Chrome·iOS Safari·일반 Android Chrome 은 브라우저 내장 Web Speech API 를 사용하므로 이 endpoint 호출 없음. Galaxy/Samsung Internet/Firefox 등 quirk 환경에서만 `useWhisperRecognition` 분기로 호출됩니다.

| 항목 | 내용 |
|---|---|
| 요청 | `multipart/form-data` 의 `audio` 필드 (audio/webm 또는 audio/wav) |
| 응답 | `{ text: "변환된 한국어 텍스트" }` |
| 오디오 영구 저장 | 없음 — Whisper 처리 후 메모리에서 폐기 (BR-13, ERD §3.4) |

---

## 17. 엔드포인트 요약

| 메서드 | 경로 | 설명 | 인증 | 권한 |
|--------|------|------|------|------|
| POST | /api/auth/signup | 회원가입 | 불필요 | 없음 |
| POST | /api/auth/login | 로그인 | 불필요 | 없음 |
| POST | /api/auth/refresh | Access Token 재발급 | 불필요 | 없음 |
| POST | /api/auth/oauth/kakao/start | 카카오 인증 URL 발급 | 불필요 | 없음 |
| GET | /api/auth/oauth/kakao/callback | 카카오 콜백 (JWT→fragment 302) | 불필요 | 없음 |
| GET | /api/auth/me | 내 정보 조회 (세션 복구) | 필요 | 인증 사용자 |
| PATCH | /api/me | 내 프로필(이름) 수정 | 필요 | 본인 |
| GET | /api/me/tasks | 나의 할 일 목록 (내가 LEADER 인 팀의 PENDING 신청 집계) | 필요 | 인증 사용자 (LEADER 인 팀의 항목만 반환, 없으면 빈 배열) |
| GET | /api/teams | 내 팀 목록 조회 | 필요 | LEADER·MEMBER |
| POST | /api/teams | 팀 생성 | 필요 | LEADER·MEMBER |
| GET | /api/teams/public | 공개 팀 목록 조회 (탐색) | 필요 | LEADER·MEMBER |
| GET | /api/teams/:teamId | 팀 상세 조회 | 필요 | LEADER·MEMBER (팀 구성원) |
| PATCH | /api/teams/:teamId | 팀 정보 수정 | 필요 | LEADER만 |
| DELETE | /api/teams/:teamId | 팀 삭제 | 필요 | LEADER만 |
| DELETE | /api/teams/:teamId/members/:userId | 팀원 강제 탈퇴 | 필요 | LEADER만 |
| POST | /api/teams/:teamId/join-requests | 팀 가입 신청 제출 | 필요 | LEADER·MEMBER |
| GET | /api/teams/:teamId/join-requests | 팀 PENDING 가입 신청 목록 조회 | 필요 | LEADER만 |
| PATCH | /api/teams/:teamId/join-requests/:requestId | 가입 신청 승인/거절 | 필요 | LEADER만 |
| GET | /api/teams/:teamId/schedules | 팀 일정 목록 조회 (월/주/일) | 필요 | LEADER·MEMBER |
| POST | /api/teams/:teamId/schedules | 팀 일정 생성 | 필요 | LEADER·MEMBER |
| GET | /api/teams/:teamId/schedules/:scheduleId | 팀 일정 상세 조회 | 필요 | LEADER·MEMBER |
| PATCH | /api/teams/:teamId/schedules/:scheduleId | 팀 일정 수정 | 필요 | 생성자 본인만 |
| DELETE | /api/teams/:teamId/schedules/:scheduleId | 팀 일정 삭제 | 필요 | 생성자 본인만 |
| GET | /api/teams/:teamId/messages | 채팅 메시지 조회 (팀 일자별) | 필요 | LEADER·MEMBER |
| POST | /api/teams/:teamId/messages | 채팅 메시지 전송 (팀 일자별) | 필요 | LEADER·MEMBER |
| GET | /api/teams/:teamId/notices | 공지사항 목록 조회 (팀 일자별) | 필요 | LEADER·MEMBER |
| POST | /api/teams/:teamId/notices | 공지사항 등록 (팀 일자별) | 필요 | LEADER·MEMBER |
| DELETE | /api/teams/:teamId/notices/:noticeId | 공지사항 삭제 | 필요 | 작성자 또는 LEADER |
| GET | /api/teams/:teamId/postits | 월별 포스트잇 목록 | 필요 | LEADER·MEMBER |
| POST | /api/teams/:teamId/postits | 포스트잇 생성 | 필요 | LEADER·MEMBER |
| PATCH | /api/teams/:teamId/postits/:postitId | 포스트잇 본문 수정 | 필요 | 생성자 본인만 |
| DELETE | /api/teams/:teamId/postits/:postitId | 포스트잇 삭제 | 필요 | 생성자 본인만 |
| GET | /api/teams/:teamId/projects | 프로젝트 목록 | 필요 | LEADER·MEMBER |
| POST | /api/teams/:teamId/projects | 프로젝트 생성 | 필요 | LEADER·MEMBER |
| GET | /api/teams/:teamId/projects/:projectId | 프로젝트 상세 | 필요 | LEADER·MEMBER |
| PATCH | /api/teams/:teamId/projects/:projectId | 프로젝트 수정 | 필요 | 생성자 본인만 |
| DELETE | /api/teams/:teamId/projects/:projectId | 프로젝트 삭제 | 필요 | 생성자 본인만 |
| GET | /api/teams/:teamId/projects/:projectId/messages | 프로젝트 채팅 조회 | 필요 | LEADER·MEMBER |
| POST | /api/teams/:teamId/projects/:projectId/messages | 프로젝트 채팅 전송 | 필요 | LEADER·MEMBER |
| GET | /api/teams/:teamId/projects/:projectId/notices | 프로젝트 공지 목록 | 필요 | LEADER·MEMBER |
| POST | /api/teams/:teamId/projects/:projectId/notices | 프로젝트 공지 등록 | 필요 | LEADER·MEMBER |
| GET | /api/teams/:teamId/projects/:projectId/schedules | 프로젝트 일정 목록 | 필요 | LEADER·MEMBER |
| POST | /api/teams/:teamId/projects/:projectId/schedules | 프로젝트 일정 생성 | 필요 | LEADER·MEMBER |
| PATCH | /api/teams/:teamId/projects/:projectId/schedules/:scheduleId | 프로젝트 일정 수정 | 필요 | 생성자 본인만 |
| DELETE | /api/teams/:teamId/projects/:projectId/schedules/:scheduleId | 프로젝트 일정 삭제 | 필요 | 생성자 본인만 |
| GET | /api/teams/:teamId/projects/:projectId/schedules/:scheduleId/sub-schedules | 서브 일정 목록 | 필요 | LEADER·MEMBER |
| POST | /api/teams/:teamId/projects/:projectId/schedules/:scheduleId/sub-schedules | 서브 일정 생성 | 필요 | LEADER·MEMBER |
| PATCH | /api/teams/:teamId/projects/:projectId/schedules/:scheduleId/sub-schedules/:subId | 서브 일정 수정 | 필요 | 생성자 본인만 |
| DELETE | /api/teams/:teamId/projects/:projectId/schedules/:scheduleId/sub-schedules/:subId | 서브 일정 삭제 | 필요 | 생성자 본인만 |
| GET | /api/teams/:teamId/board | 자료실 글 목록 | 필요 | LEADER·MEMBER |
| POST | /api/teams/:teamId/board | 자료실 글 작성 (multipart) | 필요 | LEADER·MEMBER |
| GET | /api/teams/:teamId/board/:postId | 자료실 글 상세 | 필요 | LEADER·MEMBER |
| PATCH | /api/teams/:teamId/board/:postId | 자료실 글 수정 (multipart) | 필요 | 작성자 본인만 |
| DELETE | /api/teams/:teamId/board/:postId | 자료실 글 삭제 | 필요 | 작성자 본인만 |
| GET | /api/files/:fileId | 첨부파일 다운로드 | 필요 | 해당 팀 구성원 |
| GET | /api/teams/:teamId/work-permissions | 업무보고 조회 권한 목록 조회 | 필요 | LEADER·MEMBER |
| PATCH | /api/teams/:teamId/work-permissions | 업무보고 조회 권한 일괄 설정 | 필요 | LEADER만 |

---

## 18. 관련 문서

| 문서 | 경로 |
|------|------|
| 도메인 정의서 | docs/1-domain-definition.md |
| PRD | docs/2-prd.md |
| ERD | docs/6-erd.md |
