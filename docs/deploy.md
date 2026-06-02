# TEAM WORKS 실운영 배포 전환 가이드

## 문서 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2026-06-02 | Google OAuth 테스트 설정을 실운영 환경으로 전환하는 절차 정리 |

---

## 1. 목적

현재 개발·테스트 환경으로 설정된 TEAM WORKS를 실운영 환경으로 배포할 때, Google 로그인과 Google Calendar 연동을 운영 도메인 기준으로 전환하는 절차를 정리합니다.

운영 전환의 핵심은 다음 3가지입니다.

1. Google Cloud Console의 OAuth 앱을 `Testing`에서 `In production`으로 전환
2. 운영 도메인 `https://teamworks.my` 기준으로 OAuth redirect URI 등록
3. 운영 서버 환경변수를 Google Console 설정과 정확히 일치하도록 변경

---

## 2. Google Cloud Console 운영 전환

### 2.1 운영용 Google Cloud Project

가능하면 개발·테스트용 프로젝트와 운영용 프로젝트를 분리합니다.

- 테스트 프로젝트: 로컬, 내부 QA, 테스트 사용자
- 운영 프로젝트: 실제 사용자, 운영 도메인, 운영 OAuth client

분리하면 테스트 중 설정 변경이 운영 사용자에게 영향을 주지 않습니다.

### 2.2 API 활성화

Google Cloud Console에서 다음 API를 확인합니다.

| 기능 | 필요한 API |
|------|------------|
| Google 로그인 | 별도 Calendar API 불필요 |
| Google Calendar 연동 | Google Calendar API |

Calendar 연동을 실사용자에게 제공하려면 `APIs & Services`에서 `Google Calendar API`를 활성화합니다.

### 2.3 OAuth 동의 화면

`APIs & Services` → `OAuth consent screen` 또는 `Google Auth Platform` → `Audience`에서 설정합니다.

필수 확인 항목:

- User type: `External`
- Publishing status: `In production`
- App name: `TEAM WORKS`
- User support email: 운영 문의 이메일
- App home page: `https://teamworks.my`
- Privacy policy URL: 운영 개인정보처리방침 URL
- Terms of Service URL: 운영 이용약관 URL
- Authorized domain: `teamworks.my`
- Developer contact email: 운영 담당자 이메일

Google 공식 기준으로 `Testing` 상태는 테스트 사용자 최대 100명 제한이 있습니다. 실제 사용자에게 공개하려면 `In production`으로 전환해야 합니다.

참고:

- Google Cloud Help: https://support.google.com/cloud/answer/15549945
- OAuth app verification: https://support.google.com/cloud/answer/13463073

### 2.4 Scopes

TEAM WORKS에서 사용하는 Google scope는 기능별로 나뉩니다.

로그인 OAuth:

```text
openid
profile
email
```

Google Calendar 연동 OAuth:

```text
https://www.googleapis.com/auth/calendar.events
```

Calendar scope는 민감 또는 제한 scope로 분류될 수 있습니다. Google Console에서 verification 대상이라고 표시되면 OAuth app verification을 준비해야 합니다.

검증 준비 시 일반적으로 필요한 항목:

- 요청 scope의 사용 목적 설명
- 실제 앱 화면 또는 데모 영상
- 개인정보처리방침 URL
- 이용약관 URL
- 사용자 데이터 처리 방식 설명

---

## 3. OAuth Client 운영 설정

`APIs & Services` → `Credentials` → `OAuth 2.0 Client IDs`에서 운영용 Web application client를 생성하거나 수정합니다.

### 3.1 Authorized JavaScript origins

```text
https://teamworks.my
```

### 3.2 Authorized redirect URIs

TEAM WORKS는 Google 로그인과 Google Calendar 권한 승인을 분리해서 사용합니다. 따라서 redirect URI도 2개가 필요합니다.

```text
https://teamworks.my/api/auth/oauth/google/callback
https://teamworks.my/api/auth/oauth/google/calendar/callback
```

주의:

- `http`가 아니라 `https`여야 합니다.
- 도메인, 경로, trailing slash가 코드의 환경변수와 정확히 일치해야 합니다.
- 하나라도 다르면 Google에서 `redirect_uri_mismatch` 오류가 발생합니다.

---

## 4. 운영 환경변수

운영 서버의 `.env` 또는 배포 플랫폼 환경변수는 Google Console의 운영 OAuth Client 값으로 설정합니다.

```bash
PUBLIC_BASE_URL=https://teamworks.my

GOOGLE_CLIENT_ID=운영용_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=운영용_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://teamworks.my/api/auth/oauth/google/callback
GOOGLE_CALENDAR_REDIRECT_URI=https://teamworks.my/api/auth/oauth/google/calendar/callback
```

현재 루트 `.env`는 로컬 기본값이 다음처럼 설정되어 있습니다.

```bash
PUBLIC_BASE_URL=http://localhost:8080
```

운영 배포 시에는 반드시 아래 값으로 바꿉니다.

```bash
PUBLIC_BASE_URL=https://teamworks.my
```

`PUBLIC_BASE_URL`은 OAuth 콜백 이후 프론트 리다이렉트, CORS, 외부 접근 URL 계산에 영향을 줍니다. 운영 도메인과 다르면 로그인 후 내부 주소나 localhost로 이동할 수 있습니다.

환경변수를 변경한 뒤에는 backend/frontend 컨테이너를 재기동합니다.

```bash
docker compose up -d --force-recreate backend frontend
```

---

## 5. 코드 기준 확인 포인트

Google 로그인 OAuth:

```text
POST /api/auth/oauth/google/start
GET  /api/auth/oauth/google/callback
```

환경변수:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```

Google Calendar 연동 OAuth:

```text
POST /api/auth/oauth/google/calendar/start
GET  /api/auth/oauth/google/calendar/callback
```

환경변수:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALENDAR_REDIRECT_URI
```

Calendar 연동 OAuth는 다음 조건을 사용합니다.

```text
access_type=offline
prompt=consent
```

이 설정은 Google Calendar refresh token을 발급받기 위한 조건입니다.

---

## 6. 운영 전환 체크리스트

### 6.1 Google Console

- [ ] 운영 Google Cloud Project 준비
- [ ] Google Calendar API 활성화
- [ ] OAuth consent screen의 User type이 `External`인지 확인
- [ ] Publishing status를 `In production`으로 전환
- [ ] App name이 `TEAM WORKS`인지 확인
- [ ] Authorized domain에 `teamworks.my` 등록
- [ ] Privacy policy URL 등록
- [ ] Terms of Service URL 등록
- [ ] OAuth Client의 Authorized JavaScript origins에 `https://teamworks.my` 등록
- [ ] OAuth Client의 Authorized redirect URIs에 로그인 callback 등록
- [ ] OAuth Client의 Authorized redirect URIs에 Calendar callback 등록
- [ ] Calendar scope 사용 시 verification 필요 여부 확인

### 6.2 운영 서버

- [ ] `PUBLIC_BASE_URL=https://teamworks.my`
- [ ] `GOOGLE_CLIENT_ID`가 운영 OAuth Client ID인지 확인
- [ ] `GOOGLE_CLIENT_SECRET`이 운영 OAuth Client Secret인지 확인
- [ ] `GOOGLE_REDIRECT_URI=https://teamworks.my/api/auth/oauth/google/callback`
- [ ] `GOOGLE_CALENDAR_REDIRECT_URI=https://teamworks.my/api/auth/oauth/google/calendar/callback`
- [ ] 환경변수 변경 후 backend/frontend 재기동
- [ ] HTTPS 인증서 정상 적용
- [ ] `https://teamworks.my` 접속 확인

### 6.3 기능 테스트

- [ ] 신규 Google 계정으로 로그인 시 약관 및 개인정보 동의 화면 표시
- [ ] 기존 Google 계정으로 로그인 시 추가 약관 동의 없이 로그인
- [ ] 로그인 후 `/` 또는 지정된 `redirectAfter`로 이동
- [ ] 비공개 팀에서 Google Calendar 연동 CTA 표시
- [ ] Calendar 권한 승인 후 팀 화면으로 복귀
- [ ] TEAM WORKS 일정 생성 시 Google Calendar 이벤트 생성
- [ ] Google Calendar 연동 실패 시 로컬 일정 생성은 유지

---

## 7. 자주 나는 오류

### 7.1 redirect_uri_mismatch

원인:

- Google Console의 Authorized redirect URI와 서버 환경변수의 URI가 불일치
- `http`와 `https`가 다름
- 경로가 다름
- trailing slash가 다름

확인할 값:

```bash
GOOGLE_REDIRECT_URI
GOOGLE_CALENDAR_REDIRECT_URI
```

Google Console에 등록된 값:

```text
https://teamworks.my/api/auth/oauth/google/callback
https://teamworks.my/api/auth/oauth/google/calendar/callback
```

### 7.2 로그인 후 localhost로 이동

원인:

- 운영 서버의 `PUBLIC_BASE_URL`이 아직 로컬 값임

수정:

```bash
PUBLIC_BASE_URL=https://teamworks.my
docker compose up -d --force-recreate backend frontend
```

### 7.3 unverified app 경고

원인:

- 민감 또는 제한 Google scope를 사용하지만 OAuth app verification이 완료되지 않음

대응:

- Google Console에서 verification 상태 확인
- Calendar scope 사용 목적, 데모 영상, 개인정보처리방침, 이용약관 URL 준비
- verification 제출

### 7.4 Calendar refresh token이 발급되지 않음

원인:

- Calendar OAuth 요청에 `access_type=offline`, `prompt=consent`가 빠짐
- 같은 Google 계정에서 이미 consent를 했고 refresh token 재발급 조건이 충족되지 않음

코드 기준 Calendar OAuth는 별도 flow에서 `access_type=offline`, `prompt=consent`를 사용해야 합니다.

필요하면 Google 계정의 앱 권한을 해제한 뒤 다시 연동 테스트합니다.

