import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBoardPosts,
  fetchBoardPost,
  createBoardPost,
  updateBoardPost,
  deleteBoardPost,
} from '@/lib/api/boardApi';
import type { BoardListResponse, BoardPost, CreatePostInput, UpdatePostInput } from '@/types/board';

// 자료실 캐시 key — 채팅·공지와 동일 격리 패턴 (project_id NULL → __team__ sentinel).
function listKey(teamId: string, projectId: string | null) {
  return ['board', teamId, projectId ?? '__team__'] as const;
}

export function useBoardPosts(teamId: string, projectId: string | null) {
  return useQuery({
    queryKey: listKey(teamId, projectId),
    queryFn: (): Promise<BoardListResponse> => fetchBoardPosts(teamId, projectId),
    enabled: !!teamId,
    refetchInterval: 10_000, // 채팅 폴링(3초)보다 느슨 — 글 자체는 자주 안 변함
  });
}

export function useBoardPost(teamId: string, postId: string | null) {
  return useQuery({
    queryKey: ['board', teamId, '__post__', postId],
    queryFn: (): Promise<BoardPost> => fetchBoardPost(teamId, postId!),
    enabled: !!teamId && !!postId,
  });
}

export function useCreateBoardPost(teamId: string, projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => createBoardPost(teamId, projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey(teamId, projectId) });
    },
  });
}

export function useUpdateBoardPost(teamId: string, projectId: string | null, postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePostInput) => updateBoardPost(teamId, postId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey(teamId, projectId) });
      queryClient.invalidateQueries({ queryKey: ['board', teamId, '__post__', postId] });
    },
  });
}

export function useDeleteBoardPost(teamId: string, projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => deleteBoardPost(teamId, postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey(teamId, projectId) });
    },
  });
}
