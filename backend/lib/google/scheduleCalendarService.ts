import {
  createSchedule,
  getSchedulesByDateRange,
  updateSchedule,
  deleteSchedule,
  Schedule,
  CreateScheduleParams,
  UpdateScheduleParams,
} from '@/lib/db/queries/scheduleQueries'
import {
  getActiveTeamCalendarIntegration,
  getCalendarEventMappingByLocalSchedule,
  getCalendarEventMappingsByTeam,
  markCalendarEventMappingFailed,
  markCalendarEventMappingDeleted,
  markCalendarEventMappingDeleteFailed,
  upsertCalendarEventMapping,
} from '@/lib/db/queries/calendarIntegrationQueries'
import {
  GoogleCalendarEvent,
  GoogleCalendarEventInput,
  insertGoogleCalendarEvent,
  listGoogleCalendarEvents,
  refreshGoogleCalendarAccessToken,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from '@/lib/google/calendarClient'

export type CalendarScheduleSource = 'local' | 'google'

export interface CalendarScheduleResponse {
  id: string
  teamId: string
  title: string
  description: string | null
  color: string
  startAt: Date | string
  endAt: Date | string | null
  createdBy?: string
  creatorName?: string | null
  createdAt?: Date
  updatedAt?: Date
  source: CalendarScheduleSource
  editable: boolean
  googleEventId?: string
}

export interface CalendarSyncResult {
  attempted: boolean
  success: boolean
  error?: string
  googleEventId?: string
}

export interface ScheduleMutationResult {
  schedule: Schedule
  calendarSync: CalendarSyncResult
}

export interface ScheduleDeleteResult {
  deleted: boolean
  calendarSync: CalendarSyncResult
}

export interface GoogleEventMutationResult {
  schedule: CalendarScheduleResponse
  calendarSync: CalendarSyncResult
}

function scheduleToResponse(schedule: Schedule): CalendarScheduleResponse {
  return {
    id: schedule.id,
    teamId: schedule.team_id,
    title: schedule.title,
    description: schedule.description,
    color: schedule.color,
    startAt: schedule.start_at,
    endAt: schedule.end_at,
    createdBy: schedule.created_by,
    creatorName: schedule.creator_name,
    createdAt: schedule.created_at,
    updatedAt: schedule.updated_at,
    source: 'local',
    editable: true,
  }
}

function googleEventToResponse(
  event: GoogleCalendarEvent,
  teamId: string
): CalendarScheduleResponse | null {
  const isDateOnly = Boolean(event.start?.date && !event.start.dateTime)
  const startAt = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00+09:00` : undefined)
  const endAt = event.end?.dateTime ?? (isDateOnly && event.start?.date ? `${event.start.date}T01:00:00+09:00` : event.end?.date ?? null)
  if (!event.id || !startAt) return null
  const description = isDateOnly
    ? ['시간 미설정', event.description].filter(Boolean).join('\n')
    : event.description ?? null

  return {
    id: `google:${event.id}`,
    teamId,
    title: event.summary || '(제목 없음)',
    description,
    color: 'blue',
    startAt,
    endAt,
    source: 'google',
    editable: true,
    googleEventId: event.id,
  }
}

function toGoogleEventPatch(update: UpdateScheduleParams): Partial<GoogleCalendarEventInput> {
  const event: Partial<GoogleCalendarEventInput> = {}
  if (update.title !== undefined) event.summary = update.title
  if (update.description !== undefined) event.description = update.description
  if (update.startAt) event.start = { dateTime: update.startAt.toISOString() }
  if (update.endAt) {
    event.end = { dateTime: update.endAt.toISOString() }
  } else if (update.endAt === null && update.startAt) {
    event.end = { dateTime: new Date(update.startAt.getTime() + 30 * 60 * 1000).toISOString() }
  }
  return event
}

function toGoogleEventInput(schedule: Schedule): GoogleCalendarEventInput {
  const start = schedule.start_at.toISOString()
  const end = schedule.end_at
    ? schedule.end_at.toISOString()
    : new Date(schedule.start_at.getTime() + 30 * 60 * 1000).toISOString()

  return {
    summary: schedule.title,
    description: schedule.description,
    start: { dateTime: start },
    end: { dateTime: end },
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Google Calendar 동기화 중 알 수 없는 오류가 발생했습니다.'
}

async function getCalendarAccess(teamId: string): Promise<{
  accessToken: string
  calendarId: string
} | null> {
  const integration = await getActiveTeamCalendarIntegration(teamId)
  if (!integration) return null

  const accessToken = await refreshGoogleCalendarAccessToken(integration.encrypted_refresh_token)
  return {
    accessToken,
    calendarId: integration.google_calendar_id,
  }
}

export async function getSchedulesWithGoogleEvents(params: {
  teamId: string
  start: Date
  end: Date
}): Promise<{
  schedules: CalendarScheduleResponse[]
  calendarSync: CalendarSyncResult
}> {
  const localSchedules = await getSchedulesByDateRange(params.teamId, params.start, params.end)
  const localResponses = localSchedules.map(scheduleToResponse)

  try {
    const access = await getCalendarAccess(params.teamId)
    if (!access) {
      return {
        schedules: localResponses,
        calendarSync: { attempted: false, success: true },
      }
    }

    const [events, mappings] = await Promise.all([
      listGoogleCalendarEvents({
        accessToken: access.accessToken,
        calendarId: access.calendarId,
        timeMin: params.start.toISOString(),
        timeMax: params.end.toISOString(),
      }),
      getCalendarEventMappingsByTeam(params.teamId),
    ])

    const mappedGoogleEventIds = new Set(
      mappings
        .filter((mapping) => mapping.sync_status !== 'deleted')
        .map((mapping) => mapping.google_event_id)
    )
    const googleResponses = events
      .filter((event) => !mappedGoogleEventIds.has(event.id))
      .map((event) => googleEventToResponse(event, params.teamId))
      .filter((event): event is CalendarScheduleResponse => Boolean(event))

    return {
      schedules: [...localResponses, ...googleResponses],
      calendarSync: { attempted: true, success: true },
    }
  } catch (err) {
    return {
      schedules: localResponses,
      calendarSync: {
        attempted: true,
        success: false,
        error: errorMessage(err),
      },
    }
  }
}

export async function createScheduleWithGoogleSync(
  params: CreateScheduleParams
): Promise<ScheduleMutationResult> {
  const schedule = await createSchedule(params)

  try {
    const access = await getCalendarAccess(params.teamId)
    if (!access) {
      return {
        schedule,
        calendarSync: { attempted: false, success: true },
      }
    }

    const event = await insertGoogleCalendarEvent({
      accessToken: access.accessToken,
      calendarId: access.calendarId,
      event: toGoogleEventInput(schedule),
    })
    await upsertCalendarEventMapping({
      teamId: params.teamId,
      localScheduleId: schedule.id,
      googleEventId: event.id,
      googleCalendarId: access.calendarId,
      lastGoogleUpdated: event.updated ? new Date(event.updated) : null,
    })

    return {
      schedule,
      calendarSync: {
        attempted: true,
        success: true,
        googleEventId: event.id,
      },
    }
  } catch (err) {
    const message = errorMessage(err)
    await markCalendarEventMappingFailed({
      teamId: params.teamId,
      localScheduleId: schedule.id,
      lastError: message,
    }).catch(() => undefined)

    return {
      schedule,
      calendarSync: {
        attempted: true,
        success: false,
        error: message,
      },
    }
  }
}

export async function updateScheduleWithGoogleSync(params: {
  teamId: string
  scheduleId: string
  update: UpdateScheduleParams
}): Promise<ScheduleMutationResult | null> {
  const schedule = await updateSchedule(params.teamId, params.scheduleId, params.update)
  if (!schedule) return null

  try {
    const [access, mapping] = await Promise.all([
      getCalendarAccess(params.teamId),
      getCalendarEventMappingByLocalSchedule(params.scheduleId),
    ])

    if (!access || !mapping || mapping.sync_status === 'deleted' || mapping.google_event_id.startsWith('failed:')) {
      return {
        schedule,
        calendarSync: { attempted: false, success: true },
      }
    }

    const event = await updateGoogleCalendarEvent({
      accessToken: access.accessToken,
      calendarId: mapping.google_calendar_id,
      eventId: mapping.google_event_id,
      event: toGoogleEventInput(schedule),
    })
    await upsertCalendarEventMapping({
      teamId: params.teamId,
      localScheduleId: schedule.id,
      googleEventId: event.id,
      googleCalendarId: mapping.google_calendar_id,
      lastGoogleUpdated: event.updated ? new Date(event.updated) : null,
    })

    return {
      schedule,
      calendarSync: {
        attempted: true,
        success: true,
        googleEventId: event.id,
      },
    }
  } catch (err) {
    const message = errorMessage(err)
    const mapping = await getCalendarEventMappingByLocalSchedule(params.scheduleId).catch(() => null)
    await markCalendarEventMappingFailed({
      teamId: params.teamId,
      localScheduleId: schedule.id,
      googleEventId: mapping?.google_event_id,
      googleCalendarId: mapping?.google_calendar_id,
      lastError: message,
    }).catch(() => undefined)

    return {
      schedule,
      calendarSync: {
        attempted: true,
        success: false,
        error: message,
      },
    }
  }
}

export async function updateExternalGoogleEvent(params: {
  teamId: string
  googleEventId: string
  update: UpdateScheduleParams
}): Promise<GoogleEventMutationResult | null> {
  try {
    const access = await getCalendarAccess(params.teamId)
    if (!access) {
      return null
    }

    const event = await updateGoogleCalendarEvent({
      accessToken: access.accessToken,
      calendarId: access.calendarId,
      eventId: params.googleEventId,
      event: toGoogleEventPatch(params.update),
    })
    const schedule = googleEventToResponse(event, params.teamId)
    if (!schedule) return null

    return {
      schedule,
      calendarSync: {
        attempted: true,
        success: true,
        googleEventId: event.id,
      },
    }
  } catch (err) {
    return {
      schedule: {
        id: `google:${params.googleEventId}`,
        teamId: params.teamId,
        title: params.update.title ?? 'Google Calendar 일정',
        description: params.update.description ?? null,
        color: 'blue',
        startAt: params.update.startAt ?? new Date(),
        endAt: params.update.endAt ?? null,
        source: 'google',
        editable: true,
        googleEventId: params.googleEventId,
      },
      calendarSync: {
        attempted: true,
        success: false,
        error: errorMessage(err),
        googleEventId: params.googleEventId,
      },
    }
  }
}

export async function deleteExternalGoogleEvent(params: {
  teamId: string
  googleEventId: string
}): Promise<ScheduleDeleteResult> {
  const access = await getCalendarAccess(params.teamId)
  if (!access) {
    return {
      deleted: false,
      calendarSync: { attempted: false, success: true },
    }
  }

  await deleteGoogleCalendarEvent({
    accessToken: access.accessToken,
    calendarId: access.calendarId,
    eventId: params.googleEventId,
  })

  return {
    deleted: true,
    calendarSync: {
      attempted: true,
      success: true,
      googleEventId: params.googleEventId,
    },
  }
}

export async function deleteScheduleWithGoogleSync(params: {
  teamId: string
  scheduleId: string
}): Promise<ScheduleDeleteResult> {
  const [access, mapping] = await Promise.all([
    getCalendarAccess(params.teamId).catch(() => null),
    getCalendarEventMappingByLocalSchedule(params.scheduleId),
  ])

  const deleted = await deleteSchedule(params.teamId, params.scheduleId)
  if (!deleted) {
    return {
      deleted: false,
      calendarSync: { attempted: false, success: true },
    }
  }

  if (!access || !mapping || mapping.sync_status === 'deleted' || mapping.google_event_id.startsWith('failed:')) {
    return {
      deleted: true,
      calendarSync: { attempted: false, success: true },
    }
  }

  try {
    await deleteGoogleCalendarEvent({
      accessToken: access.accessToken,
      calendarId: mapping.google_calendar_id,
      eventId: mapping.google_event_id,
    })
    await markCalendarEventMappingDeleted({ mappingId: mapping.id })

    return {
      deleted: true,
      calendarSync: {
        attempted: true,
        success: true,
        googleEventId: mapping.google_event_id,
      },
    }
  } catch (err) {
    const message = errorMessage(err)
    await markCalendarEventMappingDeleteFailed({
      mappingId: mapping.id,
      lastError: message,
    }).catch(() => undefined)

    return {
      deleted: true,
      calendarSync: {
        attempted: true,
        success: false,
        error: message,
        googleEventId: mapping.google_event_id,
      },
    }
  }
}
