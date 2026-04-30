// 자료실 타입

export interface BoardAttachment {
  id: string;
  postId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string; // ISO
}

export interface BoardPost {
  id: string;
  teamId: string;
  projectId: string | null;
  authorId: string;
  authorName: string | null;
  title: string;
  content: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  attachments: BoardAttachment[];
}

export interface BoardListResponse {
  projectId: string | null;
  posts: BoardPost[];
}

export interface CreatePostInput {
  title: string;
  content: string;
  file?: File | null;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  // 새 파일 첨부. null/undefined 면 첨부 변경 없음.
  // (1단계는 첨부 단일이라 신규 파일이 오면 기존 첨부 모두 교체.)
  file?: File | null;
}
