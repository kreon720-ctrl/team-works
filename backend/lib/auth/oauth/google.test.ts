import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
} from '@/lib/auth/oauth/google'

describe('Google OAuth', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client-id')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-client-secret')
    vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://localhost:3000/api/auth/oauth/google/callback')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('builds a Google authorization URL with OpenID scopes and PKCE', () => {
    const url = new URL(buildGoogleAuthUrl({
      state: 'state-123',
      codeChallenge: 'challenge-123',
    }))

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('google-client-id')
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/oauth/google/callback')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('openid profile email')
    expect(url.searchParams.get('state')).toBe('state-123')
    expect(url.searchParams.get('code_challenge')).toBe('challenge-123')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('exchanges an authorization code for a Google access token', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'google-access-token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid profile email',
      id_token: 'id-token',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const token = await exchangeGoogleCode({
      code: 'auth-code',
      codeVerifier: 'verifier-123',
    })

    expect(token.access_token).toBe('google-access-token')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(init?.method).toBe('POST')

    const body = init?.body
    expect(body).toBeInstanceOf(URLSearchParams)
    const params = body as URLSearchParams
    expect(params.get('grant_type')).toBe('authorization_code')
    expect(params.get('client_id')).toBe('google-client-id')
    expect(params.get('client_secret')).toBe('google-client-secret')
    expect(params.get('redirect_uri')).toBe('http://localhost:3000/api/auth/oauth/google/callback')
    expect(params.get('code')).toBe('auth-code')
    expect(params.get('code_verifier')).toBe('verifier-123')
  })

  it('throws when Google token exchange fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Bad code',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })))

    await expect(exchangeGoogleCode({
      code: 'bad-code',
      codeVerifier: 'verifier-123',
    })).rejects.toThrow('Google 토큰 교환 실패')
  })

  it('maps Google userinfo to the common OAuth user shape', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      sub: 'google-user-id',
      email: 'user@example.com',
      email_verified: true,
      name: 'Google User',
      picture: 'https://example.com/profile.png',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const user = await fetchGoogleUserInfo('google-access-token')

    expect(user).toEqual({
      providerUserId: 'google-user-id',
      email: 'user@example.com',
      nickname: 'Google User',
      picture: 'https://example.com/profile.png',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openidconnect.googleapis.com/v1/userinfo',
      { headers: { Authorization: 'Bearer google-access-token' } }
    )
  })
})
