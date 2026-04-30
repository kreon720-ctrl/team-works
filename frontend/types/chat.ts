// Chat types

export type MessageType = 'NORMAL' | 'WORK_PERFORMANCE';

export interface ChatMessage {
  id: string;
  teamId: string;
  // 프로젝트 전용 채팅이면 projectId 채워짐, 팀 일자별 채팅이면 null/undefined.
  projectId?: string | null;
  senderId: string;
  senderName: string;
  content: string;
  type: MessageType;
  sentAt: string;
}

export interface ChatMessageInput {
  content: string;
  type?: MessageType;
}

export interface ChatMessageListResponse {
  messages: ChatMessage[];
  // 팀 일자별 채팅이면 date, 프로젝트 채팅이면 projectId 만 채워짐.
  date?: string;
  projectId?: string;
}

// API 명세 GET /api/teams/:teamId/messages 쿼리 파라미터
export interface ChatQueryParams {
  date?: string; // YYYY-MM-DD (KST)
}
