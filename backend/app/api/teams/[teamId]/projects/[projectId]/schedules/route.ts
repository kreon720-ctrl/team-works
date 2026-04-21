import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import { getProjectById } from '@/lib/db/queries/projectQueries'
import {
  getProjectSchedules,
  createProjectSchedule,
  ProjectScheduleRow,
} from '@/lib/db/queries/projectScheduleQueries'

const VALID_COLORS = ['indigo', 'blue', 'emerald', 'amber', 'rose'] as const
type ValidColor = (typeof VALID_COLORS)[number]

interface CreateProjectScheduleBody {
  title?: string
  description?: string | null
  color?: string
  startDate?: string
  endDate?: string
  leader?: string
  progress?: number
  isDelayed?: boolean
  phaseId?: string | null
}

function formatDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().split('T')[0]
  return value as string
}

function toScheduleResponse(row: ProjectScheduleRow) {
  return {
    id: row.id,
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
    phaseId: row.phase_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * GET /api/teams/:teamId/projects/:projectId/schedules
 *
 * 프로젝트 일정 목록 조회
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
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
    }

    const schedules = await getProjectSchedules(projectId)

    return NextResponse.json({ schedules: schedules.map(toScheduleResponse) })
  } catch (err) {
    console.error('Get project schedules error:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * POST /api/teams/:teamId/projects/:projectId/schedules
 *
 * 프로젝트 일정 생성
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
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
    }

    const body: CreateProjectScheduleBody = await request.json()
    const { title, description, color, startDate, endDate, leader, progress, isDelayed, phaseId } =
      body

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

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (phaseId && !UUID_RE.test(phaseId)) {
      return NextResponse.json({ error: '유효하지 않은 단계 ID입니다.' }, { status: 400 })
    }

    const schedule = await createProjectSchedule({
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
      phaseId: phaseId ?? null,
    })

    return NextResponse.json(toScheduleResponse(schedule), { status: 201 })
  } catch (err) {
    console.error('Create project schedule error:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
