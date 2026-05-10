/**
 * 첨부파일 검증 — 모든 StorageAdapter 호출 전 적용되는 공통 파이프라인.
 *
 * 1) 크기 cap (10MB)
 * 2) MIME 화이트리스트 (서버 신뢰 X — magic bytes 로 재검증)
 * 3) magic bytes 헤더 검증 (확장자만 위장한 실행파일·SVG 등 차단)
 *
 * 검증 통과 후에야 storage.save 호출.
 */

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// MIME 화이트리스트 — 운영 보안 관점에서 좁게 시작. 후속 확장 가능.
// SVG 는 의도적 제외 — 텍스트 형식이라 XSS 페이로드 삽입 가능.
const ALLOWED_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain',
  'text/markdown',
  'application/zip',
])

// magic bytes 시그니처 — 첫 N byte 로 형식 판별. 클라이언트가 보낸 MIME 을 신뢰하지 않고 재검증.
// (false positive 일부 허용하되 false negative 는 거부 정책)
interface MagicSignature {
  bytes: number[] // -1 은 wildcard
  offset?: number
  mimeTypes: string[]
}

const MAGIC_SIGNATURES: MagicSignature[] = [
  { bytes: [0xff, 0xd8, 0xff], mimeTypes: ['image/jpeg'] },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mimeTypes: ['image/png'] },
  { bytes: [0x47, 0x49, 0x46, 0x38], mimeTypes: ['image/gif'] }, // GIF87a / GIF89a
  { bytes: [0x52, 0x49, 0x46, 0x46], mimeTypes: ['image/webp'] }, // RIFF (WEBP 컨테이너)
  { bytes: [0x25, 0x50, 0x44, 0x46], mimeTypes: ['application/pdf'] }, // %PDF
  // ZIP 컨테이너 — docx/xlsx/pptx/zip 모두 같은 시그니처 (PK\x03\x04)
  {
    bytes: [0x50, 0x4b, 0x03, 0x04],
    mimeTypes: [
      'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
  // 구버전 office (D0 CF 11 E0 = OLE compound document)
  {
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    mimeTypes: [
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
    ],
  },
]

export class ValidationError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ValidationError'
  }
}

// 파일 검증 — 통과 시 정규화된 mimeType 반환, 실패 시 ValidationError.
export function validateUpload(
  buffer: Buffer,
  declaredMime: string,
  originalName: string
): { mimeType: string } {
  if (buffer.length === 0) {
    throw new ValidationError(400, '빈 파일은 업로드할 수 없습니다.')
  }
  if (buffer.length > MAX_FILE_SIZE) {
    throw new ValidationError(
      413,
      `파일 크기는 최대 ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB 까지 가능합니다.`
    )
  }

  // 1) MIME 화이트리스트 — text/plain 은 magic bytes 가 없어 화이트리스트만으로 판정.
  if (!ALLOWED_MIME_TYPES.has(declaredMime)) {
    throw new ValidationError(415, `지원하지 않는 파일 형식입니다: ${declaredMime}`)
  }

  // 2) text/plain·markdown 은 magic 검증 스킵 (텍스트 파일은 시그니처 없음)
  if (declaredMime === 'text/plain' || declaredMime === 'text/markdown') {
    // 추가 안전: NUL 바이트가 빈번하게 보이면 binary 라 거부
    let nulCount = 0
    const sample = buffer.subarray(0, Math.min(buffer.length, 1024))
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0x00) nulCount++
    }
    if (nulCount > 4) {
      throw new ValidationError(415, '텍스트 파일이 아닙니다. (binary 컨텐츠 감지)')
    }
    return { mimeType: declaredMime }
  }

  // 3) magic bytes 검증 — 선언 MIME 이 시그니처 후보 mimeTypes 에 들어 있어야 통과.
  const matched = MAGIC_SIGNATURES.find((sig) => matchSignature(buffer, sig))
  if (!matched) {
    throw new ValidationError(
      415,
      '파일 헤더가 인식되지 않습니다. 허용된 형식이 아닐 수 있습니다.'
    )
  }
  if (!matched.mimeTypes.includes(declaredMime)) {
    throw new ValidationError(
      415,
      `파일 헤더(${matched.mimeTypes[0]})와 선언된 MIME(${declaredMime}) 이 일치하지 않습니다.`
    )
  }
  return { mimeType: declaredMime }
}

function matchSignature(buffer: Buffer, sig: MagicSignature): boolean {
  const offset = sig.offset ?? 0
  if (buffer.length < offset + sig.bytes.length) return false
  for (let i = 0; i < sig.bytes.length; i++) {
    const expected = sig.bytes[i]
    if (expected === -1) continue
    if (buffer[offset + i] !== expected) return false
  }
  return true
}

// 원본 파일명에서 안전한 확장자만 추출 — UUID 파일명에 붙임.
// 빈 문자열 반환 시 확장자 없이 저장.
export function safeExtension(originalName: string): string {
  const idx = originalName.lastIndexOf('.')
  if (idx < 0 || idx === originalName.length - 1) return ''
  const ext = originalName.slice(idx + 1).toLowerCase()
  // 확장자 자체에 path traversal 같은 글자 차단.
  if (!/^[a-z0-9]{1,8}$/.test(ext)) return ''
  return '.' + ext
}
