/**
 * OAuth 콜백에서 받은 사용자 정보를 우리 시스템 계정에 매핑/생성
 *
 * 정책 (docs/25-kakao-and-google-auth.md §3):
 *   1) provider_user_id 로 oauth_accounts 조회 → 매칭되면 그 user 로 로그인
 *   2) 매칭 없음 + 이메일 제공됨 → 같은 이메일의 users 가 있으면 자동 연결,
 *      없으면 신규 user + oauth 동시 생성
 *   3) 이메일 미제공 (카카오 미동의) → 가입 거절 ('email_required')
 */

import { pool } from '@/lib/db/pool'
import { createUser, getUserByEmail, type User } from '@/lib/db/queries/userQueries'
import {
  createOAuthAccount,
  getOAuthAccountByProvider,
  touchOAuthAccount,
} from '@/lib/db/queries/oauthQueries'

export type LinkResult =
  | { ok: true; user: User; isNewUser: boolean; isNewLink: boolean }
  | { ok: false; reason: 'email_required' }

export interface LinkInput {
  provider: 'kakao' | 'google'
  providerUserId: string
  email: string | null
  nickname: string | null
  picture: string | null
}

export async function linkOrCreateUser(input: LinkInput): Promise<LinkResult> {
  // 1) provider_user_id 매칭 — 재방문 로그인
  const existingLink = await getOAuthAccountByProvider(input.provider, input.providerUserId)
  if (existingLink) {
    const user = await getUserById(existingLink.user_id)
    if (user) {
      await touchOAuthAccount(existingLink.id)
      return { ok: true, user, isNewUser: false, isNewLink: false }
    }
    // 데이터 불일치 (oauth_account 는 있는데 user 가 없음) — 정상 흐름 아님. 새로 생성으로 진행.
  }

  // 2) 이메일이 없으면 가입 거절
  if (!input.email) {
    return { ok: false, reason: 'email_required' }
  }

  // 3) 같은 이메일의 user 가 있으면 자동 연결
  const sameEmailUser = await getUserByEmail(input.email)
  if (sameEmailUser) {
    await createOAuthAccount({
      user_id: sameEmailUser.id,
      provider: input.provider,
      provider_user_id: input.providerUserId,
      provider_email: input.email,
      provider_name: input.nickname,
      provider_picture: input.picture,
    })
    return { ok: true, user: sameEmailUser, isNewUser: false, isNewLink: true }
  }

  // 4) 신규 user + oauth 동시 생성 (트랜잭션)
  const user = await createNewUserWithOAuth(input)
  return { ok: true, user, isNewUser: true, isNewLink: true }
}

async function createNewUserWithOAuth(input: LinkInput & { email: string }): Promise<User> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 닉네임이 없으면 이메일 local-part 로 fallback
    const name = (input.nickname ?? input.email.split('@')[0] ?? '사용자').slice(0, 50)

    const newUser = await createUser({
      email: input.email,
      name,
      password_hash: null, // OAuth 전용 사용자
    })

    await createOAuthAccount({
      user_id: newUser.id,
      provider: input.provider,
      provider_user_id: input.providerUserId,
      provider_email: input.email,
      provider_name: input.nickname,
      provider_picture: input.picture,
    })

    await client.query('COMMIT')
    return newUser
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// userQueries 에 getUserById 가 있어 그걸 사용하고 싶었지만
// 위에서 동시 import 충돌 피하려고 inline.
async function getUserById(id: string): Promise<User | null> {
  const result = await pool.query<User>(
    `SELECT id, email, name, password_hash, created_at FROM users WHERE id = $1`,
    [id]
  )
  return result.rows[0] ?? null
}
