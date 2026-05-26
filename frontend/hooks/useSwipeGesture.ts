'use client';

import { useRef } from 'react';

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  // 가로/세로 스와이프 판정에 필요한 최소 이동 거리 (px). 작은 터치 흔들림 무시.
  threshold?: number;
}

// 터치 기반 swipe 제스처 hook. 반환된 props 를 wrapper div 의 onTouchStart/End 에 연결.
// 가로 이동이 세로 이동보다 큰 경우만 left/right swipe 로 인식 → 수직 스크롤 방해 X.
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
}: UseSwipeGestureOptions) {
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    startX.current = t.clientX;
    startY.current = t.clientY;
    tracking.current = true;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!tracking.current) return;
    tracking.current = false;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // 가로 vs 세로 — 더 큰 방향이 우세. threshold 미만은 탭으로 처리되어 무시.
    if (absX > absY && absX >= threshold) {
      if (dx > 0) onSwipeRight?.();
      else onSwipeLeft?.();
    } else if (absY > absX && absY >= threshold) {
      if (dy > 0) onSwipeDown?.();
      else onSwipeUp?.();
    }
  };

  return { onTouchStart, onTouchEnd };
}
