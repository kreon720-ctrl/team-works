// 인증 레이아웃 — 로그인·회원가입 공용
// 라이트/다크 모드 구분 없이 항상 다크 톤으로 통일.
// 배경: /imgs/login.mp4 (기존 8MB GIF → 398KB MP4 로 경량화). 가독성은 카드 자체의 frosted glass 로 확보.

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* 배경 영상 — 풀스크린 cover, 오버레이 없이 그대로 노출 (자동재생·무음·반복) */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="/imgs/login.mp4"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      />

      {/* 폼 카드 영역 */}
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
