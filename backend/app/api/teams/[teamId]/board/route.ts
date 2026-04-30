import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import { getProjectById } from '@/lib/db/queries/projectQueries'
import {
  getPosts,
  createPost,
  addAttachment,
} from '@/lib/db/queries/boardQueries'
import { createStorageAdapter } from '@/lib/files/storage'
import { validateUpload, ValidationError, MAX_FILE_SIZE } from '@/lib/files/validate'

/**
 * GET /api/teams/:teamId/board?projectId=...
 *
 * 자료실 글 목록. projectId 있으면 그 프로젝트 자료실, 없으면 팀 일자별 자료실.
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

    const projectId = request.nextUrl.searchParams.get('projectId')
    if (projectId) {
      const project = await getProjectById(teamId, projectId)
      if (!project) {
        return NextResponse.json(
          { error: '프로젝트를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }
    }

    const posts = await getPosts(teamId, projectId)
    return NextResponse.json({
      projectId,
      posts: posts.map(toPostResponse),
    })
  } catch (err) {
    console.error('Get board posts error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/teams/:teamId/board
 *
 * 글 생성. multipart/form-data — title, content, projectId(optional), file(optional).
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

    // Content-Length 사전 거부 — multipart 헤더 + 본문 모두 합한 값이라 약간 여유 둠.
    const contentLength = Number(request.headers.get('content-length') ?? '0')
    if (contentLength > MAX_FILE_SIZE + 1024 * 1024) {
      return NextResponse.json(
        { error: '요청 본문이 너무 큽니다. 첨부파일은 최대 10MB.' },
        { status: 413 }
      )
    }

    const formData = await request.formData()
    const title = String(formData.get('title') ?? '').trim()
    const content = String(formData.get('content') ?? '').trim()
    const projectIdRaw = formData.get('projectId')
    const projectId = projectIdRaw && String(projectIdRaw).trim() !== '' ? String(projectIdRaw) : null
    const file = formData.get('file')

    if (!title) {
      return NextResponse.json({ error: '제목은 필수입니다.' }, { status: 400 })
    }
    if (title.length > 200) {
      return NextResponse.json({ error: '제목은 최대 200자까지 입력 가능합니다.' }, { status: 400 })
    }
    if (content.length > 20000) {
      return NextResponse.json({ error: '본문은 최대 20000자까지 입력 가능합니다.' }, { status: 400 })
    }

    if (projectId) {
      const project = await getProjectById(teamId, projectId)
      if (!project) {
        return NextResponse.json(
          { error: '프로젝트를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }
    }

    // 글 생성
    const post = await createPost({
      teamId,
      projectId,
      authorId: authResult.user.userId,
      title,
      content,
    })

    // 첨부 처리 (있을 때만)
    let attachmentRow = null
    if (file && file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const validated = validateUpload(buffer, file.type, file.name)
      const storage = createStorageAdapter()
      const saved = await storage.save(buffer, {
        mimeType: validated.mimeType,
        originalName: file.name,
      })
      try {
        attachmentRow = await addAttachment({
          postId: post.id,
          originalName: file.name,
          storedName: saved.storedName,
          mimeType: validated.mimeType,
          sizeBytes: saved.sizeBytes,
        })
      } catch (err) {
        // DB INSERT 실패 시 디스크 파일 정리 — best effort.
        await storage.delete(saved.storedName).catch(() => {})
        throw err
      }
    }

    return NextResponse.json(
      toPostResponse({ ...post, attachments: attachmentRow ? [attachmentRow] : [] }),
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('Create board post error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 응답 직렬화 — DB row 의 snake_case 를 frontend 친화적인 camelCase 로.
type PostInput = Awaited<ReturnType<typeof getPosts>>[number] | (
  Awaited<ReturnType<typeof createPost>> & { attachments: Awaited<ReturnType<typeof addAttachment>>[] }
)

function toPostResponse(p: PostInput) {
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
