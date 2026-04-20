import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import {
  getProjectById,
  updateProject,
  deleteProject,
  ProjectRow,
} from '@/lib/db/queries/projectQueries'

interface UpdateProjectBody {
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
 * GET /api/teams/:teamId/projects/:projectId
 *
 * 프로젝트 상세 조회
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

    return NextResponse.json(toProjectResponse(project))
  } catch (err) {
    console.error('Get project detail error:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * PATCH /api/teams/:teamId/projects/:projectId
 *
 * 프로젝트 수정 (생성자만 가능)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, projectId } = await params

    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    const existing = await getProjectById(teamId, projectId)
    if (!existing) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (existing.created_by !== authResult.user.userId) {
      return NextResponse.json(
        { error: '프로젝트 생성자만 수정할 수 있습니다.' },
        { status: 403 }
      )
    }

    const body: UpdateProjectBody = await request.json()
    const { name, description, startDate, endDate, progress, manager, phases } = body

    if (name !== undefined && name.length > 200) {
      return NextResponse.json(
        { error: '프로젝트 이름은 최대 200자까지 입력 가능합니다.' },
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

    const updateParams: UpdateProjectBody = {}
    if ('name' in body) updateParams.name = name
    if ('description' in body) updateParams.description = description
    if ('startDate' in body) updateParams.startDate = startDate
    if ('endDate' in body) updateParams.endDate = endDate
    if ('progress' in body) updateParams.progress = progress
    if ('manager' in body) updateParams.manager = manager
    if ('phases' in body) updateParams.phases = phases

    const updated = await updateProject(teamId, projectId, updateParams)

    if (!updated) {
      return NextResponse.json({ error: '프로젝트 수정에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json(toProjectResponse(updated))
  } catch (err) {
    console.error('Update project error:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * DELETE /api/teams/:teamId/projects/:projectId
 *
 * 프로젝트 삭제 (생성자만 가능)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, projectId } = await params

    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    const existing = await getProjectById(teamId, projectId)
    if (!existing) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (existing.created_by !== authResult.user.userId) {
      return NextResponse.json(
        { error: '프로젝트 생성자만 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }

    const deleted = await deleteProject(teamId, projectId)

    if (!deleted) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ message: '프로젝트가 삭제되었습니다.' })
  } catch (err) {
    console.error('Delete project error:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
