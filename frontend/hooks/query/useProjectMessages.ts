import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type {
  ChatMessage,
  ChatMessageInput,
  ChatMessageListResponse,
} from '@/types/chat';

// 프로젝트 전용 채팅 — useMessages 와 동일 패턴이지만 queryKey/엔드포인트가 다름.
// 팀 일자별 채팅(useMessages)과 캐시·폴링이 격리되어 두 종류 채팅이 섞이지 않음.
export function useProjectMessages(teamId: string, projectId: string) {
  return useQuery({
    queryKey: ['project-messages', teamId, projectId],
    queryFn: async (): Promise<ChatMessageListResponse> => {
      return apiClient.get<ChatMessageListResponse>(
        `/api/teams/${teamId}/projects/${projectId}/messages`
      );
    },
    enabled: !!teamId && !!projectId,
    refetchInterval: 3000,
  });
}

export function useSendProjectMessage(teamId: string, projectId: string) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const queryKey = ['project-messages', teamId, projectId];

  return useMutation({
    mutationFn: async (data: ChatMessageInput): Promise<ChatMessage> => {
      return apiClient.post<ChatMessage>(
        `/api/teams/${teamId}/projects/${projectId}/messages`,
        data
      );
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
        projectId,
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
