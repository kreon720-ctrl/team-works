import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export type GoogleCalendarIntegrationStatus =
  | 'connected'
  | 'needs_consent'
  | 'disabled'
  | 'not_applicable'
  | 'error';

export interface GoogleCalendarIntegrationStatusResponse {
  status: GoogleCalendarIntegrationStatus;
  connectedAt?: string;
  disconnectedAt?: string | null;
  googleAccountEmail?: string;
  googleCalendarId?: string;
}

interface GoogleCalendarStartResponse {
  status: 'connected' | 'needs_consent';
  url?: string;
  googleAccountEmail?: string;
  googleCalendarId?: string;
}

export function useGoogleCalendarIntegrationStatus(teamId: string, enabled = true) {
  return useQuery({
    queryKey: ['teams', teamId, 'calendar', 'google', 'status'],
    queryFn: async (): Promise<GoogleCalendarIntegrationStatusResponse> => {
      return apiClient.get<GoogleCalendarIntegrationStatusResponse>(
        `/api/teams/${teamId}/calendar/google/status`
      );
    },
    enabled: !!teamId && enabled,
  });
}

export function useStartGoogleCalendarIntegration(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<GoogleCalendarStartResponse> => {
      return apiClient.post<GoogleCalendarStartResponse>(
        `/api/teams/${teamId}/calendar/google/start`,
        { redirectAfter: `/teams/${teamId}` }
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'calendar', 'google', 'status'] });
      if (data.status === 'connected') {
        queryClient.invalidateQueries({ queryKey: ['schedules', teamId] });
      }
    },
  });
}

export function useDisconnectGoogleCalendarIntegration(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ disconnected: boolean }> => {
      return apiClient.delete<{ disconnected: boolean }>(
        `/api/teams/${teamId}/calendar/google/disconnect`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'calendar', 'google', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['schedules', teamId] });
    },
  });
}
