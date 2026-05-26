// Schedule types

export type CalendarView = 'month' | 'week' | 'day' | 'project';

export type ScheduleColor = 'indigo' | 'blue' | 'emerald' | 'amber' | 'rose';

export const SCHEDULE_COLORS: ScheduleColor[] = ['indigo', 'amber', 'blue', 'emerald', 'rose'];

export interface Schedule {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  startAt: string;
  // 종료시각은 선택 입력. null 이면 시작시각만 정해진 일정.
  endAt: string | null;
  color?: ScheduleColor;
  createdBy: string;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleCreateInput {
  title: string;
  description?: string;
  startAt: string;
  // 선택 입력. 미입력 시 백엔드에 null 로 저장.
  endAt?: string | null;
  color?: ScheduleColor;
}

export type ScheduleUpdateInput = Partial<ScheduleCreateInput>;

export interface ScheduleQueryParams {
  view?: CalendarView;
  date?: string; // YYYY-MM-DD
}

// API 명세 GET /api/teams/:teamId/schedules 응답
export interface ScheduleListResponse {
  schedules: Schedule[];
}
