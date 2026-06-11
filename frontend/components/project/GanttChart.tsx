'use client';

import React from 'react';
import type { Project, ProjectSchedule } from '@/types/project';
import { GanttBar } from './GanttBar';
import {
  getProjectColumns,
  groupColumnsByMonth,
  getColumnIndex,
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
  // "주 ∩ 월" 세그먼트 컬럼 — 월 경계를 가로지르는 주는 두 컬럼으로 분리.
  // (6/28~30 = 6월 5주, 7/1~4 = 7월 1주 처럼 달력 그대로 표시)
  const columns = getProjectColumns(project.startDate, project.endDate);
  const monthGroups = groupColumnsByMonth(columns);

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
      <div style={{ minWidth: `${LABEL_W + columns.length * MIN_CELL_WIDTH}px` }}>

        {/* ── Month header row (sticky top-0) ────────────────────────── */}
        <div className="flex h-7 border-b border-gray-200 dark:border-dark-border sticky top-0 z-20 bg-white dark:bg-dark-base">
          {/* Top-left corner: sticky left too */}
          <div
            className="flex-none border-r border-gray-300 dark:border-dark-border bg-white dark:bg-dark-base sticky left-0 z-30"
            style={{ width: LABEL_W }}
          />
          {monthGroups.map((group) => (
            <div
              key={`${group.year}-${group.month}`}
              style={{ flex: group.weekIndices.length }}
              className="border-l-2 border-gray-500 dark:border-dark-border text-center text-xs font-semibold py-1 text-gray-700 dark:text-dark-text-muted overflow-hidden"
            >
              {group.month}월
            </div>
          ))}
        </div>

        {/* ── Week number header row (sticky top-7) ──────────────────── */}
        <div className="flex h-7 border-b border-gray-300 dark:border-dark-border sticky top-7 z-20 bg-white dark:bg-dark-base">
          {/* Label column spacer */}
          <div
            className="flex-none border-r border-gray-300 dark:border-dark-border bg-white dark:bg-dark-base sticky left-0 z-30 flex items-center justify-center"
            style={{ width: LABEL_W }}
          >
            <span className="text-xs text-gray-500 dark:text-dark-text-muted font-medium">단계</span>
          </div>
          {/* 각 컬럼 = 달력 주차(그 달 기준 몇 번째 주) */}
          {columns.map((col, i) => (
            <div
              key={i}
              style={{ flex: 1 }}
              className={`text-center text-xs text-gray-500 dark:text-dark-text-muted py-1 ${
                isMonthBoundary(monthGroups, i)
                  ? 'border-l-2 border-gray-500 dark:border-dark-border'
                  : 'border-l border-gray-200 dark:border-dark-border'
              }`}
            >
              {col.weekOfMonth}
            </div>
          ))}
        </div>

        {/* ── Phase rows ─────────────────────────────────────────────── */}
        {project.phases.map((phase, phaseIdx) => {
          const phaseSchedules = sortedByPhase.get(phase.id) ?? [];
          const totalCols = columns.length;
          const rowBg = phaseIdx % 2 === 0 ? 'bg-white dark:bg-dark-base' : 'bg-gray-50 dark:bg-dark-surface';

          return (
            <div
              key={phase.id ?? `phase-${phaseIdx}`}
              className={`flex border-b border-gray-200 dark:border-dark-border ${rowBg}`}
              style={{ minHeight: MIN_ROW_HEIGHT }}
            >
              {/* Phase label — sticky left */}
              <div
                className={`flex-none border-r border-gray-300 dark:border-dark-border sticky left-0 z-10 flex items-center justify-center px-2 ${rowBg}`}
                style={{ width: LABEL_W }}
              >
                <span className="text-xs text-gray-700 dark:text-dark-text-muted text-center break-words leading-tight line-clamp-3">
                  {phase.name}
                </span>
              </div>

              {/* Bars column */}
              <div className="flex-1 relative" style={{ minHeight: MIN_ROW_HEIGHT }}>
                {/* Background week cells */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {columns.map((_, wIdx) => (
                    <div
                      key={wIdx}
                      style={{ flex: 1 }}
                      className={
                        isMonthBoundary(monthGroups, wIdx)
                          ? 'border-l-2 border-gray-500 dark:border-dark-border'
                          : 'border-l border-gray-200 dark:border-dark-border'
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
                    const startIdx = getColumnIndex(columns, schedule.startDate);
                    const endIdx = getColumnIndex(columns, schedule.endDate);
                    const leftPct = (startIdx / totalCols) * 100;
                    const widthPct = ((endIdx - startIdx + 1) / totalCols) * 100;

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
