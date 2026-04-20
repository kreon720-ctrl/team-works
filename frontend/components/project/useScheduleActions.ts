'use client';

import { useProjectStore } from '@/store/projectStore';
import type { Project, ProjectSchedule, ProjectScheduleCreateInput } from '@/types/project';

interface UseScheduleActionsOptions {
  teamId: string;
  selectedProject: Project | null;
  onScheduleModalClose: () => void;
  onDetailModalClose: () => void;
}

export function useScheduleActions({
  teamId,
  selectedProject,
  onScheduleModalClose,
  onDetailModalClose,
}: UseScheduleActionsOptions) {
  const store = useProjectStore();

  const handleCreateSchedule = async (input: ProjectScheduleCreateInput) => {
    if (!selectedProject) return;
    await store.createProjectSchedule(teamId, selectedProject.id, input);
    onScheduleModalClose();
  };

  const handleUpdateSchedule = async (editingSchedule: ProjectSchedule, input: ProjectScheduleCreateInput) => {
    if (!selectedProject) return;
    await store.updateProjectSchedule(teamId, selectedProject.id, editingSchedule.id, input);
    onScheduleModalClose();
  };

  const handleDeleteSchedule = async (schedule: ProjectSchedule) => {
    if (!selectedProject) return;
    await store.deleteProjectSchedule(teamId, selectedProject.id, schedule.id);
    onDetailModalClose();
  };

  return {
    handleCreateSchedule,
    handleUpdateSchedule,
    handleDeleteSchedule,
  };
}
