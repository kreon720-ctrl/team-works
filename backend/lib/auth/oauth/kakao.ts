/**
 * 카카오 OAuth 2.0 (OIDC enabled) — 토큰 교환 + 사용자 정보 조회
 *
 * 환경변수 (backend/.env 또는 docker-compose.yml):
 *   KAKAO_CLIENT_ID
 *   KAKAO_CLIENT_SECRET
 *   KAKAO_REDIRECT_URI
 */

const KAKAO_AUTH_URL = 'https://kauth.kakao.com/oauth/authorize'
const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token'
const KAKAO_USERINFO_URL = 'https://kapi.kakao.com/v2/user/me'

function envOrThrow(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`${key} 환경변수가 설정되지 않았습니다.`)
  return v
}

export function getKakaoConfig(): {
  clientId: string
  clientSecret: string
  redirectUri: string
} {
  return {
    clientId: envOrThrow('KAKAO_CLIENT_ID'),
    clientSecret: envOrThrow('KAKAO_CLIENT_SECRET'),
    redirectUri: envOrThrow('KAKAO_REDIRECT_URI'),
  }
}

/**
 * 카카오 인증 URL 생성 — PKCE + state + OIDC scope.
 * 사용자를 이 URL 로 리다이렉트하면 카카오 로그인 화면이 뜸.
 */
export function buildKakaoAuthUrl(params: { state: string; codeChallenge: string }): string {
  const { clientId, redirectUri } = getKakaoConfig()
  const url = new URL(KAKAO_AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', params.state)
  // OIDC enabled 라 openid scope 포함하면 id_token 도 같이 받음
  url.searchParams.set('scope', 'openid account_email profile_nickname profile_image')
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

interface KakaoTokenResponse {
  access_token: string
  token_type: string
  refresh_token?: string
  id_token?: string // OIDC enabled 시
  expires_in: number
  scope?: string
}

/**
 * 카카오 콜백에서 받은 code 를 access_token + id_token 으로 교환
 */
export async function exchangeKakaoCode(params: {
  code: string
  codeVerifier: string
}): Promise<KakaoTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getKakaoConfig()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code: params.code,
    code_verifier: params.codeVerifier,
  })

  const res = await fetch(KAKAO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  })

  const data = (await res.json()) as KakaoTokenResponse | { error: string; error_description?: string }
  if (!res.ok || 'error' in data) {
    const err = 'error' in data ? `${data.error}: ${data.error_description ?? ''}` : 'unknown'
    throw new Error(`카카오 토큰 교환 실패: ${err}`)
  }
  return data
}

export interface KakaoUserInfo {
  providerUserId: string // 카카오 회원번호 (string 으로 변환)
  email: string | null
  nickname: string | null
  picture: string | null
}

/**
 * access_token 으로 카카오 사용자 정보 조회
 *
 * OIDC id_token 으로도 일부 정보 추출 가능하지만, 카카오는 nickname·picture 등이
 * id_token 에 안 들어가는 경우가 있어 user/me 한 번 호출이 안전.
 */
export async function fetchKakaoUserInfo(accessToken: string): Promise<KakaoUserInfo> {
  const res = await fetch(KAKAO_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`카카오 사용자 정보 조회 실패: ${res.status}`)
  }
  // 카카오 응답 구조 — kakao_account 와 properties 두 군데 정보가 흩어져 있음
  const data = (await res.json()) as {
    id: number
    kakao_account?: {
      email?: string
      email_needs_agreement?: boolean
      profile?: { nickname?: string; profile_image_url?: string }
    }
    properties?: { nickname?: string; profile_image?: string }
  }

  return {
    providerUserId: String(data.id),
    email: data.kakao_account?.email ?? null,
    nickname:
      data.kakao_account?.profile?.nickname ??
      data.properties?.nickname ??
      null,
    picture:
      data.kakao_account?.profile?.profile_image_url ??
      data.properties?.profile_image ??
      null,
  }
}
