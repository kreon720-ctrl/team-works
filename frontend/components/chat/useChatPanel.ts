'use client';

import { useState, useEffect } from 'react';
import { useSendMessage } from '@/hooks/query/useMessages';
import { useSendProjectMessage } from '@/hooks/query/useProjectMessages';
import { useSetWorkPermissions } from '@/hooks/query/useWorkPermissions';
import { useAuthStore } from '@/store/authStore';
import { useNoticeStore } from '@/store/noticeStore';
import type { TeamMember } from '@/types/team';
import type { ChatMessageMode } from './ChatInput';

interface UseChatPanelOptions {
  teamId: string;
  // projectId 가 주어지면 프로젝트 전용 채팅, 아니면 팀 일자별 채팅(date 사용).
  projectId?: string;
  date: string | undefined;
  members: TeamMember[];
  serverPermittedIds: string[];
}

export function useChatPanel({
  teamId,
  projectId,
  date,
  members,
  serverPermittedIds,
}: UseChatPanelOptions) {
  // 항상 두 mutation 모두 호출(Hooks 규칙) — 실제로는 projectId 유무 따라 한 쪽만 사용.
  const sendTeamMessage = useSendMessage(teamId, date);
  const sendProjectMessage = useSendProjectMessage(teamId, projectId ?? '');
  const sendMessage = projectId ? sendProjectMessage : sendTeamMessage;
  const setPermissions = useSetWorkPermissions(teamId);
  const currentUser = useAuthStore((s) => s.currentUser);
  const noticeStore = useNoticeStore();

  const [showModal, setShowModal] = useState(false);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    noticeStore.loadTeamNotices(teamId, projectId);
  }, [teamId, projectId]);

  const handleOpenModal = () => {
    if (serverPermittedIds.length > 0) {
      setDraftIds(new Set(serverPermittedIds));
    } else {
      setDraftIds(new Set(members.filter(m => m.role === 'LEADER').map(m => m.userId)));
    }
    setShowModal(true);
  };

  const toggleDraft = (userId: string) => {
    setDraftIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCloseModal = async () => {
    await setPermissions.mutateAsync(Array.from(draftIds));
    setShowModal(false);
  };

  const handleSend = (content: string, mode: ChatMessageMode) => {
    if (mode === 'NOTICE') {
      noticeStore.addNotice(teamId, content, projectId);
      return;
    }
    sendMessage.mutate({
      content,
      type: mode === 'WORK_PERFORMANCE' ? 'WORK_PERFORMANCE' : 'NORMAL',
    });
  };

  const handleDeleteNotice = (noticeId: string) => {
    noticeStore.deleteNotice(teamId, noticeId, projectId);
  };

  return {
    sendMessage,
    setPermissions,
    currentUser,
    showModal,
    draftIds,
    handleOpenModal,
    toggleDraft,
    handleCloseModal,
    handleSend,
    handleDeleteNotice,
  };
}
