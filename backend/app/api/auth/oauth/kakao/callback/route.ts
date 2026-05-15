import { NextRequest, NextResponse } from 'next/server'
import { popState } from '@/lib/auth/oauth/state'
import { exchangeKakaoCode, fetchKakaoUserInfo } from '@/lib/auth/oauth/kakao'
import { linkOrCreateUser } from '@/lib/auth/oauth/linking'
import { generateTokenPair } from '@/lib/auth/jwt'

/**
 * 콜백 결과를 프론트로 전달 — 토큰을 URL fragment 에 담아 success 페이지로 302.
 *
 * 왜 fragment(#) 인가?
 *   - querystring(?) 은 Referer 헤더로 외부에 새 나가거나 브라우저 히스토리/서버 로그에 남음
 *   - fragment 는 클라이언트(JS)만 읽을 수 있고 서버로 안 감 → OAuth 토큰 전달 모범 사례
 */
function frontRedirect(args: {
  baseUrl: string
  accessToken?: string
  refreshToken?: string
  user?: { id: string; email: string; name: string }
  redirectAfter?: string | null
  error?: string
}): NextResponse {
  const target = new URL('/auth/oauth/success', args.baseUrl)
  const fragment = new URLSearchParams()
  if (args.accessToken) fragment.set('accessToken', args.accessToken)
  if (args.refreshToken) fragment.set('refreshToken', args.refreshToken)
  if (args.user) fragment.set('user', JSON.stringify(args.user))
  if (args.redirectAfter) fragment.set('redirectAfter', args.redirectAfter)
  if (args.error) fragment.set('error', args.error)
  target.hash = fragment.toString()
  return NextResponse.redirect(target.toString())
}

/**
 * 프론트 베이스 URL 계산.
 * Next.js 가 nginx 뒤에 있으면 request.nextUrl.origin 이 backend 컨테이너 내부 host 로
 * 잡힐 수 있음 → success redirect 가 잘못된 URL 로 감.
 *
 * 우선순위:
 *   1) PUBLIC_BASE_URL 환경변수 (가장 명시적)
 *   2) X-Forwarded-Host + X-Forwarded-Proto (nginx 표준)
 *   3) Host 헤더 (backend 내부 host 가 아닌 경우)
 *   4) request.nextUrl.origin (fallback)
 */
function resolveBaseUrl(request: NextRequest): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')

  const fwdHost = request.headers.get('x-forwarded-host')
  if (fwdHost) {
    const fwdProto = request.headers.get('x-forwarded-proto') ?? 'https'
    return `${fwdProto}://${fwdHost}`
  }

  const host = request.headers.get('host')
  if (host && !host.startsWith('backend') && !host.startsWith('localhost:3000')) {
    // host header 가 외부 host 처럼 보이면 사용
    const proto = request.headers.get('x-forwarded-proto')
      ?? (host.startsWith('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }

  return request.nextUrl.origin
}

/**
 * GET /api/auth/oauth/kakao/callback
 *
 * 카카오 → 우리 서버 콜백.
 *   1) state 검증 → code_verifier 회수
 *   2) code → access_token 교환
 *   3) 사용자 정보 조회
 *   4) user 매칭/생성
 *   5) 우리 JWT 발급 + /auth/oauth/success 로 302 (fragment 에 토큰)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const baseUrl = resolveBaseUrl(request)

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    if (error) {
      return frontRedirect({ baseUrl, error: `카카오 로그인 거부: ${error}` })
    }
    if (!code || !state) {
      return frontRedirect({ baseUrl, error: '잘못된 콜백 요청입니다.' })
    }

    // 1) state 검증
    const popped = await popState(state)
    if (!popped) {
      return frontRedirect({ baseUrl, error: '인증 세션이 만료되었거나 유효하지 않습니다. 다시 시도해주세요.' })
    }

    // 2) code → token
    const tokenRes = await exchangeKakaoCode({ code, codeVerifier: popped.codeVerifier })

    // 3) 사용자 정보
    const userInfo = await fetchKakaoUserInfo(tokenRes.access_token)

    // 4) user 매칭/생성
    const link = await linkOrCreateUser({
      provider: 'kakao',
      providerUserId: userInfo.providerUserId,
      email: userInfo.email,
      nickname: userInfo.nickname,
      picture: userInfo.picture,
    })

    if (!link.ok) {
      if (link.reason === 'email_required') {
        return frontRedirect({
          baseUrl,
          error: '카카오 계정 이메일 동의가 필요합니다. 카카오 동의 화면에서 이메일에 동의 후 다시 시도해주세요.',
        })
      }
      return frontRedirect({ baseUrl, error: '로그인 처리 중 오류가 발생했습니다.' })
    }

    // 5) JWT 발급 + 프론트로
    const { accessToken, refreshToken } = generateTokenPair(link.user)
    return frontRedirect({
      baseUrl,
      accessToken,
      refreshToken,
      user: { id: link.user.id, email: link.user.email, name: link.user.name },
      redirectAfter: popped.redirectAfter,
    })
  } catch (err) {
    console.error('Kakao OAuth callback 실패:', err)
    return frontRedirect({
      baseUrl,
      error: '서버 내부 오류가 발생했습니다.',
    })
  }
}
