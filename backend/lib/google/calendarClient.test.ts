import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteGoogleCalendarEvent,
  insertGoogleCalendarEvent,
  listGoogleCalendarEvents,
  refreshGoogleCalendarAccessToken,
  updateGoogleCalendarEvent,
} from '@/lib/google/calendarClient'
import { encryptToken } from '@/lib/crypto/tokenEncryption'

describe('Google Calendar client', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client-id')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-client-secret')
    vi.stubEnv('GOOGLE_CALENDAR_ENCRYPTION_KEY', 'test-calendar-encryption-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('refreshes an access token from an encrypted refresh token', async () => {
    const fetchMock = vi.fn(async (...args: [string | URL | Request, RequestInit?]) => {
      void args
      return new Response(JSON.stringify({
      access_token: 'new-access-token',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const accessToken = await refreshGoogleCalendarAccessToken(encryptToken('refresh-token'))

    expect(accessToken).toBe('new-access-token')
    const [, init] = fetchMock.mock.calls[0]
    const body = init?.body as URLSearchParams
    expect(body.get('refresh_token')).toBe('refresh-token')
  })

  it('lists events', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      items: [{ id: 'event-1', summary: 'Event 1' }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    const events = await listGoogleCalendarEvents({
      accessToken: 'access-token',
      calendarId: 'primary',
      timeMin: '2026-05-01T00:00:00Z',
      timeMax: '2026-06-01T00:00:00Z',
    })

    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('event-1')
  })

  it('creates, updates, and deletes events', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      return new Response(JSON.stringify({ id: 'event-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await insertGoogleCalendarEvent({
      accessToken: 'access-token',
      calendarId: 'primary',
      event: {
        summary: 'Event',
        start: { dateTime: '2026-05-28T10:00:00+09:00' },
        end: { dateTime: '2026-05-28T11:00:00+09:00' },
      },
    })
    await updateGoogleCalendarEvent({
      accessToken: 'access-token',
      calendarId: 'primary',
      eventId: 'event-1',
      event: { summary: 'Updated event' },
    })
    await deleteGoogleCalendarEvent({
      accessToken: 'access-token',
      calendarId: 'primary',
      eventId: 'event-1',
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST')
    expect(fetchMock.mock.calls[1][1]?.method).toBe('PATCH')
    expect(fetchMock.mock.calls[2][1]?.method).toBe('DELETE')
  })
})
