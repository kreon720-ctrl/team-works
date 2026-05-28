import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createScheduleWithGoogleSync,
  deleteExternalGoogleEvent,
  deleteScheduleWithGoogleSync,
  getSchedulesWithGoogleEvents,
  updateExternalGoogleEvent,
  updateScheduleWithGoogleSync,
} from '@/lib/google/scheduleCalendarService'
import {
  createSchedule,
  deleteSchedule,
  getSchedulesByDateRange,
  updateSchedule,
} from '@/lib/db/queries/scheduleQueries'
import {
  getActiveTeamCalendarIntegration,
  getCalendarEventMappingByLocalSchedule,
  getCalendarEventMappingsByTeam,
  markCalendarEventMappingDeleted,
  markCalendarEventMappingDeleteFailed,
  upsertCalendarEventMapping,
} from '@/lib/db/queries/calendarIntegrationQueries'
import {
  insertGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleCalendarEvents,
  refreshGoogleCalendarAccessToken,
  updateGoogleCalendarEvent,
} from '@/lib/google/calendarClient'

vi.mock('@/lib/db/queries/scheduleQueries', () => ({
  createSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  getSchedulesByDateRange: vi.fn(),
  updateSchedule: vi.fn(),
}))

vi.mock('@/lib/db/queries/calendarIntegrationQueries', () => ({
  getActiveTeamCalendarIntegration: vi.fn(),
  getCalendarEventMappingByLocalSchedule: vi.fn(),
  getCalendarEventMappingsByTeam: vi.fn(),
  markCalendarEventMappingDeleted: vi.fn(),
  markCalendarEventMappingDeleteFailed: vi.fn(),
  markCalendarEventMappingFailed: vi.fn(),
  upsertCalendarEventMapping: vi.fn(),
}))

vi.mock('@/lib/google/calendarClient', () => ({
  deleteGoogleCalendarEvent: vi.fn(),
  insertGoogleCalendarEvent: vi.fn(),
  listGoogleCalendarEvents: vi.fn(),
  refreshGoogleCalendarAccessToken: vi.fn(),
  updateGoogleCalendarEvent: vi.fn(),
}))

const mockCreateSchedule = vi.mocked(createSchedule)
const mockDeleteSchedule = vi.mocked(deleteSchedule)
const mockGetSchedulesByDateRange = vi.mocked(getSchedulesByDateRange)
const mockUpdateSchedule = vi.mocked(updateSchedule)
const mockGetActiveTeamCalendarIntegration = vi.mocked(getActiveTeamCalendarIntegration)
const mockGetCalendarEventMappingByLocalSchedule = vi.mocked(getCalendarEventMappingByLocalSchedule)
const mockGetCalendarEventMappingsByTeam = vi.mocked(getCalendarEventMappingsByTeam)
const mockMarkCalendarEventMappingDeleted = vi.mocked(markCalendarEventMappingDeleted)
const mockMarkCalendarEventMappingDeleteFailed = vi.mocked(markCalendarEventMappingDeleteFailed)
const mockUpsertCalendarEventMapping = vi.mocked(upsertCalendarEventMapping)
const mockDeleteGoogleCalendarEvent = vi.mocked(deleteGoogleCalendarEvent)
const mockInsertGoogleCalendarEvent = vi.mocked(insertGoogleCalendarEvent)
const mockListGoogleCalendarEvents = vi.mocked(listGoogleCalendarEvents)
const mockRefreshGoogleCalendarAccessToken = vi.mocked(refreshGoogleCalendarAccessToken)
const mockUpdateGoogleCalendarEvent = vi.mocked(updateGoogleCalendarEvent)

const schedule = {
  id: 'schedule-1',
  team_id: 'team-1',
  created_by: 'user-1',
  creator_name: 'User',
  title: 'Local schedule',
  description: null,
  color: 'indigo',
  start_at: new Date('2026-05-28T01:00:00.000Z'),
  end_at: new Date('2026-05-28T02:00:00.000Z'),
  created_at: new Date('2026-05-27T00:00:00.000Z'),
  updated_at: new Date('2026-05-27T00:00:00.000Z'),
}

const integration = {
  id: 'integration-1',
  team_id: 'team-1',
  user_id: 'user-1',
  provider: 'google' as const,
  google_calendar_id: 'primary',
  google_account_email: 'user@example.com',
  encrypted_refresh_token: 'encrypted',
  scope: 'https://www.googleapis.com/auth/calendar.events',
  connected_at: new Date('2026-05-27T00:00:00.000Z'),
  disconnected_at: null,
  status: 'connected' as const,
  created_at: new Date('2026-05-27T00:00:00.000Z'),
  updated_at: new Date('2026-05-27T00:00:00.000Z'),
}

const mapping = {
  id: 'mapping-1',
  team_id: 'team-1',
  local_schedule_id: 'schedule-1',
  google_event_id: 'google-event-1',
  google_calendar_id: 'primary',
  sync_direction: 'teamworks_to_google' as const,
  last_synced_at: null,
  last_google_updated: null,
  sync_status: 'synced' as const,
  last_error: null,
  created_at: new Date(),
  updated_at: new Date(),
}

describe('scheduleCalendarService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMarkCalendarEventMappingDeleted.mockResolvedValue(null)
    mockMarkCalendarEventMappingDeleteFailed.mockResolvedValue(null)
  })

  it('returns local schedules with external Google events and excludes mapped Google events', async () => {
    mockGetSchedulesByDateRange.mockResolvedValue([schedule])
    mockGetActiveTeamCalendarIntegration.mockResolvedValue(integration)
    mockRefreshGoogleCalendarAccessToken.mockResolvedValue('access-token')
    mockListGoogleCalendarEvents.mockResolvedValue([
      {
        id: 'google-external',
        summary: 'External event',
        start: { dateTime: '2026-05-28T03:00:00.000Z' },
        end: { dateTime: '2026-05-28T04:00:00.000Z' },
      },
      {
        id: 'google-mapped',
        summary: 'Mapped event',
        start: { dateTime: '2026-05-28T05:00:00.000Z' },
      },
    ])
    mockGetCalendarEventMappingsByTeam.mockResolvedValue([{
      ...mapping,
      google_event_id: 'google-mapped',
    }])

    const result = await getSchedulesWithGoogleEvents({
      teamId: 'team-1',
      start: new Date('2026-05-28T00:00:00.000Z'),
      end: new Date('2026-05-29T00:00:00.000Z'),
    })

    expect(result.calendarSync).toEqual({ attempted: true, success: true })
    expect(result.schedules.map((item) => item.id)).toEqual(['schedule-1', 'google:google-external'])
    expect(result.schedules[1].editable).toBe(true)
  })

  it('normalizes Google date-only events to 00:00-01:00 with an unset-time description prefix', async () => {
    mockGetSchedulesByDateRange.mockResolvedValue([])
    mockGetActiveTeamCalendarIntegration.mockResolvedValue(integration)
    mockRefreshGoogleCalendarAccessToken.mockResolvedValue('access-token')
    mockListGoogleCalendarEvents.mockResolvedValue([
      {
        id: 'google-all-day',
        summary: 'All day event',
        description: 'Original memo',
        start: { date: '2026-05-28' },
        end: { date: '2026-05-29' },
      },
    ])
    mockGetCalendarEventMappingsByTeam.mockResolvedValue([])

    const result = await getSchedulesWithGoogleEvents({
      teamId: 'team-1',
      start: new Date('2026-05-28T00:00:00.000Z'),
      end: new Date('2026-05-29T00:00:00.000Z'),
    })

    expect(result.schedules[0]).toMatchObject({
      id: 'google:google-all-day',
      startAt: '2026-05-28T00:00:00+09:00',
      endAt: '2026-05-28T01:00:00+09:00',
      description: '시간 미설정\nOriginal memo',
    })
  })

  it('creates a local schedule and inserts a Google event when integration exists', async () => {
    mockCreateSchedule.mockResolvedValue(schedule)
    mockGetActiveTeamCalendarIntegration.mockResolvedValue(integration)
    mockRefreshGoogleCalendarAccessToken.mockResolvedValue('access-token')
    mockInsertGoogleCalendarEvent.mockResolvedValue({
      id: 'google-event-1',
      updated: '2026-05-28T02:00:00.000Z',
    })

    const result = await createScheduleWithGoogleSync({
      teamId: 'team-1',
      createdBy: 'user-1',
      title: 'Local schedule',
      startAt: schedule.start_at,
      endAt: schedule.end_at,
    })

    expect(result.calendarSync).toMatchObject({
      attempted: true,
      success: true,
      googleEventId: 'google-event-1',
    })
    expect(mockInsertGoogleCalendarEvent).toHaveBeenCalledTimes(1)
    expect(mockUpsertCalendarEventMapping).toHaveBeenCalledWith(expect.objectContaining({
      localScheduleId: 'schedule-1',
      googleEventId: 'google-event-1',
    }))
  })

  it('updates a Google event when the local schedule has a mapping', async () => {
    mockUpdateSchedule.mockResolvedValue(schedule)
    mockGetActiveTeamCalendarIntegration.mockResolvedValue(integration)
    mockRefreshGoogleCalendarAccessToken.mockResolvedValue('access-token')
    mockGetCalendarEventMappingByLocalSchedule.mockResolvedValue(mapping)
    mockUpdateGoogleCalendarEvent.mockResolvedValue({
      id: 'google-event-1',
      updated: '2026-05-28T03:00:00.000Z',
    })

    const result = await updateScheduleWithGoogleSync({
      teamId: 'team-1',
      scheduleId: 'schedule-1',
      update: { title: 'Updated' },
    })

    expect(result?.calendarSync).toMatchObject({
      attempted: true,
      success: true,
      googleEventId: 'google-event-1',
    })
    expect(mockUpdateGoogleCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'google-event-1',
    }))
  })

  it('updates an external Google event directly', async () => {
    mockGetActiveTeamCalendarIntegration.mockResolvedValue(integration)
    mockRefreshGoogleCalendarAccessToken.mockResolvedValue('access-token')
    mockUpdateGoogleCalendarEvent.mockResolvedValue({
      id: 'google-external',
      summary: 'Updated external',
      description: 'Updated memo',
      start: { dateTime: '2026-05-28T03:00:00.000Z' },
      end: { dateTime: '2026-05-28T04:00:00.000Z' },
      updated: '2026-05-28T03:30:00.000Z',
    })

    const result = await updateExternalGoogleEvent({
      teamId: 'team-1',
      googleEventId: 'google-external',
      update: {
        title: 'Updated external',
        description: 'Updated memo',
        startAt: new Date('2026-05-28T03:00:00.000Z'),
        endAt: new Date('2026-05-28T04:00:00.000Z'),
      },
    })

    expect(result?.schedule).toMatchObject({
      id: 'google:google-external',
      title: 'Updated external',
      source: 'google',
      editable: true,
    })
    expect(mockUpdateGoogleCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'google-external',
      event: expect.objectContaining({
        summary: 'Updated external',
        description: 'Updated memo',
      }),
    }))
  })

  it('deletes a Google event and marks the mapping deleted after local deletion', async () => {
    mockGetActiveTeamCalendarIntegration.mockResolvedValue(integration)
    mockRefreshGoogleCalendarAccessToken.mockResolvedValue('access-token')
    mockGetCalendarEventMappingByLocalSchedule.mockResolvedValue(mapping)
    mockDeleteSchedule.mockResolvedValue(true)
    mockDeleteGoogleCalendarEvent.mockResolvedValue(undefined)

    const result = await deleteScheduleWithGoogleSync({
      teamId: 'team-1',
      scheduleId: 'schedule-1',
    })

    expect(result).toMatchObject({
      deleted: true,
      calendarSync: {
        attempted: true,
        success: true,
        googleEventId: 'google-event-1',
      },
    })
    expect(mockDeleteGoogleCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'google-event-1',
    }))
    expect(mockMarkCalendarEventMappingDeleted).toHaveBeenCalledWith({ mappingId: 'mapping-1' })
  })

  it('deletes an external Google event directly', async () => {
    mockGetActiveTeamCalendarIntegration.mockResolvedValue(integration)
    mockRefreshGoogleCalendarAccessToken.mockResolvedValue('access-token')
    mockDeleteGoogleCalendarEvent.mockResolvedValue(undefined)

    const result = await deleteExternalGoogleEvent({
      teamId: 'team-1',
      googleEventId: 'google-external',
    })

    expect(result).toMatchObject({
      deleted: true,
      calendarSync: {
        attempted: true,
        success: true,
        googleEventId: 'google-external',
      },
    })
    expect(mockDeleteGoogleCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'google-external',
    }))
  })

  it('keeps local deletion and records mapping failure when Google delete fails', async () => {
    mockGetActiveTeamCalendarIntegration.mockResolvedValue(integration)
    mockRefreshGoogleCalendarAccessToken.mockResolvedValue('access-token')
    mockGetCalendarEventMappingByLocalSchedule.mockResolvedValue(mapping)
    mockDeleteSchedule.mockResolvedValue(true)
    mockDeleteGoogleCalendarEvent.mockRejectedValue(new Error('delete failed'))

    const result = await deleteScheduleWithGoogleSync({
      teamId: 'team-1',
      scheduleId: 'schedule-1',
    })

    expect(result).toMatchObject({
      deleted: true,
      calendarSync: {
        attempted: true,
        success: false,
        error: 'delete failed',
        googleEventId: 'google-event-1',
      },
    })
    expect(mockMarkCalendarEventMappingDeleteFailed).toHaveBeenCalledWith({
      mappingId: 'mapping-1',
      lastError: 'delete failed',
    })
  })
})
