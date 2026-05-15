'use client';

/**
 * 로그인/회원가입 페이지 상단의 랜딩 링크 한 줄.
 * About 은 클릭 시점에 viewport 를 직접 검사해 모바일/PC 랜딩 페이지로 분기.
 *
 * SSR-safe: href 는 PC 페이지로 고정 (hydration mismatch 없음).
 * 클릭 시 onClick 핸들러가 모바일이면 preventDefault + mobile.html 로 새 창 열기.
 */
export function LandingLinksRow() {
  const handleAboutClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window === 'undefined') return;
    // 모바일 width 기준 — useBreakpoint 와 동일 (< 640px)
    if (window.matchMedia('(max-width: 639px)').matches) {
      e.preventDefault();
      window.open('/landing/mobile.html', '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="text-center mb-6 flex items-center justify-center gap-3 text-xs">
      <a
        href="/landing/index.html"
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleAboutClick}
        className="text-white/70 hover:text-amber-400 transition-colors duration-150"
      >
        About TEAM WORKS
      </a>
      <span className="text-white/30">·</span>
      <a
        href="/landing/faq.html"
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/70 hover:text-amber-400 transition-colors duration-150"
      >
        FAQ
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
