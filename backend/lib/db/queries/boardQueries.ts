import { pool } from '@/lib/db/pool'

export interface BoardPostRow {
  id: string
  team_id: string
  project_id: string | null
  author_id: string
  author_name: string | null
  title: string
  content: string
  created_at: Date
  updated_at: Date
}

export interface BoardAttachmentRow {
  id: string
  post_id: string
  original_name: string
  stored_name: string
  mime_type: string
  size_bytes: number
  uploaded_at: Date
}

export interface BoardPostWithAttachments extends BoardPostRow {
  attachments: BoardAttachmentRow[]
}

// 글 목록 — project_id IS NULL (팀 채팅) 또는 = $2 (프로젝트 채팅).
// chat_messages 의 격리 패턴과 동일.
export async function getPosts(
  teamId: string,
  projectId: string | null
): Promise<BoardPostWithAttachments[]> {
  try {
    const baseSql = `
      SELECT p.id, p.team_id, p.project_id, p.author_id,
             u.name AS author_name, p.title, p.content,
             p.created_at, p.updated_at
      FROM board_posts p
      LEFT JOIN users u ON u.id = p.author_id
      WHERE p.team_id = $1
        ${projectId ? 'AND p.project_id = $2' : 'AND p.project_id IS NULL'}
      ORDER BY p.created_at DESC
    `
    const params = projectId ? [teamId, projectId] : [teamId]
    const postsResult = await pool.query<BoardPostRow>(baseSql, params)
    if (postsResult.rows.length === 0) return []

    // 첨부 일괄 조회 (N+1 방지).
    const postIds = postsResult.rows.map((p) => p.id)
    const attachResult = await pool.query<BoardAttachmentRow>(
      `SELECT id, post_id, original_name, stored_name, mime_type, size_bytes, uploaded_at
       FROM board_attachments
       WHERE post_id = ANY($1::uuid[])
       ORDER BY uploaded_at ASC`,
      [postIds]
    )
    const attachmentsByPost = new Map<string, BoardAttachmentRow[]>()
    for (const a of attachResult.rows) {
      const list = attachmentsByPost.get(a.post_id) ?? []
      list.push(a)
      attachmentsByPost.set(a.post_id, list)
    }
    return postsResult.rows.map((p) => ({
      ...p,
      attachments: attachmentsByPost.get(p.id) ?? [],
    }))
  } catch (err) {
    throw new Error('getPosts 실패: ' + (err as Error).message)
  }
}

export async function getPostById(
  teamId: string,
  postId: string
): Promise<BoardPostWithAttachments | null> {
  try {
    const result = await pool.query<BoardPostRow>(
      `SELECT p.id, p.team_id, p.project_id, p.author_id,
              u.name AS author_name, p.title, p.content,
              p.created_at, p.updated_at
       FROM board_posts p
       LEFT JOIN users u ON u.id = p.author_id
       WHERE p.team_id = $1 AND p.id = $2`,
      [teamId, postId]
    )
    if (result.rows.length === 0) return null
    const post = result.rows[0]
    const attach = await pool.query<BoardAttachmentRow>(
      `SELECT id, post_id, original_name, stored_name, mime_type, size_bytes, uploaded_at
       FROM board_attachments
       WHERE post_id = $1
       ORDER BY uploaded_at ASC`,
      [postId]
    )
    return { ...post, attachments: attach.rows }
  } catch (err) {
    throw new Error('getPostById 실패: ' + (err as Error).message)
  }
}

export interface CreatePostParams {
  teamId: string
  projectId: string | null
  authorId: string
  title: string
  content: string
}

export async function createPost(params: CreatePostParams): Promise<BoardPostRow> {
  const { teamId, projectId, authorId, title, content } = params
  try {
    const result = await pool.query<BoardPostRow>(
      `WITH inserted AS (
         INSERT INTO board_posts (team_id, project_id, author_id, title, content)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, team_id, project_id, author_id, title, content, created_at, updated_at
       )
       SELECT i.id, i.team_id, i.project_id, i.author_id, u.name AS author_name,
              i.title, i.content, i.created_at, i.updated_at
       FROM inserted i
       LEFT JOIN users u ON u.id = i.author_id`,
      [teamId, projectId, authorId, title, content]
    )
    return result.rows[0]
  } catch (err) {
    throw new Error('createPost 실패: ' + (err as Error).message)
  }
}

export async function updatePost(
  teamId: string,
  postId: string,
  authorId: string,
  patch: { title?: string; content?: string }
): Promise<BoardPostRow | null> {
  // 작성자만 수정 가능 — UPDATE 절에 author_id 조건 강제. WHERE 안 매치 시 0 row 반환 → null.
  try {
    const result = await pool.query<BoardPostRow>(
      `UPDATE board_posts
       SET title = COALESCE($4, title),
           content = COALESCE($5, content),
           updated_at = now()
       WHERE team_id = $1 AND id = $2 AND author_id = $3
       RETURNING id, team_id, project_id, author_id, title, content, created_at, updated_at`,
      [teamId, postId, authorId, patch.title ?? null, patch.content ?? null]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error('updatePost 실패: ' + (err as Error).message)
  }
}

// 작성자 본인의 글 삭제. 첨부파일 row 는 ON DELETE CASCADE 로 자동 정리.
// 디스크 파일 unlink 는 호출처 책임 (storage.delete).
export async function deletePost(
  teamId: string,
  postId: string,
  authorId: string
): Promise<{ deleted: boolean; storedNames: string[] }> {
  try {
    // 디스크 정리를 위해 stored_name 미리 조회.
    const attach = await pool.query<{ stored_name: string }>(
      `SELECT a.stored_name
       FROM board_attachments a
       JOIN board_posts p ON p.id = a.post_id
       WHERE p.team_id = $1 AND p.id = $2 AND p.author_id = $3`,
      [teamId, postId, authorId]
    )
    const result = await pool.query(
      `DELETE FROM board_posts WHERE team_id = $1 AND id = $2 AND author_id = $3`,
      [teamId, postId, authorId]
    )
    return {
      deleted: (result.rowCount ?? 0) > 0,
      storedNames: attach.rows.map((r) => r.stored_name),
    }
  } catch (err) {
    throw new Error('deletePost 실패: ' + (err as Error).message)
  }
}

export async function addAttachment(params: {
  postId: string
  originalName: string
  storedName: string
  mimeType: string
  sizeBytes: number
}): Promise<BoardAttachmentRow> {
  try {
    const result = await pool.query<BoardAttachmentRow>(
      `INSERT INTO board_attachments (post_id, original_name, stored_name, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, post_id, original_name, stored_name, mime_type, size_bytes, uploaded_at`,
      [
        params.postId,
        params.originalName,
        params.storedName,
        params.mimeType,
        params.sizeBytes,
      ]
    )
    return result.rows[0]
  } catch (err) {
    throw new Error('addAttachment 실패: ' + (err as Error).message)
  }
}

// 단일 첨부 정보 조회 — /api/files/:fileId 다운로드 시 사용.
// team_id 도 같이 반환해 호출처가 멤버십 검증 가능.
export async function getAttachmentForDownload(attachmentId: string): Promise<
  | (BoardAttachmentRow & { team_id: string; project_id: string | null })
  | null
> {
  try {
    const result = await pool.query<
      BoardAttachmentRow & { team_id: string; project_id: string | null }
    >(
      `SELECT a.id, a.post_id, a.original_name, a.stored_name, a.mime_type,
              a.size_bytes, a.uploaded_at, p.team_id, p.project_id
       FROM board_attachments a
       JOIN board_posts p ON p.id = a.post_id
       WHERE a.id = $1`,
      [attachmentId]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error('getAttachmentForDownload 실패: ' + (err as Error).message)
  }
}

// 첨부 단일 삭제 — 글 수정 시 기존 첨부 교체용.
export async function removeAttachmentsByPost(
  postId: string
): Promise<string[]> {
  try {
    const result = await pool.query<{ stored_name: string }>(
      `DELETE FROM board_attachments WHERE post_id = $1
       RETURNING stored_name`,
      [postId]
    )
    return result.rows.map((r) => r.stored_name)
  } catch (err) {
    throw new Error('removeAttachmentsByPost 실패: ' + (err as Error).message)
  }
}
