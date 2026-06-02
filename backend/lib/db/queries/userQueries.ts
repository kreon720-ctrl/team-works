import { pool } from '@/lib/db/pool'

// OAuth 만 쓰는 사용자는 비밀번호가 없어 password_hash 가 null 일 수 있음
export interface User {
  id: string
  email: string
  name: string
  password_hash: string | null
  terms_accepted_at: Date | null
  privacy_accepted_at: Date | null
  terms_version: string | null
  privacy_version: string | null
  created_at: Date
}

export interface CreateUserParams {
  email: string
  name: string
  password_hash: string | null
  terms_accepted?: boolean
  privacy_accepted?: boolean
  terms_version?: string | null
  privacy_version?: string | null
}

export async function createUser(params: CreateUserParams): Promise<User> {
  const { email, name, password_hash } = params
  try {
    const result = await pool.query<User>(
      `INSERT INTO users (
         email,
         name,
         password_hash,
         terms_accepted_at,
         privacy_accepted_at,
         terms_version,
         privacy_version
       )
       VALUES (
         $1,
         $2,
         $3,
         CASE WHEN $4 THEN now() ELSE NULL END,
         CASE WHEN $5 THEN now() ELSE NULL END,
         $6,
         $7
       )
       RETURNING id, email, name, password_hash, terms_accepted_at, privacy_accepted_at, terms_version, privacy_version, created_at`,
      [
        email,
        name,
        password_hash,
        params.terms_accepted ?? false,
        params.privacy_accepted ?? false,
        params.terms_version ?? null,
        params.privacy_version ?? null,
      ]
    )
    return result.rows[0]
  } catch (err) {
    throw new Error(`createUser 실패: ${(err as Error).message}`)
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const result = await pool.query<User>(
      `SELECT id, email, name, password_hash, created_at
       , terms_accepted_at, privacy_accepted_at, terms_version, privacy_version
       FROM users
       WHERE email = $1`,
      [email]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error(`getUserByEmail 실패: ${(err as Error).message}`)
  }
}

export async function updateUserName(id: string, name: string): Promise<User | null> {
  try {
    const result = await pool.query<User>(
      `UPDATE users SET name = $1 WHERE id = $2
       RETURNING id, email, name, password_hash, terms_accepted_at, privacy_accepted_at, terms_version, privacy_version, created_at`,
      [name, id]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error(`updateUserName 실패: ${(err as Error).message}`)
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const result = await pool.query<User>(
      `SELECT id, email, name, password_hash, created_at
       , terms_accepted_at, privacy_accepted_at, terms_version, privacy_version
       FROM users
       WHERE id = $1`,
      [id]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error(`getUserById 실패: ${(err as Error).message}`)
  }
}

export async function updateUserConsent(params: {
  userId: string
  termsAccepted: boolean
  privacyAccepted: boolean
  termsVersion: string
  privacyVersion: string
}): Promise<User | null> {
  if (!params.termsAccepted || !params.privacyAccepted) return null

  try {
    const result = await pool.query<User>(
      `UPDATE users
       SET terms_accepted_at = COALESCE(terms_accepted_at, now()),
           privacy_accepted_at = COALESCE(privacy_accepted_at, now()),
           terms_version = COALESCE(terms_version, $2),
           privacy_version = COALESCE(privacy_version, $3)
       WHERE id = $1
       RETURNING id, email, name, password_hash, terms_accepted_at, privacy_accepted_at, terms_version, privacy_version, created_at`,
      [params.userId, params.termsVersion, params.privacyVersion]
    )
    return result.rows[0] ?? null
  } catch (err) {
    throw new Error(`updateUserConsent 실패: ${(err as Error).message}`)
  }
}
