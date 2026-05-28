import { NextRequest, NextResponse } from 'next/server'
import { popState } from '@/lib/auth/oauth/state'
import { exchangeGoogleCode, fetchGoogleUserInfo } from '@/lib/auth/oauth/google'
import { linkOrCreateUser } from '@/lib/auth/oauth/linking'
import { generateTokenPair } from '@/lib/auth/jwt'

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

function resolveBaseUrl(request: NextRequest): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')

  const fwdHost = request.headers.get('x-forwarded-host')
  if (fwdHost) {
    const fwdProto = request.headers.get('x-forwarded-proto') ?? 'https'
    return `${fwdProto}://${fwdHost}`
  }

  const host = request.headers.get('host')
  if (host && !host.startsWith('backend') && !host.startsWith('localhost:3000')) {
    const proto = request.headers.get('x-forwarded-proto')
      ?? (host.startsWith('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }

  return request.nextUrl.origin
}

/**
 * GET /api/auth/oauth/google/callback
 *
 * Google → 우리 서버 콜백.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const baseUrl = resolveBaseUrl(request)

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    if (error) {
      return frontRedirect({ baseUrl, error: `Google 로그인 거부: ${error}` })
    }
    if (!code || !state) {
      return frontRedirect({ baseUrl, error: '잘못된 콜백 요청입니다.' })
    }

    const popped = await popState(state)
    if (!popped) {
      return frontRedirect({ baseUrl, error: '인증 세션이 만료되었거나 유효하지 않습니다. 다시 시도해주세요.' })
    }

    const tokenRes = await exchangeGoogleCode({ code, codeVerifier: popped.codeVerifier })
    const userInfo = await fetchGoogleUserInfo(tokenRes.access_token)

    const link = await linkOrCreateUser({
      provider: 'google',
      providerUserId: userInfo.providerUserId,
      email: userInfo.email,
      nickname: userInfo.nickname,
      picture: userInfo.picture,
    })

    if (!link.ok) {
      if (link.reason === 'email_required') {
        return frontRedirect({
          baseUrl,
          error: 'Google 계정 이메일 권한이 필요합니다. Google 동의 화면에서 이메일 권한에 동의 후 다시 시도해주세요.',
        })
      }
      return frontRedirect({ baseUrl, error: '로그인 처리 중 오류가 발생했습니다.' })
    }

    const { accessToken, refreshToken } = generateTokenPair(link.user)
    return frontRedirect({
      baseUrl,
      accessToken,
      refreshToken,
      user: { id: link.user.id, email: link.user.email, name: link.user.name },
      redirectAfter: popped.redirectAfter,
    })
  } catch (err) {
    console.error('Google OAuth callback 실패:', err)
    return frontRedirect({
      baseUrl,
      error: '서버 내부 오류가 발생했습니다.',
    })
  }
}
