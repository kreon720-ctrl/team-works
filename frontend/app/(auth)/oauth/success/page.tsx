'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

/**
 * OAuth 콜백 success 페이지.
 *
 * 백엔드 callback 라우트가 토큰·사용자 정보를 URL fragment(#) 에 담아 여기로 302.
 * fragment 는 서버 로그·Referer 에 안 남고 JS 만 읽을 수 있어 토큰 전달에 안전.
 *
 *   /auth/oauth/success#accessToken=...&refreshToken=...&user=...&redirectAfter=...
 */
export default function OAuthSuccessPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1); // '#' 제거
    const params = new URLSearchParams(hash);

    const errMsg = params.get('error');
    if (errMsg) {
      setError(errMsg);
      return;
    }

    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const userJson = params.get('user');

    if (!accessToken || !refreshToken || !userJson) {
      setError('인증 응답이 올바르지 않습니다.');
      return;
    }

    let user: { id: string; email: string; name: string };
    try {
      user = JSON.parse(userJson);
    } catch {
      setError('인증 응답을 해석할 수 없습니다.');
      return;
    }

    // authStore 에 저장 (apiClient.setTokens 도 내부에서 호출됨)
    setUser(user, accessToken, refreshToken);

    // middleware 용 쿠키
    document.cookie = 'auth-initialized=true; path=/; max-age=604800';

    // fragment 정리 후 redirect
    const redirectAfter = params.get('redirectAfter') ?? '/';
    window.history.replaceState(null, '', '/auth/oauth/success');
    router.replace(redirectAfter);
  }, [router, setUser]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center px-4">
      {error ? (
        <div className="max-w-md w-full text-center space-y-4">
          <p className="text-error-500 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm hover:bg-primary-600"
          >
            로그인 화면으로
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-dark-text-muted">로그인 처리 중...</p>
      )}
    </div>
  );
}
