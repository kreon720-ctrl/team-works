import { decryptToken } from '@/lib/crypto/tokenEncryption'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

function envOrThrow(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`${key} 환경변수가 설정되지 않았습니다.`)
  return v
}

export interface GoogleCalendarEventDateTime {
  date?: string
  dateTime?: string
  timeZone?: string
}

export interface GoogleCalendarEvent {
  id: string
  summary?: string
  description?: string
  start?: GoogleCalendarEventDateTime
  end?: GoogleCalendarEventDateTime
  updated?: string
}

export interface GoogleCalendarEventInput {
  summary: string
  description?: string | null
  start: GoogleCalendarEventDateTime
  end?: GoogleCalendarEventDateTime | null
}

export async function refreshGoogleCalendarAccessToken(
  encryptedRefreshToken: string
): Promise<string> {
  const refreshToken = decryptToken(encryptedRefreshToken)
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: envOrThrow('GOOGLE_CLIENT_ID'),
    client_secret: envOrThrow('GOOGLE_CLIENT_SECRET'),
    refresh_token: refreshToken,
  })

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string }

  if (!res.ok || !data.access_token) {
    const err = data.error ? `${data.error}: ${data.error_description ?? ''}` : `status ${res.status}`
    throw new Error(`Google Calendar access token 갱신 실패: ${err}`)
  }

  return data.access_token
}

async function googleCalendarFetch<T>(params: {
  accessToken: string
  path: string
  method?: string
  body?: unknown
}): Promise<T> {
  const res = await fetch(`${GOOGLE_CALENDAR_API_BASE}${params.path}`, {
    method: params.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      ...(params.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let detail = text.trim()
    if (detail) {
      try {
        const data = JSON.parse(detail) as {
          error?: {
            message?: string
            status?: string
            errors?: Array<{ reason?: string; message?: string }>
          }
        }
        const reason = data.error?.errors?.[0]?.reason ?? data.error?.status
        const message = data.error?.message
        detail = [reason, message].filter(Boolean).join(': ')
      } catch {
        detail = detail.slice(0, 300)
      }
    }
    throw new Error(`Google Calendar API 요청 실패: ${res.status}${detail ? ` - ${detail}` : ''}`)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function listGoogleCalendarEvents(params: {
  accessToken: string
  calendarId: string
  timeMin: string
  timeMax: string
}): Promise<GoogleCalendarEvent[]> {
  const query = new URLSearchParams({
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
  })
  const calendarId = encodeURIComponent(params.calendarId)
  const data = await googleCalendarFetch<{ items?: GoogleCalendarEvent[] }>({
    accessToken: params.accessToken,
    path: `/calendars/${calendarId}/events?${query.toString()}`,
  })
  return data.items ?? []
}

export function insertGoogleCalendarEvent(params: {
  accessToken: string
  calendarId: string
  event: GoogleCalendarEventInput
}): Promise<GoogleCalendarEvent> {
  return googleCalendarFetch<GoogleCalendarEvent>({
    accessToken: params.accessToken,
    path: `/calendars/${encodeURIComponent(params.calendarId)}/events`,
    method: 'POST',
    body: params.event,
  })
}

export function updateGoogleCalendarEvent(params: {
  accessToken: string
  calendarId: string
  eventId: string
  event: Partial<GoogleCalendarEventInput>
}): Promise<GoogleCalendarEvent> {
  return googleCalendarFetch<GoogleCalendarEvent>({
    accessToken: params.accessToken,
    path: `/calendars/${encodeURIComponent(params.calendarId)}/events/${encodeURIComponent(params.eventId)}`,
    method: 'PATCH',
    body: params.event,
  })
}

export function deleteGoogleCalendarEvent(params: {
  accessToken: string
  calendarId: string
  eventId: string
}): Promise<void> {
  return googleCalendarFetch<void>({
    accessToken: params.accessToken,
    path: `/calendars/${encodeURIComponent(params.calendarId)}/events/${encodeURIComponent(params.eventId)}`,
    method: 'DELETE',
  })
}
