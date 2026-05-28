import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decryptToken, encryptToken } from '@/lib/crypto/tokenEncryption'

describe('tokenEncryption', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CALENDAR_ENCRYPTION_KEY', 'test-calendar-encryption-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('encrypts and decrypts a token', () => {
    const encrypted = encryptToken('refresh-token')

    expect(encrypted).not.toBe('refresh-token')
    expect(decryptToken(encrypted)).toBe('refresh-token')
  })

  it('throws when encrypted token format is invalid', () => {
    expect(() => decryptToken('invalid')).toThrow('암호화된 토큰 형식')
  })
})
