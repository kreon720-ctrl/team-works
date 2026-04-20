import { pool } from '@/lib/db/pool'

export interface SubScheduleRow {
  id: string
  project_schedule_id: string
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
  created_at: Date
  updated_at: Date
}

export interface CreateSubScheduleParams {
  projectScheduleId: string
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
}

export interface UpdateSubScheduleParams {
  title?: string
  description?: string | null
  color?: string
  startDate?: string
  endDate?: string
  leader?: string
  progress?: number
  isDelayed?: boolean
}

export async function getSubSchedules(
  projectScheduleId: string
): Promise<SubScheduleRow[]> {
  try {
    const result = await pool.query<SubScheduleRow>(
      `SELECT id, project_schedule_id, project_id, team_id, created_by, title, description,
              color, start_date, end_date, leader, progress, is_delayed, created_at, updated_at
       FROM sub_schedules
       WHERE project_schedule_id = $1
       ORDER BY created_at ASC`,
      [projectScheduleId]
    )
    return result.rows
  } catch (err) {
    throw new Error('getSubSchedules 실패: ' + (err as Error).message)
  }
}

export async function getSubScheduleById(
  projectScheduleId: string,
  subId: string
): Promise<SubScheduleRow | null> {
  try {
    const result = await pool.query<SubScheduleRow>(
      `SELECT id, project_schedule_id, project_id, team_id, created_by, title, description,
              color, start_date, end_date, leader, progress, is_delayed, created_at, updated_at
       FROM sub_schedules
       WHERE project_schedule_id = $1 AND id = $2`,
      [projectScheduleId, subId]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error('getSubScheduleById 실패: ' + (err as Error).message)
  }
}

export async function createSubSchedule(
  params: CreateSubScheduleParams
): Promise<SubScheduleRow> {
  const {
    projectScheduleId,
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
  } = params
  try {
    const result = await pool.query<SubScheduleRow>(
      `INSERT INTO sub_schedules
         (project_schedule_id, project_id, team_id, created_by, title, description, color, start_date, end_date, leader, progress, is_delayed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, project_schedule_id, project_id, team_id, created_by, title, description,
                 color, start_date, end_date, leader, progress, is_delayed, created_at, updated_at`,
      [
        projectScheduleId,
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
      ]
    )
    return result.rows[0]
  } catch (err) {
    throw new Error('createSubSchedule 실패: ' + (err as Error).message)
  }
}

export async function updateSubSchedule(
  projectScheduleId: string,
  subId: string,
  params: UpdateSubScheduleParams
): Promise<SubScheduleRow | null> {
  const { title, description, color, startDate, endDate, leader, progress, isDelayed } = params
  try {
    const result = await pool.query<SubScheduleRow>(
      `UPDATE sub_schedules
       SET title       = COALESCE($3, title),
           description = CASE WHEN $4::boolean THEN $5 ELSE description END,
           color       = COALESCE($6, color),
           start_date  = COALESCE($7, start_date),
           end_date    = COALESCE($8, end_date),
           leader      = COALESCE($9, leader),
           progress    = COALESCE($10, progress),
           is_delayed  = COALESCE($11, is_delayed),
           updated_at  = now()
       WHERE project_schedule_id = $1 AND id = $2
       RETURNING id, project_schedule_id, project_id, team_id, created_by, title, description,
                 color, start_date, end_date, leader, progress, is_delayed, created_at, updated_at`,
      [
        projectScheduleId,
        subId,
        title ?? null,
        'description' in params,
        description ?? null,
        color ?? null,
        startDate ?? null,
        endDate ?? null,
        leader ?? null,
        progress ?? null,
        isDelayed ?? null,
      ]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error('updateSubSchedule 실패: ' + (err as Error).message)
  }
}

export async function deleteSubSchedule(
  projectScheduleId: string,
  subId: string
): Promise<boolean> {
  try {
    const result = await pool.query(
      `DELETE FROM sub_schedules
       WHERE project_schedule_id = $1 AND id = $2`,
      [projectScheduleId, subId]
    )
    return (result.rowCount ?? 0) > 0
  } catch (err) {
    throw new Error('deleteSubSchedule 실패: ' + (err as Error).message)
  }
}
