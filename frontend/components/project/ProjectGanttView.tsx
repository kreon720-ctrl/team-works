'use client';

import React from 'react';
import { PlusSquare, Edit2, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import type { Project } from '@/types/project';
import { GanttChart } from './GanttChart';
import { ProjectCreateModal } from './ProjectCreateModal';
import { ProjectScheduleModal } from './ProjectScheduleModal';
import { ProjectScheduleDetailModal } from './ProjectScheduleDetailModal';
import { useProjectActions } from './useProjectActions';
import { useScheduleActions } from './useScheduleActions';
import { useGanttModals } from './useGanttModals';

interface ProjectGanttViewProps {
  teamId: string;
  currentUserId: string;
  isLeader: boolean;
}

export function ProjectGanttView({ teamId, currentUserId }: ProjectGanttViewProps) {
  const store = useProjectStore();

  const projects = store.getTeamProjects(teamId);
  const rawSelectedId = store.selectedProjectId;

  // If the selectedProjectId is not in this team's projects, fall back to first
  const selectedProject: Project | null =
    projects.find((p) => p.id === rawSelectedId) ?? projects[0] ?? null;

  // Load projects from API on mount / teamId change
  React.useEffect(() => {
    store.loadTeamProjects(teamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  // Load schedules when selected project changes
  React.useEffect(() => {
    if (selectedProject) {
      store.loadProjectSchedules(teamId, selectedProject.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id]);

  // Sync store if fallback differs from stored ID
  React.useEffect(() => {
    if (projects.length > 0 && rawSelectedId !== selectedProject?.id) {
      store.setSelectedProject(selectedProject?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const schedules = selectedProject
    ? store.getProjectSchedules(selectedProject.id)
    : [];

  const modals = useGanttModals();

  const projectActions = useProjectActions({
    teamId,
    selectedProject,
    onModalClose: modals.closeProjectModal,
  });

  const scheduleActions = useScheduleActions({
    teamId,
    selectedProject,
    onScheduleModalClose: modals.closeScheduleModal,
    onDetailModalClose: modals.closeDetailModal,
  });

  // Find phase name for detail modal
  const selectedSchedulePhaseName = modals.selectedSchedule && selectedProject
    ? selectedProject.phases.find((p) => p.id === modals.selectedSchedule!.phaseId)?.name
    : undefined;

  // 액션 버튼 그룹 — 모바일은 아주 작게 (패딩 거의 없음 + 작은 아이콘), 데스크탑은 기존.
  const actionButtons = (
    <div className="flex items-center gap-1.5 sm:gap-1.5 flex-none">
      <button
        type="button"
        onClick={modals.openCreateProject}
        title="프로젝트 생성"
        className="p-0 sm:p-1.5 rounded-lg text-gray-600 dark:text-dark-text-muted hover:bg-gray-100 dark:hover:bg-dark-elevated hover:text-gray-900 dark:hover:text-dark-text transition-colors"
      >
        <PlusSquare className="w-3 h-3 sm:w-5 sm:h-5" />
      </button>
      {selectedProject && (
        <button
          type="button"
          onClick={() => modals.openEditProject(selectedProject)}
          title="프로젝트 수정"
          className="p-0 sm:p-1.5 rounded-lg text-gray-600 dark:text-dark-text-muted hover:bg-gray-100 dark:hover:bg-dark-elevated hover:text-gray-900 dark:hover:text-dark-text transition-colors"
        >
          <Edit2 className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
        </button>
      )}
      {selectedProject && (
        <button
          type="button"
          onClick={projectActions.handleDeleteProject}
          title="프로젝트 삭제"
          className="p-0 sm:p-1.5 rounded-lg text-gray-600 dark:text-dark-text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
        </button>
      )}
    </div>
  );

  const addScheduleButton = (
    <button
      type="button"
      disabled={!selectedProject}
      onClick={async () => {
        await store.loadTeamProjects(teamId);
        modals.openCreateSchedule();
      }}
      className="px-1 py-0 sm:px-2 sm:py-1 rounded sm:rounded-lg bg-primary-500 text-white text-[10px] sm:text-xs font-medium hover:bg-primary-600 active:bg-primary-700 dark:bg-[#FFB800] dark:text-gray-900 dark:hover:bg-[#E6A600] dark:active:bg-[#CC9200] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-none"
    >
      +일정
    </button>
  );

  // 프로젝트 메타 (이름 · 기간 · 진행률) — 데스크탑 헤더 중앙 / 모바일 2번째 줄에 사용.
  const projectMeta = selectedProject ? (
    <>
      <span className="text-sm text-gray-400 dark:text-dark-text-muted whitespace-nowrap">
        {selectedProject.name}
      </span>
      <span className="text-xs text-gray-400 dark:text-dark-text-muted whitespace-nowrap">
        {selectedProject.startDate} ~ {selectedProject.endDate}
      </span>
      <span className="text-xs text-gray-400 dark:text-dark-text-muted">
        ({selectedProject.progress}%)
      </span>
    </>
  ) : null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-base">
      {/* Header toolbar — 데스크탑(sm 이상) 은 1줄, 모바일은 2줄 (액션바 / 프로젝트 메타) 로 분리.
          사용자 요구: 모바일에서 액션바를 탭 바로 아래 2번째 줄에 위치. */}
      <div className="hidden sm:flex items-center px-4 py-2 border-b border-gray-200 dark:border-dark-border flex-none">
        {actionButtons}
        <div className="flex-1 flex items-center justify-center gap-1.5">
          {projectMeta}
        </div>
        <div className="flex-none">{addScheduleButton}</div>
      </div>

      {/* 모바일 헤더 — 1행: 액션바.
          2행: 프로젝트 탭바 (가로 스크롤). 프로젝트가 여러 건이면 가로로 나열,
          선택된 탭만 강조. 기간/진행률은 제거(공간 절약). */}
      <div className="sm:hidden flex flex-col border-b border-gray-200 dark:border-dark-border flex-none">
        <div className="flex items-center justify-between px-2 py-0.5">
          {actionButtons}
          {addScheduleButton}
        </div>
        {projects.length > 0 && (
          <div className="flex items-end overflow-x-auto whitespace-nowrap border-t border-gray-100 dark:border-dark-border">
            {projects.map((p) => {
              const isSelected = selectedProject?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => store.setSelectedProject(p.id)}
                  className={`flex-none px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                    isSelected
                      ? 'text-primary-600 border-primary-500 dark:text-dark-accent dark:border-dark-accent'
                      : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-dark-text-muted'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Gantt chart or empty state */}
      <div className="flex-1 overflow-hidden">
        {selectedProject ? (
          <GanttChart
            project={selectedProject}
            schedules={schedules}
            currentUserId={currentUserId}
            onBarClick={modals.openDetailModal}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 dark:bg-dark-base">
            <svg className="w-12 h-12 text-gray-300 dark:text-dark-text-disabled" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
            <p className="text-sm text-gray-400 dark:text-dark-text-muted">
              프로젝트를 생성하세요. 좌측 상단의{' '}
              <PlusSquare className="inline w-4 h-4 text-gray-500" /> 아이콘을 클릭하세요.
            </p>
          </div>
        )}
      </div>

      {/* Project create/edit modal */}
      {modals.showProjectModal && (
        <ProjectCreateModal
          mode={modals.editingProject ? 'edit' : 'create'}
          project={modals.editingProject}
          onSubmit={modals.editingProject
            ? (input) => projectActions.handleUpdateProject(modals.editingProject!, input)
            : projectActions.handleCreateProject
          }
          onCancel={modals.closeProjectModal}
        />
      )}

      {/* Schedule create/edit modal */}
      {modals.showScheduleModal && selectedProject && (
        <ProjectScheduleModal
          mode={modals.editingSchedule ? 'edit' : 'create'}
          project={selectedProject}
          schedule={modals.editingSchedule}
          teamId={teamId}
          onSubmit={modals.editingSchedule
            ? (input) => scheduleActions.handleUpdateSchedule(modals.editingSchedule!, input)
            : scheduleActions.handleCreateSchedule
          }
          onCancel={modals.closeScheduleModal}
        />
      )}

      {/* Schedule detail modal */}
      <ProjectScheduleDetailModal
        isOpen={modals.showDetailModal}
        schedule={modals.selectedSchedule}
        teamId={teamId}
        currentUserId={currentUserId}
        phaseName={selectedSchedulePhaseName}
        onClose={modals.closeDetailModal}
        onEdit={modals.openEditSchedule}
        onDelete={scheduleActions.handleDeleteSchedule}
      />
    </div>
  );
}
