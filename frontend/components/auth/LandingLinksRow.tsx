'use client';

/**
 * 로그인/회원가입 페이지 상단의 랜딩 링크 한 줄.
 * PC·모바일 통합: 모바일 디자인 랜딩 하나(index.html)로 운영.
 */
export function LandingLinksRow() {
  return (
    <div className="text-center mb-6 flex items-center justify-center gap-3 text-xs">
      <a
        href="/landing/index.html"
        target="_blank"
        rel="noopener noreferrer"
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
