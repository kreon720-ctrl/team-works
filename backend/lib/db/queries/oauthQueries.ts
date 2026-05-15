import { pool } from '@/lib/db/pool'

export interface OAuthAccount {
  id: string
  user_id: string
  provider: 'kakao' | 'google'
  provider_user_id: string
  provider_email: string | null
  provider_name: string | null
  provider_picture: string | null
  linked_at: Date
  last_login_at: Date | null
}

export interface CreateOAuthAccountParams {
  user_id: string
  provider: 'kakao' | 'google'
  provider_user_id: string
  provider_email?: string | null
  provider_name?: string | null
  provider_picture?: string | null
}

/**
 * provider + provider_user_id 로 OAuth 계정 조회 (재방문 로그인 케이스)
 */
export async function getOAuthAccountByProvider(
  provider: 'kakao' | 'google',
  providerUserId: string
): Promise<OAuthAccount | null> {
  const result = await pool.query<OAuthAccount>(
    `SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2`,
    [provider, providerUserId]
  )
  return result.rows[0] ?? null
}

/**
 * 신규 OAuth 연결 생성
 */
export async function createOAuthAccount(
  params: CreateOAuthAccountParams
): Promise<OAuthAccount> {
  const result = await pool.query<OAuthAccount>(
    `INSERT INTO oauth_accounts
       (user_id, provider, provider_user_id, provider_email, provider_name, provider_picture, last_login_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     RETURNING *`,
    [
      params.user_id,
      params.provider,
      params.provider_user_id,
      params.provider_email ?? null,
      params.provider_name ?? null,
      params.provider_picture ?? null,
    ]
  )
  return result.rows[0]
}

/**
 * 마지막 로그인 시각 갱신
 */
export async function touchOAuthAccount(id: string): Promise<void> {
  await pool.query(`UPDATE oauth_accounts SET last_login_at = now() WHERE id = $1`, [id])
}
