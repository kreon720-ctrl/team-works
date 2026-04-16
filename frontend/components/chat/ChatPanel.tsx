'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMessages, useSendMessage } from '@/hooks/query/useMessages';
import { useTeamDetail } from '@/hooks/query/useTeams';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';

interface ChatPanelProps {
  teamId: string;
  date?: string;
  isLeader?: boolean;
}

export function ChatPanel({ teamId, date, isLeader = false }: ChatPanelProps) {
  const { data, isLoading, isError } = useMessages(teamId, date);
  const sendMessage = useSendMessage(teamId, date);
  const { data: teamDetail } = useTeamDetail(isLeader ? teamId : '');

  const [showMemberList, setShowMemberList] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMemberList(false);
      }
    }
    if (showMemberList) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMemberList]);

  const allMessages = data?.messages || [];

  // 멤버 필터 적용: 선택된 멤버의 WORK_PERFORMANCE 메시지만 표시
  const messages = selectedMemberId
    ? allMessages.filter(
        m => m.type === 'WORK_PERFORMANCE' && m.senderId === selectedMemberId
      )
    : allMessages;

  const handleSend = (content: string, type: 'NORMAL' | 'WORK_PERFORMANCE') => {
    sendMessage.mutate({ content, type });
  };

  const handleSelectMember = (userId: string, name: string) => {
    setSelectedMemberId(userId);
    setSelectedMemberName(name);
    setShowMemberList(false);
  };

  const handleClearFilter = () => {
    setSelectedMemberId(null);
    setSelectedMemberName(null);
  };

  const members = teamDetail?.members ?? [];

  // 팀장 전용 관리자 버튼 (첫 번째 메시지 헤더 행 오른쪽에 삽입)
  const adminSlot = isLeader ? (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-1.5">
        {selectedMemberId && (
          <>
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {selectedMemberName}
            </span>
            <button
              onClick={handleClearFilter}
              className="text-gray-400 hover:text-gray-600 text-xs leading-none"
              title="필터 해제"
            >
              ✕
            </button>
          </>
        )}
        <button
          onClick={() => setShowMemberList(prev => !prev)}
          className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50 text-gray-700 bg-white"
        >
          관리자
        </button>
      </div>
      {showMemberList && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded shadow-lg z-50">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">
            팀원 업무실적 조회
          </div>
          {members.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">멤버 없음</div>
          ) : (
            members.map(member => (
              <button
                key={member.userId}
                onClick={() => handleSelectMember(member.userId, member.name)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 ${
                  selectedMemberId === member.userId ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'
                }`}
              >
                {member.name}
                {member.role === 'LEADER' && (
                  <span className="ml-1 text-xs text-indigo-400">(팀장)</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  ) : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-pulse">
              <p className="text-sm text-gray-500">메시지 로딩 중...</p>
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
            emptyLabel={selectedMemberId ? `${selectedMemberName}님의 업무실적 메시지가 없습니다.` : undefined}
          />
        )}
      </div>

      {/* Input area */}
      <ChatInput
        onSend={handleSend}
        isPending={sendMessage.isPending}
        maxContentLength={2000}
      />

      {/* Polling indicator */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center">
          * 3초마다 자동 갱신
        </p>
      </div>
    </div>
  );
}
