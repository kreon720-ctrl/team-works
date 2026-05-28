import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSchedule, deleteSchedule, updateSchedule } from '@/lib/mcp/scheduleQueries';
import { callBackend } from '@/lib/mcp/pgClient';

vi.mock('@/lib/mcp/pgClient', () => ({
  callBackend: vi.fn(),
}));

const mockCallBackend = vi.mocked(callBackend);

const schedule = {
  id: 'schedule-1',
  teamId: 'team-1',
  title: '회의',
  description: null,
  color: 'indigo',
  startAt: '2026-05-28T01:00:00.000Z',
  endAt: null,
  createdBy: 'user-1',
  creatorName: 'User',
  createdAt: '2026-05-27T00:00:00.000Z',
  updatedAt: '2026-05-27T00:00:00.000Z',
};

const calendarSync = {
  attempted: true,
  success: false,
  error: 'Google API failed',
};

describe('scheduleQueries calendar sync propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps calendarSync from create schedule responses', async () => {
    mockCallBackend.mockResolvedValueOnce({ schedule, calendarSync });

    const result = await createSchedule({
      teamId: 'team-1',
      jwt: 'jwt',
      title: '회의',
      startAt: '2026-05-28T01:00:00.000Z',
    });

    expect(result.calendarSync).toEqual(calendarSync);
  });

  it('keeps calendarSync from update schedule responses', async () => {
    mockCallBackend.mockResolvedValueOnce({ schedule, calendarSync });

    const result = await updateSchedule({
      teamId: 'team-1',
      jwt: 'jwt',
      scheduleId: 'schedule-1',
      title: '변경된 회의',
    });

    expect(result.calendarSync).toEqual(calendarSync);
  });

  it('returns calendarSync from delete schedule responses', async () => {
    mockCallBackend.mockResolvedValueOnce({ message: '삭제되었습니다.', calendarSync });

    const result = await deleteSchedule({
      teamId: 'team-1',
      jwt: 'jwt',
      scheduleId: 'schedule-1',
    });

    expect(result.calendarSync).toEqual(calendarSync);
  });
});
