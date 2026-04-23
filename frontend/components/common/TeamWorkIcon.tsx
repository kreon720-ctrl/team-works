interface TeamWorkIconProps {
  className?: string;
}

export function TeamWorkIcon({ className = '' }: TeamWorkIconProps) {
  return (
    <svg
      viewBox="0 0 108 90"
      fill="none"
      stroke="currentColor"
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* 왼쪽 인물 — 머리 */}
      <circle cx="20" cy="15" r="7.5" />
      {/* 왼쪽 — 몸통 (오른쪽으로 기울어짐) */}
      <path d="M24 22 C28 33 33 40 38 47" />
      {/* 왼쪽 — 오른팔 (중앙 접촉 지점으로 뻗음) */}
      <path d="M28 31 C36 24 44 26 50 30" />
      {/* 왼쪽 — 왼발 */}
      <path d="M35 51 C26 61 18 66 14 75" />
      {/* 왼쪽 — 오른발 */}
      <path d="M38 52 C37 62 36 67 34 75" />

      {/* 중앙 충격 스파크 */}
      <path d="M53 23 L56 18" />
      <path d="M57 26 L61 21" />

      {/* 오른쪽 인물 — 머리 (C자형 프로필) */}
      <path d="M90 10 C98 13 98 25 90 28" />
      {/* 오른쪽 — 몸통 (왼쪽으로 기울어짐) */}
      <path d="M86 26 C81 36 76 43 70 48" />
      {/* 오른쪽 — 왼팔 (중앙 접촉 지점으로 뻗음) */}
      <path d="M82 33 C74 26 65 27 58 31" />
      {/* 오른쪽 — 오른발 */}
      <path d="M72 52 C80 62 87 67 91 75" />
      {/* 오른쪽 — 왼발 */}
      <path d="M68 51 C68 62 70 67 72 75" />
    </svg>
  );
}
