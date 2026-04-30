import { apiClient } from '@/lib/apiClient';
import { tokenManager } from '@/lib/tokenManager';
import type {
  BoardListResponse,
  BoardPost,
  CreatePostInput,
  UpdatePostInput,
} from '@/types/board';

// 자료실 글 목록 — projectId 있으면 그 프로젝트, 없으면 팀 일자별.
export async function fetchBoardPosts(
  teamId: string,
  projectId: string | null
): Promise<BoardListResponse> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return apiClient.get<BoardListResponse>(`/api/teams/${teamId}/board${qs}`);
}

export async function fetchBoardPost(
  teamId: string,
  postId: string
): Promise<BoardPost> {
  return apiClient.get<BoardPost>(`/api/teams/${teamId}/board/${postId}`);
}

// multipart 업로드 — apiClient 가 JSON 만 지원해서 fetch 직접.
async function postMultipart<T>(url: string, formData: FormData, method = 'POST'): Promise<T> {
  const token = tokenManager.getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: formData });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    const message =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as Record<string, unknown>).error)
        : `요청 실패 (${res.status})`;
    throw new Error(message);
  }
  return parsed as T;
}

export async function createBoardPost(
  teamId: string,
  projectId: string | null,
  input: CreatePostInput
): Promise<BoardPost> {
  const fd = new FormData();
  fd.set('title', input.title);
  fd.set('content', input.content);
  if (projectId) fd.set('projectId', projectId);
  if (input.file) fd.set('file', input.file);
  return postMultipart<BoardPost>(`/api/teams/${teamId}/board`, fd, 'POST');
}

export async function updateBoardPost(
  teamId: string,
  postId: string,
  input: UpdatePostInput
): Promise<BoardPost> {
  const fd = new FormData();
  if (input.title !== undefined) fd.set('title', input.title);
  if (input.content !== undefined) fd.set('content', input.content);
  if (input.file) fd.set('file', input.file);
  return postMultipart<BoardPost>(`/api/teams/${teamId}/board/${postId}`, fd, 'PATCH');
}

export async function deleteBoardPost(teamId: string, postId: string): Promise<void> {
  await apiClient.delete<{ ok: true }>(`/api/teams/${teamId}/board/${postId}`);
}

// 다운로드 URL — `<a href={...}>` 또는 window.open 으로 사용.
export function boardAttachmentUrl(fileId: string): string {
  return `/api/files/${fileId}`;
}
