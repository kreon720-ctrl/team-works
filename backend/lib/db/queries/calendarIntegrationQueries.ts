import { pool } from '@/lib/db/pool'

export type CalendarIntegrationStatus = 'connected' | 'disabled' | 'error'

export interface TeamCalendarIntegration {
  id: string
  team_id: string
  user_id: string
  provider: 'google'
  google_calendar_id: string
  google_account_email: string
  encrypted_refresh_token: string
  scope: string
  connected_at: Date
  disconnected_at: Date | null
  status: CalendarIntegrationStatus
  created_at: Date
  updated_at: Date
}

export interface CreateTeamCalendarIntegrationParams {
  teamId: string
  userId: string
  googleCalendarId?: string
  googleAccountEmail: string
  encryptedRefreshToken: string
  scope: string
}

export async function getActiveTeamCalendarIntegration(
  teamId: string
): Promise<TeamCalendarIntegration | null> {
  const result = await pool.query<TeamCalendarIntegration>(
    `SELECT *
       FROM team_calendar_integrations
      WHERE team_id = $1
        AND provider = 'google'
        AND disconnected_at IS NULL
        AND status = 'connected'
      ORDER BY connected_at DESC
      LIMIT 1`,
    [teamId]
  )
  return result.rows[0] ?? null
}

export async function getLatestTeamCalendarIntegration(
  teamId: string
): Promise<TeamCalendarIntegration | null> {
  const result = await pool.query<TeamCalendarIntegration>(
    `SELECT *
       FROM team_calendar_integrations
      WHERE team_id = $1
        AND provider = 'google'
      ORDER BY created_at DESC
      LIMIT 1`,
    [teamId]
  )
  return result.rows[0] ?? null
}

export async function createTeamCalendarIntegration(
  params: CreateTeamCalendarIntegrationParams
): Promise<TeamCalendarIntegration> {
  const result = await pool.query<TeamCalendarIntegration>(
    `INSERT INTO team_calendar_integrations (
       team_id,
       user_id,
       google_calendar_id,
       google_account_email,
       encrypted_refresh_token,
       scope,
       status
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'connected')
     RETURNING *`,
    [
      params.teamId,
      params.userId,
      params.googleCalendarId ?? 'primary',
      params.googleAccountEmail,
      params.encryptedRefreshToken,
      params.scope,
    ]
  )
  return result.rows[0]
}

export async function disconnectTeamCalendarIntegration(
  teamId: string
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE team_calendar_integrations
        SET status = 'disabled',
            disconnected_at = now(),
            updated_at = now()
      WHERE team_id = $1
        AND provider = 'google'
        AND disconnected_at IS NULL
        AND status <> 'disabled'`,
    [teamId]
  )
  return (result.rowCount ?? 0) > 0
}

export type CalendarEventSyncDirection =
  | 'teamworks_to_google'
  | 'google_to_teamworks'
  | 'bidirectional'

export type CalendarEventSyncStatus =
  | 'pending'
  | 'synced'
  | 'failed'
  | 'deleted'

export interface CalendarEventMapping {
  id: string
  team_id: string
  local_schedule_id: string | null
  google_event_id: string
  google_calendar_id: string
  sync_direction: CalendarEventSyncDirection
  last_synced_at: Date | null
  last_google_updated: Date | null
  sync_status: CalendarEventSyncStatus
  last_error: string | null
  created_at: Date
  updated_at: Date
}

export interface UpsertCalendarEventMappingParams {
  teamId: string
  localScheduleId: string
  googleEventId: string
  googleCalendarId?: string
  syncDirection?: CalendarEventSyncDirection
  syncStatus?: CalendarEventSyncStatus
  lastGoogleUpdated?: Date | null
  lastError?: string | null
}

export async function getCalendarEventMappingByLocalSchedule(
  localScheduleId: string
): Promise<CalendarEventMapping | null> {
  const result = await pool.query<CalendarEventMapping>(
    `SELECT *
       FROM calendar_event_mappings
      WHERE local_schedule_id = $1
      LIMIT 1`,
    [localScheduleId]
  )
  return result.rows[0] ?? null
}

export async function getCalendarEventMappingsByTeam(
  teamId: string
): Promise<CalendarEventMapping[]> {
  const result = await pool.query<CalendarEventMapping>(
    `SELECT *
       FROM calendar_event_mappings
      WHERE team_id = $1`,
    [teamId]
  )
  return result.rows
}

export async function upsertCalendarEventMapping(
  params: UpsertCalendarEventMappingParams
): Promise<CalendarEventMapping> {
  const result = await pool.query<CalendarEventMapping>(
    `INSERT INTO calendar_event_mappings (
       team_id,
       local_schedule_id,
       google_event_id,
       google_calendar_id,
       sync_direction,
       last_synced_at,
       last_google_updated,
       sync_status,
       last_error
     )
     VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8)
     ON CONFLICT (local_schedule_id)
     DO UPDATE SET
       google_event_id = EXCLUDED.google_event_id,
       google_calendar_id = EXCLUDED.google_calendar_id,
       sync_direction = EXCLUDED.sync_direction,
       last_synced_at = now(),
       last_google_updated = EXCLUDED.last_google_updated,
       sync_status = EXCLUDED.sync_status,
       last_error = EXCLUDED.last_error,
       updated_at = now()
     RETURNING *`,
    [
      params.teamId,
      params.localScheduleId,
      params.googleEventId,
      params.googleCalendarId ?? 'primary',
      params.syncDirection ?? 'teamworks_to_google',
      params.lastGoogleUpdated ?? null,
      params.syncStatus ?? 'synced',
      params.lastError ?? null,
    ]
  )
  return result.rows[0]
}

export async function markCalendarEventMappingFailed(params: {
  teamId: string
  localScheduleId: string
  googleEventId?: string
  googleCalendarId?: string
  lastError: string
}): Promise<CalendarEventMapping> {
  return upsertCalendarEventMapping({
    teamId: params.teamId,
    localScheduleId: params.localScheduleId,
    googleEventId: params.googleEventId ?? `failed:${params.localScheduleId}`,
    googleCalendarId: params.googleCalendarId ?? 'primary',
    syncStatus: 'failed',
    lastError: params.lastError,
  })
}

export async function markCalendarEventMappingDeleted(params: {
  mappingId: string
}): Promise<CalendarEventMapping | null> {
  const result = await pool.query<CalendarEventMapping>(
    `UPDATE calendar_event_mappings
        SET sync_status = 'deleted',
            last_synced_at = now(),
            last_error = NULL,
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [params.mappingId]
  )
  return result.rows[0] ?? null
}

export async function markCalendarEventMappingDeleteFailed(params: {
  mappingId: string
  lastError: string
}): Promise<CalendarEventMapping | null> {
  const result = await pool.query<CalendarEventMapping>(
    `UPDATE calendar_event_mappings
        SET sync_status = 'failed',
            last_error = $2,
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [params.mappingId, params.lastError]
  )
  return result.rows[0] ?? null
}
