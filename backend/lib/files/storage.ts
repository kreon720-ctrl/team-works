/**
 * Storage 추상화 — 자료실 첨부파일 저장 backend 를 swappable 하게 둔다.
 *
 * 1단계: LocalStorageAdapter (호스트 디렉토리 mount).
 * 운영 전환: S3StorageAdapter (env STORAGE_BACKEND=s3 토글, 호출처 코드 0건 변경).
 *
 * 호출처는 createStorageAdapter() 가 누구를 반환하는지 신경 쓰지 않음 — save/delete/download 만 호출.
 */

export interface SaveResult {
  storedName: string
  sizeBytes: number
}

export type DownloadResult =
  | { kind: 'stream'; body: ReadableStream<Uint8Array>; size: number; contentType: string }
  | { kind: 'redirect'; url: string }

export interface StorageAdapter {
  save(buffer: Buffer, opts: { mimeType: string; originalName: string }): Promise<SaveResult>
  delete(storedName: string): Promise<void>
  download(storedName: string, opts: { mimeType: string }): Promise<DownloadResult>
}

let cached: StorageAdapter | null = null

// env 따라 단일 어댑터 인스턴스 lazy 생성. multi-instance 환경에서도 같은 호스트 mount 공유라 OK.
export function createStorageAdapter(): StorageAdapter {
  if (cached) return cached
  const backend = process.env.STORAGE_BACKEND ?? 'local'
  if (backend === 's3') {
    // 1단계 placeholder — 운영 전환 시 s3Storage.ts 채우고 import 전환.
    throw new Error(
      'STORAGE_BACKEND=s3 는 운영 전환 시 backend/lib/files/s3Storage.ts 구현 후 활성화 됨'
    )
  }
  // 동적 import 로 클라우드 SDK 의존성을 1단계에 끌고 들어가지 않음.
  // (require 는 dev 환경에서 SSR 빌드 트리에 모두 포함되므로 직접 import 후 lazy export 도 OK)
  // 단순화 — 이 모듈에서 직접 LocalStorageAdapter 인스턴스화.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LocalStorageAdapter } = require('./localStorage') as typeof import('./localStorage')
  cached = new LocalStorageAdapter(process.env.STORAGE_LOCAL_DIR ?? '/app/files')
  return cached
}

// 테스트용 — 어댑터 캐시 강제 리셋.
export function __resetStorageAdapter(): void {
  cached = null
}
