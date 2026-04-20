import { pool } from '@/lib/db/pool'

export interface ProjectRow {
  id: string
  team_id: string
  created_by: string
  name: string
  description: string | null
  start_date: string // DATE returns as string from pg
  end_date: string
  progress: number
  manager: string
  phases: Array<{ id: string; name: string; order: number }>
  created_at: Date
  updated_at: Date
}

export interface CreateProjectParams {
  teamId: string
  createdBy: string
  name: string
  description?: string | null
  startDate: string
  endDate: string
  progress: number
  manager: string
  phases: Array<{ id: string; name: string; order: number }>
}

export interface UpdateProjectParams {
  name?: string
  description?: string | null
  startDate?: string
  endDate?: string
  progress?: number
  manager?: string
  phases?: Array<{ id: string; name: string; order: number }>
}

export async function getProjectsByTeam(teamId: string): Promise<ProjectRow[]> {
  try {
    const result = await pool.query<ProjectRow>(
      `SELECT id, team_id, created_by, name, description, start_date, end_date,
              progress, manager, phases, created_at, updated_at
       FROM projects
       WHERE team_id = $1
       ORDER BY created_at ASC`,
      [teamId]
    )
    return result.rows
  } catch (err) {
    throw new Error('getProjectsByTeam 실패: ' + (err as Error).message)
  }
}

export async function getProjectById(
  teamId: string,
  projectId: string
): Promise<ProjectRow | null> {
  try {
    const result = await pool.query<ProjectRow>(
      `SELECT id, team_id, created_by, name, description, start_date, end_date,
              progress, manager, phases, created_at, updated_at
       FROM projects
       WHERE team_id = $1 AND id = $2`,
      [teamId, projectId]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error('getProjectById 실패: ' + (err as Error).message)
  }
}

export async function createProject(params: CreateProjectParams): Promise<ProjectRow> {
  const { teamId, createdBy, name, description, startDate, endDate, progress, manager, phases } =
    params
  try {
    const result = await pool.query<ProjectRow>(
      `INSERT INTO projects (team_id, created_by, name, description, start_date, end_date, progress, manager, phases)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING id, team_id, created_by, name, description, start_date, end_date, progress, manager, phases, created_at, updated_at`,
      [
        teamId,
        createdBy,
        name,
        description ?? null,
        startDate,
        endDate,
        progress,
        manager,
        JSON.stringify(phases),
      ]
    )
    return result.rows[0]
  } catch (err) {
    throw new Error('createProject 실패: ' + (err as Error).message)
  }
}

export async function updateProject(
  teamId: string,
  projectId: string,
  params: UpdateProjectParams
): Promise<ProjectRow | null> {
  const { name, description, startDate, endDate, progress, manager, phases } = params
  try {
    const result = await pool.query<ProjectRow>(
      `UPDATE projects
       SET name        = COALESCE($3, name),
           description = CASE WHEN $4::boolean THEN $5 ELSE description END,
           start_date  = COALESCE($6, start_date),
           end_date    = COALESCE($7, end_date),
           progress    = COALESCE($8, progress),
           manager     = COALESCE($9, manager),
           phases      = CASE WHEN $10::boolean THEN $11::jsonb ELSE phases END,
           updated_at  = now()
       WHERE team_id = $1 AND id = $2
       RETURNING id, team_id, created_by, name, description, start_date, end_date, progress, manager, phases, created_at, updated_at`,
      [
        teamId,
        projectId,
        name ?? null,
        'description' in params,
        description ?? null,
        startDate ?? null,
        endDate ?? null,
        progress ?? null,
        manager ?? null,
        'phases' in params,
        phases !== undefined ? JSON.stringify(phases) : null,
      ]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error('updateProject 실패: ' + (err as Error).message)
  }
}

export async function deleteProject(teamId: string, projectId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `DELETE FROM projects
       WHERE team_id = $1 AND id = $2`,
      [teamId, projectId]
    )
    return (result.rowCount ?? 0) > 0
  } catch (err) {
    throw new Error('deleteProject 실패: ' + (err as Error).message)
  }
}
