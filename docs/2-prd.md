# TEAM WORKS PRD (Product Requirements Document)

## 문서 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0 | 2026-04-07 | - | 최초 작성 |
| 1.1 | 2026-04-08 | - | 팀 가입 신청(Join Request) 방식으로 팀원 합류 흐름 전면 변경 — 이메일 초대(FR-02-2~FR-02-5) 제거, 공개 팀 목록 조회·가입 신청·팀장 승인 기능(FR-02-2~FR-02-7) 추가, 나의 할 일(FR-02-8) 추가 |
| 1.2 | 2026-04-08 | - | FR-02-1 관련 규칙 오기(BR-03→BR-01) 수정 |
| 1.3 | 2026-04-18 | - | 앱명 Team CalTalk → TEAM WORKS 반영. WORK_PERFORMANCE → WORK_PERFORMANCE(업무보고) 변경. 업무보고 조회 권한 기능(FR-05-8) 추가. 공지사항 기능(FR-05-9, 클라이언트 전용) 추가 |
| 1.4 | 2026-04-20 | - | 포스트잇(FR-07), 업무보고 조회 권한(FR-08), 프로젝트 관리(FR-09), 공지사항(FR-10) 기능 추가. FR-04 일정 생성 권한 오류 수정(LEADER 전용→LEADER·MEMBER 모두) |
| 1.5 | 2026-04-28 | - | 백엔드 구현 일치화: 팀 정보 수정/삭제(FR-02-10·FR-02-11), 팀원 강제 탈퇴(FR-02-12), 사용자 프로필(FR-11) 추가. MVP 범위·스코프 크립 방지 항목 갱신(팀 삭제·프로필 수정을 in-scope로 이동) |
| 1.6 | 2026-04-29 | - | docs/1 v1.8~v2.0 동기화: 채팅 컨텍스트 격리(프로젝트 채팅·공지) FR-05 보강, 자료실 FR-12 신규, AI 버틀러 찰떡 FR-13 신규(UC-21~25). MVP 범위에 자료실·AI·프로젝트 채팅·공지 추가, "폴링/SSE 제외" 오기 수정. §7 기술 스택 — Frontend/Backend 핵심 라이브러리 행 추가, JWT 만료 정책 명시. §10 리스크 표 — Vercel 가정 폐기 후 Docker 운영 리스크로 교체. §9 일정 — Vercel 배포 → Docker Compose 배포. 화면 목록에 자료실·AI 버틀러 sub-탭 추가. 관련 문서 docs/13~18 링크 |
| 1.7 | 2026-05-12 | - | docs/1 v2.1 동기화: FR-13 4-way → 6-way 의도 분류(`schedule_update`/`schedule_delete` 추가, FR-13-2/6b/6c/8 갱신, UC-26·27 반영). FR-14 음성 입력(STT) 신규 — AI 찰떡이 + 팀채팅 동일 hook, Web Speech / Whisper hybrid (UC-28). FR-15 모바일 최적화 UX 신규 — 좌우 swipe·컴팩트 모달·다크모드 시인성. MVP 범위에 AI 6-way·STT·모바일 UX 추가. §6 반응형 UI — useBreakpoint 임계값·swipe·컴팩트 모달 상세. §7 기술 스택 — Whisper STT 컨테이너·임베딩 CPU 분리·`useSpeechRecognition` hook 명시. §10 리스크 표 — STT 마이크 권한·Whisper 모델 다운로드 추가. 화면 목록 — AI 버틀러 sub-탭에 마이크·6-way 반영, 모바일 캘린더 swipe 안내 |

---

## 1. 문서 개요

본 문서는 TEAM WORKS의 MVP 개발을 위한 제품 요구사항 정의서입니다. 도메인 정의서(1-domain-definition.md)를 기반으로, 기능 요구사항·비기능 요구사항·기술 스택·개발 일정·리스크를 실제 개발에 바로 활용할 수 있도록 구체화합니다.

---

## 2. 제품 개요

| 항목 | 내용 |
|------|------|
| 서비스명 | TEAM WORKS |
| 목적 | 팀 단위 캘린더 기반 일정관리 + 채팅 통합 애플리케이션 |
| 핵심 가치 | 일정과 대화의 맥락을 한 곳에서 관리하여 팀 커뮤니케이션 비용 최소화 |
| 플랫폼 | 웹 (모바일웹 + 데스크탑 웹, 반응형 UI) |

### 해결하는 문제

| # | 문제 | 해결 방향 |
|---|------|-----------|
| P-01 | 팀 일정이 개인 캘린더·메신저·엑셀에 분산되어 충돌·누락 빈발 | 팀 전용 캘린더에서 일정 통합 관리 |
| P-02 | 일정 관련 대화가 일정과 분리되어 맥락 추적 어려움 | 캘린더와 채팅을 동일 화면에서 동시 제공 |
| P-03 | 팀장의 팀원 일정 가시성·통제력 부족 | LEADER/MEMBER 역할 분리로 팀장 권한 명확화 |

---

## 3. 목표 & 성공 지표

### KPI

| 지표 | 목표값 | 측정 방법 |
|------|--------|-----------|
| MVP 완성 기간 | 5일 이내 | 배포 완료일 기준 |
| 동시 사용 팀 수 | 3,000개 이상 | DB 활성 팀 수 |
| 전체 가입 사용자 | 10만 명 | User 테이블 레코드 수 |
| 동시 접속 사용자 | 50명 이상 | 서버 모니터링 기준 |
| 채팅 응답 시간 | 500ms 이하 | API 응답 시간 P95 |

### MVP 범위 정의

MVP는 5일 이내 1인 개발로 핵심 가치를 전달할 수 있는 최소 기능 집합입니다.

**MVP 포함 (Must Have)**
- 회원가입 / 로그인 (JWT 인증, Refresh Token 갱신)
- 내 프로필(이름) 수정
- 팀 생성 및 공개 팀 목록 조회
- 팀 정보 수정·삭제 (LEADER 전용)
- 팀원 강제 탈퇴 (LEADER 전용, 본인 제외)
- 팀 가입 신청 및 팀장 승인/거절
- 팀장의 나의 할 일 목록 (PENDING 가입 신청 목록)
- 팀 일정 조회 (월·주·일 뷰)
- 팀 일정 추가·수정·삭제 (생성자 본인)
- **채팅** — 팀 일자별 채팅 + **프로젝트 전용 채팅방** (컨텍스트 격리)
- 업무보고 채팅 (WORK_PERFORMANCE)
- 채팅 메시지 폴링 갱신 (3초 간격, TanStack Query)
- 캘린더 + 채팅 동시 화면
- 포스트잇 작성·수정·삭제 (날짜별 메모)
- **공지사항** — 팀 일자별 공지 + **프로젝트 전용 공지** (채팅 상단 고정)
- 업무보고 조회 권한 설정 (팀원별 열람 권한 관리)
- 프로젝트(간트차트) 생성·수정·삭제
- 프로젝트 일정 / 세부 일정 생성·수정·삭제
- **자료실(게시판)** — 채팅방 sub-탭. 글 작성·수정·삭제 + 첨부파일(≤10MB), 작성자 본인만 수정·삭제 (팀/프로젝트별 격리)
- **AI 버틀러 "찰떡"** — 6-way 자동 의도 분류 (사용법 RAG / 일반 웹검색 / 일정 조회 / 일정 등록 / 일정 수정 / 일정 삭제 / 거절 안내) + SSE 스트리밍 + 다중 턴 대화 + confirm 카드
- **음성 입력 (STT)** — AI 찰떡이·팀채팅 입력창 옆 마이크 버튼. Web Speech API(브라우저 내장) + 자체 호스팅 Whisper(Galaxy/Samsung quirk 회피) 자동 분기
- **모바일 최적화 UX** — 캘린더 좌우 swipe(월/주/일 네비게이션), 컴팩트 일정 모달·포스트잇, 다크모드 시인성, 분할 화면 키보드 억제

**MVP 제외 (Post-MVP)**
- Push / Email 실시간 알림 (브라우저 알림 미적용)
- 자료실 다중 첨부 (1단계는 글당 1개)
- 자료실 댓글·검색·페이지네이션
- 팀장 변경 기능
- 일정 첨부파일 (자료실로 갈음)
- 다국어 지원
- 접근성(WCAG) 대응

---

## 4. 사용자 페르소나

### Persona A — 팀장 (LEADER)

| 항목 | 내용 |
|------|------|
| 연령 | 40대 |
| 역할 | 팀 전반 업무 관리 및 일정 주도 |
| 주요 불만 | 팀원이 지시를 제대로 이해하지 못하는 경우가 잦음 |
| 핵심 니즈 | 팀 일정을 한눈에 보고 빠르게 수정·공유할 수 있어야 함 |
| 사용 시나리오 | 아침 출근 후 데스크탑에서 주간 팀 일정을 확인하고, 변경 사항이 생기면 즉시 수정 후 채팅으로 지시. 가입 신청이 들어오면 나의 할 일 목록에서 확인하고 승인/거절 처리 |
| Pain Point | - 팀원들이 일정을 못 보거나 놓침 |
|  | - 일정 변경 후 별도 공지가 번거로움 |
|  | - 팀원의 이해 여부를 확인하기 어려움 |

### Persona B — 팀원 (MEMBER)

| 항목 | 내용 |
|------|------|
| 연령 | 20~30대 |
| 역할 | 팀장 지시에 따른 업무 수행 |
| 주요 불만 | 팀장의 지시가 불명확하고 구체적이지 않음 |
| 핵심 니즈 | 현재 팀 일정과 관련 대화를 함께 확인하고 싶음. 참여하고 싶은 팀을 쉽게 찾아 가입 신청할 수 있어야 함 |
| 사용 시나리오 | 공개 팀 목록에서 원하는 팀을 찾아 가입 신청 후 승인을 기다림. 승인 후 모바일로 출퇴근 중 오늘 일정과 팀 채팅을 동시에 확인하고, 일정 변경이 필요하면 채팅으로 요청 |
| Pain Point | - 가입하고 싶은 팀을 찾는 방법이 없음 |
|  | - 일정과 채팅이 분리되어 맥락을 파악하기 어려움 |
|  | - 일정 변경을 요청할 공식 채널이 없음 |

---

## 5. 기능 요구사항

### 우선순위 기준

- **Must**: MVP 완성에 필수. 없으면 서비스 불가
- **Should**: 핵심 가치 전달에 중요. MVP에 포함 권장
- **Could**: 있으면 좋으나 MVP에서 제외 가능

---

### FR-01 인증 (UC-01)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-01-1 | 이메일 + 비밀번호로 회원가입 (`POST /api/auth/signup`) | Must | BR-01 |
| FR-01-2 | 이메일 중복 검증 | Must | BR-01 |
| FR-01-3 | 로그인 시 JWT Access(15분) + Refresh(7일) 발급 (`POST /api/auth/login`) | Must | BR-01 |
| FR-01-4 | 비밀번호 bcrypt(`bcryptjs`) 해싱 저장 | Must | BR-01 |
| FR-01-5 | 로그아웃 (클라이언트 토큰 제거) | Should | BR-01 |
| FR-01-6 | Access 만료 시 Refresh Token 으로 재발급 (`POST /api/auth/refresh`) | Must | BR-01 |

수락 조건:
- 미가입 이메일 + 유효한 비밀번호 입력 후 회원가입 요청 시 계정 생성 및 토큰 발급
- 가입된 이메일 + 올바른 비밀번호 입력 후 로그인 요청 시 토큰 발급 및 앱 진입

---

### FR-02 팀 관리 (UC-02, UC-02B, UC-02C)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-02-1 | 팀 생성 (생성자는 자동으로 LEADER) | Must | BR-01 |
| FR-02-2 | 공개 팀 목록 조회 (로그인한 모든 사용자가 전체 팀 목록 열람 가능, 팀별 구성원 수 포함) | Must | BR-07 |
| FR-02-3 | 사용자가 원하는 팀에 가입 신청 제출 (TeamJoinRequest 생성, 상태: PENDING) | Must | BR-07 |
| FR-02-4 | 이미 해당 팀 구성원인 사용자의 가입 신청 방지 | Must | BR-07 |
| FR-02-5 | 동일 팀에 PENDING 상태 신청이 이미 존재하는 경우 중복 신청 방지 | Must | BR-07 |
| FR-02-6 | 팀장이 본인 팀의 PENDING 가입 신청 목록 조회 | Must | BR-03 |
| FR-02-7 | 팀장이 개별 가입 신청을 승인(APPROVE) 또는 거절(REJECT) 처리 | Must | BR-03 |
| FR-02-8 | 나의 할 일 목록 조회 — 팀장이 LEADER인 모든 팀의 PENDING 가입 신청을 한 번에 조회 | Must | BR-03 |
| FR-02-9 | 내가 속한 팀 목록 조회 | Must | BR-06 |
| FR-02-10 | 팀장이 자신의 팀 정보(name, description, isPublic) 수정 가능 | Must | BR-11 |
| FR-02-11 | 팀장이 자신의 팀 삭제 가능 (하위 데이터 CASCADE 정리) | Must | BR-11 |
| FR-02-12 | 팀장이 팀원을 강제 탈퇴시키기 가능 (팀장 본인은 제외) | Must | BR-12 |

수락 조건:
- 로그인한 사용자가 공개 팀 목록 조회 시 전체 팀 목록(팀명, 구성원 수) 반환
- 사용자가 특정 팀에 가입 신청 시 TeamJoinRequest(PENDING) 생성 → 팀장의 나의 할 일에 표시
- 팀장이 가입 신청 승인 시 TeamMember(MEMBER) 등록, status = APPROVED
- 팀장이 가입 신청 거절 시 status = REJECTED, 팀 합류 미발생
- MEMBER 권한 사용자가 승인/거절 시도 시 403 Forbidden
- 팀장이 자신의 팀 정보 수정 시 200 OK, 전달된 필드만 갱신
- 팀장이 자신의 팀 삭제 시 200 OK, 종속 데이터(구성원·일정·메시지·공지·포스트잇·프로젝트·서브일정) CASCADE 삭제
- 팀장이 본인 userId로 강제 탈퇴 요청 시 400 Bad Request — "팀장은 탈퇴시킬 수 없습니다."
- MEMBER 권한 사용자가 팀 정보 수정/삭제·팀원 강제 탈퇴 시도 시 403 Forbidden

---

### FR-03 일정 조회 (UC-03)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-03-1 | 월 단위 팀 일정 조회 | Must | BR-01, BR-06 |
| FR-03-2 | 주 단위 팀 일정 조회 | Should | BR-01, BR-06 |
| FR-03-3 | 일 단위 팀 일정 조회 | Should | BR-01, BR-06 |
| FR-03-4 | 일정 상세 정보 조회 (title, description, startAt, endAt) | Must | BR-01, BR-06 |
| FR-03-5 | 해당 팀 일정만 노출 (타 팀 격리) | Must | BR-06 |

---

### FR-04 일정 추가·수정·삭제 (UC-04)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-04-1 | 팀 구성원(LEADER·MEMBER) 모두 일정 생성 가능 | Must | BR-02 |
| FR-04-2 | 일정 생성자 본인만 수정 가능 | Must | BR-02 |
| FR-04-3 | 일정 생성자 본인만 삭제 가능 | Must | BR-02 |
| FR-04-4 | startAt < endAt 유효성 검증 | Must | BR-02 |
| FR-04-5 | 생성자가 아닌 사용자의 수정·삭제 시도 시 403 반환 | Must | BR-02 |
| FR-04-6 | title 최대 200자, description 선택 입력 | Must | - |

수락 조건:
- 팀 구성원(LEADER·MEMBER) + 유효한 startAt < endAt 조건에서 일정 생성 시 201 Created, 팀 전체에 일정 노출
- 일정 생성자 본인만 수정·삭제 가능. 생성자가 아닌 사용자의 수정·삭제 시도 시 403 Forbidden

---

### FR-05 채팅 (UC-05, UC-06)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-05-1 | 팀 일자별 채팅 메시지 전송 (NORMAL 타입) | Must | BR-01, BR-06 |
| FR-05-2 | 채팅 메시지 날짜별 조회 (KST 기준 그룹핑) | Must | BR-05 |
| FR-05-3 | MEMBER의 일정 변경 요청 채팅 (WORK_PERFORMANCE 타입) | Must | BR-04 |
| FR-05-4 | WORK_PERFORMANCE 메시지 시각적 구분 표시 | Should | BR-04 |
| FR-05-5 | content 최대 2000자 제한 | Must | - |
| FR-05-6 | 채팅·공지·자료실 모두 `(teamId, projectId)` 조합으로 격리. `projectId IS NULL` → 팀 일자별, NOT NULL → 프로젝트 전용 | Must | BR-15 |
| FR-05-7 | 폴링 방식 채팅 갱신 (3초 간격, TanStack Query `refetchInterval`) | Must | - |
| FR-05-8 | 업무보고(WORK_PERFORMANCE) 메시지 열람 권한 설정 (팀장이 팀원별 열람 허용) | Must | BR-04 |
| FR-05-9 | 공지사항 — 팀 일자별 공지 + 프로젝트 전용 공지 (채팅 상단 고정) | Must | BR-10, BR-15 |
| FR-05-10 | 프로젝트 전용 채팅방 — 갠트뷰 활성 시 우측 채팅 영역이 해당 프로젝트 채팅으로 자동 전환 (`/api/teams/:teamId/projects/:projectId/messages`) | Must | BR-15 |

수락 조건:
- MEMBER 권한에서 type=WORK_PERFORMANCE 메시지 전송 시 채팅 이력에 저장, 팀장에게 표시
- 채팅 목록은 sentAt 기준 KST 날짜로 그룹핑하여 반환

---

### FR-06 캘린더 + 채팅 동시 화면 (UC-07)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-06-1 | 캘린더와 채팅을 동일 화면에서 분할 표시 | Must | BR-01, BR-06 |
| FR-06-2 | 캘린더에서 날짜 선택 시 해당 날짜 채팅 목록 연동 표시 | Should | BR-05 |
| FR-06-3 | 모바일에서 탭 전환 방식으로 캘린더/채팅 전환 | Should | - |

---

### FR-07 포스트잇 (UC-08)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-07-1 | 팀 구성원(LEADER·MEMBER) 모두 날짜별 포스트잇 생성 가능 | Must | BR-08 |
| FR-07-2 | 포스트잇 생성자 본인만 수정 가능 | Must | BR-08 |
| FR-07-3 | 포스트잇 생성자 본인만 삭제 가능 | Must | BR-08 |
| FR-07-4 | 팀 포스트잇 목록 날짜별 조회 | Must | BR-08 |
| FR-07-5 | 생성자가 아닌 사용자의 수정·삭제 시도 시 403 반환 | Must | BR-08 |

수락 조건:
- 팀 구성원이 날짜·색상·내용을 입력하여 포스트잇 생성 시 201 Created, 해당 날짜에 등록
- 생성자 본인이 수정·삭제 시 200 OK. 생성자가 아닌 사용자의 수정·삭제 시도 시 403 Forbidden

---

### FR-08 업무보고 조회 권한 (UC-13)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-08-1 | 팀장이 업무보고 조회를 허용할 팀원 목록 설정 (기존 권한 전부 교체) | Must | BR-04 |
| FR-08-2 | 팀장·MEMBER 모두 현재 업무보고 조회 허용 목록 조회 가능 | Must | BR-04 |
| FR-08-3 | 빈 배열 설정 시 전체 구성원 열람 허용 | Must | BR-04 |
| FR-08-4 | MEMBER가 권한 설정 시도 시 403 반환 | Must | BR-04 |

수락 조건:
- 팀장이 userIds 배열 전달 시 기존 권한 전부 교체, 지정된 사용자만 업무보고 열람 가능
- 빈 배열 전달 시 전체 구성원 열람 허용
- MEMBER가 권한 설정 시도 시 403 Forbidden

---

### FR-09 프로젝트 관리 (UC-09, UC-10, UC-11)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-09-1 | 팀 구성원(LEADER·MEMBER) 모두 프로젝트 생성 가능 | Must | BR-09 |
| FR-09-2 | 프로젝트 생성자 본인만 수정·삭제 가능 | Must | BR-09 |
| FR-09-3 | 프로젝트 삭제 시 하위 프로젝트 일정·세부 일정 연쇄 삭제 | Must | BR-09 |
| FR-09-4 | 프로젝트 내 단계(phases) 목록 설정 (기획·개발·배포 등) | Must | BR-09 |
| FR-09-5 | 팀 구성원(LEADER·MEMBER) 모두 프로젝트 일정 생성 가능 | Must | BR-09 |
| FR-09-6 | 프로젝트 일정 생성자 본인만 수정·삭제 가능 | Must | BR-09 |
| FR-09-7 | 프로젝트 일정 삭제 시 하위 세부 일정 연쇄 삭제 | Must | BR-09 |
| FR-09-8 | 팀 구성원(LEADER·MEMBER) 모두 세부 일정 생성 가능 | Must | BR-09 |
| FR-09-9 | 세부 일정 생성자 본인만 수정·삭제 가능 | Must | BR-09 |
| FR-09-10 | 프로젝트·프로젝트 일정·세부 일정에 진행률(0~100) 및 지연 여부 관리 | Must | BR-09 |
| FR-09-11 | 생성자가 아닌 사용자의 수정·삭제 시도 시 403 반환 | Must | BR-09 |

수락 조건:
- 팀 구성원이 유효한 name, startDate <= endDate 조건으로 프로젝트 생성 시 201 Created
- 생성자 본인이 수정·삭제 시 200 OK. 생성자가 아닌 사용자의 수정·삭제 시도 시 403 Forbidden
- 프로젝트 삭제 시 하위 프로젝트 일정·세부 일정이 함께 삭제됨
- endDate < startDate 조건에서 생성·수정 요청 시 400 Bad Request

---

### FR-10 공지사항 (UC-12)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-10-1 | 팀 구성원(LEADER·MEMBER) 모두 공지사항 작성 가능 | Must | BR-10 |
| FR-10-2 | 공지사항은 채팅 화면 상단에 고정 표시 | Must | BR-10 |
| FR-10-3 | 공지사항 작성자 본인 또는 팀장(LEADER)만 삭제 가능 | Must | BR-10 |
| FR-10-4 | 작성자도 팀장도 아닌 사용자의 삭제 시도 시 403 반환 | Must | BR-10 |
| FR-10-5 | content 최대 2000자 제한 | Must | BR-10 |

수락 조건:
- 팀 구성원이 content(최대 2000자) 입력 후 공지 작성 시 201 Created, 채팅 상단에 고정
- 작성자 본인 또는 팀장이 삭제 시 200 OK. 그 외 삭제 시도 시 403 Forbidden
- content 2000자 초과 시 400 Bad Request

---

### FR-11 사용자 프로필 (UC-01, UC-16)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-11-1 | 로그인 사용자가 자신의 정보(id, email, name) 조회 가능 (세션 복구) | Must | BR-01 |
| FR-11-2 | 로그인 사용자가 자신의 표시 이름(name) 수정 가능 | Must | BR-01 |
| FR-11-3 | name 양 끝 공백 trim 후 1~50자 범위 검증 | Must | BR-01 |

수락 조건:
- 로그인 사용자가 GET /api/auth/me 호출 시 본인 정보(id, email, name) 200 OK 반환
- 로그인 사용자가 trim 후 1~50자 name 으로 PATCH /api/me 호출 시 200 OK, User.name 갱신
- name 이 빈 문자열·공백뿐이거나 50자 초과인 경우 400 Bad Request

---

### FR-12 자료실 (UC-19, UC-20)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-12-1 | 채팅방 sub-탭으로 자료실 노출 (채팅 / 자료실 토글) | Must | BR-13 |
| FR-12-2 | 팀 구성원 모두 글 작성 가능 (제목·내용·첨부 1개) `POST /api/teams/:teamId/board` (multipart) | Must | BR-13 |
| FR-12-3 | 작성자 본인만 수정 (`PATCH /api/teams/:teamId/board/:postId`) | Must | BR-13 |
| FR-12-4 | 작성자 본인만 삭제 (`DELETE` — 첨부 unlink + DB CASCADE) | Must | BR-13 |
| FR-12-5 | 첨부파일 ≤ 10MB. MIME 화이트리스트(jpg/png/gif/webp/pdf/docx/xlsx/pptx/txt/md/zip) + magic-bytes 검증. SVG·실행파일 거부 | Must | BR-14 |
| FR-12-6 | 첨부 다운로드 (`GET /api/files/:fileId`) — 같은 팀 멤버만. `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` 강제 | Must | BR-14 |
| FR-12-7 | `(teamId, projectId)` 격리 — 일자별 자료실 ↔ 프로젝트 자료실 분리 | Must | BR-15 |
| FR-12-8 | Storage backend 토글 (`STORAGE_BACKEND=local` ↔ `s3`) — 호출처 코드 변경 0 | Must | - |

수락 조건:
- 11MB 또는 화이트리스트 외 MIME 또는 magic-bytes 미스매치 → 413 / 415
- 작성자가 아닌 사용자의 PATCH·DELETE → 403 Forbidden
- 다른 팀 사용자가 `/api/files/:fileId` 호출 → 403
- DB row 는 있지만 storage 객체 없음 → 410 Gone

---

### FR-13 AI 버틀러 "찰떡" (UC-21~27)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-13-1 | 우측 채팅 영역 sub-탭 "AI 버틀러" — 단일 입력창 | Must | BR-16 |
| FR-13-2 | 6-way 자동 의도 분류 (`usage` / `general` / `schedule_query` / `schedule_create` / `schedule_update` / `schedule_delete` / `blocked`) — 사용자가 모드 선택 안 함 | Must | BR-16 |
| FR-13-3 | 사용법(`usage`) — RAG (`ollama/*.md` 인덱스) 답변, "📚 공식 문서 N건 참조" 출처 | Must | BR-16 |
| FR-13-4 | 일반(`general`) — SearxNG 5건 + Open WebUI gemma4:26b 답변, "🌐 웹 검색 N건 참조" 출처 | Must | BR-16 |
| FR-13-5 | 일정 조회(`schedule_query`) — 자연어 → view+date+keyword → backend Schedule API 직접 조회. 코드 한국어 포맷, LLM 답변 본문 0회. 식사 단어(점심/저녁/아침) 는 시간대 band 가 아니라 title/desc 키워드로 매치 | Must | BR-16, BR-20 |
| FR-13-6 | 일정 등록(`schedule_create`) — 자연어 → 인자 파싱 → SSE `pending-action` confirm 카드 → 사용자 ✓ 후 INSERT. "X시 반" → 30분 자동 정규화 | Must | BR-17, BR-18 |
| FR-13-6b | 일정 수정(`schedule_update`) — 대상 식별(`parse-schedule-query` 후보 좁히기, 다중 시 `awaiting-input` 후속 질문) → 새 일시 수집(`updateState.needs: 'new-datetime'`, `tryParseDirectDatetime` + LLM fallback, "그대로" 패턴 인식) → confirm 카드 → ✓ 후 `execute` → backend PATCH. 일정 생성자 본인만 허용. multi-turn 상태는 클라이언트에서 carry | Must | BR-21 |
| FR-13-6c | 일정 삭제(`schedule_delete`) — 대상 식별(parse-schedule-query 재활용) → confirm 카드 → ✓ 후 `execute` → backend DELETE. "취소"·"삭제"·"제거"·"지워"·"지운" 모두 처리. bulk("전체 삭제" 등) 는 1건씩만 가능함을 안내. 일정 생성자 본인만 허용 | Must | BR-22 |
| FR-13-7 | 다중 턴 — 정보 부족 시 후속 질문(`awaiting-input`), 다음 입력 결합 재요청. 일정 등록·수정·삭제 모두 동일 패턴 | Must | BR-18 |
| FR-13-8 | 거절 안내(`blocked`) — 프로젝트·채팅·공지·포스트잇·자료실 등 일정 외 도메인 요청만 정중한 거절. 일정 CRUD 는 모두 지원 | Must | BR-19 |
| FR-13-9 | SSE 스트리밍 첫 토큰 ~3~10초 — `Thinking...` placeholder | Should | - |
| FR-13-10 | AI 자유 SQL 금지 — backend SQL 템플릿 + `withAuth`/`withTeamRole` 미들웨어 통과만 | Must | BR-20 |

수락 조건:
- "포스트잇 색깔 종류" → RAG 답변 + 📚 출처 뱃지
- "오늘 뉴스" → SearxNG sources 5건 + 🌐 답변 stream
- "오늘 일정 알려줘" → 코드 포맷 즉시 답변
- "직원 점심 일정 조회" → 점심을 키워드(이벤트 명사)로 처리하여 title/desc 부분 매치
- "내일 오후 3시 회의 등록" → confirm 카드 → ✓ 클릭 → DB INSERT + 좌측 캘린더 자동 갱신
- "13일 11시 반 직원점심" → "X시 반" 정규화로 11:30 인식, 시간 명시 안 되면 AM/PM 후속 질문
- "내일 회의 등록" (시간 미명시) → "몇 시?" 후속 질문 → 사용자 "오후 3시" → confirm 카드
- "내일 회의 오후 4시로 옮겨줘" → 대상 일정 후보 좁히기 → confirm 카드 → ✓ 후 PATCH
- "어제 회의 삭제해줘" / "어제 디자인 리뷰 취소" → 대상 식별 → confirm 카드 → ✓ 후 DELETE
- "프로젝트 등록해줘" → "프로젝트·채팅·공지·포스트잇·자료실 같은 작업은 화면에서 직접" 거절 안내
- "프로젝트 등록하는 법" (사용법 시그널) → blocked 가 아닌 RAG 답변 (USAGE_KEYWORDS 우선)

---

### FR-14 음성 입력 (STT) (UC-28)

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-14-1 | AI 찰떡이 입력창 옆 마이크 아이콘 — 클릭으로 녹음 토글 | Must | BR-23 |
| FR-14-2 | 팀채팅 입력창 옆 마이크 아이콘 — 동일 hook(`useSpeechRecognition`) 적용 | Must | BR-23 |
| FR-14-3 | 브라우저·디바이스 자동 분기 — Galaxy/SM-XXXX UA / Samsung Internet / Web Speech 미지원 환경 → 자체 Whisper(`POST /api/stt`), 그 외 → Web Speech API | Must | BR-23 |
| FR-14-4 | 발화 후 침묵 감지 → 자동 변환 (Whisper VAD 1초, Web Speech 브라우저 기본) | Must | BR-23 |
| FR-14-5 | 인식 결과 텍스트가 입력창에 채워짐 → 사용자 검토·수정 후 [전송] 클릭 (자동 전송 안 함) | Must | BR-23 |
| FR-14-6 | 마이크 권한 거부 시 안내 토스트, 비지원 브라우저(Whisper 도 비가용)는 마이크 아이콘 자동 숨김 | Must | BR-23 |
| FR-14-7 | 모바일 캘린더 분할 화면 시 입력창 자동 포커스 억제(시스템 키보드 표시 안 됨, 화면 가림 방지) | Must | BR-23 |
| FR-14-8 | Whisper STT 컨테이너 — `onerahmet/openai-whisper-asr-webservice`, `faster_whisper` 엔진, KST 도메인 어휘 initial_prompt + VAD filter | Must | - |

수락 조건:
- 노트북 Chrome 에서 마이크 클릭 → 발화 → 텍스트가 입력창에 라이브 표시 → 침묵 후 최종 텍스트 확정
- Galaxy 디바이스에서 마이크 클릭 → UA 검사로 Whisper 분기 → 발화 → MediaRecorder 녹음 → Whisper 변환 → 텍스트 표시
- Firefox(Web Speech 비지원) + Whisper 가용 → Whisper 로 동작. Whisper 도 비가용 → 마이크 아이콘 비표시
- 모바일 AI 찰떡이 + 캘린더 분할 화면에서 마이크로 입력 → 키보드 안 올라옴

---

### FR-15 모바일 최적화 UX

| ID | 요구사항 | 우선순위 | 관련 규칙 |
|----|---------|---------|-----------|
| FR-15-1 | `useBreakpoint` hook — `isMobile`(<640px) / `isDesktop`(≥1024px) 분기. 컴포넌트가 모드별 스타일 자동 적용 | Must | - |
| FR-15-2 | 캘린더 좌우 swipe 네비게이션 — 좌→우 이전(월/주/일), 우→좌 다음. threshold 50px | Must | - |
| FR-15-3 | 슬라이드 인 애니메이션 — 280ms cubic-bezier, 구글 캘린더 스타일. 네비게이션 시에만 작동(날짜 클릭은 애니메이션 없음) | Must | - |
| FR-15-4 | 일정 상세·등록·수정 모달 컴팩트화 — 가로폭 80%, 패딩·폰트·버튼 크기 모바일 한 단계 축소. PC 는 기존 유지 | Must | - |
| FR-15-5 | 포스트잇 모바일 컴팩트 — 테두리·그림자 제거, 상단 작은 X 삭제 아이콘. 월간뷰에 색상 팔레트 자동 노출 | Must | - |
| FR-15-6 | 멀티데이 일정 밴드 — 텍스트 길이·셀 폭에 맞춰 height 동적 산출 (compact prop 으로 모바일 글자폭·줄높이 분기) | Must | - |
| FR-15-7 | 다크모드 캘린더 팝업 시인성 — 이전·다음 달 회색, 현재 달 흰색, 오늘 앰버골드. 월 이동 `< >` + 시간·분 `^ v` 화살표 흰색 | Must | - |
| FR-15-8 | 팀채팅 헤더에 "YYYY년 MM월 DD일" 표시 (탭 옆 우측 정렬) | Should | - |
| FR-15-9 | 모바일 AI 찰떡이 + 팀채팅 입력창에 마이크 버튼 노출 (FR-14 와 연동) | Must | BR-23 |

수락 조건:
- 모바일(412×900 emulate) 에서 캘린더 좌우 swipe → 이전/다음 페이지로 슬라이드 인 애니메이션 (~280ms)
- 모바일 일정 수정 모달 가로폭이 viewport 의 80%, 패딩 컴팩트
- PC 에서 동일 화면 → 기존 사이즈 그대로 (모바일 변경의 PC 사이드이펙트 0)
- 다크모드 캘린더 팝업의 5월 날짜는 흰색, 4월·6월은 회색, 오늘(11/12일)은 앰버골드

---

## 6. 비기능 요구사항

### 성능

| 항목 | 기준 |
|------|------|
| 채팅 메시지 API 응답 시간 | P95 500ms 이하 |
| 일정 조회 API 응답 시간 | P95 1,000ms 이하 |
| 동시 접속 사용자 | 팀당 최소 50명 지원 |
| 전체 사용 팀 | 3,000개 이상 지원 |

### 보안

| 항목 | 기준 |
|------|------|
| 인증 방식 | JWT — Access Token + Refresh Token (`Bearer` 헤더) |
| JWT 만료 정책 | Access 15분 (`JWT_ACCESS_EXPIRES_IN`) / Refresh 7일 (`JWT_REFRESH_EXPIRES_IN`). 만료 시 `POST /api/auth/refresh` 갱신 |
| 비밀번호 저장 | bcrypt 해싱 필수 (`bcryptjs`) |
| API 인가 | 모든 API 엔드포인트에 인증 토큰 검증 (`withAuth` 미들웨어) |
| 팀 격리 | teamId 기반 데이터 접근 제어 — `withTeamRole` 미들웨어가 `userId × teamId` 멤버십 검증 (BR-06) |
| 컨텍스트 격리 | ChatMessage·Notice·BoardPost 의 `(teamId, projectId)` 격리 (BR-15) |
| 권한 검증 | 역할(LEADER/MEMBER) + 작성자(`created_by/author_id`) 서버 사이드 강제. AI 도 backend 미들웨어 통과만 (BR-20) |
| 첨부파일 검증 | 크기 ≤ 10MB + MIME 화이트리스트 + magic-bytes (BR-14) |

### 반응형 UI

| 항목 | 기준 |
|------|------|
| 기준 | 모바일 우선 (Mobile First) 반응형, `useBreakpoint` hook 으로 `isMobile`(<640px) / `isDesktop`(≥1024px) 분기 |
| 모바일 | 640px 미만: 탭 전환 방식 [캘린더 / 팀채팅 / AI 찰떡이]. 캘린더 좌우 swipe(threshold 50px)로 월/주/일 이전·다음 페이지 이동, 280ms cubic-bezier 슬라이드 인 애니메이션 |
| 모바일 모달 | 일정 상세·등록·수정 모달 가로폭 80%, 패딩·폰트·버튼·아이콘 한 단계 축소. 포스트잇은 테두리·그림자 제거 + 작은 X 아이콘 |
| 모바일 키보드 | AI 찰떡이 분할 화면 시 입력창 자동 포커스 억제 — 음성 입력으로 결과 받는 동안 시스템 키보드가 화면 가리지 않음 |
| 다크모드 시인성 | 캘린더 팝업 — 이전·다음 달 회색, 현재 달 흰색, 오늘 앰버골드. 화살표 아이콘 (`< >`, `^ v`) 흰색 |
| 태블릿 | 640px~1024px: 유연한 레이아웃 |
| 데스크탑 | 1024px 이상: 캘린더 + 채팅/AI 좌우 분할 화면 |
| 접근성 | 적용하지 않음 (MVP 제외) |

### 타임존

| 항목 | 기준 |
|------|------|
| 서버 기준 | KST (UTC+9) |
| DB 저장 | UTC로 저장, 조회 시 KST 변환 (`getKstDateRange` 의 baseDate 문자열 직접 파싱 — 컨테이너 TZ 무관) |
| 채팅 날짜 그룹핑 | sentAt 기준 KST 날짜 |

### 핵심 라이브러리

| 레이어 | 라이브러리 |
|---|---|
| Frontend | React 19 + Next.js 16 (Turbopack), TanStack Query 5(서버 상태·폴링·optimistic update), Zustand 5(클라이언트 전역 상태), Lucide React(아이콘), Tailwind CSS(스타일) |
| Frontend · STT | `useSpeechRecognition` hybrid hook — Web Speech API(`useWebSpeechRecognition`) / Whisper backend(`useWhisperRecognition`) 자동 분기. `useBreakpoint` hook 으로 모바일/데스크탑 분기 |
| Backend | Next.js 16 API Routes(App Router), pg 8(node-postgres), bcryptjs(해싱), jsonwebtoken(JWT), swagger-ui-react(API 문서) |
| AI · RAG | Ollama gemma4:26b (`num_ctx 32K`, `think:false`) + nomic-embed-text 임베딩(CPU 분리 — 채팅 모델 VRAM 점유 최적화), RAG 서버(`:8787`), Open WebUI(`:8081`), SearxNG(`:8080`) — 모두 컨테이너 |
| AI · STT | `onerahmet/openai-whisper-asr-webservice` 컨테이너(`:9001`), `faster_whisper` 엔진 + KST 도메인 어휘 initial_prompt + VAD filter |
| Storage | `StorageAdapter` 인터페이스 — `LocalStorageAdapter`(1단계, 호스트 mount) ↔ `S3StorageAdapter`(운영 전환) env 토글 |

---

## 7. 기술 스택 & 아키텍처

### 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| 프론트엔드 | React 19 + TypeScript (Next.js 16) | - |
| 상태 관리 | Zustand | 전역 클라이언트 상태 |
| 서버 상태 | TanStack Query (React Query) | API 데이터 페칭·캐싱 |
| STT (음성 입력) | `useSpeechRecognition` hybrid hook | Web Speech API + Whisper backend 자동 분기 (UA 기반) |
| 모바일 분기 | `useBreakpoint` hook | `isMobile`(<640px) / `isDesktop`(≥1024px). Tailwind `md:` prefix 와 함께 사용 |
| 백엔드 | Next.js API Routes (Node.js 24) | App Router 기반 |
| DB 클라이언트 | pg (node-postgres) | Prisma 미사용 |
| DB | PostgreSQL 18 | Docker 컨테이너로 운영 (`postgres-db` 서비스) |
| 게시판 첨부파일 | Local 디렉토리 (`files/`) ↔ S3 토글 | `STORAGE_BACKEND` env 로 swap. 자세히는 `docs/18` |
| AI · RAG | Ollama gemma4:26b + nomic-embed-text(CPU 분리) + Open WebUI + SearxNG | docs/13·14·17 |
| AI · STT | Whisper STT 컨테이너 (`onerahmet/openai-whisper-asr-webservice`, `faster_whisper`) | docs/22 |
| 배포 | Docker Compose (단일 호스트) | nginx 8080 → backend/frontend/open-webui/whisper 라우팅 |

### 아키텍처 개요

```
[브라우저]
  React 19 + TypeScript (Next.js 16)
  Zustand · TanStack Query (폴링) · SSE
       |
       | HTTPS / REST + SSE
       v
[Docker host — nginx :8080]
  ├── backend (Next.js API)   ← /api/teams/*  /api/files/*
  ├── frontend (Next.js SPA)  ← /  /api/ai-assistant/*
  └── (HMR /  _next/webpack-hmr)
       |
       v
[postgres-db (PG 18)]   [Ollama 11434 호스트]   [open-webui :8081]   [searxng :8080]
       ↑                                              ↑
       | host volume mount: ./files                   |
       └─ board_attachments 메타데이터 ↔ files/<UUID>.<ext>
```

### 배포 환경 (Docker Compose)

`docker-compose.yml` 하나로 **모든 서비스 컨테이너화**. Vercel 환경 가정은 더 이상 적용되지 않음.

| 항목 | 현황 |
|---|---|
| WebSocket / SSE | 사용 가능 (AI 어시스턴트 SSE 스트리밍) |
| Function 실행 시간 | 무제한 (`docker/nginx.dev.conf` 의 `proxy_read_timeout 600s` 정도) |
| 파일 시스템 쓰기 | 가능. 자료실 첨부파일 `files/` 호스트 mount |
| DB | `postgres-db` 컨테이너, 같은 네트워크 |
| 환경 변수 | `docker-compose.yml` 의 `environment:` + `.env` |

> 운영 전환 시 첨부파일 저장은 `STORAGE_BACKEND=s3` 토글로 클라우드 이전. 자세한 마이그레이션은 [`docs/18-board-guide.md`](./18-board-guide.md) §6.

---

## 8. 화면 목록

| # | 화면명 | 경로 (예시) | 접근 권한 | 주요 기능 |
|---|--------|------------|-----------|-----------|
| S-01 | 로그인 | /login | 비인증 | 이메일/비밀번호 로그인 |
| S-02 | 회원가입 | /signup | 비인증 | 이메일/이름/비밀번호 입력 |
| S-03 | 팀 목록 (내 팀) | / (홈) | 인증 | 내가 속한 팀 목록, 팀 생성 버튼, 팀 탐색 버튼 |
| S-04 | 팀 생성 | /teams/new | 인증 | 팀명 입력, 팀 생성 |
| S-04B | 팀 공개 목록 (탐색) | /teams/explore | 인증 | 전체 팀 목록, 구성원 수, 가입 신청 버튼 |
| S-04C | 나의 할 일 | /me/tasks | LEADER | 내가 팀장인 팀들의 PENDING 가입 신청 목록, 승인/거절 버튼 |
| S-05 | 팀 메인 (캘린더 + 우측 패널) | /teams/[teamId] | 팀원 | 좌측 캘린더(월/주/일/프로젝트) + 우측 영역(상단 탭: 팀채팅 / AI 버틀러). 모바일은 [캘린더 / 팀채팅 / AI 찰떡이] 하단 탭, 캘린더에서 좌우 swipe 로 페이지 이동 (UC-07, UC-21~28) |
| S-05A | 우측 채팅 sub-탭 (채팅 / 자료실) | (S-05 내부) | 팀원 | 채팅 ↔ 자료실 토글. 좌측 view 가 project 면 프로젝트 채팅·자료실로 자동 전환. 입력창 옆 마이크 버튼(STT) (UC-17, UC-19, UC-28) |
| S-05B | 우측 AI 버틀러 탭 | (S-05 내부) | 팀원 | 단일 입력창 + 6-way 자동 분류, SSE 스트리밍, confirm 카드, 다중 턴, 마이크 음성 입력 (UC-21~28) |
| S-06 | 일정 상세 / 생성 / 수정 | (S-05 모달) | 팀원 | 일정 CRUD 폼 (생성자만 수정·삭제). 모바일 컴팩트 사이즈 자동 적용 (FR-15-4) |
| S-07 | 프로젝트 갠트차트 (좌측 view=project) | /teams/[teamId] | 팀원 | 갠트차트 뷰, 프로젝트 일정·세부 일정 CRUD, 우측 자동 전환 |
| S-08 | 자료실 글 상세 / 작성 / 수정 | (S-05A 내부) | 팀원 | 제목·본문·첨부 등록, 작성자 본인만 수정·삭제 |
| S-09 | 나의 할 일 | /me/tasks | LEADER | 가입 신청 목록, 승인/거절 (UC-02C) |

### 핵심 화면 레이아웃 (S-05 팀 메인)

```
[데스크탑 1024px 이상]
+---------------------------+------------------+
|       캘린더 뷰            |    채팅 영역      |
|  (월/주/일 전환 탭)        |  날짜별 메시지    |
|                           |  메시지 입력창    |
|  일정 클릭 → 상세 팝업     |  [일정요청] 버튼  |
+---------------------------+------------------+

[모바일 640px 미만]
+----------------------------------+
|  [캘린더] [팀채팅] [AI 찰떡이]   |  ← 하단 탭 전환
+----------------------------------+
|                                  |
|  캘린더 뷰 (좌우 swipe 으로       |
|   월/주/일 페이지 이동, 280ms    |
|   슬라이드 인 애니메이션)         |
|   — 또는 —                        |
|  팀채팅 (마이크 버튼 ◉)          |
|   — 또는 —                        |
|  AI 찰떡이 (마이크 + 6-way 분류)  |
|                                  |
+----------------------------------+
```

---

## 9. 개발 일정 (5일 플랜, 1인 기준)

| 일차 | 작업 항목 | 산출물 |
|------|----------|--------|
| Day 1 | 프로젝트 초기 설정 (Next.js + TypeScript + ESLint + pg), DB 스키마 작성 및 마이그레이션 (team_join_requests 포함), 인증 API (회원가입·로그인·JWT 발급) | DB 스키마, 인증 API |
| Day 2 | 팀 생성·조회 API, 공개 팀 목록 API, 가입 신청·승인·거절 API, 나의 할 일 API, 로그인·회원가입·팀 목록·팀 탐색·나의 할 일 화면 | 팀 관리 API, S-01~S-04C 화면 |
| Day 3 | 일정 CRUD API, 캘린더 뷰 컴포넌트 (월/주/일), 권한 검증 미들웨어 | 일정 API, 캘린더 화면 |
| Day 4 | 채팅 API (전송·날짜별 조회), WORK_PERFORMANCE 타입 처리, TanStack Query 폴링 연동, 채팅 화면 | 채팅 API, 채팅 화면 |
| Day 5 | 캘린더 + 채팅 동시 화면 완성 (S-05), 반응형 UI 검증, Docker Compose 배포, E2E 시나리오 테스트 | 최종 배포, 통합 테스트 |

> 자료실(FR-12)·AI 버틀러(FR-13)·프로젝트 채팅(FR-05-10) 은 MVP 1차 배포 이후 추가된 기능. 자세한 운영 배포 가이드는 [`docs/19-deploy-guide.md`](./19-deploy-guide.md) 참고.

### 일일 체크리스트

- [ ] API 엔드포인트 동작 확인 (curl / Swagger UI)
- [ ] 권한 검증 로직 서버 사이드 확인
- [ ] 반응형 UI 모바일/데스크탑 확인
- [ ] `docker compose up -d` 정상 기동 + 컨테이너 health 확인

---

## 10. 리스크 & 제약사항

### 기술 리스크

| 리스크 | 심각도 | 대응 방안 |
|--------|--------|-----------|
| AI 모델 응답 시간 (gemma4:26b CPU 기준 30~120초) | 높음 | SSE 스트리밍으로 첫 토큰 ~3~10초 단축. 운영 환경엔 GPU 권장. 일정 조회는 코드 포맷이라 즉시 응답 |
| 단일 호스트 장애 시 전체 서비스 중단 | 중간 | 1단계 수용. HA 도입은 후속 (`docs/19` §13). DB·`files/` 일일 백업으로 복구 시간 단축 |
| 첨부파일 호스트 디스크 가득 | 중간 | 모니터링 알람 80%. 운영 전환 시 `STORAGE_BACKEND=s3` 토글 (`docs/18` §6) |
| 악성 첨부파일(실행파일·SVG XSS) 업로드 | 중간 | MIME 화이트리스트 + magic-bytes 검증. `Content-Disposition: attachment` 강제 (BR-14) |
| AI 가 의도와 다른 SQL 시도 | 중간 | AI 자유 SQL 금지 — backend SQL 템플릿만. `withAuth`/`withTeamRole` 필수 (BR-20) |
| 마이크 권한 거부 (STT 사용 불가) | 중간 | feature detection 으로 UI 우아하게 비활성. 사용자에게 한국어 토스트 안내. 텍스트 입력은 그대로 가능 |
| Galaxy/Samsung 디바이스 음성 엔진 quirk (중복 emit·refinement) | 중간 | UA 검사로 Whisper 자동 분기. confidence==0 결과 무시 등 react-speech-recognition 검증된 워크어라운드 적용 |
| Whisper 모델 다운로드 실패 (HF xet storage TLS) | 중간 | `HF_HUB_DISABLE_XET=1`, `HF_HUB_ENABLE_HF_TRANSFER=0` 으로 git-LFS fallback. medium → small 모델 폴백 옵션 |
| Open WebUI v0.9 admin DB 손실 | 낮음 | `open-webui-data` volume 정기 백업 |
| Postgres 연결 풀 과부하 | 낮음 | pg Pool 글로벌 싱글턴(max: 5). 50명 동시 접속 가정 충분 |

### 개발 제약사항

| 제약 | 영향 | 대응 |
|------|------|------|
| 1인 개발 | 기능 범위 제한 필수 | MVP 외 기능 엄격히 제외 |
| 단일 호스트 운영 | HA·다중 인스턴스 미지원 | `docs/19` §13 후속 — backend 다중 인스턴스 + nginx upstream + 별도 GPU 워커 |
| 접근성 미적용 | 일부 사용자 경험 제한 | MVP 이후 단계에서 검토 |
| AI 자유도 제한 (SQL 템플릿만) | "내가 만든 일정만" 같은 새 패턴은 수동 추가 | trade-off 수용 — 자유 SQL 위험 회피 (`docs/16` §3.4) |

### 스코프 크립 방지

아래 기능은 요청이 들어와도 MVP에서 반드시 제외합니다.

- Push 알림 / 이메일 알림
- 파일 첨부
- 일정 반복 설정
- 팀장 변경
- 검색 기능
- 다국어 지원

---

## 11. 관련 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 도메인 정의서 | docs/1-domain-definition.md | 핵심 엔티티, 비즈니스 규칙, 유스케이스 정의 |
| ERD | docs/6-erd.md | 데이터베이스 엔티티 관계도 |
| API 명세 | docs/7-api-spec.md | REST API 엔드포인트 상세 명세 |
| 사용자 시나리오 | docs/3-user-scenarios.md | 주요 시나리오 흐름도 |
| 시스템 아키텍처 | docs/5-tech-arch-diagram.md | 컴포넌트 다이어그램·런타임 흐름 |
| RAG 파이프라인 | docs/13-RAG-pipeline-guide.md | RAG 인덱스 빌드·검색·재인덱싱 |
| Open WebUI + SearxNG 통합 | docs/14-Open-WebUI-plan.md | 일반 질문 경로 + 인프라 설정 |
| Docker 컨테이너 인프라 | docs/15-docker-container-gen.md | 개발 컨테이너 구성 |
| AI 4-way 의도 분류 | docs/16-mcp-server-plan.md | 자체 MCP 폐기·표준 PG-MCP 결정 |
| AI 모델의 DB 접근 흐름 | docs/17-ai-db-guide.md | 시나리오·안전장치·trust boundary |
| 자료실(게시판) 가이드 | docs/18-board-guide.md | 데이터 모델·storage·검증·S3 마이그레이션 |
| 운영 배포 가이드 | docs/19-deploy-guide.md | Docker → 운영 호스트 단계별 절차 |
| 음성 입력(STT) 가이드 | docs/22-voice-input.md | Web Speech / Whisper hybrid hook, 디바이스 분기 정책 |
| 임베딩 모델 CPU 분리 | docs/embeding-cpu.md | nomic-embed-text CPU 분리 — 채팅 모델 VRAM 최적화 |
| 배포 가이드 (STT 챕터 포함) | docs/20-easy-deploy.md | STEP 7 Whisper STT 컨테이너 운영 |
