'use client';

import React, { useState } from 'react';
import { useMessages } from '@/hooks/query/useMessages';
import { useProjectMessages } from '@/hooks/query/useProjectMessages';
import { useTeamDetail } from '@/hooks/query/useTeams';
import { useProjectStore } from '@/store/projectStore';
import { useWorkPermissions } from '@/hooks/query/useWorkPermissions';
import { useNoticeStore } from '@/store/noticeStore';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { WorkPermissionModal } from './WorkPermissionModal';
import { NoticeBanner } from './NoticeBanner';
import { useChatPanel } from './useChatPanel';
import { BoardPanel } from '@/components/board/BoardPanel';
import type { TeamMember } from '@/types/team';

interface ChatPanelProps {
  teamId: string;
  // 팀 일자별 채팅이면 date, 프로젝트 전용 채팅이면 projectId.
  date?: string;
  projectId?: string;
  isLeader?: boolean;
}

export function ChatPanel({ teamId, date, projectId, isLeader = false }: ChatPanelProps) {
  // 프로젝트 채팅 모드에서 우측에 프로젝트명 표시 (모바일에서만 — PC 는 위 헤더에 이미 표시)
  const projectsForTeam = useProjectStore((s) => s.projects[teamId] ?? []);
  const activeProject = projectId ? projectsForTeam.find((p) => p.id === projectId) ?? null : null;
  // sub-tab — 채팅(기본) / 자료실. 채팅방마다 독립 — 컨텍스트 전환 시 'chat' 으로 리셋되도록 key 외부에서 줌.
  const [subTab, setSubTab] = useState<'chat' | 'board'>('chat');

  // 두 hook 모두 호출(Hooks 규칙) — projectId 유무로 어느 쪽 결과를 쓸지만 분기.
  const teamQuery = useMessages(teamId, projectId ? undefined : date);
  const projectQuery = useProjectMessages(teamId, projectId ?? '');
  const { data, isLoading, isError } = projectId ? projectQuery : teamQuery;

  const { data: teamDetail } = useTeamDetail(isLeader ? teamId : '');
  const { data: permData } = useWorkPermissions(teamId);
  const noticeStore = useNoticeStore();
  const notices = noticeStore.getTeamNotices(teamId, projectId);

  const members: TeamMember[] = teamDetail?.members ?? [];
  const serverPermittedIds: string[] = permData?.permittedUserIds ?? [];

  const {
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
  } = useChatPanel({ teamId, projectId, date, members, serverPermittedIds });

  const messages = data?.messages || [];

  const canDeleteNotice = (senderId: string) => {
    if (!currentUser) return false;
    return isLeader || currentUser.id === senderId;
  };

  // 권한 설정 상태 요약 배지
  const filterActive = serverPermittedIds.length > 1 && serverPermittedIds.length < members.length;

  const adminSlot = isLeader ? (
    <div className="flex items-center gap-1.5">
      {filterActive && (
        <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
          {serverPermittedIds.length}명 권한설정
        </span>
      )}
      <button
        onClick={handleOpenModal}
        className="px-2.5 py-1 text-xs font-medium border border-gray-300 dark:border-dark-border rounded hover:bg-gray-50 dark:hover:bg-dark-surface text-gray-700 dark:text-dark-text-muted bg-white dark:bg-dark-surface"
      >
        관리자
      </button>
    </div>
  ) : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* sub-tab — 채팅 / 자료실 + 우측에 현재 날짜 표시 (팀 일자별 채팅에 한해) */}
      <div className="flex items-center border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface shrink-0">
        <button
          type="button"
          onClick={() => setSubTab('chat')}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors duration-150 ${
            subTab === 'chat'
              ? 'text-primary-600 border-primary-500 dark:text-dark-accent dark:border-dark-accent'
              : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-dark-text-muted dark:hover:text-dark-text'
          }`}
        >
          채팅
        </button>
        <button
          type="button"
          onClick={() => setSubTab('board')}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors duration-150 ${
            subTab === 'board'
              ? 'text-primary-600 border-primary-500 dark:text-dark-accent dark:border-dark-accent'
              : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-dark-text-muted dark:hover:text-dark-text'
          }`}
        >
          자료실
        </button>
        {/* 팀 일자별 채팅 — 현재 채팅창의 날짜 표시. 프로젝트 채팅(projectId 있는 경우)엔 표시 안 함. */}
        {date && !projectId && (
          <span className="ml-auto px-3 text-xs font-medium text-gray-600 dark:text-dark-text-muted">
            {date.length === 10 ? `${date.slice(0, 4)}년 ${date.slice(5, 7)}월 ${date.slice(8, 10)}일` : date}
          </span>
        )}
        {/* 프로젝트 채팅 — 모바일에서만 우측에 프로젝트명. PC 는 위 헤더에 이미 표시되므로 sm:hidden. */}
        {projectId && activeProject && (
          <span className="ml-auto px-3 text-xs font-medium text-gray-600 dark:text-dark-text-muted truncate max-w-[55%] sm:hidden">
            📌 {activeProject.name}
          </span>
        )}
      </div>

      {/*
        ChatBody 는 JSX 태그(<ChatBody />) 가 아닌 일반 함수 호출({ChatBody()}) 로 렌더.
        부모 함수 내부에 정의된 컴포넌트는 매 렌더마다 새 함수 참조가 되어
        React 가 별개 컴포넌트로 인식 → unmount/mount 반복 → 입력창 포커스 손실.
      */}
      {subTab === 'board' ? (
        <BoardPanel teamId={teamId} projectId={projectId} />
      ) : (
        ChatBody()
      )}

      {/* 업무보고 보기 권한부여 팝업 */}
      {showModal && (
        <WorkPermissionModal
          members={members}
          draftIds={draftIds}
          isSaving={setPermissions.isPending}
          onToggle={toggleDraft}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );

  // 채팅 본체 — sub-tab 'chat' 활성 시 렌더. NoticeBanner / 메시지 목록 / 입력창 / 폴링 표시.
  function ChatBody() {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {/* 고정 공지사항 배너 */}
        <NoticeBanner
          notices={notices}
          canDelete={canDeleteNotice}
          onDelete={handleDeleteNotice}
        />

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-pulse">
              <p className="text-sm text-gray-500 dark:text-dark-text-muted">메시지 로딩 중...</p>
            </div>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <svg className="w-12 h-12 text-error-500 mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm text-error-500">메시지를 불러오는 중 오류가 발생했습니다.</p>
          </div>
        ) : (
          <ChatMessageList
            messages={messages}
            isLeader={isLeader}
            adminSlot={adminSlot}
          />
        )}
      </div>

      {/* 입력창 */}
      <ChatInput
        onSend={handleSend}
        isPending={sendMessage.isPending}
        maxContentLength={2000}
      />

        {/* Polling indicator */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-dark-base border-t border-gray-200 dark:border-dark-border">
          <p className="text-xs text-gray-400 dark:text-dark-text-disabled text-center">
            * 3초마다 자동 갱신
          </p>
        </div>
      </div>
    );
  }
}
