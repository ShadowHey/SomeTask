import type { RecordingDetail, RecordingListItem, TranscriptSearchResponse } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// Global variable to hold the Supabase JWT token injected by the AuthProvider
let currentApiToken: string | null = null;

export const setApiToken = (token: string | null) => {
  currentApiToken = token;
};

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (currentApiToken) {
    headers.set("Authorization", `Bearer ${currentApiToken}`);
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
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
    process: (note_id: string, config: any) =>
      fetchApi<RecordingDetail>("/recordings", {
        method: "POST",
        body: JSON.stringify({ note_id, config }),
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
  },
};
