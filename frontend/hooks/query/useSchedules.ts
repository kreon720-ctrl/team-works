import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type {
  Schedule,
  CalendarSyncResult,
  ScheduleCreateInput,
  ScheduleUpdateInput,
  ScheduleQueryParams,
  ScheduleListResponse,
} from '@/types/schedule';

export function useSchedules(teamId: string, params?: ScheduleQueryParams) {
  const queryParams = new URLSearchParams();
  if (params?.view) queryParams.set('view', params.view);
  if (params?.date) queryParams.set('date', params.date);

  const queryKey = ['schedules', teamId, params];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<ScheduleListResponse> => {
      return apiClient.get<ScheduleListResponse>(
        `/api/teams/${teamId}/schedules?${queryParams.toString()}`
      );
    },
    enabled: !!teamId,
  });
}

export function useScheduleDetail(teamId: string, scheduleId: string) {
  return useQuery({
    queryKey: ['schedules', teamId, scheduleId],
    queryFn: async (): Promise<Schedule> => {
      return apiClient.get<Schedule>(
        `/api/teams/${teamId}/schedules/${scheduleId}`
      );
    },
    enabled: !!teamId && !!scheduleId,
  });
}

export function useCreateSchedule(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ScheduleCreateInput): Promise<Schedule> => {
      const response = await apiClient.post<Schedule | { schedule: Schedule; calendarSync?: CalendarSyncResult }>(
        `/api/teams/${teamId}/schedules`,
        data
      );
      if (response && typeof response === 'object' && 'schedule' in response) {
        return { ...response.schedule, calendarSync: response.calendarSync };
      }
      return response as Schedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules', teamId] });
    },
  });
}

export function useUpdateSchedule(teamId: string, scheduleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ScheduleUpdateInput): Promise<Schedule> => {
      const response = await apiClient.patch<Schedule | { schedule: Schedule; calendarSync?: CalendarSyncResult }>(
        `/api/teams/${teamId}/schedules/${scheduleId}`,
        data
      );
      if (response && typeof response === 'object' && 'schedule' in response) {
        return { ...response.schedule, calendarSync: response.calendarSync };
      }
      return response as Schedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules', teamId] });
      queryClient.invalidateQueries({
        queryKey: ['schedules', teamId, scheduleId],
      });
    },
  });
}

export function useDeleteSchedule(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleId: string): Promise<{ calendarSync?: CalendarSyncResult } | null> => {
      return apiClient.delete<{ calendarSync?: CalendarSyncResult } | null>(
        `/api/teams/${teamId}/schedules/${scheduleId}`
      );
    },
    onSuccess: (_, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ['schedules', teamId] });
      queryClient.invalidateQueries({
        queryKey: ['schedules', teamId, scheduleId],
      });
    },
  });
}
