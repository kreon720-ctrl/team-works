/**
 * DB-07 완료 조건 테스트 스크립트
 * 실행: cd backend && DATABASE_URL=... npx tsx scripts/test-db07.ts
 */
import {
  createSchedule,
  getSchedulesByDateRange,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
} from '@/lib/db/queries/scheduleQueries'
import { createUser } from '@/lib/db/queries/userQueries'
import { createTeam, addTeamMember } from '@/lib/db/queries/teamQueries'
import { pool } from '@/lib/db/pool'

async function run() {
  console.log('=== DB-07 scheduleQueries 테스트 시작 ===\n')

  let userId: string | undefined
  let teamId: string | undefined
  let otherTeamId: string | undefined
  const scheduleIds: string[] = []

  try {
    // 사전 준비: 유저 1명 + 팀 2개 (팀 격리 검증용)
    const user = await createUser({ email: 'db07_user@caltalk.test', name: '테스터', password_hash: 'hash' })
    userId = user.id

    const team      = await createTeam('DB07팀A', userId)
    const otherTeam = await createTeam('DB07팀B', userId)
    teamId      = team.id
    otherTeamId = otherTeam.id
    await addTeamMember(teamId, userId, 'LEADER')
    await addTeamMember(otherTeamId, userId, 'LEADER')

    // 기준 날짜 (UTC 기준)
    const base   = new Date('2026-04-10T00:00:00Z')
    const plus1h = new Date('2026-04-10T01:00:00Z')
    const plus2h = new Date('2026-04-10T02:00:00Z')
    const plus3h = new Date('2026-04-10T03:00:00Z')
    const plus4h = new Date('2026-04-10T04:00:00Z')
    const nextDay = new Date('2026-04-11T00:00:00Z')

    // 1. createSchedule
    console.log('[1] createSchedule')
    const s1 = await createSchedule({ teamId, createdBy: userId, title: '일정A', startAt: base, endAt: plus2h })
    const s2 = await createSchedule({ teamId, createdBy: userId, title: '일정B', description: '설명B', startAt: plus1h, endAt: plus3h })
    // 타 팀 일정 (격리 확인용)
    const sOther = await createSchedule({ teamId: otherTeamId, createdBy: userId, title: '타팀일정', startAt: base, endAt: plus2h })
    scheduleIds.push(s1.id, s2.id, sOther.id)

    if (!s1.id || s1.team_id !== teamId)  throw new Error('createSchedule: team_id 불일치')
    if (s2.description !== '설명B')         throw new Error('createSchedule: description 불일치')
    console.log(`  ✅ s1 id=${s1.id}, title=${s1.title}`)
    console.log(`  ✅ s2 id=${s2.id}, description=${s2.description}`)

    // 2. getSchedulesByDateRange — 범위 내 조회 + 팀 격리
    console.log('[2] getSchedulesByDateRange (범위·팀 격리)')
    // 범위: base ~ plus4h → s1, s2 포함 (s1: 0~2h, s2: 1~3h 모두 겹침)
    const inRange = await getSchedulesByDateRange(teamId, base, plus4h)
    if (inRange.length !== 2) throw new Error(`예상 2개, 실제 ${inRange.length}개`)
    if (inRange.some(s => s.team_id !== teamId)) throw new Error('타 팀 일정이 포함됨 — 팀 격리 실패')
    console.log(`  ✅ ${inRange.length}개 조회 (s1·s2), 팀 격리 확인`)

    // 범위 외: nextDay ~ → 0건
    const outRange = await getSchedulesByDateRange(teamId, nextDay, new Date('2026-04-12T00:00:00Z'))
    if (outRange.length !== 0) throw new Error(`범위 외 결과가 있음: ${outRange.length}개`)
    console.log('  ✅ 범위 외 → 0건 확인')

    // 3. getScheduleById — teamId + id 복합 조회
    console.log('[3] getScheduleById (teamId 포함)')
    const found = await getScheduleById(teamId, s1.id)
    if (!found || found.id !== s1.id) throw new Error('getScheduleById: 결과 불일치')
    console.log(`  ✅ id=${found.id}, title=${found.title}`)

    // 타 팀 ID로 조회 → null (팀 격리)
    const wrongTeam = await getScheduleById(otherTeamId, s1.id)
    if (wrongTeam !== null) throw new Error('타 팀 teamId로 조회됨 — 팀 격리 실패')
    console.log('  ✅ 타 팀 teamId로 조회 → null (격리 확인)')

    // 4. updateSchedule — 부분 수정
    console.log('[4] updateSchedule (부분 수정)')
    const updated = await updateSchedule(teamId, s1.id, { title: '수정된일정A', endAt: plus4h })
    if (!updated || updated.title !== '수정된일정A') throw new Error('title 수정 불일치')
    if (updated.end_at.toISOString() !== plus4h.toISOString()) throw new Error('end_at 수정 불일치')
    if (updated.updated_at <= s1.updated_at) throw new Error('updated_at이 갱신되지 않음')
    console.log(`  ✅ title="${updated.title}", updated_at 갱신 확인`)

    // 5. deleteSchedule
    console.log('[5] deleteSchedule')
    const deleted = await deleteSchedule(teamId, s2.id)
    if (!deleted) throw new Error('deleteSchedule: true 반환 실패')
    const afterDelete = await getScheduleById(teamId, s2.id)
    if (afterDelete !== null) throw new Error('삭제 후에도 조회됨')
    console.log('  ✅ 삭제 후 getScheduleById → null 확인')

    // 없는 ID 삭제 → false
    const falseDelete = await deleteSchedule(teamId, '00000000-0000-0000-0000-000000000000')
    if (falseDelete !== false) throw new Error('없는 ID 삭제가 false를 반환하지 않음')
    console.log('  ✅ 없는 ID 삭제 → false 확인')

    console.log('\n✅ 모든 테스트 통과')
  } catch (err) {
    console.error('\n❌ 테스트 실패:', (err as Error).message)
    process.exitCode = 1
  } finally {
    // 정리
    if (scheduleIds.length) await pool.query('DELETE FROM schedules WHERE id = ANY($1)', [scheduleIds])
    if (teamId)      await pool.query('DELETE FROM team_members WHERE team_id = $1', [teamId])
    if (otherTeamId) await pool.query('DELETE FROM team_members WHERE team_id = $1', [otherTeamId])
    if (teamId)      await pool.query('DELETE FROM teams WHERE id = $1', [teamId])
    if (otherTeamId) await pool.query('DELETE FROM teams WHERE id = $1', [otherTeamId])
    if (userId)      await pool.query('DELETE FROM users WHERE id = $1', [userId])
    console.log('\n[cleanup] 테스트 데이터 삭제 완료')
    await pool.end()
  }
}

run()
