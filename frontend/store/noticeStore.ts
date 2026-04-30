import { create } from 'zustand';
import {
  fetchNotices,
  fetchProjectNotices,
  createNotice,
  createProjectNotice,
  deleteNotice as deleteNoticeApi,
} from '@/lib/api/noticeApi';

export interface Notice {
  id: string;
  teamId: string;
  projectId?: string | null;
  senderId: string;
  senderName: string; // coerced from null to '' at API boundary
  content: string;
  createdAt: string; // ISO string
}

// 공지 캐시 key — 팀 공지: `team:<teamId>`, 프로젝트 공지: `project:<projectId>`.
// chat_messages 와 동일 격리 패턴: NULL ↔ team scope, NOT NULL ↔ project scope.
function scopeKey(teamId: string, projectId?: string | null): string {
  return projectId ? `project:${projectId}` : `team:${teamId}`;
}

interface NoticeStore {
  // scopeKey 별 캐싱. 한 팀 안에서 일자별 채팅 공지 ↔ 프로젝트 채팅 공지가 격리되도록.
  notices: Record<string, Notice[]>;

  getTeamNotices: (teamId: string, projectId?: string | null) => Notice[];
  loadTeamNotices: (teamId: string, projectId?: string | null) => Promise<void>;
  addNotice: (teamId: string, content: string, projectId?: string | null) => Promise<void>;
  deleteNotice: (teamId: string, noticeId: string, projectId?: string | null) => Promise<void>;
}

export const useNoticeStore = create<NoticeStore>()((set, get) => ({
  notices: {},

  getTeamNotices: (teamId, projectId) => get().notices[scopeKey(teamId, projectId)] ?? [],

  loadTeamNotices: async (teamId, projectId) => {
    const result = projectId
      ? await fetchProjectNotices(teamId, projectId)
      : await fetchNotices(teamId);
    const key = scopeKey(teamId, projectId);
    set((state) => ({
      notices: { ...state.notices, [key]: result },
    }));
  },

  addNotice: async (teamId, content, projectId) => {
    const notice = projectId
      ? await createProjectNotice(teamId, projectId, content)
      : await createNotice(teamId, content);
    const key = scopeKey(teamId, projectId);
    set((state) => ({
      notices: {
        ...state.notices,
        [key]: [...(state.notices[key] ?? []), notice],
      },
    }));
  },

  deleteNotice: async (teamId, noticeId, projectId) => {
    // 백엔드 DELETE 는 (teamId, noticeId) 만으로 동작 — project 공지든 팀 공지든 같은 endpoint 재사용.
    await deleteNoticeApi(teamId, noticeId);
    const key = scopeKey(teamId, projectId);
    set((state) => ({
      notices: {
        ...state.notices,
        [key]: (state.notices[key] ?? []).filter((n) => n.id !== noticeId),
      },
    }));
  },
}));
