-- 일정 종료시각 선택 입력 마이그레이션
-- 적용 일자: 2026-05-14
-- 변경: schedules.end_at 을 NOT NULL → NULLABLE 로, CHECK 제약을 null 허용으로
--
-- 안전성:
--   - DROP NOT NULL: 기존 NOT NULL 데이터 손실 없음
--   - 새 CHECK 제약: 기존 데이터(end_at > start_at) 모두 통과
--   - 인덱스 idx_schedules_team_id_end_at: 그대로 유지 (B-tree 가 NULL 도 저장)

BEGIN;

-- 1. NOT NULL 해제
ALTER TABLE schedules ALTER COLUMN end_at DROP NOT NULL;

-- 2. CHECK 제약 교체 — null 허용
ALTER TABLE schedules DROP CONSTRAINT chk_schedules_end_after_start;
ALTER TABLE schedules ADD CONSTRAINT chk_schedules_end_after_start
  CHECK (end_at IS NULL OR end_at > start_at);

COMMIT;
