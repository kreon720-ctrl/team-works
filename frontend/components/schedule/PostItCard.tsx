'use client';

import React, { useState, useRef, useCallback } from 'react';
import type { PostIt } from '@/types/postit';
import type { ScheduleColor } from '@/types/schedule';

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

  return (
    <div
      className="relative w-[95%] md:w-[90%] mx-auto mt-0.5 md:mt-1 flex-shrink-0 min-h-[36px] md:min-h-[72px]"
      onClick={e => e.stopPropagation()}
    >
      {/* 카드 본체 */}
      <div
        className="relative w-full rounded-sm overflow-hidden min-h-[36px] md:min-h-[72px]"
        style={{
          background: activeBg,
          border: isDark ? `1px solid ${activeBorder}` : undefined,
          boxShadow: isDark
            ? `0 0 0 1px ${activeBorder}, 2px 3px 8px ${activeShadow}`
            : `2px 3px 8px ${style.shadow}, inset 0 -2px 4px rgba(0,0,0,0.04)`,
        }}
      >
        {/* 상단 색상 줄 (포스트잇 접착 부분 느낌) */}
        <div
          className="w-full h-1 md:h-1.5 flex-shrink-0"
          style={{ background: activeBorder, opacity: isDark ? 0.8 : 0.6 }}
        />

        {/* 내용 영역 */}
        <div className="relative px-1 md:px-2 pt-0.5 md:pt-1.5 pb-0.5 md:pb-2">
          {/* 삭제 버튼 (생성자만) — absolute, 텍스트 영역 오른쪽 패딩으로 겹침 방지 */}
          {isCreator && (
            <button
              type="button"
              onClick={() => onDelete(postit.id, postit.date)}
              className="absolute top-0.5 md:top-1 right-0.5 md:right-1 p-0.5 rounded opacity-40 hover:opacity-90 transition-opacity"
              style={{ color: activeText }}
              title="포스트잇 삭제"
            >
              <svg className="w-2.5 h-2.5 md:w-3 md:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}

          <textarea
            value={localContent}
            onChange={handleChange}
            onBlur={handleBlur}
            readOnly={!isCreator}
            placeholder={isCreator ? '메모를 입력하세요...' : ''}
            rows={2}
            maxLength={MAX_LENGTH}
            className="w-full bg-transparent resize-none overflow-hidden leading-[1.15] md:leading-relaxed outline-none border-none placeholder-current/40 text-[10px] md:text-xs min-h-[20px] md:min-h-[52px]"
            style={{
              color: activeText,
              paddingRight: isCreator ? '14px' : undefined,
              cursor: isCreator ? 'text' : 'default',
            }}
          />
        </div>

      </div>
    </div>
  );
}
