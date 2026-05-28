-- Google Calendar integration tables.
-- 실행: docker exec -i postgres-db psql -U teamworks-manager -d teamworks \
--   < database/add-google-calendar-integration.sql

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

ALTER TABLE calendar_event_mappings
    ALTER COLUMN local_schedule_id DROP NOT NULL;

ALTER TABLE calendar_event_mappings
    DROP CONSTRAINT IF EXISTS calendar_event_mappings_local_schedule_id_fkey;

ALTER TABLE calendar_event_mappings
    ADD CONSTRAINT calendar_event_mappings_local_schedule_id_fkey
    FOREIGN KEY (local_schedule_id) REFERENCES schedules(id) ON DELETE SET NULL;

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
