-- TEAM WORKS — OAuth state user binding
-- 목적: Google Calendar OAuth 콜백에서 Team Works 로그인 방식과 무관하게
--       연동을 시작한 사용자를 식별하기 위해 oauth_state 에 user_id 를 저장한다.

ALTER TABLE oauth_state
    ADD COLUMN IF NOT EXISTS user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS privacy_version VARCHAR(20) NULL;

CREATE INDEX IF NOT EXISTS idx_oauth_state_user_id
    ON oauth_state(user_id);
