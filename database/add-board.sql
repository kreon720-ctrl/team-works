-- 자료실 게시판 — board_posts + board_attachments 두 테이블 신규.
-- 실행: docker exec -i postgres-db psql -U teamworks-manager -d teamworks < database/add-board.sql

BEGIN;

CREATE TABLE IF NOT EXISTS board_posts (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    project_id  UUID         NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_id   UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title       VARCHAR(200) NOT NULL,
    content     TEXT         NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT chk_board_posts_title   CHECK (char_length(title) BETWEEN 1 AND 200),
    CONSTRAINT chk_board_posts_content CHECK (char_length(content) <= 20000)
);
CREATE INDEX IF NOT EXISTS idx_board_posts_team_id_created_at
    ON board_posts(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_posts_project_id_created_at
    ON board_posts(project_id, created_at DESC) WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS board_attachments (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id       UUID         NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    stored_name   VARCHAR(64)  NOT NULL,
    mime_type     VARCHAR(100) NOT NULL,
    size_bytes    BIGINT       NOT NULL,
    uploaded_at   TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT chk_board_attachments_size CHECK (size_bytes > 0 AND size_bytes <= 10485760)
);
CREATE INDEX IF NOT EXISTS idx_board_attachments_post_id ON board_attachments(post_id);

COMMIT;

-- 검증
\d board_posts
\d board_attachments
