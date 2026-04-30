import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import { getProjectById } from '@/lib/db/queries/projectQueries'
import {
  getMessagesByProject,
  createChatMessage,
  MessageType,
} from '@/lib/db/queries/chatQueries'

interface CreateMessageBody {
  type?: MessageType
  content?: string
}

/**
 * GET /api/teams/:teamId/projects/:projectId/messages
 *
 * 프로젝트 전용 채팅 메시지 조회 (폴링용)
 * - 같은 프로젝트의 모든 메시지를 sent_at ASC 로 max 200건 반환.
 * - WORK_PERFORMANCE 타입은 LEADER 또는 권한 보유자만 조회 가능.
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

    // 프로젝트가 이 팀에 속한지 검증 (다른 팀 프로젝트의 채팅 접근 차단)
    const project = await getProjectById(teamId, projectId)
    if (!project) {
      return NextResponse.json(
        { error: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const messages = await getMessagesByProject(
      teamId,
      projectId,
      authResult.user.userId,
      roleResult.context.role as 'LEADER' | 'MEMBER'
    )

    return NextResponse.json({
      projectId,
      messages: messages.map((msg) => ({
        id: msg.id,
        teamId: msg.team_id,
        projectId: msg.project_id,
        senderId: msg.sender_id,
        senderName: msg.sender_name,
        type: msg.type,
        content: msg.content,
        sentAt: msg.sent_at,
        createdAt: msg.created_at,
      })),
    })
  } catch (err) {
    console.error('Get project messages error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/teams/:teamId/projects/:projectId/messages
 *
 * 프로젝트 전용 채팅 메시지 전송
 * - NORMAL/WORK_PERFORMANCE 타입 모두 저장 (권한 검증은 조회 시에 적용)
 * - content 최대 2000자
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

    const body: CreateMessageBody = await request.json()
    const { type = 'NORMAL', content } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: '메시지 내용은 필수입니다.' },
        { status: 400 }
      )
    }
    if (content.length > 2000) {
      return NextResponse.json(
        { error: '메시지는 최대 2000자까지 입력 가능합니다.' },
        { status: 400 }
      )
    }
    if (type !== 'NORMAL' && type !== 'WORK_PERFORMANCE') {
      return NextResponse.json(
        { error: '잘못된 메시지 타입입니다.' },
        { status: 400 }
      )
    }

    const message = await createChatMessage({
      teamId,
      projectId,
      senderId: authResult.user.userId,
      type,
      content,
      sentAt: new Date(),
    })

    return NextResponse.json(
      {
        id: message.id,
        teamId: message.team_id,
        projectId: message.project_id,
        senderId: message.sender_id,
        senderName: message.sender_name,
        type: message.type,
        content: message.content,
        sentAt: message.sent_at,
        createdAt: message.created_at,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Create project message error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
