/**
 * DB-04 완료 조건 테스트 스크립트
 * 실행: cd backend && npx tsx scripts/test-db04.ts
 */
import { createUser, getUserByEmail, getUserById } from '@/lib/db/queries/userQueries'
import { pool } from '@/lib/db/pool'

const TEST_EMAIL = 'db04_test@caltalk.test'

async function run() {
  console.log('=== DB-04 userQueries 테스트 시작 ===\n')
  let createdId: string | undefined

  try {
    // 1. createUser
    console.log('[1] createUser')
    const user = await createUser({
      email: TEST_EMAIL,
      name: 'DB04 테스터',
      password_hash: '$2b$12$testhashvalue',
    })
    createdId = user.id
    console.log(`  ✅ id=${user.id}, email=${user.email}, name=${user.name}`)

    // 2. getUserByEmail
    console.log('[2] getUserByEmail')
    const byEmail = await getUserByEmail(TEST_EMAIL)
    if (!byEmail || byEmail.id !== createdId) throw new Error('getUserByEmail: 결과 불일치')
    console.log(`  ✅ email=${byEmail.email} 조회 성공`)

    // 3. getUserById
    console.log('[3] getUserById')
    const byId = await getUserById(createdId)
    if (!byId || byId.email !== TEST_EMAIL) throw new Error('getUserById: 결과 불일치')
    console.log(`  ✅ id=${byId.id} 조회 성공`)

    // 4. 존재하지 않는 ID → null 반환 확인
    console.log('[4] getUserById (없는 ID → null)')
    const none = await getUserById('00000000-0000-0000-0000-000000000000')
    if (none !== null) throw new Error('없는 ID가 null을 반환하지 않음')
    console.log('  ✅ null 반환 확인')

    console.log('\n✅ 모든 테스트 통과')
  } catch (err) {
    console.error('\n❌ 테스트 실패:', (err as Error).message)
    process.exitCode = 1
  } finally {
    // 테스트 데이터 정리
    if (createdId) {
      await pool.query('DELETE FROM users WHERE email = $1', [TEST_EMAIL])
      console.log('\n[cleanup] 테스트 데이터 삭제 완료')
    }
    await pool.end()
  }
}

run()
