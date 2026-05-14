'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Schedule } from '@/types/schedule';
import { utcToKST, formatTime } from '@/lib/utils/timezone';
import { getKSTMinutes, HOUR_PX, computeLayout, estimateTextHeight } from './CalendarDayView';
import { ScheduleTooltip } from './ScheduleTooltip';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const GAP_PX = 2;
// 시간 컬럼 폭(px) — TIME_COL_W 클래스(w-10/w-12) 와 일치. 동적 row 알고리즘에서 요일 컬럼 폭 계산용.
const TIME_COL_W_MOBILE_PX = 40;
const TIME_COL_W_PC_PX = 48;

interface CalendarWeekViewProps {
  currentDate: Date;
  schedules?: Schedule[];
  selectedDate?: Date;
  onDateClick?: (date: Date) => void;
  onScheduleClick?: (schedule: Schedule) => void;
}

// 색상별 Tailwind 클래스 매핑
const COLOR_CLASSES: Record<NonNullable<Schedule['color']>, { bg: string; text: string; hover: string; bgDarker: string }> = {
  indigo: { bg: 'bg-indigo-100 dark:bg-[#6366F1]', text: 'text-indigo-800 dark:text-white', hover: 'hover:bg-indigo-200 dark:hover:brightness-110', bgDarker: 'bg-indigo-200 dark:bg-[#6366F1]' },
  blue: { bg: 'bg-blue-100 dark:bg-[#6366F1]', text: 'text-blue-800 dark:text-white', hover: 'hover:bg-blue-200 dark:hover:brightness-110', bgDarker: 'bg-blue-200 dark:bg-[#6366F1]' },
  emerald: { bg: 'bg-emerald-100 dark:bg-[#10B981]', text: 'text-emerald-800 dark:text-white', hover: 'hover:bg-emerald-200 dark:hover:brightness-110', bgDarker: 'bg-emerald-200 dark:bg-[#10B981]' },
  amber: { bg: 'bg-amber-100 dark:bg-[#FFB800]', text: 'text-amber-800 dark:text-gray-900', hover: 'hover:bg-amber-200 dark:hover:brightness-110', bgDarker: 'bg-amber-200 dark:bg-[#FFB800]' },
  rose: { bg: 'bg-rose-100 dark:bg-[#EF4444]', text: 'text-rose-800 dark:text-white', hover: 'hover:bg-rose-200 dark:hover:brightness-110', bgDarker: 'bg-rose-200 dark:bg-[#EF4444]' },
};

export function CalendarWeekView({ currentDate, schedules = [], selectedDate, onDateClick, onScheduleClick }: CalendarWeekViewProps) {

  // ─── 주간 날짜 배열 ──────────────────────────────────────────────────────────
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setUTCDate(currentDate.getUTCDate() - start.getUTCDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getTime());
      d.setUTCDate(start.getUTCDate() + i);
      return d;
    });
  }, [currentDate]);

  // ─── 날짜 비교 헬퍼 ─────────────────────────────────────────────────────────
  // 앰버 마커(원래 today) — 활성 currentDate 를 따라 이동 (CalendarMonthView 와 동일 패턴).
  const isToday = (date: Date): boolean => {
    return date.getUTCFullYear() === currentDate.getUTCFullYear() &&
           date.getUTCMonth()    === currentDate.getUTCMonth() &&
           date.getUTCDate()     === currentDate.getUTCDate();
  };

  const isSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    return date.getUTCFullYear() === selectedDate.getUTCFullYear() &&
           date.getUTCMonth()    === selectedDate.getUTCMonth() &&
           date.getUTCDate()     === selectedDate.getUTCDate();
  };

  const toDay = (d: Date) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  const scheduleToDay = (utcDate: Date): Date => {
    const kst = utcToKST(utcDate);
    return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
  };

  const getSchedulesForDate = (date: Date): Schedule[] => {
    const target = toDay(date);
    return schedules.filter(s => {
      const startDay = scheduleToDay(new Date(s.startAt));
      // endAt null → 시작 당일 일정으로 간주.
      const endDay   = scheduleToDay(new Date(s.endAt ?? s.startAt));
      return target >= startDay && target <= endDay;
    });
  };

  const isMultiDay = (schedule: Schedule): boolean => {
    // endAt null → 단일 일자 일정.
    if (!schedule.endAt) return false;
    const startDay = scheduleToDay(new Date(schedule.startAt));
    const endDay   = scheduleToDay(new Date(schedule.endAt));
    return startDay.getTime() !== endDay.getTime();
  };

  const [tooltip, setTooltip] = useState<{ schedule: Schedule; x: number; y: number } | null>(null);

  // ─── 자동 스크롤 (rowTops 기반 — 동적 row 확장 반영) ─────────────────────
  const timelineRef = useRef<HTMLDivElement>(null);

  // ─── 요일별 레이아웃 아이템 ─────────────────────────────────────────────────
  const layoutByDay = useMemo(
    () => weekDays.map(date =>
      computeLayout(getSchedulesForDate(date).filter(s => !isMultiDay(s)))
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekDays, schedules]
  );

  // ─── 동적 row 높이 (DayView 의 2-pass 알고리즘 차용) ────────────────────────
  // 7개 요일 일정을 모두 봐서 row 별 가장 큰 텍스트 높이로 행을 늘림.
  // 종료시각 없는 일정도 1시간 점유로 처리되어 텍스트 분량만큼 row 가 자연스럽게 확장됨.
  const { isMobile } = useBreakpoint();
  const timeColPx = isMobile ? TIME_COL_W_MOBILE_PX : TIME_COL_W_PC_PX;

  const [containerWidth, setContainerWidth] = useState(700);
  useEffect(() => {
    if (!timelineRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(timelineRef.current);
    return () => ro.disconnect();
  }, []);

  const { rowHeights, rowTops, totalHeight } = useMemo(() => {
    const heights = Array<number>(24).fill(HOUR_PX);
    const dayColPx = Math.max(1, (containerWidth - timeColPx) / 7);

    // Pass 1: 1시간짜리 (또는 1시간 점유 endAt null 일정)
    for (const items of layoutByDay) {
      for (const { schedule, totalColumns, startMin, endMin } of items) {
        const startH = Math.floor(startMin / 60);
        const endH = Math.ceil(endMin / 60);
        if (endH - startH === 1) {
          const barW = dayColPx / totalColumns;
          heights[startH] = Math.max(heights[startH], estimateTextHeight(schedule, barW));
        }
      }
    }

    // Pass 2: 다중 시간대 — 마지막 row 에 모자란 높이 추가
    for (const items of layoutByDay) {
      for (const { schedule, totalColumns, startMin, endMin } of items) {
        const startH = Math.floor(startMin / 60);
        const endH = Math.min(23, Math.ceil(endMin / 60) - 1);
        if (endH <= startH) continue;
        let available = 0;
        for (let h = startH; h <= endH; h++) available += heights[h];
        const barW = dayColPx / totalColumns;
        const textH = estimateTextHeight(schedule, barW);
        if (textH > available) heights[endH] += textH - available;
      }
    }

    const tops: number[] = [];
    let acc = 0;
    for (let h = 0; h < 24; h++) { tops.push(acc); acc += heights[h]; }
    return { rowHeights: heights, rowTops: tops, totalHeight: acc };
  }, [layoutByDay, containerWidth, timeColPx]);

  const minToPixels = (min: number): number => {
    const h = Math.min(23, Math.floor(min / 60));
    const m = min % 60;
    return rowTops[h] + (m / 60) * rowHeights[h];
  };

  // ─── 자동 스크롤 ────────────────────────────────────────────────────────────
  // rowHeights 기반 — 동적 row 확장 반영. 최초 렌더에 가장 이른 일정 1시간 전으로.
  useEffect(() => {
    if (!timelineRef.current) return;
    const single = schedules.filter(s => !isMultiDay(s));
    if (single.length > 0) {
      const minMin = Math.min(...single.map(s => getKSTMinutes(s.startAt)));
      const scrollHour = Math.max(0, Math.floor(minMin / 60) - 1);
      timelineRef.current.scrollTop = rowTops[scrollHour];
    } else {
      timelineRef.current.scrollTop = rowTops[8];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, rowTops]);

  // ─── 상수 ────────────────────────────────────────────────────────────────────
  const weekdays   = ['일', '월', '화', '수', '목', '금', '토'];
  // 시간 표시 컬럼 — "08:00" 5자 + 좌우 padding 이 들어갈 최소 폭.
  // 모바일 w-10 (40px) 빠듯하지만 가능, PC w-12 (48px) 여유. 요일 컬럼은 flex-1 라 자동 확장.
  const TIME_COL_W = 'w-10 md:w-12';

  return (
    <div className="w-full">
      {/* ── 종일/다일 이벤트 섹션 ─────────────────────────────────────────────── */}
      {(() => {
        const allDaySchedules = schedules
          .filter(isMultiDay)
          .sort((a, b) => {
            const aStart = scheduleToDay(new Date(a.startAt)).getTime();
            const bStart = scheduleToDay(new Date(b.startAt)).getTime();
            if (aStart !== bStart) return aStart - bStart;
            // isMultiDay true 일 때만 들어와서 endAt 무조건 존재.
            return new Date(a.endAt!).getTime() - new Date(b.endAt!).getTime();
          });
        if (allDaySchedules.length === 0) return null;

        const weekStart = toDay(weekDays[0]);
        const getDayIndex = (date: Date): number => {
          const day  = toDay(date);
          const diff = Math.round((day.getTime() - weekStart.getTime()) / 86_400_000);
          return Math.max(0, Math.min(6, diff));
        };

        return (
          <div className="border border-gray-200 dark:border-dark-border rounded-lg bg-gray-50 dark:bg-dark-base mb-2 overflow-hidden">
            <div className="grid grid-cols-[auto_repeat(7,1fr)] border-b border-gray-200 dark:border-dark-border">
              <div className={`${TIME_COL_W} p-2 text-xs text-gray-400 dark:text-dark-text-disabled text-right`}>종일</div>
              {weekDays.map(date => (
                <div key={date.toISOString()} className="border-l border-gray-200 dark:border-dark-border min-h-[28px]" />
              ))}
            </div>
            {allDaySchedules.map(schedule => {
              const startDay  = scheduleToDay(new Date(schedule.startAt));
              // allDaySchedules 는 isMultiDay 만 통과 → endAt 존재 보장.
              const endDay    = scheduleToDay(new Date(schedule.endAt!));
              const startIdx  = getDayIndex(new Date(Math.max(startDay.getTime(), weekStart.getTime())));
              const endIdx    = getDayIndex(new Date(Math.min(endDay.getTime(), weekDays[6].getTime())));
              const colStart  = startIdx + 2;
              const colEnd    = endIdx + 3;
              return (
                <div key={schedule.id} className="grid grid-cols-[auto_repeat(7,1fr)] border-b border-gray-100 dark:border-dark-border last:border-b-0">
                  <div className={TIME_COL_W} />
                  <div className="px-0 md:px-1 py-0 md:py-0.5" style={{ gridColumn: `${colStart} / ${colEnd}` }}>
                    <div
                      onClick={() => onScheduleClick?.(schedule)}
                      className={`text-[10px] md:text-xs leading-[1.1] md:leading-4 ${COLOR_CLASSES[schedule.color ?? 'indigo'].bgDarker} ${COLOR_CLASSES[schedule.color ?? 'indigo'].text} px-0 md:px-1 py-0 md:py-0.5 rounded-none md:rounded truncate cursor-pointer ${COLOR_CLASSES[schedule.color ?? 'indigo'].hover} transition-colors`}
                      title={schedule.title}
                    >
                      {schedule.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── 시간별 타임라인 (요일 헤더 sticky 포함) ───────────────────────────── */}
      <div
        ref={timelineRef}
        className="border border-gray-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 240px)' }}
      >
        {/* 요일 헤더 — 스크롤 컨테이너와 동일한 너비로 sticky */}
        <div className="sticky top-0 z-10 bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border flex" style={{ paddingTop: 3, paddingBottom: 3, paddingRight: 3 }}>
          <div className={`${TIME_COL_W} flex-shrink-0`} />
          {weekDays.map((date, index) => {
            const today = isToday(date);
            const sel   = isSelected(date);
            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => onDateClick?.(date)}
                className={`
                  flex-1 flex flex-col items-center py-1.5 px-1 transition-all duration-150
                  ${today ? 'ring-2 ring-orange-500 rounded-lg' : ''}
                  ${sel && !today ? 'ring-2 ring-primary-500 rounded-lg' : ''}
                  hover:bg-gray-50
                `}
              >
                <span className={`text-xs font-medium mb-1 ${index === 0 ? 'text-error-500' : index === 6 ? 'text-primary-500' : 'text-gray-600 dark:text-dark-text-muted'}`}>
                  {weekdays[index]}
                </span>
                <span className={`text-lg font-semibold ${index === 0 ? 'text-error-500' : index === 6 ? 'text-primary-500' : 'text-gray-800 dark:text-dark-text'}`}>
                  {date.getUTCDate()}
                </span>
              </button>
            );
          })}
        </div>

        {/* 24시간 그리드 + 이벤트 오버레이 — height 는 동적 rowHeights 합 */}
        <div className="relative" style={{ height: `${totalHeight}px` }}>

          {/* 그리드 레이어: 시간 레이블 + 구분선 + 오늘 배경 — row 별 동적 높이 */}
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 flex border-b border-gray-100 dark:border-dark-border pointer-events-none"
              style={{ top: `${rowTops[hour]}px`, height: `${rowHeights[hour]}px` }}
            >
              <div className={`${TIME_COL_W} flex-shrink-0 border-r border-gray-200 dark:border-dark-border px-0.5 md:px-1 pt-0.5 md:pt-1 text-[10px] md:text-xs text-gray-400 dark:text-dark-text-disabled text-center md:text-left`}>
                {String(hour).padStart(2, '0')}:00
              </div>
              {weekDays.map(date => (
                <div
                  key={date.toISOString()}
                  className={`flex-1 border-l border-gray-100 dark:border-dark-border ${isToday(date) ? 'bg-primary-50/30' : ''}`}
                />
              ))}
            </div>
          ))}

          {/* 이벤트 오버레이: 요일별 컬럼, 절대 위치 이벤트 바 — minToPixels 기반 */}
          <div className="absolute inset-0 flex overflow-visible">
            <div className={`${TIME_COL_W} flex-shrink-0`} />
            {weekDays.map((date, dayIdx) => {
              const items = layoutByDay[dayIdx];
              return (
                <div key={date.toISOString()} className="flex-1 relative overflow-visible">
                  {items.map(({ schedule, column, totalColumns, startMin, endMin }) => {
                    const top       = minToPixels(startMin) + GAP_PX;
                    const durationH = Math.max(minToPixels(Math.min(endMin, 24 * 60)) - top - GAP_PX, 22);
                    const colWPct   = 100 / totalColumns;
                    const leftPct   = column * colWPct;
                    const start = new Date(schedule.startAt);
                    // endAt null 일정은 시작시각만 표시 (아래 렌더에서 분기).
                    const end   = schedule.endAt ? new Date(schedule.endAt) : null;

                    return (
                      <div
                        key={schedule.id}
                        className="absolute px-0 md:px-0.5"
                        style={{ top: `${top}px`, height: `${durationH}px`, left: `${leftPct}%`, width: `${colWPct}%` }}
                      >
                        <div
                          onClick={() => onScheduleClick?.(schedule)}
                          onMouseEnter={e => setTooltip({ schedule, x: e.clientX, y: e.clientY })}
                          onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                          onMouseLeave={() => setTooltip(null)}
                          className={`w-full h-full overflow-hidden ${COLOR_CLASSES[schedule.color ?? 'indigo'].bg} ${COLOR_CLASSES[schedule.color ?? 'indigo'].text} px-0 md:px-1.5 py-0 md:py-0.5 rounded-none md:rounded cursor-pointer ${COLOR_CLASSES[schedule.color ?? 'indigo'].hover} transition-colors duration-150`}
                        >
                          <div className="font-medium text-[10px] md:text-xs leading-[1.1] md:leading-tight break-words">{schedule.title}</div>
                          <div className="opacity-75 text-[9px] md:text-[10px] leading-[1.1] md:leading-normal truncate">
                            {end ? `${formatTime(start)} ~ ${formatTime(end)}` : formatTime(start)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {tooltip && <ScheduleTooltip schedule={tooltip.schedule} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
}
