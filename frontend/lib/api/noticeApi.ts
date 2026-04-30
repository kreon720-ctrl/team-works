import { apiClient } from '@/lib/apiClient';
import type { Notice } from '@/store/noticeStore';

// Raw response from server (senderName can be null)
interface RawNotice extends Omit<Notice, 'senderName'> {
  senderName: string | null;
}

function normalize(raw: RawNotice): Notice {
  return { ...raw, senderName: raw.senderName ?? '' };
}

export async function fetchNotices(teamId: string): Promise<Notice[]> {
  const data = await apiClient.get<{ notices: RawNotice[] }>(
    `/api/teams/${teamId}/notices`
  );
  return data.notices.map(normalize);
}

// 프로젝트 전용 공지 — 같은 팀의 같은 프로젝트 공지만 반환.
export async function fetchProjectNotices(
  teamId: string,
  projectId: string
): Promise<Notice[]> {
  const data = await apiClient.get<{ notices: RawNotice[] }>(
    `/api/teams/${teamId}/projects/${projectId}/notices`
  );
  return data.notices.map(normalize);
}

export async function createNotice(
  teamId: string,
  content: string
): Promise<Notice> {
  const raw = await apiClient.post<RawNotice>(
    `/api/teams/${teamId}/notices`,
    { content }
  );
  return normalize(raw);
}

export async function createProjectNotice(
  teamId: string,
  projectId: string,
  content: string
): Promise<Notice> {
  const raw = await apiClient.post<RawNotice>(
    `/api/teams/${teamId}/projects/${projectId}/notices`,
    { content }
  );
  return normalize(raw);
}

export async function deleteNotice(
  teamId: string,
  noticeId: string
): Promise<void> {
  await apiClient.delete<{ message: string }>(
    `/api/teams/${teamId}/notices/${noticeId}`
  );
}
