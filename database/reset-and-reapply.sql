-- =============================================
-- TEAM WORKS — Database Reset & Re-apply Script (Core)
--
-- 목적: 전체 테이블·인덱스를 깨끗하게 지우고 핵심 11개 테이블을 재생성.
--       데이터는 모두 사라짐 — 운영 환경 주의.
--
-- ⚠️ 이 스크립트는 코어 테이블만 만듭니다. 다음 add-*.sql 도 순서대로
--    실행해야 전체 기능이 동작합니다:
--      1) database/reset-and-reapply.sql   (이 파일 — 코어 11 테이블)
--      2) database/add-postits.sql         (포스트잇)
--      3) database/add-board.sql           (자료실 board_posts + board_attachments)
--
-- 실행 (3개 모두):
--   docker exec -i postgres-db psql -U teamworks-manager -d teamworks \
--     < database/reset-and-reapply.sql
--   docker exec -i postgres-db psql -U teamworks-manager -d teamworks \
--     < database/add-postits.sql
--   docker exec -i postgres-db psql -U teamworks-manager -d teamworks \
--     < database/add-board.sql
--
-- 한 번에 적용하려면 schema.sql 사용 (최종 상태 단일 파일).
-- =============================================

-- =====================
-- 1. DROP — 의존성 역순으로 (add-*.sql 의 테이블도 함께 정리)
-- =====================
DROP TABLE IF EXISTS board_attachments         CASCADE;
DROP TABLE IF EXISTS board_posts               CASCADE;
DROP TABLE IF EXISTS notices                   CASCADE;
DROP TABLE IF EXISTS work_performance_permissions CASCADE;
DROP TABLE IF EXISTS chat_messages             CASCADE;
DROP TABLE IF EXISTS postits                   CASCADE;
DROP TABLE IF EXISTS calendar_event_mappings   CASCADE;
DROP TABLE IF EXISTS team_calendar_integrations CASCADE;
DROP TABLE IF EXISTS schedules                 CASCADE;
DROP TABLE IF EXISTS sub_schedules             CASCADE;
DROP TABLE IF EXISTS project_schedules         CASCADE;
DROP TABLE IF EXISTS projects                  CASCADE;
DROP TABLE IF EXISTS team_join_requests        CASCADE;
DROP TABLE IF EXISTS team_members              CASCADE;
DROP TABLE IF EXISTS teams                     CASCADE;
DROP TABLE IF EXISTS oauth_state               CASCADE;
DROP TABLE IF EXISTS oauth_accounts            CASCADE;
DROP TABLE IF EXISTS users                     CASCADE;

DROP EXTENSION IF EXISTS "pgcrypto";

-- =====================
-- 2. EXTENSIONS
-- =====================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================
-- 3. TABLES — 의존성 정순으로
-- =====================

-- 1) users
CREATE TABLE IF NOT EXISTS users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL,
    name          VARCHAR(50)  NOT NULL,
    password_hash VARCHAR(255) NULL,  -- OAuth(카카오·구글) 전용 사용자는 NULL 허용
    terms_accepted_at   TIMESTAMP NULL,
    privacy_accepted_at TIMESTAMP NULL,
    terms_version       VARCHAR(20) NULL,
    privacy_version     VARCHAR(20) NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_email UNIQUE (email)
);

-- 1-a) oauth_accounts — 카카오·구글 등 외부 인증 연결
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider          VARCHAR(20)  NOT NULL,
    provider_user_id  VARCHAR(255) NOT NULL,
    provider_email    VARCHAR(255) NULL,
    provider_name     VARCHAR(255) NULL,
    provider_picture  TEXT         NULL,
    linked_at         TIMESTAMP    NOT NULL DEFAULT now(),
    last_login_at     TIMESTAMP    NULL,
    CONSTRAINT chk_oauth_provider CHECK (provider IN ('kakao', 'google')),
    CONSTRAINT uq_oauth_provider_pid UNIQUE (provider, provider_user_id),
    CONSTRAINT uq_oauth_user_provider UNIQUE (user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_oauth_user_id ON oauth_accounts(user_id);

-- 1-b) oauth_state — OAuth start ↔ callback 사이 state·PKCE verifier 임시 저장
CREATE TABLE IF NOT EXISTS oauth_state (
    state          VARCHAR(64)  PRIMARY KEY,
    code_verifier  VARCHAR(128) NOT NULL,
    redirect_after VARCHAR(255) NULL,
    user_id        UUID         NULL REFERENCES users(id) ON DELETE CASCADE,
    terms_accepted BOOLEAN      NOT NULL DEFAULT false,
    privacy_accepted BOOLEAN    NOT NULL DEFAULT false,
    terms_version  VARCHAR(20)  NULL,
    privacy_version VARCHAR(20) NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_state_created ON oauth_state(created_at);
CREATE INDEX IF NOT EXISTS idx_oauth_state_user_id ON oauth_state(user_id);

-- 2) teams
CREATE TABLE IF NOT EXISTS teams (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    description TEXT         NULL,
    is_public   BOOLEAN      NOT NULL DEFAULT false,
    leader_id   UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMP    NOT NULL DEFAULT now()
);

-- 3) team_members
CREATE TABLE IF NOT EXISTS team_members (
    team_id    UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL,
    created_at TIMESTAMP   NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, user_id),
    CONSTRAINT chk_team_members_role CHECK (role IN ('LEADER', 'MEMBER'))
);

-- 4) team_join_requests
CREATE TABLE IF NOT EXISTS team_join_requests (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id      UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    requester_id UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requested_at TIMESTAMP   NOT NULL DEFAULT now(),
    responded_at TIMESTAMP   NULL,
    CONSTRAINT chk_team_join_requests_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

-- 5) projects — chat_messages·notices·board_posts 가 참조하므로 먼저 생성
CREATE TABLE IF NOT EXISTS projects (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by  UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name        VARCHAR(200) NOT NULL,
    description TEXT         NULL,
    start_date  DATE         NOT NULL,
    end_date    DATE         NOT NULL,
    progress    INTEGER      NOT NULL DEFAULT 0,
    manager     VARCHAR(100) NOT NULL DEFAULT '',
    phases      JSONB        NOT NULL DEFAULT '[]',
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT chk_projects_end_after_start CHECK (end_date >= start_date),
    CONSTRAINT chk_projects_progress        CHECK (progress BETWEEN 0 AND 100)
);

-- 6) project_schedules
CREATE TABLE IF NOT EXISTS project_schedules (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    team_id     UUID         NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
    created_by  UUID         NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
    title       VARCHAR(200) NOT NULL,
    description TEXT         NULL,
    color       VARCHAR(20)  NOT NULL DEFAULT 'indigo',
    start_date  DATE         NOT NULL,
    end_date    DATE         NOT NULL,
    leader      VARCHAR(100) NOT NULL DEFAULT '',
    progress    INTEGER      NOT NULL DEFAULT 0,
    is_delayed  BOOLEAN      NOT NULL DEFAULT false,
    -- phase_id 는 projects.phases(JSONB) 의 id 참조 — "p1"·"리서치" 같은 짧은 문자열도 허용
    phase_id    VARCHAR(64)  NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT chk_project_schedules_end_after_start CHECK (end_date >= start_date),
    CONSTRAINT chk_project_schedules_progress        CHECK (progress BETWEEN 0 AND 100),
    CONSTRAINT chk_project_schedules_color           CHECK (color IN ('indigo', 'blue', 'emerald', 'amber', 'rose'))
);

-- 7) sub_schedules
CREATE TABLE IF NOT EXISTS sub_schedules (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_schedule_id UUID         NOT NULL REFERENCES project_schedules(id) ON DELETE CASCADE,
    project_id          UUID         NOT NULL REFERENCES projects(id)          ON DELETE CASCADE,
    team_id             UUID         NOT NULL REFERENCES teams(id)             ON DELETE CASCADE,
    created_by          UUID         NOT NULL REFERENCES users(id)             ON DELETE RESTRICT,
    title               VARCHAR(200) NOT NULL,
    description         TEXT         NULL,
    color               VARCHAR(20)  NOT NULL DEFAULT 'indigo',
    start_date          DATE         NOT NULL,
    end_date            DATE         NOT NULL,
    leader              VARCHAR(100) NOT NULL DEFAULT '',
    progress            INTEGER      NOT NULL DEFAULT 0,
    is_delayed          BOOLEAN      NOT NULL DEFAULT false,
    created_at          TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT chk_sub_schedules_end_after_start CHECK (end_date >= start_date),
    CONSTRAINT chk_sub_schedules_progress        CHECK (progress BETWEEN 0 AND 100),
    CONSTRAINT chk_sub_schedules_color           CHECK (color IN ('indigo', 'blue', 'emerald', 'amber', 'rose'))
);

-- 8) schedules — 일반 캘린더 일정
CREATE TABLE IF NOT EXISTS schedules (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by  UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title       VARCHAR(200) NOT NULL,
    description TEXT         NULL,
    color       VARCHAR(20)  NOT NULL DEFAULT 'indigo',
    start_at    TIMESTAMP    NOT NULL,
    end_at      TIMESTAMP    NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT chk_schedules_end_after_start CHECK (end_at IS NULL OR end_at > start_at),
    CONSTRAINT chk_schedules_color           CHECK (color IN ('indigo', 'blue', 'emerald', 'amber', 'rose'))
);

-- 8-a) team_calendar_integrations — 비공개 팀 Google Calendar 연결
CREATE TABLE IF NOT EXISTS team_calendar_integrations (
    id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id                 UUID         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id                 UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider                VARCHAR(20)  NOT NULL DEFAULT 'google',
    google_calendar_id      VARCHAR(255) NOT NULL DEFAULT 'primary',
    google_account_email    VARCHAR(255) NOT NULL,
    encrypted_refresh_token TEXT         NOT NULL,
    scope                   TEXT         NOT NULL,
    connected_at            TIMESTAMP    NOT NULL DEFAULT now(),
    disconnected_at         TIMESTAMP    NULL,
    status                  VARCHAR(20)  NOT NULL DEFAULT 'connected',
    created_at              TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT chk_team_calendar_integrations_provider
        CHECK (provider = 'google'),
    CONSTRAINT chk_team_calendar_integrations_status
        CHECK (status IN ('connected', 'disabled', 'error'))
);

-- 8-b) calendar_event_mappings — TEAM WORKS 일정과 Google 이벤트 매핑
CREATE TABLE IF NOT EXISTS calendar_event_mappings (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id             UUID         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    local_schedule_id   UUID         NULL REFERENCES schedules(id) ON DELETE SET NULL,
    google_event_id     VARCHAR(255) NOT NULL,
    google_calendar_id  VARCHAR(255) NOT NULL DEFAULT 'primary',
    sync_direction      VARCHAR(30)  NOT NULL DEFAULT 'teamworks_to_google',
    last_synced_at      TIMESTAMP    NULL,
    last_google_updated TIMESTAMP    NULL,
    sync_status         VARCHAR(20)  NOT NULL DEFAULT 'synced',
    last_error          TEXT         NULL,
    created_at          TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT chk_calendar_event_mappings_sync_direction
        CHECK (sync_direction IN ('teamworks_to_google', 'google_to_teamworks', 'bidirectional')),
    CONSTRAINT chk_calendar_event_mappings_sync_status
        CHECK (sync_status IN ('pending', 'synced', 'failed', 'deleted'))
);

CREATE OR REPLACE FUNCTION assert_team_calendar_private_team()
RETURNS trigger AS $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM teams
         WHERE id = NEW.team_id
           AND is_public = false
    ) THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Google Calendar integration is only allowed for private teams'
        USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_calendar_integrations_private_team
    ON team_calendar_integrations;

CREATE TRIGGER trg_team_calendar_integrations_private_team
    BEFORE INSERT OR UPDATE OF team_id ON team_calendar_integrations
    FOR EACH ROW
    EXECUTE FUNCTION assert_team_calendar_private_team();

CREATE OR REPLACE FUNCTION prevent_public_team_with_calendar_integration()
RETURNS trigger AS $$
BEGIN
    IF NEW.is_public = true
       AND OLD.is_public = false
       AND EXISTS (
           SELECT 1
             FROM team_calendar_integrations
            WHERE team_id = NEW.id
              AND disconnected_at IS NULL
              AND status <> 'disabled'
       ) THEN
        RAISE EXCEPTION 'Private team with active Google Calendar integration cannot be changed to public'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_teams_prevent_public_calendar_integration
    ON teams;

CREATE TRIGGER trg_teams_prevent_public_calendar_integration
    BEFORE UPDATE OF is_public ON teams
    FOR EACH ROW
    EXECUTE FUNCTION prevent_public_team_with_calendar_integration();

-- 9) chat_messages — 일반/업무보고 채팅
-- project_id NULL → 팀 일자별 채팅 (sent_at 기준 그룹), NOT NULL → 프로젝트 전용 채팅.
-- 같은 테이블에 두 종류를 보관해 동일 코드·인덱스 패턴 재사용.
CREATE TABLE IF NOT EXISTS chat_messages (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id    UUID        NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
    project_id UUID        NULL     REFERENCES projects(id) ON DELETE CASCADE,
    sender_id  UUID        NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
    type       VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    content    TEXT        NOT NULL,
    sent_at    TIMESTAMP   NOT NULL DEFAULT now(),
    created_at TIMESTAMP   NOT NULL DEFAULT now(),
    CONSTRAINT chk_chat_messages_type    CHECK (type IN ('NORMAL', 'WORK_PERFORMANCE')),
    CONSTRAINT chk_chat_messages_content CHECK (char_length(content) <= 2000)
);

-- 10) work_performance_permissions — 업무보고 열람 권한
CREATE TABLE IF NOT EXISTS work_performance_permissions (
    team_id    UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

-- 11) notices — 공지사항
-- project_id NULL → 팀 일자별 채팅 공지, NOT NULL → 프로젝트 전용 공지.
CREATE TABLE IF NOT EXISTS notices (
    id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id    UUID      NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
    project_id UUID      NULL     REFERENCES projects(id) ON DELETE CASCADE,
    sender_id  UUID      NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
    content    TEXT      NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT chk_notices_content CHECK (char_length(content) <= 2000)
);

-- ⚠️ postits 테이블은 database/add-postits.sql 에서 별도 생성.
-- ⚠️ board_posts / board_attachments 테이블은 database/add-board.sql 에서 별도 생성.
-- 본 스크립트 실행 후 두 파일도 순서대로 적용해야 전체 기능 동작.

-- =====================
-- 4. INDEXES
-- =====================

-- users
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- teams
CREATE INDEX IF NOT EXISTS idx_teams_leader_id ON teams(leader_id);

-- team_members
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);

-- team_join_requests
CREATE INDEX IF NOT EXISTS idx_team_join_requests_team_id_status
    ON team_join_requests(team_id, status);
CREATE INDEX IF NOT EXISTS idx_team_join_requests_requester_id
    ON team_join_requests(requester_id);
-- PENDING 중복 신청 방지 (동일 사용자가 동일 팀에 PENDING 상태 요청 중복 불가)
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_join_requests_pending_unique
    ON team_join_requests(team_id, requester_id) WHERE status = 'PENDING';

-- projects
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);

-- project_schedules
CREATE INDEX IF NOT EXISTS idx_project_schedules_project_id ON project_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_project_schedules_team_id    ON project_schedules(team_id);

-- sub_schedules
CREATE INDEX IF NOT EXISTS idx_sub_schedules_project_schedule_id ON sub_schedules(project_schedule_id);
CREATE INDEX IF NOT EXISTS idx_sub_schedules_project_id          ON sub_schedules(project_id);

-- schedules
CREATE INDEX IF NOT EXISTS idx_schedules_team_id_start_at ON schedules(team_id, start_at);
CREATE INDEX IF NOT EXISTS idx_schedules_team_id_end_at   ON schedules(team_id, end_at);

-- Google Calendar integrations
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_calendar_integrations_active_team
    ON team_calendar_integrations(team_id)
    WHERE disconnected_at IS NULL AND status <> 'disabled';
CREATE INDEX IF NOT EXISTS idx_team_calendar_integrations_user_id
    ON team_calendar_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_team_calendar_integrations_status
    ON team_calendar_integrations(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_event_mappings_local_schedule
    ON calendar_event_mappings(local_schedule_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_event_mappings_google_event
    ON calendar_event_mappings(team_id, google_calendar_id, google_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_team_id
    ON calendar_event_mappings(team_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_sync_status
    ON calendar_event_mappings(sync_status);

-- chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_team_id_sent_at
    ON chat_messages(team_id, sent_at DESC);
-- 프로젝트 전용 채팅 조회 — project_id 가 NULL 인 행은 인덱스에서 제외.
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_id_sent_at
    ON chat_messages(project_id, sent_at DESC) WHERE project_id IS NOT NULL;

-- work_performance_permissions
CREATE INDEX IF NOT EXISTS idx_wpp_team ON work_performance_permissions(team_id);

-- notices
CREATE INDEX IF NOT EXISTS idx_notices_team_id ON notices(team_id);
-- 프로젝트 전용 공지 조회 — project_id 가 NULL 인 행 제외.
CREATE INDEX IF NOT EXISTS idx_notices_project_id
    ON notices(project_id) WHERE project_id IS NOT NULL;

-- ⚠️ postits / board_posts / board_attachments 인덱스는 각각의
-- add-postits.sql · add-board.sql 에서 함께 생성됨.

-- =====================
-- Done
-- =====================
SELECT 'TEAM WORKS DB core reset complete — 11 tables. add-postits.sql / add-board.sql 도 적용 필요.' AS result;
