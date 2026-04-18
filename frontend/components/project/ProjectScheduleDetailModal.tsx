'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { ProjectSchedule, SubSchedule, GanttBarColor } from '@/types/project';
import { useProjectStore } from '@/store/projectStore';
import { useAuthStore } from '@/store/authStore';
import { SubScheduleCreateModal } from './SubScheduleCreateModal';
import { SubScheduleDetailPopup } from './SubScheduleDetailPopup';

// ── 색상 정의 ──────────────────────────────────────────────────
const GANTT_COLOR_DISPLAY: Record<GanttBarColor, { bg: string; border: string; label: string }> = {
  indigo:  { bg: '#c7d2fe', border: '#6366f1', label: '인디고' },
  blue:    { bg: '#bfdbfe', border: '#3b82f6', label: '파랑' },
  emerald: { bg: '#a7f3d0', border: '#10b981', label: '에메랄드' },
  amber:   { bg: '#fde68a', border: '#f59e0b', label: '황금' },
  rose:    { bg: '#fecdd3', border: '#f43f5e', label: '로즈' },
};

const BAR_COLORS: Record<GanttBarColor, { outer: string; progress: string; text: string }> = {
  indigo:  { outer: '#e0e7ff', progress: '#818cf8', text: '#312e81' },
  blue:    { outer: '#dbeafe', progress: '#60a5fa', text: '#1e3a8a' },
  emerald: { outer: '#d1fae5', progress: '#34d399', text: '#064e3b' },
  amber:   { outer: '#fef3c7', progress: '#fbbf24', text: '#78350f' },
  rose:    { outer: '#ffe4e6', progress: '#fb7185', text: '#881337' },
};

// ── 타임라인 상수 ──────────────────────────────────────────────
const MIN_DAY_W = 24;   // 최소 일(day) 열 너비 px
const PROGRESS_H = 20;  // 진행률 바 기준 두께 px
const BAR_MIN_H = Math.round(PROGRESS_H * 1.3);  // 일정바 최소 두께 (진행률바의 130%)
const ROW_PAD = 5;      // 행 상하 여백 px

// ── Static border classes (Tailwind v4) ───────────────────────
const BORDER_RIGHT: Record<'month' | 'week' | 'day' | 'last', string> = {
  month: 'border-r-2 border-r-gray-400',
  week:  'border-r border-r-gray-300',
  day:   'border-r border-r-gray-100',
  last:  'border-r border-r-gray-200',
};
const LINE_W:  Record<'month' | 'week' | 'day' | 'last', number> = { month: 2, week: 1, day: 1, last: 1 };
const LINE_BG: Record<'month' | 'week' | 'day' | 'last', string> = {
  month: '#9ca3af', week: '#d1d5db', day: '#f3f4f6', last: '#e5e7eb',
};

type BorderKey = 'month' | 'week' | 'day' | 'last';

// ── 날짜 유틸 ────────────────────────────────────────────────
function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86_400_000
  );
}
function fmtDate(d: string) { return d.slice(5).replace('-', '/'); }

// ── DayInfo ──────────────────────────────────────────────────
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
  while (cur <= end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }

  return days.map((d, i) => {
    const prev = i > 0 ? days[i - 1] : null;
    const next = i < days.length - 1 ? days[i + 1] : null;
    const weekNum = Math.ceil(d.getDate() / 7);
    const isMonthStart = !prev || d.getMonth() !== prev.getMonth();
    const isWeekStart  = isMonthStart || (!!prev && Math.ceil(prev.getDate() / 7) !== weekNum);
    let borderKey: BorderKey = 'day';
    if (!next)                                         borderKey = 'last';
    else if (next.getMonth() !== d.getMonth())         borderKey = 'month';
    else if (Math.ceil(next.getDate() / 7) !== weekNum) borderKey = 'week';
    return { d, isMonthStart, isWeekStart, weekNum, borderKey };
  });
}

// ── Props ─────────────────────────────────────────────────────
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

// ── Sub-schedule Gantt bar ────────────────────────────────────
function SubBar({
  sub,
  scheduleStart,
  effectiveDayW,
  totalDays,
  onClick,
}: {
  sub: SubSchedule;
  scheduleStart: string;
  effectiveDayW: number;
  totalDays: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const c = BAR_COLORS[sub.color] ?? BAR_COLORS.indigo;
  const startIdx = Math.max(0, daysBetween(scheduleStart, sub.startDate));
  const endIdx   = Math.min(totalDays - 1, daysBetween(scheduleStart, sub.endDate));
  const barLeft  = startIdx * effectiveDayW;
  const barWidth = Math.max(effectiveDayW, (endIdx - startIdx + 1) * effectiveDayW);
  const label    = `${sub.title} (${fmtDate(sub.startDate)}~${fmtDate(sub.endDate)})`;

  return (
    <div
      style={{
        marginLeft: barLeft,
        width: barWidth,
        cursor: 'pointer',
        position: 'relative',
        zIndex: 1,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 외부 바 (흐린 색) */}
      <div
        style={{
          position: 'relative',
          minHeight: BAR_MIN_H,
          backgroundColor: c.outer,
          borderRadius: 4,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: sub.isDelayed ? '2px solid #ef4444' : 'none',
        }}
      >
        {/* 진행률 바 (진한 색, 좌측부터 progress% 만큼) */}
        <div
          style={{
            position: 'absolute',
            top: (BAR_MIN_H - PROGRESS_H) / 2,
            left: 0,
            height: PROGRESS_H,
            width: `${sub.progress}%`,
            backgroundColor: c.progress,
            borderRadius: 4,
          }}
        />
        {/* 텍스트 레이블 */}
        <div
          style={{
            position: 'relative',
            padding: '2px 6px',
            fontSize: 11,
            lineHeight: 1.3,
            color: hovered && sub.isDelayed ? '#ef4444' : c.text,
            textAlign: 'center',
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
            textShadow: '0 0 4px rgba(255,255,255,0.8)',
            fontWeight: 500,
          }}
        >
          {hovered ? (sub.isDelayed ? `${sub.progress}% (일정지연)` : `${sub.progress}%`) : label}
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────
export function ProjectScheduleDetailModal({
  isOpen,
  schedule,
  currentUserId,
  phaseName,
  onClose,
  onEdit,
  onDelete,
}: ProjectScheduleDetailModalProps) {
  const currentUserName = useAuthStore(s => s.currentUser?.name ?? '');
  const { getSubSchedules, createSubSchedule, updateSubSchedule, deleteSubSchedule } =
    useProjectStore();

  // ── 타임라인 계산 ──
  const dayInfos = useMemo(
    () => (schedule ? buildDayInfos(schedule.startDate, schedule.endDate) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedule?.startDate, schedule?.endDate],
  );

  const monthSpans = useMemo(() => {
    const spans: { label: string; count: number; borderKey: BorderKey }[] = [];
    for (const info of dayInfos) {
      if (info.isMonthStart) spans.push({ label: `${info.d.getMonth() + 1}월`, count: 1, borderKey: info.borderKey });
      else { spans[spans.length - 1].count++; spans[spans.length - 1].borderKey = info.borderKey; }
    }
    return spans;
  }, [dayInfos]);

  const weekSpans = useMemo(() => {
    const spans: { label: string; count: number; borderKey: BorderKey }[] = [];
    for (const info of dayInfos) {
      if (info.isWeekStart) spans.push({ label: `${info.weekNum}주`, count: 1, borderKey: info.borderKey });
      else { spans[spans.length - 1].count++; spans[spans.length - 1].borderKey = info.borderKey; }
    }
    return spans;
  }, [dayInfos]);

  // ── 반응형 일 열 너비 ──
  const rightRef = useRef<HTMLDivElement>(null);
  const [effectiveDayW, setEffectiveDayW] = useState(MIN_DAY_W);
  useEffect(() => {
    const el = rightRef.current;
    if (!el || dayInfos.length === 0) return;
    const update = () => {
      const w = el.clientWidth - 32; // px padding
      setEffectiveDayW(Math.max(MIN_DAY_W, Math.floor(w / dayInfos.length)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dayInfos.length]);

  const totalWidth = dayInfos.length * effectiveDayW;

  // ── 세부일정 상태 ──
  const subSchedules = schedule ? getSubSchedules(schedule.id) : [];
  const [showCreate, setShowCreate] = useState(false);
  const [editingSub, setEditingSub] = useState<SubSchedule | null>(null);
  const [viewingSub, setViewingSub] = useState<SubSchedule | null>(null);

  if (!isOpen || !schedule) return null;

  const isOwner   = schedule.createdBy === currentUserId;
  const colorInfo = GANTT_COLOR_DISPLAY[schedule.color] ?? GANTT_COLOR_DISPLAY.indigo;

  const handleDeleteSchedule = () => {
    if (confirm('이 일정을 삭제하시겠습니까?')) onDelete(schedule);
  };

  const handleCreateSub = (input: Parameters<typeof createSubSchedule>[3]) => {
    createSubSchedule(schedule.id, schedule.projectId, schedule.teamId, input, currentUserId);
    setShowCreate(false);
  };

  const handleUpdateSub = (input: Parameters<typeof updateSubSchedule>[2]) => {
    if (!editingSub) return;
    updateSubSchedule(editingSub.id, schedule.id, input);
    setEditingSub(null);
    setShowCreate(false);
  };

  const handleDeleteSub = (sub: SubSchedule) => {
    deleteSubSchedule(sub.id, schedule.id);
    setViewingSub(null);
  };

  const handleToggleDelay = (sub: SubSchedule, isDelayed: boolean) => {
    updateSubSchedule(sub.id, schedule.id, {
      title: sub.title, color: sub.color, startDate: sub.startDate,
      endDate: sub.endDate, description: sub.description,
      leader: sub.leader, progress: sub.progress, isDelayed,
    });
    setViewingSub({ ...sub, isDelayed });
  };

  // 그리드 라인 렌더
  const GridLines = () => (
    <>
      {dayInfos.map((info, i) => (
        <div key={i} style={{
          position: 'absolute', top: 0, bottom: 0,
          left: (i + 1) * effectiveDayW - LINE_W[info.borderKey],
          width: LINE_W[info.borderKey],
          backgroundColor: LINE_BG[info.borderKey],
        }} />
      ))}
    </>
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-[90vw] max-w-5xl bg-white rounded-2xl shadow-xl flex flex-col h-[63vh] overflow-x-hidden">

          {/* ── 타이틀 ── */}
          <div className="flex items-start justify-between px-6 pt-5 pb-0 flex-none">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex-none"
                style={{ backgroundColor: colorInfo.bg, border: `2px solid ${colorInfo.border}` }} />
              <h2 className="text-lg font-semibold text-gray-900 leading-snug">{schedule.title}</h2>
            </div>
            <button type="button" onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-none ml-2" aria-label="닫기">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── 본문 ── */}
          <div className="flex flex-1 min-h-0 mt-4">

            {/* 좌측: 상세 정보 */}
            <div className="w-72 flex-none flex flex-col px-6 pb-5">
              <div className="flex-1 overflow-y-auto">
                <DetailRow label="기간" value={`${schedule.startDate} ~ ${schedule.endDate}`} />
                {phaseName && <DetailRow label="단계" value={phaseName} />}
                <DetailRow
                  label="진행률"
                  value={
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[120px]">
                        <div className="h-2 rounded-full"
                          style={{ width: `${schedule.progress}%`, backgroundColor: colorInfo.border }} />
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
                  <DetailRow label="설명"
                    value={<span className="whitespace-pre-wrap text-sm text-gray-700">{schedule.description}</span>} />
                )}
                <DetailRow
                  label="색상"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: colorInfo.bg, border: `1.5px solid ${colorInfo.border}` }} />
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
                    <button type="button" onClick={() => onEdit(schedule)}
                      className="flex-1 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors">
                      수정
                    </button>
                    <button type="button" onClick={handleDeleteSchedule}
                      className="flex-1 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors">
                      삭제
                    </button>
                    <button type="button" onClick={onClose}
                      className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
                      닫기
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={onClose}
                    className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
                    닫기
                  </button>
                )}
              </div>
            </div>

            {/* 구분선 */}
            <div className="w-px bg-gray-200 flex-none my-2" />

            {/* 우측: 타임라인 */}
            <div ref={rightRef} className="flex-1 min-w-0 flex flex-col px-4 pb-5">

              {/* [+일정] 버튼 */}
              <div className="flex justify-end mb-2 flex-none">
                <button type="button" onClick={() => { setEditingSub(null); setShowCreate(true); }}
                  className="flex items-center gap-1 px-3 py-1 bg-primary-500 text-white text-xs font-medium rounded-lg hover:bg-primary-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  일정
                </button>
              </div>

              {/* 타임라인 */}
              <div className="overflow-x-auto flex-1 flex flex-col">
                <div className="flex flex-col flex-1" style={{ minWidth: totalWidth }}>

                  {/* 월 행 */}
                  <div className="flex border border-gray-300 flex-none">
                    {monthSpans.map((span, i) => (
                      <div key={i}
                        className={`text-center text-xs font-bold text-gray-700 bg-gray-200 border-b border-b-gray-300 py-1 overflow-hidden ${BORDER_RIGHT[span.borderKey]}`}
                        style={{ width: span.count * effectiveDayW, minWidth: span.count * effectiveDayW }}>
                        {span.label}
                      </div>
                    ))}
                  </div>

                  {/* 주 행 */}
                  <div className="flex border-x border-gray-300 flex-none">
                    {weekSpans.map((span, i) => (
                      <div key={i}
                        className={`text-center text-xs font-medium text-gray-600 bg-gray-100 border-b border-b-gray-200 py-1 overflow-hidden ${BORDER_RIGHT[span.borderKey]}`}
                        style={{ width: span.count * effectiveDayW, minWidth: span.count * effectiveDayW }}>
                        {span.label}
                      </div>
                    ))}
                  </div>

                  {/* 일 행 */}
                  <div className="flex border-x border-gray-300 flex-none">
                    {dayInfos.map((info, i) => (
                      <div key={i}
                        className={`text-center text-[10px] text-gray-400 bg-white border-b border-b-gray-200 py-1 overflow-hidden ${BORDER_RIGHT[info.borderKey]}`}
                        style={{ width: effectiveDayW, minWidth: effectiveDayW }}>
                        {info.d.getDate()}
                      </div>
                    ))}
                  </div>

                  {/* 세부일정 행 영역 */}
                  <div className="overflow-y-auto overflow-x-hidden border-x border-b border-gray-300 flex-1">
                    {subSchedules.length === 0 ? (
                      /* 빈 행 */
                      <div className="relative border-b border-gray-100" style={{ minHeight: 36 + ROW_PAD * 2 }}>
                        <GridLines />
                      </div>
                    ) : (
                      subSchedules.map((sub) => (
                        <div key={sub.id} className="relative border-b border-gray-100"
                          style={{ minHeight: BAR_MIN_H + ROW_PAD * 2, paddingTop: ROW_PAD, paddingBottom: ROW_PAD }}>
                          <GridLines />
                          <SubBar
                            sub={sub}
                            scheduleStart={schedule.startDate}
                            effectiveDayW={effectiveDayW}
                            totalDays={dayInfos.length}
                            onClick={() => setViewingSub(sub)}
                          />
                        </div>
                      ))
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 세부일정 생성/수정 모달 */}
      {showCreate && (
        <SubScheduleCreateModal
          mode={editingSub ? 'edit' : 'create'}
          parentSchedule={schedule}
          subSchedule={editingSub}
          currentUserName={currentUserName}
          onSubmit={editingSub ? handleUpdateSub : handleCreateSub}
          onCancel={() => { setShowCreate(false); setEditingSub(null); }}
        />
      )}

      {/* 세부일정 상세 팝업 */}
      {viewingSub && (
        <SubScheduleDetailPopup
          sub={viewingSub}
          isOwner={viewingSub.createdBy === currentUserId}
          onEdit={() => { setEditingSub(viewingSub); setViewingSub(null); setShowCreate(true); }}
          onDelete={() => handleDeleteSub(viewingSub)}
          onClose={() => setViewingSub(null)}
        />
      )}
    </>
  );
}
