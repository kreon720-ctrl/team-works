-- Google Calendar integration schema smoke test.
-- 실행:
--   docker exec -i postgres-db psql -U teamworks-manager -d teamworks \
--     < database/test-google-calendar-integration.sql

BEGIN;

DO $$
DECLARE
    v_user_id UUID;
    v_private_team_id UUID;
    v_public_team_id UUID;
    v_schedule_id UUID;
    v_integration_id UUID;
BEGIN
    INSERT INTO users (email, name, password_hash)
    VALUES ('calendar-db-test@teamworks.test', 'Calendar DB Test', 'hash')
    RETURNING id INTO v_user_id;

    INSERT INTO teams (name, description, is_public, leader_id)
    VALUES ('Calendar Private Test Team', NULL, false, v_user_id)
    RETURNING id INTO v_private_team_id;

    INSERT INTO teams (name, description, is_public, leader_id)
    VALUES ('Calendar Public Test Team', NULL, true, v_user_id)
    RETURNING id INTO v_public_team_id;

    INSERT INTO schedules (
        team_id,
        created_by,
        title,
        description,
        color,
        start_at,
        end_at
    )
    VALUES (
        v_private_team_id,
        v_user_id,
        'Calendar mapping test schedule',
        NULL,
        'indigo',
        TIMESTAMP '2026-05-28 10:00:00',
        TIMESTAMP '2026-05-28 11:00:00'
    )
    RETURNING id INTO v_schedule_id;

    INSERT INTO team_calendar_integrations (
        team_id,
        user_id,
        google_account_email,
        encrypted_refresh_token,
        scope
    )
    VALUES (
        v_private_team_id,
        v_user_id,
        'calendar-db-test@gmail.com',
        'encrypted-token',
        'https://www.googleapis.com/auth/calendar.events'
    )
    RETURNING id INTO v_integration_id;

    IF v_integration_id IS NULL THEN
        RAISE EXCEPTION 'private team integration insert failed';
    END IF;

    BEGIN
        INSERT INTO team_calendar_integrations (
            team_id,
            user_id,
            google_account_email,
            encrypted_refresh_token,
            scope
        )
        VALUES (
            v_public_team_id,
            v_user_id,
            'calendar-db-test@gmail.com',
            'encrypted-token',
            'https://www.googleapis.com/auth/calendar.events'
        );

        RAISE EXCEPTION 'public team integration should have been rejected';
    EXCEPTION
        WHEN check_violation THEN
            NULL;
    END;

    BEGIN
        INSERT INTO team_calendar_integrations (
            team_id,
            user_id,
            google_account_email,
            encrypted_refresh_token,
            scope
        )
        VALUES (
            v_private_team_id,
            v_user_id,
            'calendar-db-test-2@gmail.com',
            'encrypted-token-2',
            'https://www.googleapis.com/auth/calendar.events'
        );

        RAISE EXCEPTION 'duplicate active integration should have been rejected';
    EXCEPTION
        WHEN unique_violation THEN
            NULL;
    END;

    BEGIN
        UPDATE teams
           SET is_public = true
         WHERE id = v_private_team_id;

        RAISE EXCEPTION 'private team with active integration should not become public';
    EXCEPTION
        WHEN check_violation THEN
            NULL;
    END;

    INSERT INTO calendar_event_mappings (
        team_id,
        local_schedule_id,
        google_event_id,
        google_calendar_id,
        sync_direction,
        sync_status
    )
    VALUES (
        v_private_team_id,
        v_schedule_id,
        'google-event-1',
        'primary',
        'teamworks_to_google',
        'synced'
    );

    BEGIN
        INSERT INTO calendar_event_mappings (
            team_id,
            local_schedule_id,
            google_event_id,
            google_calendar_id
        )
        VALUES (
            v_private_team_id,
            v_schedule_id,
            'google-event-2',
            'primary'
        );

        RAISE EXCEPTION 'duplicate local schedule mapping should have been rejected';
    EXCEPTION
        WHEN unique_violation THEN
            NULL;
    END;
END $$;

ROLLBACK;

SELECT 'google calendar integration schema smoke test passed' AS result;
