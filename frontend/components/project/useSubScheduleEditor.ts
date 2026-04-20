'use client';

import { useState, useEffect } from 'react';
import { useSubScheduleStore } from '@/store/subScheduleStore';
import type { ProjectSchedule, SubSchedule, SubScheduleCreateInput } from '@/types/project';

interface UseSubScheduleEditorOptions {
  schedule: ProjectSchedule;
  teamId: string;
  currentUserId: string;
}

export function useSubScheduleEditor({ schedule, teamId, currentUserId: _currentUserId }: UseSubScheduleEditorOptions) {
  const { getSubSchedules, loadSubSchedules, createSubSchedule, updateSubSchedule, deleteSubSchedule } =
    useSubScheduleStore();

  const subSchedules = getSubSchedules(schedule.id);

  const [showCreate, setShowCreate] = useState(false);
  const [editingSub, setEditingSub] = useState<SubSchedule | null>(null);
  const [viewingSub, setViewingSub] = useState<SubSchedule | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSubSchedules(teamId, schedule.projectId, schedule.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.id]);

  const handleCreateSub = async (input: SubScheduleCreateInput) => {
    setLoading(true);
    try {
      await createSubSchedule(teamId, schedule.projectId, schedule.id, input);
      setShowCreate(false);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSub = async (input: SubScheduleCreateInput) => {
    if (!editingSub) return;
    setLoading(true);
    try {
      await updateSubSchedule(teamId, schedule.projectId, schedule.id, editingSub.id, input);
      setEditingSub(null);
      setShowCreate(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSub = async (sub: SubSchedule) => {
    setLoading(true);
    try {
      await deleteSubSchedule(teamId, schedule.projectId, schedule.id, sub.id);
      setViewingSub(null);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingSub(null);
    setShowCreate(true);
  };

  const openEdit = (sub: SubSchedule) => {
    setEditingSub(sub);
    setViewingSub(null);
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setEditingSub(null);
  };

  return {
    subSchedules,
    showCreate,
    editingSub,
    viewingSub,
    loading,
    setViewingSub,
    handleCreateSub,
    handleUpdateSub,
    handleDeleteSub,
    openCreate,
    openEdit,
    closeCreate,
  };
}
