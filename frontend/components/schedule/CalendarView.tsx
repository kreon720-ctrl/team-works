'use client';

import React from 'react';
import { Schedule } from '@/types/schedule';
import { CalendarView as CalendarViewType } from '@/types/schedule';
import type { PostIt } from '@/types/postit';
import type { ScheduleColor } from '@/types/schedule';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarDayView } from './CalendarDayView';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { PostItColorPalette } from './PostItColorPalette';
import { ProjectGanttView } from '@/components/project/ProjectGanttView';
import { useProjectStore } from '@/store/projectStore';

interface CalendarViewProps {
  currentDate: Date;
  selectedDate?: Date;
  view: CalendarViewType;
  schedules?: Schedule[];
  canCreateSchedule?: boolean;
  compact?: boolean;
  // 포스트잇 관련 (PC 월간뷰 전용)
  postits?: PostIt[];
  currentUserId?: string;
  selectedPostitColor?: ScheduleColor | null;
  onPostitColorSelect?: (color: ScheduleColor | null) => void;
  onPostitDelete?: (id: string, date: string) => void;
  onPostitContentChange?: (id: string, content: string) => void;
  onViewChange?: (view: CalendarViewType) => void;
  onDateChange?: (date: Date) => void;
  onDateClick?: (date: Date) => void;
  onCreateSchedule?: (defaultDate?: string) => void;
  onScheduleClick?: (schedule: Schedule) => void;
  // Project view props (PC only)
  teamId?: string;
  isLeader?: boolean;
}

export function CalendarView({
  currentDate,
  selectedDate,
  view = 'month',
  schedules = [],
  canCreateSchedule = false,
  compact = false,
  postits = [],
  currentUserId,
  selectedPostitColor,
  onPostitColorSelect,
  onPostitDelete,
  onPostitContentChange,
  onViewChange,
  onDateChange,
  onDateClick,
  onCreateSchedule,
  onScheduleClick,
  teamId,
  isLeader = false,
}: CalendarViewProps) {
  // 마지막 네비게이션 방향 — slide 애니메이션 방향 결정에 사용.
  // next: 새 콘텐츠가 오른쪽에서 슬라이드 인. prev: 왼쪽에서 슬라이드 인.
  const [slideDirection, setSlideDirection] = React.useState<'next' | 'prev'>('next');
  // 네비게이션 시퀀스 — navigateDate (좌우 swipe / < > 버튼) 호출 시에만 증가.
  // 단순 날짜 클릭(onDateClick) 이나 외부 currentDate 변경으로는 증가 X → 애니메이션 트리거 X.
  const [navAnimSeq, setNavAnimSeq] = React.useState(0);

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setUTCDate(1);

    if (view === 'month') {
      newDate.setUTCMonth(newDate.getUTCMonth() + (direction === 'next' ? 1 : -1));
    } else if (view === 'week') {
      newDate.setUTCDate(currentDate.getUTCDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setUTCDate(currentDate.getUTCDate() + (direction === 'next' ? 1 : -1));
    }

    setSlideDirection(direction);
    setNavAnimSeq(n => n + 1);
    onDateChange?.(newDate);
  };

  // 모바일 swipe — 오른쪽 swipe = 이전(prev), 왼쪽 swipe = 다음(next).
  // month → 이전/다음 달, week → 이전/다음 주, day → 이전/다음 날 (navigateDate 가 view 에 따라 자동 처리).
  // 가로 이동 ≥50px 만 인식 → 수직 스크롤 방해 X. 터치만 동작이라 PC 마우스는 영향 없음.
  const swipeHandlers = useSwipeGesture({
    onSwipeRight: () => navigateDate('prev'),
    onSwipeLeft: () => navigateDate('next'),
  });

  // 콘텐츠 wrapper 의 key — view 또는 navAnimSeq 변경 시 remount 되어 keyframe 애니메이션 트리거.
  // currentDate 는 키에서 제외 — onDateClick 같은 부수적 날짜 변경은 애니메이션을 일으키지 않음.
  const contentAnimKey = `${view}-${navAnimSeq}`;
  const slideClassName = slideDirection === 'next' ? 'calendar-slide-next' : 'calendar-slide-prev';

  const formatDateRange = (): string => {
    const year = currentDate.getUTCFullYear();

    if (view === 'month') {
      const month = currentDate.getUTCMonth() + 1;
      return `${year}년 ${month}월`;
    } else if (view === 'week') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setUTCDate(currentDate.getUTCDate() - currentDate.getUTCDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);

      const startMonth = startOfWeek.getUTCMonth() + 1;
      const endMonth = endOfWeek.getUTCMonth() + 1;

      if (startMonth === endMonth) {
        return `${year}년 ${startMonth}월 ${startOfWeek.getUTCDate()}일 ~ ${endOfWeek.getUTCDate()}일`;
      }
      return `${year}년 ${startMonth}월 ~ ${endMonth}월`;
    } else {
      const month = currentDate.getUTCMonth() + 1;
      const day = currentDate.getUTCDate();
      return `${year}년 ${month}월 ${day}일`;
    }
  };

  // 프로젝트 목록 (PC only) — 선택자에서 직접 배열 참조를 반환해야 무한 루프 방지
  const rawTeamProjects = useProjectStore((s) => s.projects[teamId ?? '']);
  const teamProjects = rawTeamProjects ?? [];
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const setSelectedProject = useProjectStore((s) => s.setSelectedProject);
  const loadTeamProjects = useProjectStore((s) => s.loadTeamProjects);

  // 팀 진입 시점에 프로젝트 목록 prefetch — ProjectGanttView 가 마운트되기 전(초기 월/주/일 뷰)에도
  // 상단 탭에 프로젝트명을 즉시 노출하기 위함. compact 모드(모바일)는 프로젝트 탭 미표시라 스킵.
  React.useEffect(() => {
    if (!teamId || compact) return;
    loadTeamProjects(teamId);
  }, [teamId, compact, loadTeamProjects]);

  // 뷰 탭: 프로젝트가 있으면 프로젝트명 탭들(PC only) + 월/주/일
  const viewTabs: { id: CalendarViewType; label: string }[] = [
    { id: 'month', label: '월' },
    { id: 'week', label: '주' },
    { id: 'day', label: '일' },
  ];

  // 팔레트는 월간뷰 + compact 아님 + 콜백 있을 때만 표시
  const showPalette = view === 'month' && !compact && !!onPostitColorSelect;

  // In project view, hide navigation and schedule create button
  const isProjectView = view === 'project';

  // 프로젝트 탭 클릭: store의 selectedProjectId 갱신 + project view로 전환
  const handleProjectTabClick = (projectId: string) => {
    setSelectedProject(projectId);
    onViewChange?.('project');
  };

  return (
    <div className="w-full bg-white dark:bg-dark-surface flex flex-col flex-1 min-h-0">
      {/* Navigation header — 모바일은 mb-1, PC 는 mb-4 (모바일 팔레트 위 회색 여백 축소) */}
      <div className="flex items-center justify-between mb-1 md:mb-4 px-2">
        {/* Navigation buttons (hidden in project view) */}
        <div className="flex items-center gap-2">
          {!isProjectView && (
            <>
              <button
                type="button"
                onClick={() => navigateDate('prev')}
                className="p-2 rounded-lg text-gray-700 dark:text-dark-text-muted hover:bg-gray-100 dark:hover:bg-dark-elevated hover:text-gray-900 dark:hover:text-dark-text transition-colors duration-150"
                aria-label="이전"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <h2
                className={`font-semibold text-gray-900 dark:text-dark-text text-center ${
                  compact ? 'text-xs min-w-[100px]' : 'text-lg min-w-[150px]'
                }`}
              >
                {formatDateRange()}
              </h2>

              <button
                type="button"
                onClick={() => navigateDate('next')}
                className="p-2 rounded-lg text-gray-700 dark:text-dark-text-muted hover:bg-gray-100 dark:hover:bg-dark-elevated hover:text-gray-900 dark:hover:text-dark-text transition-colors duration-150"
                aria-label="다음"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* PC only — 일정/프로젝트 뷰 토글 버튼.
              일정 뷰: [프로젝트 관리] 클릭 → 프로젝트 뷰
              프로젝트 뷰: [일정 관리] 클릭 → 월간 뷰로 복귀 */}
          {!compact && (
            <button
              type="button"
              onClick={() => onViewChange?.(isProjectView ? 'month' : 'project')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text-muted text-sm font-medium hover:bg-gray-50 dark:hover:bg-dark-surface active:bg-gray-100 dark:active:bg-dark-elevated transition-colors duration-150"
            >
              {isProjectView ? (
                <>
                  {/* 캘린더 아이콘 */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M8 3v4" />
                    <path d="M16 3v4" />
                  </svg>
                  일정 관리
                </>
              ) : (
                <>
                  {/* 프로젝트(보드) 아이콘 */}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                    />
                  </svg>
                  프로젝트 관리
                </>
              )}
            </button>
          )}
        </div>

        <div className={`flex items-center ${compact ? 'gap-2' : 'gap-4'}`}>
          {/* 일정 등록 버튼 (project view에서는 숨김) */}
          {!isProjectView && canCreateSchedule && onCreateSchedule && (
            <div className="relative group">
              <button
                type="button"
                onClick={() => onCreateSchedule()}
                className={`flex items-center justify-center rounded-md bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 dark:bg-[#FFB800] dark:text-gray-900 dark:hover:bg-[#E6A600] dark:active:bg-[#CC9200] font-medium transition-colors duration-150 ${
                  compact ? 'p-0.5' : 'gap-1 px-3 py-1.5 text-sm rounded-lg'
                }`}
                aria-label="일정 등록"
              >
                <svg className={compact ? 'w-3 h-3' : 'w-4 h-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {!compact && '일정 등록'}
              </button>
              {!compact && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                  새로운 일정을 추가합니다.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                </div>
              )}
            </div>
          )}

          {/* View tabs — 일정뷰에선 월·주·일 만, 프로젝트뷰(PC) 에선 프로젝트 탭만 */}
          <div className="flex border-b border-gray-200 dark:border-dark-border">
            {/* 프로젝트 탭 (PC only, 프로젝트 뷰일 때만) — 긴 이름은 한 줄 + 말줄임 */}
            {!compact && isProjectView && teamProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => handleProjectTabClick(project.id)}
                title={project.name}
                className={`
                  py-2 px-4 text-sm font-medium border-b-2 transition-colors duration-150
                  whitespace-nowrap truncate max-w-[220px]
                  ${selectedProjectId === project.id
                    ? 'text-primary-600 border-primary-500 dark:text-dark-accent dark:border-dark-accent'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-dark-text-muted dark:hover:text-dark-text'
                  }
                `}
              >
                {project.name}
              </button>
            ))}
            {/* 월/주/일 탭 — 일정뷰일 때만. 모바일은 자체 탭바 별도라 PC 만 분기 적용 */}
            {(!isProjectView || compact) && viewTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onViewChange?.(tab.id)}
                className={`
                  py-2 font-medium border-b-2 transition-colors duration-150
                  ${compact ? 'px-2.5 text-xs' : 'px-4 text-sm'}
                  ${view === tab.id
                    ? 'text-primary-600 border-primary-500 dark:text-dark-accent dark:border-dark-accent'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-dark-text-muted dark:hover:text-dark-text'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 포스트잇 색상 팔레트 (PC 월간뷰, 오른쪽 끝) */}
          {showPalette && (
            <PostItColorPalette
              selectedColor={selectedPostitColor ?? null}
              onSelect={onPostitColorSelect}
            />
          )}
        </div>
      </div>

      {/* 모바일 월간뷰 포스트잇 색상 팔레트 — view tabs 줄 아래 별도 row, 우측 정렬.
         상하 마진 최소화로 회색 띠를 얇게. */}
      {compact && view === 'month' && !!onPostitColorSelect && (
        <div className="flex justify-end mb-0.5 px-2">
          <PostItColorPalette
            selectedColor={selectedPostitColor ?? null}
            onSelect={onPostitColorSelect}
          />
        </div>
      )}

      {/* Calendar / Project content */}
      {isProjectView ? (
        <div className="flex-1 min-h-0 overflow-hidden px-2">
          <ProjectGanttView
            teamId={teamId ?? ''}
            currentUserId={currentUserId ?? ''}
            isLeader={isLeader}
          />
        </div>
      ) : (
        <div
          className={`px-2 ${view === 'month' ? 'overflow-y-auto flex-1 min-h-0' : 'flex-1 min-h-0'} overflow-x-hidden`}
          {...swipeHandlers}
        >
          <div key={contentAnimKey} className={slideClassName}>
          {view === 'month' && (
            <CalendarMonthView
              currentDate={currentDate}
              schedules={schedules}
              selectedDate={selectedDate}
              onDateClick={onDateClick}
              onScheduleClick={onScheduleClick}
              postits={postits}
              currentUserId={currentUserId}
              onPostitDelete={onPostitDelete}
              onPostitContentChange={onPostitContentChange}
              compact={compact}
            />
          )}
          {view === 'week' && (
            <CalendarWeekView
              currentDate={currentDate}
              schedules={schedules}
              selectedDate={selectedDate}
              onDateClick={onDateClick}
              onScheduleClick={onScheduleClick}
            />
          )}
          {view === 'day' && (
            <CalendarDayView
              currentDate={currentDate}
              schedules={schedules}
              selectedDate={selectedDate}
              onDateClick={onDateClick}
              onScheduleClick={onScheduleClick}
            />
          )}
          </div>
        </div>
      )}
    </div>
  );
}
