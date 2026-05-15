'use client';

import React, { useState } from 'react';

interface KakaoLoginButtonProps {
  redirectAfter?: string;
  disabled?: boolean;
}

/**
 * 카카오 로그인 버튼 — 카카오 디자인 가이드 준수 (노란 #FEE500 배경 + 검정 텍스트 + 카카오 심볼).
 *
 * 클릭 시: POST /api/auth/oauth/kakao/start 로 인증 URL 받아 location.href 이동.
 */
export function KakaoLoginButton({ redirectAfter, disabled }: KakaoLoginButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/oauth/kakao/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectAfter: redirectAfter ?? null }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        alert(data.error ?? '카카오 로그인 시작에 실패했습니다. 잠시 후 다시 시도해주세요.');
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      alert('네트워크 오류로 카카오 로그인을 시작할 수 없습니다.');
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || disabled}
      aria-label="카카오로 로그인"
      className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
      style={{ backgroundColor: '#FEE500', color: '#191919' }}
    >
      {/* 카카오 심볼 — 말풍선 아이콘 */}
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#191919"
          d="M12 3C6.48 3 2 6.48 2 10.8c0 2.78 1.86 5.2 4.65 6.6l-1.16 4.21c-.1.36.32.65.62.43l4.96-3.27c.31.04.62.06.93.06 5.52 0 10-3.48 10-7.83C22 6.48 17.52 3 12 3z"
        />
      </svg>
      {loading ? '카카오로 이동 중...' : '카카오로 시작하기'}
    </button>
  );
}
