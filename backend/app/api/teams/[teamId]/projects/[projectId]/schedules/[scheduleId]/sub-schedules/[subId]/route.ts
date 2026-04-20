import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import {
  getSubScheduleById,
  updateSubSchedule,
  deleteSubSchedule,
  SubScheduleRow,
} from '@/lib/db/queries/subScheduleQueries'

const VALID_COLORS = ['indigo', 'blue', 'emerald', 'amber', 'rose'] as const
type ValidColor = (typeof VALID_COLORS)[number]

interface UpdateSubScheduleBody {
  title?: string
  description?: string | null
  color?: string
  startDate?: string
  endDate?: string
  leader?: string
  progress?: number
  isDelayed?: boolean
}

function formatDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().split('T')[0]
  return value as string
}

function toSubScheduleResponse(row: SubScheduleRow) {
  return {
    id: row.id,
    scheduleId: row.project_schedule_id,
    projectId: row.project_id,
    teamId: row.team_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    color: row.color,
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    leader: row.leader,
    progress: row.progress,
    isDelayed: row.is_delayed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * PATCH /api/teams/:teamId/projects/:projectId/schedules/:scheduleId/sub-schedules/:subId
 *
 * 서브 일정 수정 (생성자만 가능)
 */
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      teamId: string
      projectId: string
      scheduleId: string
      subId: string
    }>
  }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, projectId, scheduleId, subId } = await params

    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    const existing = await getSubScheduleById(scheduleId, subId)
    if (!existing) {
      return NextResponse.json({ error: '서브 일정을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (existing.created_by !== authResult.user.userId) {
      return NextResponse.json(
        { error: '서브 일정 생성자만 수정할 수 있습니다.' },
        { status: 403 }
      )
    }

    const body: UpdateSubScheduleBody = await request.json()
    const { title, description, color, startDate, endDate, leader, progress, isDelayed } = body

    if (title !== undefined && title.length > 200) {
      return NextResponse.json(
        { error: '제목은 최대 200자까지 입력 가능합니다.' },
        { status: 400 }
      )
    }

    if (color !== undefined && !VALID_COLORS.includes(color as ValidColor)) {
      return NextResponse.json(
        { error: `color는 ${VALID_COLORS.join(', ')} 중 하나여야 합니다.` },
        { status: 400 }
      )
    }

    if (startDate || endDate) {
      const resolvedStart = startDate ?? formatDate(existing.start_date)
      const resolvedEnd = endDate ?? formatDate(existing.end_date)
      if (new Date(resolvedEnd) < new Date(resolvedStart)) {
        return NextResponse.json(
          { error: '종료일은 시작일보다 같거나 늦어야 합니다.' },
          { status: 400 }
        )
      }
    }

    const updateParams: UpdateSubScheduleBody = {}
    if ('title' in body) updateParams.title = title
    if ('description' in body) updateParams.description = description
    if ('color' in body) updateParams.color = color
    if ('startDate' in body) updateParams.startDate = startDate
    if ('endDate' in body) updateParams.endDate = endDate
    if ('leader' in body) updateParams.leader = leader
    if ('progress' in body) updateParams.progress = progress
    if ('isDelayed' in body) updateParams.isDelayed = isDelayed

    const updated = await updateSubSchedule(scheduleId, subId, updateParams)

    if (!updated) {
      return NextResponse.json({ error: '서브 일정 수정에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json(toSubScheduleResponse(updated))
  } catch (err) {
    console.error('Update sub-schedule error:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * DELETE /api/teams/:teamId/projects/:projectId/schedules/:scheduleId/sub-schedules/:subId
 *
 * 서브 일정 삭제 (생성자만 가능)
 */
export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      teamId: string
      projectId: string
      scheduleId: string
      subId: string
    }>
  }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, projectId, scheduleId, subId } = await params

    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    const existing = await getSubScheduleById(scheduleId, subId)
    if (!existing) {
      return NextResponse.json({ error: '서브 일정을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (existing.created_by !== authResult.user.userId) {
      return NextResponse.json(
        { error: '서브 일정 생성자만 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }

    const deleted = await deleteSubSchedule(scheduleId, subId)

    if (!deleted) {
      return NextResponse.json({ error: '서브 일정을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ message: '서브 일정이 삭제되었습니다.' })
  } catch (err) {
    console.error('Delete sub-schedule error:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
