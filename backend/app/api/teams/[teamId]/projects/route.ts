import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import { getProjectsByTeam, createProject, ProjectRow } from '@/lib/db/queries/projectQueries'

const VALID_COLORS = ['indigo', 'blue', 'emerald', 'amber', 'rose'] as const

interface CreateProjectBody {
  name?: string
  description?: string | null
  startDate?: string
  endDate?: string
  progress?: number
  manager?: string
  phases?: Array<{ id: string; name: string; order: number }>
}

function formatDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().split('T')[0]
  return value as string
}

function toProjectResponse(row: ProjectRow) {
  return {
    id: row.id,
    teamId: row.team_id,
    createdBy: row.created_by,
    name: row.name,
    description: row.description,
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    progress: row.progress,
    manager: row.manager,
    phases: row.phases,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * GET /api/teams/:teamId/projects
 *
 * 팀 프로젝트 목록 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId } = await params

    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    const projects = await getProjectsByTeam(teamId)

    return NextResponse.json({ projects: projects.map(toProjectResponse) })
  } catch (err) {
    console.error('Get projects error:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * POST /api/teams/:teamId/projects
 *
 * 프로젝트 생성
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId } = await params

    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    const body: CreateProjectBody = await request.json()
    const { name, description, startDate, endDate, progress, manager, phases } = body

    if (!name) {
      return NextResponse.json({ error: '프로젝트 이름은 필수입니다.' }, { status: 400 })
    }

    if (name.length > 200) {
      return NextResponse.json(
        { error: '프로젝트 이름은 최대 200자까지 입력 가능합니다.' },
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

    const project = await createProject({
      teamId,
      createdBy: authResult.user.userId,
      name,
      description: description ?? null,
      startDate,
      endDate,
      progress: progress ?? 0,
      manager: manager ?? '',
      phases: phases ?? [],
    })

    return NextResponse.json(toProjectResponse(project), { status: 201 })
  } catch (err) {
    console.error('Create project error:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
