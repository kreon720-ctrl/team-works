import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildGoogleCalendarAuthUrl,
  exchangeGoogleCalendarCode,
} from '@/lib/auth/oauth/googleCalendar'

describe('Google Calendar OAuth', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client-id')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-client-secret')
    vi.stubEnv(
      'GOOGLE_CALENDAR_REDIRECT_URI',
      'http://localhost:3000/api/auth/oauth/google/calendar/callback'
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('builds a Google Calendar authorization URL with offline consent', () => {
    const url = new URL(buildGoogleCalendarAuthUrl({
      state: 'state-123',
      codeChallenge: 'challenge-123',
    }))

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('google-client-id')
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/auth/oauth/google/calendar/callback'
    )
    expect(url.searchParams.get('scope')).toContain('openid profile email')
    expect(url.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/calendar.events')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('code_challenge')).toBe('challenge-123')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('exchanges a Calendar authorization code with the Calendar redirect URI', async () => {
    const fetchMock = vi.fn(async (...args: [string | URL | Request, RequestInit?]) => {
      void args
      return new Response(JSON.stringify({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid profile email https://www.googleapis.com/auth/calendar.events',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const token = await exchangeGoogleCalendarCode({
      code: 'auth-code',
      codeVerifier: 'verifier-123',
    })

    expect(token.refresh_token).toBe('refresh-token')

    const [, init] = fetchMock.mock.calls[0]
    const body = init?.body as URLSearchParams
    expect(body.get('redirect_uri')).toBe(
      'http://localhost:3000/api/auth/oauth/google/calendar/callback'
    )
    expect(body.get('code_verifier')).toBe('verifier-123')
  })
})
