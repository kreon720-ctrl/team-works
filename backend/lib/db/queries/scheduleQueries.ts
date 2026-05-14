import { pool } from '@/lib/db/pool'

export interface Schedule {
  id: string
  team_id: string
  created_by: string
  creator_name: string | null
  title: string
  description: string | null
  color: string
  start_at: Date
  // 종료시각 선택 입력. null 이면 시작시각만 정해진 일정.
  end_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface CreateScheduleParams {
  teamId: string
  createdBy: string
  title: string
  description?: string | null
  color?: string
  startAt: Date
  endAt?: Date | null
}

export interface UpdateScheduleParams {
  title?: string
  description?: string | null
  color?: string
  startAt?: Date
  endAt?: Date | null
}

export async function createSchedule(params: CreateScheduleParams): Promise<Schedule> {
  const { teamId, createdBy, title, description, color, startAt, endAt } = params
  try {
    const result = await pool.query<Schedule>(
      `INSERT INTO schedules (team_id, created_by, title, description, color, start_at, end_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, team_id, created_by, title, description, color, start_at, end_at, created_at, updated_at`,
      [teamId, createdBy, title, description ?? null, color ?? 'indigo', startAt, endAt ?? null]
    )
    return result.rows[0]
  } catch (err) {
    throw new Error(`createSchedule 실패: ${(err as Error).message}`)
  }
}

export async function getSchedulesByDateRange(
  teamId: string,
  startAt: Date,
  endAt: Date
): Promise<Schedule[]> {
  try {
    // end_at IS NULL → 종료시각 없는 일정도 시작시각이 범위 안이면 포함.
    // (안 그러면 nullable 일정이 "이번 주 일정" 등 범위 조회에서 누락됨)
    const result = await pool.query<Schedule>(
      `SELECT s.id, s.team_id, s.created_by, u.name AS creator_name, s.title, s.description, s.color, s.start_at, s.end_at, s.created_at, s.updated_at
       FROM schedules s
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.team_id = $1
         AND s.start_at < $3
         AND (s.end_at IS NULL OR s.end_at > $2)
       ORDER BY s.start_at ASC`,
      [teamId, startAt, endAt]
    )
    return result.rows
  } catch (err) {
    throw new Error(`getSchedulesByDateRange 실패: ${(err as Error).message}`)
  }
}

export async function getScheduleById(
  teamId: string,
  id: string
): Promise<Schedule | null> {
  try {
    const result = await pool.query<Schedule>(
      `SELECT s.id, s.team_id, s.created_by, u.name AS creator_name, s.title, s.description, s.color, s.start_at, s.end_at, s.created_at, s.updated_at
       FROM schedules s
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.team_id = $1 AND s.id = $2`,
      [teamId, id]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error(`getScheduleById 실패: ${(err as Error).message}`)
  }
}

export async function updateSchedule(
  teamId: string,
  id: string,
  params: UpdateScheduleParams
): Promise<Schedule | null> {
  const { title, description, color, startAt, endAt } = params
  try {
    const result = await pool.query<Schedule>(
      `UPDATE schedules
       SET title       = COALESCE($3, title),
           description = CASE WHEN $4::boolean THEN $5 ELSE description END,
           color       = COALESCE($8, color),
           start_at    = COALESCE($6, start_at),
           end_at      = COALESCE($7, end_at),
           updated_at  = now()
       WHERE team_id = $1 AND id = $2
       RETURNING id, team_id, created_by, title, description, color, start_at, end_at, created_at, updated_at`,
      [
        teamId,
        id,
        title ?? null,
        'description' in params,
        description ?? null,
        startAt ?? null,
        endAt ?? null,
        color ?? null,
      ]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error(`updateSchedule 실패: ${(err as Error).message}`)
  }
}

export async function deleteSchedule(teamId: string, id: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `DELETE FROM schedules
       WHERE team_id = $1 AND id = $2`,
      [teamId, id]
    )
    return (result.rowCount ?? 0) > 0
  } catch (err) {
    throw new Error(`deleteSchedule 실패: ${(err as Error).message}`)
  }
}
