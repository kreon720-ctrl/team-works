import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type {
  ChatMessage,
  ChatMessageInput,
  ChatMessageListResponse,
} from '@/types/chat';

export function useMessages(teamId: string, date?: string) {
  return useQuery({
    queryKey: ['messages', teamId, date],
    queryFn: async (): Promise<ChatMessageListResponse> => {
      const params = date ? `?date=${date}` : '';
      return apiClient.get<ChatMessageListResponse>(
        `/api/teams/${teamId}/messages${params}`
      );
    },
    enabled: !!teamId,
    refetchInterval: 3000,
  });
}

export function useSendMessage(teamId: string, date?: string) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const queryKey = ['messages', teamId, date];

  return useMutation({
    mutationFn: async (data: ChatMessageInput): Promise<ChatMessage> => {
      return apiClient.post<ChatMessage>(`/api/teams/${teamId}/messages`, data);
    },
    onMutate: async (newMessage) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<ChatMessageListResponse>(queryKey);

      const optimisticMessage: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        content: newMessage.content,
        type: newMessage.type ?? 'NORMAL',
        sentAt: new Date().toISOString(),
        senderId: currentUser?.id ?? '',
        senderName: currentUser?.name ?? '',
        teamId,
      };

      queryClient.setQueryData<ChatMessageListResponse>(queryKey, (old) => {
        if (!old) return old;
        return { ...old, messages: [...old.messages, optimisticMessage] };
      });

      return { previousData };
    },
    onError: (_err, _newMessage, context) => {
      const ctx = context as { previousData?: ChatMessageListResponse } | undefined;
      if (ctx?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, ctx.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
