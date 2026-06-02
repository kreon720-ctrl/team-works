import { generateStateBundle, saveState } from '@/lib/auth/oauth/state'
import { buildGoogleCalendarAuthUrl } from '@/lib/auth/oauth/googleCalendar'
import { getTeamById } from '@/lib/db/queries/teamQueries'
import {
  getActiveTeamCalendarIntegration,
  getLatestTeamCalendarIntegration,
} from '@/lib/db/queries/calendarIntegrationQueries'

export type GoogleCalendarIntegrationStatus =
  | 'connected'
  | 'needs_consent'
  | 'disabled'
  | 'not_applicable'
  | 'error'

export async function getGoogleCalendarIntegrationStatus(params: {
  teamId: string
  userId: string
}): Promise<{
  status: GoogleCalendarIntegrationStatus
  connectedAt?: Date
  disconnectedAt?: Date | null
  googleAccountEmail?: string
  googleCalendarId?: string
}> {
  const team = await getTeamById(params.teamId)
  if (!team || team.is_public) return { status: 'not_applicable' }

  const active = await getActiveTeamCalendarIntegration(params.teamId)
  if (active) {
    return {
      status: 'connected',
      connectedAt: active.connected_at,
      googleAccountEmail: active.google_account_email,
      googleCalendarId: active.google_calendar_id,
    }
  }

  const latest = await getLatestTeamCalendarIntegration(params.teamId)
  if (latest?.status === 'error') {
    return {
      status: 'error',
      connectedAt: latest.connected_at,
      googleAccountEmail: latest.google_account_email,
      googleCalendarId: latest.google_calendar_id,
    }
  }
  if (latest?.status === 'disabled') {
    return {
      status: 'disabled',
      disconnectedAt: latest.disconnected_at,
      googleAccountEmail: latest.google_account_email,
      googleCalendarId: latest.google_calendar_id,
    }
  }

  return { status: 'needs_consent' }
}

export async function createGoogleCalendarConsentUrl(params: {
  teamId: string
  userId: string
  redirectAfter?: string | null
}): Promise<string> {
  const { state, codeVerifier, codeChallenge } = generateStateBundle()
  const redirectAfter = params.redirectAfter ?? `/teams/${params.teamId}`
  await saveState(state, codeVerifier, redirectAfter, params.userId)
  return buildGoogleCalendarAuthUrl({ state, codeChallenge })
}
