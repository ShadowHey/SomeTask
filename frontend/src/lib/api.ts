import type { RecordingDetail, RecordingListItem, TranscriptSearchResponse } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

import { createClient } from "./supabase";

// Removed global currentApiToken and setApiToken

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    cache: "no-store",
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new ApiError(response.status, errorData.detail || "API request failed");
  }

  // 204 No Content returns no JSON
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  recordings: {
    // Called after direct Supabase Storage upload to enqueue the processing job
    process: (note_id: string, config: any, recording_name?: string, tags?: string[]) =>
      fetchApi<RecordingDetail>("/recordings", {
        method: "POST",
        body: JSON.stringify({ note_id, config, recording_name, tags }),
      }),
    list: () =>
      fetchApi<RecordingListItem[]>("/recordings"),
    get: (id: string) =>
      fetchApi<RecordingDetail>(`/recordings/${id}`),
    generateSummary: (id: string) =>
      fetchApi<RecordingDetail>(`/recordings/${id}/summary`, {
        method: "POST",
      }),
    getAudioUrl: (id: string) =>
      fetchApi<{ url: string; expires_in: number }>(`/recordings/${id}/audio-url`),
    update: (id: string, original_filename: string) =>
      fetchApi<RecordingDetail>(`/recordings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ original_filename }),
      }),
    delete: (id: string) =>
      fetchApi<void>(`/recordings/${id}`, { method: "DELETE" }),
    searchTranscript: (id: string, query: string) =>
      fetchApi<TranscriptSearchResponse>(`/recordings/${id}/search?q=${encodeURIComponent(query)}`),
    askQuestion: (id: string, question: string) =>
      fetchApi<{ answer: string }>(`/recordings/${id}/ask`, {
        method: "POST",
        body: JSON.stringify({ question }),
      }),
  },
  profile: {
    get: () => fetchApi<any>("/profile"),
    update: (data: { username?: string; avatar_id?: string }) => 
      fetchApi<any>("/profile", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    getKeys: () => fetchApi<any>("/profile/keys"),
    updateKeys: (data: { gemini_api_key?: string | null; gnani_api_key?: string | null; use_default_gemini?: boolean | null; use_default_gnani?: boolean | null; }) =>
      fetchApi<any>("/profile/keys", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    removeKeys: () => fetchApi<any>("/profile/keys", { method: "DELETE" }),
  },
  tags: {
    list: () => fetchApi<any[]>("/tags"),
  },
  usage: {
    get: (params?: { start_date?: string; end_date?: string }) => {
      let query = "";
      if (params) {
        const urlParams = new URLSearchParams();
        if (params.start_date) urlParams.append("start_date", params.start_date);
        if (params.end_date) urlParams.append("end_date", params.end_date);
        query = `?${urlParams.toString()}`;
      }
      return fetchApi<any>(`/usage${query}`);
    }
  },
  logs: {
    list: (params?: { level?: string; limit?: number; offset?: number }) => {
      const urlParams = new URLSearchParams();
      if (params?.level) urlParams.append("level", params.level);
      if (params?.limit) urlParams.append("limit", params.limit.toString());
      if (params?.offset) urlParams.append("offset", params.offset.toString());
      
      const query = urlParams.toString() ? `?${urlParams.toString()}` : "";
      return fetchApi<import("../types").SystemLogListResponse>(`/logs${query}`);
    },
    create: (data: { level: string; stage: string; message: string; details?: any; note_id?: string }) =>
      fetchApi<any>("/logs", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  }
};
