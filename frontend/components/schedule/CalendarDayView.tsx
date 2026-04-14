'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { Schedule } from '@/types/schedule';
import { utcToKST, formatTime, formatDateKorean } from '@/lib/utils/timezone';

export const HOUR_PX = 56;
const MIN_COL_WIDTH_PCT = 20; // 5개 초과 시 컬럼당 최소 너비(%)
const MAX_INLINE_COLS = 5;    // 이 수를 초과하면 가로 스크롤 적용

// 색상별 Tailwind 클래스 매핑
const COLOR_CLASSES: Record<NonNullable<Schedule['color']>, { bg: string; text: string; border: string; hover: string; textLight: string }> = {
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-400', hover: 'hover:bg-indigo-200', textLight: 'text-indigo-600' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-400', hover: 'hover:bg-blue-200', textLight: 'text-blue-600' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-400', hover: 'hover:bg-emerald-200', textLight: 'text-emerald-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-400', hover: 'hover:bg-amber-200', textLight: 'text-amber-600' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-400', hover: 'hover:bg-rose-200', textLight: 'text-rose-600' },
};

interface CalendarDayViewProps {
  currentDate: Date;
  schedules?: Schedule[];
  selectedDate?: Date;
  onDateClick?: (date: Date) => void;
  onScheduleClick?: (schedule: Schedule) => void;
}

export interface LayoutItem {
  schedule: Schedule;
  column: number;
  totalColumns: number;
  startMin: number; // KST 기준 자정부터의 분
  endMin: number;   // KST 기준 자정부터의 분 (최소 startMin + 15)
}

/** UTC 타임스탬프 → KST 자정부터의 분 */
export function getKSTMinutes(utcDateStr: string): number {
  const kst = utcToKST(new Date(utcDateStr));
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

/** KST 기준으로 날짜만 추출한 Date(UTC midnight) */
function scheduleToDay(utcDate: Date): Date {
  const kst = utcToKST(utcDate);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

/**
 * 일정 목록을 받아 각 일정의 column, totalColumns, startMin/endMin 을 반환합니다.
 *
 * 너비 규칙 (실제로 겹치는 일정 수 기준)
 *   겹치지 않는 일정 → 각각 100% 너비 (column=0)
 *   겹치는 일정 N개 → 각각 100/N % 너비
 *   totalColumns > 5 → 컬럼당 20% (가로 스크롤)
 *
 * 컬럼 배정: 시작 시각 오름차순 정렬 후, 겹치지 않는 첫 번째 빈 컬럼에 배정
 */
export function computeLayout(schedules: Schedule[]): LayoutItem[] {
  if (schedules.length === 0) return [];

  const sorted = [...schedules].sort((a, b) => {
    const diff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    if (diff !== 0) return diff;
    // 같은 시작 시각 → 긴 일정 먼저
    return new Date(b.endAt).getTime() - new Date(a.endAt).getTime();
  });

  const items: LayoutItem[] = sorted.map(schedule => {
    const startMin = getKSTMinutes(schedule.startAt);
    const rawEnd = getKSTMinutes(schedule.endAt);
    const endMin = Math.max(rawEnd, startMin + 15); // 최소 15분 높이 보장
    return { schedule, column: 0, totalColumns: 1, startMin, endMin };
  });

  // 그리디 컬럼 배정: columnEnds[c] = 컬럼 c에 마지막으로 배정된 일정의 endMin
  const columnEnds: number[] = [];
  for (const item of items) {
    const freeCol = columnEnds.findIndex(end => end <= item.startMin);
    if (freeCol !== -1) {
      item.column = freeCol;
      columnEnds[freeCol] = item.endMin;
    } else {
      item.column = columnEnds.length;
      columnEnds.push(item.endMin);
    }
  }

  // 각 일정의 totalColumns = 자신과 겹치는 일정 중 가장 큰 column 인덱스 + 1
  for (let i = 0; i < items.length; i++) {
    let maxCol = items[i].column;
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const a = items[i];
      const b = items[j];
      if (b.startMin < a.endMin && b.endMin > a.startMin) {
        maxCol = Math.max(maxCol, b.column);
      }
    }
    items[i].totalColumns = maxCol + 1;
  }

  return items;
}

export function CalendarDayView({
  currentDate,
  schedules = [],
  onScheduleClick,
}: CalendarDayViewProps) {
  const targetDay = useMemo(
    () => new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate())),
    [currentDate]
  );

  // 당일 시작~종료하는 일정만 추출 (다일 일정 제외)
  const timedSchedules = useMemo(
    () =>
      schedules.filter(s => {
        const startDay = scheduleToDay(new Date(s.startAt));
        const endDay = scheduleToDay(new Date(s.endAt));
        return startDay.getTime() === endDay.getTime() && startDay.getTime() === targetDay.getTime();
      }),
    [schedules, targetDay]
  );

  const layoutItems = useMemo(() => computeLayout(timedSchedules), [timedSchedules]);

  const maxConcurrentCols = useMemo(
    () => (layoutItems.length > 0 ? Math.max(...layoutItems.map(i => i.totalColumns)) : 1),
    [layoutItems]
  );

  const needsHScroll = maxConcurrentCols > MAX_INLINE_COLS;

  // 자동 스크롤: 가장 이른 일정 1시간 전, 없으면 08:00
  const timelineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!timelineRef.current) return;
    if (timedSchedules.length > 0) {
      const minMin = Math.min(...timedSchedules.map(s => getKSTMinutes(s.startAt)));
      const scrollHour = Math.max(0, Math.floor(minMin / 60) - 1);
      timelineRef.current.scrollTop = scrollHour * HOUR_PX;
    } else {
      timelineRef.current.scrollTop = 8 * HOUR_PX;
    }
  }, [timedSchedules]);

  return (
    <div className="w-full">
      {/* 날짜 헤더 */}
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{formatDateKorean(currentDate)}</h3>
        <p className="text-sm text-gray-500 mt-1">일정 {timedSchedules.length}개</p>
      </div>

      {/* 타임라인 세로 스크롤 */}
      <div
        ref={timelineRef}
        className="border border-gray-200 rounded-lg bg-white overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 260px)' }}
      >
        <div className="flex" style={{ height: `${24 * HOUR_PX}px` }}>
          {/* 시간 레이블 컬럼 */}
          <div className="flex-shrink-0 w-14 border-r border-gray-200">
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className="border-b border-gray-100 flex items-start px-1 pt-1"
                style={{ height: `${HOUR_PX}px` }}
              >
                <span className="text-xs text-gray-400 leading-none">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* 일정 영역 (필요 시 가로 스크롤) */}
          <div
            className="flex-1 relative"
            style={{ overflowX: needsHScroll ? 'auto' : 'hidden' }}
          >
            {/* 시간 구분선 */}
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-b border-gray-100 pointer-events-none"
                style={{ top: `${hour * HOUR_PX}px`, height: `${HOUR_PX}px` }}
              />
            ))}

            {/* 일정 컨테이너 (5개 초과 시 최소 너비 확장) */}
            <div
              className="absolute inset-0"
              style={{
                minWidth: needsHScroll ? `${maxConcurrentCols * MIN_COL_WIDTH_PCT}%` : '100%',
              }}
            >
              {layoutItems.map(({ schedule, column, totalColumns, startMin, endMin }) => {
                const GAP_PX = 2;
                const top = (startMin / 60) * HOUR_PX + GAP_PX;
                const colWidthPct =
                  totalColumns > MAX_INLINE_COLS ? MIN_COL_WIDTH_PCT : 100 / totalColumns;
                const height = Math.max(((endMin - startMin) / 60) * HOUR_PX - GAP_PX, 22);
                const leftPct = column * colWidthPct;

                return (
                  <div
                    key={schedule.id}
                    className="absolute px-0.5"
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      left: `${leftPct}%`,
                      width: `${colWidthPct}%`,
                    }}
                  >
                    <div
                      onClick={() => onScheduleClick?.(schedule)}
                      className={`w-full h-full overflow-hidden ${COLOR_CLASSES[schedule.color ?? 'indigo'].bg} ${COLOR_CLASSES[schedule.color ?? 'indigo'].text} text-xs px-1.5 py-0.5 rounded cursor-pointer ${COLOR_CLASSES[schedule.color ?? 'indigo'].hover} transition-colors duration-150 break-words border-l-2 ${COLOR_CLASSES[schedule.color ?? 'indigo'].border}`}
                      title={schedule.title}
                    >
                      <div className="font-semibold break-words leading-tight">{schedule.title}</div>
                      <div className={`${COLOR_CLASSES[schedule.color ?? 'indigo'].textLight} text-[10px]`}>
                        {formatTime(new Date(schedule.startAt))} ~ {formatTime(new Date(schedule.endAt))}
                      </div>
                      {schedule.description && (
                        <div className={`${COLOR_CLASSES[schedule.color ?? 'indigo'].textLight} text-[10px] break-words mt-0.5`}>
                          {schedule.description}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
