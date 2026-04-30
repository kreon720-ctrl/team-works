'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  useBoardPosts,
  useCreateBoardPost,
  useUpdateBoardPost,
  useDeleteBoardPost,
} from '@/hooks/query/useBoard';
import { boardAttachmentUrl } from '@/lib/api/boardApi';
import type { BoardPost } from '@/types/board';

interface BoardPanelProps {
  teamId: string;
  projectId?: string;
}

type View =
  | { kind: 'list' }
  | { kind: 'detail'; postId: string }
  | { kind: 'editor'; postId?: string };

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function BoardPanel({ teamId, projectId }: BoardPanelProps) {
  const projectIdOrNull = projectId ?? null;
  const { data, isLoading, isError } = useBoardPosts(teamId, projectIdOrNull);
  const createMut = useCreateBoardPost(teamId, projectIdOrNull);
  const deleteMut = useDeleteBoardPost(teamId, projectIdOrNull);

  const [view, setView] = useState<View>({ kind: 'list' });

  const posts = data?.posts ?? [];
  const currentUser = useAuthStore((s) => s.currentUser);

  if (view.kind === 'editor') {
    const editing = view.postId ? posts.find((p) => p.id === view.postId) ?? null : null;
    return (
      <PostEditor
        teamId={teamId}
        projectId={projectIdOrNull}
        editing={editing}
        onCancel={() => setView({ kind: 'list' })}
        onSaved={() => setView({ kind: 'list' })}
      />
    );
  }

  if (view.kind === 'detail') {
    const post = posts.find((p) => p.id === view.postId);
    if (!post) {
      // 목록에서 사라짐 — 안전하게 list 로 복귀.
      setView({ kind: 'list' });
      return null;
    }
    const isAuthor = !!currentUser && currentUser.id === post.authorId;
    return (
      <PostDetail
        post={post}
        isAuthor={isAuthor}
        onBack={() => setView({ kind: 'list' })}
        onEdit={() => setView({ kind: 'editor', postId: post.id })}
        onDelete={async () => {
          if (!confirm('이 글을 삭제할까요? (첨부파일도 함께 삭제됩니다)')) return;
          await deleteMut.mutateAsync(post.id);
          setView({ kind: 'list' });
        }}
        deleting={deleteMut.isPending}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-base">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-border flex items-center justify-between shrink-0">
        <p className="text-xs text-gray-500 dark:text-dark-text-muted">
          글 {posts.length}건
        </p>
        <button
          type="button"
          onClick={() => setView({ kind: 'editor' })}
          className="px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 dark:bg-dark-accent-strong dark:text-gray-900 dark:hover:bg-white"
        >
          + 글쓰기
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading && (
          <p className="text-sm text-gray-500 dark:text-dark-text-muted py-8 text-center">
            로딩 중…
          </p>
        )}
        {isError && (
          <p className="text-sm text-error-500 py-8 text-center">
            글 목록을 불러오는 중 오류가 발생했습니다.
          </p>
        )}
        {!isLoading && !isError && posts.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-dark-text-disabled py-12 text-center">
            아직 등록된 글이 없습니다. 첫 글을 작성해 보세요.
          </p>
        )}
        {posts.map((post) => (
          <button
            key={post.id}
            type="button"
            onClick={() => setView({ kind: 'detail', postId: post.id })}
            className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:border-primary-300 dark:hover:border-dark-accent transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-dark-text truncate flex-1">
                {post.title}
              </h4>
              {post.attachments.length > 0 && (
                <span className="text-xs text-gray-400 dark:text-dark-text-disabled shrink-0">
                  📎 {post.attachments.length}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-1 line-clamp-2">
              {post.content}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-dark-text-disabled mt-1.5">
              {post.authorName ?? '알 수 없음'} · {formatDate(post.createdAt)}
            </p>
          </button>
        ))}
      </div>
      {createMut.isError && (
        <p className="px-4 py-2 text-xs text-error-500 border-t border-gray-200 dark:border-dark-border">
          {(createMut.error as Error).message}
        </p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// PostEditor — 신규/수정 공용. editing 이 있으면 수정 모드.
// ────────────────────────────────────────────────────────────────────────
interface PostEditorProps {
  teamId: string;
  projectId: string | null;
  editing: BoardPost | null;
  onCancel: () => void;
  onSaved: () => void;
}

function PostEditor({ teamId, projectId, editing, onCancel, onSaved }: PostEditorProps) {
  const createMut = useCreateBoardPost(teamId, projectId);
  const updateMut = useUpdateBoardPost(teamId, projectId, editing?.id ?? '');

  const [title, setTitle] = useState(editing?.title ?? '');
  const [content, setContent] = useState(editing?.content ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPending = editing ? updateMut.isPending : createMut.isPending;

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError('제목을 입력해 주세요.');
      return;
    }
    if (file && file.size > MAX_FILE_SIZE) {
      setError(`첨부파일은 ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB 이하만 가능합니다.`);
      return;
    }
    try {
      if (editing) {
        await updateMut.mutateAsync({
          title: title !== editing.title ? title : undefined,
          content: content !== editing.content ? content : undefined,
          file: file ?? undefined,
        });
      } else {
        await createMut.mutateAsync({ title, content, file });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-base">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-border flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-text">
          {editing ? '글 수정' : '글쓰기'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="text-xs text-gray-500 dark:text-dark-text-muted hover:text-gray-900 dark:hover:text-dark-text disabled:opacity-50"
        >
          취소
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-dark-text-muted mb-1">
            제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPending}
            maxLength={200}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-dark-accent disabled:opacity-50"
            placeholder="글 제목"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-dark-text-muted mb-1">
            내용
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isPending}
            maxLength={20000}
            rows={10}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-dark-text resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-dark-accent disabled:opacity-50"
            placeholder="내용을 입력하세요"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-dark-text-muted mb-1">
            첨부파일{' '}
            <span className="text-[11px] text-gray-400 dark:text-dark-text-disabled">
              (선택, 최대 10MB)
            </span>
          </label>
          {editing && editing.attachments.length > 0 && !file && (
            <p className="text-[11px] text-gray-500 dark:text-dark-text-muted mb-1.5">
              현재: 📎 {editing.attachments[0].originalName} ·{' '}
              새 파일 선택 시 교체됩니다.
            </p>
          )}
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={isPending}
            className="block text-xs text-gray-700 dark:text-dark-text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-dark-elevated file:text-gray-700 dark:file:text-dark-text file:cursor-pointer file:hover:bg-gray-200"
          />
          {file && (
            <p className="mt-1 text-[11px] text-gray-500 dark:text-dark-text-muted">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>
        {error && <p className="text-xs text-error-500">{error}</p>}
      </div>
      <div className="px-4 py-3 border-t border-gray-200 dark:border-dark-border flex items-center justify-end gap-2 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text-muted hover:bg-gray-50 dark:hover:bg-dark-surface disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !title.trim()}
          className="px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 dark:bg-dark-accent-strong dark:text-gray-900 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? '저장 중…' : editing ? '수정' : '등록'}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// PostDetail — 작성자 본인이면 수정/삭제 버튼 노출.
// ────────────────────────────────────────────────────────────────────────
interface PostDetailProps {
  post: BoardPost;
  isAuthor: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}

function PostDetail({
  post, isAuthor, onBack, onEdit, onDelete, deleting,
}: PostDetailProps) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-base">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-border flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-gray-500 dark:text-dark-text-muted hover:text-gray-900 dark:hover:text-dark-text"
        >
          ← 목록
        </button>
        {isAuthor && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              disabled={deleting}
              className="px-2.5 py-1 text-xs font-medium border border-gray-300 dark:border-dark-border rounded text-gray-700 dark:text-dark-text-muted hover:bg-gray-50 dark:hover:bg-dark-surface disabled:opacity-50"
            >
              수정
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="px-2.5 py-1 text-xs font-medium border border-gray-300 dark:border-dark-border rounded text-gray-700 dark:text-dark-text-muted hover:bg-gray-50 dark:hover:bg-dark-surface disabled:opacity-50"
            >
              {deleting ? '삭제 중…' : '삭제'}
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-dark-text">{post.title}</h2>
        <p className="text-[11px] text-gray-400 dark:text-dark-text-disabled mt-1">
          {post.authorName ?? '알 수 없음'} · {formatDate(post.createdAt)}
          {post.updatedAt !== post.createdAt && ' · 수정됨'}
        </p>
        <div className="mt-4 text-sm text-gray-800 dark:text-dark-text whitespace-pre-wrap break-words">
          {post.content || <span className="text-gray-400 dark:text-dark-text-disabled">(내용 없음)</span>}
        </div>
        {post.attachments.length > 0 && (
          <div className="mt-5 pt-3 border-t border-gray-200 dark:border-dark-border">
            <p className="text-xs font-medium text-gray-600 dark:text-dark-text-muted mb-2">첨부파일</p>
            <ul className="space-y-1.5">
              {post.attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={boardAttachmentUrl(a.id)}
                    download={a.originalName}
                    className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-dark-accent hover:underline"
                  >
                    📎 {a.originalName}
                    <span className="text-[11px] text-gray-400 dark:text-dark-text-disabled">
                      ({(a.sizeBytes / 1024).toFixed(1)} KB)
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
