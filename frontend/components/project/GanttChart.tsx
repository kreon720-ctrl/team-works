'use client';

import React from 'react';
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

  const LABEL_W = 112; // px — left phase label column width (w-28)

  return (
    /* Single scroll container: both x and y */
    <div className="overflow-auto h-full">
      <div style={{ minWidth: `${LABEL_W + weeks.length * MIN_CELL_WIDTH}px` }}>

        {/* ── Month header row (sticky top-0) ────────────────────────── */}
        <div className="flex h-7 border-b border-gray-200 sticky top-0 z-20 bg-white">
          {/* Top-left corner: sticky left too */}
          <div
            className="flex-none border-r border-gray-300 bg-white sticky left-0 z-30"
            style={{ width: LABEL_W }}
          />
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

        {/* ── Week number header row (sticky top-7) ──────────────────── */}
        <div className="flex h-7 border-b border-gray-300 sticky top-7 z-20 bg-white">
          {/* Label column spacer */}
          <div
            className="flex-none border-r border-gray-300 bg-white sticky left-0 z-30 flex items-center justify-center"
            style={{ width: LABEL_W }}
          >
            <span className="text-xs text-gray-500 font-medium">단계</span>
          </div>
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

        {/* ── Phase rows ─────────────────────────────────────────────── */}
        {project.phases.map((phase, phaseIdx) => {
          const phaseSchedules = sortedByPhase.get(phase.id) ?? [];
          const totalWeeks = weeks.length;
          const rowBg = phaseIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

          return (
            <div
              key={phase.id}
              className={`flex border-b border-gray-200 ${rowBg}`}
              style={{ minHeight: MIN_ROW_HEIGHT }}
            >
              {/* Phase label — sticky left */}
              <div
                className={`flex-none border-r border-gray-300 sticky left-0 z-10 flex items-center justify-center px-2 ${rowBg}`}
                style={{ width: LABEL_W }}
              >
                <span className="text-xs text-gray-700 text-center break-words leading-tight line-clamp-3">
                  {phase.name}
                </span>
              </div>

              {/* Bars column */}
              <div className="flex-1 relative" style={{ minHeight: MIN_ROW_HEIGHT }}>
                {/* Background week cells */}
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

                {/* Gantt bars */}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
