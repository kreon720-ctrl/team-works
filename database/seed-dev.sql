-- =============================================
-- TEAM WORKS — Dev Seed Data
--
-- 목적: 깨끗한 DB 위에 개발·시연용 테스트 데이터를 한 번에 채움.
--
-- 전제: schema.sql (또는 reset-and-reapply.sql + add-postits.sql + add-board.sql)
--       이 먼저 적용되어 14 테이블이 모두 비어있는 상태.
--
-- 실행:
--   docker exec -i postgres-db psql -U teamworks-manager -d teamworks \
--     < database/seed-dev.sql
--
-- 모든 사용자 비밀번호: ABC123!@#  (bcrypt $2b$12$ ...)
-- 메인 운영자: dev0@naver.com (기획팀 LEADER)
-- =============================================

-- =====================
-- 1) USERS (8명)
-- =====================
-- 비밀번호 ABC123!@# 의 bcrypt 해시 — 모든 계정 동일.
INSERT INTO users (id, email, name, password_hash, created_at) VALUES
  ('d8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', 'dev0@naver.com', '기획팀장', '$2b$12$Qb0C1SHfqDDNZ3PTT5E5S.5Tn1oo8lmxTLD99OnIAWNDmw0WwLZKa', NOW() - INTERVAL '30 days'),
  ('11111111-1111-1111-1111-111111111111', 'dev1@naver.com', '김민수',   '$2b$12$Qb0C1SHfqDDNZ3PTT5E5S.5Tn1oo8lmxTLD99OnIAWNDmw0WwLZKa', NOW() - INTERVAL '28 days'),
  ('22222222-2222-2222-2222-222222222222', 'dev2@naver.com', '이서연',   '$2b$12$Qb0C1SHfqDDNZ3PTT5E5S.5Tn1oo8lmxTLD99OnIAWNDmw0WwLZKa', NOW() - INTERVAL '27 days'),
  ('33333333-3333-3333-3333-333333333333', 'dev3@naver.com', '박지훈',   '$2b$12$Qb0C1SHfqDDNZ3PTT5E5S.5Tn1oo8lmxTLD99OnIAWNDmw0WwLZKa', NOW() - INTERVAL '26 days'),
  ('44444444-4444-4444-4444-444444444444', 'dev4@naver.com', '정수아',   '$2b$12$Qb0C1SHfqDDNZ3PTT5E5S.5Tn1oo8lmxTLD99OnIAWNDmw0WwLZKa', NOW() - INTERVAL '25 days'),
  (gen_random_uuid(),                       'demo1@naver.com', '최민지', '$2b$12$Qb0C1SHfqDDNZ3PTT5E5S.5Tn1oo8lmxTLD99OnIAWNDmw0WwLZKa', NOW() - INTERVAL '2 days'),
  (gen_random_uuid(),                       'demo2@naver.com', '강도윤', '$2b$12$Qb0C1SHfqDDNZ3PTT5E5S.5Tn1oo8lmxTLD99OnIAWNDmw0WwLZKa', NOW() - INTERVAL '1 day'),
  (gen_random_uuid(),                       'demo3@naver.com', '윤하늘', '$2b$12$Qb0C1SHfqDDNZ3PTT5E5S.5Tn1oo8lmxTLD99OnIAWNDmw0WwLZKa', NOW());

-- =====================
-- 2) TEAMS (4개)
-- =====================
INSERT INTO teams (id, name, description, is_public, leader_id, created_at) VALUES
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '기획팀',   '프로그램 개발을 기획하고 설계하는 팀입니다.',          true, 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', NOW() - INTERVAL '4 days'),
  (gen_random_uuid(),                       '디자인팀', '브랜드와 프로덕트 디자인을 책임지는 팀입니다.',       true, '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '14 days'),
  (gen_random_uuid(),                       '백엔드팀', '서버 아키텍처와 API 를 설계·운영합니다.',           true, '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '21 days'),
  (gen_random_uuid(),                       '마케팅팀', '캠페인 기획과 그로스 실험을 진행합니다.',            true, '44444444-4444-4444-4444-444444444444', NOW() - INTERVAL '7 days');

-- =====================
-- 3) TEAM MEMBERS (10명)
-- =====================
-- 기획팀: dev0(LEADER) + dev1~4(MEMBER)
INSERT INTO team_members (team_id, user_id, role, created_at) VALUES
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', 'LEADER', NOW() - INTERVAL '4 days'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '11111111-1111-1111-1111-111111111111', 'MEMBER', NOW() - INTERVAL '4 days'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '22222222-2222-2222-2222-222222222222', 'MEMBER', NOW() - INTERVAL '4 days'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '33333333-3333-3333-3333-333333333333', 'MEMBER', NOW() - INTERVAL '4 days'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '44444444-4444-4444-4444-444444444444', 'MEMBER', NOW() - INTERVAL '4 days');

-- 다른 팀의 LEADER 자동 등록
INSERT INTO team_members (team_id, user_id, role, created_at)
SELECT t.id, t.leader_id, 'LEADER', t.created_at
FROM teams t WHERE t.name IN ('디자인팀', '백엔드팀', '마케팅팀');

-- dev0 을 디자인팀·백엔드팀에도 MEMBER 로 추가 (멀티팀 데모)
INSERT INTO team_members (team_id, user_id, role, created_at)
SELECT t.id, 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', 'MEMBER', t.created_at
FROM teams t WHERE t.name IN ('디자인팀', '백엔드팀');

-- =====================
-- 4) JOIN REQUESTS (3건 PENDING)
-- =====================
INSERT INTO team_join_requests (team_id, requester_id, status, requested_at)
SELECT 'cb54ef44-c30e-4933-96e6-95cc0dde8473', u.id, 'PENDING', NOW() - (random() * INTERVAL '36 hours')
FROM users u WHERE u.email IN ('demo1@naver.com', 'demo2@naver.com', 'demo3@naver.com');

-- =====================
-- 5) PROJECTS (2개)
-- =====================
INSERT INTO projects (id, team_id, created_by, name, description, start_date, end_date, progress, manager, phases, created_at, updated_at) VALUES
  ('aaaaaaaa-0001-0000-0000-000000000001', 'cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3',
   '신규 대시보드 개발', '내부 운영팀용 통합 대시보드 1차 출시', '2026-05-01', '2026-06-30', 15, '기획팀장',
   '[{"id":"p1","name":"기획"},{"id":"p2","name":"디자인"},{"id":"p3","name":"개발"},{"id":"p4","name":"검증"}]'::jsonb,
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  ('aaaaaaaa-0001-0000-0000-000000000002', 'cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3',
   '온보딩 흐름 개선', '신규 사용자 7일 리텐션 +10% 목표', '2026-05-15', '2026-07-15', 0, '기획팀장',
   '[{"id":"p1","name":"리서치"},{"id":"p2","name":"실험설계"},{"id":"p3","name":"적용"}]'::jsonb,
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');

-- 프로젝트 일정 (간트차트)
INSERT INTO project_schedules (project_id, team_id, created_by, title, color, start_date, end_date, leader, progress) VALUES
  ('aaaaaaaa-0001-0000-0000-000000000001', 'cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '요구사항 정의',     'amber',   '2026-05-01', '2026-05-10', '김민수', 30),
  ('aaaaaaaa-0001-0000-0000-000000000001', 'cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', 'UI/UX 디자인',     'rose',    '2026-05-08', '2026-05-22', '이서연', 0),
  ('aaaaaaaa-0001-0000-0000-000000000001', 'cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '백엔드 API 개발',  'emerald', '2026-05-15', '2026-06-15', '박지훈', 0),
  ('aaaaaaaa-0001-0000-0000-000000000001', 'cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '프론트엔드 구현',  'indigo',  '2026-05-20', '2026-06-20', '정수아', 0),
  ('aaaaaaaa-0001-0000-0000-000000000001', 'cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', 'QA 및 베타 출시',  'blue',    '2026-06-15', '2026-06-30', '기획팀장', 0);

-- =====================
-- 6) SCHEDULES (4월 16일 ~ 5월 22일, 21건) — KST
-- =====================
INSERT INTO schedules (team_id, created_by, title, description, color, start_at, end_at) VALUES
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '디자인 회의',         NULL, 'rose',    '2026-04-16 13:00:00', '2026-04-16 14:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '전체 회의',           NULL, 'indigo',  '2026-04-17 14:00:00', '2026-04-17 15:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '점심 일정',           NULL, 'amber',   '2026-04-21 09:00:00', '2026-04-21 10:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '직원 점심',           NULL, 'amber',   '2026-04-22 08:00:00', '2026-04-22 09:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '점심 일정',           NULL, 'amber',   '2026-04-23 08:00:00', '2026-04-23 09:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '전체회의',            NULL, 'indigo',  '2026-04-23 10:00:00', '2026-04-23 11:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '기획팀 전체회의',     NULL, 'indigo',  '2026-04-24 12:00:00', '2026-04-24 13:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '주간 정기 회의',      NULL, 'indigo',  '2026-04-28 12:00:00', '2026-04-28 13:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '디자인 리뷰',         NULL, 'rose',    '2026-04-29 08:00:00', '2026-04-29 10:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '백로그 그루밍',       NULL, 'amber',   '2026-04-30 07:00:00', '2026-04-30 09:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '신체검사',            NULL, 'indigo',  '2026-05-01 08:00:00', '2026-05-01 09:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '스프린트 데모',       '4월 스프린트 산출물 시연', 'emerald', '2026-05-01 11:00:00', '2026-05-01 12:30:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '점심약속',            NULL, 'indigo',  '2026-05-01 11:00:00', '2026-05-01 12:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '주간회의',            NULL, 'indigo',  '2026-05-01 12:00:00', '2026-05-01 13:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '전체 회의',           NULL, 'indigo',  '2026-05-02 11:00:00', '2026-05-02 12:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '신규 프로젝트 킥오프', NULL, 'indigo',  '2026-05-04 08:00:00', '2026-05-04 09:30:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '전체 회의',           NULL, 'indigo',  '2026-05-05 12:00:00', '2026-05-05 13:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '사용자 인터뷰',       NULL, 'indigo',  '2026-05-06 13:00:00', '2026-05-06 15:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '디자인 리뷰',         NULL, 'indigo',  '2026-05-07 12:00:00', '2026-05-07 13:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '고객 미팅',           NULL, 'indigo',  '2026-05-08 12:30:00', '2026-05-08 13:30:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '점심식사',            NULL, 'indigo',  '2026-05-22 14:00:00', '2026-05-22 15:00:00');

-- =====================
-- 7) POSTITS (8개, 5색 분포)
-- =====================
INSERT INTO postits (team_id, created_by, date, color, content) VALUES
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '2026-04-08', 'amber',   '약국 방문'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '2026-04-08', 'emerald', '집에가기'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '2026-04-16', 'blue',    E'디자인 회의는 모두 참석\n1시간 전에 회의장 예약 확인'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '2026-05-01', 'rose',    '데모 자료 USB 챙기기'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '2026-05-04', 'indigo',  '킥오프 전 PRD 한 번 더 읽기'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '11111111-1111-1111-1111-111111111111', '2026-05-07', 'amber',   '디자인 리뷰 시안 인쇄'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '22222222-2222-2222-2222-222222222222', '2026-05-08', 'emerald', '거래처 미팅 자료 챙기기'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '33333333-3333-3333-3333-333333333333', '2026-05-12', 'blue',    'API 스키마 PR 리뷰 받기');

-- =====================
-- 8) CHAT MESSAGES (12건 — 일반 9 + 업무보고 3)
-- =====================
INSERT INTO chat_messages (team_id, sender_id, type, content, sent_at) VALUES
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', 'NORMAL', '여러분 환영합니다! 이번 주부터 본격적으로 신규 대시보드 개편 시작할게요.', '2026-04-27 16:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '11111111-1111-1111-1111-111111111111', 'NORMAL', '@all PRD 초안 노션에 올렸어요. 내일 회의 전에 한 번씩 봐주시면 좋겠습니다 🙇‍♂️', '2026-04-27 17:30:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '22222222-2222-2222-2222-222222222222', 'NORMAL', '와이어프레임 1차안 내일 디자인 리뷰 때 공유할게요!', '2026-04-27 21:15:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '33333333-3333-3333-3333-333333333333', 'NORMAL', 'API 스키마 초안 오늘 내로 정리해서 PR 올리겠습니다.', '2026-04-27 23:40:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '44444444-4444-4444-4444-444444444444', 'NORMAL', '디자인 토큰 정리 끝났어요. 컴포넌트는 내일부터 본격적으로 작업합니다.', '2026-04-28 00:30:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', 'NORMAL', '내일 14시 정기 회의 잊지 마세요. 안건은 채팅창 고정해 둘게요.', '2026-04-28 01:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', 'NORMAL', '업무 마무리 해주세요', '2026-04-29 12:54:50'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', 'WORK_PERFORMANCE', '디자인 리뷰 회의 결과 보고 드립니다.', '2026-04-29 12:55:13'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', 'WORK_PERFORMANCE', '열심히 했음', '2026-04-29 15:52:05'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '11111111-1111-1111-1111-111111111111', 'NORMAL', '오늘 그루밍 끝나면 이번 주는 마무리네요. 다들 수고 많으셨어요 👏', '2026-04-30 18:10:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', '22222222-2222-2222-2222-222222222222', 'NORMAL', '하이파이 시안 5월 8일부터 시작할 예정이에요. 디자인 리소스 공유는 피그마로!', '2026-04-30 21:00:00'),
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', 'WORK_PERFORMANCE',
   E'[2분기 OKR 1주차 진행]\n- 사용자 리서치 인터뷰 5건 완료\n- 와이어프레임 1차안 공유 → 피드백 반영중\n- 다음주 목표: 하이파이 시안 1차안',
   '2026-05-01 13:38:00');

-- =====================
-- 9) NOTICES (1건)
-- =====================
INSERT INTO notices (team_id, sender_id, content, created_at) VALUES
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3', '음주 단속 중입니다. 주의하세요', '2026-04-30 17:51:00');

-- =====================
-- 10) BOARD POSTS (1건)
-- =====================
INSERT INTO board_posts (team_id, author_id, title, content, created_at) VALUES
  ('cb54ef44-c30e-4933-96e6-95cc0dde8473', 'd8402697-ebbc-4e69-a8d0-4dd8d73cc1f3',
   '업무처리 요령 안내',
   E'업무 메뉴얼 입니다.\r\n신고안내시 꼭 참고하세요',
   '2026-04-29 19:08:48');

-- =====================
-- Done
-- =====================
SELECT 'TEAM WORKS dev seed complete — users 8 / teams 4 / schedules 21 / postits 8 / chat 12 / notices 1 / board 1 / projects 2 / project_schedules 5 / join_requests 3' AS result;
