'use client';

import { useBreakpoint } from '@/hooks/useBreakpoint';

/**
 * 로그인/회원가입 페이지 상단의 랜딩 링크 한 줄.
 * About 은 디바이스별로 다른 페이지로 (모바일 → mobile.html, PC → index.html).
 */
export function LandingLinksRow() {
  const { isMobile } = useBreakpoint();
  const aboutHref = isMobile ? '/landing/mobile.html' : '/landing/index.html';

  return (
    <div className="text-center mb-6 flex items-center justify-center gap-3 text-xs">
      <a
        href={aboutHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/70 hover:text-amber-400 transition-colors duration-150"
      >
        About TEAM WORKS
      </a>
      <span className="text-white/30">·</span>
      <a
        href="/landing/quickstart.html"
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/70 hover:text-amber-400 transition-colors duration-150"
      >
        Quick Start Guide
      </a>
    </div>
  );
}
