'use client';

import React, { useState, useEffect, KeyboardEvent } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

export type ChatMessageMode = 'NORMAL' | 'WORK_PERFORMANCE' | 'NOTICE';

interface ChatInputProps {
  onSend: (content: string, mode: ChatMessageMode) => void;
  isPending?: boolean;
  maxContentLength?: number;
}

export function ChatInput({ onSend, isPending = false, maxContentLength = 2000 }: ChatInputProps) {
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<ChatMessageMode>('NORMAL');

  // 음성 입력 (STT) — Galaxy/Samsung 등 quirk 자동 회피하는 hybrid hook
  const stt = useSpeechRecognition();
  // transcript 가 들어오면 입력창에 반영 (덮어쓰기)
  useEffect(() => {
    if (stt.transcript) setContent(stt.transcript);
  }, [stt.transcript]);

  const isValidContent = content.trim().length > 0 && content.length <= maxContentLength;

  const handleSend = () => {
    if (!isValidContent || isPending) return;
    onSend(content.trim(), mode);
    setContent('');
    setMode('NORMAL');
    // 음성 잔여 정리
    if (stt.isListening) stt.stop();
    stt.reset();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleMode = (target: ChatMessageMode) => {
    setMode((prev) => (prev === target ? 'NORMAL' : target));
  };

  return (
    <div className="w-full bg-white dark:bg-dark-surface border-t border-gray-200 dark:border-dark-border px-4 pt-2 pb-2">
      {/* Mode indicator */}
      {mode === 'WORK_PERFORMANCE' && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-teal-50 border border-teal-300 dark:bg-[rgba(16,185,129,0.15)] dark:border-[rgba(16,185,129,0.40)] px-3 py-2">
          <svg className="w-4 h-4 text-teal-600 dark:text-[#10B981]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-semibold text-teal-700 dark:text-[#10B981]">업무보고 모드</span>
          <button type="button" onClick={() => setMode('NORMAL')} className="ml-auto text-xs text-teal-600 hover:text-teal-700 dark:text-[#10B981]/70 dark:hover:text-[#10B981]">취소</button>
        </div>
      )}
      {mode === 'NOTICE' && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-300 dark:bg-orange-950/30 dark:border-orange-900/50 px-3 py-2">
          <svg className="w-4 h-4 text-orange-600 dark:text-orange-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 002-2H8a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">공지사항 모드</span>
          <button type="button" onClick={() => setMode('NORMAL')} className="ml-auto text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300">취소</button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-stretch gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === 'WORK_PERFORMANCE'
              ? '업무보고를 입력하세요...'
              : mode === 'NOTICE'
              ? '공지사항을 입력하세요...'
              : '메시지를 입력하세요...'
          }
          className="flex-1 h-full border border-gray-300 dark:border-dark-border rounded-xl bg-white dark:bg-dark-base px-4 py-2.5 text-sm font-normal text-gray-800 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-text-disabled shadow-sm resize-none transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-dark-accent focus:border-transparent disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
          disabled={isPending}
          maxLength={maxContentLength}
          rows={4}
        />

        <div className="flex flex-col gap-2">
          {/* Send + Mic — 한 줄에 아이콘 버튼 2개 */}
          <div className="flex gap-1">
            {/* Send button — '전송' 텍스트, 컴팩트 */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!isValidContent || isPending}
              aria-label="전송"
              className="inline-flex items-center justify-center gap-1 rounded-lg py-1.5 px-3 text-xs font-medium transition-colors duration-150 bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed dark:bg-dark-accent-strong dark:text-gray-900 dark:hover:bg-white dark:disabled:bg-dark-elevated dark:disabled:text-dark-text-disabled"
            >
              {isPending ? (
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : '전송'}
            </button>

            {/* Mic button — 음성 입력 토글 (비지원 환경에선 숨김) */}
            {stt.isSupported && (
              <button
                type="button"
                onClick={stt.isListening ? stt.stop : stt.start}
                disabled={stt.isTranscribing || isPending}
                aria-label={stt.isListening ? '음성 입력 중지' : stt.isTranscribing ? '음성 변환 중' : '음성 입력 시작'}
                aria-pressed={stt.isListening}
                title={stt.isListening ? '음성 입력 중지' : '음성 입력'}
                className={`inline-flex items-center justify-center rounded-lg p-1.5 transition-colors duration-150 ${
                  stt.isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : stt.isTranscribing
                      ? 'bg-amber-400 text-white cursor-wait'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-dark-border dark:text-dark-text-muted dark:hover:bg-dark-elevated'
                }`}
              >
                {stt.isTranscribing ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  // heroicons microphone
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v3m-4 0h8M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
                  </svg>
                )}
              </button>
            )}
          </div>

          {/* 업무보고 toggle */}
          <button
            type="button"
            onClick={() => toggleMode('WORK_PERFORMANCE')}
            className={`
              inline-flex items-center justify-center gap-1 rounded-lg py-1.5 px-3 text-xs font-medium transition-colors duration-150
              ${mode === 'WORK_PERFORMANCE'
                ? 'bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-[rgba(16,185,129,0.20)] dark:text-[#10B981] dark:hover:bg-[rgba(16,185,129,0.30)]'
                : 'bg-gray-100 dark:bg-dark-elevated text-gray-600 dark:text-dark-text-muted hover:bg-gray-200 dark:hover:bg-dark-surface'
              }
            `}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            업무보고
          </button>

          {/* 공지사항 toggle */}
          <button
            type="button"
            onClick={() => toggleMode('NOTICE')}
            className={`
              inline-flex items-center justify-center gap-1 rounded-lg py-1.5 px-3 text-xs font-medium transition-colors duration-150
              ${mode === 'NOTICE'
                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/50'
                : 'bg-gray-100 dark:bg-dark-elevated text-gray-600 dark:text-dark-text-muted hover:bg-gray-200 dark:hover:bg-dark-surface'
              }
            `}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 002-2H8a2 2 0 002 2z" />
            </svg>
            공지사항
          </button>
        </div>
      </div>

    </div>
  );
}
