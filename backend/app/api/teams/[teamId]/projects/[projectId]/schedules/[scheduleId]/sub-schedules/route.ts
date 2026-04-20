import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import { getProjectScheduleById } from '@/lib/db/queries/projectScheduleQueries'
import {
  getSubSchedules,
  createSubSchedule,
  SubScheduleRow,
} from '@/lib/db/queries/subScheduleQueries'

const VALID_COLORS = ['indigo', 'blue', 'emerald', 'amber', 'rose'] as const
type ValidColor = (typeof VALID_COLORS)[number]

interface CreateSubScheduleBody {
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
 * GET /api/teams/:teamId/projects/:projectId/schedules/:scheduleId/sub-schedules
 *
 * 서브 일정 목록 조회
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ teamId: string; projectId: string; scheduleId: string }>
  }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, projectId, scheduleId } = await params

    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    const schedule = await getProjectScheduleById(projectId, scheduleId)
    if (!schedule) {
      return NextResponse.json(
        { error: '프로젝트 일정을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (schedule.team_id !== teamId) {
      return NextResponse.json(
        { error: '해당 팀에 접근 권한이 없습니다.' },
        { status: 403 }
      )
    }

    const subSchedules = await getSubSchedules(scheduleId)

    return NextResponse.json({ subSchedules: subSchedules.map(toSubScheduleResponse) })
  } catch (err) {
    console.error('Get sub-schedules error:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * POST /api/teams/:teamId/projects/:projectId/schedules/:scheduleId/sub-schedules
 *
 * 서브 일정 생성
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ teamId: string; projectId: string; scheduleId: string }>
  }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, projectId, scheduleId } = await params

    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    const schedule = await getProjectScheduleById(projectId, scheduleId)
    if (!schedule) {
      return NextResponse.json(
        { error: '프로젝트 일정을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (schedule.team_id !== teamId) {
      return NextResponse.json(
        { error: '해당 팀에 접근 권한이 없습니다.' },
        { status: 403 }
      )
    }

    const body: CreateSubScheduleBody = await request.json()
    const { title, description, color, startDate, endDate, leader, progress, isDelayed } = body

    if (!title) {
      return NextResponse.json({ error: '제목은 필수입니다.' }, { status: 400 })
    }

    if (title.length > 200) {
      return NextResponse.json(
        { error: '제목은 최대 200자까지 입력 가능합니다.' },
        { status: 400 }
      )
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: '시작일과 종료일은 필수입니다.' }, { status: 400 })
    }

    if (new Date(endDate) < new Date(startDate)) {
      return NextResponse.json(
        { error: '종료일은 시작일보다 같거나 늦어야 합니다.' },
        { status: 400 }
      )
    }

    if (color !== undefined && !VALID_COLORS.includes(color as ValidColor)) {
      return NextResponse.json(
        { error: `color는 ${VALID_COLORS.join(', ')} 중 하나여야 합니다.` },
        { status: 400 }
      )
    }

    const subSchedule = await createSubSchedule({
      projectScheduleId: scheduleId,
      projectId,
      teamId,
      createdBy: authResult.user.userId,
      title,
      description: description ?? null,
      color: color ?? 'indigo',
      startDate,
      endDate,
      leader: leader ?? '',
      progress: progress ?? 0,
      isDelayed: isDelayed ?? false,
    })

    return NextResponse.json(toSubScheduleResponse(subSchedule), { status: 201 })
  } catch (err) {
    console.error('Create sub-schedule error:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
