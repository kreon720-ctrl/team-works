'use client';

import { useProjectStore } from '@/store/projectStore';
import type { Project, ProjectCreateInput } from '@/types/project';

interface UseProjectActionsOptions {
  teamId: string;
  selectedProject: Project | null;
  onModalClose: () => void;
}

export function useProjectActions({
  teamId,
  selectedProject,
  onModalClose,
}: UseProjectActionsOptions) {
  const store = useProjectStore();

  const handleCreateProject = async (input: ProjectCreateInput) => {
    await store.createProject(teamId, input);
    onModalClose();
  };

  const handleUpdateProject = async (editingProject: Project, input: ProjectCreateInput) => {
    await store.updateProject(teamId, editingProject.id, input);
    onModalClose();
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    if (!confirm(`"${selectedProject.name}" 프로젝트를 삭제하시겠습니까? 모든 일정도 함께 삭제됩니다.`)) return;
    await store.deleteProject(teamId, selectedProject.id);
  };

  return {
    handleCreateProject,
    handleUpdateProject,
    handleDeleteProject,
  };
}
