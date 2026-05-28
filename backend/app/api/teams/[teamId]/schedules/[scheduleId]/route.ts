import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { withTeamRole } from '@/lib/middleware/withTeamRole'
import {
  getScheduleById,
} from '@/lib/db/queries/scheduleQueries'
import {
  deleteExternalGoogleEvent,
  deleteScheduleWithGoogleSync,
  updateExternalGoogleEvent,
  updateScheduleWithGoogleSync,
} from '@/lib/google/scheduleCalendarService'

interface UpdateScheduleBody {
  title?: string
  description?: string
  color?: string
  startAt?: string
  // 종료시각 선택. null 명시 시 기존 endAt 그대로 유지(현재 COALESCE 동작) — 명시 변경 안 함.
  endAt?: string | null
}

function extractGoogleEventId(scheduleId: string): string | null {
  return scheduleId.startsWith('google:') ? scheduleId.slice('google:'.length) : null
}

function validateUpdateDates(args: {
  startAt?: string
  endAt?: string | null
  existingStartAt?: Date
  existingEndAt?: Date | null
}): NextResponse | null {
  const { startAt, endAt, existingStartAt, existingEndAt } = args
  if (!startAt && !endAt) return null

  const startDate = startAt ? new Date(startAt) : existingStartAt
  const endDate = endAt ? new Date(endAt) : existingEndAt

  if (!startDate || Number.isNaN(startDate.getTime()) || (endDate !== null && endDate !== undefined && Number.isNaN(endDate.getTime()))) {
    return NextResponse.json(
      { error: '날짜 형식이 올바르지 않습니다.' },
      { status: 400 }
    )
  }

  if (endDate !== null && endDate !== undefined && endDate <= startDate) {
    return NextResponse.json(
      { error: '종료일은 시작일보다 늦어야 합니다.' },
      { status: 400 }
    )
  }

  return null
}

/**
 * GET /api/teams/:teamId/schedules/:scheduleId
 *
 * 일정 상세 조회
 * - 팀 멤버만 접근 가능
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; scheduleId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, scheduleId } = await params

    // 1. 팀 멤버십 검증
    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    // 2. 일정 조회
    const schedule = await getScheduleById(teamId, scheduleId)

    if (!schedule) {
      return NextResponse.json(
        { error: '일정을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
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
    })
  } catch (err) {
    console.error('Get schedule detail error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/teams/:teamId/schedules/:scheduleId
 *
 * 일정 수정 (일정 생성자만 가능)
 * - 부분 수정 지원 (title, description, startAt, endAt)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; scheduleId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, scheduleId } = await params

    // 1. 팀 멤버십 검증
    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    // 2. 기존 일정 존재 확인 및 생성자 확인
    const googleEventId = extractGoogleEventId(scheduleId)
    const body: UpdateScheduleBody = await request.json()
    const { title, description, color, startAt, endAt } = body

    if (googleEventId) {
      if (roleResult.context.role !== 'LEADER') {
        return NextResponse.json(
          { error: '팀장만 Google Calendar 일정을 수정할 수 있습니다.' },
          { status: 403 }
        )
      }

      const dateError = validateUpdateDates({ startAt, endAt })
      if (dateError) return dateError

      const result = await updateExternalGoogleEvent({
        teamId,
        googleEventId,
        update: {
          title,
          description: description ?? undefined,
          color,
          startAt: startAt ? new Date(startAt) : undefined,
          endAt: endAt === null ? null : endAt ? new Date(endAt) : undefined,
        },
      })

      if (!result) {
        return NextResponse.json(
          { error: 'Google Calendar 연결 정보를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        ...result.schedule,
        calendarSync: result.calendarSync,
      })
    }

    const existingSchedule = await getScheduleById(teamId, scheduleId)
    if (!existingSchedule) {
      return NextResponse.json(
        { error: '일정을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 일정 생성자만 수정 가능
    if (existingSchedule.created_by !== authResult.user.userId) {
      return NextResponse.json(
        { error: '일정 생성자만 수정할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 날짜 유효성 검증 (제공된 경우에만)
    const dateError = validateUpdateDates({
      startAt,
      endAt,
      existingStartAt: existingSchedule.start_at,
      existingEndAt: existingSchedule.end_at,
    })
    if (dateError) return dateError

    // 4. 일정 수정 + Google Calendar 연결 일정이면 event 수정
    const result = await updateScheduleWithGoogleSync({
      teamId,
      scheduleId,
      update: {
      title,
      description: description ?? undefined,
      color,
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt === null ? null : endAt ? new Date(endAt) : undefined,
      },
    })

    if (!result) {
      return NextResponse.json(
        { error: '일정 수정에 실패했습니다.' },
        { status: 500 }
      )
    }
    const { schedule: updatedSchedule, calendarSync } = result

    return NextResponse.json({
      id: updatedSchedule.id,
      teamId: updatedSchedule.team_id,
      title: updatedSchedule.title,
      description: updatedSchedule.description,
      color: updatedSchedule.color,
      startAt: updatedSchedule.start_at,
      endAt: updatedSchedule.end_at,
      createdBy: updatedSchedule.created_by,
      createdAt: updatedSchedule.created_at,
      updatedAt: updatedSchedule.updated_at,
      source: 'local',
      editable: true,
      googleEventId: calendarSync.googleEventId,
      calendarSync,
    })
  } catch (err) {
    console.error('Update schedule error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/teams/:teamId/schedules/:scheduleId
 *
 * 일정 삭제 (일정 생성자만 가능)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; scheduleId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await withAuth(request)
    if (!authResult.success) return authResult.response

    const { teamId, scheduleId } = await params

    // 1. 팀 멤버십 검증
    const roleResult = await withTeamRole(authResult.user.userId, teamId)
    if (!roleResult.success) return roleResult.response

    // 2. 일정 존재 확인 및 생성자 확인
    const googleEventId = extractGoogleEventId(scheduleId)
    if (googleEventId) {
      if (roleResult.context.role !== 'LEADER') {
        return NextResponse.json(
          { error: '팀장만 Google Calendar 일정을 삭제할 수 있습니다.' },
          { status: 403 }
        )
      }

      const result = await deleteExternalGoogleEvent({ teamId, googleEventId })
      if (!result.deleted) {
        return NextResponse.json(
          { error: 'Google Calendar 연결 정보를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        message: '일정이 삭제되었습니다.',
        calendarSync: result.calendarSync,
      })
    }

    const existingSchedule = await getScheduleById(teamId, scheduleId)
    if (!existingSchedule) {
      return NextResponse.json(
        { error: '일정을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 일정 생성자만 삭제 가능
    if (existingSchedule.created_by !== authResult.user.userId) {
      return NextResponse.json(
        { error: '일정 생성자만 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 3. 일정 삭제 + Google Calendar 연결 일정이면 event 삭제
    const result = await deleteScheduleWithGoogleSync({ teamId, scheduleId })

    if (!result.deleted) {
      return NextResponse.json(
        { error: '일정을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: '일정이 삭제되었습니다.',
      calendarSync: result.calendarSync,
    })
  } catch (err) {
    console.error('Delete schedule error:', err)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
