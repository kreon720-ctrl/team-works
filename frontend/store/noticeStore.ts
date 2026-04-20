import { create } from 'zustand';
import {
  fetchNotices,
  createNotice,
  deleteNotice as deleteNoticeApi,
} from '@/lib/api/noticeApi';

export interface Notice {
  id: string;
  teamId: string;
  senderId: string;
  senderName: string; // coerced from null to '' at API boundary
  content: string;
  createdAt: string; // ISO string
}

interface NoticeStore {
  notices: Record<string, Notice[]>; // teamId -> notices[] (in-memory cache)

  getTeamNotices: (teamId: string) => Notice[];
  loadTeamNotices: (teamId: string) => Promise<void>;
  addNotice: (teamId: string, content: string) => Promise<void>;
  deleteNotice: (teamId: string, noticeId: string) => Promise<void>;
}

export const useNoticeStore = create<NoticeStore>()((set, get) => ({
  notices: {},

  getTeamNotices: (teamId) => get().notices[teamId] ?? [],

  loadTeamNotices: async (teamId) => {
    const result = await fetchNotices(teamId);
    set((state) => ({
      notices: {
        ...state.notices,
        [teamId]: result,
      },
    }));
  },

  addNotice: async (teamId, content) => {
    const notice = await createNotice(teamId, content);
    set((state) => ({
      notices: {
        ...state.notices,
        [teamId]: [...(state.notices[teamId] ?? []), notice],
      },
    }));
  },

  deleteNotice: async (teamId, noticeId) => {
    await deleteNoticeApi(teamId, noticeId);
    set((state) => ({
      notices: {
        ...state.notices,
        [teamId]: (state.notices[teamId] ?? []).filter(
          (n) => n.id !== noticeId
        ),
      },
    }));
  },
}));
