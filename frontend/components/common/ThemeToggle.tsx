'use client';

import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={toggle}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className={`relative inline-flex h-5 w-8 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent
                  transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                  ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-md
                    transition-transform duration-200 ease-in-out
                    ${isDark ? 'translate-x-3.5' : 'translate-x-0'}`}
      />
    </button>
  );
}
