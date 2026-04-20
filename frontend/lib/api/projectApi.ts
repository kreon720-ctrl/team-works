import { apiClient } from '@/lib/apiClient';
import type {
  Project,
  ProjectSchedule,
  SubSchedule,
  ProjectCreateInput,
  ProjectScheduleCreateInput,
  SubScheduleCreateInput,
} from '@/types/project';

// ── Raw API shapes (nullable fields from server) ──

interface RawProject extends Omit<Project, 'description' | 'phases'> {
  description: string | null;
  phases: Project['phases'];
}

interface RawProjectSchedule extends Omit<ProjectSchedule, 'description' | 'phaseId'> {
  description: string | null;
  phaseId: string | null;
}

interface RawSubSchedule extends Omit<SubSchedule, 'description'> {
  description: string | null;
}

function normalizeProject(raw: RawProject): Project {
  return {
    ...raw,
    description: raw.description ?? '',
  };
}

function normalizeProjectSchedule(raw: RawProjectSchedule): ProjectSchedule {
  return {
    ...raw,
    description: raw.description ?? '',
    phaseId: raw.phaseId ?? '',
  };
}

function normalizeSubSchedule(raw: RawSubSchedule): SubSchedule {
  return {
    ...raw,
    description: raw.description ?? '',
  };
}

// ── Projects ──

export async function fetchProjects(teamId: string): Promise<Project[]> {
  const data = await apiClient.get<{ projects: RawProject[] }>(
    `/api/teams/${teamId}/projects`
  );
  return data.projects.map(normalizeProject);
}

export async function createProject(
  teamId: string,
  input: ProjectCreateInput
): Promise<Project> {
  const raw = await apiClient.post<RawProject>(
    `/api/teams/${teamId}/projects`,
    input
  );
  return normalizeProject(raw);
}

export async function updateProject(
  teamId: string,
  projectId: string,
  input: Partial<ProjectCreateInput>
): Promise<Project> {
  const raw = await apiClient.patch<RawProject>(
    `/api/teams/${teamId}/projects/${projectId}`,
    input
  );
  return normalizeProject(raw);
}

export async function deleteProject(
  teamId: string,
  projectId: string
): Promise<void> {
  await apiClient.delete<{ message: string }>(
    `/api/teams/${teamId}/projects/${projectId}`
  );
}

// ── Project Schedules ──

export async function fetchProjectSchedules(
  teamId: string,
  projectId: string
): Promise<ProjectSchedule[]> {
  const data = await apiClient.get<{ schedules: RawProjectSchedule[] }>(
    `/api/teams/${teamId}/projects/${projectId}/schedules`
  );
  return data.schedules.map(normalizeProjectSchedule);
}

export async function createProjectSchedule(
  teamId: string,
  projectId: string,
  input: ProjectScheduleCreateInput
): Promise<ProjectSchedule> {
  const raw = await apiClient.post<RawProjectSchedule>(
    `/api/teams/${teamId}/projects/${projectId}/schedules`,
    input
  );
  return normalizeProjectSchedule(raw);
}

export async function updateProjectSchedule(
  teamId: string,
  projectId: string,
  scheduleId: string,
  input: Partial<ProjectScheduleCreateInput>
): Promise<ProjectSchedule> {
  const raw = await apiClient.patch<RawProjectSchedule>(
    `/api/teams/${teamId}/projects/${projectId}/schedules/${scheduleId}`,
    input
  );
  return normalizeProjectSchedule(raw);
}

export async function deleteProjectSchedule(
  teamId: string,
  projectId: string,
  scheduleId: string
): Promise<void> {
  await apiClient.delete<{ message: string }>(
    `/api/teams/${teamId}/projects/${projectId}/schedules/${scheduleId}`
  );
}

// ── Sub-schedules ──

export async function fetchSubSchedules(
  teamId: string,
  projectId: string,
  scheduleId: string
): Promise<SubSchedule[]> {
  const data = await apiClient.get<{ subSchedules: RawSubSchedule[] }>(
    `/api/teams/${teamId}/projects/${projectId}/schedules/${scheduleId}/sub-schedules`
  );
  return data.subSchedules.map(normalizeSubSchedule);
}

export async function createSubSchedule(
  teamId: string,
  projectId: string,
  scheduleId: string,
  input: SubScheduleCreateInput
): Promise<SubSchedule> {
  const raw = await apiClient.post<RawSubSchedule>(
    `/api/teams/${teamId}/projects/${projectId}/schedules/${scheduleId}/sub-schedules`,
    input
  );
  return normalizeSubSchedule(raw);
}

export async function updateSubSchedule(
  teamId: string,
  projectId: string,
  scheduleId: string,
  subId: string,
  input: SubScheduleCreateInput
): Promise<SubSchedule> {
  const raw = await apiClient.patch<RawSubSchedule>(
    `/api/teams/${teamId}/projects/${projectId}/schedules/${scheduleId}/sub-schedules/${subId}`,
    input
  );
  return normalizeSubSchedule(raw);
}

export async function deleteSubSchedule(
  teamId: string,
  projectId: string,
  scheduleId: string,
  subId: string
): Promise<void> {
  await apiClient.delete<{ message: string }>(
    `/api/teams/${teamId}/projects/${projectId}/schedules/${scheduleId}/sub-schedules/${subId}`
  );
}
