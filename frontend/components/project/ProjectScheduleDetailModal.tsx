'use client';

import React, { useMemo } from 'react';
import type { ProjectSchedule, GanttBarColor } from '@/types/project';

const GANTT_COLOR_DISPLAY: Record<GanttBarColor, { bg: string; border: string; label: string }> = {
  indigo:  { bg: '#c7d2fe', border: '#6366f1', label: '인디고' },
  blue:    { bg: '#bfdbfe', border: '#3b82f6', label: '파랑' },
  emerald: { bg: '#a7f3d0', border: '#10b981', label: '에메랄드' },
  amber:   { bg: '#fde68a', border: '#f59e0b', label: '황금' },
  rose:    { bg: '#fecdd3', border: '#f43f5e', label: '로즈' },
};

const DAY_WIDTH = 24; // px per day column

// Static right-border Tailwind classes (v4: no dynamic class names)
const BORDER_RIGHT: Record<'month' | 'week' | 'day' | 'last', string> = {
  month: 'border-r-2 border-r-gray-400',
  week:  'border-r border-r-gray-300',
  day:   'border-r border-r-gray-100',
  last:  'border-r border-r-gray-200',
};

// Inline styles for vertical grid lines in content rows
const LINE_W:  Record<'month' | 'week' | 'day' | 'last', number> = { month: 2, week: 1, day: 1, last: 1 };
const LINE_BG: Record<'month' | 'week' | 'day' | 'last', string> = {
  month: '#9ca3af',
  week:  '#d1d5db',
  day:   '#f3f4f6',
  last:  '#e5e7eb',
};

type BorderKey = 'month' | 'week' | 'day' | 'last';

interface DayInfo {
  d: Date;
  isMonthStart: boolean;
  isWeekStart: boolean;
  weekNum: number;
  borderKey: BorderKey;
}

function buildDayInfos(startDate: string, endDate: string): DayInfo[] {
  const days: Date[] = [];
  const cur = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate   + 'T00:00:00');
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  return days.map((d, i) => {
    const prev = i > 0 ? days[i - 1] : null;
    const next = i < days.length - 1 ? days[i + 1] : null;
    const weekNum = Math.ceil(d.getDate() / 7);
    const isMonthStart = !prev || d.getMonth() !== prev.getMonth();
    const isWeekStart  = isMonthStart || (!!prev && Math.ceil(prev.getDate() / 7) !== weekNum);

    let borderKey: BorderKey = 'day';
    if (!next)                                    borderKey = 'last';
    else if (next.getMonth() !== d.getMonth())    borderKey = 'month';
    else if (Math.ceil(next.getDate() / 7) !== weekNum) borderKey = 'week';

    return { d, isMonthStart, isWeekStart, weekNum, borderKey };
  });
}

interface ProjectScheduleDetailModalProps {
  isOpen: boolean;
  schedule: ProjectSchedule | null;
  currentUserId: string;
  phaseName?: string;
  onClose: () => void;
  onEdit: (schedule: ProjectSchedule) => void;
  onDelete: (schedule: ProjectSchedule) => void;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <span className="w-24 flex-none text-xs font-medium text-gray-500 pt-0.5">{label}</span>
      <span className="flex-1 text-sm text-gray-800">{value}</span>
    </div>
  );
}

export function ProjectScheduleDetailModal({
  isOpen,
  schedule,
  currentUserId,
  phaseName,
  onClose,
  onEdit,
  onDelete,
}: ProjectScheduleDetailModalProps) {
  const dayInfos = useMemo(
    () => (schedule ? buildDayInfos(schedule.startDate, schedule.endDate) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedule?.startDate, schedule?.endDate],
  );

  // 월 행: 연속된 같은 월을 하나의 셀로 병합
  const monthSpans = useMemo(() => {
    const spans: { label: string; count: number; borderKey: BorderKey }[] = [];
    for (const info of dayInfos) {
      if (info.isMonthStart) {
        spans.push({ label: `${info.d.getMonth() + 1}월`, count: 1, borderKey: info.borderKey });
      } else {
        spans[spans.length - 1].count++;
        spans[spans.length - 1].borderKey = info.borderKey;
      }
    }
    return spans;
  }, [dayInfos]);

  // 주 행: 연속된 같은 주를 하나의 셀로 병합
  const weekSpans = useMemo(() => {
    const spans: { label: string; count: number; borderKey: BorderKey }[] = [];
    for (const info of dayInfos) {
      if (info.isWeekStart) {
        spans.push({ label: `${info.weekNum}주`, count: 1, borderKey: info.borderKey });
      } else {
        spans[spans.length - 1].count++;
        spans[spans.length - 1].borderKey = info.borderKey;
      }
    }
    return spans;
  }, [dayInfos]);

  if (!isOpen || !schedule) return null;

  const isOwner    = schedule.createdBy === currentUserId;
  const colorInfo  = GANTT_COLOR_DISPLAY[schedule.color] ?? GANTT_COLOR_DISPLAY.indigo;
  const totalWidth = dayInfos.length * DAY_WIDTH;

  const handleDelete = () => {
    if (confirm('이 일정을 삭제하시겠습니까?')) onDelete(schedule);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-[90vw] max-w-5xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-x-hidden">

        {/* ── 타이틀 ── */}
        <div className="flex items-start justify-between px-6 pt-5 pb-0 flex-none">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full flex-none"
              style={{ backgroundColor: colorInfo.bg, border: `2px solid ${colorInfo.border}` }}
            />
            <h2 className="text-lg font-semibold text-gray-900 leading-snug">{schedule.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-none ml-2"
            aria-label="닫기"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── 본문: 좌측 + 우측 ── */}
        <div className="flex flex-1 min-h-0 mt-4">

          {/* ── 좌측: 상세 정보 ── */}
          <div className="w-72 flex-none flex flex-col px-6 pb-5">
            <div className="flex-1 overflow-y-auto">
              <DetailRow label="기간" value={`${schedule.startDate} ~ ${schedule.endDate}`} />
              {phaseName && <DetailRow label="단계" value={phaseName} />}
              <DetailRow
                label="진행률"
                value={
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[120px]">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${schedule.progress}%`, backgroundColor: colorInfo.border }}
                      />
                    </div>
                    <span className="text-sm text-gray-700">
                      {schedule.progress}%
                      {schedule.isDelayed && <span className="ml-1 text-red-500 text-xs">(지연)</span>}
                    </span>
                  </div>
                }
              />
              {schedule.leader && <DetailRow label="일정 담당자" value={schedule.leader} />}
              {schedule.description && (
                <DetailRow
                  label="설명"
                  value={<span className="whitespace-pre-wrap text-sm text-gray-700">{schedule.description}</span>}
                />
              )}
              <DetailRow
                label="색상"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: colorInfo.bg, border: `1.5px solid ${colorInfo.border}` }}
                    />
                    {colorInfo.label}
                  </span>
                }
              />
              <DetailRow label="등록일" value={new Date(schedule.createdAt).toLocaleDateString('ko-KR')} />
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2 pt-4 flex-none">
              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(schedule)}
                    className="flex-1 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex-1 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                  >
                    삭제
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    닫기
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  닫기
                </button>
              )}
            </div>
          </div>

          {/* 구분선 */}
          <div className="w-px bg-gray-200 flex-none my-2" />

          {/* ── 우측: 타임라인 ── */}
          <div className="flex-1 min-w-0 flex flex-col px-4 pb-5">

            {/* 가로 스크롤 — 헤더 + 콘텐츠 행을 하나의 컨테이너로 묶음 */}
            <div className="overflow-x-auto">
              <div style={{ minWidth: totalWidth }}>

                {/* 월 행 — 월별 병합 셀 */}
                <div className="flex border border-gray-300">
                  {monthSpans.map((span, i) => (
                    <div
                      key={i}
                      className={`text-center text-xs font-bold text-gray-700 bg-gray-200 border-b border-b-gray-300 py-1 overflow-hidden ${BORDER_RIGHT[span.borderKey]}`}
                      style={{ width: span.count * DAY_WIDTH, minWidth: span.count * DAY_WIDTH }}
                    >
                      {span.label}
                    </div>
                  ))}
                </div>

                {/* 주 행 — 주별 병합 셀 */}
                <div className="flex border-x border-gray-300">
                  {weekSpans.map((span, i) => (
                    <div
                      key={i}
                      className={`text-center text-xs font-medium text-gray-600 bg-gray-100 border-b border-b-gray-200 py-1 overflow-hidden ${BORDER_RIGHT[span.borderKey]}`}
                      style={{ width: span.count * DAY_WIDTH, minWidth: span.count * DAY_WIDTH }}
                    >
                      {span.label}
                    </div>
                  ))}
                </div>

                {/* 일 행 */}
                <div className="flex border-x border-gray-300">
                  {dayInfos.map((info, i) => (
                    <div
                      key={i}
                      className={`text-center text-[10px] text-gray-400 bg-white border-b border-b-gray-200 py-1 overflow-hidden ${BORDER_RIGHT[info.borderKey]}`}
                      style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                    >
                      {info.d.getDate()}
                    </div>
                  ))}
                </div>

                {/* 세부일정 행 영역 — 세로 스크롤 */}
                <div
                  className="overflow-y-auto overflow-x-hidden border-x border-b border-gray-300"
                  style={{ maxHeight: 200 }}
                >
                  {/* 기본 빈 행 (세로 격자선 포함) */}
                  <div className="relative border-b border-gray-100" style={{ height: 36 }}>
                    {dayInfos.map((info, i) => (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: (i + 1) * DAY_WIDTH - LINE_W[info.borderKey],
                          width: LINE_W[info.borderKey],
                          backgroundColor: LINE_BG[info.borderKey],
                        }}
                      />
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
