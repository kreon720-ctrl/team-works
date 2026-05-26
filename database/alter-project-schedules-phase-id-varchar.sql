-- project_schedules.phase_id UUID → VARCHAR(64) 마이그레이션
-- 적용 일자: 2026-05-14
--
-- 배경: projects.phases (JSONB) 안의 phase id 는 자유 형식 (시드 데이터는
--       "p1","p2","리서치" 같은 짧은 id 사용). project_schedules.phase_id 가
--       UUID 컬럼이라 짧은 id 와 충돌해 일정 추가 실패 ("invalid input syntax for type uuid: p1").
--
-- 안전성:
--   - 기존 phase_id 데이터 (UUID) 도 그대로 36자 문자열로 저장됨 (USING phase_id::text)
--   - 길이 검증은 backend PHASE_ID_RE (/^[a-zA-Z0-9_-]{1,64}$/) 가 담당
--   - VARCHAR(64) 라 UUID(36) + 시드 짧은 id 모두 충분

BEGIN;

ALTER TABLE project_schedules
  ALTER COLUMN phase_id TYPE VARCHAR(64)
  USING phase_id::text;

COMMIT;
