# TEAM WORKS — Google OAuth Verification Demo Video Script

Google OAuth 검증(민감 범위 `calendar.events`) 제출용 데모 영상을 **이 스크립트 그대로 녹화**하면 됩니다.
영상은 1~2분 분량, **영어 내레이션 또는 영어 자막** 으로 제작하세요(구글 권장).

> ⚠️ 이 문서는 "녹화 대본"입니다. 실제 영상은 운영 환경(`https://teamworks.my`) + 본인 Google 계정으로 직접 녹화해야 합니다
> (구글 동의 화면·실제 캘린더 반영은 사람이 직접 수행해야 함).

---

## 사전 준비

- 운영 배포 완료(`https://teamworks.my` 접속 가능, OAuth redirect 운영값 적용 — `docs/27` 참고)
- 녹화에 쓸 **본인 Google 계정** 1개 (실제 캘린더 반영을 보여줘야 함)
- TEAM WORKS 테스트 계정(이메일 가입) 또는 새로 회원가입
- 화면 녹화 도구: macOS **Cmd+Shift+5**(화면 기록) 또는 QuickTime Player → "새로운 화면 기록"
- 브라우저 주소창이 **선명히 보이도록** 확대(클라이언트 ID 가독성)

---

## 필수 포함 3장면 (구글 검증 요건)

| # | 반드시 보여야 할 것 |
|---|---|
| 1 | OAuth **동의 화면** + 주소창에 **클라이언트 ID `863968083830-…`** 가 보이는 장면 |
| 2 | 사용자가 **동의(Allow / 허용)** 를 누르는 과정 |
| 3 | 앱에서 **`calendar.events` 실사용** — 일정 등록 → **실제 Google 캘린더에 반영** |

---

## 샷 리스트 (Scene-by-Scene)

### Scene 0 — Intro (5s)
- **화면**: `https://teamworks.my` 홈(로그인 화면) 또는 로고
- **자막/내레이션(EN)**: "TEAM WORKS — a team calendar and collaboration app. This demo shows how we request and use the Google Calendar `calendar.events` scope."

### Scene 1 — 로그인 후 캘린더 연동 시작 (10s)
- **화면**: TEAM WORKS 로그인 → 비공개 팀(개인 팀) 진입 → 상단의 **"Google Calendar 연결"** 버튼 클릭
- **자막/내레이션(EN)**: "After signing in, the user opens a private team and clicks 'Connect Google Calendar' to start the OAuth flow."

### Scene 2 — 구글 계정 선택 + 동의 화면 (★필수, 15s)
- **화면**: 구글 계정 선택 → **OAuth 동의 화면**
  - **주소창을 잠깐 클로즈업** — `accounts.google.com/.../oauth/...?client_id=863968083830-...` 의 **client_id** 가 보이게
  - 요청 권한 목록에 **"Google Calendar 일정 보기/수정"(calendar.events)** 표시가 보이게
- **자막/내레이션(EN)**: "Google shows the consent screen. The URL contains our client ID `863968083830-...`. The app requests the `calendar.events` scope to manage the user's own events."

### Scene 3 — 동의(Allow) (★필수, 5s)
- **화면**: 사용자가 **계속/허용(Allow)** 클릭 → 앱으로 리디렉션(`/auth/oauth/success` 또는 팀 화면 복귀), "연결됨" 상태 표시
- **자막/내레이션(EN)**: "The user grants consent. The app receives the authorization and shows the calendar as connected."

### Scene 4 — 앱에서 일정 등록 (★필수 scope 사용, 15s)
- **화면**: TEAM WORKS 캘린더에서 **새 일정 등록** (예: "Project kickoff", 내일 오전 10시)
  - AI 비서 "찰떡이"로 자연어 등록("내일 오전 10시 Project kickoff 등록")해도 됨 — 미리보기 확인 후 등록
- **자막/내레이션(EN)**: "Now the user creates an event in TEAM WORKS — 'Project kickoff' tomorrow at 10 AM."

### Scene 5 — 실제 Google 캘린더에 반영 (★필수 증빙, 15s)
- **화면**: 새 탭에서 **calendar.google.com**(같은 구글 계정) 열기 → 방금 만든 **"Project kickoff" 일정이 그대로 보이는** 장면
  - (양방향 강조 시) 구글 캘린더에서 일정 시간 수정 → TEAM WORKS 새로고침 시 반영되는 장면 추가 가능
- **자막/내레이션(EN)**: "The event immediately appears in the user's own Google Calendar via the `calendar.events` scope. We only read and write events the user creates in TEAM WORKS — no other calendar data is accessed."

### Scene 6 — Outro (5s)
- **자막/내레이션(EN)**: "TEAM WORKS uses `calendar.events` solely to sync the user's own team schedules with their Google Calendar. Thank you."

---

## 녹화 팁

- **클라이언트 ID 가독성**: Scene 2에서 주소창을 클릭해 전체 URL이 보이게 하고, 필요하면 브라우저 확대(Cmd +)로 client_id 부분을 키워 잠깐 정지.
- **개인정보 가림**: 본인 이메일 주소가 과도하게 노출되면 모자이크해도 됩니다(단 client_id·동의 화면·캘린더 반영은 가리지 말 것).
- **자막**: 한국어 음성으로 녹화했다면 **영어 자막**을 입혀 업로드(YouTube 자동/수동 자막 또는 영상 내 번인 자막).
- **업로드**: YouTube 에 **공개 또는 일부 공개(Unlisted)** 로 올리고, 그 URL 을 검증 폼에 첨부.
- **길이**: 1~2분이면 충분. 각 필수 장면이 명확히 보이는 게 핵심(짧아도 OK).

---

## 제출 시 체크 (영상)

- [ ] 동의 화면 + 주소창 **client_id `863968083830-…`** 보임
- [ ] **Allow/허용** 누르는 장면 포함
- [ ] 앱에서 **일정 등록** 장면 포함
- [ ] **Google 캘린더에 반영**되는 장면 포함(가장 중요)
- [ ] **영어 내레이션 또는 영어 자막**
- [ ] YouTube URL 확보 → 검증 폼에 첨부

> 검증 절차 전체는 [`docs/27-google-auth-setting.md`](../docs/27-google-auth-setting.md) "B-2. OAuth 검증 제출" 참고.
