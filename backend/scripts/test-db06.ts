/**
 * DB-06 완료 조건 테스트 스크립트
 * 실행: cd backend && DATABASE_URL=... npx tsx scripts/test-db06.ts
 */
import {
  createJoinRequest,
  getJoinRequestById,
  getPendingJoinRequestsByTeam,
  getPendingJoinRequestsByLeader,
  updateJoinRequestStatus,
} from '@/lib/db/queries/joinRequestQueries'
import { createUser } from '@/lib/db/queries/userQueries'
import { createTeam, addTeamMember } from '@/lib/db/queries/teamQueries'
import { pool } from '@/lib/db/pool'

async function run() {
  console.log('=== DB-06 joinRequestQueries 테스트 시작 ===\n')

  let leaderId: string | undefined
  let requester1Id: string | undefined
  let requester2Id: string | undefined
  let teamId: string | undefined
  const requestIds: string[] = []

  try {
    // 사전 준비: 유저 3명 + 팀 1개
    const leader    = await createUser({ email: 'db06_leader@caltalk.test',     name: '팀장',    password_hash: 'hash' })
    const requester1 = await createUser({ email: 'db06_req1@caltalk.test',      name: '신청자1', password_hash: 'hash' })
    const requester2 = await createUser({ email: 'db06_req2@caltalk.test',      name: '신청자2', password_hash: 'hash' })
    leaderId    = leader.id
    requester1Id = requester1.id
    requester2Id = requester2.id

    const team = await createTeam('DB06테스트팀', leaderId)
    teamId = team.id
    await addTeamMember(teamId, leaderId, 'LEADER')

    // 1. createJoinRequest
    console.log('[1] createJoinRequest')
    const req1 = await createJoinRequest(teamId, requester1Id)
    const req2 = await createJoinRequest(teamId, requester2Id)
    requestIds.push(req1.id, req2.id)
    if (req1.status !== 'PENDING') throw new Error(`초기 status가 PENDING이 아님: ${req1.status}`)
    if (req1.responded_at !== null)  throw new Error('responded_at이 null이 아님')
    console.log(`  ✅ req1 id=${req1.id}, status=${req1.status}, responded_at=${req1.responded_at}`)
    console.log(`  ✅ req2 id=${req2.id}, status=${req2.status}`)

    // 2. getJoinRequestById
    console.log('[2] getJoinRequestById')
    const found = await getJoinRequestById(req1.id)
    if (!found || found.id !== req1.id) throw new Error('getJoinRequestById: 결과 불일치')
    console.log(`  ✅ id=${found.id}, team_id=${found.team_id}`)

    // 없는 ID → null
    const notFound = await getJoinRequestById('00000000-0000-0000-0000-000000000000')
    if (notFound !== null) throw new Error('없는 ID가 null을 반환하지 않음')
    console.log('  ✅ 없는 ID → null 확인')

    // 3. getPendingJoinRequestsByTeam — teamId 격리 확인
    console.log('[3] getPendingJoinRequestsByTeam (teamId 격리)')
    const pendingByTeam = await getPendingJoinRequestsByTeam(teamId)
    if (pendingByTeam.length !== 2) throw new Error(`예상 2개, 실제 ${pendingByTeam.length}개`)
    if (!pendingByTeam[0].requester_name || !pendingByTeam[0].requester_email)
      throw new Error('requester_name/email 누락')
    if (pendingByTeam.some(r => r.team_id !== teamId))
      throw new Error('타 팀 신청이 포함됨 — 팀 격리 실패')
    console.log(`  ✅ PENDING 2건 조회, requester_name="${pendingByTeam[0].requester_name}"`)
    console.log('  ✅ 팀 격리 확인 (모든 결과 team_id 일치)')

    // 4. getPendingJoinRequestsByLeader (/api/me/tasks 용)
    console.log('[4] getPendingJoinRequestsByLeader')
    const pendingByLeader = await getPendingJoinRequestsByLeader(leaderId)
    if (pendingByLeader.length !== 2) throw new Error(`예상 2개, 실제 ${pendingByLeader.length}개`)
    if (!pendingByLeader[0].team_name) throw new Error('team_name 누락')
    console.log(`  ✅ leader 기준 PENDING 2건, team_name="${pendingByLeader[0].team_name}"`)

    // 5. updateJoinRequestStatus — APPROVED
    console.log('[5] updateJoinRequestStatus (APPROVED)')
    const approved = await updateJoinRequestStatus(req1.id, 'APPROVED')
    if (!approved || approved.status !== 'APPROVED') throw new Error('status가 APPROVED가 아님')
    if (!approved.responded_at) throw new Error('responded_at이 설정되지 않음')
    console.log(`  ✅ status=${approved.status}, responded_at=${approved.responded_at}`)

    // 6. updateJoinRequestStatus — REJECTED
    console.log('[6] updateJoinRequestStatus (REJECTED)')
    const rejected = await updateJoinRequestStatus(req2.id, 'REJECTED')
    if (!rejected || rejected.status !== 'REJECTED') throw new Error('status가 REJECTED가 아님')
    console.log(`  ✅ status=${rejected.status}`)

    // 7. 처리 후 PENDING 목록 → 0건
    console.log('[7] 처리 후 getPendingJoinRequestsByTeam → 0건')
    const afterPending = await getPendingJoinRequestsByTeam(teamId)
    if (afterPending.length !== 0) throw new Error(`예상 0건, 실제 ${afterPending.length}건`)
    console.log('  ✅ PENDING 0건 확인')

    console.log('\n✅ 모든 테스트 통과')
  } catch (err) {
    console.error('\n❌ 테스트 실패:', (err as Error).message)
    process.exitCode = 1
  } finally {
    // 정리 (FK 순서: join_requests → team_members → teams → users)
    if (requestIds.length) await pool.query('DELETE FROM team_join_requests WHERE id = ANY($1)', [requestIds])
    if (teamId)      await pool.query('DELETE FROM team_members WHERE team_id = $1', [teamId])
    if (teamId)      await pool.query('DELETE FROM teams WHERE id = $1', [teamId])
    if (leaderId)    await pool.query('DELETE FROM users WHERE id = $1', [leaderId])
    if (requester1Id) await pool.query('DELETE FROM users WHERE id = $1', [requester1Id])
    if (requester2Id) await pool.query('DELETE FROM users WHERE id = $1', [requester2Id])
    console.log('\n[cleanup] 테스트 데이터 삭제 완료')
    await pool.end()
  }
}

run()
