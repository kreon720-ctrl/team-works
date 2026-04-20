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

export async function deleteNotice(
  teamId: string,
  noticeId: string
): Promise<void> {
  await apiClient.delete<{ message: string }>(
    `/api/teams/${teamId}/notices/${noticeId}`
  );
}
