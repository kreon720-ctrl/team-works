# TEAM WORKS 사용자 시나리오 문서

## 문서 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2026-04-07 | 최초 작성 |
| 1.1 | 2026-04-08 | SC-02(팀 생성) 단순화, SC-03(초대 수락) 제거 → SC-02B(팀 탐색·가입 신청), SC-02C(팀장 승인/거절) 신규 추가. 부록 API 목록 갱신 |
| 1.2 | 2026-04-08 | SC-03(일정 삭제) 신규 추가, 부록 API 목록에 DELETE 엔드포인트 추가 |
| 1.3 | 2026-04-18 | 앱명 Team CalTalk → TEAM WORKS 반영. SCHEDULE_REQUEST → WORK_PERFORMANCE 변경 |
| 1.4 | 2026-04-20 | 포스트잇(SC-10), 업무보고 조회 권한(SC-11), 프로젝트 관리(SC-12~SC-14), 공지사항(SC-15), 권한 기반 가시성 통합 검증(SC-16) 추가. 테스트 페르소나 5명 이상으로 확장. SC-03·SC-05·SC-06 일정 권한 오류 수정(LEADER 전용→생성자 본인) |
| 1.5 | 2026-04-28 | 백엔드 구현 일치화: SC-17(팀 정보 수정·삭제), SC-18(팀원 강제 탈퇴), SC-19(내 프로필 수정) 추가. 부록 API 엔드포인트 요약 갱신 |
| 1.6 | 2026-04-29 | docs/1 v2.0·docs/2 v1.6 동기화: SC-20(프로젝트 채팅), SC-21(프로젝트 공지), SC-22(자료실 + 첨부파일), SC-23~27(AI 버틀러 5종) 추가. SC-01에 토큰 갱신 분기, SC-02C에 `/api/me/tasks` 명시. 테스트 팀에 프로젝트 정보 추가, 시나리오 목록 26→27개로 확장 |

---

## 개요

본 문서는 TEAM WORKS의 사용자 페르소나가 각 목표를 달성하기 위해 앱을 사용하는 흐름을 단계별로 서술합니다.
개발자가 화면 흐름과 API 호출 순서를 바로 파악할 수 있는 수준으로 작성되었습니다.

### 테스트 팀 구성

**팀 이름**: 프로젝트팀 알파 (공개 팀)

| 페르소나 ID | 이름 | 역할 | 업무보고 열람 권한 | 주요 사용 환경 |
|------------|------|------|------------------|----------------|
| PA | 김민준 | LEADER (팀장) | 항상 가능 | 데스크탑 |
| PB | 이서연 | MEMBER | 허용 (팀장이 부여) | 모바일 |
| PC | 박지호 | MEMBER | 미허용 | 데스크탑 |
| PD | 최유나 | MEMBER | 허용 (팀장이 부여) | 모바일 |
| PE | 정도현 | MEMBER | 미허용 | 데스크탑 |
| PF | 한소율 | MEMBER | 미허용 | 모바일 |

> 팀 설정: 업무보고 열람 권한 허용 목록 = [이서연, 최유나]. 나머지 MEMBER(박지호·정도현·한소율)는 업무보고 열람 불가.

**팀 내 프로젝트** (SC-20~22 컨텍스트 격리 검증용):

| 프로젝트 ID | 이름 | 작성자 | 시나리오 |
|---|---|---|---|
| PROJ-A | 신규 대시보드 개발 | PA | SC-20 채팅 격리, SC-21 공지 격리, SC-22 자료실 격리 |
| PROJ-B | 온보딩 흐름 개선 | PB | 다른 프로젝트 비교용 |

### 시나리오 목록

| ID | 제목 | 페르소나 | 연관 UC |
|----|------|----------|---------|
| SC-01 | 회원가입 및 로그인 (6명 순차 가입) | 공통 | UC-01 |
| SC-02 | 팀 생성 (김민준이 팀장으로 팀 개설) | PA (LEADER) | UC-02 |
| SC-02B | 공개 팀 탐색 및 가입 신청 (5명 순차 신청) | PB~PF (MEMBER 지원자) | UC-02B |
| SC-02C | 가입 신청 일괄 승인 (팀장이 5명 승인) | PA (LEADER) | UC-02C |
| SC-03 | 팀 일정 삭제 (생성자 본인만 가능) | PA / PB | UC-04 |
| SC-04 | 팀 월간 일정 조회 | PA~PF 공통 | UC-03 |
| SC-05 | 팀 일정 추가 (팀원도 생성 가능) | PA / PB | UC-04 |
| SC-06 | 팀 일정 수정 (생성자 본인만 가능) | PA / PB | UC-04 |
| SC-07 | 날짜별 채팅 조회 및 메시지 전송 | PA~PF 공통 | UC-05 |
| SC-08 | 업무보고 채팅 전송 | PB~PF (MEMBER) | UC-06 |
| SC-09 | 캘린더 + 채팅 동시 화면에서 날짜 연동 | PA~PF 공통 | UC-07 |
| SC-10 | 포스트잇 작성·수정·삭제 | PA / PC | UC-08 |
| SC-11 | 업무보고 조회 권한 설정 및 가시성 검증 | PA (설정) / PB·PC (검증) | UC-13 |
| SC-12 | 프로젝트 생성·수정·삭제 | PA / PB | UC-09 |
| SC-13 | 프로젝트 일정 생성·수정·삭제 | PA / PC | UC-10 |
| SC-14 | 세부 일정 생성·수정·삭제 | PB / PD | UC-11 |
| SC-15 | 공지사항 작성·삭제 권한 검증 | PA / PB / PC | UC-12 |
| SC-16 | 권한 기반 가시성 통합 검증 (핵심 테스트) | PA~PF 전원 | UC-04, UC-09~UC-13 |
| SC-17 | 팀 정보 수정·삭제 (LEADER 전용) | PA / PB | UC-14 |
| SC-18 | 팀원 강제 탈퇴 (LEADER 전용, 본인 제외) | PA / PB / PF | UC-15 |
| SC-19 | 내 프로필(이름) 수정 | PA~PF 공통 | UC-16 |
| SC-20 | 프로젝트 전용 채팅 메시지 송수신 + 컨텍스트 격리 | PA / PB / PC | UC-17 |
| SC-21 | 프로젝트 전용 공지사항 작성·삭제 + 격리 | PA / PB | UC-18 |
| SC-22 | 자료실 글 작성·수정·삭제 + 첨부파일 다운로드 | PA / PB / PC | UC-19, UC-20 |
| SC-23 | AI 버틀러 — 사용법 질문 (RAG 답변) | PA~PF 공통 | UC-21 |
| SC-24 | AI 버틀러 — 일반 질문 (웹 검색 답변) | PA~PF 공통 | UC-22 |
| SC-25 | AI 버틀러 — 일정 조회 (자연어 → 코드 포맷) | PA~PF 공통 | UC-23 |
| SC-26 | AI 버틀러 — 일정 등록 (confirm + 다중 턴) | PA~PF 공통 | UC-24 |
| SC-27 | AI 버틀러 — 거절 안내 (지원 외 의도) | PA~PF 공통 | UC-25 |

---

## SC-01 회원가입 및 로그인

- **페르소나**: 공통 (LEADER / MEMBER 모두 해당하는 최초 진입 흐름)
- **목표**: 이메일과 비밀번호로 계정을 생성하거나, 기존 계정으로 로그인하여 앱에 진입한다
- **전제조건**: 앱에 접속 가능한 브라우저 환경. 인증 토큰 없음 (비인증 상태)

### 단계별 흐름 — 회원가입

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | `/signup` 페이지에 접속한다 | 회원가입 폼(이름, 이메일, 비밀번호) 렌더링 | — |
| 2 | 이름, 이메일, 비밀번호를 입력하고 [회원가입] 버튼을 클릭한다 | 클라이언트 측 입력 유효성 검증 (이메일 형식, 비밀번호 최소 조건) 수행 | — |
| 3 | — | `POST /api/auth/signup` 요청 전송 (body: name, email, password) | `POST /api/auth/signup` |
| 4 | — | 서버가 이메일 중복 여부 확인 후 계정을 생성하고, bcrypt 해싱된 비밀번호 저장. Access Token + Refresh Token 발급 | — |
| 5 | — | 응답 201 Created. 토큰을 클라이언트에 저장 (httpOnly 쿠키 또는 메모리) | — |
| 6 | — | `/` (팀 목록 화면, S-03)으로 자동 리다이렉트 | — |

### 단계별 흐름 — 로그인

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | `/login` 페이지에 접속한다 | 로그인 폼(이메일, 비밀번호) 렌더링 | — |
| 2 | 이메일과 비밀번호를 입력하고 [로그인] 버튼을 클릭한다 | 클라이언트 측 입력 유효성 검증 수행 | — |
| 3 | — | `POST /api/auth/login` 요청 전송 (body: email, password) | `POST /api/auth/login` |
| 4 | — | 서버가 이메일 조회 후 bcrypt 비밀번호 비교. 일치 시 Access Token(15분) + Refresh Token(7일) 발급 | — |
| 5 | — | 응답 200 OK. 토큰 저장 | — |
| 6 | — | `/` (팀 목록 화면)으로 자동 리다이렉트 | — |

### 단계별 흐름 — Access Token 갱신 (자동, 백그라운드)

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | (15분 사용 후) 임의의 API 호출 | Access 만료 → 401 응답 받음 | — |
| 2 | (자동) | 클라이언트 인터셉터가 `POST /api/auth/refresh` 요청 (body: refreshToken) | `POST /api/auth/refresh` |
| 3 | — | 서버가 Refresh 검증 후 새 Access 발급 (200 OK) | — |
| 4 | — | 원래 요청을 새 Access 로 재시도 | — |
| 5 | (Refresh 도 만료) | 401 → 클라이언트가 토큰 모두 폐기 + `/login` 리다이렉트 | — |

### 결과
- 인증 토큰이 클라이언트에 저장되며, 이후 모든 API 요청에 Authorization 헤더로 포함된다
- 사용자는 팀 목록 화면(S-03)에서 서비스를 시작할 수 있다
- Access 만료(15분) 시 자동 갱신되어 사용자 체감 끊김 없음. Refresh 만료(7일) 시 재로그인

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 회원가입 시 이미 가입된 이메일 | `POST /api/auth/signup` → 409 Conflict. "이미 사용 중인 이메일입니다" 오류 메시지 표시 |
| 로그인 시 이메일 미존재 또는 비밀번호 불일치 | `POST /api/auth/login` → 401 Unauthorized. "이메일 또는 비밀번호가 올바르지 않습니다" 메시지 표시 |
| 이메일 형식 오류 (클라이언트 검증) | 버튼 비활성화 또는 인라인 오류 메시지 표시. API 요청 미발생 |
| Access Token 만료 상태로 API 요청 시 | 미들웨어가 401 반환 → 클라이언트가 `POST /api/auth/refresh`로 토큰 갱신 후 원래 요청 재시도 |

---

## SC-02 팀 생성 (LEADER 관점)

- **페르소나**: Persona A (LEADER)
- **목표**: 새 팀을 생성한다
- **전제조건**: 로그인 상태. Access Token 유효. 팀 목록 화면(S-03) 진입 상태

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 팀 목록 화면에서 [팀 생성] 버튼을 클릭한다 | `/teams/new` (S-04)로 이동. 팀명 입력 폼 렌더링 | — |
| 2 | 팀명을 입력하고 [생성] 버튼을 클릭한다 | `POST /api/teams` 요청 전송 (body: name) | `POST /api/teams` |
| 3 | — | 서버가 Team 레코드 생성. 요청자를 `leaderId`로 설정하고 TeamMember(role: LEADER)로 동시 등록 | — |
| 4 | — | 응답 201 Created (body: teamId, name, leaderId) | — |
| 5 | — | 생성된 팀의 메인 화면(`/teams/[teamId]`, S-05)으로 리다이렉트 | — |

### 결과
- Team 레코드와 TeamMember(LEADER) 레코드가 생성된다
- 팀장은 팀 생성 직후 나의 할 일 화면(S-04C)에서 다른 사용자들의 가입 신청을 승인/거절할 수 있다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 팀명이 빈 값 | 클라이언트 유효성 검증. API 요청 미발생, 인라인 오류 메시지 표시 |
| 팀명 100자 초과 | 클라이언트 유효성 검증 실패. "팀 이름은 최대 100자까지 입력 가능합니다" 오류 표시 |

---

## SC-02B 공개 팀 탐색 및 가입 신청 (MEMBER 관점)

- **페르소나**: Persona B (가입을 원하는 사용자)
- **목표**: 공개 팀 목록을 탐색하여 원하는 팀에 가입을 신청한다
- **전제조건**: 로그인 상태. Access Token 유효. 아직 해당 팀의 구성원이 아님

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 팀 목록 화면(S-03)에서 [팀 탐색] 버튼을 클릭한다 | `/teams/explore` (S-04B)로 이동 | — |
| 2 | — | `GET /api/teams/public` 요청 전송. 전체 공개 팀 목록(팀명, 구성원 수) 조회 | `GET /api/teams/public` |
| 3 | — | 팀 목록이 카드 형태로 렌더링됨. 각 팀에 팀명, 구성원 수, [가입 신청] 버튼 표시 | — |
| 4 | 원하는 팀의 [가입 신청] 버튼을 클릭한다 | `POST /api/teams/[teamId]/join-requests` 요청 전송 (body 없음, 신청자는 인증 토큰에서 추출) | `POST /api/teams/[teamId]/join-requests` |
| 5 | — | 서버가 TeamJoinRequest(status: PENDING, requestedAt: 현재 시각) 레코드 생성. 해당 팀 팀장의 나의 할 일 목록에 자동 표시 | — |
| 6 | — | 응답 201 Created. "[팀명]에 가입 신청을 완료했습니다. 팀장의 승인을 기다려주세요" 안내 메시지 표시 | — |
| 7 | — | 해당 팀의 [가입 신청] 버튼이 "신청 완료" 상태로 비활성화됨 | — |

### 결과
- TeamJoinRequest(status: PENDING) 레코드가 DB에 생성된다
- 해당 팀의 팀장은 나의 할 일 목록(S-04C 또는 `GET /api/me/tasks`)에서 신청을 확인하고 SC-02C를 진행할 수 있다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 이미 해당 팀의 구성원인 사용자가 신청 시도 | `POST /api/teams/[teamId]/join-requests` → 409 Conflict. "이미 해당 팀의 구성원입니다" 메시지 표시. [가입 신청] 버튼 미표시 또는 비활성화 |
| PENDING 상태의 신청이 이미 존재하는 경우 재신청 시도 | 409 Conflict. "이미 가입 신청이 진행 중입니다" 메시지 표시 |
| 존재하지 않는 팀에 신청 시도 | `POST /api/teams/[teamId]/join-requests` → 404 Not Found |
| 팀 목록 로드 실패 | `GET /api/teams/public` 실패 → "팀 목록을 불러오지 못했습니다. 새로고침 해주세요" 표시 |

---

## SC-02C 가입 신청 승인/거절 — 나의 할 일 (LEADER 관점)

- **페르소나**: Persona A (LEADER)
- **목표**: 본인이 팀장인 팀에 대한 PENDING 가입 신청을 확인하고 승인 또는 거절 처리한다
- **전제조건**: 로그인 상태. LEADER 권한으로 최소 하나의 팀에 소속. 해당 팀에 PENDING 상태의 가입 신청이 존재

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 홈 화면 또는 내비게이션에서 [나의 할 일] 메뉴를 클릭한다 | `/me/tasks` (S-04C)로 이동 | — |
| 2 | — | `GET /api/me/tasks` 요청 전송. 내가 LEADER인 모든 팀의 PENDING 가입 신청 목록 조회 | `GET /api/me/tasks` |
| 3 | — | PENDING 신청 목록 렌더링. 각 항목에 신청자 이름, 이메일, 신청 일시, 대상 팀명, [승인] / [거절] 버튼 표시 | — |
| 4 | 특정 신청의 [승인] 버튼을 클릭한다 | `PATCH /api/teams/[teamId]/join-requests/[requestId]` 요청 전송 (body: action: "APPROVE") | `PATCH /api/teams/[teamId]/join-requests/[requestId]` |
| 5 | — | 서버가 TeamJoinRequest.status → APPROVED, respondedAt 기록. TeamMember(role: MEMBER) 레코드 원자적 생성 | — |
| 6 | — | 응답 200 OK. 해당 신청 항목이 목록에서 제거됨 (또는 "승인 완료" 상태로 표시됨) | — |
| 4' | 특정 신청의 [거절] 버튼을 클릭한다 | `PATCH /api/teams/[teamId]/join-requests/[requestId]` 요청 전송 (body: action: "REJECT") | `PATCH /api/teams/[teamId]/join-requests/[requestId]` |
| 5' | — | 서버가 TeamJoinRequest.status → REJECTED, respondedAt 기록. 팀 합류 미발생 | — |
| 6' | — | 응답 200 OK. 해당 신청 항목이 목록에서 제거됨 (또는 "거절 완료" 상태로 표시됨) | — |

> **특정 팀의 신청만 확인하는 경우**: `GET /api/me/tasks` 대신 `GET /api/teams/[teamId]/join-requests`를 사용하면 특정 팀의 PENDING 신청 목록만 조회할 수 있습니다.

### 결과
- [승인] 처리 시: TeamJoinRequest.status = APPROVED, TeamMember(role: MEMBER) 레코드 생성. 신청자는 해당 팀의 일정 조회·채팅 참여가 가능해진다
- [거절] 처리 시: TeamJoinRequest.status = REJECTED. 신청자의 팀 합류 미발생

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| PENDING 상태가 아닌 신청(이미 APPROVED/REJECTED)에 대해 재처리 시도 | `PATCH /api/teams/[teamId]/join-requests/[requestId]` → 400 Bad Request. "이미 처리된 가입 신청입니다" 메시지 표시 |
| MEMBER 권한 사용자가 승인/거절 API 직접 호출 | 403 Forbidden. "팀장만 가입 신청을 처리할 수 있습니다" |
| 존재하지 않는 requestId | 404 Not Found. "가입 신청을 찾을 수 없습니다" |
| 나의 할 일 목록이 비어있음 | "현재 처리 대기 중인 가입 신청이 없습니다" 안내 메시지 표시 |

---

## SC-03 팀 일정 삭제 (LEADER)

- **페르소나**: Persona A (LEADER)
- **목표**: 등록된 팀 일정을 삭제한다
- **전제조건**: 로그인 상태. LEADER 권한으로 팀에 소속. 삭제 대상 Schedule이 DB에 존재. 캘린더 뷰에서 해당 일정이 표시된 상태

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 캘린더에서 삭제할 일정을 클릭하여 상세 팝업을 연다 | `GET /api/teams/[teamId]/schedules/[scheduleId]` 요청 전송. 일정 상세 정보 렌더링 | `GET /api/teams/[teamId]/schedules/[scheduleId]` |
| 2 | 상세 팝업에서 [삭제] 버튼을 클릭한다 | 확인 다이얼로그 표시 ("정말 삭제하시겠습니까?") | — |
| 3 | 확인을 클릭한다 | `DELETE /api/teams/[teamId]/schedules/[scheduleId]` 요청 전송 | `DELETE /api/teams/[teamId]/schedules/[scheduleId]` |
| 4 | — | 서버가 Schedule.createdBy = 요청자 확인 후 삭제 처리 | — |
| 5 | — | 응답 200 OK | — |
| 6 | — | 캘린더 뷰 갱신. 삭제된 일정이 해당 날짜 셀에서 제거됨 | `GET /api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD` 재조회 |

### 결과
- Schedule 레코드가 DB에서 삭제된다
- 해당 팀의 모든 팀원이 다음 캘린더 조회 시 삭제된 일정을 더 이상 볼 수 없다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| **일정 생성자가 아닌 사용자의 삭제 시도** | UI에서 [삭제] 버튼 미표시. 직접 API 호출 시 → **403 Forbidden** 반환. "일정 삭제 권한이 없습니다" 메시지 표시 |
| 존재하지 않는 scheduleId | 404 Not Found |
| 다른 팀 일정에 대한 삭제 시도 | 서버가 teamId 기반 권한 확인 → 403 Forbidden |

---

## SC-04 팀 월간 일정 조회

- **페르소나**: LEADER / MEMBER 공통
- **목표**: 현재 속한 팀의 월간 일정을 캘린더 뷰로 확인한다
- **전제조건**: 로그인 상태. 최소 하나 이상의 팀에 소속된 상태. 팀 메인 화면(`/teams/[teamId]`, S-05) 진입 상태

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 팀 목록 화면에서 조회할 팀을 클릭한다 | `GET /api/teams` 로 팀 목록 조회 후 선택된 팀의 메인 화면으로 이동 | `GET /api/teams` |
| 2 | — | 팀 메인 화면(S-05) 렌더링. 기본 뷰는 월간(月) 캘린더 | — |
| 3 | — | 현재 월(year, month) 기준으로 `GET /api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD` 요청 자동 발생 | `GET /api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD` |
| 4 | — | 해당 팀의 해당 월 Schedule 목록 반환 (id, title, startAt, endAt). 타 팀 일정은 포함되지 않음 (BR-06) | — |
| 5 | — | 캘린더 날짜 셀에 일정 제목 표시 | — |
| 6 | 특정 일정을 클릭한다 | `GET /api/teams/[teamId]/schedules/[scheduleId]` 요청 전송 | `GET /api/teams/[teamId]/schedules/[scheduleId]` |
| 7 | — | 일정 상세 팝업 표시 (title, description, startAt, endAt) | — |
| 8 | [이전 달] 또는 [다음 달] 버튼을 클릭한다 | 해당 월로 파라미터를 변경하여 `GET /api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD` 재요청 | `GET /api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD` |

### 결과
- 선택한 팀의 해당 월 일정 전체가 캘린더에 표시된다
- 일정 클릭 시 상세 정보(제목, 설명, 시작/종료 시각)를 확인할 수 있다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 해당 월에 일정이 없음 | 빈 캘린더 표시. "등록된 일정이 없습니다" 안내 문구 표시 |
| 소속되지 않은 팀의 teamId로 직접 URL 접근 | `GET /api/teams/[teamId]/schedules` → 403 Forbidden. 팀 목록 화면으로 리다이렉트 |
| 네트워크 오류 | TanStack Query 재시도 로직 동작. 실패 시 "일정을 불러오지 못했습니다. 새로고침 해주세요" 표시 |

---

## SC-05 팀 일정 추가 (팀원)

- **페르소나**: PA (김민준, LEADER), PB (이서연, MEMBER)
- **목표**: 팀 캘린더에 새로운 일정을 등록한다. 팀 구성원이라면 LEADER·MEMBER 구분 없이 생성할 수 있음을 검증한다
- **전제조건**: 로그인 상태. 팀에 소속된 구성원(LEADER 또는 MEMBER). 팀 메인 화면(S-05) 또는 캘린더 뷰 진입 상태

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 캘린더에서 [+ 일정 추가] 버튼 또는 특정 날짜 셀을 클릭한다 | `/teams/[teamId]/schedules/new` (S-06) 또는 인라인 생성 폼 렌더링 | — |
| 2 | 제목(필수), 설명(선택), 시작 일시, 종료 일시를 입력한다 | 클라이언트 측 유효성 검증: 제목 필수, 제목 최대 200자, startAt < endAt 확인 | — |
| 3 | [저장] 버튼을 클릭한다 | `POST /api/teams/[teamId]/schedules` 요청 전송 (body: title, description, startAt, endAt) | `POST /api/teams/[teamId]/schedules` |
| 4 | — | 서버가 팀 구성원 여부 확인 후 Schedule 레코드 생성 (createdBy: 요청자). startAt < endAt 서버 측 재검증 | — |
| 5 | — | 응답 201 Created (body: scheduleId, title, startAt, endAt) | — |
| 6 | — | 캘린더 뷰 갱신. 새로 추가된 일정이 해당 날짜 셀에 표시됨 | `GET /api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD` 재조회 |

### 결과
- Schedule 레코드가 DB에 생성된다
- 해당 팀의 모든 팀원(LEADER, MEMBER)이 다음 캘린더 조회 시 새 일정을 확인할 수 있다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 제목 미입력 | 클라이언트 유효성 검증 실패. "제목은 필수입니다" 인라인 오류. API 요청 미발생 |
| 제목 200자 초과 | 클라이언트 유효성 검증 실패. "제목은 최대 200자까지 입력 가능합니다" 인라인 오류 |
| startAt >= endAt | 클라이언트 및 서버 모두 유효성 검증. "종료 시각은 시작 시각 이후여야 합니다" 오류 표시 |
| 팀 구성원이 아닌 외부 사용자가 일정 추가 시도 | 직접 API 호출 시 `POST /api/teams/[teamId]/schedules` → 403 Forbidden. 팀원이면 LEADER·MEMBER 모두 생성 가능 |

---

## SC-06 팀 일정 수정 (생성자 본인)

- **페르소나**: PA (김민준, LEADER), PB (이서연, MEMBER)
- **목표**: 등록된 팀 일정의 내용을 변경한다. 수정은 일정 생성자 본인만 가능함을 검증한다
- **전제조건**: 로그인 상태. 팀에 소속. 수정 대상 Schedule의 생성자 본인. 캘린더 뷰에서 해당 일정이 표시된 상태

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 캘린더에서 수정할 일정을 클릭하여 상세 팝업을 연다 | `GET /api/teams/[teamId]/schedules/[scheduleId]` 요청 전송. 일정 상세 정보(title, description, startAt, endAt) 렌더링 | `GET /api/teams/[teamId]/schedules/[scheduleId]` |
| 2 | 상세 팝업에서 [수정] 버튼을 클릭한다 | 수정 폼으로 전환 (기존 값 pre-fill) | — |
| 3 | 변경할 필드를 수정한다 | 클라이언트 측 유효성 검증 (제목 필수, 최대 200자, startAt < endAt) | — |
| 4 | [저장] 버튼을 클릭한다 | `PATCH /api/teams/[teamId]/schedules/[scheduleId]` 요청 전송 (body: 변경된 필드) | `PATCH /api/teams/[teamId]/schedules/[scheduleId]` |
| 5 | — | 서버가 Schedule.createdBy = 요청자 확인 후 레코드 업데이트. startAt < endAt 서버 측 재검증 | — |
| 6 | — | 응답 200 OK | — |
| 7 | — | 캘린더 뷰 갱신. 수정된 일정 내용이 반영됨 | `GET /api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD` 재조회 |

### 결과
- Schedule 레코드가 변경된 값으로 업데이트된다
- 해당 팀의 모든 팀원이 다음 캘린더 조회 시 수정된 일정을 확인할 수 있다

### 예외 처리 (MEMBER 수정 시도 포함)

| 케이스 | 시스템 반응 |
|--------|-------------|
| **일정 생성자가 아닌 사용자의 수정 시도** | UI에서 [수정] 버튼 미표시 (생성자 기반 렌더링 제어). 생성자가 아닌 사용자가 직접 API 호출 시 → **403 Forbidden** 반환. "일정 수정 권한이 없습니다" 메시지 표시 |
| startAt >= endAt으로 수정 시도 | 클라이언트 및 서버 유효성 검증 실패. "종료 시각은 시작 시각 이후여야 합니다" 오류 표시. 저장 미처리 |
| 존재하지 않는 scheduleId | `PATCH /api/teams/[teamId]/schedules/[scheduleId]` → 404 Not Found |
| 다른 팀 일정에 대한 수정 시도 | 서버가 teamId 기반 권한 확인 → 403 Forbidden (BR-06) |

---

## SC-07 날짜별 채팅 조회 및 메시지 전송

- **페르소나**: LEADER / MEMBER 공통
- **목표**: 특정 날짜의 팀 채팅 메시지를 확인하고, 새 메시지를 전송한다
- **전제조건**: 로그인 상태. 팀에 소속. 팀 메인 화면(S-05) 진입 상태. 채팅 영역이 표시된 상태

### 단계별 흐름 — 채팅 조회

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 팀 메인 화면에 진입하면 기본적으로 오늘 날짜 채팅이 로드된다 | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` 요청 자동 발생 (date: 오늘 KST 날짜) | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` |
| 2 | — | 서버가 sentAt 기준 KST 날짜로 그룹핑된 해당 날짜 메시지 목록 반환 (BR-05). 타 팀 메시지 미포함 (BR-06) | — |
| 3 | — | 채팅 영역에 메시지 목록 렌더링. WORK_PERFORMANCE 타입 메시지는 시각적으로 구분 표시 (FR-05-4) | — |
| 4 | — | TanStack Query가 `refetchInterval` 설정에 따라 3~5초마다 자동 폴링 재요청. 새 메시지 수신 시 목록 갱신 | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` (반복 폴링) |

### 단계별 흐름 — 메시지 전송

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 메시지 입력창에 텍스트를 입력한다 | 클라이언트 측 유효성 검증: 최대 2000자, 빈 메시지 불가 | — |
| 2 | [전송] 버튼을 클릭하거나 Enter 키를 입력한다 | `POST /api/teams/[teamId]/messages` 요청 전송 (body: content, type: "NORMAL") | `POST /api/teams/[teamId]/messages` |
| 3 | — | 서버가 ChatMessage 레코드 생성 (senderId: 현재 사용자, sentAt: 현재 서버 시각 KST) | — |
| 4 | — | 응답 201 Created | — |
| 5 | — | **폴링 즉시 재실행**: 메시지 전송 성공 후 TanStack Query의 refetch가 트리거되어 최신 메시지 목록을 다시 조회. 전송한 메시지가 채팅 목록에 표시됨 (WebSocket 미지원으로 인한 폴링 방식) | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` |

> **폴링 방식 안내**: Vercel Serverless Functions의 WebSocket 미지원 제약으로 인해 실시간 채팅 대신 HTTP 폴링 방식을 사용합니다. TanStack Query의 `refetchInterval`(3~5초)로 주기적 갱신이 이루어지며, 메시지 전송 직후에는 즉시 refetch가 발생합니다. 다른 팀원이 전송한 메시지는 최대 3~5초 지연 후 수신됩니다.

### 결과
- 전송된 ChatMessage(type: NORMAL) 레코드가 DB에 저장된다
- 다른 팀원의 화면에서는 폴링 주기(3~5초) 이내에 새 메시지가 표시된다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 빈 메시지 전송 시도 | 클라이언트 유효성 검증. [전송] 버튼 비활성화 또는 오류 메시지. API 요청 미발생 |
| 2000자 초과 입력 | 클라이언트에서 입력 제한 또는 오류 메시지. API 요청 미발생 |
| 해당 날짜에 메시지 없음 | 빈 채팅 영역에 "이 날짜의 대화가 없습니다" 안내 표시 |
| 폴링 중 네트워크 오류 | TanStack Query 재시도 로직 동작. 채팅 영역 상단에 "연결이 불안정합니다" 배너 표시 |

---

## SC-08 업무보고 채팅 전송 (MEMBER)

- **페르소나**: Persona B (MEMBER)
- **목표**: 팀장에게 업무 상황을 공식 채팅으로 보고한다
- **전제조건**: 로그인 상태. MEMBER 권한으로 팀에 소속. 팀 메인 화면(S-05) 채팅 영역 진입 상태 (BR-04)

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 채팅 영역에서 [업무보고] 버튼을 클릭한다 | 업무보고 메시지 입력 모드로 전환. 입력창 또는 별도 모달 렌더링 | — |
| 2 | 보고 내용을 텍스트로 입력한다 | 클라이언트 측 유효성 검증: 최대 2000자, 빈 메시지 불가 | — |
| 3 | [전송] 버튼을 클릭한다 | `POST /api/teams/[teamId]/messages` 요청 전송 (body: content, type: "WORK_PERFORMANCE") | `POST /api/teams/[teamId]/messages` |
| 4 | — | 서버가 ChatMessage 레코드 생성 (type: WORK_PERFORMANCE, senderId: 현재 MEMBER, sentAt: 현재 서버 시각 KST) | — |
| 5 | — | 응답 201 Created | — |
| 6 | — | 메시지 전송 성공 후 TanStack Query 즉시 refetch 발생. 채팅 목록에 WORK_PERFORMANCE 메시지가 일반 메시지와 시각적으로 구분된 형태(예: 다른 배경색 또는 뱃지)로 표시됨 | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` |
| 7 | LEADER가 다음 폴링 주기(3~5초) 이내에 채팅을 확인하면 | WORK_PERFORMANCE 타입 메시지가 시각적으로 강조 표시되어 업무보고임을 인지할 수 있음 | — |

### 결과
- ChatMessage(type: WORK_PERFORMANCE) 레코드가 DB에 저장된다
- 팀 채팅 이력에 MEMBER의 업무보고가 공식적으로 기록된다
- LEADER는 항상 모든 업무보고를 열람할 수 있으며, 다른 MEMBER는 팀장이 부여한 권한이 있을 경우에만 열람 가능하다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 빈 요청 내용 전송 시도 | 클라이언트 유효성 검증. [전송] 버튼 비활성화. API 요청 미발생 |
| 2000자 초과 입력 | 클라이언트에서 입력 제한 또는 오류 메시지. API 요청 미발생 |
| 네트워크 오류로 전송 실패 | `POST /api/teams/[teamId]/messages` 실패 → "메시지 전송에 실패했습니다. 다시 시도해주세요" 오류 표시. 입력 내용 유지 |

---

## SC-09 캘린더 + 채팅 동시 화면에서 날짜 연동

- **페르소나**: LEADER / MEMBER 공통
- **목표**: 캘린더에서 특정 날짜를 선택하면 해당 날짜의 채팅 메시지가 자동으로 연동 표시된다
- **전제조건**: 로그인 상태. 팀에 소속. 팀 메인 화면(S-05) 진입 상태

### 단계별 흐름 — 데스크탑 (1024px 이상, 좌우 분할 화면)

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 팀 메인 화면(S-05)에 진입한다 | 화면 좌측에 캘린더 뷰, 우측에 채팅 영역이 동시에 렌더링됨 (분할 레이아웃) | — |
| 2 | — | 초기 로드 시 오늘 날짜가 캘린더에서 선택 상태로 표시되며, 우측 채팅 영역에는 오늘 날짜 메시지가 로드됨 | `GET /api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD`, `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` (병렬 요청) |
| 3 | 캘린더에서 다른 날짜(예: 3일 후)를 클릭한다 | 클라이언트 전역 상태(Zustand)에서 `selectedDate` 업데이트 | — |
| 4 | — | `selectedDate` 변경을 감지하여 채팅 영역이 `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` 재요청 | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` |
| 5 | — | 우측 채팅 영역이 선택된 날짜의 메시지 목록으로 갱신됨. 캘린더는 유지된 상태 | — |
| 6 | — | TanStack Query 폴링이 새로운 date 파라미터 기준으로 3~5초마다 자동 갱신 | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` (반복 폴링) |

### 단계별 흐름 — 모바일 (640px 미만, 탭 전환 방식)

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 팀 메인 화면(S-05)에 모바일로 진입한다 | 화면 상단에 [캘린더] / [채팅] 탭이 표시됨. 기본 탭은 [캘린더] | — |
| 2 | — | [캘린더] 탭 활성 상태에서 `GET /api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD` 요청 발생. 캘린더 뷰 렌더링 | `GET /api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD` |
| 3 | 캘린더에서 특정 날짜를 클릭한다 | 클라이언트 전역 상태(Zustand)에서 `selectedDate` 업데이트 | — |
| 4 | [채팅] 탭을 클릭하여 채팅 화면으로 전환한다 | 채팅 탭 활성화. `selectedDate` 기준으로 `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` 요청 발생 | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` |
| 5 | — | 채팅 영역에 선택된 날짜의 메시지 목록 표시. 탭 상단에 현재 조회 중인 날짜 명시 | — |
| 6 | — | TanStack Query 폴링이 3~5초마다 해당 날짜 기준으로 자동 갱신 | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` (반복 폴링) |
| 7 | 다시 [캘린더] 탭으로 돌아간다 | 이전에 선택한 날짜가 캘린더에 유지된 상태로 표시됨 (Zustand 상태 유지) | — |

### 결과
- 데스크탑: 캘린더 날짜 클릭 한 번으로 우측 채팅 영역이 즉시 연동 갱신된다
- 모바일: 캘린더에서 날짜 선택 후 채팅 탭으로 전환 시 해당 날짜 채팅이 자동으로 표시된다
- 두 환경 모두 선택 날짜 상태는 Zustand로 관리되며 탭/화면 전환 후에도 유지된다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 선택 날짜에 채팅 메시지 없음 | 채팅 영역에 "이 날짜의 대화가 없습니다" 안내 메시지 표시 |
| 선택 날짜에 일정 없음 | 캘린더 해당 날짜 셀에 일정 표시 없음. 채팅 연동은 정상 동작 |
| 화면 크기 변경 (모바일 ↔ 데스크탑 전환) | CSS 반응형 미디어 쿼리에 따라 레이아웃 자동 전환. Zustand의 `selectedDate` 상태는 유지됨 |
| 네트워크 오류로 채팅 로드 실패 | "채팅을 불러오지 못했습니다. 새로고침 해주세요" 오류 표시. 폴링 재시도 로직 동작 |

---

---

## SC-10 포스트잇 작성·수정·삭제

- **페르소나**: PA (김민준, LEADER), PC (박지호, MEMBER)
- **목표**: 날짜별 팀 메모를 포스트잇으로 남기고, 생성자만 수정·삭제할 수 있음을 검증한다
- **전제조건**: PA·PC 모두 로그인 상태. 팀에 소속. 팀 캘린더 화면 진입

### 단계별 흐름 — 포스트잇 생성 및 수정/삭제 권한 검증

| # | 페르소나 | 사용자 행동 | 시스템 반응 | API |
|---|----------|------------|-------------|-----|
| 1 | PA | 캘린더에서 특정 날짜(예: 2026-04-25)를 선택하고 [포스트잇 추가] 버튼을 클릭한다 | 포스트잇 생성 폼 렌더링 (날짜·색상·내용 입력) | — |
| 2 | PA | "오늘 오후 3시 거래처 미팅 준비 완료" 내용 입력 후 [저장]을 클릭한다 | `POST /api/teams/[teamId]/postits` 요청 전송 (body: date, color, content) | `POST /api/teams/[teamId]/postits` |
| 3 | — | — | 201 Created. 해당 날짜에 포스트잇 등록됨 | — |
| 4 | PC | 같은 날짜의 포스트잇 목록을 조회한다 | `GET /api/teams/[teamId]/postits?date=2026-04-25` 요청. PA가 작성한 포스트잇 확인됨 | `GET /api/teams/[teamId]/postits?date=2026-04-25` |
| 5 | PC | PA가 작성한 포스트잇의 [수정] 버튼을 클릭한다 | UI에서 [수정] 버튼이 표시되지 않음 (생성자 아님). 직접 API 호출 시 403 Forbidden | — |
| 6 | PC | "회의실 2층으로 변경" 내용의 새 포스트잇을 작성한다 | `POST /api/teams/[teamId]/postits` 요청. 201 Created | `POST /api/teams/[teamId]/postits` |
| 7 | PA | PC가 작성한 포스트잇의 [삭제]를 시도한다 | UI에서 [삭제] 버튼 미표시. 직접 API 호출 시 403 Forbidden | — |
| 8 | PA | PA 본인이 작성한 포스트잇을 [삭제]한다 | `DELETE /api/teams/[teamId]/postits/[postitId]` 요청. 200 OK. 목록에서 제거됨 | `DELETE /api/teams/[teamId]/postits/[postitId]` |

### 결과
- 팀 구성원 누구나 포스트잇을 생성할 수 있다
- 수정·삭제는 생성자 본인만 가능하며, 타인의 포스트잇에는 수정·삭제 버튼이 표시되지 않는다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 생성자가 아닌 사용자가 수정·삭제 API 직접 호출 | 403 Forbidden. "포스트잇 수정/삭제 권한이 없습니다" |
| 내용이 빈 포스트잇 저장 시도 | 클라이언트 유효성 검증. API 요청 미발생 |

---

## SC-11 업무보고 조회 권한 설정 및 가시성 검증

- **페르소나**: PA (김민준, LEADER 설정), PB (이서연, 허용), PC (박지호, 미허용)
- **목표**: 팀장이 업무보고 열람 권한을 팀원별로 설정하고, 허용된 팀원만 업무보고를 볼 수 있음을 검증한다
- **전제조건**: 전원 로그인 상태. 팀에 소속. PE(정도현)가 업무보고를 이미 전송한 상태

### 단계별 흐름 — 권한 설정

| # | 페르소나 | 사용자 행동 | 시스템 반응 | API |
|---|----------|------------|-------------|-----|
| 1 | PE | "이번 주 작업 완료: 기획서 초안 작성 및 검토 요청 드립니다" 업무보고 전송 | `POST /api/teams/[teamId]/messages` (type: WORK_PERFORMANCE). 201 Created | `POST /api/teams/[teamId]/messages` |
| 2 | PA | 팀 설정에서 [업무보고 열람 권한 관리] 메뉴에 진입한다 | 현재 권한 목록 조회: `GET /api/teams/[teamId]/work-permissions`. 초기값 빈 배열(전체 허용 상태) | `GET /api/teams/[teamId]/work-permissions` |
| 3 | PA | 이서연(PB)과 최유나(PD)만 선택 후 [저장]을 클릭한다 | `PATCH /api/teams/[teamId]/work-permissions` (body: userIds: [PB.id, PD.id]). 200 OK | `PATCH /api/teams/[teamId]/work-permissions` |
| 4 | PB | 채팅에서 당일 날짜 메시지를 조회한다 | NORMAL 메시지와 함께 PE의 WORK_PERFORMANCE 메시지가 표시됨 (열람 허용 상태) | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` |
| 5 | PC | 채팅에서 같은 날짜 메시지를 조회한다 | NORMAL 메시지만 표시됨. PE의 WORK_PERFORMANCE 메시지는 보이지 않음 (열람 미허용) | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` |
| 6 | PC | [업무보고 열람 권한 설정] 메뉴를 클릭한다 | 403 Forbidden. "팀장만 권한을 설정할 수 있습니다" | `PATCH /api/teams/[teamId]/work-permissions` |
| 7 | PA | 권한 목록을 빈 배열([])로 설정한다 | `PATCH /api/teams/[teamId]/work-permissions` (body: userIds: []). 전체 권한 해제 | `PATCH /api/teams/[teamId]/work-permissions` |
| 8 | PC | 다시 채팅을 조회한다 | 이제 PE의 WORK_PERFORMANCE 메시지가 PC에게도 표시됨 (전체 허용으로 변경됨) | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` |

### 결과
- 팀장만 업무보고 열람 권한을 설정할 수 있다
- 허용된 MEMBER만 WORK_PERFORMANCE 메시지를 볼 수 있다
- 빈 배열 설정 시 전체 구성원이 업무보고를 열람할 수 있다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| MEMBER가 권한 설정 API 직접 호출 | 403 Forbidden |
| 존재하지 않는 userId를 권한 목록에 포함 | 400 Bad Request |

---

## SC-12 프로젝트 생성·수정·삭제

- **페르소나**: PA (김민준, LEADER), PB (이서연, MEMBER)
- **목표**: 팀 구성원 누구나 프로젝트를 생성할 수 있으며, 수정·삭제는 생성자 본인만 가능함을 검증한다
- **전제조건**: 전원 로그인 상태. 팀에 소속. 프로젝트 목록 화면(S-07) 진입

### 단계별 흐름 — 프로젝트 생성 및 권한 검증

| # | 페르소나 | 사용자 행동 | 시스템 반응 | API |
|---|----------|------------|-------------|-----|
| 1 | PB | [프로젝트 생성] 버튼을 클릭한다 | 프로젝트 생성 폼 렌더링 | — |
| 2 | PB | 프로젝트명: "2분기 마케팅 캠페인", 기간: 2026-05-01~2026-06-30, 담당자: "이서연" 입력 후 [저장] | `POST /api/teams/[teamId]/projects` 요청. 201 Created. phases: [] 기본값으로 생성 | `POST /api/teams/[teamId]/projects` |
| 3 | PB | 생성된 프로젝트에 단계 추가: "기획", "실행", "마무리" | `PATCH /api/teams/[teamId]/projects/[projectId]` (body: phases: [{id, name: "기획", order: 1}, ...]) | `PATCH /api/teams/[teamId]/projects/[projectId]` |
| 4 | PA | PB가 만든 프로젝트의 [수정] 버튼을 클릭한다 | UI에서 [수정] 버튼 미표시 (생성자 아님). 직접 API 호출 시 403 Forbidden | — |
| 5 | PA | [프로젝트 생성] 버튼으로 새 프로젝트 "3분기 신제품 출시"를 생성한다 | `POST /api/teams/[teamId]/projects` 요청. 201 Created | `POST /api/teams/[teamId]/projects` |
| 6 | PB | PA가 만든 프로젝트를 [삭제] 시도한다 | 403 Forbidden. "프로젝트 삭제 권한이 없습니다" | — |
| 7 | PA | PA 본인이 만든 프로젝트를 삭제한다 | `DELETE /api/teams/[teamId]/projects/[projectId]`. 200 OK. 하위 프로젝트 일정·세부 일정 연쇄 삭제 | `DELETE /api/teams/[teamId]/projects/[projectId]` |

### 결과
- LEADER·MEMBER 모두 프로젝트를 생성할 수 있다
- 수정·삭제는 생성자 본인만 가능하다
- 프로젝트 삭제 시 하위 프로젝트 일정과 세부 일정이 함께 삭제된다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| endDate < startDate | 400 Bad Request. "종료일은 시작일 이후여야 합니다" |
| 생성자가 아닌 사용자의 수정·삭제 시도 | 403 Forbidden |

---

## SC-13 프로젝트 일정 생성·수정·삭제

- **페르소나**: PA (김민준, LEADER), PC (박지호, MEMBER)
- **목표**: 프로젝트 내 행(row) 단위 일정을 생성하고, 생성자만 수정·삭제할 수 있음을 검증한다
- **전제조건**: PB가 생성한 "2분기 마케팅 캠페인" 프로젝트가 존재. 간트차트 화면(S-08) 진입

### 단계별 흐름

| # | 페르소나 | 사용자 행동 | 시스템 반응 | API |
|---|----------|------------|-------------|-----|
| 1 | PC | 프로젝트 간트차트에서 [일정 추가] 버튼을 클릭한다 | 프로젝트 일정 생성 폼 렌더링 | — |
| 2 | PC | 제목: "SNS 콘텐츠 기획", 기간: 2026-05-01~2026-05-15, 담당자: "박지호", 단계: "기획" 선택 후 [저장] | `POST /api/teams/[teamId]/projects/[projectId]/schedules` 요청. 201 Created. 간트차트에 행으로 표시됨 | `POST /api/teams/[teamId]/projects/[projectId]/schedules` |
| 3 | PA | 같은 프로젝트에 "광고 집행" 일정을 추가한다 | `POST /api/teams/[teamId]/projects/[projectId]/schedules` 요청. 201 Created | `POST /api/teams/[teamId]/projects/[projectId]/schedules` |
| 4 | PC | PC 본인이 만든 "SNS 콘텐츠 기획" 일정의 진행률을 50%로 수정한다 | `PATCH /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]` (body: progress: 50). 200 OK | `PATCH /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]` |
| 5 | PC | PA가 만든 "광고 집행" 일정을 수정 시도한다 | UI에서 [수정] 버튼 미표시. 직접 API 호출 시 403 Forbidden | — |
| 6 | PA | PA 본인이 만든 "광고 집행" 일정을 삭제한다 | `DELETE /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]`. 200 OK. 하위 세부 일정 연쇄 삭제 | `DELETE /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]` |

### 결과
- 팀 구성원 누구나 프로젝트 일정을 생성할 수 있다
- 수정·삭제는 생성자 본인만 가능하다
- 프로젝트 일정 삭제 시 하위 세부 일정이 함께 삭제된다

---

## SC-14 세부 일정 생성·수정·삭제

- **페르소나**: PB (이서연, MEMBER), PD (최유나, MEMBER)
- **목표**: 프로젝트 일정의 세부 작업을 등록하고 권한을 검증한다
- **전제조건**: PC가 생성한 "SNS 콘텐츠 기획" 프로젝트 일정이 존재. 간트차트 화면(S-08) 진입

### 단계별 흐름

| # | 페르소나 | 사용자 행동 | 시스템 반응 | API |
|---|----------|------------|-------------|-----|
| 1 | PB | "SNS 콘텐츠 기획" 일정의 [세부 일정 추가]를 클릭한다 | 세부 일정 생성 폼 렌더링 | — |
| 2 | PB | 제목: "인스타그램 콘텐츠 초안", 기간: 2026-05-01~2026-05-07, 담당자: "이서연" 입력 후 [저장] | `POST /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]/sub-schedules` 요청. 201 Created | `POST /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]/sub-schedules` |
| 3 | PD | "유튜브 썸네일 디자인" 세부 일정을 같은 프로젝트 일정 하위에 추가한다 | `POST ...` 요청. 201 Created | `POST /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]/sub-schedules` |
| 4 | PB | PB 본인이 만든 세부 일정의 진행률을 100%로, isDelayed를 false로 수정한다 | `PATCH ...` (body: progress: 100, isDelayed: false). 200 OK | `PATCH /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]/sub-schedules/[subId]` |
| 5 | PB | PD가 만든 세부 일정을 삭제 시도한다 | 403 Forbidden. "세부 일정 삭제 권한이 없습니다" | — |
| 6 | PD | PD 본인이 만든 세부 일정을 삭제한다 | 200 OK. 목록에서 제거됨 | `DELETE /api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]/sub-schedules/[subId]` |

### 결과
- 팀 구성원 누구나 세부 일정을 생성할 수 있다
- 수정·삭제는 생성자 본인만 가능하다

---

## SC-15 공지사항 작성·삭제 권한 검증

- **페르소나**: PA (김민준, LEADER), PB (이서연, MEMBER), PC (박지호, MEMBER)
- **목표**: 팀 구성원 누구나 공지사항을 작성할 수 있으며, 삭제는 작성자 본인 또는 팀장만 가능함을 검증한다
- **전제조건**: 전원 로그인 상태. 팀 채팅 화면 진입

### 단계별 흐름

| # | 페르소나 | 사용자 행동 | 시스템 반응 | API |
|---|----------|------------|-------------|-----|
| 1 | PB | 채팅 화면에서 [공지 작성] 버튼을 클릭하고 "다음 주 월요일 오전 10시 전체 회의 있습니다" 입력 후 [등록] | `POST /api/teams/[teamId]/notices` 요청. 201 Created. 채팅 상단에 공지 고정됨 | `POST /api/teams/[teamId]/notices` |
| 2 | PC | 채팅 화면에 진입한다 | 채팅 상단에 PB가 올린 공지사항이 고정 표시됨 | `GET /api/teams/[teamId]/notices` |
| 3 | PC | PB가 올린 공지사항의 [삭제] 버튼을 클릭한다 | UI에서 [삭제] 버튼이 표시되지 않음 (작성자·팀장 아님). 직접 API 호출 시 403 Forbidden | — |
| 4 | PA | PB가 올린 공지사항을 팀장 권한으로 [삭제]한다 | `DELETE /api/teams/[teamId]/notices/[noticeId]` 요청. 200 OK. 채팅 상단에서 공지 제거됨 | `DELETE /api/teams/[teamId]/notices/[noticeId]` |
| 5 | PC | 공지사항 작성: "이번 주 금요일 회식 장소 투표 부탁드립니다" | `POST /api/teams/[teamId]/notices` 요청. 201 Created | `POST /api/teams/[teamId]/notices` |
| 6 | PC | PC 본인이 작성한 공지사항을 [삭제]한다 | `DELETE /api/teams/[teamId]/notices/[noticeId]` 요청. 200 OK | `DELETE /api/teams/[teamId]/notices/[noticeId]` |

### 결과
- LEADER·MEMBER 모두 공지사항을 작성할 수 있으며 채팅 상단에 고정된다
- 삭제는 작성자 본인 또는 팀장만 가능하다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 2000자 초과 공지 작성 시도 | 400 Bad Request. "공지사항은 최대 2000자까지 입력 가능합니다" |
| 작성자·팀장이 아닌 사용자의 삭제 시도 | 403 Forbidden |

---

## SC-16 권한 기반 가시성 통합 검증 (핵심 테스트 시나리오)

- **페르소나**: PA~PF 전원
- **목표**: 6명 팀 환경에서 일정·프로젝트·업무보고·공지사항의 권한 기반 가시성을 종합 검증한다
- **전제조건**: SC-02C 완료(6명 팀 구성). SC-11의 권한 설정 완료(업무보고 허용: PB·PD, 미허용: PC·PE·PF)

### 검증 매트릭스

| 기능 | PA (팀장) | PB (허용 MEMBER) | PC (미허용 MEMBER) | PD (허용 MEMBER) | PE (미허용 MEMBER) | PF (미허용 MEMBER) |
|------|:---------:|:---------------:|:-----------------:|:---------------:|:-----------------:|:-----------------:|
| 팀 일정 조회 | O | O | O | O | O | O |
| 팀 일정 생성 | O | O | O | O | O | O |
| 본인 일정 수정·삭제 | O | O | O | O | O | O |
| 타인 일정 수정·삭제 | X | X | X | X | X | X |
| 프로젝트 조회 | O | O | O | O | O | O |
| 프로젝트 생성 | O | O | O | O | O | O |
| 본인 프로젝트 수정·삭제 | O | O | O | O | O | O |
| 타인 프로젝트 수정·삭제 | X | X | X | X | X | X |
| 일반 채팅 열람 | O | O | O | O | O | O |
| 업무보고 채팅 열람 | O | O | X | O | X | X |
| 업무보고 조회 권한 설정 | O | X | X | X | X | X |
| 공지사항 작성 | O | O | O | O | O | O |
| 본인 공지 삭제 | O | O | O | O | O | O |
| 타인 공지 삭제 | O (팀장) | X | X | X | X | X |
| 가입 신청 승인/거절 | O | X | X | X | X | X |

### 단계별 통합 검증 흐름

| # | 검증 항목 | 페르소나 | 행동 | 기대 결과 |
|---|----------|----------|------|-----------|
| 1 | 업무보고 전송 후 가시성 | PE | WORK_PERFORMANCE 메시지 전송 | PA·PB·PD에게만 표시, PC·PE·PF에게는 미표시 |
| 2 | 일정 생성 후 수정 권한 | PF | 일정 생성 후 PE가 수정 시도 | PF 생성 일정은 PF만 수정 가능. PE는 403 |
| 3 | 프로젝트 생성 후 삭제 권한 | PD | 프로젝트 생성 후 PF가 삭제 시도 | PD 생성 프로젝트는 PD·PA만 삭제 불가 — PD만 삭제 가능, PA도 403 |
| 4 | 공지사항 삭제 권한 | PC | 공지 작성 후 PD가 삭제 시도 | PD는 403. PA(팀장) 또는 PC(작성자)만 삭제 가능 |
| 5 | 권한 일괄 해제 후 가시성 | PA | work-permissions를 빈 배열로 설정 | PC·PE·PF 모두 이제 업무보고 열람 가능 |
| 6 | 권한 재설정 후 가시성 | PA | work-permissions를 [PB.id]만으로 재설정 | PB만 업무보고 열람 가능. PD·PC·PE·PF 모두 미열람 |

### 결과
- 팀 내 역할(LEADER/MEMBER)과 생성자 기반 권한이 모든 기능에서 일관되게 동작한다
- 업무보고 열람 권한은 팀장이 실시간으로 변경 가능하며 즉시 반영된다

---

## SC-17 팀 정보 수정·삭제 (LEADER 전용)

- **페르소나**: PA (김민준, LEADER), PB (이서연, MEMBER)
- **목표**: 팀장이 팀 정보를 수정하거나 팀을 삭제할 수 있고, MEMBER는 둘 다 불가능함을 검증한다
- **전제조건**: 전원 로그인 상태. 팀에 소속. 팀 메인 화면(S-05) 진입

### 단계별 흐름 — 팀 정보 수정 / 삭제

| # | 페르소나 | 사용자 행동 | 시스템 반응 | API |
|---|----------|------------|-------------|-----|
| 1 | PA | 팀 설정에서 [팀 정보 수정] 메뉴를 연다 | 현재 정보(name·description·isPublic) pre-fill 된 폼 렌더링 | — |
| 2 | PA | 이름을 "프로젝트팀 알파 (리브랜딩)"으로 변경, isPublic을 false로 토글 후 [저장] | `PATCH /api/teams/[teamId]` 요청 (body: name, isPublic). 200 OK. 팀 목록·상세 즉시 갱신 | `PATCH /api/teams/[teamId]` |
| 3 | PB | 동일 메뉴에 진입 시도 | UI에서 [팀 정보 수정] 메뉴 미표시. 직접 API 호출 시 403 Forbidden — "팀장만 접근할 수 있습니다." | `PATCH /api/teams/[teamId]` |
| 4 | PA | [팀 삭제] 버튼 클릭 → 확인 다이얼로그에서 [삭제 확정] | `DELETE /api/teams/[teamId]` 요청. 200 OK | `DELETE /api/teams/[teamId]` |
| 5 | — | — | DB CASCADE: TeamMember·TeamJoinRequest·Schedule·ChatMessage·Notice·Postit·Project·ProjectSchedule·SubSchedule·WorkPerformancePermission 일괄 정리 | — |
| 6 | — | — | `/` (팀 목록 화면, S-03)으로 리다이렉트. 삭제된 팀이 목록에서 제거됨 | `GET /api/teams` 재조회 |
| 4' | PB | API 직접 호출로 팀 삭제 시도 | 403 Forbidden — "팀장만 접근할 수 있습니다." | `DELETE /api/teams/[teamId]` |

### 결과
- 팀장만 팀 정보 수정·삭제가 가능하다
- 팀 삭제 시 종속 데이터가 모두 정리되며 복구 불가 (BR-11)
- MEMBER의 직접 API 호출은 403으로 차단된다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| name 100자 초과 | 클라이언트 유효성 검증. API 요청 미발생 |
| 빈 body로 PATCH 호출 | 200 OK이지만 변경 사항 없음 (부분 갱신 의미상) |
| 존재하지 않는 teamId | 404 Not Found — "팀을 찾을 수 없습니다." |
| MEMBER의 PATCH/DELETE 직접 호출 | 403 Forbidden — "팀장만 접근할 수 있습니다." |

---

## SC-18 팀원 강제 탈퇴 (LEADER 전용)

- **페르소나**: PA (김민준, LEADER), PF (한소율, 탈퇴 대상 MEMBER), PB (이서연, MEMBER)
- **목표**: 팀장이 특정 팀원을 강제 탈퇴시킬 수 있고, 팀장 본인은 대상이 될 수 없으며, MEMBER는 강제 탈퇴 권한이 없음을 검증한다
- **전제조건**: 전원 로그인 상태. PA·PB·PF 모두 동일 팀 소속. 팀 상세 화면(S-05)의 구성원 목록에 진입

### 단계별 흐름

| # | 페르소나 | 사용자 행동 | 시스템 반응 | API |
|---|----------|------------|-------------|-----|
| 1 | PA | 구성원 목록에서 PF의 [탈퇴 처리] 버튼을 클릭 → 확인 다이얼로그 [확정] | `DELETE /api/teams/[teamId]/members/[PF.userId]` 요청 | `DELETE /api/teams/[teamId]/members/[userId]` |
| 2 | — | — | 200 OK — "팀원이 탈퇴 처리되었습니다." TeamMember 레코드 제거 | — |
| 3 | — | — | 구성원 목록 갱신, PF가 제거됨 | `GET /api/teams/[teamId]` 재조회 |
| 4 | PF | 다음 폴링 또는 화면 새로고침 시 | 팀 목록에서 해당 팀이 빠진 것을 확인. 직접 URL 접근 시 403 Forbidden | `GET /api/teams` |
| 5 | PA | 본인(PA)을 강제 탈퇴 시도 | 400 Bad Request — "팀장은 탈퇴시킬 수 없습니다." | `DELETE /api/teams/[teamId]/members/[PA.userId]` |
| 6 | PB | API 직접 호출로 다른 MEMBER를 탈퇴 시도 | 403 Forbidden — "팀장만 접근할 수 있습니다." | `DELETE /api/teams/[teamId]/members/[anyUserId]` |

### 결과
- 팀장이 일반 MEMBER만 강제 탈퇴시킬 수 있다 (BR-12)
- 팀장 본인은 강제 탈퇴 대상이 될 수 없다 (자신을 지정 시 400)
- MEMBER의 직접 API 호출은 403으로 차단된다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 해당 팀의 멤버가 아닌 userId 지정 | 404 Not Found — "해당 팀원을 찾을 수 없습니다." |
| 팀장 본인 userId 지정 | 400 Bad Request — "팀장은 탈퇴시킬 수 없습니다." |
| MEMBER가 직접 API 호출 | 403 Forbidden |

---

## SC-19 내 프로필(이름) 수정

- **페르소나**: PA~PF 공통 (LEADER·MEMBER 무관, 본인 한정)
- **목표**: 로그인 사용자가 자신의 표시 이름을 수정하고, 변경 결과가 모든 화면(구성원 목록·일정 작성자·메시지 발신자 등)에 반영됨을 확인한다
- **전제조건**: 로그인 상태. 토큰 유효

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 헤더 아바타 → [내 정보] 메뉴 클릭 | 현재 사용자 정보 조회: `GET /api/auth/me`. 응답의 id·email·name 으로 폼 pre-fill | `GET /api/auth/me` |
| 2 | name 입력 필드를 새 값(예: "김민준 (팀장)")으로 변경 후 [저장] | 클라이언트 유효성 검증: trim 후 1~50자 | — |
| 3 | — | `PATCH /api/me` 요청 (body: { name }) | `PATCH /api/me` |
| 4 | — | 200 OK. 응답 body의 `{ id, email, name }`로 클라이언트 사용자 상태(Zustand) 갱신 | — |
| 5 | — | 팀 상세·캘린더·채팅 등 사용자 이름이 표시되는 모든 영역 다음 조회 시 새 이름 반영 | 각 화면 자체 refetch |

### 결과
- User.name 이 갱신되어 모든 화면(creatorName / senderName / 구성원 목록)에 새 이름이 표시된다
- email·id 는 변경되지 않는다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 빈 문자열 또는 공백뿐인 name | 400 Bad Request — "이름은 필수입니다." |
| trim 후 50자 초과 | 400 Bad Request — "이름은 최대 50자까지 입력 가능합니다." |
| 토큰 만료 상태로 PATCH 호출 | 401 Unauthorized → 클라이언트가 `/auth/refresh`로 갱신 후 재시도 |
| 토큰의 userId에 해당하는 사용자 부재(예: 동시 탈퇴) | 404 Not Found — "사용자를 찾을 수 없습니다." |

---

## SC-20 프로젝트 전용 채팅 메시지 송수신 + 컨텍스트 격리

- **페르소나**: PA (LEADER) / PB / PC (MEMBER)
- **목표**: 프로젝트 갠트뷰에서 우측 채팅 영역이 자동으로 그 프로젝트 채팅으로 전환되며, 일자별 채팅·다른 프로젝트 채팅과 메시지가 격리됨을 확인한다
- **전제조건**: 팀에 PROJ-A·PROJ-B 두 프로젝트 존재. 모두 로그인 상태

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | PA가 좌측 캘린더의 [프로젝트 관리] 클릭 → PROJ-A 선택 | 좌측 갠트차트 노출. 우측 탭 라벨이 "팀채팅" → "**[신규 대시보드 개발] 채팅**" 으로 자동 변경 | — |
| 2 | PA가 메시지 "API 스펙 5/15 확정" 입력 후 전송 | `POST /api/teams/[teamId]/projects/PROJ-A/messages` (body: content) | `POST /api/teams/[teamId]/projects/[projectId]/messages` |
| 3 | — | 201 Created, `chat_messages.project_id = PROJ-A` 로 INSERT | — |
| 4 | PB가 같은 PROJ-A 채팅방 진입 (3초 폴링) | `GET /api/teams/[teamId]/projects/PROJ-A/messages` | `GET /api/teams/[teamId]/projects/[projectId]/messages` |
| 5 | — | PA의 메시지 표시 ✓ | — |
| 6 | PC가 좌측 view 를 [월간]으로 전환 | 우측 탭 라벨이 "팀채팅" 으로 자동 복귀. 일자별 채팅 메시지만 표시 | — |
| 7 | PC가 일자별 채팅 조회 | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` 호출 — `WHERE project_id IS NULL` 필터로 SC-20 의 PROJ-A 메시지는 **안 보임** ✓ | `GET /api/teams/[teamId]/messages` |
| 8 | PB가 PROJ-B 로 전환 | 빈 채팅방 (PROJ-B 메시지만, PROJ-A 와 격리) ✓ | — |

### 결과
- 같은 팀 안에 일자별 채팅·PROJ-A 채팅·PROJ-B 채팅 셋이 격리되어 보관됨
- 좌측 view 가 project 일 때만 해당 프로젝트 채팅이 활성, 그 외엔 일자별 채팅

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 다른 팀의 projectId 로 메시지 전송 시도 | 404 Not Found — "프로젝트를 찾을 수 없습니다." |
| 팀에 속하지 않은 사용자가 프로젝트 채팅 조회 | 403 Forbidden (`withTeamRole` 미들웨어) |

---

## SC-21 프로젝트 전용 공지사항 작성·삭제 + 격리

- **페르소나**: PA (LEADER) / PB (MEMBER, 본인 작성)
- **목표**: 프로젝트별 공지사항이 그 프로젝트 채팅방에서만 노출되며, 작성자 또는 팀장만 삭제 가능함을 확인한다
- **전제조건**: PROJ-A 활성 채팅방

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | PB가 PROJ-A 채팅방에서 공지 "5/15 API 스펙 확정 회의" 작성 | `POST /api/teams/[teamId]/projects/PROJ-A/notices` (body: content) | `POST /api/teams/[teamId]/projects/[projectId]/notices` |
| 2 | — | 201 Created, `notices.project_id = PROJ-A`, 채팅 상단 NoticeBanner 에 고정 표시 | — |
| 3 | PA가 PROJ-B 로 전환 | PB의 PROJ-A 공지가 **안 보임** ✓ (격리) | — |
| 4 | PA가 일자별 채팅으로 복귀 | PROJ-A 공지가 **안 보임** ✓ (project_id IS NULL 필터) | — |
| 5 | PB가 본인 공지의 [✕] 클릭 | `DELETE /api/teams/[teamId]/notices/[noticeId]` 호출 | `DELETE /api/teams/[teamId]/notices/[noticeId]` |
| 6 | — | 200 OK, 배너에서 사라짐 | — |

### 결과
- 프로젝트별 공지가 격리되어 다른 채팅방에 노출되지 않음
- 작성자 본인 또는 팀장만 삭제 가능 (BR-10)

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| PC(작성자도 팀장도 아닌 MEMBER)가 PB의 공지 삭제 시도 | 403 Forbidden — "작성자 또는 팀장만 삭제 가능" |

---

## SC-22 자료실 글 작성·수정·삭제 + 첨부파일 다운로드

- **페르소나**: PA (LEADER, 글 작성·삭제) / PB (다른 사용자, 다운로드만 가능) / PC (회귀 검증)
- **목표**: 채팅방 sub-탭 "자료실" 에서 글 + 첨부파일을 등록하고, 작성자 본인만 수정·삭제 가능하며, 같은 팀 멤버는 첨부 다운로드 가능함을 확인한다
- **전제조건**: 우측 채팅 영역의 "채팅 / 자료실" sub-탭 활성

### 단계별 흐름 — 글 작성 + 첨부

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | PA가 우측 [자료실] sub-탭 클릭 → [+ 글쓰기] | PostEditor 렌더 (제목·본문·첨부 input) | — |
| 2 | 제목 "Q2 OKR 초안", 본문 입력, `okr-q2.pdf` 파일(2MB) 선택 | 클라이언트 size 검증 (≤10MB 통과) | — |
| 3 | [등록] 클릭 | `POST /api/teams/[teamId]/board` (multipart: title, content, file) | `POST /api/teams/[teamId]/board` |
| 4 | — | backend `validateUpload()`: MIME 화이트리스트 통과 + magic bytes(`%PDF`) 일치 ✓ | — |
| 5 | — | `LocalStorageAdapter.save()` → UUID 파일명으로 `files/<uuid>.pdf` 저장 | — |
| 6 | — | 트랜잭션: BoardPost INSERT + BoardAttachment INSERT (`stored_name`, `size_bytes`) | — |
| 7 | — | 201 Created, 자료실 목록에 글 추가 (📎 1) | — |

### 단계별 흐름 — 다운로드 (다른 사용자)

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | PB가 PA의 글 클릭 → 첨부파일 [okr-q2.pdf] 클릭 | `GET /api/files/[fileId]` 요청 | `GET /api/files/[fileId]` |
| 2 | — | backend: attachment → post → team_id 조인. PB가 같은 팀 멤버 검증 ✓ | — |
| 3 | — | `Content-Disposition: attachment; filename*=UTF-8''okr-q2.pdf` + `X-Content-Type-Options: nosniff` 헤더로 stream 응답 | — |
| 4 | — | 브라우저가 inline 렌더 안 하고 다운로드 처리 | — |

### 단계별 흐름 — 작성자만 수정·삭제

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | PB가 PA의 글 상세 보기 | [수정]·[삭제] 버튼 **미노출** (작성자 본인 아님) | — |
| 2 | PA가 본인 글 상세 → [수정] | PostEditor (기존 값 pre-fill) | — |
| 3 | PA가 새 파일 `okr-q2-v2.pdf` 첨부 후 저장 | `PATCH /api/teams/[teamId]/board/[postId]` (multipart) | — |
| 4 | — | 기존 첨부 unlink + 신규 저장 + DB row 갱신 | — |
| 5 | PA가 [삭제] | `DELETE /api/teams/[teamId]/board/[postId]` | — |
| 6 | — | BoardPost 행 + CASCADE 로 BoardAttachment 행 삭제 + 디스크 파일 unlink | — |

### 결과
- BoardPost·BoardAttachment row 와 디스크 파일이 일관되게 관리
- 같은 팀 멤버 누구나 다운로드 가능, 다른 팀 멤버는 403
- 작성자 본인만 수정·삭제 (BR-13)

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 11MB 파일 업로드 시도 | 413 Payload Too Large — "파일 크기는 최대 10MB" |
| 확장자만 `.png` 인 실행파일(magic bytes 미스매치) | 415 Unsupported Media Type — "파일 헤더가 인식되지 않습니다" |
| SVG 파일 업로드 | 415 — 화이트리스트 외 |
| PB가 PA 글 PATCH/DELETE 시도 | 403 Forbidden — "본인이 작성한 글만 수정/삭제 가능" |
| 다른 팀 사용자가 `/api/files/[fileId]` 호출 | 403 Forbidden (`withTeamRole`) |
| DB row 는 있지만 디스크 객체 미존재 | 410 Gone — "디스크에서 파일을 찾을 수 없습니다" |

---

## SC-23 AI 버틀러 — 사용법 질문 (RAG 답변)

- **페르소나**: PA~PF 공통
- **목표**: AI 버틀러 탭에서 자연어 사용법 질문이 RAG 로 라우팅되어 공식 문서 기반 답변을 받는다
- **전제조건**: RAG 서버(`:8787`) + Ollama gemma4:26b 가용

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 우측 [AI 버틀러] 탭 클릭 | AIAssistantPanel 렌더, 환영 메시지 + 예시 질문 4개 | — |
| 2 | "포스트잇 색깔 종류 알려줘" 입력 후 전송 | `POST /api/ai-assistant/chat` (body: question, teamId, stream:true) — JWT 헤더 포함 | `POST /api/ai-assistant/chat` |
| 3 | — | RAG `/classify` → `intent: usage, matched: "포스트잇"` | — |
| 4 | — | SSE `meta` 이벤트 (source: "rag") 즉시 송출 → "Thinking..." 표시 | — |
| 5 | — | RAG `/chat` stream:true → Ollama → `sources` 5건(score) + `token` 점진 송출 | — |
| 6 | — | 답변 카드에 "📚 TEAM WORKS 공식 문서 5건 참조" 출처 뱃지 표시 | — |

### 결과
- 첫 토큰 ~3~10초 안에 도착, 사용자 체감 즉시 응답 시작
- "포스트잇은 amber/blue/emerald/indigo/rose 5색…" 같은 정확한 답변

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| RAG 답변이 거절형(예: "안내되어 있지 않습니다") | `fallback: rag-refused` → Open WebUI 일반 답변으로 전환 |
| RAG 서버 다운 | 502 Bad Gateway — "AI 서버에 연결할 수 없습니다" |

---

## SC-24 AI 버틀러 — 일반 질문 (웹 검색 답변)

- **페르소나**: PA~PF 공통
- **목표**: 사용법·일정 외 일반 질문이 SearxNG + Open WebUI 로 라우팅된다

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | "오늘 뉴스 검색해줘" 입력 | `intent: general, matched: "뉴스"` 분류 | — |
| 2 | — | SSE `meta` (source: "web") + SearxNG 5건 검색 (~2초) | — |
| 3 | — | SSE `sources` 이벤트로 5건 URL 즉시 송출 (사용자 화면에 출처 먼저 표시) | — |
| 4 | — | 검색 결과를 system prompt 에 inline 주입 후 Open WebUI gemma4:26b stream | — |
| 5 | — | SSE `progress` ("🔎 검색 결과를 분석 중…") + `token` 점진 송출 | — |
| 6 | — | 답변 카드에 "🌐 웹 검색 5건 참조" 뱃지 + 클릭 가능한 출처 링크 | — |

### 결과
- 검색 결과가 답변보다 먼저 표시되어 사용자가 신뢰성 즉시 판단 가능
- 답변은 30~120초 (모델 생성 시간) — SSE 로 점진 표시

---

## SC-25 AI 버틀러 — 일정 조회 (자연어 → 코드 포맷)

- **페르소나**: PA~PF 공통 (자기 팀 활성 컨텍스트)
- **목표**: 자연어 일정 조회가 LLM 답변 본문 생성 없이 즉시 응답된다

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | "오늘 일정 알려줘" 입력 | `intent: schedule_query` 분류 | — |
| 2 | — | RAG `/parse-schedule-query` 호출 → `{view:"day", date:"2026-04-29", keyword:""}` (LLM 1회) | — |
| 3 | — | `getSchedules({teamId, jwt, view, date})` → backend `GET /api/teams/:teamId/schedules?view=day&date=2026-04-29` | `GET /api/teams/[teamId]/schedules` |
| 4 | — | backend `withAuth`+`withTeamRole` 검증 후 SQL 실행, 일정 N건 반환 | — |
| 5 | — | `formatSchedules()` 가 "기획팀 팀의 2026-04-29 일정 N건: • 4. 29. 10:00~12:00 디자인 리뷰…" 한국어 포맷 (코드, LLM 0회) | — |
| 6 | — | SSE `token` 1회로 즉시 송출 ✓ | — |

### 단계별 흐름 — 키워드 매치 + month 자동 확장

| # | 사용자 행동 | 시스템 반응 |
|---|------------|-------------|
| 1 | "디자인 리뷰 일정 언제야?" 입력 | parser → `{view:"day", date:오늘, keyword:"디자인 리뷰"}` |
| 2 | — | day 범위 매치 0건 → 자동으로 month 범위로 fallback 재조회 |
| 3 | — | "기획팀 팀의 2026-04 '디자인 리뷰' 일정 1건: • 4. 29. 10:00 ~ 12:00 디자인 리뷰" 답변 |

### 결과
- 일정 조회는 LLM 답변 생성 없이 즉시 응답 (UX 측면에서 가장 빠른 경로)
- keyword 가 좁은 범위에서 매치 안 되면 자동으로 더 넓은 범위로 확장

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| JWT 만료 | 401 → frontend 가 "로그인이 만료됐어요" 안내 |
| teamId 미선택(활성 팀 없음) | 400 — "활성 팀이 없습니다. 팀을 먼저 선택해 주세요" |

---

## SC-26 AI 버틀러 — 일정 등록 (confirm + 다중 턴)

- **페르소나**: PA~PF 공통
- **목표**: 자연어 일정 등록이 사용자 명시 승인 후에만 INSERT 되며, 정보 부족 시 다중 턴 후속 질문으로 채워진다

### 단계별 흐름 — 정보 충분

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | "내일 오후 3시 주간회의 등록해줘" 입력 | `intent: schedule_create` | — |
| 2 | — | `/parse-schedule-args` → `{ok:true, args:{title:"주간회의", startAt:"2026-04-30T06:00:00.000Z", endAt:"...07:00:00.000Z"}}` (KST→UTC 변환) | — |
| 3 | — | SSE `pending-action` 이벤트로 confirm 카드 데이터 송출 | — |
| 4 | — | UI 에 "다음 내용으로 일정 등록할까요? • 제목: 주간회의 • 시작: 2026.4.30. PM 3:00 …" + [✓ 승인] [✗ 취소] 버튼 | — |
| 5 | 사용자 [✓ 승인] 클릭 | `POST /api/ai-assistant/execute` (tool: createSchedule, args + teamId) | `POST /api/ai-assistant/execute` |
| 6 | — | TOOL_WHITELIST 검증 → backend `POST /api/teams/:teamId/schedules` (created_by = JWT userId 강제) | — |
| 7 | — | DB INSERT + React Query `invalidate(['schedules', teamId])` → 좌측 캘린더 자동 갱신 | — |

### 단계별 흐름 — 정보 부족 (다중 턴)

| # | 사용자 행동 | 시스템 반응 |
|---|------------|-------------|
| 1 | "내일 회의 등록해줘" (시간 미명시) | parser → `{ok:false, needs:"time", hint:"몇 시에 잡을까요?"}` |
| 2 | — | SSE `token` (hint) + `awaiting-input` 이벤트. 메시지에 `awaitingInput: { previousQuestion: "내일 회의 등록해줘" }` 부착 |
| 3 | UI: "몇 시에 잡을까요?" 표시 | — |
| 4 | 사용자 "오후 3시" 입력 | `sendQuestion` 이 직전 awaitingInput 감지 → `effectiveQuestion = "내일 회의 등록해줘\n그리고 오후 3시"` 로 합쳐 재요청 |
| 5 | — | parser → `{ok:true, args:{...}}` → confirm 카드 등장 (위 흐름 5~7 진행) |

### 결과
- 사용자 승인 전엔 DB 변경 0
- 정보가 부족해도 자연스러운 후속 질문으로 채울 수 있음 (turn 누적)

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 사용자 [✗ 취소] | execute 호출 안 됨, "실행을 취소했어요" 시스템 메시지 |
| AI 가 args 의 created_by 를 다른 userId 로 위조 시도 | execute route 가 무시. backend 가 JWT userId 로 강제 |
| AI 가 다른 도구(예: deleteSchedule) 호출 시도 | TOOL_WHITELIST 외 → 400 "지원하지 않는 도구" |

---

## SC-27 AI 버틀러 — 거절 안내 (지원 외 의도)

- **페르소나**: PA~PF 공통
- **목표**: 일정 수정·삭제 / 프로젝트·채팅·공지·포스트잇·자료실 등 다른 도메인 요청은 정중히 거절된다

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 |
|---|------------|-------------|
| 1 | "어제 회의 삭제해줘" 입력 | `intent: blocked, subreason: schedule_modify` 분류 |
| 2 | — | SSE `meta` (source: "blocked") + `token` 1회 |
| 3 | — | "찰떡이는 **일정 조회·등록** 만 도와드릴 수 있어요. 일정 수정·삭제는 캘린더에서 직접 처리해 주세요. 🙏" |
| 4 | "프로젝트 일정 추가해줘" 입력 | `intent: blocked, subreason: other_domain, matched: "프로젝트"` |
| 5 | — | "프로젝트·채팅·공지·포스트잇 같은 작업은 화면에서 직접 처리해 주세요" 안내 |
| 6 | "프로젝트 등록하는 법 알려줘" 입력 (사용법 시그널 + 거절 키워드 동시 매치) | `intent: usage` (USAGE_KEYWORDS "하는 법" 우선 매칭) |
| 7 | — | RAG 답변 — blocked 가 아닌 사용법 답변 ✓ |

### 결과
- 일정 수정·삭제·다른 도메인 요청은 즉시 거절 (LLM 호출 0, ms 단위 응답)
- 사용법 질문(예: "프로젝트 등록하는 법") 은 USAGE_KEYWORDS 우선으로 RAG 답변 받음

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| 키워드 매치 모호 (`unknown`) | RAG `/chat` 시도 후 거절형이면 Open WebUI fallback (안전망) |

---

## 부록: API 엔드포인트 요약 (업데이트)

| 시나리오 | 메서드 | 엔드포인트 | 설명 |
|----------|--------|------------|------|
| SC-01 | POST | `/api/auth/signup` | 회원가입 |
| SC-01 | POST | `/api/auth/login` | 로그인 |
| SC-01 | POST | `/api/auth/refresh` | Access Token 재발급 |
| SC-19 | GET | `/api/auth/me` | 내 정보 조회 (세션 복구) |
| SC-19 | PATCH | `/api/me` | 내 프로필(이름) 수정 |
| SC-02 | POST | `/api/teams` | 팀 생성 |
| SC-17 | PATCH | `/api/teams/[teamId]` | 팀 정보 수정 (LEADER) |
| SC-17 | DELETE | `/api/teams/[teamId]` | 팀 삭제 (LEADER) |
| SC-18 | DELETE | `/api/teams/[teamId]/members/[userId]` | 팀원 강제 탈퇴 (LEADER) |
| SC-02B | GET | `/api/teams/public` | 공개 팀 목록 조회 |
| SC-02B | POST | `/api/teams/[teamId]/join-requests` | 팀 가입 신청 |
| SC-02C | GET | `/api/me/tasks` | 나의 할 일 목록 |
| SC-02C | GET | `/api/teams/[teamId]/join-requests` | 특정 팀 PENDING 신청 목록 |
| SC-02C | PATCH | `/api/teams/[teamId]/join-requests/[requestId]` | 가입 신청 승인/거절 |
| SC-03~SC-06 | GET | `/api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD` | 팀 일정 조회 |
| SC-03~SC-06 | GET | `/api/teams/[teamId]/schedules/[scheduleId]` | 일정 상세 조회 |
| SC-05 | POST | `/api/teams/[teamId]/schedules` | 일정 생성 |
| SC-06 | PATCH | `/api/teams/[teamId]/schedules/[scheduleId]` | 일정 수정 |
| SC-03 | DELETE | `/api/teams/[teamId]/schedules/[scheduleId]` | 일정 삭제 |
| SC-07~SC-09 | GET | `/api/teams/[teamId]/messages?date=YYYY-MM-DD` | 날짜별 채팅 조회 |
| SC-07~SC-09 | POST | `/api/teams/[teamId]/messages` | 채팅 메시지 전송 |
| SC-10 | GET | `/api/teams/[teamId]/postits?date=YYYY-MM-DD` | 날짜별 포스트잇 조회 |
| SC-10 | POST | `/api/teams/[teamId]/postits` | 포스트잇 생성 |
| SC-10 | PATCH | `/api/teams/[teamId]/postits/[postitId]` | 포스트잇 수정 |
| SC-10 | DELETE | `/api/teams/[teamId]/postits/[postitId]` | 포스트잇 삭제 |
| SC-11 | GET | `/api/teams/[teamId]/work-permissions` | 업무보고 열람 권한 조회 |
| SC-11 | PATCH | `/api/teams/[teamId]/work-permissions` | 업무보고 열람 권한 설정 |
| SC-12 | GET | `/api/teams/[teamId]/projects` | 프로젝트 목록 조회 |
| SC-12 | POST | `/api/teams/[teamId]/projects` | 프로젝트 생성 |
| SC-12 | PATCH | `/api/teams/[teamId]/projects/[projectId]` | 프로젝트 수정 |
| SC-12 | DELETE | `/api/teams/[teamId]/projects/[projectId]` | 프로젝트 삭제 |
| SC-13 | POST | `/api/teams/[teamId]/projects/[projectId]/schedules` | 프로젝트 일정 생성 |
| SC-13 | PATCH | `/api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]` | 프로젝트 일정 수정 |
| SC-13 | DELETE | `/api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]` | 프로젝트 일정 삭제 |
| SC-14 | POST | `/api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]/sub-schedules` | 세부 일정 생성 |
| SC-14 | PATCH | `/api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]/sub-schedules/[subId]` | 세부 일정 수정 |
| SC-14 | DELETE | `/api/teams/[teamId]/projects/[projectId]/schedules/[scheduleId]/sub-schedules/[subId]` | 세부 일정 삭제 |
| SC-15 | GET | `/api/teams/[teamId]/notices` | 팀 일자별 공지 목록 조회 (`project_id IS NULL`) |
| SC-15 | POST | `/api/teams/[teamId]/notices` | 팀 일자별 공지 작성 |
| SC-15, SC-21 | DELETE | `/api/teams/[teamId]/notices/[noticeId]` | 공지 삭제 (팀/프로젝트 공지 공용) |
| SC-20 | GET | `/api/teams/[teamId]/projects/[projectId]/messages` | 프로젝트 전용 채팅 조회 |
| SC-20 | POST | `/api/teams/[teamId]/projects/[projectId]/messages` | 프로젝트 전용 채팅 전송 |
| SC-21 | GET | `/api/teams/[teamId]/projects/[projectId]/notices` | 프로젝트 전용 공지 조회 |
| SC-21 | POST | `/api/teams/[teamId]/projects/[projectId]/notices` | 프로젝트 전용 공지 작성 |
| SC-22 | GET | `/api/teams/[teamId]/board?projectId=` | 자료실 글 목록 (projectId 있으면 프로젝트, 없으면 팀) |
| SC-22 | POST | `/api/teams/[teamId]/board` | 자료실 글 작성 (multipart, 첨부 1개 옵션) |
| SC-22 | GET | `/api/teams/[teamId]/board/[postId]` | 자료실 글 상세 |
| SC-22 | PATCH | `/api/teams/[teamId]/board/[postId]` | 자료실 글 수정 (작성자만, multipart) |
| SC-22 | DELETE | `/api/teams/[teamId]/board/[postId]` | 자료실 글 삭제 (작성자만) |
| SC-22 | GET | `/api/files/[fileId]` | 첨부파일 다운로드 (Local stream / S3 redirect 자동 분기) |
| SC-23~27 | POST | `/api/ai-assistant/chat` | AI 어시스턴트 4-way 분기 SSE (frontend route) |
| SC-26 | POST | `/api/ai-assistant/execute` | confirm 카드 ✓ 후 도구 실행 (createSchedule 화이트리스트) |
| SC-23, SC-25, SC-27 | POST | (RAG `:8787`) `/classify` | 의도 분류기 — 키워드 매치 |
| SC-25 | POST | (RAG `:8787`) `/parse-schedule-query` | 자연어 → view+date+keyword |
| SC-26 | POST | (RAG `:8787`) `/parse-schedule-args` | 자연어 → 일정 등록 인자 (또는 후속 질문) |
| SC-23 | POST | (RAG `:8787`) `/chat` | RAG 답변 stream (think:false) |

---
