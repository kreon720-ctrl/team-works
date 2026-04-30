import { pool } from '@/lib/db/pool'

export interface NoticeRow {
  id: string
  team_id: string
  project_id: string | null
  sender_id: string
  sender_name: string | null
  content: string
  created_at: Date
}

// 팀 일자별 채팅 공지 — project_id IS NULL 만 반환.
export async function getNoticesByTeam(teamId: string): Promise<NoticeRow[]> {
  try {
    const result = await pool.query<NoticeRow>(
      `SELECT n.id, n.team_id, n.project_id, n.sender_id, u.name AS sender_name, n.content, n.created_at
       FROM notices n
       LEFT JOIN users u ON u.id = n.sender_id
       WHERE n.team_id = $1 AND n.project_id IS NULL
       ORDER BY n.created_at ASC`,
      [teamId]
    )
    return result.rows
  } catch (err) {
    throw new Error('getNoticesByTeam 실패: ' + (err as Error).message)
  }
}

// 프로젝트 전용 공지 — 같은 팀의 같은 프로젝트 공지만 반환.
export async function getNoticesByProject(
  teamId: string,
  projectId: string
): Promise<NoticeRow[]> {
  try {
    const result = await pool.query<NoticeRow>(
      `SELECT n.id, n.team_id, n.project_id, n.sender_id, u.name AS sender_name, n.content, n.created_at
       FROM notices n
       LEFT JOIN users u ON u.id = n.sender_id
       WHERE n.team_id = $1 AND n.project_id = $2
       ORDER BY n.created_at ASC`,
      [teamId, projectId]
    )
    return result.rows
  } catch (err) {
    throw new Error('getNoticesByProject 실패: ' + (err as Error).message)
  }
}

export async function createNotice(
  teamId: string,
  senderId: string,
  content: string,
  projectId: string | null = null
): Promise<NoticeRow> {
  try {
    const result = await pool.query<NoticeRow>(
      `WITH inserted AS (
         INSERT INTO notices (team_id, project_id, sender_id, content)
         VALUES ($1, $2, $3, $4)
         RETURNING id, team_id, project_id, sender_id, content, created_at
       )
       SELECT i.id, i.team_id, i.project_id, i.sender_id, u.name AS sender_name, i.content, i.created_at
       FROM inserted i
       LEFT JOIN users u ON u.id = i.sender_id`,
      [teamId, projectId, senderId, content]
    )
    return result.rows[0]
  } catch (err) {
    throw new Error('createNotice 실패: ' + (err as Error).message)
  }
}

export async function getNoticeById(
  teamId: string,
  noticeId: string
): Promise<NoticeRow | null> {
  try {
    const result = await pool.query<NoticeRow>(
      `SELECT n.id, n.team_id, n.project_id, n.sender_id, u.name AS sender_name, n.content, n.created_at
       FROM notices n
       LEFT JOIN users u ON u.id = n.sender_id
       WHERE n.team_id = $1 AND n.id = $2`,
      [teamId, noticeId]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error('getNoticeById 실패: ' + (err as Error).message)
  }
}

export async function deleteNotice(teamId: string, noticeId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `DELETE FROM notices WHERE team_id = $1 AND id = $2`,
      [teamId, noticeId]
    )
    return (result.rowCount ?? 0) > 0
  } catch (err) {
    throw new Error('deleteNotice 실패: ' + (err as Error).message)
  }
}
