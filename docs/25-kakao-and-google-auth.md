# 25. 카카오톡·구글 소셜 인증 도입 계획서

> **문서 목적** — 현재 이메일/비밀번호 자체 인증에 카카오·구글 OAuth 2.0 을 추가하기 위한 영향도 분석, 기술 설계, 단계별 구현 계획을 정리합니다.
>
> **범위** — DB 스키마, 백엔드 API, 프론트엔드 UI/UX, 외부 Provider 사전 등록, 보안 고려, 마이그레이션 전략, 단계별 일정.

---

## 문서 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2026-05-15 | 최초 작성 — 카카오·구글 OAuth 도입 계획 + 문제점 정리 |

---

## 0. 한눈에 보기 (Executive Summary)

| 항목 | 내용 |
|------|------|
| **현재** | 이메일 + 비밀번호 (bcryptjs 해시) + JWT (access/refresh) |
| **신규** | 위 + **카카오 OAuth 2.0** + **구글 OAuth 2.0** |
| **핵심 변경** | DB `users.password_hash` nullable 화 + `oauth_accounts` 신규 테이블 + `/api/auth/oauth/{provider}/{start,callback}` 라우트 + 로그인/회원가입 UI 에 소셜 버튼 2종 |
| **위험도** | 중 — 기존 사용자 호환성 + 동일 이메일 충돌 + Provider 정책 변경 의존성 |
| **예상 공수** | 5~8일 (Phase 1: 카카오 3~4일, Phase 2: 구글 1~2일, Phase 3: 기존 사용자 연결·테스트 1~2일) |

---

## 1. 현재 인증 시스템 현황

### 1.1 코드 구조

```
backend/
  app/api/auth/
    signup/route.ts       — 이메일·비번·이름 → users INSERT, JWT 발급
    login/route.ts        — 이메일·비번 검증 → JWT 발급
    refresh/route.ts      — refresh token 으로 access token 재발급
    me/route.ts           — 현재 사용자 정보 조회 (JWT 검증)
  lib/
    auth/
      jwt.ts              — generateAccessToken·generateRefreshToken·verify*
      password.ts         — bcryptjs.hash (rounds=10) / compare
    middleware/
      withAuth.ts         — Authorization: Bearer <jwt> 헤더 검증

frontend/
  components/auth/
    LoginForm.tsx         — 이메일·비번 입력 → /api/auth/login
    SignupForm.tsx        — 이메일·비번·이름 입력 → /api/auth/signup
```

### 1.2 DB 스키마

```sql
CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL,
    name          VARCHAR(50)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,   -- ⚠️ NOT NULL
    created_at    TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_email UNIQUE (email)
);
```

### 1.3 토큰 정책

| 토큰 | 수명 | 저장 위치 | 용도 |
|------|------|----------|------|
| access | 1h | localStorage | API 인증 (Authorization 헤더) |
| refresh | 14d | httpOnly 쿠키 | access 토큰 재발급 |

---

## 2. 도입 목표 · 기대효과

### 2.1 목표
- 신규 사용자 회원가입 진입 장벽 낮추기 (이메일 + 비번 수동 입력 → 한 번 클릭)
- 한국 시장 (카카오) + 글로벌 (구글) 동시 커버
- 비밀번호 분실·관리 부담 제거 (특히 모바일)

### 2.2 기대효과
- 회원가입 전환율 ↑ (업계 평균 OAuth 도입 시 30~50% 개선)
- 비밀번호 재설정 문의 감소
- 이메일 검증 절차 생략 가능 (Provider 가 검증된 이메일 제공)

---

## 3. 핵심 문제점 (Issues)

### 3.1 ⚠️ 동일 이메일 충돌

가장 큰 위험. 시나리오:

| 사용자 행위 | 결과 |
|------------|------|
| ① `kim@gmail.com` 으로 자체 가입 (비밀번호 설정) → 다음에 같은 이메일로 구글 로그인 시도 | 별도 계정으로 처리할 것인가, 자동 연결할 것인가? |
| ② 카카오 가입 (`kim@kakao.com`) → 이후 이메일로 자체 가입 시도 | 동일 |
| ③ 카카오 계정의 이메일이 비공개·미동의 | `email IS NULL` 사용자 처리 필요 |

**정책 결정 필요** (이 문서에서는 **권장안 — 자동 연결**):
- 동일 이메일이 이미 존재하면 → 그 사용자 계정에 OAuth 연결 추가 (별도 계정 X)
- 단, 카카오 미동의로 이메일 없으면 → 별도 익명 계정 생성, 추후 이메일 연결 유도

### 3.2 ⚠️ password_hash NOT NULL 제약

OAuth 만 쓰는 사용자는 비밀번호가 없습니다. 두 가지 해결책:

| 안 | 설명 | 장단점 |
|----|------|--------|
| **A. nullable 화** ✅ 권장 | `password_hash` NOT NULL → NULL 허용. INSERT 시 NULL | 단순. 기존 데이터 영향 없음 |
| B. 더미 값 | `''` 또는 `'OAUTH_ONLY'` 같은 sentinel 저장 | 비밀번호 검증 시 명시적 거부 로직 필요. 더러움 |

### 3.3 카카오 이메일 정책

- 카카오는 사용자가 동의해야 이메일 제공 (비동의 시 `NULL`)
- 사업자/개인 개발자 모두 사전 검수 필요 (비즈 채널 등록)
- 일부 카카오 계정은 휴대폰 번호로 가입되어 이메일 자체가 없음

→ **계획**: 이메일 동의 항목을 필수로 요구. 미동의 시 가입 거절 + 안내 메시지.

### 3.4 PKCE · State 보안 의무

- OAuth 2.0 표준에서 CSRF 방지를 위해 `state` 파라미터 필수
- 모바일 앱이 아닌 웹이라 PKCE 는 선택이지만 추가하면 안전성 ↑
- redirect URI mismatch 가 가장 흔한 도입 실패 원인

### 3.5 Refresh Token 저장 정책 충돌

- 현재: refresh token 을 httpOnly 쿠키에 저장 (자체 발급 JWT)
- OAuth Provider 의 access/refresh 토큰은 우리 JWT 와 **별개**
- 정책: Provider 토큰은 **저장하지 않음**. OAuth 는 1회 인증용으로만 쓰고, 그 결과로 우리 JWT 만 발급

→ Provider API 를 추후 호출할 일이 없다면 (현재 시나리오) Provider refresh 토큰 보관 불필요. 보관하면 보안 부담만 늘어남.

### 3.6 Account Linking 시 인증

이미 자체 가입한 사용자가 같은 이메일로 OAuth 로그인 시:
- "이 이메일은 이미 가입되어 있습니다. 비밀번호로 로그인 후 연결하시겠습니까?" → 비밀번호 1회 검증 후 연결
- 또는 자동 연결 (이메일 신뢰 가정) — UX 우선이지만 **계정 탈취 위험**

→ **권장**: 자동 연결 (이메일이 동일 + Provider 가 검증된 이메일 제공) + 알림 메일 발송

### 3.7 이메일 변경 시 동기화

- 사용자가 카카오에서 이메일 변경 → 우리 DB 와 불일치
- 정책: 우리 DB 의 이메일은 **첫 가입 시점 고정**. 변경하려면 자체 설정 화면에서 직접.

### 3.8 회원 탈퇴 시 OAuth Unlink

- 우리 시스템 탈퇴 시 → DB CASCADE 로 oauth_accounts 도 삭제
- Provider 측 연결은 유지 (Provider 의 "연결된 앱 관리" 에서만 해제 가능)

### 3.9 .my 도메인 리다이렉션 콜백

- `.my` 는 일부 OAuth Provider 콘솔에서 등록 시 형식 검증이 까다로울 수 있음 (커스텀 도메인 사전 검증)
- 카카오: HTTPS 도메인 등록 필수. `https://teamworks.my/api/auth/oauth/kakao/callback` 등록
- 구글: 동일

### 3.10 모바일 in-app 브라우저

- 카카오톡 / 인스타그램 in-app 브라우저는 **구글 OAuth 차단** (보안 정책)
- 사용자가 in-app 브라우저로 접속 → 구글 로그인 → "보안 위험" 에러
- 해결: in-app 브라우저 감지 → "외부 브라우저로 열기" 안내

---

## 4. DB 스키마 변경

### 4.1 users 테이블

```sql
-- password_hash NOT NULL 해제
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

-- 이메일 nullable 화 (카카오 이메일 미동의 케이스)
-- 단, NULL 허용 시 UNIQUE 제약은 NULL 허용 (PG 기본 동작)
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL;
```

### 4.2 oauth_accounts (신규)

```sql
CREATE TABLE oauth_accounts (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider          VARCHAR(20)  NOT NULL,        -- 'kakao' | 'google'
    provider_user_id  VARCHAR(255) NOT NULL,        -- 카카오 회원번호 / 구글 sub
    provider_email    VARCHAR(255) NULL,            -- Provider 가 제공한 이메일 (동의 시)
    provider_name     VARCHAR(255) NULL,            -- Provider 가 제공한 이름·닉네임
    provider_picture  TEXT         NULL,            -- 프로필 이미지 URL
    linked_at         TIMESTAMP    NOT NULL DEFAULT now(),
    last_login_at     TIMESTAMP    NULL,
    CONSTRAINT chk_oauth_provider CHECK (provider IN ('kakao', 'google')),
    -- 같은 Provider 의 같은 외부 ID 는 한 사용자에게만 매핑
    CONSTRAINT uq_oauth_provider_pid UNIQUE (provider, provider_user_id),
    -- 한 사용자가 같은 Provider 를 두 번 연결할 수 없음
    CONSTRAINT uq_oauth_user_provider UNIQUE (user_id, provider)
);

CREATE INDEX idx_oauth_user_id ON oauth_accounts(user_id);
```

### 4.3 마이그레이션 스크립트

`database/alter-users-oauth-support.sql` 신규 작성. 단일 트랜잭션:
```sql
BEGIN;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
CREATE TABLE oauth_accounts (...);
COMMIT;
```

→ 기존 사용자 영향 없음 (NOT NULL 만 해제).

---

## 5. 백엔드 API 설계

### 5.1 신규 라우트

```
POST  /api/auth/oauth/kakao/start       → 카카오 인증 URL 생성 + state 발급
GET   /api/auth/oauth/kakao/callback    → 콜백, code 교환, 사용자 조회/생성, JWT 발급
POST  /api/auth/oauth/google/start      → 구글 인증 URL 생성
GET   /api/auth/oauth/google/callback   → 콜백 처리

GET   /api/auth/oauth/accounts          → 내 연결된 OAuth 목록
POST  /api/auth/oauth/{provider}/link   → 로그인 상태에서 OAuth 추가 연결
DELETE /api/auth/oauth/{provider}/unlink → 연결 해제 (단, 비밀번호 또는 다른 OAuth 1개 이상 남아야 함)
```

### 5.2 Start 흐름

```
1. 클라이언트: POST /api/auth/oauth/kakao/start { redirectAfter: '/teams/...' }
2. 서버:
   - state = randomUUID()
   - PKCE: code_verifier = base64url(rand 32B), code_challenge = sha256(verifier)
   - Redis 또는 짧은 수명 DB 테이블에 { state → code_verifier, redirectAfter, createdAt } 저장 (TTL 5분)
   - 카카오 인증 URL 생성:
     https://kauth.kakao.com/oauth/authorize?
       client_id=KAKAO_CLIENT_ID&
       redirect_uri=https://teamworks.my/api/auth/oauth/kakao/callback&
       response_type=code&
       state={state}&
       scope=account_email,profile_nickname,profile_image&
       code_challenge={code_challenge}&
       code_challenge_method=S256
   - 클라이언트에 URL 반환
3. 클라이언트: window.location = url
```

### 5.3 Callback 흐름

```
1. Provider → GET /api/auth/oauth/kakao/callback?code=...&state=...
2. 서버:
   a. state 검증 (저장소 조회 + TTL 확인)
   b. code → access_token 교환 (POST https://kauth.kakao.com/oauth/token)
   c. access_token 으로 사용자 정보 조회 (GET https://kapi.kakao.com/v2/user/me)
   d. provider_user_id (카카오 회원번호) 로 oauth_accounts 조회
      - 있음 → 해당 user 로 로그인
      - 없음 → 이메일 매칭 시도 → 자동 연결 또는 신규 가입
   e. JWT (access + refresh) 발급
   f. 302 리다이렉트 → /auth/oauth/success?token=... 또는 redirectAfter
3. 클라이언트: success 페이지에서 토큰 저장 + 리다이렉트
```

### 5.4 자동 연결·신규 가입 의사결정 로직

```
provider_user_id 로 조회
├─ 매칭됨 → 그 user 로 로그인 ✓
└─ 없음
   ├─ 이메일 제공받음
   │  ├─ users.email 매칭 → 기존 user 에 oauth 연결 + 알림 메일 ✓
   │  └─ 매칭 없음 → 신규 user + oauth 동시 생성 ✓
   └─ 이메일 미제공 (카카오 비동의)
      └─ "이메일 동의 후 다시 시도" 안내 (가입 거절)
```

### 5.5 환경변수

```env
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
KAKAO_REDIRECT_URI=https://teamworks.my/api/auth/oauth/kakao/callback

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://teamworks.my/api/auth/oauth/google/callback

OAUTH_STATE_SECRET=...   # state 서명용 (HMAC) — Redis 대신 stateless 도 옵션
```

### 5.6 코드 의존성

```
backend/lib/auth/oauth/
  kakao.ts      — 카카오 토큰 교환·사용자 조회 함수
  google.ts     — 구글 토큰 교환·사용자 조회 함수
  state.ts      — state·PKCE verifier 저장/조회 (Redis 또는 짧은 수명 DB)
  linking.ts    — oauth_accounts CRUD + user 매칭 로직
```

신규 npm 패키지: 없음 (fetch 만 사용). 카카오·구글 모두 단순 REST API.

---

## 6. 프론트엔드 UI/UX 변경

### 6.1 LoginForm

```
┌────────────────────────────────────────┐
│  TEAM WORKS 로그인                      │
│                                        │
│  [이메일 입력란]                        │
│  [비밀번호 입력란]                      │
│  [로그인]                               │
│                                        │
│  ──────  또는 소셜 계정으로  ──────     │
│                                        │
│  [🟡 카카오로 시작하기]                  │
│  [🔵 구글로 시작하기]                    │
│                                        │
│  계정이 없으신가요? 회원가입 →          │
└────────────────────────────────────────┘
```

- 카카오 버튼: 카카오 디자인 가이드 준수 (노란 배경 #FEE500, 검정 텍스트, 카카오 심볼)
- 구글 버튼: 구글 브랜딩 가이드 (흰 배경 + 회색 테두리 + 구글 G 로고)

### 6.2 SignupForm

- 동일하게 하단에 소셜 가입 버튼 노출
- 소셜 가입 클릭 시 OAuth 흐름 → 콜백에서 user 자동 생성

### 6.3 OAuth 콜백 success 페이지 (신규)

`/auth/oauth/success?token=...&refresh=...&redirectAfter=...`
- 토큰을 localStorage 에 저장 + refresh 쿠키는 서버가 Set-Cookie 로 처리
- redirectAfter 가 있으면 그 경로로, 없으면 `/`

### 6.4 마이페이지 — 연결된 계정 관리 (신규)

```
┌─────────────────────────────────┐
│ 연결된 소셜 계정                 │
├─────────────────────────────────┤
│ 🟡 카카오  연결됨 ✓  [해제]    │
│ 🔵 구글   미연결    [연결]     │
└─────────────────────────────────┘
```

- 연결 해제 정책: 비밀번호 또는 다른 OAuth 가 1개 이상 남아 있어야 가능 (계정 잠금 방지)

### 6.5 In-app 브라우저 안내 모달

카카오톡 / 페이스북 등 in-app 브라우저 감지 (User-Agent 검출) → 구글 로그인 시 "외부 브라우저(크롬·사파리)로 열기" 안내 모달.

---

## 7. OAuth Provider 사전 등록

### 7.1 카카오

1. https://developers.kakao.com → 앱 생성 ("TEAM WORKS")
2. 플랫폼 → Web 도메인 등록: `https://teamworks.my`
3. 카카오 로그인 → 활성화
4. Redirect URI 등록: `https://teamworks.my/api/auth/oauth/kakao/callback`
5. 동의 항목 설정:
   - 닉네임 (필수)
   - 프로필 사진 (선택)
   - 카카오계정 이메일 (필수) — **비즈 앱 등록 필요**
6. 비즈 앱 등록 (사업자번호 또는 개인 개발자 등록)
7. 보안 → Client Secret 발급 + 사용

### 7.2 구글

1. https://console.cloud.google.com → 프로젝트 생성
2. API 및 서비스 → OAuth 동의 화면 → 외부 사용자
3. 앱 정보 입력 (이름, 로고, 개인정보 처리방침 URL, 도메인)
4. 범위 추가: `openid`, `profile`, `email`
5. 사용자 인증 정보 → OAuth 클라이언트 ID 만들기 → 웹 애플리케이션
6. 승인된 리디렉션 URI: `https://teamworks.my/api/auth/oauth/google/callback`
7. 클라이언트 ID·Secret 발급

### 7.3 게시 검수

- **카카오**: 비즈 앱 검수 (1~3일)
- **구글**: 검수 없이도 100명까지 테스트 가능. 그 이상이면 OAuth 검수 (스코프에 따라 1~6주)
- 우리는 `openid·profile·email` 만 쓰니 **검수 면제 범위**

---

## 8. 보안 고려

| 항목 | 대응 |
|------|------|
| **CSRF (state)** | 모든 인증 요청에 state 발급, 콜백에서 일치 검증 (TTL 5분) |
| **PKCE** | 웹이지만 추가 적용 — code_verifier ↔ code_challenge |
| **Open Redirect** | redirectAfter 화이트리스트 검증 (origin 동일성) |
| **Token Replay** | 우리 JWT 정책 그대로 — access 1h, refresh 14d |
| **Provider 토큰 미저장** | 사용자 정보 조회 직후 폐기. DB 저장 X |
| **계정 탈취 (자동 연결)** | 자동 연결 시 사용자에게 알림 메일 발송 (가입 이메일로) |
| **Email Enumeration** | OAuth 콜백에서 "이미 가입된 이메일" 메시지 노출 안 함 — 항상 동일 응답 |
| **Brute Force** | OAuth 는 Provider 가 차단. 자체 로그인은 기존대로 rate limit |
| **HTTPS 강제** | `.my` 도메인 + Provider 콘솔 모두 HTTPS 만 등록 |

---

## 9. 마이그레이션 · 기존 사용자 전환

### 9.1 기존 사용자 영향

| 케이스 | 동작 |
|--------|------|
| 기존 이메일/비번 사용자 | **변화 없음**. 그대로 로그인 가능 |
| 기존 사용자가 같은 이메일로 카카오 로그인 시도 | 자동 연결 + 알림 메일 (정책 시 — §3.6) |
| 기존 사용자가 마이페이지에서 OAuth 수동 연결 | 비밀번호 인증 후 연결 |

### 9.2 데이터 마이그레이션
- DB 스키마 변경만 (NOT NULL 해제 + 신규 테이블 생성)
- **기존 데이터 변경 없음** — 다운타임 불필요

### 9.3 점진적 출시
1. **Phase 1**: 카카오만 활성화 (한국 사용자 대상)
2. **Phase 2**: 구글 추가
3. **Phase 3**: 마이페이지 연결 관리 + 알림 메일

---

## 10. 단계별 구현 계획

### Phase 1 — 카카오 OAuth (3~4일)

| Day | 작업 |
|-----|------|
| 1 | 카카오 디벨로퍼스 앱 등록 + 비즈 앱 검수 신청 (병렬), DB 마이그레이션 작성·적용 |
| 1~2 | 백엔드 `/api/auth/oauth/kakao/start`·`/callback` 구현, state·PKCE 저장소 (Redis 우선, 없으면 짧은 수명 DB) |
| 2 | linking.ts (provider_user_id 매칭, 자동 연결, 신규 가입 분기) |
| 3 | 프론트 LoginForm·SignupForm 에 카카오 버튼, OAuth success 페이지 |
| 3~4 | 통합 테스트 — 신규 가입, 기존 이메일 자동 연결, 이메일 미동의 케이스, in-app 브라우저 |
| 4 | 검수 완료 후 운영 배포 |

### Phase 2 — 구글 OAuth (1~2일)

| Day | 작업 |
|-----|------|
| 1 | 구글 클라우드 콘솔 앱 등록, OAuth 동의 화면 |
| 1 | 백엔드 `google.ts` 추가 (kakao.ts 와 거의 동일) |
| 1~2 | 프론트 구글 버튼 추가, 통합 테스트 |
| 2 | 운영 배포 |

### Phase 3 — 마이페이지 연결 관리 (1~2일)

| Day | 작업 |
|-----|------|
| 1 | `GET /api/auth/oauth/accounts` + 마이페이지 연결 관리 UI |
| 1 | 연결·해제 라우트 + 안전장치 (비번 또는 다른 OAuth 1개 이상 보장) |
| 1~2 | 자동 연결 시 알림 메일 발송 (Resend·SendGrid 등) |

### 총 5~8일

---

## 11. 테스트 계획

### 11.1 단위
- `kakao.ts·google.ts` 토큰 교환·사용자 조회 함수 (mock fetch)
- `linking.ts` 매칭 로직 — 4가지 분기 (일치, 이메일 매칭, 이메일 미매칭, 이메일 미제공)
- state·PKCE 저장소 TTL 검증

### 11.2 통합
- 카카오 신규 가입 (실제 계정으로 staging 환경에서)
- 카카오 로그인 (재방문)
- 자체 가입 → 카카오 자동 연결
- 카카오 이메일 미동의 → 에러 메시지
- 구글 동일 시나리오
- 두 Provider 동시 연결된 계정의 동작
- 연결 해제 안전장치 (마지막 인증 수단 해제 차단)

### 11.3 보안
- state mismatch → 거부
- state 만료 → 거부
- PKCE verifier mismatch → 거부
- Open Redirect 시도 (`?redirectAfter=https://evil.com`) → 거부
- Email enumeration 시도 → 응답 동일성 확인

### 11.4 모바일
- 안드로이드 크롬 — 카카오·구글 모두 동작
- iOS 사파리 — 동일
- 카카오톡 in-app 브라우저 — 안내 모달 노출
- 인스타그램 in-app — 안내 모달 노출

### 11.5 회귀
- 기존 이메일/비번 로그인 — 영향 없음
- 회원가입 → 팀 가입 → 일정 등록 전체 흐름

---

## 12. 위험 평가 + 대응

| 위험 | 영향 | 가능성 | 대응 |
|------|------|--------|------|
| 카카오 비즈 앱 검수 지연 | 출시 지연 | 중 | Phase 1 시작 즉시 검수 신청 |
| 동일 이메일 자동 연결로 인한 계정 탈취 | 매우 높음 | 낮음 | 자동 연결 시 알림 메일 + 24시간 내 본인 확인 가능 회수 절차 |
| Provider 정책 변경 (스코프·동의항목) | 중 | 낮음 | provider 별 어댑터 분리 (`kakao.ts`·`google.ts`) — 변경 영향 최소화 |
| in-app 브라우저로 구글 로그인 실패 | UX 저하 | 높음 | User-Agent 감지 + 외부 브라우저 안내 모달 |
| `.my` 도메인 콜백 거부 | 출시 차단 | 낮음 | Provider 콘솔에 사전 검증 요청, 서브도메인 fallback 준비 |
| Provider 다운 시 로그인 불가 | 일시적 | 낮음 | 자체 이메일 로그인은 항상 살아있어 전체 차단은 아님 |

---

## 13. 의사결정 필요 항목 (사용자 결정)

문서 검토 후 아래 항목에 대해 결정이 필요합니다:

1. **자동 연결 정책** (§3.1, §3.6) — 기존 자체 가입 사용자가 동일 이메일로 OAuth 시도 시:
   - **A. 자동 연결 + 알림 메일** (UX 우선) ← 권장
   - B. 비밀번호 1회 검증 후 연결 (보안 우선)

2. **카카오 이메일 미동의 처리** (§3.3):
   - **A. 가입 거절 + "이메일 동의 후 다시 시도" 안내** ← 권장
   - B. 익명 계정 생성 + 이후 이메일 보완

3. **state·PKCE 저장소**:
   - **A. Redis** (현재 인프라에 추가 필요) — 권장
   - B. 짧은 수명 DB 테이블 (`oauth_state` TTL 5분)
   - C. stateless (HMAC 서명된 state 자체에 verifier 임베드)

4. **Phase 우선순위**:
   - **A. 카카오 → 구글 → 마이페이지** ← 권장 (한국 사용자 우선)
   - B. 카카오·구글 동시 → 마이페이지

---

## 14. 부록 — 주요 외부 문서 링크

- 카카오 로그인 REST API: https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api
- 카카오 사용자 정보 가져오기: https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#req-user-info
- Google Identity OAuth 2.0: https://developers.google.com/identity/protocols/oauth2/web-server
- OAuth 2.0 PKCE (RFC 7636): https://datatracker.ietf.org/doc/html/rfc7636
- Account Linking 모범 사례: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
