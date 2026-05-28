import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { requireLeader } from '@/lib/middleware/withTeamRole'
import { getTeamById } from '@/lib/db/queries/teamQueries'
import { disconnectTeamCalendarIntegration } from '@/lib/db/queries/calendarIntegrationQueries'

export async function DELETE(
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

    const leaderResult = await requireLeader(authResult.user.userId, teamId)
    if (!leaderResult.success) return leaderResult.response

    const disconnected = await disconnectTeamCalendarIntegration(teamId)
    return NextResponse.json({ disconnected })
  } catch (err) {
    console.error('Google Calendar disconnect 실패:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
