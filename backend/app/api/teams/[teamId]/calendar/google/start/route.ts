import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { requireLeader } from '@/lib/middleware/withTeamRole'
import { getTeamById } from '@/lib/db/queries/teamQueries'
import { getActiveTeamCalendarIntegration } from '@/lib/db/queries/calendarIntegrationQueries'
import { createGoogleCalendarConsentUrl } from '@/lib/google/calendarIntegrationService'

interface StartCalendarBody {
  redirectAfter?: string
}

function sanitizeRedirect(input: string | undefined | null, teamId: string): string {
  if (input && input.startsWith(`/teams/${teamId}`)) return input
  return `/teams/${teamId}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId } = await params
    const team = await getTeamById(teamId)
    if (!team) {
      return NextResponse.json({ error: '팀을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (team.is_public) {
      return NextResponse.json(
        { error: 'Google Calendar 연동은 비공개 팀에서만 사용할 수 있습니다.' },
        { status: 403 }
      )
    }

    const leaderResult = await requireLeader(authResult.user.userId, teamId)
    if (!leaderResult.success) return leaderResult.response

    const active = await getActiveTeamCalendarIntegration(teamId)
    if (active) {
      return NextResponse.json({
        status: 'connected',
        googleAccountEmail: active.google_account_email,
        googleCalendarId: active.google_calendar_id,
      })
    }

    const body: StartCalendarBody = await request.json().catch(() => ({}))
    const url = await createGoogleCalendarConsentUrl({
      teamId,
      userId: authResult.user.userId,
      redirectAfter: sanitizeRedirect(body.redirectAfter, teamId),
    })

    return NextResponse.json({ status: 'needs_consent', url })
  } catch (err) {
    console.error('Google Calendar start 실패:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
