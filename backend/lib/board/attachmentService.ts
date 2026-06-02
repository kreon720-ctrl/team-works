// 자료실 첨부파일 처리 서비스 — 검증·스토리지 저장·DB 연결·실패 보상을 한 곳에 모은다.
// route 핸들러는 인증/인가·폼 파싱·직렬화만 담당하고, 첨부 절차는 이 서비스에 위임한다.
//
// validateUpload 는 ValidationError 를 throw 할 수 있으며, 호출하는 route 의 catch 가
// ValidationError 를 상태코드로 변환해 응답한다(동작 보존).
import { addAttachment, removeAttachmentsByPost } from '@/lib/db/queries/boardQueries'
import { createStorageAdapter } from '@/lib/files/storage'
import { validateUpload } from '@/lib/files/validate'

/**
 * 파일 1개를 검증·저장한 뒤 글에 첨부 레코드로 연결한다.
 * DB INSERT 실패 시 방금 저장한 디스크/스토리지 파일을 정리(best effort)한 후 에러를 재전파한다.
 */
export async function attachFileToPost(postId: string, file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const validated = validateUpload(buffer, file.type, file.name)
  const storage = createStorageAdapter()
  const saved = await storage.save(buffer, {
    mimeType: validated.mimeType,
    originalName: file.name,
  })
  try {
    return await addAttachment({
      postId,
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

/**
 * 글의 기존 첨부를 모두 제거(디스크 unlink 포함)한 뒤 새 파일을 연결한다. PATCH 교체용.
 * (1단계는 글당 단일 첨부만 지원.)
 */
export async function replacePostAttachment(postId: string, file: File) {
  const storage = createStorageAdapter()
  const oldStoredNames = await removeAttachmentsByPost(postId)
  // 기존 디스크 파일 unlink (best effort).
  for (const name of oldStoredNames) {
    await storage.delete(name).catch(() => {})
  }
  return attachFileToPost(postId, file)
}
