// Auth Interceptor - 401 감지 + Access Token 자동 갱신 + 재시도 로직

import { tokenManager } from './tokenManager';

// 기본값은 빈 문자열(same-origin) — Docker(nginx) 환경에서는 /api/* 가 nginx 를 통해
// backend 로 프록시되므로 CORS 가 발생하지 않음. 별도 도메인으로 띄울 때만 env 명시.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Refresh access token using the stored refresh token.
 * Returns the new access token, or null if refresh fails.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = tokenManager.getRefreshToken();
      if (!refreshToken) return null;

      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      const newAccessToken = data.accessToken;
      tokenManager.setAccessToken(newAccessToken);
      return newAccessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Attempt token refresh and retry the original fetch call.
 * If refresh fails, clears tokens and redirects to /login.
 */
export async function handleUnauthorized(
  retryFetch: (authHeader: string) => Promise<Response>
): Promise<Response> {
  const newAccessToken = await refreshAccessToken();

  if (newAccessToken) {
    return retryFetch(`Bearer ${newAccessToken}`);
  }

  tokenManager.clearTokens();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
  throw new Error('Authentication required');
}

export { isRefreshing };

// JWT exp 클레임 디코드 — 서명 검증은 안 함 (서버가 검증).
// 형식 오류·미파싱 시 null 반환해 호출자가 reactive 경로로 fallback.
function decodeJwtExpSec(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Proactive token getter — exp 30 초 이상 남으면 현재 access token 그대로,
 * 만료 임박/만료면 refresh 후 새 토큰 반환. SSE fetch 처럼 apiClient 인터셉터를 우회해야 하는
 * 경로(예: AI 어시스턴트 채팅) 에서 backend 401 을 사전 방지하기 위해 호출.
 *
 * 반환:
 *   - string: 사용 가능한 access token
 *   - null: 갱신 실패 (호출자는 로그인 화면으로 redirect 등 처리)
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = tokenManager.getAccessToken();
  if (!token) return null;
  const expSec = decodeJwtExpSec(token);
  if (expSec === null) {
    // exp 디코드 실패 — 그대로 시도. 만료된 거면 호출자가 401 받게 됨.
    return token;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (expSec - nowSec > 30) return token;
  // 만료됐거나 30초 이내 만료 → refresh
  return refreshAccessToken();
}
