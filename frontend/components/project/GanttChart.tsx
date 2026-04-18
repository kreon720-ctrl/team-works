'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { Project, ProjectSchedule } from '@/types/project';
import { GanttBar } from './GanttBar';
import {
  getProjectWeeks,
  groupWeeksByMonth,
  getWeekOfMonth,
  getWeekIndex,
  isMonthBoundary,
} from './ganttUtils';

const MIN_CELL_WIDTH = 40; // px per week (minimum)
const MIN_ROW_HEIGHT = 44; // px — minimum row height
const BAR_GAP = 4;         // px between stacked bars
const ROW_PADDING = 8;     // px top/bottom padding inside row

interface GanttChartProps {
  project: Project;
  schedules: ProjectSchedule[];
  currentUserId: string;
  onBarClick: (schedule: ProjectSchedule) => void;
}

export function GanttChart({ project, schedules, onBarClick }: GanttChartProps) {
  const weeks = getProjectWeeks(project.startDate, project.endDate);
  const monthGroups = groupWeeksByMonth(weeks);

  // Pre-sort schedules per phase by startDate (ascending)
  const sortedByPhase = new Map<string, ProjectSchedule[]>();
  for (const phase of project.phases) {
    const phaseSchedules = schedules
      .filter((s) => s.phaseId === phase.id)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    sortedByPhase.set(phase.id, phaseSchedules);
  }

  // ResizeObserver: right-panel row heights → sync to left-panel label heights
  const barRowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [rowHeights, setRowHeights] = useState<number[]>(
    () => project.phases.map(() => MIN_ROW_HEIGHT)
  );

  useEffect(() => {
    const observers: ResizeObserver[] = [];
    project.phases.forEach((_, idx) => {
      const el = barRowRefs.current[idx];
      if (!el) return;
      const ro = new ResizeObserver(() => {
        setRowHeights(prev => {
          const next = [...prev];
          const h = el.getBoundingClientRect().height;
          if (next[idx] !== h) {
            next[idx] = h;
            return [...next];
          }
          return prev;
        });
      });
      ro.observe(el);
      observers.push(ro);
    });
    return () => observers.forEach(ro => ro.disconnect());
  }, [project.phases.length]);

  return (
    <div className="flex overflow-hidden h-full">
      {/* Left: Phase labels (sticky) */}
      <div className="flex-none w-28 border-r border-gray-300 bg-white z-10 overflow-y-auto">
        {/* Header spacer */}
        <div className="h-14 border-b border-gray-300 flex items-center justify-center flex-none">
          <span className="text-xs text-gray-500 font-medium">단계</span>
        </div>

        {/* Phase rows — height synced from right panel via ResizeObserver */}
        {project.phases.map((phase, idx) => (
          <div
            key={phase.id}
            className={`flex items-center justify-center border-b border-gray-200 px-2 ${
              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            }`}
            style={{ height: rowHeights[idx] ?? MIN_ROW_HEIGHT }}
          >
            <span className="text-xs text-gray-700 text-center break-words leading-tight line-clamp-3">
              {phase.name}
            </span>
          </div>
        ))}
      </div>

      {/* Right: Scrollable Gantt content */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <div style={{ minWidth: `${weeks.length * MIN_CELL_WIDTH}px` }}>
          {/* Month header row */}
          <div className="flex h-7 border-b border-gray-200 sticky top-0 bg-white z-10">
            {monthGroups.map((group) => (
              <div
                key={`${group.year}-${group.month}`}
                style={{ flex: group.weeks.length }}
                className="border-l-2 border-gray-500 text-center text-xs font-semibold py-1 text-gray-700 overflow-hidden"
              >
                {group.month}월
              </div>
            ))}
          </div>

          {/* Week number header row */}
          <div className="flex h-7 border-b border-gray-300 sticky top-7 bg-white z-10">
            {weeks.map((week, i) => (
              <div
                key={i}
                style={{ flex: 1 }}
                className={`text-center text-xs text-gray-500 py-1 ${
                  isMonthBoundary(monthGroups, i)
                    ? 'border-l-2 border-gray-500'
                    : 'border-l border-gray-200'
                }`}
              >
                {getWeekOfMonth(week)}
              </div>
            ))}
          </div>

          {/* Phase rows with bars */}
          {project.phases.map((phase, phaseIdx) => {
            const phaseSchedules = sortedByPhase.get(phase.id) ?? [];
            const totalWeeks = weeks.length;

            return (
              <div
                key={phase.id}
                ref={el => { barRowRefs.current[phaseIdx] = el; }}
                className={`relative border-b border-gray-200 ${
                  phaseIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
                style={{ minHeight: MIN_ROW_HEIGHT }}
              >
                {/* Background week cells — absolute, fills full row */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {weeks.map((_, wIdx) => (
                    <div
                      key={wIdx}
                      style={{ flex: 1 }}
                      className={
                        isMonthBoundary(monthGroups, wIdx)
                          ? 'border-l-2 border-gray-500'
                          : 'border-l border-gray-200'
                      }
                    />
                  ))}
                </div>

                {/* Gantt bars — flex column, each bar uses marginLeft for horizontal position */}
                <div
                  className="relative z-10 flex flex-col"
                  style={{ padding: `${ROW_PADDING}px 0`, gap: BAR_GAP }}
                >
                  {phaseSchedules.map((schedule) => {
                    const startIdx = getWeekIndex(weeks, schedule.startDate, 'start');
                    const endIdx = getWeekIndex(weeks, schedule.endDate, 'end');
                    const leftPct = (startIdx / totalWeeks) * 100;
                    const widthPct = ((endIdx - startIdx + 1) / totalWeeks) * 100;

                    return (
                      <div
                        key={schedule.id}
                        style={{
                          marginLeft: `${leftPct}%`,
                          width: `${widthPct}%`,
                          paddingLeft: 2,
                          paddingRight: 2,
                        }}
                      >
                        <GanttBar
                          schedule={schedule}
                          onClick={() => onBarClick(schedule)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
