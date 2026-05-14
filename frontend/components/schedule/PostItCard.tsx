'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { PostIt } from '@/types/postit';
import type { ScheduleColor } from '@/types/schedule';
import { useBreakpoint } from '@/hooks/useBreakpoint';

interface PostItCardProps {
  postit: PostIt;
  currentUserId: string;
  onDelete: (id: string, date: string) => void;
  onContentChange: (id: string, content: string) => void;
}

const COLOR_STYLES: Record<ScheduleColor, {
  bg: string; shadow: string; fold: string; text: string; border: string;
  darkBg: string; darkBorder: string; darkText: string; darkShadow: string;
}> = {
  amber:   { bg: '#fde68a', shadow: 'rgba(180,130,0,0.25)',   fold: 'rgba(180,130,0,0.15)',  text: '#78350f', border: '#f59e0b',  darkBg: 'rgba(255,184,0,0.15)',   darkBorder: 'rgba(255,184,0,0.40)',   darkText: '#e5e2e1', darkShadow: 'rgba(255,184,0,0.15)' },
  indigo:  { bg: '#c7d2fe', shadow: 'rgba(79,70,229,0.25)',   fold: 'rgba(79,70,229,0.15)',  text: '#312e81', border: '#6366f1',  darkBg: 'rgba(99,102,241,0.15)',  darkBorder: 'rgba(99,102,241,0.40)',  darkText: '#e5e2e1', darkShadow: 'rgba(99,102,241,0.15)' },
  blue:    { bg: '#bfdbfe', shadow: 'rgba(37,99,235,0.25)',   fold: 'rgba(37,99,235,0.15)',  text: '#1e3a5f', border: '#3b82f6',  darkBg: 'rgba(99,102,241,0.15)',  darkBorder: 'rgba(99,102,241,0.40)',  darkText: '#e5e2e1', darkShadow: 'rgba(99,102,241,0.15)' },
  emerald: { bg: '#a7f3d0', shadow: 'rgba(5,150,105,0.25)',   fold: 'rgba(5,150,105,0.15)', text: '#064e3b', border: '#10b981',  darkBg: 'rgba(16,185,129,0.15)',  darkBorder: 'rgba(16,185,129,0.40)',  darkText: '#e5e2e1', darkShadow: 'rgba(16,185,129,0.15)' },
  rose:    { bg: '#fecdd3', shadow: 'rgba(225,29,72,0.25)',   fold: 'rgba(225,29,72,0.15)',  text: '#881337', border: '#f43f5e',  darkBg: 'rgba(239,68,68,0.15)',   darkBorder: 'rgba(239,68,68,0.40)',   darkText: '#e5e2e1', darkShadow: 'rgba(239,68,68,0.15)' },
};

function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  React.useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

export function PostItCard({ postit, currentUserId, onDelete, onContentChange }: PostItCardProps) {
  const [localContent, setLocalContent] = useState(postit.content);
  // 모바일에서 카드 탭 시 화면 중앙에 큰 모달로 띄우기 위한 state.
  // PC 는 셀 안 인라인 textarea 만 사용 — 모달 미사용.
  const [isExpanded, setIsExpanded] = useState(false);
  const isCreator = postit.createdBy === currentUserId;
  const style = COLOR_STYLES[postit.color];
  const isDark = useDarkMode();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MAX_LENGTH = 100;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isCreator) return;
    const val = e.target.value.slice(0, MAX_LENGTH);
    setLocalContent(val);
    // 디바운스 자동저장 (1.5초)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onContentChange(postit.id, val);
    }, 1500);
  }, [isCreator, postit.id, onContentChange]);

  const handleBlur = useCallback(() => {
    if (!isCreator) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    onContentChange(postit.id, localContent);
  }, [isCreator, postit.id, localContent, onContentChange]);

  const activeBg     = isDark ? style.darkBg     : style.bg;
  const activeBorder = isDark ? style.darkBorder : style.border;
  const activeText   = isDark ? style.darkText   : style.text;
  const activeShadow = isDark ? style.darkShadow : style.shadow;

  const { isMobile } = useBreakpoint();

  // 모달 닫을 때 미반영 변경(디바운스 대기 중) 즉시 저장.
  const closeExpanded = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (isCreator && localContent !== postit.content) {
      onContentChange(postit.id, localContent);
    }
    setIsExpanded(false);
  }, [isCreator, localContent, postit.id, postit.content, onContentChange]);

  // Esc 키로 모달 닫기.
  useEffect(() => {
    if (!isExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeExpanded();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isExpanded, closeExpanded]);

  // 모바일 + 작성자 + 빈 컨텐트 + 방금 생성됨(createdAt 5초 이내) 일 때만 mount 시 자동 모달 오픈.
  // 셀 클릭 → 색상 팔레트 선택으로 빈 PostIt 이 생성된 직후 흐름 — 사용자가 즉시 입력 가능.
  //
  // createdAt 가드 없이 "빈 컨텐트만" 으로 판정하면, 다른 달로 이동했을 때 그 달에 이미
  // 빈 채로 저장돼 있던 포스트잇들이 모두 동시에 모달을 띄움 (다중 모달 충돌).
  // didAutoOpenRef 로 1회만 작동.
  const didAutoOpenRef = useRef(false);
  useEffect(() => {
    if (didAutoOpenRef.current) return;
    if (!isMobile || !isCreator || postit.content) return;
    const createdMs = Date.parse(postit.createdAt);
    if (Number.isNaN(createdMs)) return;
    if (Date.now() - createdMs > 5000) return;
    setIsExpanded(true);
    didAutoOpenRef.current = true;
  }, [isMobile, isCreator, postit.content, postit.createdAt]);

  // 모바일 셀 안 미리보기 — 14자 초과 시 앞 12자 + ".." 로 잘라 표시.
  // textarea 가 아닌 readonly div 로 렌더하므로 직접 잘라 처리 (CSS line-clamp 의 …(세 점)
  // 대신 사용자 요구의 점 두 개 사용).
  const PREVIEW_MAX_CHARS = 14;
  const previewText =
    localContent.length > PREVIEW_MAX_CHARS
      ? localContent.slice(0, PREVIEW_MAX_CHARS - 2) + '..'
      : localContent;

  return (
    <>
    <div
      className="relative w-full md:w-[90%] md:mx-auto mt-0.5 md:mt-1 flex-shrink-0 min-h-[36px] md:min-h-[72px]"
      onClick={(e) => {
        e.stopPropagation();
        // 모바일에선 카드 탭 → 확대 모달 오픈. PC 는 인라인 편집 그대로 (모달 미사용).
        if (isMobile) setIsExpanded(true);
      }}
      style={{ cursor: isMobile ? 'pointer' : undefined }}
    >
      {/* 카드 본체 — 모바일은 테두리·그림자·rounded 모두 제거, PC 만 유지 */}
      <div
        className="relative w-full rounded-none md:rounded-sm overflow-hidden min-h-[36px] md:min-h-[72px]"
        style={{
          background: activeBg,
          border: !isMobile && isDark ? `1px solid ${activeBorder}` : undefined,
          boxShadow: isMobile
            ? undefined
            : isDark
              ? `0 0 0 1px ${activeBorder}, 2px 3px 8px ${activeShadow}`
              : `2px 3px 8px ${style.shadow}, inset 0 -2px 4px rgba(0,0,0,0.04)`,
        }}
      >
        {/* 상단 여백(색상 줄) — 모바일은 X 들어가는 최소 높이 h-2.5 (10px), PC 는 기존 h-1.5 (6px) */}
        <div
          className="relative w-full h-2.5 md:h-1.5 flex-shrink-0 flex items-center justify-end"
          style={{ background: activeBorder, opacity: isDark ? 0.8 : 0.6 }}
        >
          {/* 모바일 X 삭제 버튼 — 상단 여백 우측. PC 는 휴지통(아래) 으로 분기.
              stopPropagation 으로 외부 div 의 모달 오픈 핸들러와 충돌 방지. */}
          {isCreator && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(postit.id, postit.date);
              }}
              className="md:hidden absolute right-0 top-1/2 -translate-y-1/2 p-0 leading-none opacity-80 hover:opacity-100"
              style={{ color: activeText }}
              title="포스트잇 삭제"
              aria-label="포스트잇 삭제"
            >
              <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 내용 영역 — 모바일은 padding 모두 0, PC 는 기존 패딩 */}
        <div className="relative px-0 md:px-2 pt-0 md:pt-1.5 pb-0 md:pb-2">
          {/* PC 휴지통 삭제 버튼 — 모바일은 위 X 로 대체 */}
          {isCreator && (
            <button
              type="button"
              onClick={() => onDelete(postit.id, postit.date)}
              className="hidden md:block absolute top-1 right-1 p-0.5 rounded opacity-40 hover:opacity-90 transition-opacity"
              style={{ color: activeText }}
              title="포스트잇 삭제"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}

          {/* 모바일: 읽기 전용 div + 14자 컷 ".." 미리보기 (편집은 모달에서).
              PC: 기존 인라인 textarea 그대로. */}
          {isMobile ? (
            <div
              className="w-full leading-[1.15] text-[10px] min-h-[20px] whitespace-pre-wrap break-words pointer-events-none select-none"
              style={{
                color: activeText,
                opacity: previewText ? 1 : 0.4,
              }}
            >
              {previewText || (isCreator ? '메모를 입력하세요..' : '')}
            </div>
          ) : (
            <textarea
              value={localContent}
              onChange={handleChange}
              onBlur={handleBlur}
              readOnly={!isCreator}
              placeholder={isCreator ? '메모를 입력하세요...' : ''}
              rows={2}
              maxLength={MAX_LENGTH}
              className="w-full bg-transparent resize-none overflow-hidden leading-relaxed outline-none border-none placeholder-current/40 text-xs min-h-[52px]"
              style={{
                color: activeText,
                paddingRight: isCreator ? '14px' : undefined,
                cursor: isCreator ? 'text' : 'default',
              }}
            />
          )}
        </div>

      </div>
    </div>

    {/* 모바일 확대 모달 — 카드 탭 시 화면 중앙에 큰 카드로 표시.
        같은 색상 스타일 유지 + 큰 textarea(작성자 편집) + 닫기/삭제 버튼. */}
    {isExpanded && isMobile && (
      <PostItExpandedModal
        localContent={localContent}
        isCreator={isCreator}
        activeBg={activeBg}
        activeBorder={activeBorder}
        activeText={activeText}
        activeShadow={activeShadow}
        maxLength={MAX_LENGTH}
        onChange={handleChange}
        onBlur={handleBlur}
        onClose={closeExpanded}
        onDelete={() => {
          onDelete(postit.id, postit.date);
          setIsExpanded(false);
        }}
      />
    )}
    </>
  );
}

interface PostItExpandedModalProps {
  localContent: string;
  isCreator: boolean;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  activeShadow: string;
  maxLength: number;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  onClose: () => void;
  onDelete: () => void;
}

function PostItExpandedModal({
  localContent,
  isCreator,
  activeBg,
  activeBorder,
  activeText,
  activeShadow,
  maxLength,
  onChange,
  onBlur,
  onClose,
  onDelete,
}: PostItExpandedModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="포스트잇 상세"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-lg overflow-hidden"
        style={{
          background: activeBg,
          border: `2px solid ${activeBorder}`,
          boxShadow: `0 20px 60px ${activeShadow}, 0 0 0 1px ${activeBorder}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 색상 줄 + 닫기 버튼 */}
        <div
          className="relative h-9 flex items-center justify-between px-3"
          style={{ background: activeBorder, opacity: 0.85 }}
        >
          <span className="text-xs font-medium text-white drop-shadow-sm">포스트잇</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-white opacity-90 hover:opacity-100 hover:bg-white/20 transition-colors"
            aria-label="닫기"
            title="닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 큰 textarea */}
        <div className="p-4">
          <textarea
            value={localContent}
            onChange={onChange}
            onBlur={onBlur}
            readOnly={!isCreator}
            placeholder={isCreator ? '메모를 입력하세요...' : ''}
            rows={6}
            maxLength={maxLength}
            autoFocus={isCreator}
            className="w-full bg-transparent resize-none outline-none border-none placeholder-current/40 text-base leading-relaxed min-h-[180px]"
            style={{ color: activeText, cursor: isCreator ? 'text' : 'default' }}
          />

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs opacity-60" style={{ color: activeText }}>
              {localContent.length}/{maxLength}
            </span>
            {/* 명시적 닫기 + (작성자만) 삭제 — 상단 X 와 별개로 하단에 명시 액션 노출. */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border opacity-80 hover:opacity-100 transition-opacity bg-transparent"
                style={{ borderColor: activeBorder, color: activeText }}
                aria-label="닫기"
              >
                {/* 체크 — 저장 느낌 (모달 닫을 때 미반영 변경분 자동저장됨) */}
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                닫기
              </button>
              {isCreator && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium opacity-80 hover:opacity-100 transition-opacity"
                  style={{ background: activeBorder, color: '#fff' }}
                  aria-label="포스트잇 삭제"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
