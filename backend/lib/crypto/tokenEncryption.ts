import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getKey(): Buffer {
  const secret = process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('GOOGLE_CALENDAR_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

export function decryptToken(value: string): string {
  const [ivPart, authTagPart, encryptedPart] = value.split('.')
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error('암호화된 토큰 형식이 올바르지 않습니다.')
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivPart, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
