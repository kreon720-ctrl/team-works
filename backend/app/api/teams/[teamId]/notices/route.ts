import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import { getNoticesByTeam, createNotice } from '@/lib/db/queries/noticeQueries'

interface CreateNoticeBody {
  content?: string
}

/**
 * GET /api/teams/:teamId/notices
 *
 * 팀 공지사항 목록 조회
 * - 팀 멤버만 접근 가능
 * - 등록 시간 오름차순 반환
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId } = await params

    // 1. 팀 멤버십 검증
    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    // 2. 공지사항 목록 조회
    const notices = await getNoticesByTeam(teamId)

    return NextResponse.json({
      notices: notices.map(notice => ({
        id: notice.id,
        teamId: notice.team_id,
        senderId: notice.sender_id,
        senderName: notice.sender_name,
        content: notice.content,
        createdAt: notice.created_at,
      })),
    })
  } catch (err) {
    console.error('Get notices error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/teams/:teamId/notices
 *
 * 공지사항 생성 (모든 팀원)
 * - content 필수, 최대 2000자
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId } = await params

    // 1. 팀 멤버십 검증
    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    // 2. 요청 본문 파싱 및 검증
    const body: CreateNoticeBody = await request.json()
    const { content } = body

    if (!content) {
      return NextResponse.json(
        { error: '내용은 필수입니다.' },
        { status: 400 }
      )
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: '내용은 최대 2000자까지 입력 가능합니다.' },
        { status: 400 }
      )
    }

    // 3. 공지사항 생성
    const notice = await createNotice(teamId, authResult.user.userId, content)

    return NextResponse.json(
      {
        id: notice.id,
        teamId: notice.team_id,
        senderId: notice.sender_id,
        senderName: notice.sender_name,
        content: notice.content,
        createdAt: notice.created_at,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Create notice error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
