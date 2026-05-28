import { NextRequest, NextResponse } from 'next/server'
import { popState } from '@/lib/auth/oauth/state'
import { exchangeGoogleCalendarCode } from '@/lib/auth/oauth/googleCalendar'
import { fetchGoogleUserInfo } from '@/lib/auth/oauth/google'
import { getOAuthAccountByProvider } from '@/lib/db/queries/oauthQueries'
import { createTeamCalendarIntegration } from '@/lib/db/queries/calendarIntegrationQueries'
import { getTeamById, getUserTeamRole } from '@/lib/db/queries/teamQueries'
import { encryptToken } from '@/lib/crypto/tokenEncryption'
import { resolvePublicBaseUrl } from '@/lib/api/baseUrl'

function redirectToFrontend(args: {
  baseUrl: string
  redirectAfter?: string | null
  error?: string
}): NextResponse {
  const target = new URL(args.redirectAfter || '/', args.baseUrl)
  if (args.error) {
    target.searchParams.set('calendarError', args.error)
  } else {
    target.searchParams.set('calendarConnected', 'google')
  }
  return NextResponse.redirect(target.toString())
}

function extractTeamId(redirectAfter: string | null): string | null {
  if (!redirectAfter) return null
  const match = redirectAfter.match(/^\/teams\/([^/?#]+)/)
  return match?.[1] ?? null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const baseUrl = resolvePublicBaseUrl(request)

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    if (error) {
      return redirectToFrontend({ baseUrl, error: `Google Calendar 권한 승인이 거부되었습니다: ${error}` })
    }
    if (!code || !state) {
      return redirectToFrontend({ baseUrl, error: '잘못된 Google Calendar 콜백 요청입니다.' })
    }

    const popped = await popState(state)
    if (!popped) {
      return redirectToFrontend({ baseUrl, error: '인증 세션이 만료되었거나 유효하지 않습니다. 다시 시도해주세요.' })
    }

    const teamId = extractTeamId(popped.redirectAfter)
    if (!teamId) {
      return redirectToFrontend({ baseUrl, error: 'Calendar 연동 대상 팀을 확인할 수 없습니다.' })
    }

    const tokenRes = await exchangeGoogleCalendarCode({ code, codeVerifier: popped.codeVerifier })
    if (!tokenRes.refresh_token) {
      return redirectToFrontend({
        baseUrl,
        redirectAfter: popped.redirectAfter,
        error: 'Google Calendar refresh token을 받지 못했습니다. 권한 승인 화면에서 다시 동의해주세요.',
      })
    }

    const userInfo = await fetchGoogleUserInfo(tokenRes.access_token)
    const googleAccount = await getOAuthAccountByProvider('google', userInfo.providerUserId)
    if (!googleAccount) {
      return redirectToFrontend({
        baseUrl,
        redirectAfter: popped.redirectAfter,
        error: '현재 서비스에 연결된 Google 계정만 Calendar 연동을 완료할 수 있습니다.',
      })
    }
    const googleAccountEmail = userInfo.email ?? googleAccount.provider_email
    if (!googleAccountEmail) {
      return redirectToFrontend({
        baseUrl,
        redirectAfter: popped.redirectAfter,
        error: 'Google 계정 이메일 권한이 필요합니다.',
      })
    }

    const team = await getTeamById(teamId)
    if (!team || team.is_public) {
      return redirectToFrontend({
        baseUrl,
        redirectAfter: popped.redirectAfter,
        error: 'Google Calendar 연동은 비공개 팀에서만 사용할 수 있습니다.',
      })
    }

    const role = await getUserTeamRole(teamId, googleAccount.user_id)
    if (role !== 'LEADER') {
      return redirectToFrontend({
        baseUrl,
        redirectAfter: popped.redirectAfter,
        error: '팀장만 Google Calendar 연동을 완료할 수 있습니다.',
      })
    }

    await createTeamCalendarIntegration({
      teamId,
      userId: googleAccount.user_id,
      googleCalendarId: process.env.GOOGLE_CALENDAR_DEFAULT_ID || 'primary',
      googleAccountEmail,
      encryptedRefreshToken: encryptToken(tokenRes.refresh_token),
      scope: tokenRes.scope ?? 'https://www.googleapis.com/auth/calendar.events',
    })

    return redirectToFrontend({ baseUrl, redirectAfter: popped.redirectAfter })
  } catch (err) {
    console.error('Google Calendar OAuth callback 실패:', err)
    return redirectToFrontend({
      baseUrl,
      error: 'Google Calendar 연동 처리 중 서버 오류가 발생했습니다.',
    })
  }
}
