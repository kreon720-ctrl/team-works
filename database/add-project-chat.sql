-- 프로젝트별 전용 채팅 — chat_messages 에 project_id 컬럼 + 인덱스 추가
-- 기존 행은 project_id=NULL (팀 일자별 채팅)으로 그대로 보존.
-- 실행: docker exec -i postgres-db psql -U teamworks-manager -d teamworks < database/add-project-chat.sql

BEGIN;

ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS project_id UUID NULL REFERENCES projects(id) ON DELETE CASCADE;

-- 부분 인덱스 — project_id IS NULL 행은 제외해 인덱스 크기 최소화.
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_id_sent_at
    ON chat_messages(project_id, sent_at DESC) WHERE project_id IS NOT NULL;

COMMIT;

-- 검증
\d chat_messages
SELECT 'project_id 채워진 행' AS k, count(*) FROM chat_messages WHERE project_id IS NOT NULL
UNION ALL SELECT 'project_id NULL 행', count(*) FROM chat_messages WHERE project_id IS NULL;
