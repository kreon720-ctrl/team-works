/**
 * scheduleQueries — AI 어시스턴트의 schedule_query / schedule_create / schedule_delete
 * 의도 분기에서 호출하는 도구 함수. 내부적으로 pgClient.callBackend 를 통해 백엔드
 * schedule API 를 호출.
 *
 * 인터페이스 안정성: 향후 PG-MCP child process 로 교체해도 이 함수들의 시그니처는 보존.
 */
import { callBackend } from './pgClient';

export interface Schedule {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  color: string;
  startAt: string; // ISO 8601 (UTC)
  endAt: string;
  createdBy: string;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ScheduleView = 'month' | 'week' | 'day';

export interface GetSchedulesOptions {
  teamId: string;
  jwt: string;
  view?: ScheduleView; // default 'month'
  date?: string; // YYYY-MM-DD, default 오늘
}

// 백엔드 GET /api/teams/:teamId/schedules?view=...&date=... 호출.
// view+date 기준 KST 범위 안의 일정 배열을 반환.
export async function getSchedules(opts: GetSchedulesOptions): Promise<Schedule[]> {
  const { teamId, jwt, view = 'month', date } = opts;
  if (!teamId) throw new Error('teamId 가 필요합니다.');
  const data = await callBackend<{ schedules: Schedule[] }>({
    method: 'GET',
    path: `/api/teams/${encodeURIComponent(teamId)}/schedules`,
    jwt,
    query: { view, date },
  });
  return Array.isArray(data?.schedules) ? data.schedules : [];
}

export interface CreateScheduleOptions {
  teamId: string;
  jwt: string;
  title: string;
  startAt: string; // ISO 8601 (UTC)
  endAt: string;
  description?: string | null;
  color?: 'indigo' | 'blue' | 'emerald' | 'amber' | 'rose';
}

// 백엔드 POST /api/teams/:teamId/schedules 호출. 검증·권한·DB INSERT 는 백엔드가 처리.
export async function createSchedule(opts: CreateScheduleOptions): Promise<Schedule> {
  const { teamId, jwt, title, startAt, endAt, description, color } = opts;
  if (!teamId) throw new Error('teamId 가 필요합니다.');
  if (!title) throw new Error('title 이 필요합니다.');
  if (!startAt || !endAt) throw new Error('startAt, endAt 이 필요합니다.');
  const body: Record<string, unknown> = { title, startAt, endAt };
  if (description !== undefined) body.description = description;
  if (color !== undefined) body.color = color;
  const data = await callBackend<Schedule | { schedule: Schedule }>({
    method: 'POST',
    path: `/api/teams/${encodeURIComponent(teamId)}/schedules`,
    jwt,
    body,
  });
  // 백엔드는 schedule 객체를 직접 반환하거나 {schedule:...} 으로 감싸 반환할 수 있음
  if (data && typeof data === 'object' && 'id' in data) return data as Schedule;
  if (data && typeof data === 'object' && 'schedule' in data) {
    return (data as { schedule: Schedule }).schedule;
  }
  throw new Error('createSchedule: 예상치 못한 응답 형식');
}

export interface DeleteScheduleOptions {
  teamId: string;
  jwt: string;
  scheduleId: string;
}

// 백엔드 DELETE /api/teams/:teamId/schedules/:scheduleId 호출. 권한·존재 검증은 백엔드가 처리.
// 성공 시 void 반환. 백엔드는 204 또는 {ok:true} 등으로 응답할 수 있음 — 어느 쪽이든 호출 측은
// 성공 여부만 신경쓰면 되므로 결과를 무시.
export async function deleteSchedule(opts: DeleteScheduleOptions): Promise<void> {
  const { teamId, jwt, scheduleId } = opts;
  if (!teamId) throw new Error('teamId 가 필요합니다.');
  if (!scheduleId) throw new Error('scheduleId 가 필요합니다.');
  await callBackend<unknown>({
    method: 'DELETE',
    path: `/api/teams/${encodeURIComponent(teamId)}/schedules/${encodeURIComponent(scheduleId)}`,
    jwt,
  });
}
