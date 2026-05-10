/**
 * S3StorageAdapter — 운영 전환 시 구현될 placeholder.
 *
 * 구현 가이드:
 *  1. `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` 추가
 *  2. 아래 throw 를 제거하고 PutObjectCommand / DeleteObjectCommand / getSignedUrl 로 채움
 *  3. download() 는 `{ kind: 'redirect', url: presignedUrl }` 반환 — 클라이언트가 S3 에서 직접 GET
 *  4. env: STORAGE_S3_BUCKET, STORAGE_S3_REGION, STORAGE_S3_PRESIGN_TTL_SEC, AWS 자격증명 (또는 IAM role)
 *  5. 마이그레이션 스크립트 `scripts/migrate-files-to-s3.ts` 1회 실행 — files/* → S3 PUT, idempotent
 *
 * 인터페이스(`save`/`delete`/`download`) 는 LocalStorageAdapter 와 동일 → 호출처 코드 변경 0.
 */

import type { StorageAdapter, SaveResult, DownloadResult } from './storage'

export class S3StorageAdapter implements StorageAdapter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async save(_buffer: Buffer, _opts: { mimeType: string; originalName: string }): Promise<SaveResult> {
    throw new Error(
      'S3StorageAdapter 미구현 — 운영 전환 시 backend/lib/files/s3Storage.ts 본 메서드 채움'
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async delete(_storedName: string): Promise<void> {
    throw new Error('S3StorageAdapter 미구현')
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async download(_storedName: string, _opts: { mimeType: string }): Promise<DownloadResult> {
    throw new Error('S3StorageAdapter 미구현')
  }
}
