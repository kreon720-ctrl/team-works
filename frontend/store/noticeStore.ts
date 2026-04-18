import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Notice {
  id: string;
  teamId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string; // ISO string
}

interface NoticeStore {
  notices: Record<string, Notice[]>; // teamId -> notices[]

  getTeamNotices: (teamId: string) => Notice[];
  addNotice: (teamId: string, input: Omit<Notice, 'id' | 'teamId' | 'createdAt'>) => void;
  deleteNotice: (teamId: string, noticeId: string) => void;
}

export const useNoticeStore = create<NoticeStore>()(
  persist(
    (set, get) => ({
      notices: {},

      getTeamNotices: (teamId) => get().notices[teamId] ?? [],

      addNotice: (teamId, input) => {
        const notice: Notice = {
          id: `notice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          teamId,
          createdAt: new Date().toISOString(),
          ...input,
        };
        set((state) => ({
          notices: {
            ...state.notices,
            [teamId]: [...(state.notices[teamId] ?? []), notice],
          },
        }));
      },

      deleteNotice: (teamId, noticeId) => {
        set((state) => ({
          notices: {
            ...state.notices,
            [teamId]: (state.notices[teamId] ?? []).filter((n) => n.id !== noticeId),
          },
        }));
      },
    }),
    { name: 'notice-store' }
  )
);
