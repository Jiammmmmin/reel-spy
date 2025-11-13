// API client to replace Supabase functions
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface QueryResponse {
  data: any;
  videoUrl?: string | null;
  videoInfo?: {
    videoName: string;
    duration: number;
  };
  error: string | null;
  message?: string;
}

export const api = {
  async queryRDS(body: { videoId?: number; objectName?: string; test?: boolean }): Promise<QueryResponse> {
    const response = await fetch(`${API_BASE_URL}/query-aws-rds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },
};

