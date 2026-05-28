/**
 * Google OAuth 2.0 / OpenID Connect — 토큰 교환 + 사용자 정보 조회
 *
 * 환경변수:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

function envOrThrow(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`${key} 환경변수가 설정되지 않았습니다.`)
  return v
}

export function getGoogleConfig(): {
  clientId: string
  clientSecret: string
  redirectUri: string
} {
  return {
    clientId: envOrThrow('GOOGLE_CLIENT_ID'),
    clientSecret: envOrThrow('GOOGLE_CLIENT_SECRET'),
    redirectUri: envOrThrow('GOOGLE_REDIRECT_URI'),
  }
}

/**
 * Google 인증 URL 생성 — Authorization Code + PKCE + state.
 */
export function buildGoogleAuthUrl(params: { state: string; codeChallenge: string }): string {
  const { clientId, redirectUri } = getGoogleConfig()
  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid profile email')
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  scope?: string
  token_type: string
  id_token?: string
  refresh_token?: string
}

/**
 * Google 콜백에서 받은 code 를 access_token 으로 교환.
 */
export async function exchangeGoogleCode(params: {
  code: string
  codeVerifier: string
}): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig()
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

  const data = (await res.json()) as GoogleTokenResponse | { error: string; error_description?: string }
  if (!res.ok || 'error' in data) {
    const err = 'error' in data ? `${data.error}: ${data.error_description ?? ''}` : 'unknown'
    throw new Error(`Google 토큰 교환 실패: ${err}`)
  }
  return data
}

export interface GoogleUserInfo {
  providerUserId: string
  email: string | null
  nickname: string | null
  picture: string | null
}

/**
 * access_token 으로 OpenID Connect userinfo 조회.
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Google 사용자 정보 조회 실패: ${res.status}`)
  }

  const data = (await res.json()) as {
    sub: string
    email?: string
    email_verified?: boolean
    name?: string
    picture?: string
  }

  return {
    providerUserId: data.sub,
    email: data.email ?? null,
    nickname: data.name ?? null,
    picture: data.picture ?? null,
  }
}
