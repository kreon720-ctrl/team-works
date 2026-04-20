// Sub-Schedule Store - re-exports sub-schedule actions from the unified project store.
// The underlying state lives in projectStore.ts.

import { useProjectStore } from './projectStore';

export function useSubScheduleStore() {
  const getSubSchedules = useProjectStore((s) => s.getSubSchedules);
  const loadSubSchedules = useProjectStore((s) => s.loadSubSchedules);
  const createSubSchedule = useProjectStore((s) => s.createSubSchedule);
  const updateSubSchedule = useProjectStore((s) => s.updateSubSchedule);
  const deleteSubSchedule = useProjectStore((s) => s.deleteSubSchedule);

  return {
    getSubSchedules,
    loadSubSchedules,
    createSubSchedule,
    updateSubSchedule,
    deleteSubSchedule,
  };
}
