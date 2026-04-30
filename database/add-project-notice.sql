-- 프로젝트별 전용 공지 — notices 에 project_id 컬럼 + 부분 인덱스 추가
-- 기존 행은 project_id=NULL (팀 공지)로 보존.
-- 실행: docker exec -i postgres-db psql -U teamworks-manager -d teamworks < database/add-project-notice.sql

BEGIN;

ALTER TABLE notices
    ADD COLUMN IF NOT EXISTS project_id UUID NULL REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notices_project_id
    ON notices(project_id) WHERE project_id IS NOT NULL;

COMMIT;

-- 검증
\d notices
SELECT 'project 공지' AS k, count(*) FROM notices WHERE project_id IS NOT NULL
UNION ALL SELECT '팀 공지', count(*) FROM notices WHERE project_id IS NULL;
