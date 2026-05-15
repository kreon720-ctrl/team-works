'use client';

import React from 'react';
import type { ProjectSchedule, GanttBarColor } from '@/types/project';
import { useAuthStore } from '@/store/authStore';
import { SubScheduleCreateModal } from './SubScheduleCreateModal';
import { SubScheduleDetailPopup } from './SubScheduleDetailPopup';
import { SubScheduleTimeline } from './SubScheduleTimeline';
import { useSubScheduleEditor } from './useSubScheduleEditor';

// ── 색상 정의 ──
const GANTT_COLOR_DISPLAY: Record<GanttBarColor, { bg: string; border: string; label: string }> = {
  indigo:  { bg: '#c7d2fe', border: '#6366f1', label: '인디고' },
  blue:    { bg: '#bfdbfe', border: '#3b82f6', label: '파랑' },
  emerald: { bg: '#a7f3d0', border: '#10b981', label: '에메랄드' },
  amber:   { bg: '#fde68a', border: '#f59e0b', label: '황금' },
  rose:    { bg: '#fecdd3', border: '#f43f5e', label: '로즈' },
};

// ── Props ──
interface ProjectScheduleDetailModalProps {
  isOpen: boolean;
  schedule: ProjectSchedule | null;
  teamId: string;
  currentUserId: string;
  phaseName?: string;
  onClose: () => void;
  onEdit: (schedule: ProjectSchedule) => void;
  onDelete: (schedule: ProjectSchedule) => void;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-100 dark:border-dark-border last:border-b-0">
      <span className="w-24 flex-none text-xs font-medium text-gray-500 dark:text-dark-text-muted pt-0.5">{label}</span>
      <span className="flex-1 text-sm text-gray-800 dark:text-dark-text">{value}</span>
    </div>
  );
}

// ── Main Modal ──
export function ProjectScheduleDetailModal({
  isOpen,
  schedule,
  teamId,
  currentUserId,
  phaseName,
  onClose,
  onEdit,
  onDelete,
}: ProjectScheduleDetailModalProps) {
  if (!isOpen || !schedule) return null;
  return (
    <ProjectScheduleDetailModalBody
      schedule={schedule}
      teamId={teamId}
      currentUserId={currentUserId}
      phaseName={phaseName}
      onClose={onClose}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

interface ProjectScheduleDetailModalBodyProps {
  schedule: ProjectSchedule;
  teamId: string;
  currentUserId: string;
  phaseName?: string;
  onClose: () => void;
  onEdit: (schedule: ProjectSchedule) => void;
  onDelete: (schedule: ProjectSchedule) => void;
}

function ProjectScheduleDetailModalBody({
  schedule,
  teamId,
  currentUserId,
  phaseName,
  onClose,
  onEdit,
  onDelete,
}: ProjectScheduleDetailModalBodyProps) {
  const currentUserName = useAuthStore(s => s.currentUser?.name ?? '');

  const {
    subSchedules,
    showCreate,
    editingSub,
    viewingSub,
    setViewingSub,
    handleCreateSub,
    handleUpdateSub,
    handleDeleteSub,
    openCreate,
    openEdit,
    closeCreate,
  } = useSubScheduleEditor({ schedule, teamId, currentUserId });

  const isOwner   = schedule.createdBy === currentUserId;
  const colorInfo = GANTT_COLOR_DISPLAY[schedule.color] ?? GANTT_COLOR_DISPLAY.indigo;

  const handleDeleteSchedule = () => {
    if (confirm('이 일정을 삭제하시겠습니까?')) onDelete(schedule);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 px-4 py-4 sm:py-0">
        {/* 모바일: 본문이 세로로 쌓이므로 높이 키움. svh 사용 — 안드로이드 크롬에서
            vh 가 주소창 영역까지 포함해 모달이 화면 밖으로 잘리던 문제 차단.
            데스크탑: 좌우 분할이라 63vh 유지. */}
        <div className="w-[90vw] max-w-5xl bg-white dark:bg-dark-elevated dark:border dark:border-dark-border rounded-2xl shadow-xl flex flex-col h-[80svh] sm:h-[63vh] max-h-full overflow-x-hidden">

          {/* 타이틀 */}
          <div className="flex items-start justify-between px-6 pt-5 pb-0 flex-none">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex-none"
                style={{ backgroundColor: colorInfo.bg, border: `2px solid ${colorInfo.border}` }} />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text leading-snug">{schedule.title}</h2>
            </div>
            <button type="button" onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-surface transition-colors flex-none ml-2" aria-label="닫기">
              <svg className="w-5 h-5 text-gray-500 dark:text-dark-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 본문 — 모바일: 세로 (상세 위 / 타임라인 아래), 데스크탑: 가로 (좌 상세 / 우 타임라인).
              모바일은 mt/pb 를 더 타이트하게 — footer 가 갠트와 겹쳐 보이는 문제 해소. */}
          <div className="flex flex-col sm:flex-row flex-1 min-h-0 mt-2 sm:mt-4">

            {/* 좌측(데스크탑) / 위(모바일): 상세 정보.
                모바일에선 max-h-[45%] 로 제한 — 안 그러면 DetailRow 가 많아 좌측 패널이
                본문 전체를 차지해 SubScheduleTimeline 이 footer 영역을 침범. */}
            <div className="w-full sm:w-72 flex-none flex flex-col px-6 pb-2 sm:pb-5 max-h-[45%] sm:max-h-none min-h-0">
              <div className="flex-1 overflow-y-auto min-h-0">
                <DetailRow label="기간" value={`${schedule.startDate} ~ ${schedule.endDate}`} />
                {phaseName && <DetailRow label="단계" value={phaseName} />}
                <DetailRow
                  label="진행률"
                  value={
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-dark-surface rounded-full h-2 max-w-[120px]">
                        <div className="h-2 rounded-full"
                          style={{ width: `${schedule.progress}%`, backgroundColor: colorInfo.border }} />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-dark-text">
                        {schedule.progress}%
                        {schedule.isDelayed && <span className="ml-1 text-red-500 text-xs">(지연)</span>}
                      </span>
                    </div>
                  }
                />
                {schedule.leader && <DetailRow label="일정 담당자" value={schedule.leader} />}
                {schedule.description && (
                  <DetailRow label="설명"
                    value={<span className="whitespace-pre-wrap text-sm text-gray-700 dark:text-dark-text">{schedule.description}</span>} />
                )}
                <DetailRow
                  label="색상"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: colorInfo.bg, border: `1.5px solid ${colorInfo.border}` }} />
                      {colorInfo.label}
                    </span>
                  }
                />
                <DetailRow label="등록일" value={new Date(schedule.createdAt).toLocaleDateString('ko-KR')} />
              </div>
            </div>

            {/* 구분선 — 모바일: 가로 한 줄, 데스크탑: 세로 한 줄 */}
            <div className="h-px w-full sm:h-auto sm:w-px bg-gray-200 dark:bg-dark-border flex-none sm:my-2" />

            {/* 우측: 타임라인 */}
            <SubScheduleTimeline
              scheduleStartDate={schedule.startDate}
              scheduleEndDate={schedule.endDate}
              subSchedules={subSchedules}
              onSubClick={setViewingSub}
              onAddClick={openCreate}
            />
          </div>

          {/* 모달 하단 footer — 수정·삭제·닫기 버튼 (갠트 차트 아래).
              relative z-20 + shadow-[0_-2px_4px] 로 갠트가 z 축으로 침범해도 footer 가 위에 보이고
              위쪽 그림자로 시각적 분리. */}
          <div className="relative z-20 flex-none border-t border-gray-200 dark:border-dark-border px-6 py-1.5 sm:py-3 bg-white dark:bg-dark-elevated shadow-[0_-2px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_-2px_4px_rgba(0,0,0,0.4)]">
            <div className="flex gap-1.5 max-w-[70%] mx-auto w-full">
              {isOwner ? (
                <>
                  <button type="button" onClick={() => onEdit(schedule)}
                    className="flex-1 py-1 bg-primary-500 text-white text-xs font-medium rounded-md hover:bg-primary-600 dark:bg-[#FFB800] dark:text-gray-900 dark:hover:bg-[#E6A600] transition-colors">
                    수정
                  </button>
                  <button type="button" onClick={handleDeleteSchedule}
                    className="flex-1 py-1 bg-red-500 text-white text-xs font-medium rounded-md hover:bg-red-600 transition-colors">
                    삭제
                  </button>
                  <button type="button" onClick={onClose}
                    className="flex-1 py-1 bg-gray-100 dark:bg-dark-surface text-gray-700 dark:text-dark-text-muted text-xs font-medium rounded-md hover:bg-gray-200 dark:hover:bg-dark-elevated transition-colors">
                    닫기
                  </button>
                </>
              ) : (
                <button type="button" onClick={onClose}
                  className="flex-1 py-1 bg-gray-100 dark:bg-dark-surface text-gray-700 dark:text-dark-text-muted text-xs font-medium rounded-md hover:bg-gray-200 dark:hover:bg-dark-elevated transition-colors">
                  닫기
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 세부일정 생성/수정 모달 */}
      {showCreate && (
        <SubScheduleCreateModal
          mode={editingSub ? 'edit' : 'create'}
          parentSchedule={schedule}
          subSchedule={editingSub}
          currentUserName={currentUserName}
          teamId={teamId}
          onSubmit={editingSub ? handleUpdateSub : handleCreateSub}
          onCancel={closeCreate}
        />
      )}

      {/* 세부일정 상세 팝업 */}
      {viewingSub && (
        <SubScheduleDetailPopup
          sub={viewingSub}
          isOwner={viewingSub.createdBy === currentUserId}
          onEdit={() => openEdit(viewingSub)}
          onDelete={() => handleDeleteSub(viewingSub)}
          onClose={() => setViewingSub(null)}
        />
      )}
    </>
  );
}
