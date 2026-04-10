import { apiClient } from './client';

export interface ChatRequest {
  message: string;
  session_id?: string;
  module_context?: string;
}

export interface ChatResponse {
  reply: string;
  session_id: string;
  sources?: string[];
}

export interface ChatSessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const chatApi = {
  sendMessage: async (request: ChatRequest): Promise<ChatResponse> => {
    return apiClient.post<ChatResponse>('/chat/message', request);
  },

  getHistory: async (sessionId: string): Promise<ChatSessionMessage[]> => {
    return apiClient.get<ChatSessionMessage[]>(`/chat/history/${sessionId}`);
  },

  getSessions: async (): Promise<{ id: string; module_context: string | null; last_active: string; created_at: string }[]> => {
    return apiClient.get('/chat/sessions');
  },
};
