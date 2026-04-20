import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import { getNoticeById, deleteNotice } from '@/lib/db/queries/noticeQueries'

/**
 * DELETE /api/teams/:teamId/notices/:noticeId
 *
 * 공지사항 삭제
 * - 작성자 본인 또는 팀 LEADER만 삭제 가능
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; noticeId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, noticeId } = await params

    // 1. 팀 멤버십 검증
    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    // 2. 공지사항 존재 확인
    const notice = await getNoticeById(teamId, noticeId)
    if (!notice) {
      return NextResponse.json(
        { error: '공지사항을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 3. 권한 확인: 작성자 본인 또는 LEADER
    const isSender = notice.sender_id === authResult.user.userId
    const isLeader = roleResult.role === 'LEADER'

    if (!isSender && !isLeader) {
      return NextResponse.json(
        { error: '작성자 또는 팀 리더만 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 4. 공지사항 삭제
    await deleteNotice(teamId, noticeId)

    return NextResponse.json({ message: '공지사항이 삭제되었습니다.' })
  } catch (err) {
    console.error('Delete notice error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
