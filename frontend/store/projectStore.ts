// Project Store - manages project/schedule/sub-schedule state via API.
// Persist middleware removed; state lives in memory only.

import { create } from 'zustand';
import type {
  Project,
  ProjectSchedule,
  SubSchedule,
  ProjectCreateInput,
  ProjectScheduleCreateInput,
  SubScheduleCreateInput,
} from '@/types/project';
import {
  fetchProjects,
  createProject as createProjectApi,
  updateProject as updateProjectApi,
  deleteProject as deleteProjectApi,
  fetchProjectSchedules,
  createProjectSchedule as createProjectScheduleApi,
  updateProjectSchedule as updateProjectScheduleApi,
  deleteProjectSchedule as deleteProjectScheduleApi,
  fetchSubSchedules,
  createSubSchedule as createSubScheduleApi,
  updateSubSchedule as updateSubScheduleApi,
  deleteSubSchedule as deleteSubScheduleApi,
} from '@/lib/api/projectApi';

interface ProjectState {
  projects: Record<string, Project[]>;          // keyed by teamId
  schedules: Record<string, ProjectSchedule[]>; // keyed by projectId
  subSchedules: Record<string, SubSchedule[]>;  // keyed by scheduleId (= projectScheduleId)
  selectedProjectId: string | null;

  // Sync selectors
  getTeamProjects: (teamId: string) => Project[];
  getProjectSchedules: (projectId: string) => ProjectSchedule[];
  getSubSchedules: (scheduleId: string) => SubSchedule[];
  setSelectedProject: (projectId: string | null) => void;

  // Async load actions (fetch from API → populate cache)
  loadTeamProjects: (teamId: string) => Promise<void>;
  loadProjectSchedules: (teamId: string, projectId: string) => Promise<void>;
  loadSubSchedules: (teamId: string, projectId: string, scheduleId: string) => Promise<void>;

  // Async project actions
  createProject: (teamId: string, input: ProjectCreateInput) => Promise<Project>;
  updateProject: (teamId: string, projectId: string, input: ProjectCreateInput) => Promise<void>;
  deleteProject: (teamId: string, projectId: string) => Promise<void>;

  // Async project schedule actions
  createProjectSchedule: (teamId: string, projectId: string, input: ProjectScheduleCreateInput) => Promise<ProjectSchedule>;
  updateProjectSchedule: (teamId: string, projectId: string, scheduleId: string, input: ProjectScheduleCreateInput) => Promise<void>;
  deleteProjectSchedule: (teamId: string, projectId: string, scheduleId: string) => Promise<void>;

  // Async sub-schedule actions
  createSubSchedule: (teamId: string, projectId: string, scheduleId: string, input: SubScheduleCreateInput) => Promise<SubSchedule>;
  updateSubSchedule: (teamId: string, projectId: string, scheduleId: string, subId: string, input: SubScheduleCreateInput) => Promise<void>;
  deleteSubSchedule: (teamId: string, projectId: string, scheduleId: string, subId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: {},
  schedules: {},
  subSchedules: {},
  selectedProjectId: null,

  // ── Sync selectors ──

  getTeamProjects: (teamId: string): Project[] => {
    return get().projects[teamId] ?? [];
  },

  getProjectSchedules: (projectId: string): ProjectSchedule[] => {
    return get().schedules[projectId] ?? [];
  },

  getSubSchedules: (scheduleId: string): SubSchedule[] => {
    return get().subSchedules[scheduleId] ?? [];
  },

  setSelectedProject: (projectId: string | null) => {
    set({ selectedProjectId: projectId });
  },

  // ── Async load actions ──

  loadTeamProjects: async (teamId: string): Promise<void> => {
    const result = await fetchProjects(teamId);
    set((state) => ({
      projects: { ...state.projects, [teamId]: result },
    }));
  },

  loadProjectSchedules: async (teamId: string, projectId: string): Promise<void> => {
    const result = await fetchProjectSchedules(teamId, projectId);
    set((state) => ({
      schedules: { ...state.schedules, [projectId]: result },
    }));
  },

  loadSubSchedules: async (teamId: string, projectId: string, scheduleId: string): Promise<void> => {
    const result = await fetchSubSchedules(teamId, projectId, scheduleId);
    set((state) => ({
      subSchedules: { ...state.subSchedules, [scheduleId]: result },
    }));
  },

  // ── Async project actions ──

  createProject: async (teamId: string, input: ProjectCreateInput): Promise<Project> => {
    const newProject = await createProjectApi(teamId, input);
    set((state) => ({
      projects: {
        ...state.projects,
        [teamId]: [...(state.projects[teamId] ?? []), newProject],
      },
      selectedProjectId: newProject.id,
    }));
    return newProject;
  },

  updateProject: async (teamId: string, projectId: string, input: ProjectCreateInput): Promise<void> => {
    const updated = await updateProjectApi(teamId, projectId, input);
    set((state) => ({
      projects: {
        ...state.projects,
        [teamId]: (state.projects[teamId] ?? []).map((p) =>
          p.id === projectId ? updated : p
        ),
      },
    }));
  },

  deleteProject: async (teamId: string, projectId: string): Promise<void> => {
    await deleteProjectApi(teamId, projectId);
    set((state) => {
      const teamProjects = state.projects[teamId] ?? [];
      const filtered = teamProjects.filter((p) => p.id !== projectId);

      // Remove all schedules for this project
      const { [projectId]: _removedSchedules, ...remainingSchedules } = state.schedules;

      // If deleted project was selected, select the first remaining or null
      const newSelected =
        state.selectedProjectId === projectId
          ? (filtered[0]?.id ?? null)
          : state.selectedProjectId;

      return {
        projects: { ...state.projects, [teamId]: filtered },
        schedules: remainingSchedules,
        selectedProjectId: newSelected,
      };
    });
  },

  // ── Async project schedule actions ──

  createProjectSchedule: async (
    teamId: string,
    projectId: string,
    input: ProjectScheduleCreateInput
  ): Promise<ProjectSchedule> => {
    const newSchedule = await createProjectScheduleApi(teamId, projectId, input);
    set((state) => ({
      schedules: {
        ...state.schedules,
        [projectId]: [...(state.schedules[projectId] ?? []), newSchedule],
      },
    }));
    return newSchedule;
  },

  updateProjectSchedule: async (
    teamId: string,
    projectId: string,
    scheduleId: string,
    input: ProjectScheduleCreateInput
  ): Promise<void> => {
    const updated = await updateProjectScheduleApi(teamId, projectId, scheduleId, input);
    set((state) => ({
      schedules: {
        ...state.schedules,
        [projectId]: (state.schedules[projectId] ?? []).map((s) =>
          s.id === scheduleId ? updated : s
        ),
      },
    }));
  },

  deleteProjectSchedule: async (
    teamId: string,
    projectId: string,
    scheduleId: string
  ): Promise<void> => {
    await deleteProjectScheduleApi(teamId, projectId, scheduleId);
    set((state) => {
      const { [scheduleId]: _removedSubs, ...remainingSubs } = state.subSchedules;
      return {
        schedules: {
          ...state.schedules,
          [projectId]: (state.schedules[projectId] ?? []).filter((s) => s.id !== scheduleId),
        },
        subSchedules: remainingSubs,
      };
    });
  },

  // ── Async sub-schedule actions ──

  createSubSchedule: async (
    teamId: string,
    projectId: string,
    scheduleId: string,
    input: SubScheduleCreateInput
  ): Promise<SubSchedule> => {
    const newSub = await createSubScheduleApi(teamId, projectId, scheduleId, input);
    set((state) => ({
      subSchedules: {
        ...state.subSchedules,
        [scheduleId]: [...(state.subSchedules[scheduleId] ?? []), newSub],
      },
    }));
    return newSub;
  },

  updateSubSchedule: async (
    teamId: string,
    projectId: string,
    scheduleId: string,
    subId: string,
    input: SubScheduleCreateInput
  ): Promise<void> => {
    const updated = await updateSubScheduleApi(teamId, projectId, scheduleId, subId, input);
    set((state) => ({
      subSchedules: {
        ...state.subSchedules,
        [scheduleId]: (state.subSchedules[scheduleId] ?? []).map((s) =>
          s.id === subId ? updated : s
        ),
      },
    }));
  },

  deleteSubSchedule: async (
    teamId: string,
    projectId: string,
    scheduleId: string,
    subId: string
  ): Promise<void> => {
    await deleteSubScheduleApi(teamId, projectId, scheduleId, subId);
    set((state) => ({
      subSchedules: {
        ...state.subSchedules,
        [scheduleId]: (state.subSchedules[scheduleId] ?? []).filter((s) => s.id !== subId),
      },
    }));
  },
}));
