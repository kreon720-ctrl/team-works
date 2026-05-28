import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai-assistant/execute/route';
import { createSchedule, deleteSchedule, updateSchedule } from '@/lib/mcp/scheduleQueries';

vi.mock('@/lib/mcp/scheduleQueries', () => ({
  createSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  updateSchedule: vi.fn(),
}));

const mockCreateSchedule = vi.mocked(createSchedule);
const mockDeleteSchedule = vi.mocked(deleteSchedule);
const mockUpdateSchedule = vi.mocked(updateSchedule);

const calendarSync = {
  attempted: true,
  success: false,
  error: 'Google API failed',
};

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ai-assistant/execute', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('AI assistant execute route calendar sync propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns calendarSync for createSchedule', async () => {
    mockCreateSchedule.mockResolvedValueOnce({
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
      calendarSync,
    });

    const response = await POST(request({
      tool: 'createSchedule',
      args: {
        teamId: 'team-1',
        title: '회의',
        startAt: '2026-05-28T01:00:00.000Z',
      },
    }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.calendarSync).toEqual(calendarSync);
  });

  it('returns calendarSync for updateSchedule', async () => {
    mockUpdateSchedule.mockResolvedValueOnce({
      id: 'schedule-1',
      teamId: 'team-1',
      title: '변경된 회의',
      description: null,
      color: 'indigo',
      startAt: '2026-05-28T01:00:00.000Z',
      endAt: null,
      createdBy: 'user-1',
      creatorName: 'User',
      createdAt: '2026-05-27T00:00:00.000Z',
      updatedAt: '2026-05-27T00:00:00.000Z',
      calendarSync,
    });

    const response = await POST(request({
      tool: 'updateSchedule',
      args: {
        teamId: 'team-1',
        scheduleId: 'schedule-1',
        title: '변경된 회의',
      },
    }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.calendarSync).toEqual(calendarSync);
  });

  it('returns calendarSync for deleteSchedule', async () => {
    mockDeleteSchedule.mockResolvedValueOnce({ calendarSync });

    const response = await POST(request({
      tool: 'deleteSchedule',
      args: {
        teamId: 'team-1',
        scheduleId: 'schedule-1',
      },
    }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.calendarSync).toEqual(calendarSync);
  });
});
