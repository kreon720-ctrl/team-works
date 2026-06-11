import { createTeam, addTeamMember } from '@/lib/db/queries/teamQueries'
import { createSchedule } from '@/lib/db/queries/scheduleQueries'
import { createProject } from '@/lib/db/queries/projectQueries'
import { createProjectSchedule } from '@/lib/db/queries/projectScheduleQueries'
import { createSubSchedule } from '@/lib/db/queries/subScheduleQueries'

// 가입 직후, 팀웍스 기능을 바로 둘러볼 수 있도록 만들어 주는 "테스트팀".
// - 팀명: 테스트팀 / 팀원: 가입자 1명(팀장) / 샘플 일정 6개
// - 프로젝트 2개: 간트 차트가 그려지도록 단계별 일정(막대)을 넣고,
//   각 막대를 클릭하면 세부화면에 보이도록 세부일정까지 가상 데이터로 채운다.
// - 시각 저장 컨벤션: DB timestamp 는 UTC = KST - 9h (앱 전체 동일).
// - 실패해도 회원가입/로그인은 막지 않도록 호출부에서 try/catch 로 격리한다.

const TEAM_NAME = '테스트팀'
const TEAM_DESC = '팀웍스 기능을 알아보기 위한 테스트 팀입니다.'

// 프로젝트 1개 시드 정의 — 단계별 일정(막대)과 그 안의 세부일정까지.
interface SubSpec {
  title: string
  s: number // 가입일 기준 시작 오프셋(일)
  e: number
  progress: number
  leader?: string
}
interface PhaseScheduleSpec {
  phaseId: string
  title: string
  color: string
  leader: string
  progress: number
  s: number
  e: number
  delayed?: boolean
  subs: SubSpec[]
}
interface ProjectSpec {
  name: string
  description: string
  s: number
  e: number
  progress: number
  phases: Array<{ id: string; name: string; order: number }>
  schedules: PhaseScheduleSpec[]
}

export async function createOnboardingTestTeam(userId: string, userName: string): Promise<void> {
  // 1) 팀 생성 + 가입자를 팀장으로 등록
  const team = await createTeam(TEAM_NAME, userId, TEAM_DESC)
  await addTeamMember(team.id, userId, 'LEADER')

  // KST 기준 오늘 날짜를 기준점으로, 일정/프로젝트를 이번 주~다음 주에 배치한다.
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const baseY = kstNow.getUTCFullYear()
  const baseM = kstNow.getUTCMonth()
  const baseD = kstNow.getUTCDate()

  // KST 시:분 → UTC Date (저장값). hour-9 가 음수면 Date.UTC 가 전날로 보정.
  const at = (offsetDays: number, hour: number, minute = 0): Date =>
    new Date(Date.UTC(baseY, baseM, baseD + offsetDays, hour - 9, minute))
  // KST 날짜(시각 없음) → 'YYYY-MM-DD' (프로젝트 start/end 용)
  const dateStr = (offsetDays: number): string =>
    new Date(Date.UTC(baseY, baseM, baseD + offsetDays)).toISOString().slice(0, 10)

  // 2) 샘플 일정 6개
  const schedules: Array<{
    title: string
    color: string
    start: Date
    end: Date
    description?: string
  }> = [
    { title: '팀 킥오프 미팅', color: 'indigo', start: at(1, 10, 0), end: at(1, 11, 0), description: '팀웍스 둘러보기 시작!' },
    { title: '주간 업무 회의', color: 'amber', start: at(2, 14, 0), end: at(2, 15, 0) },
    { title: '점심 약속', color: 'emerald', start: at(3, 12, 0), end: at(3, 13, 0) },
    { title: '디자인 리뷰', color: 'rose', start: at(5, 15, 30), end: at(5, 16, 30) },
    { title: '고객사 미팅', color: 'indigo', start: at(7, 16, 0), end: at(7, 16, 30) },
    { title: '프로젝트 중간 점검', color: 'amber', start: at(9, 11, 0), end: at(9, 12, 0) },
  ]
  for (const s of schedules) {
    await createSchedule({
      teamId: team.id,
      createdBy: userId,
      title: s.title,
      description: s.description ?? null,
      color: s.color,
      startAt: s.start,
      endAt: s.end,
    })
  }

  // 3) 프로젝트 2개 — 단계별 일정(간트 막대) + 세부일정까지 채운다.
  const projectSpecs: ProjectSpec[] = [
    {
      name: '팀웍스 도입 프로젝트',
      description: '팀웍스를 팀에 정착시키기 위한 단계별 도입 계획입니다.',
      s: 0,
      e: 30,
      progress: 25,
      phases: [
        { id: 'p1', name: '기획', order: 1 },
        { id: 'p2', name: '준비', order: 2 },
        { id: 'p3', name: '실행', order: 3 },
        { id: 'p4', name: '안정화', order: 4 },
      ],
      schedules: [
        {
          phaseId: 'p1', title: '도입 준비 기획', color: 'indigo', leader: userName, progress: 100, s: 0, e: 7,
          subs: [
            { title: '현황 분석', s: 0, e: 3, progress: 100 },
            { title: '도입 범위 정의', s: 3, e: 7, progress: 100 },
          ],
        },
        {
          phaseId: 'p2', title: '팀 환경 세팅', color: 'blue', leader: '김민수', progress: 60, s: 8, e: 15,
          subs: [
            { title: '계정·권한 설정', s: 8, e: 11, progress: 100 },
            { title: '교육 자료 준비', s: 11, e: 15, progress: 40 },
          ],
        },
        {
          phaseId: 'p3', title: '파일럿 운영', color: 'amber', leader: '이서연', progress: 20, s: 16, e: 23,
          subs: [
            { title: '시범 일정 등록', s: 16, e: 19, progress: 40 },
            { title: '피드백 수집', s: 19, e: 23, progress: 0 },
          ],
        },
        {
          phaseId: 'p4', title: '정착·안정화', color: 'emerald', leader: userName, progress: 0, s: 24, e: 30,
          subs: [
            { title: '운영 규칙 정리', s: 24, e: 27, progress: 0 },
            { title: '회고 및 확산', s: 27, e: 30, progress: 0 },
          ],
        },
      ],
    },
    {
      name: '신규 서비스 기획',
      description: '아이디어부터 출시까지 진행하는 신규 서비스 기획 프로젝트입니다.',
      s: 7,
      e: 45,
      progress: 0,
      phases: [
        { id: 'p1', name: '리서치', order: 1 },
        { id: 'p2', name: '기획', order: 2 },
        { id: 'p3', name: '디자인', order: 3 },
        { id: 'p4', name: '개발', order: 4 },
        { id: 'p5', name: '출시', order: 5 },
      ],
      schedules: [
        {
          phaseId: 'p1', title: '시장·사용자 리서치', color: 'indigo', leader: '정수아', progress: 80, s: 7, e: 14,
          subs: [
            { title: '경쟁사 분석', s: 7, e: 10, progress: 100 },
            { title: '사용자 인터뷰', s: 10, e: 14, progress: 60 },
          ],
        },
        {
          phaseId: 'p2', title: '서비스 기획', color: 'blue', leader: userName, progress: 50, s: 15, e: 22,
          subs: [
            { title: '요구사항 정의', s: 15, e: 18, progress: 80 },
            { title: '화면 흐름 설계', s: 18, e: 22, progress: 30 },
          ],
        },
        {
          phaseId: 'p3', title: 'UX/UI 디자인', color: 'rose', leader: '이서연', progress: 20, s: 23, e: 30,
          subs: [
            { title: '와이어프레임', s: 23, e: 26, progress: 50 },
            { title: '시안 디자인', s: 26, e: 30, progress: 0 },
          ],
        },
        {
          phaseId: 'p4', title: '개발', color: 'amber', leader: '김민수', progress: 0, s: 31, e: 40,
          subs: [
            { title: '프론트엔드 구현', s: 31, e: 36, progress: 0 },
            { title: '백엔드 API', s: 34, e: 40, progress: 0 },
          ],
        },
        {
          phaseId: 'p5', title: '베타 출시', color: 'emerald', leader: userName, progress: 0, s: 41, e: 45,
          subs: [
            { title: 'QA·버그 수정', s: 41, e: 43, progress: 0 },
            { title: '스토어 등록', s: 43, e: 45, progress: 0 },
          ],
        },
      ],
    },
  ]

  for (const spec of projectSpecs) {
    const project = await createProject({
      teamId: team.id,
      createdBy: userId,
      name: spec.name,
      description: spec.description,
      startDate: dateStr(spec.s),
      endDate: dateStr(spec.e),
      progress: spec.progress,
      manager: userName,
      phases: spec.phases,
    })

    for (const ps of spec.schedules) {
      // 단계별 일정 = 간트 막대
      const bar = await createProjectSchedule({
        projectId: project.id,
        teamId: team.id,
        createdBy: userId,
        title: ps.title,
        description: null,
        color: ps.color,
        startDate: dateStr(ps.s),
        endDate: dateStr(ps.e),
        leader: ps.leader,
        progress: ps.progress,
        isDelayed: ps.delayed ?? false,
        phaseId: ps.phaseId,
      })

      // 막대 클릭 시 세부화면에 보이는 세부일정
      for (const sub of ps.subs) {
        await createSubSchedule({
          projectScheduleId: bar.id,
          projectId: project.id,
          teamId: team.id,
          createdBy: userId,
          title: sub.title,
          description: null,
          color: ps.color,
          startDate: dateStr(sub.s),
          endDate: dateStr(sub.e),
          leader: sub.leader ?? ps.leader,
          progress: sub.progress,
          isDelayed: false,
        })
      }
    }
  }
}
