'use client';

import { useState } from 'react';
import { useCreateSchedule, useUpdateSchedule, useDeleteSchedule } from '@/hooks/query/useSchedules';
import type { CalendarSyncResult, Schedule, ScheduleCreateInput, ScheduleUpdateInput } from '@/types/schedule';

interface UseScheduleActionsOptions {
  teamId: string;
  selectedDate: string;
}

export function useScheduleActions({ teamId, selectedDate }: UseScheduleActionsOptions) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [scheduleDefaultDate, setScheduleDefaultDate] = useState<string>('');
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [lastCalendarSync, setLastCalendarSync] = useState<CalendarSyncResult | null>(null);

  const createSchedule = useCreateSchedule(teamId);
  const updateSchedule = useUpdateSchedule(teamId, selectedSchedule?.id ?? '');
  const deleteSchedule = useDeleteSchedule(teamId);

  const handleCreateSchedule = (defaultDate?: string) => {
    setScheduleDefaultDate(defaultDate || selectedDate);
    setShowCreateModal(true);
  };

  const handleScheduleClick = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setShowDetailModal(true);
  };

  const handleCreateSubmit = async (data: ScheduleCreateInput | ScheduleUpdateInput) => {
    try {
      const schedule = await createSchedule.mutateAsync(data as ScheduleCreateInput);
      setLastCalendarSync(schedule.calendarSync ?? null);
      setShowCreateModal(false);
    } catch { /* ScheduleForm에서 error prop으로 표시 */ }
  };

  const handleEditSubmit = async (data: ScheduleCreateInput | ScheduleUpdateInput) => {
    try {
      const schedule = await updateSchedule.mutateAsync(data as ScheduleUpdateInput);
      setLastCalendarSync(schedule.calendarSync ?? null);
      setShowEditModal(false);
      setSelectedSchedule(null);
    } catch { /* ScheduleForm에서 error prop으로 표시 */ }
  };

  const handleDelete = async () => {
    if (!selectedSchedule) return;
    try {
      const result = await deleteSchedule.mutateAsync(selectedSchedule.id);
      setLastCalendarSync(result?.calendarSync ?? null);
      setShowDetailModal(false);
      setSelectedSchedule(null);
    } catch { /* 삭제 실패 */ }
  };

  return {
    showCreateModal,
    showEditModal,
    showDetailModal,
    scheduleDefaultDate,
    selectedSchedule,
    lastCalendarSync,
    setLastCalendarSync,
    setShowCreateModal,
    setShowEditModal,
    setShowDetailModal,
    setSelectedSchedule,
    handleCreateSchedule,
    handleScheduleClick,
    handleCreateSubmit,
    handleEditSubmit,
    handleDelete,
    createSchedule,
    updateSchedule,
    deleteSchedule,
  };
}
