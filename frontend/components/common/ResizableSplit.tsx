'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
  orientation?: 'horizontal' | 'vertical';
}

export function ResizableSplit({
  left,
  right,
  initialLeftPercent = 60,
  minLeftPercent = 25,
  maxLeftPercent = 80,
  orientation = 'horizontal',
}: ResizableSplitProps) {
  const [leftPercent, setLeftPercent] = useState(initialLeftPercent);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const isVertical = orientation === 'vertical';

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = isVertical ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  }, [isVertical]);

  const onTouchStart = useCallback(() => {
    dragging.current = true;
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const computePct = (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return isVertical
        ? ((clientY - rect.top) / rect.height) * 100
        : ((clientX - rect.left) / rect.width) * 100;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const pct = computePct(e.clientX, e.clientY);
      if (pct === null) return;
      setLeftPercent(Math.min(maxLeftPercent, Math.max(minLeftPercent, pct)));
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current) return;
      const t = e.touches[0];
      if (!t) return;
      const pct = computePct(t.clientX, t.clientY);
      if (pct === null) return;
      setLeftPercent(Math.min(maxLeftPercent, Math.max(minLeftPercent, pct)));
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [minLeftPercent, maxLeftPercent, isVertical]);

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex overflow-hidden ${isVertical ? 'flex-col' : 'flex-row'}`}
    >
      {/* First panel (left or top) */}
      <div
        className="overflow-hidden flex flex-col"
        style={isVertical ? { height: `${leftPercent}%` } : { width: `${leftPercent}%` }}
      >
        {left}
      </div>

      {/* Divider */}
      <div
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        className={`${isVertical ? 'h-1 cursor-row-resize' : 'w-1 cursor-col-resize'} flex-shrink-0 bg-gray-200 dark:bg-dark-border hover:bg-primary-400 dark:hover:bg-dark-accent active:bg-primary-500 dark:active:bg-dark-accent-strong transition-colors duration-150 relative group`}
      >
        {/* 드래그 hit-area 확장 */}
        <div className={`absolute ${isVertical ? 'inset-x-0 -top-1 -bottom-1' : 'inset-y-0 -left-1 -right-1'}`} />
        {/* 핸들 indicator */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex ${isVertical ? 'flex-row' : 'flex-col'} gap-0.5 opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none`}>
          <div className={`${isVertical ? 'h-0.5 w-3' : 'w-0.5 h-3'} bg-gray-500 dark:bg-dark-text-muted rounded-full`} />
          <div className={`${isVertical ? 'h-0.5 w-3' : 'w-0.5 h-3'} bg-gray-500 dark:bg-dark-text-muted rounded-full`} />
          <div className={`${isVertical ? 'h-0.5 w-3' : 'w-0.5 h-3'} bg-gray-500 dark:bg-dark-text-muted rounded-full`} />
        </div>
      </div>

      {/* Second panel (right or bottom) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {right}
      </div>
    </div>
  );
}
