'use client';

import React from 'react';
import {
  PlusSquare,
  Edit2,
  Trash2,
  Download,
  MessageCircle,
  ChevronDown,
  FileImage,
  Presentation,
} from 'lucide-react';
import { toSvg } from 'html-to-image';
import { getProjectWeeks, groupWeeksByMonth, getWeekIndex } from './ganttUtils';
import { useProjectStore } from '@/store/projectStore';
import type { Project } from '@/types/project';
import { GanttChart } from './GanttChart';
import { ProjectCreateModal } from './ProjectCreateModal';
import { ProjectScheduleModal } from './ProjectScheduleModal';
import { ProjectScheduleDetailModal } from './ProjectScheduleDetailModal';
import { useProjectActions } from './useProjectActions';
import { useScheduleActions } from './useScheduleActions';
import { useGanttModals } from './useGanttModals';

interface ProjectGanttViewProps {
  teamId: string;
  currentUserId: string;
  isLeader: boolean;
  // 모바일 전용 — [채팅] 버튼 클릭 시 호출. 부모(MobileLayout)가 chat 탭으로 전환 + projectId 세팅.
  onSwitchToChat?: (projectId: string) => void;
}

export function ProjectGanttView({ teamId, currentUserId, onSwitchToChat }: ProjectGanttViewProps) {
  const store = useProjectStore();

  const projects = store.getTeamProjects(teamId);
  const rawSelectedId = store.selectedProjectId;

  // If the selectedProjectId is not in this team's projects, fall back to first
  const selectedProject: Project | null =
    projects.find((p) => p.id === rawSelectedId) ?? projects[0] ?? null;

  // Load projects from API on mount / teamId change
  React.useEffect(() => {
    store.loadTeamProjects(teamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  // Load schedules when selected project changes
  React.useEffect(() => {
    if (selectedProject) {
      store.loadProjectSchedules(teamId, selectedProject.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id]);

  // Sync store if fallback differs from stored ID
  React.useEffect(() => {
    if (projects.length > 0 && rawSelectedId !== selectedProject?.id) {
      store.setSelectedProject(selectedProject?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const schedules = selectedProject
    ? store.getProjectSchedules(selectedProject.id)
    : [];

  const modals = useGanttModals();

  const projectActions = useProjectActions({
    teamId,
    selectedProject,
    onModalClose: modals.closeProjectModal,
  });

  const scheduleActions = useScheduleActions({
    teamId,
    selectedProject,
    onScheduleModalClose: modals.closeScheduleModal,
    onDetailModalClose: modals.closeDetailModal,
  });

  // Find phase name for detail modal
  const selectedSchedulePhaseName = modals.selectedSchedule && selectedProject
    ? selectedProject.phases.find((p) => p.id === modals.selectedSchedule!.phaseId)?.name
    : undefined;

  // 액션 버튼 그룹 — 모바일은 아주 작게 (패딩 거의 없음 + 작은 아이콘), 데스크탑은 기존.
  const actionButtons = (
    <div className="flex items-center gap-1.5 sm:gap-1.5 flex-none">
      <button
        type="button"
        onClick={modals.openCreateProject}
        title="프로젝트 생성"
        className="p-0 sm:p-1.5 rounded-lg text-gray-600 dark:text-dark-text-muted hover:bg-gray-100 dark:hover:bg-dark-elevated hover:text-gray-900 dark:hover:text-dark-text transition-colors"
      >
        <PlusSquare className="w-3 h-3 sm:w-5 sm:h-5" />
      </button>
      {selectedProject && (
        <button
          type="button"
          onClick={() => modals.openEditProject(selectedProject)}
          title="프로젝트 수정"
          className="p-0 sm:p-1.5 rounded-lg text-gray-600 dark:text-dark-text-muted hover:bg-gray-100 dark:hover:bg-dark-elevated hover:text-gray-900 dark:hover:text-dark-text transition-colors"
        >
          <Edit2 className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
        </button>
      )}
      {selectedProject && (
        <button
          type="button"
          onClick={projectActions.handleDeleteProject}
          title="프로젝트 삭제"
          className="p-0 sm:p-1.5 rounded-lg text-gray-600 dark:text-dark-text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
        </button>
      )}
    </div>
  );

  const addScheduleButton = (
    <button
      type="button"
      disabled={!selectedProject}
      onClick={async () => {
        await store.loadTeamProjects(teamId);
        modals.openCreateSchedule();
      }}
      className="px-1 py-0 sm:px-2 sm:py-1 rounded sm:rounded-lg bg-primary-500 text-white text-[10px] sm:text-xs font-medium hover:bg-primary-600 active:bg-primary-700 dark:bg-[#FFB800] dark:text-gray-900 dark:hover:bg-[#E6A600] dark:active:bg-[#CC9200] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-none"
    >
      +일정
    </button>
  );

  // 갠트 영역 ref — [저장] 버튼이 이 DOM 을 이미지로 변환해 다운로드.
  const ganttRef = React.useRef<HTMLDivElement | null>(null);
  const [saving, setSaving] = React.useState(false);
  // 저장 포맷 선택 드롭다운 상태.
  const [saveMenuOpen, setSaveMenuOpen] = React.useState(false);
  const saveWrapRef = React.useRef<HTMLDivElement | null>(null);

  // 드롭다운 바깥 클릭 시 닫기.
  React.useEffect(() => {
    if (!saveMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (saveWrapRef.current && !saveWrapRef.current.contains(e.target as Node)) {
        setSaveMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [saveMenuOpen]);

  // dark mode 배경색 — html-to-image 는 투명 배경이라 명시적 배경 필요.
  const ganttBgColor = () =>
    document.documentElement.classList.contains('dark') ? '#0f0f10' : '#ffffff';

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveSvg = async () => {
    if (!selectedProject || !ganttRef.current || saving) return;
    setSaving(true);
    try {
      const dataUrl = await toSvg(ganttRef.current, {
        backgroundColor: ganttBgColor(),
        pixelRatio: 2,
        cacheBust: true,
      });
      const blob = await (await fetch(dataUrl)).blob();
      const yyyy = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `${selectedProject.name}_${yyyy}.svg`);
    } catch (err) {
      console.error('갠트 차트 SVG 저장 실패:', err);
      alert('갠트 차트 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 데이터(Project·ProjectSchedule)를 pptxgenjs 네이티브 도형/텍스트로 재구성 —
  // PowerPoint 에서 막대·라벨·표를 개별 편집 가능. (DOM 비트맵 캡처 아님)
  // 화면 갠트와 동일 격자: ganttUtils 의 주(week) 계산 재사용.
  const handleSavePptx = async () => {
    if (!selectedProject || saving) return;
    setSaving(true);
    try {
      const project = selectedProject;
      const weeks = getProjectWeeks(project.startDate, project.endDate);
      const totalWeeks = Math.max(1, weeks.length);
      const monthGroups = groupWeeksByMonth(weeks);
      const phases = [...project.phases].sort((a, b) => a.order - b.order);

      // 화면 다크모드 막대색과 동일 계열(단색). amber 만 어두운 글자.
      const COLOR: Record<string, string> = {
        indigo: '6366F1',
        blue: '6366F1',
        emerald: '10B981',
        amber: 'FFB800',
        rose: 'EF4444',
      };
      const DELAYED = 'EF4444';
      const barTextColor = (c: string) => (c === 'amber' ? '363636' : 'FFFFFF');

      const { default: PptxGenJS } = await import('pptxgenjs');
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in (16:9)
      const slide = pptx.addSlide();

      const SLIDE_W = 13.333;
      const SLIDE_H = 7.5;
      const M = 0.3;
      const LABEL_W = 1.6;
      const titleH = 0.45;
      const headerH = 0.35;
      const chartX0 = M + LABEL_W;
      const chartW = SLIDE_W - M * 2 - LABEL_W;
      const gridTop = M + titleH + headerH;
      const availH = SLIDE_H - M - gridTop;
      const xForWeek = (i: number) => chartX0 + (i / totalWeeks) * chartW;

      // 제목 (편집 가능 텍스트)
      slide.addText(
        `${project.name}    ${project.startDate} ~ ${project.endDate}    (${project.progress}%)`,
        { x: M, y: M, w: SLIDE_W - M * 2, h: titleH, fontSize: 18, bold: true, color: '1F2937' },
      );

      // 월 헤더 (단계 라벨칸 + 월별 셀)
      slide.addText('단계', {
        x: M, y: M + titleH, w: LABEL_W, h: headerH, fontSize: 10, bold: true,
        align: 'center', valign: 'middle', color: '374151',
        fill: { color: 'F3F4F6' }, line: { color: 'D1D5DB', width: 0.5 },
      });
      for (const g of monthGroups) {
        const i0 = g.weekIndices[0];
        const i1 = g.weekIndices[g.weekIndices.length - 1] + 1;
        slide.addText(`${g.month}월`, {
          x: xForWeek(i0), y: M + titleH, w: xForWeek(i1) - xForWeek(i0), h: headerH,
          fontSize: 10, bold: true, align: 'center', valign: 'middle', color: '374151',
          fill: { color: 'F3F4F6' }, line: { color: 'D1D5DB', width: 0.5 },
        });
      }

      // 단계별 일정 목록 (startDate 오름차순) + 막대 수 기반 행 높이 산출
      const perPhase = phases.map((ph) =>
        schedules
          .filter((s) => s.phaseId === ph.id)
          .sort((a, b) => a.startDate.localeCompare(b.startDate)),
      );
      const totalBars = perPhase.reduce((n, arr) => n + Math.max(arr.length, 1), 0);
      const slot = availH / Math.max(totalBars, 1);
      const barH = Math.min(0.34, Math.max(0.16, slot * 0.72));
      const gap = Math.max(0.04, slot * 0.16);

      let y = gridTop;
      phases.forEach((ph, pi) => {
        const list = perPhase[pi];
        const rows = Math.max(list.length, 1);
        const rowH = rows * (barH + gap) + gap;
        // 행 배경 (교대색) — 도형
        slide.addShape(pptx.ShapeType.rect, {
          x: M, y, w: SLIDE_W - M * 2, h: rowH,
          fill: { color: pi % 2 ? 'FFFFFF' : 'F9FAFB' },
          line: { color: 'E5E7EB', width: 0.5 },
        });
        // 단계 라벨 (편집 가능 텍스트)
        slide.addText(ph.name, {
          x: M, y, w: LABEL_W, h: rowH, fontSize: 10, bold: true,
          align: 'center', valign: 'middle', color: '374151',
        });
        // 일정 막대 — 각각 개별 도형(이동·색변경 가능) + 진행률 오버레이 + 라벨 텍스트
        list.forEach((s, bi) => {
          const startIdx = getWeekIndex(weeks, s.startDate, 'start');
          const endIdx = getWeekIndex(weeks, s.endDate, 'end');
          const bx = xForWeek(startIdx);
          const bw = Math.max(0.15, xForWeek(endIdx + 1) - bx);
          const by = y + gap + bi * (barH + gap);
          const fill = s.isDelayed ? DELAYED : COLOR[s.color] ?? COLOR.indigo;
          slide.addShape(pptx.ShapeType.roundRect, {
            x: bx, y: by, w: bw, h: barH, rectRadius: 0.03,
            fill: { color: fill }, line: { color: fill, width: 0.5 },
          });
          if (s.progress > 0) {
            slide.addShape(pptx.ShapeType.rect, {
              x: bx, y: by,
              w: Math.max(0.02, bw * (Math.min(100, s.progress) / 100)), h: barH,
              fill: { color: 'FFFFFF', transparency: 70 },
              line: { width: 0 },
            });
          }
          slide.addText(
            `${s.title} (${s.startDate.slice(5)}~${s.endDate.slice(5)})`,
            {
              x: bx, y: by, w: bw, h: barH, fontSize: 8,
              align: 'center', valign: 'middle', color: barTextColor(s.color),
            },
          );
        });
        y += rowH;
      });

      const yyyy = new Date().toISOString().slice(0, 10);
      await pptx.writeFile({ fileName: `${project.name}_${yyyy}.pptx` });
    } catch (err) {
      console.error('갠트 차트 PPTX 저장 실패:', err);
      alert('갠트 차트 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <div ref={saveWrapRef} className="relative flex-none">
      <button
        type="button"
        disabled={!selectedProject || saving}
        onClick={() => setSaveMenuOpen((o) => !o)}
        title="현재 갠트 차트를 파일로 저장"
        className="inline-flex items-center gap-1 px-1 py-0 sm:px-2 sm:py-1 rounded sm:rounded-lg border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text-muted text-[10px] sm:text-xs font-medium hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        저장
        <ChevronDown className="w-3 h-3" />
      </button>
      {saveMenuOpen && (
        <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-lg overflow-hidden">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setSaveMenuOpen(false);
              handleSaveSvg();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-dark-text-muted hover:bg-gray-50 dark:hover:bg-dark-elevated transition-colors disabled:opacity-40"
          >
            <FileImage className="w-3.5 h-3.5" />
            그래픽 (SVG)
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setSaveMenuOpen(false);
              handleSavePptx();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-dark-text-muted hover:bg-gray-50 dark:hover:bg-dark-elevated transition-colors disabled:opacity-40 border-t border-gray-100 dark:border-dark-border"
          >
            <Presentation className="w-3.5 h-3.5" />
            파워포인트 (PPTX)
          </button>
        </div>
      )}
    </div>
  );

  // 모바일 전용 — 프로젝트 채팅으로 이동하는 버튼
  const chatButton = onSwitchToChat ? (
    <button
      type="button"
      disabled={!selectedProject}
      onClick={() => selectedProject && onSwitchToChat(selectedProject.id)}
      title="이 프로젝트의 채팅으로 이동"
      className="inline-flex items-center gap-1 px-1 py-0 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text-muted text-[10px] font-medium hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-none"
    >
      <MessageCircle className="w-3 h-3" />
      채팅
    </button>
  ) : null;

  // 프로젝트 메타 (이름 · 기간 · 진행률) — 데스크탑 헤더 중앙 / 모바일 2번째 줄에 사용.
  const projectMeta = selectedProject ? (
    <>
      <span className="text-sm text-gray-400 dark:text-dark-text-muted whitespace-nowrap">
        {selectedProject.name}
      </span>
      <span className="text-xs text-gray-400 dark:text-dark-text-muted whitespace-nowrap">
        {selectedProject.startDate} ~ {selectedProject.endDate}
      </span>
      <span className="text-xs text-gray-400 dark:text-dark-text-muted">
        ({selectedProject.progress}%)
      </span>
    </>
  ) : null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-base">
      {/* Header toolbar — 데스크탑(sm 이상) 은 1줄, 모바일은 2줄 (액션바 / 프로젝트 메타) 로 분리.
          사용자 요구: 모바일에서 액션바를 탭 바로 아래 2번째 줄에 위치. */}
      <div className="hidden sm:flex items-center px-4 py-2 border-b border-gray-200 dark:border-dark-border flex-none">
        {actionButtons}
        <div className="flex-1 flex items-center justify-center gap-1.5">
          {projectMeta}
        </div>
        <div className="flex-none flex items-center gap-1.5">
          {addScheduleButton}
          {saveButton}
        </div>
      </div>

      {/* 모바일 헤더 — 1행: 액션바.
          2행: 프로젝트 탭바 (가로 스크롤). 프로젝트가 여러 건이면 가로로 나열,
          선택된 탭만 강조. 기간/진행률은 제거(공간 절약). */}
      <div className="sm:hidden flex flex-col border-b border-gray-200 dark:border-dark-border flex-none">
        <div className="flex items-center justify-between px-2 py-0.5">
          {actionButtons}
          <div className="flex items-center gap-1">
            {addScheduleButton}
            {chatButton}
          </div>
        </div>
        {projects.length > 0 && (
          <div className="flex items-end overflow-x-auto whitespace-nowrap border-t border-gray-100 dark:border-dark-border">
            {projects.map((p) => {
              const isSelected = selectedProject?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => store.setSelectedProject(p.id)}
                  className={`flex-none px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                    isSelected
                      ? 'text-primary-600 border-primary-500 dark:text-dark-accent dark:border-dark-accent'
                      : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-dark-text-muted'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Gantt chart or empty state — ref 는 [저장] 버튼이 SVG 변환 대상으로 사용 */}
      <div ref={ganttRef} className="flex-1 overflow-hidden">
        {selectedProject ? (
          <GanttChart
            project={selectedProject}
            schedules={schedules}
            currentUserId={currentUserId}
            onBarClick={modals.openDetailModal}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 dark:bg-dark-base">
            <svg className="w-12 h-12 text-gray-300 dark:text-dark-text-disabled" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
            <p className="text-sm text-gray-400 dark:text-dark-text-muted">
              프로젝트를 생성하세요. 좌측 상단의{' '}
              <PlusSquare className="inline w-4 h-4 text-gray-500" /> 아이콘을 클릭하세요.
            </p>
          </div>
        )}
      </div>

      {/* Project create/edit modal */}
      {modals.showProjectModal && (
        <ProjectCreateModal
          mode={modals.editingProject ? 'edit' : 'create'}
          project={modals.editingProject}
          onSubmit={modals.editingProject
            ? (input) => projectActions.handleUpdateProject(modals.editingProject!, input)
            : projectActions.handleCreateProject
          }
          onCancel={modals.closeProjectModal}
        />
      )}

      {/* Schedule create/edit modal */}
      {modals.showScheduleModal && selectedProject && (
        <ProjectScheduleModal
          mode={modals.editingSchedule ? 'edit' : 'create'}
          project={selectedProject}
          schedule={modals.editingSchedule}
          teamId={teamId}
          onSubmit={modals.editingSchedule
            ? (input) => scheduleActions.handleUpdateSchedule(modals.editingSchedule!, input)
            : scheduleActions.handleCreateSchedule
          }
          onCancel={modals.closeScheduleModal}
        />
      )}

      {/* Schedule detail modal */}
      <ProjectScheduleDetailModal
        isOpen={modals.showDetailModal}
        schedule={modals.selectedSchedule}
        teamId={teamId}
        currentUserId={currentUserId}
        phaseName={selectedSchedulePhaseName}
        onClose={modals.closeDetailModal}
        onEdit={modals.openEditSchedule}
        onDelete={scheduleActions.handleDeleteSchedule}
      />
    </div>
  );
}
