'use client';

import React, { useState } from 'react';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { AIAssistantPanel } from '@/components/ai-assistant/AIAssistantPanel';
import { ResizableSplit } from '@/components/common/ResizableSplit';
import { ProjectGanttView } from '@/components/project/ProjectGanttView';
import { CalendarSection } from './CalendarSection';
import type { Schedule, ScheduleCreateInput, ScheduleUpdateInput, CalendarView as CalendarViewType, ScheduleColor } from '@/types/schedule';
import type { PostIt } from '@/types/postit';

type MobileTab = 'calendar' | 'project' | 'chat' | 'ai-assistant';

interface MobileLayoutProps {
  teamId: string;
  teamName: string;
  currentDate: Date;
  selectedDate: string;
  calendarView: CalendarViewType;
  schedules: Schedule[];
  isLeader: boolean;
  // 일정 상세 모달의 수정/삭제 버튼 표시용 — schedule.createdBy 와 비교해
  // 자기가 만든 일정만 수정·삭제 가능. PC 와 동일하게 부모(team page)에서 전달.
  currentUserId: string | undefined;
  // 포스트잇 — PC 와 동일하게 월간뷰에서 사용. 색상 팔레트는 view tabs 줄 아래 별도 행으로 표시.
  postits: PostIt[];
  selectedPostitColor: ScheduleColor | null;
  onPostitColorSelect: (color: ScheduleColor | null) => void;
  onPostitDelete: (id: string, date: string) => void;
  onPostitContentChange: (id: string, content: string) => void;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onViewChange: (view: 'month' | 'week' | 'day' | 'project') => void;
  onDateChange: (date: Date) => void;
  onDateClick: (date: Date) => void;
  onCreateSchedule: (defaultDate?: string) => void;
  onScheduleClick: (schedule: Schedule) => void;
  showCreateModal: boolean;
  showEditModal: boolean;
  showDetailModal: boolean;
  scheduleDefaultDate: string;
  selectedSchedule: Schedule | null;
  createScheduleIsPending: boolean;
  createScheduleError: string | null;
  updateScheduleIsPending: boolean;
  updateScheduleError: string | null;
  deleteScheduleIsPending: boolean;
  onCreateModalClose: () => void;
  onCreateSubmit: (data: ScheduleCreateInput | ScheduleUpdateInput) => void;
  onDetailClose: () => void;
  onDetailEdit: () => void;
  onDelete: () => void;
  onEditModalClose: () => void;
  onEditSubmit: (data: ScheduleCreateInput | ScheduleUpdateInput) => void;
  // 프로젝트 탭 — ProjectGanttView 가 자체적으로 store/액션을 처리하므로 teamId 만 받으면 됨.
  currentUserIdForProject: string;
}

export function MobileLayout({
  teamId,
  teamName,
  currentDate,
  selectedDate,
  calendarView,
  schedules,
  isLeader,
  currentUserId,
  postits,
  selectedPostitColor,
  onPostitColorSelect,
  onPostitDelete,
  onPostitContentChange,
  activeTab,
  onTabChange,
  onViewChange,
  onDateChange,
  onDateClick,
  onCreateSchedule,
  onScheduleClick,
  showCreateModal,
  showEditModal,
  showDetailModal,
  scheduleDefaultDate,
  selectedSchedule,
  createScheduleIsPending,
  createScheduleError,
  updateScheduleIsPending,
  updateScheduleError,
  deleteScheduleIsPending,
  onCreateModalClose,
  onCreateSubmit,
  onDetailClose,
  onDetailEdit,
  onDelete,
  onEditModalClose,
  onEditSubmit,
  currentUserIdForProject,
}: MobileLayoutProps) {
  // AI 버틀러 탭 안에서 일정 아이콘으로 토글하는 split view (상단 캘린더 1/3 + 하단 AI 2/3).
  const [showCalendarSplit, setShowCalendarSplit] = useState(false);

  // 프로젝트 → [채팅] 버튼으로 진입한 경우 어떤 프로젝트의 채팅을 띄울지.
  // null 이면 "팀채팅" 탭 진입(일자별 채팅).
  const [chatProjectId, setChatProjectId] = useState<string | null>(null);

  const handleSwitchToProjectChat = (projectId: string) => {
    setChatProjectId(projectId);
    onTabChange('chat');
  };

  // 사용자가 직접 [팀채팅] 탭 누르면 일자별 채팅으로 reset.
  const handleTabChangeWithChatReset = (tab: typeof activeTab) => {
    if (tab === 'chat') setChatProjectId(null);
    onTabChange(tab);
  };

  // 두 곳(calendar tab, split view)에서 공유하는 CalendarSection element.
  const calendarSectionElement = (
    <CalendarSection
      teamId={teamId}
      currentDate={currentDate}
      selectedDate={selectedDate}
      calendarView={calendarView}
      schedules={schedules}
      postits={postits}
      currentUserId={currentUserId}
      isLeader={isLeader}
      compact={true}
      selectedPostitColor={selectedPostitColor}
      showCreateModal={showCreateModal}
      showEditModal={showEditModal}
      showDetailModal={showDetailModal}
      scheduleDefaultDate={scheduleDefaultDate}
      selectedSchedule={selectedSchedule}
      createScheduleIsPending={createScheduleIsPending}
      createScheduleError={createScheduleError}
      updateScheduleIsPending={updateScheduleIsPending}
      updateScheduleError={updateScheduleError}
      deleteScheduleIsPending={deleteScheduleIsPending}
      onPostitColorSelect={onPostitColorSelect}
      onPostitDelete={onPostitDelete}
      onPostitContentChange={onPostitContentChange}
      onViewChange={onViewChange}
      onDateChange={onDateChange}
      onDateClick={onDateClick}
      onCreateSchedule={onCreateSchedule}
      onScheduleClick={onScheduleClick}
      onCreateModalClose={onCreateModalClose}
      onCreateSubmit={onCreateSubmit}
      onDetailClose={onDetailClose}
      onDetailEdit={onDetailEdit}
      onDelete={onDelete}
      onEditModalClose={onEditModalClose}
      onEditSubmit={onEditSubmit}
    />
  );

  return (
    <>
      {/* Tab navigation — 4분할: 캘린더 · 프로젝트 · 팀채팅 · AI 찰떡이.
          가로 공간이 좁아 텍스트는 더 작게, 패딩도 축소. */}
      <div className="flex border-b border-gray-200 bg-white dark:border-dark-border dark:bg-dark-surface">
        <button
          type="button"
          onClick={() => onTabChange('calendar')}
          className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-1.5 text-xs font-medium border-b-2 transition-colors duration-150 ${
            activeTab === 'calendar'
              ? 'text-primary-600 border-primary-500 dark:text-dark-accent dark:border-dark-accent'
              : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-dark-text-muted dark:hover:text-dark-text'
          }`}
        >
          {/* 캘린더 아이콘 */}
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 9h18" />
            <path d="M8 3v4" />
            <path d="M16 3v4" />
          </svg>
          캘린더
        </button>
        <button
          type="button"
          onClick={() => onTabChange('project')}
          className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-1.5 text-xs font-medium border-b-2 transition-colors duration-150 ${
            activeTab === 'project'
              ? 'text-primary-600 border-primary-500 dark:text-dark-accent dark:border-dark-accent'
              : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-dark-text-muted dark:hover:text-dark-text'
          }`}
        >
          {/* 프로젝트(보드) 아이콘 */}
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18" />
            <path d="M9 4v16" />
          </svg>
          프로젝트
        </button>
        <button
          type="button"
          onClick={() => handleTabChangeWithChatReset('chat')}
          className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-1.5 text-xs font-medium border-b-2 transition-colors duration-150 ${
            activeTab === 'chat'
              ? 'text-primary-600 border-primary-500 dark:text-dark-accent dark:border-dark-accent'
              : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-dark-text-muted dark:hover:text-dark-text'
          }`}
        >
          {/* 채팅 말풍선 아이콘 */}
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            <circle cx="9" cy="12" r="0.6" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
            <circle cx="15" cy="12" r="0.6" fill="currentColor" stroke="none" />
          </svg>
          팀채팅
        </button>
        <button
          type="button"
          onClick={() => onTabChange('ai-assistant')}
          className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-1.5 text-xs font-medium border-b-2 transition-colors duration-150 ${
            activeTab === 'ai-assistant'
              ? 'text-primary-600 border-primary-500 dark:text-dark-accent dark:border-dark-accent'
              : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300 dark:text-dark-text-muted dark:hover:text-dark-text'
          }`}
        >
          {/* AI sparkle 아이콘 */}
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3 13.7 8.3 19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" />
            <path d="M18 14 18.7 16 21 16.7 18.7 17.3 18 19.3 17.3 17.3 15.3 16.7 17.3 16z" />
            <path d="M5 4 5.5 5.5 7 6 5.5 6.5 5 8 4.5 6.5 3 6 4.5 5.5z" />
          </svg>
          AI 찰떡이
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {/* Calendar tab */}
        <div className={`h-full ${activeTab === 'calendar' ? 'block' : 'hidden'}`}>
          <div className="h-full overflow-y-auto bg-white">
            {calendarSectionElement}
          </div>
        </div>

        {/* Project tab — PC 와 동일한 ProjectGanttView 재사용. 헤더는 ProjectGanttView 가
            모바일 폭일 때 자체적으로 2줄 (액션바 + 프로젝트 칩) 로 분리. */}
        <div className={`h-[calc(100vh-6rem)] ${activeTab === 'project' ? 'block' : 'hidden'}`}>
          <ProjectGanttView
            teamId={teamId}
            currentUserId={currentUserIdForProject}
            isLeader={isLeader}
            onSwitchToChat={handleSwitchToProjectChat}
          />
        </div>

        {/* Chat tab — chatProjectId 있으면 프로젝트 채팅, 없으면 일자별 팀채팅 */}
        <div
          className={`h-[calc(100vh-6rem)] ${activeTab === 'chat' ? 'flex' : 'hidden'} flex-col`}
        >
          {chatProjectId ? (
            <ChatPanel
              key={`project-${chatProjectId}`}
              teamId={teamId}
              projectId={chatProjectId}
              isLeader={isLeader}
            />
          ) : (
            <ChatPanel
              key={`team-${selectedDate}`}
              teamId={teamId}
              date={selectedDate}
              isLeader={isLeader}
            />
          )}
        </div>

        {/* AI 버틀러 tab — 일정 아이콘 토글 시 상단 캘린더(1/3) + 하단 AI(2/3) split */}
        <div
          className={`h-[calc(100vh-6rem)] ${activeTab === 'ai-assistant' ? 'flex' : 'hidden'} flex-col`}
        >
          {showCalendarSplit ? (
            <ResizableSplit
              orientation="vertical"
              initialLeftPercent={33}
              minLeftPercent={15}
              maxLeftPercent={75}
              left={
                <div className="h-full overflow-y-auto bg-white dark:bg-dark-surface">
                  {calendarSectionElement}
                </div>
              }
              right={
                <AIAssistantPanel
                  teamId={teamId}
                  teamName={teamName}
                  onToggleCalendar={() => setShowCalendarSplit(false)}
                  calendarSplitActive
                  enableVoiceInput
                />
              }
            />
          ) : (
            <AIAssistantPanel
              teamId={teamId}
              teamName={teamName}
              onToggleCalendar={() => setShowCalendarSplit(true)}
              enableVoiceInput
            />
          )}
        </div>
      </div>
    </>
  );
}
