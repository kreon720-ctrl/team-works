import crypto from 'crypto'
import { pool } from '@/lib/db/pool'

const STATE_TTL_MS = 5 * 60 * 1000 // 5분

/**
 * 안전한 랜덤 state + PKCE code_verifier·code_challenge 발급
 * - state: CSRF 방지용 32 byte 랜덤 (base64url)
 * - code_verifier: PKCE 용 32 byte 랜덤 (base64url)
 * - code_challenge: SHA-256(code_verifier) base64url
 */
export interface StateBundle {
  state: string
  codeVerifier: string
  codeChallenge: string
}

export function generateStateBundle(): StateBundle {
  const state = crypto.randomBytes(32).toString('base64url')
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  return { state, codeVerifier, codeChallenge }
}

export interface OAuthConsentState {
  termsAccepted?: boolean
  privacyAccepted?: boolean
  termsVersion?: string | null
  privacyVersion?: string | null
}

/**
 * state 와 code_verifier 를 DB 에 임시 저장 (TTL 5분)
 */
export async function saveState(
  state: string,
  codeVerifier: string,
  redirectAfter: string | null,
  userId: string | null = null,
  consent: OAuthConsentState = {}
): Promise<void> {
  await pool.query(
    `INSERT INTO oauth_state (
       state,
       code_verifier,
       redirect_after,
       user_id,
       terms_accepted,
       privacy_accepted,
       terms_version,
       privacy_version
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      state,
      codeVerifier,
      redirectAfter,
      userId,
      consent.termsAccepted ?? false,
      consent.privacyAccepted ?? false,
      consent.termsVersion ?? null,
      consent.privacyVersion ?? null,
    ]
  )
}

/**
 * state 조회 + 즉시 삭제 (one-time use). TTL 초과 시 null.
 */
export async function popState(state: string): Promise<{
  codeVerifier: string
  redirectAfter: string | null
  userId: string | null
  termsAccepted: boolean
  privacyAccepted: boolean
  termsVersion: string | null
  privacyVersion: string | null
} | null> {
  // DELETE ... RETURNING 으로 atomic 하게 조회+삭제
  const result = await pool.query<{
    code_verifier: string
    redirect_after: string | null
    user_id: string | null
    terms_accepted: boolean
    privacy_accepted: boolean
    terms_version: string | null
    privacy_version: string | null
    created_at: Date
  }>(
    `DELETE FROM oauth_state WHERE state = $1
     RETURNING code_verifier, redirect_after, user_id, terms_accepted, privacy_accepted, terms_version, privacy_version, created_at`,
    [state]
  )
  const row = result.rows[0]
  if (!row) return null

  // TTL 검사
  const age = Date.now() - new Date(row.created_at).getTime()
  if (age > STATE_TTL_MS) return null

  return {
    codeVerifier: row.code_verifier,
    redirectAfter: row.redirect_after,
    userId: row.user_id,
    termsAccepted: row.terms_accepted,
    privacyAccepted: row.privacy_accepted,
    termsVersion: row.terms_version,
    privacyVersion: row.privacy_version,
  }
}

/**
 * 만료된 state 청소 (cron 또는 콜백 hot path 외에서 주기 실행 권장)
 */
export async function cleanupExpiredStates(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM oauth_state WHERE created_at < now() - interval '1 hour'`
  )
  return result.rowCount ?? 0
}
