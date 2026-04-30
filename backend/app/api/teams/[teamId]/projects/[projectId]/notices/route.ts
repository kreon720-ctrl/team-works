import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import { getProjectById } from '@/lib/db/queries/projectQueries'
import { getNoticesByProject, createNotice } from '@/lib/db/queries/noticeQueries'

interface CreateNoticeBody {
  content?: string
}

/**
 * GET /api/teams/:teamId/projects/:projectId/notices
 *
 * 프로젝트 전용 공지사항 조회
 * - 같은 팀의 같은 프로젝트 공지만 반환 (project_id 기반 격리)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, projectId } = await params

    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    const project = await getProjectById(teamId, projectId)
    if (!project) {
      return NextResponse.json(
        { error: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const notices = await getNoticesByProject(teamId, projectId)

    return NextResponse.json({
      projectId,
      notices: notices.map((notice) => ({
        id: notice.id,
        teamId: notice.team_id,
        projectId: notice.project_id,
        senderId: notice.sender_id,
        senderName: notice.sender_name,
        content: notice.content,
        createdAt: notice.created_at,
      })),
    })
  } catch (err) {
    console.error('Get project notices error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/teams/:teamId/projects/:projectId/notices
 *
 * 프로젝트 전용 공지 생성 — 모든 팀원, project_id 채워서 INSERT.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, projectId } = await params

    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    const project = await getProjectById(teamId, projectId)
    if (!project) {
      return NextResponse.json(
        { error: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const body: CreateNoticeBody = await request.json()
    const { content } = body

    if (!content) {
      return NextResponse.json({ error: '내용은 필수입니다.' }, { status: 400 })
    }
    if (content.length > 2000) {
      return NextResponse.json(
        { error: '내용은 최대 2000자까지 입력 가능합니다.' },
        { status: 400 }
      )
    }

    const notice = await createNotice(
      teamId,
      authResult.user.userId,
      content,
      projectId
    )

    return NextResponse.json(
      {
        id: notice.id,
        teamId: notice.team_id,
        projectId: notice.project_id,
        senderId: notice.sender_id,
        senderName: notice.sender_name,
        content: notice.content,
        createdAt: notice.created_at,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Create project notice error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
