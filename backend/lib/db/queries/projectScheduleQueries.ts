import { pool } from '@/lib/db/pool'

export interface ProjectScheduleRow {
  id: string
  project_id: string
  team_id: string
  created_by: string
  title: string
  description: string | null
  color: string
  start_date: string
  end_date: string
  leader: string
  progress: number
  is_delayed: boolean
  phase_id: string | null
  created_at: Date
  updated_at: Date
}

export interface CreateProjectScheduleParams {
  projectId: string
  teamId: string
  createdBy: string
  title: string
  description?: string | null
  color?: string
  startDate: string
  endDate: string
  leader?: string
  progress?: number
  isDelayed?: boolean
  phaseId?: string | null
}

export interface UpdateProjectScheduleParams {
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

export async function getProjectSchedules(
  projectId: string
): Promise<ProjectScheduleRow[]> {
  try {
    const result = await pool.query<ProjectScheduleRow>(
      `SELECT id, project_id, team_id, created_by, title, description, color,
              start_date, end_date, leader, progress, is_delayed, phase_id, created_at, updated_at
       FROM project_schedules
       WHERE project_id = $1
       ORDER BY created_at ASC`,
      [projectId]
    )
    return result.rows
  } catch (err) {
    throw new Error('getProjectSchedules 실패: ' + (err as Error).message)
  }
}

export async function getProjectScheduleById(
  projectId: string,
  scheduleId: string
): Promise<ProjectScheduleRow | null> {
  try {
    const result = await pool.query<ProjectScheduleRow>(
      `SELECT id, project_id, team_id, created_by, title, description, color,
              start_date, end_date, leader, progress, is_delayed, phase_id, created_at, updated_at
       FROM project_schedules
       WHERE project_id = $1 AND id = $2`,
      [projectId, scheduleId]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error('getProjectScheduleById 실패: ' + (err as Error).message)
  }
}

export async function createProjectSchedule(
  params: CreateProjectScheduleParams
): Promise<ProjectScheduleRow> {
  const {
    projectId,
    teamId,
    createdBy,
    title,
    description,
    color,
    startDate,
    endDate,
    leader,
    progress,
    isDelayed,
    phaseId,
  } = params
  try {
    const result = await pool.query<ProjectScheduleRow>(
      `INSERT INTO project_schedules
         (project_id, team_id, created_by, title, description, color, start_date, end_date, leader, progress, is_delayed, phase_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, project_id, team_id, created_by, title, description, color,
                 start_date, end_date, leader, progress, is_delayed, phase_id, created_at, updated_at`,
      [
        projectId,
        teamId,
        createdBy,
        title,
        description ?? null,
        color ?? 'indigo',
        startDate,
        endDate,
        leader ?? '',
        progress ?? 0,
        isDelayed ?? false,
        phaseId ?? null,
      ]
    )
    return result.rows[0]
  } catch (err) {
    throw new Error('createProjectSchedule 실패: ' + (err as Error).message)
  }
}

export async function updateProjectSchedule(
  projectId: string,
  scheduleId: string,
  params: UpdateProjectScheduleParams
): Promise<ProjectScheduleRow | null> {
  const { title, description, color, startDate, endDate, leader, progress, isDelayed, phaseId } =
    params
  try {
    const result = await pool.query<ProjectScheduleRow>(
      `UPDATE project_schedules
       SET title       = COALESCE($3, title),
           description = CASE WHEN $4::boolean THEN $5 ELSE description END,
           color       = COALESCE($6, color),
           start_date  = COALESCE($7, start_date),
           end_date    = COALESCE($8, end_date),
           leader      = COALESCE($9, leader),
           progress    = COALESCE($10, progress),
           is_delayed  = COALESCE($11, is_delayed),
           phase_id    = CASE WHEN $12::boolean THEN $13 ELSE phase_id END,
           updated_at  = now()
       WHERE project_id = $1 AND id = $2
       RETURNING id, project_id, team_id, created_by, title, description, color,
                 start_date, end_date, leader, progress, is_delayed, phase_id, created_at, updated_at`,
      [
        projectId,
        scheduleId,
        title ?? null,
        'description' in params,
        description ?? null,
        color ?? null,
        startDate ?? null,
        endDate ?? null,
        leader ?? null,
        progress ?? null,
        isDelayed ?? null,
        'phaseId' in params,
        phaseId ?? null,
      ]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error('updateProjectSchedule 실패: ' + (err as Error).message)
  }
}

export async function deleteProjectSchedule(
  projectId: string,
  scheduleId: string
): Promise<boolean> {
  try {
    const result = await pool.query(
      `DELETE FROM project_schedules
       WHERE project_id = $1 AND id = $2`,
      [projectId, scheduleId]
    )
    return (result.rowCount ?? 0) > 0
  } catch (err) {
    throw new Error('deleteProjectSchedule 실패: ' + (err as Error).message)
  }
}
