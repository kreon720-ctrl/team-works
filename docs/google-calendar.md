# Google Calendar Integration Plan

## 1. 목표

Google 계정으로 로그인한 사용자가 비공개 팀을 생성하거나 비공개 팀에 참여한 경우, 별도의 복잡한 설정 없이 Google Calendar 연동이 자연스럽게 동작하도록 한다.

Google Calendar 연동 대상이 아닌 경우에는 기존 TEAM WORKS 일정 기능이 단독으로 동작해야 한다.

연동 후에는 다음을 지원한다.

- 연동된 Google 계정의 일정을 일정관리 화면에 표시
- TEAM WORKS에서 일정 생성/수정/삭제 시 Google Calendar에 반영
- AI 비서 찰떡이를 통한 일정 생성/수정/삭제도 동일하게 Google Calendar에 반영

## 2. 기본 정책

- Google 계정으로 로그인한 사용자만 Calendar 연동 가능
- 비공개 팀만 Calendar 연동 가능
- Google 계정으로 로그인한 사용자가 비공개 팀에 들어오면 Calendar 연동 상태를 자동 확인
- 이미 Calendar 권한을 승인한 사용자라면 일정관리 화면에서 Google Calendar 일정이 자연스럽게 함께 표시
- Calendar 권한이 아직 없으면 비공개 팀 맥락에서 1회 권한 승인 CTA를 제공
- Google 로그인이 아니거나 공개 팀이면 Calendar 연동 없이 기존 일정 기능을 단독으로 제공
- 공개 팀은 Calendar 연동 버튼과 API 모두 비활성화
- Google Calendar 연동 실패, 권한 만료, API 장애가 발생해도 로컬 일정 CRUD는 계속 동작
- 1차 구현은 "TEAM WORKS -> Google Calendar" 동기화와 "Google Calendar -> 화면 표시"까지로 제한
- Google Calendar에서 직접 수정한 내용을 TEAM WORKS DB에 역반영하는 양방향 sync는 2차 범위로 분리

## 3. OAuth 권한 설계

현재 Google 로그인 scope:

```text
openid profile email
```

Calendar 연동 시 추가 scope:

```text
https://www.googleapis.com/auth/calendar.events
```

Calendar 연동은 로그인 OAuth와 분리한다.

- 로그인: 기존 `/api/auth/oauth/google/start`, `/callback`
- Calendar 연동: 신규 `/api/auth/oauth/google/calendar/start`, `/callback`

분리 이유:

- 로그인은 최소 권한(`openid profile email`)만 요청
- Calendar 권한은 사용자가 비공개 팀에서 실제로 연동이 필요한 시점에만 요청
- Google 로그인이 아닌 사용자와 공개 팀 사용자는 Calendar 권한 승인 없이 TEAM WORKS를 단독 사용

Calendar 연동 OAuth에는 다음 파라미터가 필요하다.

```text
access_type=offline
prompt=consent
```

refresh token은 서버에 암호화 저장하고, access token은 필요 시 갱신해서 사용한다.

## 4. DB 변경 계획

### team_calendar_integrations

팀별 Google Calendar 연결 상태를 저장한다.

```sql
id
team_id
user_id
provider
google_calendar_id
google_account_email
encrypted_refresh_token
scope
connected_at
disconnected_at
status
created_at
updated_at
```

제약:

- `provider = 'google'`
- `team_id` unique active integration
- `team_id`는 비공개 팀만 허용
- refresh token은 평문 저장 금지

### calendar_event_mappings

TEAM WORKS 일정과 Google Calendar 이벤트의 매핑을 저장한다.

```sql
id
team_id
local_schedule_id
google_event_id
google_calendar_id
sync_direction
last_synced_at
last_google_updated
sync_status
last_error
created_at
updated_at
```

목적:

- 로컬 일정 수정 시 대응되는 Google event 식별
- 로컬 일정 삭제 시 Google event 삭제
- Google 이벤트와 로컬 이벤트 중복 표시 방지
- sync 실패 상태 추적

## 5. 백엔드 개발 계획

### 5.1 Google Calendar OAuth

추가 파일:

```text
backend/lib/auth/oauth/googleCalendar.ts
backend/app/api/auth/oauth/google/calendar/start/route.ts
backend/app/api/auth/oauth/google/calendar/callback/route.ts
```

처리 흐름:

1. 사용자가 Google 계정으로 로그인
2. 사용자가 비공개 팀 생성 또는 비공개 팀 진입
3. 서버가 팀 권한, 비공개 여부, Google 로그인 여부를 검증
4. 기존 Calendar 연동이 있으면 연동 상태를 반환하고 추가 OAuth 없이 사용
5. 기존 Calendar 연동이 없으면 Calendar 권한 승인 URL을 반환
6. state에 `teamId`, `redirectAfter`, PKCE verifier 저장
7. Google Calendar scope 포함한 OAuth URL 반환
8. callback에서 state 검증
9. code를 token으로 교환
10. refresh token 암호화 저장
11. 연동 상태 저장 후 팀 화면으로 redirect

단독 동작 흐름:

1. 사용자가 Google 로그인이 아니거나 공개 팀에 진입
2. 서버는 Calendar 연동 상태를 `disabled` 또는 `not_applicable`로 반환
3. 프론트엔드는 Calendar 연동 UI를 숨기거나 비활성화
4. 일정 조회/생성/수정/삭제는 로컬 TEAM WORKS DB만 사용

### 5.2 Calendar API Client

추가 파일:

```text
backend/lib/google/calendarClient.ts
```

기능:

- refresh token으로 access token 갱신
- 이벤트 목록 조회
- 이벤트 생성
- 이벤트 수정
- 이벤트 삭제

Google Calendar API 사용:

- `events.list`
- `events.insert`
- `events.patch` 또는 `events.update`
- `events.delete`

### 5.3 팀 Calendar 연동 API

추가 API:

```text
POST   /api/teams/:teamId/calendar/google/start
GET    /api/teams/:teamId/calendar/google/status
DELETE /api/teams/:teamId/calendar/google/disconnect
```

권한:

- 로그인 필수
- 팀 구성원 검증
- 연동/해제는 팀장 또는 팀 생성자 기준으로 제한 권장
- 공개 팀은 403

상태 응답 예시:

```ts
type GoogleCalendarIntegrationStatus =
  | 'connected'
  | 'needs_consent'
  | 'disabled'
  | 'not_applicable'
  | 'error'
```

상태 의미:

- `connected`: Google 로그인 사용자이며 비공개 팀이고 Calendar 권한이 연결됨
- `needs_consent`: Google 로그인 사용자이며 비공개 팀이지만 Calendar 권한 승인이 필요함
- `disabled`: 사용자가 직접 연동을 해제함
- `not_applicable`: Google 로그인이 아니거나 공개 팀이라 Calendar 연동 대상이 아님
- `error`: 토큰 만료, 권한 폐기, Google API 오류 등으로 재연동 또는 재시도가 필요함

### 5.4 일정 조회 연동

일정관리 화면 조회 API에서 Google Calendar 이벤트를 함께 반환한다.

단, Google Calendar 이벤트 조회는 연동 상태가 `connected`인 경우에만 수행한다.
그 외 상태에서는 기존 로컬 일정만 반환한다.

조회 범위:

- 월간: 해당 월 시작~끝
- 주간: 해당 주 시작~끝
- 일간: 해당 일 시작~끝

반환 모델 예시:

```ts
type CalendarScheduleSource = 'local' | 'google'

interface CalendarSchedule {
  id: string
  title: string
  description?: string | null
  startAt: string
  endAt?: string | null
  color?: string
  source: CalendarScheduleSource
  editable: boolean
  googleEventId?: string
}
```

중복 방지:

- `calendar_event_mappings`에 존재하는 Google event는 별도 외부 일정으로 중복 표시하지 않음

### 5.5 일정 생성 동기화

공통 schedule service에서 처리한다.

흐름:

1. 로컬 일정 생성
2. 팀이 비공개이고 Google Calendar 연동 상태가 `connected`이면 Google event 생성
3. 성공 시 `calendar_event_mappings` 저장
4. 연동 대상이 아니면 Google API 호출 없이 로컬 일정만 유지
5. 실패 시 로컬 일정은 유지하고 `sync_status = 'failed'` 기록

### 5.6 일정 수정 동기화

흐름:

1. 로컬 일정 수정
2. Google Calendar 연동 상태와 mapping 존재 여부 확인
3. 연동 상태가 `connected`이고 mapping이 있으면 Google event patch/update
4. 연동 대상이 아니거나 mapping이 없으면 로컬 일정만 수정
5. 성공 시 sync 상태 갱신
6. 실패 시 `last_error` 기록

### 5.7 일정 삭제 동기화

흐름:

1. 로컬 일정 삭제
2. Google Calendar 연동 상태와 mapping 존재 여부 확인
3. 연동 상태가 `connected`이고 mapping이 있으면 Google event delete
4. 연동 대상이 아니거나 mapping이 없으면 로컬 일정만 삭제
5. 성공 시 mapping 삭제 또는 `sync_status = 'deleted'`
6. 실패 시 실패 상태 기록

## 6. AI 비서 찰떡이 연동 계획

AI 비서의 일정 생성/수정/삭제가 별도 Google Calendar 코드를 직접 호출하면 안 된다.

원칙:

- UI 일정 조작과 AI 일정 조작이 같은 backend schedule service를 사용
- Google Calendar 동기화는 route handler가 아니라 service 계층의 후처리 hook에서 수행

대상 경로:

- 일반 UI 일정 생성/수정/삭제
- `/api/ai-assistant/execute`를 통한 일정 생성/수정/삭제

필요 작업:

- 현재 일정 CRUD 로직을 공통 service로 모으기
- AI execute route가 해당 service를 호출하도록 정리
- sync 실패 시 AI 응답 카드에 경고 메시지를 표시할 수 있도록 결과 모델 확장

## 7. 프론트엔드 개발 계획

### 7.1 팀 생성 화면

- 공개/비공개 선택 UI 명확화
- Google 로그인 사용자가 비공개 팀 생성 시 Calendar 연동 상태 자동 확인
- 기존 Calendar 권한이 있으면 추가 설정 없이 연결 상태 표시
- Calendar 권한이 없으면 Google Calendar 연동 CTA 제공
- 공개 팀이면 Calendar 연동 안내 비표시

### 7.2 팀 진입 흐름

- Google 로그인 사용자가 비공개 팀에 들어오면 Calendar 연동 상태를 자동 조회
- `connected`이면 일정관리 화면에서 Google Calendar 일정을 함께 표시
- `needs_consent`이면 일정관리 화면 또는 팀 설정에 연결 CTA 표시
- `not_applicable`이면 Calendar UI를 노출하지 않고 TEAM WORKS 일정만 표시
- `error`이면 재연동 CTA와 실패 사유를 표시하되 로컬 일정 사용은 유지

### 7.3 일정관리 화면

추가 UI:

- Google Calendar 연결 상태
- 연결 버튼
- 연결 해제 버튼
- 마지막 동기화 시각
- 동기화 실패 경고

일정 표시:

- 로컬 일정과 Google Calendar 일정을 구분
- Google 원본 일정은 별도 아이콘 또는 색상 표시
- TEAM WORKS에서 생성한 일정은 기존 일정처럼 편집 가능
- 외부 Google 일정은 1차에서 읽기 전용 권장
- Calendar 연동 대상이 아닌 사용자/팀에서는 기존 일정관리 화면을 단독 모드로 표시

### 7.4 에러 UX

처리할 케이스:

- Google 권한 만료
- refresh token 폐기
- Calendar API 403
- Calendar API quota 초과
- Google event가 외부에서 삭제됨
- 재연동 필요

## 8. 환경변수

추가 env:

```env
GOOGLE_CALENDAR_ENCRYPTION_KEY=
GOOGLE_CALENDAR_DEFAULT_ID=primary
```

기존 Google OAuth env:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
PUBLIC_BASE_URL=
```

## 9. 테스트 계획

### 단위 테스트

- Calendar OAuth URL 생성
- Calendar callback state 검증
- refresh token 암호화/복호화
- Google access token 갱신
- Google event 생성/수정/삭제 요청 payload 변환
- 로컬 일정과 Google event 매핑

### 통합 테스트

- 공개 팀 Calendar 연동 시 403
- 비공개 팀 Calendar 연동 성공
- Google 로그인 사용자가 비공개 팀에 진입하면 Calendar 연동 상태 자동 조회
- 이미 연결된 사용자는 추가 OAuth 없이 Google Calendar 일정 표시
- 권한이 없는 Google 로그인 사용자는 `needs_consent` 상태와 CTA 표시
- Google 로그인이 아닌 사용자가 비공개 팀에 진입하면 로컬 일정 단독 동작
- Google 로그인 사용자가 공개 팀에 진입하면 로컬 일정 단독 동작
- Calendar 연동 없는 팀은 기존 일정 CRUD 영향 없음
- 로컬 일정 생성 시 Google event 생성
- 로컬 일정 수정 시 Google event 수정
- 로컬 일정 삭제 시 Google event 삭제
- AI 일정 생성/수정/삭제 시 동일하게 Google Calendar 반영
- Google API 실패 시 로컬 일정 보존 및 sync 실패 기록

### 수동 E2E

1. Google 계정 로그인
2. 비공개 팀 생성
3. Google Calendar 연동
4. Google Calendar 기존 일정이 일정관리 화면에 표시되는지 확인
5. TEAM WORKS에서 일정 생성 후 Google Calendar 확인
6. TEAM WORKS에서 일정 수정 후 Google Calendar 확인
7. TEAM WORKS에서 일정 삭제 후 Google Calendar 확인
8. 찰떡이로 일정 생성/수정/삭제 후 Google Calendar 확인

## 10. 1차 MVP 범위

1차 구현 범위:

- Google 로그인 사용자의 비공개 팀 Google Calendar 연결
- 비공개 팀 진입 시 Calendar 연동 상태 자동 확인
- 연동 대상이 아닌 사용자/팀의 로컬 일정 단독 동작
- Google Calendar 일정 읽기 및 일정관리 화면 표시
- TEAM WORKS 일정 생성/수정/삭제를 Google Calendar에 반영
- AI 일정 생성/수정/삭제도 동일 반영
- 동기화 실패 상태 기록

2차 범위:

- Google Calendar에서 직접 수정한 변경사항을 TEAM WORKS DB에 역반영
- Google Calendar push notification/watch
- syncToken 기반 증분 동기화
- 팀별 별도 Calendar 생성 또는 Calendar 선택 UI
