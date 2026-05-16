# TEAM WORKS 도메인 정의서

## 문서 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2026-04-07 | 최초 작성 |
| 1.1 | 2026-04-07 | 추적성·검증성 보강, TeamInvitation 추가, 수락 조건 추가 |
| 1.2 | 2026-04-08 | 팀 가입 신청(TeamJoinRequest) 방식으로 팀원 합류 흐름 전면 변경 — TeamInvitation 제거, TeamJoinRequest 추가, 나의 할 일(My Tasks) 개념 추가, 팀 공개 목록 조회 추가 |
| 1.3 | 2026-04-08 | 4.2 Team 엔티티에 팀장 생성 시점(팀 생성 시 자동 LEADER) 명시, UC-02 연관 규칙 BR-01 추가 |
| 1.4 | 2026-04-18 | 앱명 Team CalTalk → TEAM WORKS 반영. ChatMessage.type SCHEDULE_REQUEST → WORK_PERFORMANCE 변경 |
| 1.5 | 2026-04-18 | Team에 description/isPublic 추가, BR-02/BR-04 실제 구현 반영, 앱명 통일 |
| 1.6 | 2026-04-20 | Postit, WorkPerformancePermission, Project, ProjectSchedule, SubSchedule, Notice 엔티티 추가. 관련 역할/권한, 비즈니스 규칙, 유스케이스, CRUD 매핑 갱신 |
| 1.7 | 2026-04-28 | 백엔드 구현 일치화: 팀 정보 수정/삭제, 팀원 강제 탈퇴, 내 프로필 수정 도메인화. BR-11·BR-12 추가, UC-14·UC-15·UC-16 추가, 역할/권한 표 및 CRUD 매핑 갱신 |
| 1.8 | 2026-04-29 | 채팅방 컨텍스트 격리 + 자료실 도입: ChatMessage·Notice 에 `projectId` 추가(NULL=팀 일자별, NOT NULL=프로젝트 전용). BoardPost·BoardAttachment 엔티티 신규. V. 자료실 핵심 기능 추가. BR-13(자료실 권한)·BR-14(첨부파일 검증)·BR-15(채팅방 컨텍스트 격리) 추가, UC-17~20 추가, 역할/권한·CRUD 매핑 갱신. 운영 환경 — Vercel 가정 폐기, Docker Compose 단일 호스트 배포 명시 |
| 1.9 | 2026-04-29 | AI 버틀러 "찰떡" 도메인 반영: VI. AI 버틀러 핵심 기능(4-way 자동 의도 분류 — 사용법/RAG · 일반/Open WebUI · 일정 조회·등록 · 거절 안내, 다중 턴 일정 등록) 추가. BR-16~20(의도 분류·confirm 카드·자유 SQL 금지·거절 정책·DB 접근 제약) 추가, UC-21~25 추가, 역할/권한·CRUD 매핑 갱신. 비기능에 AI 모델·SSE 스트리밍·AI 인프라 명시, 관련 문서 docs/13·14·15·16 링크 |
| 2.0 | 2026-04-29 | 코드 ↔ 문서 일치성 점검 결과 반영: UC-01 수락 조건에 토큰 갱신(`/api/auth/refresh`) 분기 추가, UC-02C 수락 조건에 `GET /api/me/tasks` 명시, UC-20 표제에 endpoint 명시. §9 비기능에 JWT 만료 정책(Access 15분/Refresh 7일), frontend 핵심 라이브러리(TanStack Query·Zustand·Lucide React), Swagger UI(API 문서) 항목 추가 |
| 2.1 | 2026-05-12 | AI 버틀러 확장 — `schedule_update`·`schedule_delete` 의도 지원 (4-way → 6-way 분류). BR-19 거절 범위 축소(채팅/공지/포스트잇/프로젝트/자료실 CRUD 만), BR-21/22 신설(일정 수정·삭제 다중 턴 confirm), UC-26/27 추가. 음성 입력(STT) 도메인화 — VI 항목·BR-23·UC-28 추가, Web Speech API + 자체 Whisper hybrid 자동 분기(Galaxy/Samsung 디바이스 quirk 회피). 모바일 UX 최적화 — VII 항목 신설(좌우 swipe 네비게이션, 모바일 전용 컴팩트 모달·포스트잇). RAG 자연어 처리 보강 — "X시 반" 정규화, 식사 단어(아침/점심/저녁/야식) 시간대 band → 키워드 매치로 전환 |
| 2.2 | 2026-05-16 | 카카오 소셜 인증 도입 — User.password nullable, OAuthAccount(4.1b)·OAuthState(4.1c) 엔티티 신설, BR-24(카카오 OAuth+PKCE+state·계정매칭·email_required) 추가, UC-29 신규+수락조건. 간트차트 SVG 저장 — BR-25·UC-30 추가 |

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| 서비스명 | TEAM WORKS |
| 목적 | 팀 단위 캘린더 기반 일정관리 + 채팅 통합 애플리케이션 |
| 핵심 가치 | 일정과 대화의 맥락을 한 곳에서 관리 |

### 1-1. 핵심 기능

#### I. 팀 관리 기능 — "우리 팀, 내가 직접 만들고 운영해요"
프로젝트 하나 시작할 때마다 IT팀에 "채널 만들어 주세요" 요청하거나, 단톡방 또 파서 사람 초대하던 경험 있으시죠. 팀웍스는 내가 직접 팀을 만들고, 팀을 만든 사람이 자동으로 팀장이 돼요.

팀을 공개로 설정해두면 다른 사람들이 "이 팀 재밌어 보이는데?" 하고 직접 가입 신청을 해옵니다. 팀장은 신청 목록 보면서 받을 사람만 골라서 승인하면 끝. 여러 팀을 이끌고 있어도 걱정 없어요. '나의 할 일' 화면에 가입 신청이 전부 모여 있어서 한 번에 처리할 수 있거든요.

#### II. 일정 관리 기능 — "팀 일정, 이제 헷갈릴 일 없어요"
**팀 캘린더**: "다음 주 수요일 회의 몇 시였지?" 단톡방 스크롤 끝까지 내려본 적 있으시죠. 팀 캘린더에 일정을 딱 올려두면 월·주·일 단위로 보고 싶은 대로 볼 수 있어요. 팀원 누구나 일정을 추가할 수 있고, 내가 올린 일정만 내가 수정·삭제할 수 있으니 누가 마음대로 지워버릴 걱정도 없습니다. 물론 우리 팀 일정은 우리 팀에만 보여요.

**포스트잇**: "내일 거래처 미팅 전에 이거 꼭 챙기기!" 같은 메모, 포스트잇처럼 날짜에 붙여둘 수 있어요. 색깔도 골라서 중요한 건 빨갛게, 참고사항은 파랗게 구분해두면 딱 봐도 뭐가 급한지 보입니다. 내 메모는 언제든 수정하거나 떼버릴 수 있어요.

#### III. 프로젝트 관리 기능 — "엑셀 간트차트, 이제 그만 수정해도 돼요"
`프로젝트_일정_v7_최종_진짜최종.xlsx` 이런 파일 만들어 본 적 있으시죠. 팀웍스는 프로젝트를 3단계로 정리해서 누가 봐도 한눈에 들어오게 만들어줘요. 진행률은 %로 바로 보이고, 일정이 밀린 업무는 색이 바뀌어서 팀장도 팀원도 "이거 빨리 처리해야겠다" 바로 알아챌 수 있습니다.

- **프로젝트**: 업무의 큰 틀이에요. "2분기 신제품 런칭" 같은 단위로 만들고, 그 안에 '기획 → 개발 → 출시' 같은 단계를 직접 정할 수 있어요.
- **프로젝트 일정**: 프로젝트 안의 구체적인 업무 덩어리예요. 각 업무마다 담당자, 기간, 진행도를 정해두면 "누가 뭘 언제까지" 한눈에 보입니다.
- **세부 일정**: 업무를 더 작게 쪼개놓은 할 일이에요. 큰 업무를 작은 단위로 나누면 관리도 쉽고, "오늘 이거 하나만 끝내자" 같은 목표도 세우기 좋아요.

팀원 누구나 만들 수 있지만, 내가 만든 건 나만 고칠 수 있어요.

#### IV. 팀 채팅 관리 기능 — "업무 대화와 사담, 이제 섞이지 않아요"
카톡에 업무 얘기 섞이다 보면 "아까 그 파일 어디 있더라?" 찾기 힘들잖아요. 팀웍스 채팅은 목적에 맞게 세 가지로 나뉘어 있어요. 메시지는 날짜별로 자동 정리되니까 "지난주 화요일에 뭐라고 했더라?" 바로 찾을 수 있습니다.

- **일반 대화**: 팀원끼리 편하게 나누는 일상 대화예요. 점심 뭐 먹을지, 회의 후기, 업무 잡담 다 여기서. 팀원 전부 볼 수 있어요.
- **업무보고**: 팀장에게 올리는 보고 메시지예요. 내 평가나 민감한 내용이 담길 수 있으니까, 기본은 팀장만 볼 수 있어요. 팀장이 "이건 다 같이 봐도 돼요"라고 허락한 사람만 추가로 볼 수 있습니다. 동료가 내 보고를 맘대로 훔쳐볼 수 없는 안전한 구조예요.
- **공지사항**: "내일 오전 10시 전체 회의!" 같은 중요한 알림, 채팅 맨 위에 딱 고정돼요. 팀원 누구나 올릴 수 있고, 지우는 건 올린 본인이나 팀장만 가능합니다.

**프로젝트 전용 채팅방**: 팀 전체가 보는 일자별 채팅과 별도로, 프로젝트마다 독립된 채팅방이 있어요. "신규 대시보드 개발" 프로젝트를 열면 그 프로젝트만의 채팅·공지가 따로 정리됩니다. 다른 프로젝트나 일자별 채팅엔 안 섞여요. 메시지·공지·자료실 모두 프로젝트 단위로 격리됩니다.

#### V. 자료실 — "회의 자료, 보고서, 파일 공유 한 곳에서"
채팅에 파일 올리면 며칠만 지나도 스크롤로 못 찾잖아요. 자료실은 채팅방마다 sub-탭으로 붙어 있어서, **글 제목 + 본문 + 첨부파일** 형태로 깔끔하게 정리할 수 있어요. 일자별 채팅방엔 팀 공통 자료실, 프로젝트 채팅방엔 그 프로젝트만의 자료실이 따로 있습니다.

- **글 작성**: 팀원 누구나 가능. 제목·내용·첨부파일(이미지·PDF·docx 등 최대 10MB)을 한 번에 등록.
- **수정·삭제**: 글 작성자 본인만. 다른 사람 글은 못 건드려요.
- **첨부파일**: 1단계는 글당 1개 (다중 첨부는 후속 확장). 다운로드는 같은 팀 멤버만 가능.
- **격리**: 채팅·공지와 동일하게 `(팀, 프로젝트)` 조합 별로 분리. 프로젝트 자료실 글이 일자별 자료실에 섞이지 않습니다.
- **운영 전환**: 첨부파일은 1단계 로컬 디스크 저장, 운영 환경에선 클라우드 스토리지(S3 등)로 무중단 마이그레이션 가능 (호출처 코드 변경 0건).

#### VI. AI 버틀러 "찰떡" — "이거 어떻게 해요? 부터 일정 등록·수정·삭제까지, 한 입력창에서"
"이 기능 어떻게 쓰는 거지?" 매뉴얼 찾아 헤매고, "오늘 회의 일정 알려줘" 캘린더 들춰보고, "내일 오후 3시 회의 등록" 버튼 여기저기 눌러본 적 있죠. 찰떡은 우측 채팅 영역의 sub-탭 하나에서 **모든 자연어 요청** 을 받아 의도를 자동으로 알아듣고 적절한 답을 줘요.

- **사용법 질문 (`usage`)** — "포스트잇 색깔 종류 알려줘", "프로젝트 등록하는 법" — TEAM WORKS 공식 문서를 RAG(Retrieval-Augmented Generation) 로 검색해 정확한 답변. 답변 카드에 "📚 공식 문서 N건 참조" 출처 뱃지 표시.
- **일반 질문 (`general`)** — "오늘 뉴스 검색해줘", "오늘 서울 날씨" — SearxNG 메타검색(Google/Bing/Naver/DuckDuckGo) 결과 5건을 모델 컨텍스트에 넣어 Open WebUI(gemma4:26b) 가 답변. "🌐 웹 검색 N건 참조" 뱃지.
- **일정 조회 (`schedule_query`)** — "오늘 일정 알려줘", "이번 주 회의", "디자인 리뷰 언제야?" — 자연어를 view+date+keyword 로 변환 후 백엔드 일정 API 직접 조회. 코드가 한국어로 포맷 (LLM 답변 본문 생성 0회 → 즉시). 식사 단어("점심", "저녁", "아침") 는 시간대 band 가 아니라 keyword 로 검색 (직장인 일정의 30%+ 가 식사 약속이라는 도메인 특성 반영).
- **일정 등록 (`schedule_create`)** — "내일 오후 3시 주간회의 등록해줘", "13일 11시 반 직원점심" — 자연어를 인자(title/startAt/endAt) 로 파싱 → **confirm 카드** 로 사용자에게 보여주고 ✓ 클릭해야 INSERT. 정보 부족 시 "몇 시에 잡을까요?" 같은 후속 질문으로 **다중 턴 대화**. "X시 반" → 30분 자동 정규화.
- **일정 수정 (`schedule_update`)** — "내일 회의 오후 4시로 옮겨줘", "디자인 리뷰 제목 바꿔줘" — 대상 일정 식별 → 새 일시·제목 수집 → confirm 카드 → ✓ 클릭 후 PATCH. 일정 후보가 여러 개면 사용자에게 시각·키워드로 좁히도록 후속 질문.
- **일정 삭제 (`schedule_delete`)** — "내일 회의 삭제해줘", "어제 디자인 리뷰 취소" — 대상 일정 식별 → confirm 카드 → ✓ 클릭 후 DELETE. "취소" 동사도 한국어 일상 의미상 "삭제" 와 동일 처리.
- **거절 안내 (`blocked`)** — "프로젝트 등록해줘", "공지사항 작성해줘", "포스트잇 만들어줘" 같이 채팅·공지·포스트잇·프로젝트·자료실 CRUD 요청은 정중히 거절. "찰떡이는 일정 관련 작업만 도와드릴 수 있어요. 직접 처리해 주세요" 안내. (단, 일정 CRUD 는 모두 지원.)

답변은 SSE 스트리밍으로 첫 토큰부터 점진 표시(빈 카드 시간 최소화). 입력하기 전에 모드를 고를 필요가 없어 "내가 지금 무얼 묻는지" 신경 쓸 일 없습니다.

**음성 입력 (STT)**: 입력창 옆 마이크 아이콘으로 한국어 음성 입력 지원. **AI 찰떡이 탭**과 **팀채팅 탭** 모두 적용. 출퇴근 지하철, 운전 중, 외근 같은 모바일·핸즈프리 상황에서 키보드 안 두드리고 "오늘 일정 알려줘" "내일 오후 3시 회의 등록" "팀원들에게 회식 공지" 같은 요청을 그대로 말할 수 있어요.

브라우저·디바이스에 따라 자동으로 두 엔진 중 하나를 선택:
- 노트북 Chrome·iOS Safari·일반 Android Chrome → Web Speech API (브라우저 내장 — Google·Apple 음성 엔진 위임, 한국어 정확도 ★★★★★)
- Samsung Galaxy 디바이스·Samsung Internet·Firefox 등 → 자체 호스팅 Whisper STT (`onerahmet/openai-whisper-asr-webservice` 컨테이너, `faster_whisper` 엔진, KST 도메인 어휘 initial_prompt + VAD filter)

마이크 비지원 환경(Firefox 등 일부)에서는 마이크 아이콘이 자동 숨김. 인식된 텍스트는 입력창에 채워지고 사용자가 검토 후 [전송] 클릭 — 오인식 수정 여지 확보. 캘린더 분할 화면(휴대폰에서 캘린더 + AI 입력 동시) 에선 키보드가 화면 절반을 가리지 않도록 마이크로 입력하면 텍스트 입력창에 자동 포커스가 가지 않게 처리(키보드 표시 억제).

#### VII. 모바일 최적화 UX — "한 손으로 한 화면에서 다 됩니다"
출퇴근 지하철, 외근 중에도 캘린더 보고 메시지 보내야 할 때 있죠. PC 버전 그대로 모바일에 띄우면 글자 작아서 안 보이고 버튼 빼곡해서 잘못 누르기 일쑤예요. TEAM WORKS 는 모바일 뷰포트(<640px) 에서 자동으로 다음을 적용합니다.

- **좌우 swipe 네비게이션**: 캘린더에서 손가락으로 좌→우 쓸면 이전(이전 월/주/일), 우→좌 면 다음. 구글 캘린더 스타일 슬라이드 인 애니메이션(280ms cubic-bezier) 으로 부드러운 페이지 전환.
- **컴팩트 일정 모달**: 일정 상세·등록·수정 모달이 모바일에서 패딩·폰트·버튼 크기 자동 축소. 가로폭 80%, 폼 요소 글꼴 한 단계 작게. PC 는 기존 사이즈 유지.
- **컴팩트 포스트잇**: 모바일 월간뷰에 포스트잇 색상 팔레트 자동 노출. 카드는 테두리·그림자 제거, 상단에 작은 X 삭제 아이콘만.
- **멀티데이 밴드 동적 높이**: 캘린더의 여러 날 일정 밴드 높이가 텍스트 길이·셀 폭에 맞춰 자동 산출 → 모바일 좁은 셀에서도 빈 여백 없이 타이트하게 표시.
- **다크모드 시인성**: 캘린더 팝업의 이전·다음 달 표시는 회색, 현재 달은 흰색, 오늘은 앰버골드로 명도 차이를 명확히.
- **모바일 AI 찰떡이 (음성으로 일정 조회·등록)**: 하단 탭 [캘린더 / 팀채팅 / AI 찰떡이] 중 [AI 찰떡이] 진입 후 마이크 아이콘 한 번. "오늘 일정 알려줘" 발화 → 음성 → 텍스트 → AI 가 일정 카드로 응답. "내일 오후 3시 회의 등록" 같은 등록 요청도 confirm 카드로 ✓ 한 번이면 끝. 키보드 없이 손가락 두 번으로 완결되는 동선이 모바일 핵심 가치예요.
- **모바일 팀채팅 음성 입력**: 메시지 입력창 옆에도 마이크 버튼. 운전 중·이동 중 빠르게 한마디 보낼 때 키보드 안 두드려도 됩니다. 전송 후 자동으로 입력창 포커스 해제 — 키보드가 다시 안 올라옴.
- **분할 화면 키보드 억제**: AI 찰떡이 입력창에서 캘린더 아이콘으로 화면 분할 시, 입력창에 자동 포커스가 가지 않게 처리. 음성 입력으로 결과 받는 동안 키보드가 화면 절반을 가리는 상황 방지.

### 1-2. 핵심 장점

#### "여러 앱 켜놓고 왔다갔다 하기, 이제 끝"
슬랙에서 일정 얘기하고, 구글캘린더에 옮기고, 노션에 정리하고, 엑셀로 간트차트 그리고... 이거 하루에 몇 번 해보셨어요? 팀웍스 하나만 켜두면 일정, 프로젝트, 채팅, 공지까지 다 되니까 창 여러 개 띄워놓고 헤맬 일이 없어요.

#### "팀 만들기부터 업무 완주까지, 한 앱에서 다 됩니다"
새 팀 꾸리기, 팀원 모으기, 일정 짜기, 업무 진행, 보고까지. 프로젝트 시작부터 끝까지 필요한 기능이 전부 들어 있어요. 중간에 "이건 다른 앱에서 해야 하네" 하고 끊어지는 순간이 없습니다.

#### "복잡한 업무도 그림 하나로 딱"
3단계로 쪼개진 프로젝트 뷰 덕분에 큰 그림과 세부 작업을 동시에 볼 수 있어요. 진행률도 눈에 보이고, 늦어지는 건 색깔로 표시되니까 "뭐가 급한지" 바로 감이 옵니다. 엑셀로 밤새 간트차트 그리던 시절이여 안녕.

#### "팀장님도, 팀원도 편해져요"
팀장은 업무보고를 누가 볼 수 있는지 직접 정할 수 있어서 민감한 정보가 엉뚱한 사람한테 새어나갈 일이 없어요. 여러 팀을 이끄는 팀장도 '나의 할 일'에서 가입 신청, 업무 현황을 한 화면에서 처리할 수 있으니까 이리저리 옮겨다닐 필요가 없습니다.

#### "지난주에 뭐 했더라? 1초 만에 확인"
그날 있었던 회의, 남겨놓은 메모, 주고받은 대화가 날짜별로 차곡차곡 정리돼요. 며칠 전 결정사항이 뭐였는지 확인하거나, 지난주 업무 회고할 때 단톡방 스크롤 무한히 내리지 않아도 됩니다.

---

## 2. 문제 정의

| # | 문제 | 해결 유스케이스 |
|---|------|----------------|
| P-01 | 팀 일정이 개인 캘린더·메신저·엑셀에 분산 → 충돌·누락 빈발 | UC-03, UC-04 |
| P-02 | 일정 관련 대화가 일정과 분리 → 맥락 추적 어려움 | UC-05, UC-06, UC-07 |
| P-03 | 팀장의 팀원 일정 가시성·통제력 부족 | UC-03, UC-04 |

---

## 3. 핵심 도메인 (Bounded Context)

```
┌────────────────────────────────────────────────────────────────────────┐
│                              TEAM WORKS                                │
│                                                                        │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐             │
│  │  Auth   │   │ Calendar │   │ Project  │   │  Board   │             │
│  │ (인증)  │──▶│  (일정)  │   │ (간트)   │   │ (자료실) │             │
│  └────┬────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘             │
│       │             │              │              │                    │
│       │             │   ┌──────────┴──────────────┘                    │
│       │             │   │  ChatMessage / Notice / BoardPost            │
│       │             │   │  ── 모두 (teamId, projectId) 격리 키 공유    │
│       │             │   ▼                                              │
│       │             │  ┌──────────┐                                    │
│       │             │  │   Chat   │                                    │
│       │             │  │  (채팅)  │                                    │
│       │             │  └────┬─────┘                                    │
│       │             │       │                                          │
│       └─────────────┴───────┴────────────────────▶  Team (팀 관리)    │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ AI Assistant "찰떡"  ── 단일 입력창 + 6-way 자동 의도 분류      │  │
│  │   ├ usage           → RAG (ollama/*.md 인덱스) → Ollama 답변    │  │
│  │   ├ general         → SearxNG + Open WebUI gemma4:26b 답변      │  │
│  │   ├ schedule_query  → backend Schedule API 직접 조회 (코드 포맷)│  │
│  │   ├ schedule_create → confirm 카드 + 다중 턴 → Schedule INSERT  │  │
│  │   ├ schedule_update → 대상 식별 + confirm → Schedule PATCH      │  │
│  │   ├ schedule_delete → 대상 식별 + confirm → Schedule DELETE     │  │
│  │   └ blocked         → 정중한 거절 안내 (일정 외 도메인 CRUD)    │  │
│  │                                                                  │  │
│  │  입력 방식: 텍스트 + 음성(STT) — Web Speech / Whisper 자동 분기 │  │
│  │  AI 모델은 자연어 → JSON 변환만. SQL 자유 생성 금지.            │  │
│  │  DB 접근은 backend 미들웨어(withAuth/withTeamRole) 통과.        │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  운영 — Docker Compose 단일 호스트. 첨부파일 storage 는 토글 가능     │
│       (LocalStorageAdapter ↔ S3StorageAdapter, 호출처 변경 0)         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 핵심 엔티티

### 4.1 User (사용자)
| 속성 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK, not null |
| email | String | unique, not null, 이메일 형식 |
| name | String | not null, 최대 50자 |
| password | String | **nullable**, 암호화 저장 — OAuth 전용 사용자는 비밀번호 없음 |

> **소셜 인증 도입(2026-05):** 카카오 OAuth 로그인이 추가되면서 `password`(= `password_hash`)의 NOT NULL 제약이 해제됨. 이메일/비밀번호 가입 사용자는 기존대로 해싱된 비밀번호를 보유하고, 카카오로만 가입한 사용자는 `password = NULL` + OAuthAccount 연결로 식별. `email` 은 NOT NULL 유지(이메일 동의 미허락 시 가입 거절 — BR-24).

### 4.1b OAuthAccount (소셜 연결 계정)
| 속성 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK, not null |
| userId | UUID | FK → User.id, not null, ON DELETE CASCADE |
| provider | Enum | `kakao` \| `google`, not null |
| providerUserId | String | not null — 카카오 회원번호 / 구글 sub |
| providerEmail | String | nullable |
| providerName | String | nullable — Provider 닉네임 |
| providerPicture | String | nullable — 프로필 이미지 URL |
| linkedAt | Timestamp | not null, default now() |
| lastLoginAt | Timestamp | nullable |

> **규칙:** `UNIQUE(provider, providerUserId)` — 같은 Provider 의 같은 외부 ID 는 한 사용자에게만 매핑. `UNIQUE(userId, provider)` — 한 사용자가 같은 Provider 를 중복 연결 불가. 한 User 는 여러 Provider 를 연결할 수 있음(향후 구글 확장 대비).

### 4.1c OAuthState (인증 흐름 임시 상태)
| 속성 | 타입 | 제약 |
|------|------|------|
| state | String(64) | PK — CSRF 방지용 난수 |
| codeVerifier | String(128) | not null — PKCE code_verifier |
| redirectAfter | String | nullable — 로그인 후 복귀 경로(open-redirect 검증 후 사용) |
| createdAt | Timestamp | not null, default now() — TTL 5분, 주기적 청소 |

> **규칙:** 인증 시작(`/start`)에서 생성 → 콜백(`/callback`)에서 1회 소비 후 즉시 삭제. Redis 미보유 인프라라 DB 로 대체, `created_at < now() - interval '1 hour'` 주기 청소.

### 4.2 Team (팀)
| 속성 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK, not null |
| name | String | not null, 최대 100자 |
| description | String | nullable, 최대 500자 |
| isPublic | Boolean | not null, default false — 공개 팀 목록 노출 여부 |
| leaderId | UUID | FK → User.id, not null |

> **팀장 생성 시점:** 팀이 생성될 때 요청자가 자동으로 해당 팀의 `leaderId`로 설정되고, 동시에 `TeamMember(role: LEADER)` 레코드가 원자적으로 생성됩니다. 즉, **팀 생성 = LEADER 생성**입니다.
>
> **규칙:** `leaderId`가 권위(source of truth). 팀장 변경 시 `leaderId` 업데이트 + 기존 LEADER의 TeamMember.role → MEMBER로 동시 전환.

### 4.3 TeamMember (팀 구성원)
| 속성 | 타입 | 제약 |
|------|------|------|
| teamId | UUID | FK → Team.id, not null |
| userId | UUID | FK → User.id, not null |
| role | Enum | `LEADER` \| `MEMBER`, not null |

### 4.4 TeamJoinRequest (팀 가입 신청)
| 속성 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK, not null |
| teamId | UUID | FK → Team.id, not null |
| requesterId | UUID | FK → User.id, not null — 가입을 신청한 사용자 |
| status | Enum | `PENDING` \| `APPROVED` \| `REJECTED`, default: PENDING |
| requestedAt | DateTime | not null — 신청 일시 (UTC) |
| respondedAt | DateTime | nullable — 팀장이 승인/거절한 일시 (UTC) |

> **규칙:** 이미 팀 구성원이거나 동일 팀에 PENDING 상태의 신청이 존재하는 경우 중복 신청 불가. APPROVED 처리 시 TeamMember(MEMBER)가 원자적으로 생성됨.

### 4.5 Schedule (팀 일정)
| 속성 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK, not null |
| teamId | UUID | FK → Team.id, not null |
| title | String | not null, 최대 200자 |
| description | String | nullable |
| startAt | DateTime | not null |
| endAt | DateTime | not null, endAt > startAt |
| createdBy | UUID | FK → User.id, not null |

### 4.6 ChatMessage (채팅 메시지)
| 속성 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK, not null |
| teamId | UUID | FK → Team.id, not null |
| projectId | UUID | FK → Project.id, nullable — NULL=팀 일자별 채팅, NOT NULL=프로젝트 전용 채팅 |
| type | Enum | `NORMAL` \| `WORK_PERFORMANCE`, default: NORMAL |
| senderId | UUID | FK → User.id, not null |
| content | String | not null, 최대 2000자 |
| sentAt | DateTime | not null |

> **컨텍스트 격리:** `projectId IS NULL` 인 메시지는 팀 일자별 채팅(sentAt 기준 KST 날짜로 그룹핑), `projectId = ?` 인 메시지는 해당 프로젝트 전용 채팅으로만 노출. 두 컨텍스트 간 메시지가 섞이지 않음.
>
> **날짜별 조회 (팀 채팅):** `sentAt` 기준 서버 시간(UTC+9 KST)의 날짜로 그룹핑.
>
> **프로젝트 채팅 조회:** 같은 `projectId` 의 모든 메시지를 sentAt ASC 로 최대 200건 반환.

### 4.7 Postit (포스트잇)
| 속성 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK, not null |
| teamId | UUID | FK → Team.id, not null |
| createdBy | UUID | FK → User.id, not null |
| date | Date | not null — 해당 날짜 |
| color | String | not null, default 'amber' — indigo/blue/emerald/amber/rose |
| content | String | not null, default '' |

### 4.8 WorkPerformancePermission (업무보고 조회 권한)
| 속성 | 타입 | 제약 |
|------|------|------|
| teamId | UUID | FK → Team.id, not null, PK |
| userId | UUID | FK → User.id, not null, PK |
| grantedAt | DateTime | not null |

> **복합 PK:** (teamId, userId). 빈 배열이면 권한 제한 없음(전체 구성원 조회 가능).

### 4.9 Project (프로젝트)
| 속성 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK, not null |
| teamId | UUID | FK → Team.id, not null |
| createdBy | UUID | FK → User.id, not null |
| name | String | not null, 최대 200자 |
| description | String | nullable |
| startDate | Date | not null |
| endDate | Date | not null, endDate >= startDate |
| progress | Integer | not null, 0~100, default 0 |
| manager | String | not null, default '' |
| phases | JSONB | not null, default [] — [{id, name, order}] |

### 4.10 ProjectSchedule (프로젝트 일정)
| 속성 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK, not null |
| projectId | UUID | FK → Project.id, not null |
| teamId | UUID | FK → Team.id, not null |
| createdBy | UUID | FK → User.id, not null |
| title | String | not null, 최대 200자 |
| description | String | nullable |
| color | String | not null, default 'indigo' |
| startDate | Date | not null |
| endDate | Date | not null, endDate >= startDate |
| leader | String | not null, default '' |
| progress | Integer | not null, 0~100, default 0 |
| isDelayed | Boolean | not null, default false |
| phaseId | UUID | nullable — projects.phases[].id 참조 |

### 4.11 SubSchedule (세부 일정)
| 속성 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK, not null |
| projectScheduleId | UUID | FK → ProjectSchedule.id, not null |
| projectId | UUID | FK → Project.id, not null |
| teamId | UUID | FK → Team.id, not null |
| createdBy | UUID | FK → User.id, not null |
| title | String | not null, 최대 200자 |
| description | String | nullable |
| color | String | not null, default 'indigo' |
| startDate | Date | not null |
| endDate | Date | not null, endDate >= startDate |
| leader | String | not null, default '' |
| progress | Integer | not null, 0~100, default 0 |
| isDelayed | Boolean | not null, default false |

### 4.12 Notice (공지사항)
| 속성 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK, not null |
| teamId | UUID | FK → Team.id, not null |
| projectId | UUID | FK → Project.id, nullable — NULL=팀 일자별 공지, NOT NULL=프로젝트 전용 공지 |
| senderId | UUID | FK → User.id, not null |
| content | String | not null, 최대 2000자 |
| createdAt | DateTime | not null |

> **규칙:** 작성자 또는 팀장(LEADER)만 삭제 가능.
>
> **컨텍스트 격리:** ChatMessage 와 동일하게 `(teamId, projectId)` 별 격리. 프로젝트 공지는 그 프로젝트 채팅방에서만 표시.

### 4.13 BoardPost (자료실 글)
| 속성 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK, not null |
| teamId | UUID | FK → Team.id, not null |
| projectId | UUID | FK → Project.id, nullable — NULL=팀 일자별 자료실, NOT NULL=프로젝트 전용 자료실 |
| authorId | UUID | FK → User.id, not null — 작성자, 수정·삭제 권한 키 |
| title | String | not null, 1~200자 |
| content | String | not null, 최대 20000자 |
| createdAt | DateTime | not null |
| updatedAt | DateTime | not null |

> **규칙:** 작성은 팀 구성원 모두 가능. 수정·삭제는 작성자 본인만(`UPDATE/DELETE WHERE author_id = ?` 강제).
>
> **컨텍스트 격리:** ChatMessage·Notice 와 동일하게 `(teamId, projectId)` 별 격리.

### 4.14 BoardAttachment (자료실 첨부파일)
| 속성 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK, not null |
| postId | UUID | FK → BoardPost.id, not null, ON DELETE CASCADE |
| originalName | String | not null, 최대 255자 — 사용자에게 보여줄 파일명 |
| storedName | String | not null, 최대 64자 — UUID + 확장자, 디스크/객체스토리지 식별자 |
| mimeType | String | not null, 최대 100자 — 화이트리스트 통과 후 저장 |
| sizeBytes | BigInt | not null, 0 < size ≤ 10485760 (10MB) |
| uploadedAt | DateTime | not null |

> **규칙:** 1단계는 글당 1개 첨부 (DB 모델은 1:N 이라 후속 다중 확장 가능).
>
> **저장 위치:** `StorageAdapter` 인터페이스 뒤에 `LocalStorageAdapter`(1단계, 호스트 `./files` mount) 또는 `S3StorageAdapter`(운영 전환). `storedName` 자체가 backend 무관한 식별자라 cloud 마이그레이션 시 객체 key 로 그대로 사용.
>
> **검증:** `validateUpload()` — MIME 화이트리스트(jpg/png/gif/webp/pdf/docx/xlsx/pptx/txt/md/zip), magic-bytes 헤더 1차 검증(SVG·실행파일 차단), 크기 cap 10MB.
>
> **다운로드:** `GET /api/files/:id` — 호출자가 첨부의 team_id 멤버여야 허용. 응답에 `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` 강제로 인라인 렌더 차단.

---

## 5. 역할 및 권한

| 기능 | 팀장 (LEADER) | 팀원 (MEMBER) | 관련 규칙 |
|------|:---:|:---:|-----------|
| 내 프로필(이름) 수정 | 본인만 | 본인만 | BR-01 |
| 팀 공개 목록 조회 | O | O | BR-07 |
| 팀 가입 신청 | O (타 팀에 대해) | O | BR-07 |
| 가입 신청 승인/거절 | O (자기 팀에 대해) | X | BR-03 |
| 나의 할 일 목록 조회 | O | X | BR-03 |
| 팀 정보 수정 | O | X | BR-11 |
| 팀 삭제 | O | X | BR-11 |
| 팀원 강제 탈퇴 | O (본인 제외) | X | BR-12 |
| 팀 일정 조회 | O | O | BR-01 |
| 팀 일정 생성 | O | O | BR-02 |
| 팀 일정 수정/삭제 | 생성자 본인만 | 생성자 본인만 | BR-02 |
| 채팅 송수신 (팀 일자별) | O | O | BR-01, BR-15 |
| 채팅 송수신 (프로젝트 전용) | O | O | BR-01, BR-15 |
| 업무보고 전송 | O | O | BR-04 |
| 포스트잇 생성/수정/삭제 | 생성자 본인만 | 생성자 본인만 | BR-08 |
| 프로젝트 생성 | O | O | BR-09 |
| 프로젝트 수정/삭제 | 생성자 본인만 | 생성자 본인만 | BR-09 |
| 프로젝트 일정 생성/수정/삭제 | 생성자 본인만 | 생성자 본인만 | BR-09 |
| 세부 일정 생성/수정/삭제 | 생성자 본인만 | 생성자 본인만 | BR-09 |
| 공지사항 작성 (팀/프로젝트 모두) | O | O | BR-10, BR-15 |
| 공지사항 삭제 | O (팀장 가능) | 작성자 본인만 | BR-10 |
| 자료실 글 작성 (팀/프로젝트 모두) | O | O | BR-13 |
| 자료실 글 수정·삭제 | 작성자 본인만 | 작성자 본인만 | BR-13 |
| 자료실 첨부파일 다운로드 | O (같은 팀) | O (같은 팀) | BR-14 |
| AI 어시스턴트 사용 (사용법·일반 질문) | O | O | BR-01, BR-16 |
| AI 어시스턴트로 일정 조회 | O (자기 팀) | O (자기 팀) | BR-01, BR-16, BR-20 |
| AI 어시스턴트로 일정 등록 | O (자기 팀) | O (자기 팀) | BR-01, BR-17, BR-18, BR-20 |
| AI 어시스턴트로 일정 수정 | 일정 생성자 본인만 | 일정 생성자 본인만 | BR-02, BR-21 |
| AI 어시스턴트로 일정 삭제 | 일정 생성자 본인만 | 일정 생성자 본인만 | BR-02, BR-22 |
| AI 어시스턴트 음성 입력 | O | O | BR-23 |
| 팀채팅 음성 입력 | O | O | BR-23 |
| 업무보고 조회 권한 관리 | O | X | BR-04 |

---

## 6. 핵심 비즈니스 규칙

| ID | 규칙 |
|----|------|
| BR-01 | 모든 기능은 로그인한 사용자만 이용 가능 |
| BR-02 | 팀 일정 생성은 팀 구성원(LEADER/MEMBER) 모두 가능. 수정·삭제는 일정 생성자 본인만 가능 |
| BR-03 | 팀 가입 신청의 승인·거절은 해당 팀의 팀장(LEADER)만 수행 가능. 승인 시 신청자는 TeamMember(MEMBER)로 등록 |
| BR-04 | 팀원이 업무보고를 보낼 경우 WORK_PERFORMANCE 타입 채팅으로 전송. 팀장(LEADER)은 항상 열람 가능하며, 팀원(MEMBER)은 팀장이 권한을 부여한 경우에만 열람 가능 |
| BR-05 | 채팅 메시지는 sentAt 기준 날짜(KST)로 그룹핑하여 날짜별 조회 |
| BR-06 | 일정과 채팅은 팀 내부에서만 공유되며 타 팀에 노출되지 않음 |
| BR-07 | 로그인한 모든 사용자는 공개 팀 목록을 조회하고 원하는 팀에 가입 신청을 할 수 있음. 단, 이미 해당 팀의 구성원이거나 PENDING 상태의 신청이 존재하면 중복 신청 불가 |
| BR-08 | 포스트잇 생성은 팀 구성원(LEADER/MEMBER) 모두 가능. 수정·삭제는 생성자 본인만 가능 |
| BR-09 | 프로젝트·프로젝트 일정·세부 일정 생성은 팀 구성원(LEADER/MEMBER) 모두 가능. 수정·삭제는 생성자 본인만 가능 |
| BR-10 | 공지사항 작성은 팀 구성원(LEADER/MEMBER) 모두 가능. 삭제는 작성자 본인 또는 팀장(LEADER)만 가능 |
| BR-11 | 팀 정보 수정·삭제는 팀장(LEADER)만 가능. 팀 삭제 시 종속 데이터(TeamMember, TeamJoinRequest, Schedule, ChatMessage, Notice, Postit, Project, ProjectSchedule, SubSchedule, WorkPerformancePermission)는 CASCADE로 함께 정리 |
| BR-12 | 팀원 강제 탈퇴는 팀장(LEADER)만 가능. 팀장 본인은 강제 탈퇴 대상이 될 수 없음(요청 시 400 반환) |
| BR-13 | 자료실 글 작성은 팀 구성원(LEADER/MEMBER) 모두 가능. 수정·삭제는 작성자 본인만 가능 (`UPDATE/DELETE WHERE author_id = ?` 강제, 미일치 시 403) |
| BR-14 | 자료실 첨부파일은 ① 크기 ≤ 10MB ② MIME 화이트리스트(jpg/png/gif/webp/pdf/docx/xlsx/pptx/txt/md/zip) 통과 ③ magic-bytes 헤더 검증 통과해야 저장. 다운로드 응답엔 `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` 강제. SVG·실행파일·HTML 등은 거부 |
| BR-15 | ChatMessage·Notice·BoardPost 는 `(teamId, projectId)` 조합으로 격리. `projectId IS NULL` → 팀 일자별 컨텍스트, `projectId 채워짐` → 프로젝트 전용 컨텍스트. 두 컨텍스트 데이터가 서로 노출되지 않음 |
| BR-16 | AI 어시스턴트(찰떡) 는 사용자 자연어를 6-way(`usage` / `general` / `schedule_query` / `schedule_create` / `schedule_update` / `schedule_delete` / `blocked`) 로 자동 분류해 적절한 경로로 답변. 사용자가 모드를 직접 선택하지 않음 (단일 입력창) |
| BR-17 | AI 가 `schedule_create` 의도를 처리할 때 backend `/api/teams/:teamId/schedules` POST 를 호출. `created_by` 는 JWT 의 userId 로 강제 설정(가장 불가). `team_id` 는 frontend session 의 활성 팀에서 주입, AI 응답에서 받지 않음 |
| BR-18 | `schedule_create` 는 사용자 명시 승인(confirm 카드) 후에만 INSERT. 인자(시간/제목 등) 부족 시 후속 질문(`awaiting-input`) 으로 다중 턴 진행. 사용자가 카드 ✓ 클릭 전엔 DB 변경 0 |
| BR-19 | AI 어시스턴트는 **일정 도메인 외** 의 데이터 변경(프로젝트·채팅·공지·포스트잇·자료실) 은 거절 안내. "찰떡이는 일정 관련 작업만 도와드릴 수 있어요" 형태로 정중히 안내하고 화면에서 직접 처리하도록 유도. 일정 조회·등록·수정·삭제는 모두 지원 |
| BR-20 | AI 모델은 DB 에 직접 접근하지 않음 — 자연어 → JSON 변환까지만 수행. SQL 은 backend 의 검증된 SQL 템플릿이 작성, `withAuth`/`withTeamRole` 미들웨어가 권한 격리. 자유 SQL 생성 금지 |
| BR-21 | `schedule_update` 는 (1) 대상 일정 식별 — `/parse-schedule-query` 로 키워드·날짜 후보 좁히기, 다중이면 `awaiting-input(needs:'target')` 후속 질문 → (2) 새 일시·제목 수집 — 다중 턴 (`updateState.needs: 'new-datetime'` / `'new-title'`), `tryParseDirectDatetime` + Open WebUI LLM fallback, "그대로/유지" 패턴(`KEEP_AS_IS_RE`)은 기존값 유지 → (3) confirm 카드 → (4) ✓ 클릭 후 PATCH. 일정 생성자 본인만 가능 (BR-02 와 동일), backend `withAuth`/`withTeamRole` 와 `created_by === userId` 검증. multi-turn 상태(`updateState`) 는 클라이언트가 turn 마다 carry — 서버는 stateless |
| BR-22 | `schedule_delete` 는 (1) 대상 일정 식별 (BR-21 과 동일 메커니즘 — `parse-schedule-query` 재활용) → (2) confirm 카드 → (3) ✓ 클릭 후 DELETE. 일정 생성자 본인만 가능. 한국어 "취소"·"삭제"·"제거"·"지워"·"지운" 모두 동일 처리 (예: "회의 취소해" = "회의 일정 지워"). bulk 삭제("전체/모두/다 삭제") 는 `BULK_INTENT_RE` 로 감지해 1건씩만 가능함을 안내 |
| BR-24 | 카카오 소셜 로그인은 OAuth 2.0(OIDC) Authorization Code + PKCE + state 흐름. `POST /api/auth/oauth/kakao/start` 가 인증 URL 발급(state·code_verifier 를 OAuthState 에 저장), `GET /api/auth/oauth/kakao/callback` 이 code→token 교환·사용자 조회·계정 매칭/생성 후 우리 JWT 를 **URL fragment(#)** 로 `/auth/oauth/success` 에 전달. 매칭 규칙: ① providerUserId 매칭 → 기존 계정 로그인, ② 미매칭 + 동일 이메일 User 존재 → 자동 연결, ③ 미매칭 + 이메일 신규 → 신규 User(`password=NULL`) 생성, ④ **카카오 이메일 동의 미허락 → 가입 거절(`email_required`)**. redirectAfter 는 자도메인 절대경로만 허용(open-redirect 차단) |
| BR-25 | 프로젝트 간트차트는 `[저장]` 버튼으로 현재 화면을 SVG 파일로 내려받기 가능(`html-to-image` 의 `toSvg`). 파일명 `{프로젝트명}_{연도}.svg`, 다크모드 배경색 명시 적용(투명 배경 방지). 클라이언트 전용 기능 — 서버/DB 변경 없음 |
| BR-23 | 음성 입력(STT) 은 입력창 옆 마이크 버튼으로 토글. **AI 찰떡이 탭과 팀채팅 탭 둘 다 동일 hook(`useSpeechRecognition`) 으로 일관 적용**. 브라우저·디바이스 자동 분기: Samsung Galaxy / SM-XXXX UA / Samsung Internet / Web Speech API 미지원 환경 → 자체 호스팅 Whisper(`POST /api/stt`), 그 외 → 브라우저 내장 Web Speech API. 인식 텍스트는 입력창에 채워지고 사용자 검토 후 [전송]. 마이크 권한 거부 시 안내 토스트, 비지원 환경에선 마이크 아이콘 숨김. 모바일 캘린더 분할 화면 시 입력창 자동 포커스 억제(키보드 가림 방지) |

---

## 7. 유스케이스

| ID | 유스케이스 | 주체 | 연관 규칙 |
|----|-----------|------|-----------|
| UC-01 | 회원가입 / 로그인 | 비인증 사용자 | - |
| UC-02 | 팀 생성 (생성자는 자동으로 LEADER 등록) | 로그인 사용자 | BR-01 |
| UC-02B | 팀 공개 목록 조회 및 가입 신청 | 로그인 사용자 | BR-07 |
| UC-02C | 가입 신청 승인/거절 (나의 할 일) | 팀장 | BR-03 |
| UC-03 | 월·주·일 단위 팀 일정 조회 | 팀장, 팀원 | BR-01, BR-06 |
| UC-04 | 팀 일정 추가·수정·삭제 | 팀장 | BR-01, BR-02 |
| UC-05 | 날짜별 채팅 메시지 조회 | 팀장, 팀원 | BR-01, BR-05, BR-06 |
| UC-06 | 채팅으로 일정 변경 요청 | 팀원 | BR-01, BR-04 |
| UC-07 | 캘린더·채팅 동시 화면 조회 | 팀장, 팀원 | BR-01, BR-06 |
| UC-08 | 포스트잇 작성·수정·삭제 | 팀장, 팀원 | BR-01, BR-08 |
| UC-09 | 프로젝트(간트차트) 생성·수정·삭제 | 팀장, 팀원 | BR-01, BR-09 |
| UC-10 | 프로젝트 일정 생성·수정·삭제 | 팀장, 팀원 | BR-01, BR-09 |
| UC-11 | 세부 일정 생성·수정·삭제 | 팀장, 팀원 | BR-01, BR-09 |
| UC-12 | 공지사항 작성·삭제 | 팀장, 팀원 | BR-01, BR-10 |
| UC-13 | 업무보고 조회 권한 설정 | 팀장 | BR-01, BR-04 |
| UC-14 | 팀 정보 수정·삭제 | 팀장 | BR-01, BR-11 |
| UC-15 | 팀원 강제 탈퇴 | 팀장 | BR-01, BR-12 |
| UC-16 | 내 프로필(이름) 수정 | 로그인 사용자 | BR-01 |
| UC-17 | 프로젝트 전용 채팅 메시지 송수신 | 팀장, 팀원 | BR-01, BR-15 |
| UC-18 | 프로젝트 전용 공지사항 작성·삭제 | 팀장, 팀원 | BR-01, BR-10, BR-15 |
| UC-19 | 자료실 글 작성·수정·삭제 (첨부파일 포함) | 팀장, 팀원 | BR-01, BR-13, BR-14, BR-15 |
| UC-20 | 자료실 첨부파일 다운로드 (`GET /api/files/:fileId`) | 팀장, 팀원 | BR-01, BR-14 |
| UC-21 | AI 어시스턴트로 사용법 질문 (RAG 답변) | 로그인 사용자 | BR-01, BR-16 |
| UC-22 | AI 어시스턴트로 일반 질문 (웹 검색 답변) | 로그인 사용자 | BR-01, BR-16 |
| UC-23 | AI 어시스턴트로 일정 조회 | 팀장, 팀원 | BR-01, BR-16, BR-20 |
| UC-24 | AI 어시스턴트로 일정 등록 (confirm + 다중 턴) | 팀장, 팀원 | BR-01, BR-16, BR-17, BR-18, BR-20 |
| UC-25 | AI 어시스턴트의 거절 안내 (지원 외 도메인) | 로그인 사용자 | BR-01, BR-19 |
| UC-26 | AI 어시스턴트로 일정 수정 (대상 식별 + confirm) | 일정 생성자 | BR-01, BR-02, BR-21 |
| UC-27 | AI 어시스턴트로 일정 삭제 (대상 식별 + confirm) | 일정 생성자 | BR-01, BR-02, BR-22 |
| UC-28 | AI 어시스턴트 음성 입력 (마이크 → 텍스트) | 로그인 사용자 | BR-01, BR-23 |
| UC-29 | 카카오 계정으로 로그인 / 회원가입 | 비인증 사용자 | BR-24 |
| UC-30 | 프로젝트 간트차트 SVG 파일 저장 | 팀장, 팀원 | BR-01, BR-25 |

### 수락 조건 (Acceptance Criteria)

**UC-01 회원가입 / 로그인 / 토큰 갱신**
- Given: 미가입 사용자가 유효한 이메일·비밀번호 입력
- When: `POST /api/auth/signup` 회원가입 요청
- Then: 201 Created, 계정 생성(bcrypt 해싱 후 저장), Access Token + Refresh Token 발급
- Given: 가입된 사용자가 올바른 자격증명 입력
- When: `POST /api/auth/login` 로그인 요청
- Then: 200 OK, Access Token(15분) + Refresh Token(7일) 발급, 앱 진입 가능
- Given: Access Token 만료 + 유효한 Refresh Token 보유
- When: `POST /api/auth/refresh` 토큰 갱신 요청
- Then: 200 OK, 새 Access Token 발급 (Refresh Token 은 그대로 또는 rotation 정책에 따라 갱신)
- Given: Refresh Token 도 만료 또는 무효
- When: 갱신 요청
- Then: 401 Unauthorized, 클라이언트는 재로그인으로 유도

**UC-29 카카오 계정으로 로그인 / 회원가입**
- Given: 비인증 사용자가 로그인·회원가입 화면에서 [카카오로 시작하기] 클릭
- When: `POST /api/auth/oauth/kakao/start` → 응답 url 로 카카오 인증 페이지 이동, 동의 완료
- Then: 카카오가 `GET /api/auth/oauth/kakao/callback` 호출 → state 검증 → 계정 매칭/생성 → 우리 JWT 발급 → `/auth/oauth/success#accessToken=…` 로 302, 프론트가 토큰 저장 후 앱 진입
- Given: 카카오 동의 화면에서 이메일 제공에 동의하지 않음
- When: 콜백 처리
- Then: 가입 거절(`email_required`) — "카카오 계정 이메일 동의가 필요합니다" 안내 후 로그인 화면 복귀
- Given: 이미 동일 이메일로 가입한 사용자가 카카오로 첫 로그인
- When: 콜백 처리
- Then: 기존 User 에 OAuthAccount 자동 연결, 같은 계정으로 로그인

**UC-30 프로젝트 간트차트 SVG 파일 저장**
- Given: 팀 구성원이 프로젝트(간트차트) 화면 진입
- When: 상단 `[저장]` 버튼 클릭
- Then: 현재 간트차트가 `{프로젝트명}_{연도}.svg` 로 다운로드(다크모드 배경 적용). 서버·DB 변경 없음

**UC-02 팀 생성**
- Given: 로그인한 사용자가 유효한 팀 이름(1~100자) 입력
- When: 팀 생성 요청
- Then: 201 Created, Team 레코드 생성, 요청자가 `leaderId`로 설정됨, TeamMember(role: LEADER) 원자적 등록
- Given: 팀 이름이 빈 값이거나 100자 초과
- When: 팀 생성 요청
- Then: 400 Bad Request

**UC-02B 팀 공개 목록 조회 및 가입 신청**
- Given: 로그인한 사용자
- When: 공개 팀 목록 조회
- Then: 전체 팀 목록(팀명, 구성원 수 포함) 반환
- Given: 로그인한 사용자, 아직 구성원이 아니고 PENDING 신청도 없는 팀
- When: 가입 신청 요청
- Then: 201 Created, TeamJoinRequest(PENDING) 생성
- Given: 이미 해당 팀의 구성원이거나 PENDING 신청이 존재하는 사용자
- When: 가입 신청 요청
- Then: 409 Conflict

**UC-02C 가입 신청 승인/거절 (나의 할 일)**
- Given: LEADER 권한의 인증된 사용자
- When: `GET /api/me/tasks` 호출 (로그인 사용자가 LEADER 인 모든 팀의 PENDING 가입 신청 집계)
- Then: 200 OK, 팀별 PENDING 신청 목록 + 총 대기 건수(`totalPendingCount`) 반환. 팀장 헤더의 빨간 배지에 표시
- Given: LEADER 권한의 인증된 사용자
- When: PENDING 상태의 가입 신청에 대해 승인(APPROVE) 요청
- Then: TeamJoinRequest.status → APPROVED, TeamMember(MEMBER) 원자적 등록
- Given: LEADER 권한의 인증된 사용자
- When: PENDING 상태의 가입 신청에 대해 거절(REJECT) 요청
- Then: TeamJoinRequest.status → REJECTED, 팀 합류 미발생
- Given: MEMBER 권한의 사용자
- When: 승인/거절 또는 `/api/me/tasks` 시도
- Then: 403 Forbidden (또는 빈 목록 반환)

**UC-03 월·주·일 단위 팀 일정 조회**
- Given: 팀 구성원(LEADER/MEMBER)이 view(month/week/day)와 date 파라미터를 전달
- When: 일정 조회 요청
- Then: 해당 기간 내 팀 일정 목록 반환 (startAt 오름차순)
- Given: 팀 구성원이 아닌 사용자
- When: 일정 조회 요청
- Then: 403 Forbidden

**UC-04 팀 일정 추가·수정·삭제**
- Given: 팀 구성원(LEADER/MEMBER)이 유효한 title, startAt < endAt 입력
- When: 일정 생성 요청
- Then: 201 Created, 팀 전체에 일정 노출
- Given: 일정의 생성자 본인이 수정 요청
- When: PATCH 요청
- Then: 200 OK, 변경된 필드만 수정
- Given: 일정 생성자가 아닌 사용자
- When: 수정·삭제 시도
- Then: 403 Forbidden
- Given: endAt <= startAt
- When: 일정 생성·수정 요청
- Then: 400 Bad Request

**UC-05 날짜별 채팅 메시지 조회**
- Given: 팀 구성원이 KST 기준 날짜(YYYY-MM-DD)를 date 파라미터로 전달
- When: 메시지 조회 요청
- Then: 해당 날짜(KST 00:00~23:59) 내 메시지 목록을 sentAt 오름차순으로 반환
- Given: 팀 구성원이 아닌 사용자
- When: 메시지 조회 요청
- Then: 403 Forbidden

**UC-06 채팅으로 업무보고 전송**
- Given: 팀 구성원(LEADER/MEMBER)이 content(최대 2000자) 입력
- When: type=WORK_PERFORMANCE 메시지 전송
- Then: 채팅 이력에 저장, 팀장에게 표시
- Given: content가 2000자 초과
- When: 메시지 전송
- Then: 400 Bad Request

**UC-07 캘린더·채팅 동시 화면 조회**
- Given: 팀 구성원이 메인 화면 접근
- When: 캘린더와 채팅 패널 동시 로드
- Then: 팀 일정 목록과 당일 채팅 메시지가 함께 표시됨

**UC-08 포스트잇 작성·수정·삭제**
- Given: 팀 구성원(LEADER/MEMBER)이 날짜와 내용 입력
- When: 포스트잇 생성 요청
- Then: 201 Created, 해당 날짜에 포스트잇 등록
- Given: 포스트잇 생성자 본인
- When: 수정·삭제 요청
- Then: 200 OK, 내용 수정 또는 삭제 완료
- Given: 생성자가 아닌 사용자
- When: 수정·삭제 시도
- Then: 403 Forbidden

**UC-09 프로젝트(간트차트) 생성·수정·삭제**
- Given: 팀 구성원(LEADER/MEMBER)이 유효한 name, startDate <= endDate 입력
- When: 프로젝트 생성 요청
- Then: 201 Created, 팀에 프로젝트 등록 (progress 기본 0, phases 기본 [])
- Given: 프로젝트 생성자 본인
- When: 수정·삭제 요청
- Then: 200 OK, 변경 반영 또는 삭제 완료 (하위 project_schedules·sub_schedules CASCADE 삭제)
- Given: 생성자가 아닌 사용자
- When: 수정·삭제 시도
- Then: 403 Forbidden
- Given: endDate < startDate
- When: 생성·수정 요청
- Then: 400 Bad Request

**UC-10 프로젝트 일정 생성·수정·삭제**
- Given: 팀 구성원(LEADER/MEMBER)이 유효한 title, startDate <= endDate, 존재하는 projectId 입력
- When: 프로젝트 일정 생성 요청
- Then: 201 Created, 프로젝트 간트차트에 행으로 표시
- Given: 프로젝트 일정 생성자 본인
- When: 수정·삭제 요청
- Then: 200 OK, 변경 반영 또는 삭제 완료 (하위 sub_schedules CASCADE 삭제)
- Given: 생성자가 아닌 사용자
- When: 수정·삭제 시도
- Then: 403 Forbidden

**UC-11 세부 일정 생성·수정·삭제**
- Given: 팀 구성원(LEADER/MEMBER)이 유효한 title, startDate <= endDate, 존재하는 projectScheduleId 입력
- When: 세부 일정 생성 요청
- Then: 201 Created, 상위 프로젝트 일정 하위에 등록
- Given: 세부 일정 생성자 본인
- When: 수정·삭제 요청
- Then: 200 OK, 변경 반영 또는 삭제 완료
- Given: 생성자가 아닌 사용자
- When: 수정·삭제 시도
- Then: 403 Forbidden

**UC-12 공지사항 작성·삭제**
- Given: 팀 구성원(LEADER/MEMBER)이 content(최대 2000자) 입력
- When: 공지사항 작성 요청
- Then: 201 Created, 팀 채팅 상단에 공지 고정
- Given: 공지사항 작성자 본인 또는 팀장(LEADER)
- When: 삭제 요청
- Then: 200 OK, 공지사항 삭제
- Given: 작성자도 팀장도 아닌 사용자
- When: 삭제 시도
- Then: 403 Forbidden
- Given: content가 2000자 초과
- When: 작성 요청
- Then: 400 Bad Request

**UC-13 업무보고 조회 권한 설정**
- Given: 팀장(LEADER)이 허용할 userIds 배열 전달
- When: PATCH /work-permissions 요청
- Then: 기존 권한 전부 교체, 전달된 userIds 목록으로 권한 설정
- Given: 빈 배열([]) 전달
- When: PATCH /work-permissions 요청
- Then: 전체 권한 해제 (모든 구성원 WORK_PERFORMANCE 조회 가능)
- Given: MEMBER 권한의 사용자
- When: 권한 설정 시도
- Then: 403 Forbidden

**UC-14 팀 정보 수정·삭제**
- Given: 팀장(LEADER)이 name(최대 100자)·description·isPublic 중 1개 이상 전달
- When: 팀 정보 수정 요청
- Then: 200 OK, 전달된 필드만 갱신
- Given: 팀장(LEADER)이 자신의 팀 삭제 요청
- When: 팀 삭제 요청
- Then: 200 OK, Team 레코드 및 종속 데이터 CASCADE 삭제
- Given: MEMBER 권한의 사용자
- When: 팀 정보 수정 또는 삭제 시도
- Then: 403 Forbidden

**UC-15 팀원 강제 탈퇴**
- Given: 팀장(LEADER)이 자신의 팀에 속한 MEMBER의 userId 지정
- When: DELETE /teams/:teamId/members/:userId 요청
- Then: 200 OK, 해당 TeamMember 레코드 제거
- Given: 팀장(LEADER)이 자기 자신(leaderId)의 userId 지정
- When: 강제 탈퇴 요청
- Then: 400 Bad Request — "팀장은 탈퇴시킬 수 없습니다."
- Given: MEMBER 권한의 사용자
- When: 강제 탈퇴 시도
- Then: 403 Forbidden
- Given: 해당 팀의 멤버가 아닌 userId 지정
- When: 강제 탈퇴 요청
- Then: 404 Not Found

**UC-16 내 프로필(이름) 수정**
- Given: 로그인 사용자가 trim 후 1~50자 범위의 name 전달
- When: PATCH /api/me 요청
- Then: 200 OK, User.name 갱신
- Given: name이 빈 문자열·공백뿐이거나 50자 초과
- When: 프로필 수정 요청
- Then: 400 Bad Request

**UC-17 프로젝트 전용 채팅 메시지 송수신**
- Given: 팀 구성원이 자기 팀의 특정 projectId 컨텍스트에서 content(최대 2000자) 입력
- When: POST /api/teams/:teamId/projects/:projectId/messages 전송
- Then: 201 Created, 해당 프로젝트 채팅방에만 메시지 노출. 같은 팀의 일자별 채팅 / 다른 프로젝트 채팅엔 안 보임
- Given: 다른 팀의 projectId 또는 팀에 속하지 않은 사용자
- When: 메시지 전송·조회 시도
- Then: 403 Forbidden / 404 Not Found

**UC-18 프로젝트 전용 공지사항 작성·삭제**
- Given: 팀 구성원이 projectId 컨텍스트에서 공지 content 입력
- When: POST /api/teams/:teamId/projects/:projectId/notices
- Then: 201 Created, 해당 프로젝트 채팅방의 공지로만 노출
- Given: 작성자 본인 또는 팀장(LEADER)
- When: DELETE /api/teams/:teamId/notices/:noticeId
- Then: 200 OK
- Given: 작성자도 팀장도 아닌 사용자
- When: 삭제 시도
- Then: 403 Forbidden

**UC-19 자료실 글 작성·수정·삭제**
- Given: 팀 구성원이 multipart/form-data 로 title(1~200자), content(≤20000자), file(선택, ≤10MB, 허용 MIME) 전달
- When: POST /api/teams/:teamId/board (projectId optional)
- Then: 201 Created, BoardPost INSERT + 첨부 있을 시 검증 통과 후 저장 + BoardAttachment INSERT
- Given: title 빈 값 또는 200자 초과
- When: 작성 요청
- Then: 400 Bad Request
- Given: file 이 11MB 또는 화이트리스트 외 MIME 또는 magic-bytes 미스매치
- When: 작성 요청
- Then: 413(크기) 또는 415(형식) Bad Request
- Given: 글 작성자 본인
- When: PATCH /api/teams/:teamId/board/:postId (file 동봉 시 기존 첨부 unlink + 신규 저장)
- Then: 200 OK
- Given: 작성자가 아닌 사용자
- When: PATCH·DELETE 시도
- Then: 403 Forbidden
- Given: 작성자 본인이 글 삭제
- When: DELETE /api/teams/:teamId/board/:postId
- Then: 200 OK, BoardPost row 삭제 + CASCADE 로 BoardAttachment row 삭제 + 디스크 파일 unlink

**UC-20 자료실 첨부파일 다운로드**
- Given: 같은 팀 멤버가 GET /api/files/:fileId 요청
- When: backend 가 attachment → post → team_id 조인 후 사용자 멤버십(`withTeamRole`) 검증
- Then: 200 OK, `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` 헤더로 stream 응답 (Local) 또는 302 redirect (S3 presigned URL)
- Given: 다른 팀의 사용자
- When: 다운로드 시도
- Then: 403 Forbidden
- Given: DB 에는 row 가 있지만 storage 어댑터가 객체를 못 찾음
- When: 다운로드 시도
- Then: 410 Gone

**UC-21 AI 어시스턴트로 사용법 질문**
- Given: 로그인 사용자가 우측 "AI 버틀러" 탭에서 사용법 질문(예: "포스트잇 색깔 종류") 전송
- When: backend `/classify` 가 `intent: usage` 로 분류 → RAG `/chat` stream 모드 호출
- Then: SSE 로 첫 토큰 ~3~10초 안에 도착, 답변 카드에 "📚 공식 문서 N건 참조" 출처 뱃지 표시
- Given: 키워드 매치 실패하는 모호한 사용법 질문
- When: RAG 답변이 거절형이면
- Then: Open WebUI fallback (`fallback: rag-refused`) 으로 일반 답변 시도

**UC-22 AI 어시스턴트로 일반 질문**
- Given: 로그인 사용자가 일반 질문(예: "오늘 뉴스") 전송
- When: backend 가 `intent: general` 분류 → SearxNG 검색(5건) → 결과를 system prompt 에 inline 주입 → Open WebUI gemma4:26b 답변 stream
- Then: SSE 로 sources(URL 5건) 즉시 송출 + 답변 토큰 점진 표시. "🌐 웹 검색 N건 참조" 뱃지

**UC-23 AI 어시스턴트로 일정 조회**
- Given: 팀 구성원이 자연어 일정 조회 질문(예: "오늘 일정 알려줘", "디자인 리뷰 언제야?") 전송
- When: backend 가 `intent: schedule_query` 분류 → `/parse-schedule-query` 가 `{view, date, keyword}` 추출 → backend Schedule API GET 호출
- Then: 같은 팀의 일정만 반환(`withTeamRole` 검증), 코드가 한국어로 포맷("기획팀 팀의 2026-04-29 일정 N건: ...") 후 즉시 송출. LLM 답변 본문 생성 0회
- Given: keyword 가 있고 좁은 범위(day) 매치 0건
- When: 자동으로 month 범위로 fallback 재조회
- Then: 더 넓은 범위에서 keyword 매치 일정만 반환
- Given: 다른 팀의 일정 조회 시도(teamId 위조)
- When: backend 미들웨어 검증
- Then: 403 Forbidden

**UC-24 AI 어시스턴트로 일정 등록 (다중 턴)**
- Given: 팀 구성원이 완전한 자연어 등록 요청(예: "내일 오후 3시 주간회의 등록해줘") 전송
- When: backend 가 `intent: schedule_create` 분류 → `/parse-schedule-args` 가 `{title, startAt, endAt}` 추출 → SSE `pending-action` 이벤트로 confirm 카드 송출
- Then: 사용자가 카드 ✓ 클릭 → `/api/ai-assistant/execute` 호출 → backend Schedule POST(`created_by` = JWT userId 강제) → INSERT + 좌측 캘린더 자동 갱신
- Given: 정보 부족 요청(예: "내일 회의 등록해줘" — 시간 미명시)
- When: parser 가 `{ok:false, needs:"time", hint:"몇 시에 잡을까요?"}` 반환
- Then: SSE token 으로 hint 표시 + `awaiting-input` 이벤트. 다음 user 입력("오후 3시") 시 frontend 가 직전 미완 question 과 결합 재요청 → confirm 카드 등장
- Given: 사용자가 confirm 카드 ✗ (취소) 클릭
- When: execute 호출 안 됨
- Then: DB 변경 0, "실행을 취소했어요" 시스템 메시지

**UC-25 AI 어시스턴트의 거절 안내 (지원 외 도메인)**
- Given: 프로젝트·채팅·공지·포스트잇·자료실 관련 등록/수정/삭제 요청(예: "프로젝트 일정 추가해줘", "공지 만들어줘")
- When: `intent: blocked, subreason: other_domain` 분류
- Then: "프로젝트·채팅·공지·포스트잇·자료실 같은 작업은 화면에서 직접 처리해 주세요" 안내
- Given: 사용법 시그널("등록하는 법", "어떻게") 이 함께 있는 경우(예: "프로젝트 등록하는 법 알려줘")
- When: USAGE_KEYWORDS 우선 매칭 → `intent: usage`
- Then: blocked 가 아닌 RAG 사용법 답변

**UC-26 AI 어시스턴트로 일정 수정 (다중 턴)**
- Given: 일정 생성자가 자연어 수정 요청(예: "내일 회의 오후 4시로 옮겨줘")
- When: backend 가 `intent: schedule_update` 분류 → 대상 일정 후보를 키워드·날짜로 좁힘
- Then: 후보 1건이면 즉시 새 일시·제목 수집 단계로, 다중 후보면 "1) 14:00 회의, 2) 16:00 회의 중 어느 쪽인가요?" 후속 질문
- Given: 대상이 확정되고 새 인자 수집 완료
- When: SSE `pending-action` 으로 confirm 카드 송출
- Then: 사용자 ✓ 클릭 → `/api/ai-assistant/execute` → backend Schedule PATCH(생성자 본인 검증) → 좌측 캘린더 자동 갱신
- Given: 사용자가 해당 일정의 생성자가 아닌 경우
- When: PATCH 호출
- Then: 403 Forbidden, "이 일정은 작성자만 수정할 수 있어요" 안내

**UC-27 AI 어시스턴트로 일정 삭제 (다중 턴)**
- Given: 일정 생성자가 자연어 삭제 요청(예: "내일 디자인 리뷰 삭제해줘", "어제 회의 취소")
- When: backend 가 `intent: schedule_delete` 분류 → 대상 일정 후보 좁히기
- Then: 후보 1건이면 confirm 카드 송출, 다중 후보면 좁히기 후속 질문
- Given: confirm 카드 ✓ 클릭
- When: `/api/ai-assistant/execute` → backend Schedule DELETE(생성자 본인 검증)
- Then: 200 OK, 캘린더에서 해당 일정 제거
- Given: confirm 카드 ✗ 클릭
- When: execute 호출 안 됨
- Then: DB 변경 0, "실행을 취소했어요" 시스템 메시지

**UC-28 음성 입력 (STT) — AI 찰떡이 탭 + 팀채팅 탭 공통**
- Given: 마이크 지원 브라우저(`SpeechRecognition` 존재 또는 Whisper backend 가용)
- When: **AI 찰떡이** 또는 **팀채팅** 입력창 옆 마이크 아이콘 클릭
- Then: 권한 요청 후 녹음 시작, 아이콘이 빨간색 + pulse 애니메이션. UA 검사로 Web Speech / Whisper 자동 분기 (Galaxy/SM-XXXX/Samsung Internet → Whisper)
- Given: 사용자가 발화 후 자연스럽게 정지
- When: 침묵 감지(브라우저 기본 또는 자체 VAD) → 자동 변환
- Then: 인식 결과 텍스트가 입력창에 채워짐. 사용자가 검토·수정 후 [전송] 클릭
- Given: 모바일에서 AI 찰떡이 탭의 캘린더 분할 화면 + 마이크 입력
- When: 음성 인식 결과 도착·전송·응답 출력 모든 단계
- Then: 입력창에 자동 포커스 가지 않음 → 시스템 키보드 표시 안 됨 → 화면 절반 가림 방지
- Given: 마이크 권한 거부
- When: 사용자가 권한 거부 또는 시스템에서 거부
- Then: 안내 토스트 "마이크 권한이 필요합니다", 마이크 아이콘 원래 상태로 복귀
- Given: 음성 인식 미지원 브라우저(Firefox 등에서 Whisper 도 비가용)
- When: 컴포넌트 마운트
- Then: 마이크 아이콘 자체가 렌더되지 않음 (feature detection)

---

## 8. 엔티티 CRUD 매핑

| 엔티티 | 생성 | 조회 | 수정 | 삭제 |
|--------|------|------|------|------|
| User | UC-01 | UC-01 | UC-16 | - |
| Team | UC-02 | UC-02B, UC-03, UC-07 | UC-14 | UC-14 |
| TeamMember | UC-02, UC-02C | UC-03 | - | UC-15 |
| TeamJoinRequest | UC-02B | UC-02C | UC-02C | - |
| Schedule | UC-04, UC-24 | UC-03, UC-07, UC-23 | UC-04, UC-26 | UC-04, UC-27 |
| ChatMessage | UC-05, UC-06, UC-17 | UC-05, UC-07, UC-17 | - | - |
| Postit | UC-08 | UC-08 | UC-08 | UC-08 |
| WorkPerformancePermission | UC-13 | UC-13 | UC-13 | - |
| Project | UC-09 | UC-09 | UC-09 | UC-09 |
| ProjectSchedule | UC-10 | UC-10 | UC-10 | UC-10 |
| SubSchedule | UC-11 | UC-11 | UC-11 | UC-11 |
| Notice | UC-12, UC-18 | UC-12, UC-18 | - | UC-12, UC-18 |
| BoardPost | UC-19 | UC-19 | UC-19 | UC-19 |
| BoardAttachment | UC-19 | UC-20 | - | UC-19 (CASCADE) |

---

## 9. 비기능 요구사항

| 항목 | 기준 |
|------|------|
| 채팅 메시지 응답 시간 | 500ms 이하 |
| 채팅 폴링 주기 | 3초 (TanStack Query `refetchInterval`) |
| 자료실 첨부파일 크기 | 단일 파일 ≤ 10MB. 글당 첨부 1개(1단계) |
| 자료실 storage backend | env `STORAGE_BACKEND` 토글 — `local`(1단계, 호스트 mount) / `s3`(운영 전환). 호출처 코드 변경 0건으로 swap |
| 동시 접속 팀원 | 팀당 최소 50명 지원 |
| 인증 토큰 방식 | JWT — Access Token + Refresh Token (`Bearer` 헤더) |
| JWT 만료 정책 | Access 15분 (`JWT_ACCESS_EXPIRES_IN`) / Refresh 7일 (`JWT_REFRESH_EXPIRES_IN`). 만료 시 `POST /api/auth/refresh` 로 Access 갱신 |
| 비밀번호 저장 | bcrypt 해싱 필수 (`bcryptjs`) |
| 타임존 | 서버 기준 KST (UTC+9) |
| 배포 환경 | Docker Compose 단일 호스트 (postgres / backend / frontend / nginx / open-webui / searxng). Vercel 가정 폐기 |
| AI 모델 | Ollama gemma4:26b (num_ctx 32K, think:false), nomic-embed-text 임베딩 |
| AI 인프라 | RAG 서버(:8787) + Open WebUI(:8081) + SearxNG(:8080) + Whisper STT(:9001) — 모두 컨테이너. RAG 인덱스는 `ollama/*.md` 공식 문서 chunk + 임베딩 + BM25 통계. 임베딩 모델은 CPU 분리(`nomic-embed-text`) — 채팅 모델 VRAM 점유 최적화 |
| AI 답변 SSE 스트리밍 | 첫 토큰 ~3~10초 목표. 일정 조회는 코드 포맷이라 즉시 응답 |
| AI DB 접근 제약 | AI 자유 SQL 금지. backend SQL 템플릿 + `withAuth`/`withTeamRole` 미들웨어 통과만 허용 (자세한 흐름·안전장치는 `docs/17-ai-db-guide.md`) |
| 음성 입력(STT) | 브라우저 자동 분기 — Web Speech API(노트북 Chrome·iOS Safari·일반 Android) / Whisper(Galaxy/Samsung Internet/Firefox 등). Whisper 는 `onerahmet/openai-whisper-asr-webservice` 컨테이너, `faster_whisper` 엔진 + KST 도메인 어휘 initial_prompt + VAD filter |
| 모바일 UX | 캘린더 좌우 swipe(threshold 50px), 슬라이드 인 애니메이션(280ms cubic-bezier). useBreakpoint hook 으로 `isMobile`(<640px) / `isDesktop`(≥1024px) 분기. 일정 모달·포스트잇·채팅 입력 컴팩트 스타일 자동 적용 |
| Frontend 핵심 라이브러리 | React 19 + Next.js 16 (Turbopack), TanStack Query 5(서버 상태·폴링·optimistic update), Zustand 5(클라이언트 전역 상태), Lucide React(아이콘), Tailwind CSS(스타일) |
| Backend 핵심 라이브러리 | Next.js 16 API Routes(App Router), pg 8(node-postgres), bcryptjs(해싱), jsonwebtoken(JWT), swagger-ui-react(API 문서 페이지) |
| API 문서 | `swagger-ui-react` 기반 운영 — backend 가 OpenAPI 스펙 호스팅 (자세한 명세는 `docs/7-api-spec.md`) |

---

## 10. 관련 문서

| 문서 | 경로 |
|------|------|
| ERD | docs/6-erd.md |
| API 명세 | docs/7-api-spec.md |
| 사용자 시나리오 | docs/3-user-scenarios.md |
| 시스템 아키텍처 | docs/5-tech-arch-diagram.md |
| RAG 파이프라인 | docs/13-RAG-pipeline-guide.md |
| Open WebUI + SearxNG 통합 | docs/14-Open-WebUI-plan.md |
| Docker 컨테이너 인프라 | docs/15-docker-container-gen.md |
| AI 4-way 의도 분류 + MCP 통합 결정 | docs/16-mcp-server-plan.md |
| AI 모델의 DB 접근 흐름 | docs/17-ai-db-guide.md |
| 자료실(게시판) 가이드 | docs/18-board-guide.md |
| 음성 입력(STT) 가이드 | docs/22-voice-input.md |
| 임베딩 모델 CPU 분리 가이드 | docs/embeding-cpu.md |
| 배포 가이드 (STT 챕터 포함) | docs/20-easy-deploy.md |
