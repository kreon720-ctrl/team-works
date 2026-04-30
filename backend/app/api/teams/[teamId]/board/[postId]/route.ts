import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import {
  getPostById,
  updatePost,
  deletePost,
  addAttachment,
  removeAttachmentsByPost,
} from '@/lib/db/queries/boardQueries'
import { createStorageAdapter } from '@/lib/files/storage'
import { validateUpload, ValidationError, MAX_FILE_SIZE } from '@/lib/files/validate'

/**
 * GET /api/teams/:teamId/board/:postId
 *
 * 글 상세 — 첨부 메타데이터 포함.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; postId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, postId } = await params
    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    const post = await getPostById(teamId, postId)
    if (!post) {
      return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 })
    }
    return NextResponse.json(toPostResponse(post))
  } catch (err) {
    console.error('Get board post error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/teams/:teamId/board/:postId
 *
 * 글 수정 — 작성자 본인만. multipart/form-data — title, content, file(optional).
 * file 이 동봉되면 기존 첨부 모두 unlink 후 신규 추가.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; postId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, postId } = await params
    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    const contentLength = Number(request.headers.get('content-length') ?? '0')
    if (contentLength > MAX_FILE_SIZE + 1024 * 1024) {
      return NextResponse.json(
        { error: '요청 본문이 너무 큽니다.' },
        { status: 413 }
      )
    }

    const formData = await request.formData()
    const titleRaw = formData.get('title')
    const contentRaw = formData.get('content')
    const file = formData.get('file')

    const title =
      titleRaw !== null && titleRaw !== undefined ? String(titleRaw).trim() : undefined
    const content =
      contentRaw !== null && contentRaw !== undefined ? String(contentRaw).trim() : undefined

    if (title !== undefined) {
      if (!title) return NextResponse.json({ error: '제목은 비울 수 없습니다.' }, { status: 400 })
      if (title.length > 200)
        return NextResponse.json(
          { error: '제목은 최대 200자까지 입력 가능합니다.' },
          { status: 400 }
        )
    }
    if (content !== undefined && content.length > 20000) {
      return NextResponse.json(
        { error: '본문은 최대 20000자까지 입력 가능합니다.' },
        { status: 400 }
      )
    }

    // 작성자 검증은 UPDATE 안에 author_id 조건으로 강제. 0 row 면 403.
    const updated = await updatePost(teamId, postId, authResult.user.userId, {
      title,
      content,
    })
    if (!updated) {
      // 글이 존재하는지·작성자가 다른지 구분.
      const exists = await getPostById(teamId, postId)
      if (!exists) {
        return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 })
      }
      return NextResponse.json(
        { error: '본인이 작성한 글만 수정할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 첨부파일 교체 — file 이 명시되면 기존 첨부 모두 제거 후 신규 추가.
    // (1단계는 단일 첨부만 지원.)
    if (file !== null && file !== undefined && file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const validated = validateUpload(buffer, file.type, file.name)
      const storage = createStorageAdapter()

      const oldStoredNames = await removeAttachmentsByPost(postId)
      // 기존 디스크 파일 unlink (best effort).
      for (const name of oldStoredNames) {
        await storage.delete(name).catch(() => {})
      }

      const saved = await storage.save(buffer, {
        mimeType: validated.mimeType,
        originalName: file.name,
      })
      try {
        await addAttachment({
          postId,
          originalName: file.name,
          storedName: saved.storedName,
          mimeType: validated.mimeType,
          sizeBytes: saved.sizeBytes,
        })
      } catch (err) {
        await storage.delete(saved.storedName).catch(() => {})
        throw err
      }
    }

    const fresh = await getPostById(teamId, postId)
    return NextResponse.json(fresh ? toPostResponse(fresh) : { ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('Update board post error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/teams/:teamId/board/:postId
 *
 * 글 삭제 — 작성자 본인만. 첨부 디스크 파일도 unlink.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; postId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, postId } = await params
    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    // 미리 storedNames 받아 디스크 파일 정리.
    const result = await deletePost(teamId, postId, authResult.user.userId)
    if (!result.deleted) {
      const exists = await getPostById(teamId, postId)
      if (!exists) {
        return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 })
      }
      return NextResponse.json(
        { error: '본인이 작성한 글만 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }

    const storage = createStorageAdapter()
    for (const name of result.storedNames) {
      await storage.delete(name).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Delete board post error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

function toPostResponse(p: Awaited<ReturnType<typeof getPostById>> & object) {
  return {
    id: p.id,
    teamId: p.team_id,
    projectId: p.project_id,
    authorId: p.author_id,
    authorName: p.author_name,
    title: p.title,
    content: p.content,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    attachments: p.attachments.map((a) => ({
      id: a.id,
      postId: a.post_id,
      originalName: a.original_name,
      mimeType: a.mime_type,
      sizeBytes: Number(a.size_bytes),
      uploadedAt: a.uploaded_at,
    })),
  }
}
