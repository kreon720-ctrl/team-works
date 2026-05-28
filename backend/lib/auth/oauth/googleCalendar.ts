/**
 * Google Calendar OAuth 2.0 — Calendar 권한 승인 URL + 토큰 교환.
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const IDENTITY_SCOPES = 'openid profile email'

function envOrThrow(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`${key} 환경변수가 설정되지 않았습니다.`)
  return v
}

export function getGoogleCalendarOAuthConfig(): {
  clientId: string
  clientSecret: string
  redirectUri: string
} {
  return {
    clientId: envOrThrow('GOOGLE_CLIENT_ID'),
    clientSecret: envOrThrow('GOOGLE_CLIENT_SECRET'),
    redirectUri: envOrThrow('GOOGLE_CALENDAR_REDIRECT_URI'),
  }
}

export function buildGoogleCalendarAuthUrl(params: {
  state: string
  codeChallenge: string
}): string {
  const { clientId, redirectUri } = getGoogleCalendarOAuthConfig()
  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', `${IDENTITY_SCOPES} ${CALENDAR_SCOPE}`)
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}

export interface GoogleCalendarTokenResponse {
  access_token: string
  expires_in: number
  scope?: string
  token_type: string
  id_token?: string
  refresh_token?: string
}

export async function exchangeGoogleCalendarCode(params: {
  code: string
  codeVerifier: string
}): Promise<GoogleCalendarTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getGoogleCalendarOAuthConfig()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code: params.code,
    code_verifier: params.codeVerifier,
  })

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const data = (await res.json()) as GoogleCalendarTokenResponse | {
    error: string
    error_description?: string
  }

  if (!res.ok || 'error' in data) {
    const err = 'error' in data ? `${data.error}: ${data.error_description ?? ''}` : 'unknown'
    throw new Error(`Google Calendar 토큰 교환 실패: ${err}`)
  }

  return data
}

export { CALENDAR_SCOPE }
