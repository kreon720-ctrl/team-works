import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import { getAttachmentForDownload } from '@/lib/db/queries/boardQueries'
import { createStorageAdapter } from '@/lib/files/storage'

/**
 * GET /api/files/:fileId
 *
 * 자료실 첨부파일 다운로드. 호출자가 첨부의 team_id 멤버여야 허용.
 *
 * 어댑터 결과에 따라 분기:
 *  - LocalStorageAdapter → stream + Content-Disposition: attachment
 *  - S3StorageAdapter → 302 redirect to presigned URL
 *
 * 클라이언트는 항상 같은 URL 사용 (/api/files/:id) — backend 가 자동 분기.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
): Promise<Response> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { fileId } = await params
    if (!fileId || !/^[0-9a-f-]{36}$/.test(fileId)) {
      return NextResponse.json({ error: '잘못된 fileId 입니다.' }, { status: 400 })
    }

    const attachment = await getAttachmentForDownload(fileId)
    if (!attachment) {
      return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 멤버십 검증 — 첨부의 team_id 와 사용자.
    const roleResult = await withTeamRole(authResult.user.userId, attachment.team_id)
    if (!roleResult.success) return roleResult.response

    const storage = createStorageAdapter()
    const dl = await storage.download(attachment.stored_name, {
      mimeType: attachment.mime_type,
    })

    if (dl.kind === 'redirect') {
      return Response.redirect(dl.url, 302)
    }

    // stream 응답 — 브라우저가 inline 렌더하지 않도록 명시적으로 attachment + nosniff.
    const filename = encodeURIComponent(attachment.original_name)
    return new Response(dl.body, {
      status: 200,
      headers: {
        'content-type': dl.contentType,
        'content-length': String(dl.size),
        'content-disposition': `attachment; filename*=UTF-8''${filename}`,
        'x-content-type-options': 'nosniff',
        'cache-control': 'private, max-age=300',
      },
    })
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return NextResponse.json(
        { error: '디스크에서 파일을 찾을 수 없습니다.' },
        { status: 410 }
      )
    }
    console.error('Download file error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
