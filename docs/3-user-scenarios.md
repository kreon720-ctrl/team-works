# Team CalTalk 사용자 시나리오 문서

## 문서 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2026-04-07 | 최초 작성 |
| 1.1 | 2026-04-08 | SC-02(팀 생성) 단순화, SC-03(초대 수락) 제거 → SC-02B(팀 탐색·가입 신청), SC-02C(팀장 승인/거절) 신규 추가. 부록 API 목록 갱신 |
| 1.2 | 2026-04-08 | SC-03(일정 삭제) 신규 추가, 부록 API 목록에 DELETE 엔드포인트 추가 |

---

## 개요

본 문서는 Team CalTalk의 사용자 페르소나가 각 목표를 달성하기 위해 앱을 사용하는 흐름을 단계별로 서술합니다.
개발자가 화면 흐름과 API 호출 순서를 바로 파악할 수 있는 수준으로 작성되었습니다.

### 페르소나 요약

| 페르소나 | 역할 | 주요 사용 환경 |
|----------|------|----------------|
| Persona A | LEADER (팀장, 40대) | 데스크탑, 아침 출근 후 주간 일정 확인 및 즉시 수정. 가입 신청 승인/거절 처리 |
| Persona B | MEMBER (팀원, 20~30대) | 모바일, 공개 팀 탐색 후 가입 신청. 승인 후 출퇴근 중 일정·채팅 동시 확인 및 변경 요청 |

### 시나리오 목록

| ID | 제목 | 페르소나 | 연관 UC |
|----|------|----------|---------|
| SC-01 | 회원가입 및 로그인 | 공통 | UC-01 |
| SC-02 | 팀 생성 | LEADER | UC-02 |
| SC-02B | 공개 팀 탐색 및 가입 신청 | MEMBER (가입 희망자) | UC-02B |
| SC-02C | 가입 신청 승인/거절 (나의 할 일) | LEADER | UC-02C |
| SC-04 | 팀 월간 일정 조회 | LEADER / MEMBER | UC-03 |
| SC-05 | 팀 일정 추가 | LEADER | UC-04 |
| SC-06 | 팀 일정 수정 | LEADER | UC-04 |
| SC-07 | 날짜별 채팅 조회 및 메시지 전송 | LEADER / MEMBER | UC-05 |
| SC-08 | 일정 변경 요청 채팅 전송 | MEMBER | UC-06 |
| SC-09 | 캘린더 + 채팅 동시 화면에서 날짜 연동 | LEADER / MEMBER | UC-07 |

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
| 4 | — | 서버가 이메일 조회 후 bcrypt 비밀번호 비교. 일치 시 Access Token + Refresh Token 발급 | — |
| 5 | — | 응답 200 OK. 토큰 저장 | — |
| 6 | — | `/` (팀 목록 화면)으로 자동 리다이렉트 | — |

### 결과
- 인증 토큰이 클라이언트에 저장되며, 이후 모든 API 요청에 Authorization 헤더로 포함된다
- 사용자는 팀 목록 화면(S-03)에서 서비스를 시작할 수 있다

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
| 4 | — | 서버가 LEADER 권한 검증 후 Schedule 레코드 삭제 | — |
| 5 | — | 응답 200 OK | — |
| 6 | — | 캘린더 뷰 갱신. 삭제된 일정이 해당 날짜 셀에서 제거됨 | `GET /api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD` 재조회 |

### 결과
- Schedule 레코드가 DB에서 삭제된다
- 해당 팀의 모든 팀원이 다음 캘린더 조회 시 삭제된 일정을 더 이상 볼 수 없다

### 예외 처리

| 케이스 | 시스템 반응 |
|--------|-------------|
| **MEMBER가 일정 삭제 시도** | UI에서 [삭제] 버튼 미표시. 직접 `DELETE /api/teams/[teamId]/schedules/[scheduleId]` 호출 시 → **403 Forbidden** 반환 |
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

## SC-05 팀 일정 추가 (LEADER)

- **페르소나**: Persona A (LEADER)
- **목표**: 팀 캘린더에 새로운 일정을 등록한다
- **전제조건**: 로그인 상태. LEADER 권한으로 팀에 소속. 팀 메인 화면(S-05) 또는 캘린더 뷰 진입 상태

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 캘린더에서 [+ 일정 추가] 버튼 또는 특정 날짜 셀을 클릭한다 | `/teams/[teamId]/schedules/new` (S-06) 또는 인라인 생성 폼 렌더링 | — |
| 2 | 제목(필수), 설명(선택), 시작 일시, 종료 일시를 입력한다 | 클라이언트 측 유효성 검증: 제목 필수, 제목 최대 200자, startAt < endAt 확인 | — |
| 3 | [저장] 버튼을 클릭한다 | `POST /api/teams/[teamId]/schedules` 요청 전송 (body: title, description, startAt, endAt) | `POST /api/teams/[teamId]/schedules` |
| 4 | — | 서버가 LEADER 권한 검증 후 Schedule 레코드 생성 (createdBy: 현재 사용자 id). startAt < endAt 서버 측 재검증 | — |
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
| MEMBER 권한 사용자가 일정 추가 시도 | UI에서 [+ 일정 추가] 버튼 미표시. 직접 API 호출 시 `POST /api/teams/[teamId]/schedules` → 403 Forbidden |

---

## SC-06 팀 일정 수정 (LEADER)

- **페르소나**: Persona A (LEADER)
- **목표**: 등록된 팀 일정의 내용을 변경한다
- **전제조건**: 로그인 상태. LEADER 권한으로 팀에 소속. 수정 대상 Schedule이 DB에 존재. 캘린더 뷰에서 해당 일정이 표시된 상태

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 캘린더에서 수정할 일정을 클릭하여 상세 팝업을 연다 | `GET /api/teams/[teamId]/schedules/[scheduleId]` 요청 전송. 일정 상세 정보(title, description, startAt, endAt) 렌더링 | `GET /api/teams/[teamId]/schedules/[scheduleId]` |
| 2 | 상세 팝업에서 [수정] 버튼을 클릭한다 | 수정 폼으로 전환 (기존 값 pre-fill) | — |
| 3 | 변경할 필드를 수정한다 | 클라이언트 측 유효성 검증 (제목 필수, 최대 200자, startAt < endAt) | — |
| 4 | [저장] 버튼을 클릭한다 | `PATCH /api/teams/[teamId]/schedules/[scheduleId]` 요청 전송 (body: 변경된 필드) | `PATCH /api/teams/[teamId]/schedules/[scheduleId]` |
| 5 | — | 서버가 LEADER 권한 검증 후 Schedule 레코드 업데이트. startAt < endAt 서버 측 재검증 | — |
| 6 | — | 응답 200 OK | — |
| 7 | — | 캘린더 뷰 갱신. 수정된 일정 내용이 반영됨 | `GET /api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD` 재조회 |

### 결과
- Schedule 레코드가 변경된 값으로 업데이트된다
- 해당 팀의 모든 팀원이 다음 캘린더 조회 시 수정된 일정을 확인할 수 있다

### 예외 처리 (MEMBER 수정 시도 포함)

| 케이스 | 시스템 반응 |
|--------|-------------|
| **MEMBER가 일정 수정 시도** | UI에서 [수정] 버튼 미표시 (역할 기반 렌더링 제어). MEMBER가 직접 `PATCH /api/teams/[teamId]/schedules/[scheduleId]` 호출 시 → **403 Forbidden** 반환. "일정 수정 권한이 없습니다" 메시지 표시 |
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
| 3 | — | 채팅 영역에 메시지 목록 렌더링. SCHEDULE_REQUEST 타입 메시지는 시각적으로 구분 표시 (FR-05-4) | — |
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

## SC-08 일정 변경 요청 채팅 전송 (MEMBER)

- **페르소나**: Persona B (MEMBER)
- **목표**: 팀 일정 변경이 필요한 상황을 LEADER에게 공식 채팅 요청으로 전달한다
- **전제조건**: 로그인 상태. MEMBER 권한으로 팀에 소속. 팀 메인 화면(S-05) 채팅 영역 진입 상태 (BR-04)

### 단계별 흐름

| # | 사용자 행동 | 시스템 반응 | API |
|---|------------|-------------|-----|
| 1 | 채팅 영역에서 [일정 변경 요청] 버튼을 클릭한다 | 일정 변경 요청 메시지 입력 모드로 전환. 입력창 또는 별도 모달 렌더링 | — |
| 2 | 변경 요청 내용(사유, 희망 일정 등)을 텍스트로 입력한다 | 클라이언트 측 유효성 검증: 최대 2000자, 빈 메시지 불가 | — |
| 3 | [전송] 버튼을 클릭한다 | `POST /api/teams/[teamId]/messages` 요청 전송 (body: content, type: "SCHEDULE_REQUEST") | `POST /api/teams/[teamId]/messages` |
| 4 | — | 서버가 ChatMessage 레코드 생성 (type: SCHEDULE_REQUEST, senderId: 현재 MEMBER, sentAt: 현재 서버 시각 KST) | — |
| 5 | — | 응답 201 Created | — |
| 6 | — | 메시지 전송 성공 후 TanStack Query 즉시 refetch 발생. 채팅 목록에 SCHEDULE_REQUEST 메시지가 일반 메시지와 시각적으로 구분된 형태(예: 다른 배경색 또는 뱃지)로 표시됨 | `GET /api/teams/[teamId]/messages?date=YYYY-MM-DD` |
| 7 | LEADER가 다음 폴링 주기(3~5초) 이내에 채팅을 확인하면 | SCHEDULE_REQUEST 타입 메시지가 시각적으로 강조 표시되어 일정 변경 요청임을 인지할 수 있음 | — |

### 결과
- ChatMessage(type: SCHEDULE_REQUEST) 레코드가 DB에 저장된다
- 팀 채팅 이력에 MEMBER의 일정 변경 요청이 공식적으로 기록된다
- LEADER는 폴링 주기 이내에 요청을 인지하고, 이를 검토하여 SC-06(일정 수정)을 진행할 수 있다

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

## 부록: API 엔드포인트 요약

| 시나리오 | 메서드 | 엔드포인트 | 설명 |
|----------|--------|------------|------|
| SC-01 | POST | `/api/auth/signup` | 회원가입 |
| SC-01 | POST | `/api/auth/login` | 로그인 |
| SC-01 | POST | `/api/auth/refresh` | Access Token 재발급 |
| SC-02 | POST | `/api/teams` | 팀 생성 |
| SC-02B | GET | `/api/teams/public` | 공개 팀 목록 조회 (팀 탐색) |
| SC-02B | POST | `/api/teams/[teamId]/join-requests` | 팀 가입 신청 제출 |
| SC-02C | GET | `/api/me/tasks` | 나의 할 일 목록 (전체 팀 PENDING 신청) |
| SC-02C | GET | `/api/teams/[teamId]/join-requests` | 특정 팀의 PENDING 가입 신청 목록 |
| SC-02C | PATCH | `/api/teams/[teamId]/join-requests/[requestId]` | 가입 신청 승인/거절 |
| SC-04 | GET | `/api/teams` | 내 팀 목록 조회 |
| SC-04 | GET | `/api/teams/[teamId]/schedules?view=month&date=YYYY-MM-DD` | 월간 일정 조회 |
| SC-04, SC-05, SC-06 | GET | `/api/teams/[teamId]/schedules/[scheduleId]` | 일정 상세 조회 |
| SC-05 | POST | `/api/teams/[teamId]/schedules` | 일정 생성 |
| SC-06 | PATCH | `/api/teams/[teamId]/schedules/[scheduleId]` | 일정 수정 |
| SC-03 | DELETE | `/api/teams/[teamId]/schedules/[scheduleId]` | 일정 삭제 |
| SC-07, SC-08, SC-09 | GET | `/api/teams/[teamId]/messages?date=YYYY-MM-DD` | 날짜별 채팅 조회 (폴링) |
| SC-07, SC-08 | POST | `/api/teams/[teamId]/messages` | 채팅 메시지 전송 |

---
