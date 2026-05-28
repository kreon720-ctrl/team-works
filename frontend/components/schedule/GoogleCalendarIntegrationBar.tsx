'use client';

import React from 'react';
import { AlertTriangle, CalendarCheck, Link, RefreshCw, Unlink } from 'lucide-react';
import type { CalendarSyncResult } from '@/types/schedule';
import type { GoogleCalendarIntegrationStatusResponse } from '@/hooks/query/useGoogleCalendarIntegration';

interface GoogleCalendarIntegrationBarProps {
  status: GoogleCalendarIntegrationStatusResponse | undefined;
  isLoading: boolean;
  isLeader: boolean;
  isStarting: boolean;
  isDisconnecting: boolean;
  lastScheduleSync?: CalendarSyncResult | null;
  lastFetchedAt?: number;
  errorMessage?: string | null;
  compact?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function GoogleCalendarIntegrationBar({
  status,
  isLoading,
  isLeader,
  isStarting,
  isDisconnecting,
  errorMessage,
  onConnect,
  onDisconnect,
}: GoogleCalendarIntegrationBarProps) {
  if (!status && !isLoading && !errorMessage) return null;
  if (status?.status === 'not_applicable') return null;

  if (isLoading) {
    return (
      <div className="mx-2 mb-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-500 dark:border-dark-border dark:bg-dark-base dark:text-dark-text-muted">
        Google Calendar 연결 상태 확인 중...
      </div>
    );
  }

  const isConnected = status?.status === 'connected';
  const statusText = (() => {
    switch (status?.status) {
      case 'connected':
        return status.googleAccountEmail ?? 'Google Calendar';
      case 'needs_consent':
        return isLeader ? 'Google Calendar 연결 필요' : 'Google Calendar 연결 대기 중';
      case 'disabled':
        return 'Google Calendar 연결 해제됨';
      case 'error':
        return 'Google Calendar 재연결 필요';
      default:
        return 'Google Calendar 상태를 확인할 수 없습니다.';
    }
  })();

  const showConnect = status?.status === 'needs_consent' || status?.status === 'disabled' || status?.status === 'error';
  const showDisconnect = status?.status === 'connected';
  const isStatusWarning = status?.status === 'error' || !!errorMessage;

  return (
    <div
      className={[
        'mx-2 mb-1.5 rounded-md border px-2.5 py-1',
        isStatusWarning
          ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100',
      ].join(' ')}
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {isStatusWarning ? (
            <AlertTriangle className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          ) : (
            <CalendarCheck className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          )}
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
            <span className="min-w-0 truncate">{statusText}</span>
            {isConnected && (
              <span className="flex-none">연결됨</span>
            )}
          </div>
        </div>

        <div className="flex flex-none items-center gap-2">
          {showConnect && isLeader && (
            <button
              type="button"
              onClick={onConnect}
              disabled={isStarting}
              className="inline-flex h-5 items-center gap-1 rounded border border-current px-1.5 text-xs font-medium opacity-80 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={status?.status === 'error' ? 'Google Calendar 재연결' : 'Google Calendar 연결'}
            >
              {status?.status === 'error' ? (
                <RefreshCw className={['h-3 w-3', isStarting ? 'animate-spin' : ''].join(' ')} aria-hidden="true" />
              ) : (
                <Link className="h-3 w-3" aria-hidden="true" />
              )}
              {status?.status === 'error' ? '재연결' : '연결'}
            </button>
          )}
          {showDisconnect && isLeader && (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={isDisconnecting}
              className="inline-flex h-5 items-center gap-1 rounded border border-current px-1.5 text-xs font-medium opacity-80 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Google Calendar 연결 해제"
            >
              <Unlink className="h-3 w-3" aria-hidden="true" />
              해제
            </button>
          )}
        </div>
      </div>
      {errorMessage && (
        <p className="mt-1 text-xs font-medium">{errorMessage}</p>
      )}
    </div>
  );
}
