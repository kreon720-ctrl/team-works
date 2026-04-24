import { callBackend } from '../backendClient.js';

/**
 * Convert an ISO-UTC timestamp (e.g. "2026-04-22T07:00:00.000Z") to a KST
 * ISO string with explicit offset (e.g. "2026-04-22T16:00:00+09:00").
 *
 * The backend returns timestamptz values serialized as UTC `Z` strings.
 * Feeding those raw to gemma2:9b causes it to read the UTC clock as if it
 * were local time. Normalizing to KST here keeps the backend contract
 * intact while giving the model an unambiguous local-time value to echo.
 */
function toKstIso(isoUtc) {
  if (typeof isoUtc !== 'string') return isoUtc;
  const d = new Date(isoUtc);
  if (isNaN(d.getTime())) return isoUtc;
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = k.getUTCFullYear();
  const mm = String(k.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(k.getUTCDate()).padStart(2, '0');
  const hh = String(k.getUTCHours()).padStart(2, '0');
  const mi = String(k.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:00+09:00`;
}

export const listTeamSchedules = {
  name: 'list_team_schedules',
  description:
    '특정 팀의 일정을 조회한다. view 는 month|week|day 중 하나. date 는 YYYY-MM-DD (KST 기준 조회 기준일). 기본값은 오늘.',
  inputSchema: {
    type: 'object',
    required: ['teamId'],
    properties: {
      teamId: { type: 'string', description: '조회 대상 팀 UUID' },
      view: {
        type: 'string',
        enum: ['month', 'week', 'day'],
        default: 'day',
        description: '조회 범위 (월간/주간/일간). 특정 날짜 질의가 대다수이므로 기본값은 day.',
      },
      date: {
        type: 'string',
        description: 'YYYY-MM-DD 형식 기준일. 생략 시 오늘.',
      },
    },
    additionalProperties: false,
  },
  mutates: false,
  async handler({ teamId, view = 'month', date }) {
    const data = await callBackend(`/api/teams/${teamId}/schedules`, {
      query: { view, date },
    });
    return {
      view: data?.view,
      date: data?.date,
      count: (data?.schedules ?? []).length,
      schedules: (data?.schedules ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        startAt: toKstIso(s.startAt),
        endAt: toKstIso(s.endAt),
        color: s.color,
        creatorName: s.creatorName,
      })),
    };
  },
};
