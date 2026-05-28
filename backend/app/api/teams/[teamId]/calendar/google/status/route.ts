import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import { getTeamById } from '@/lib/db/queries/teamQueries'
import { getGoogleCalendarIntegrationStatus } from '@/lib/google/calendarIntegrationService'

export async function GET(
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

    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    const status = await getGoogleCalendarIntegrationStatus({
      teamId,
      userId: authResult.user.userId,
    })

    return NextResponse.json(status)
  } catch (err) {
    console.error('Google Calendar status 실패:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
