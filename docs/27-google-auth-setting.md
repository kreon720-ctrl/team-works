# 27. 구글 인증 설정 — 운영 배포(`https://teamworks.my`)

개발 환경(`http://localhost:8080`)을 운영 도메인(`https://teamworks.my`)으로 전환할 때 필요한
**구글 로그인 + 구글 캘린더 연동** 설정 변경 사항을 정리합니다.

> 변경은 **Google Cloud Console**(콘솔)과 **앱 환경변수**(서버) **양쪽**을 정확히 일치시켜야 합니다.
> 대상 GCP 프로젝트: OAuth 클라이언트 ID 가 `863968083830-…` 인 프로젝트(번호 `863968083830`).

---

## 사용하는 콜백 경로 (참고)

| 기능 | 시작 | 콜백(리디렉션) |
|---|---|---|
| 구글 로그인 | `/api/auth/oauth/google/start` | `/api/auth/oauth/google/callback` |
| 구글 캘린더 연동 | `/api/auth/oauth/google/calendar/start` | `/api/auth/oauth/google/calendar/callback` |

요청 scope: `openid profile email` + `https://www.googleapis.com/auth/calendar.events`(민감 범위)

---

## A. Google Cloud Console — OAuth 2.0 클라이언트 ID

**API 및 서비스 → 사용자 인증 정보 → 해당 OAuth 2.0 클라이언트 ID 편집**

**1) 승인된 JavaScript 원본** 추가:
```
https://teamworks.my
```

**2) 승인된 리디렉션 URI** 추가 (2개):
```
https://teamworks.my/api/auth/oauth/google/callback
https://teamworks.my/api/auth/oauth/google/calendar/callback
```

> ⚠️ 스킴·호스트·경로가 앱 env 값과 **한 글자도 다르면 안 됩니다**(끝 슬래시 없음).
> 불일치 시 `redirect_uri_mismatch` 오류가 납니다.
> 개발을 계속하려면 기존 `http://localhost:8080/...` 2개는 **그대로 둬도 됩니다**(다중 등록 가능).

---

## B. Google Cloud Console — OAuth 동의 화면

- **승인된 도메인(Authorized domains)** 에 `teamworks.my` 추가
- **앱 홈페이지**: `https://teamworks.my`
- **서비스 약관 URL**: `https://teamworks.my/landing/terms.html`
- **개인정보처리방침 URL**: `https://teamworks.my/landing/privacy.html`
- **게시 상태**: 프로덕션
- **검증(Verification)**: `calendar.events`(민감 범위)를 쓰므로 "확인하지 않은 앱" 경고를 없애려면 검증 제출 필요
  (보안 평가는 불필요 — 홈페이지·개인정보처리방침·OAuth 흐름 데모 영상 준비)

> 약관·개인정보 페이지는 인증 없이 접근 가능한 정적 페이지입니다
> (`frontend/public/landing/terms.html`·`privacy.html`, nginx 가 그대로 서빙).

---

## B-2. OAuth 검증(Verification) 제출

`calendar.events`(민감 범위)를 쓰므로, "확인하지 않은 앱" 경고를 없애려면 검증을 받아야 합니다.
**검증만 받으면 되고, 비용 큰 보안 평가(3rd-party security assessment)는 불필요**합니다.

### 1) 제출 전 사전 조건 (전부 충족돼야 제출 버튼이 활성화됨)

| 항목 | 값 / 확인 |
|---|---|
| OAuth 동의 화면 — 앱 이름 | TEAM WORKS |
| — 사용자 지원 이메일 / 개발자 연락처 이메일 | (운영 이메일) |
| — 앱 로고 | 업로드 권장(검증 신뢰도↑) |
| — 승인된 도메인 | `teamworks.my` |
| — 앱 홈페이지 | `https://teamworks.my` |
| — 서비스 약관 URL | `https://teamworks.my/landing/terms.html` |
| — 개인정보처리방침 URL | `https://teamworks.my/landing/privacy.html` |
| 게시 상태 | **프로덕션** |
| **도메인 소유권** | **Google Search Console 에서 `teamworks.my` 소유권 인증** (필수) |
| 앱 라이브 여부 | 홈페이지·약관·개인정보 URL 모두 **공개 접근 가능**해야 함 |

> ⚠️ 가장 빠뜨리기 쉬운 것: **도메인 소유권 확인**. 동의 화면의 "승인된 도메인"은 Search Console 에서 인증된 도메인이어야 합니다.
> (Search Console → 속성 추가 → `teamworks.my` → DNS TXT 레코드 또는 HTML 파일로 인증)

### 2) 검증 요청 시작

1. Google Cloud Console → **API 및 서비스 → OAuth 동의 화면** (새 UI: **Google Auth Platform → 확인 센터(Verification center)**)
2. 민감 범위가 있으면 상단에 **"확인을 위해 준비 / 확인 요청 제출"**(Prepare for / Submit for verification) 안내 → 클릭

### 3) 검증 폼 작성

- **연락처 이메일** 확인
- **각 민감 범위 사용 사유(justification)** — `calendar.events` 에 대해 "왜 필요한지 + 앱에서 어떻게 쓰는지" 서술. 예시:
  > 사용자가 동의한 경우, 팀웍스에서 등록·수정·삭제한 일정을 사용자 본인의 Google 캘린더에 양방향 동기화하기 위해 `calendar.events` 권한이 필요합니다. 사용자가 만든 이벤트만 읽고 쓰며, 다른 캘린더 데이터에는 접근하지 않습니다.
- **데모 영상(YouTube) URL** 첨부

### 4) 데모 영상 요건 (반려 1순위 — 반드시 포함)

1. OAuth **동의 화면**이 보이고, 그 URL 에 **클라이언트 ID**(`863968083830-…`)가 보이는 장면
2. 사용자가 **동의(Allow)** 하는 과정
3. 앱에서 **`calendar.events` 를 실제 사용하는 화면** — 예: 팀웍스에서 일정 등록 → **Google 캘린더에 반영**되는 모습
4. 영어 또는 영어 자막 권장

### 5) 제출 → 검토

- 며칠~수 주 소요. Google 이 **이메일로 추가 자료를 요청**할 수 있으니 연락처 이메일을 확인.
- 검토 중에도 앱은 **"확인하지 않은 앱" 경고와 함께 사용 가능**(고급 → 계속). 검증 완료 시 경고가 사라짐.

> 막히는 1·2순위: **도메인 소유권 미인증**, **데모 영상에 scope 사용 장면 누락**.

---

## C. 앱 환경변수 — 운영용 별도 파일

개발환경을 깨뜨리지 않도록, 운영 값은 dev 파일(`.env`, `backend/.env.local`)을 직접 고치지 않고
**별도 운영 파일**로 분리해 두었습니다. (둘 다 `.gitignore` 등록 — 시크릿 포함, 커밋 안 됨)

| 운영 파일 | 운영 서버에서 복사 위치 | 차이 |
|---|---|---|
| `.env.production` | `.env` | `PUBLIC_BASE_URL=https://teamworks.my` |
| `backend/.env.production` | `backend/.env.local` | 모든 redirect URI(구글·카카오)·`PUBLIC_BASE_URL` 을 `https://teamworks.my` 로 |

> 운영 파일은 dev 파일을 복사해 URL만 `https://teamworks.my` 로 바꾼 것입니다.
> `GOOGLE_CLIENT_ID/SECRET` 등은 동일하며, **운영에서는 `JWT_*_SECRET`·`GOOGLE_CALENDAR_ENCRYPTION_KEY`·`OPEN_WEBUI_SECRET_KEY` 를 새 값으로 교체**하는 것을 권장합니다.

핵심 값(운영):
```bash
# .env.production
PUBLIC_BASE_URL=https://teamworks.my

# backend/.env.production
GOOGLE_REDIRECT_URI=https://teamworks.my/api/auth/oauth/google/callback
GOOGLE_CALENDAR_REDIRECT_URI=https://teamworks.my/api/auth/oauth/google/calendar/callback
PUBLIC_BASE_URL=https://teamworks.my
# (카카오도 운영 시) KAKAO_REDIRECT_URI=https://teamworks.my/api/auth/oauth/kakao/callback
```
`PUBLIC_BASE_URL` 한 값이 **`FRONTEND_URL`(CORS Allow-Origin)·`NEXT_PUBLIC_API_URL`·OAuth 콜백 후 프론트 복귀(`/auth/oauth/success`)** 를 모두 결정합니다.

---

## D. 운영 서버 적용 & 검증

```bash
# 1) 운영 파일을 실제 사용 파일로 복사
cp .env.production .env
cp backend/.env.production backend/.env.local

# 2) 컨테이너 재기동 (env 반영)
docker compose up -d --force-recreate backend frontend
```

> 로컬 개발 머신에서는 이 복사를 **하지 마세요** — dev `.env`/`backend/.env.local`(localhost) 가 그대로 유지되어야 합니다.

1. `https://teamworks.my` → **Google로 시작하기** → 동의 → `/auth/oauth/success` 정상 복귀
2. 로그인 후 비공개 팀에서 **Google Calendar 연결** → 캘린더 동의 → 콜백 정상
3. 실패 시 1순위 점검: **`redirect_uri_mismatch`** = 콘솔 등록 URI ↔ env `GOOGLE_*_REDIRECT_URI` 불일치

---

## 체크리스트

| 위치 | 항목 | 운영 값 |
|---|---|---|
| 콘솔·클라이언트 | JS 원본 | `https://teamworks.my` |
| 콘솔·클라이언트 | 리디렉션 URI 1 | `https://teamworks.my/api/auth/oauth/google/callback` |
| 콘솔·클라이언트 | 리디렉션 URI 2 | `https://teamworks.my/api/auth/oauth/google/calendar/callback` |
| 콘솔·동의화면 | 승인 도메인 | `teamworks.my` |
| 콘솔·동의화면 | 서비스 약관 URL | `https://teamworks.my/landing/terms.html` |
| 콘솔·동의화면 | 개인정보처리방침 URL | `https://teamworks.my/landing/privacy.html` |
| 콘솔·동의화면 | 게시/검증 | 프로덕션 + (민감범위) 검증 |
| `backend/.env.production` | `GOOGLE_REDIRECT_URI` | `https://teamworks.my/api/auth/oauth/google/callback` |
| `backend/.env.production` | `GOOGLE_CALENDAR_REDIRECT_URI` | `https://teamworks.my/api/auth/oauth/google/calendar/callback` |
| `.env.production` | `PUBLIC_BASE_URL` | `https://teamworks.my` |

---

## 참고 — 카카오 로그인

카카오도 함께 운영하려면 동일하게 바꿔야 합니다(이 문서 범위 밖이지만 배포 시 필요):

- `backend/.env.production` 에는 이미 `KAKAO_REDIRECT_URI=https://teamworks.my/api/auth/oauth/kakao/callback` 로 들어가 있습니다.
- 카카오 디벨로퍼스 → 내 앱 → 카카오 로그인 → Redirect URI 에 위 주소 등록
- 플랫폼 → Web → 사이트 도메인에 `https://teamworks.my` 등록

---

## 개발환경과의 분리

- **dev 파일**(`.env`, `backend/.env.local`)은 `localhost:8080` 그대로 유지 — 로컬 개발은 계속 동작합니다.
- **운영 파일**(`.env.production`, `backend/.env.production`)은 운영 서버에서만 `.env`/`backend/.env.local` 로 복사해 사용합니다.
- 두 운영 파일은 `.gitignore` 에 등록되어 커밋되지 않습니다(시크릿 포함).
- Google Cloud Console 에 dev용 `http://localhost:8080/...` 리디렉션 URI 를 그대로 두면, 같은 클라이언트로 로컬·운영 OAuth 가 모두 동작합니다.
