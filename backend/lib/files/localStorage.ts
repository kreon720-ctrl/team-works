import { promises as fs, createReadStream, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { StorageAdapter, SaveResult, DownloadResult } from './storage'
import { safeExtension } from './validate'

/**
 * 호스트 디렉토리에 파일 저장. 1단계 운영 어댑터.
 *
 * - stored_name = `<UUID><.ext>` — 디스크 + DB 모두 같은 식별자.
 * - 원본 파일명은 DB 의 original_name 컬럼에만 기록 (path traversal·인코딩 위험 격리).
 * - download() 는 stream 반환 — backend 가 직접 응답 본문에 흘려보냄.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly baseDir: string

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  async save(
    buffer: Buffer,
    opts: { mimeType: string; originalName: string }
  ): Promise<SaveResult> {
    await fs.mkdir(this.baseDir, { recursive: true })
    const ext = safeExtension(opts.originalName)
    const storedName = `${randomUUID()}${ext}`
    const fullPath = path.join(this.baseDir, storedName)
    await fs.writeFile(fullPath, buffer, { mode: 0o644 })
    return { storedName, sizeBytes: buffer.length }
  }

  async delete(storedName: string): Promise<void> {
    if (!isSafeStoredName(storedName)) {
      throw new Error(`Invalid storedName: ${storedName}`)
    }
    const fullPath = path.join(this.baseDir, storedName)
    try {
      await fs.unlink(fullPath)
    } catch (err) {
      // 이미 삭제됐거나 누군가 파일 시스템에서 직접 지운 경우는 silent — DB row 정리는 정상 진행.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }

  async download(
    storedName: string,
    opts: { mimeType: string }
  ): Promise<DownloadResult> {
    if (!isSafeStoredName(storedName)) {
      throw new Error(`Invalid storedName: ${storedName}`)
    }
    const fullPath = path.join(this.baseDir, storedName)
    const stat = statSync(fullPath) // 호출 전 존재 확인. 없으면 ENOENT throw → 404 변환은 호출처 책임.
    const nodeStream = createReadStream(fullPath)
    // Node Readable → Web ReadableStream 변환 (Next.js 16 Response body 호환).
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>
    return {
      kind: 'stream',
      body: webStream,
      size: stat.size,
      contentType: opts.mimeType,
    }
  }
}

// stored_name 안전성 — UUID + 확장자만 허용. path traversal·hidden file 차단.
function isSafeStoredName(name: string): boolean {
  return /^[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/.test(name)
}
