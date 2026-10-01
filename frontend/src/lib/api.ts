import type {
  AudioUrlResponse,
  RecordingDetail,
  RecordingListItem,
  RecordingStatusResponse,
  TranscriptSearchResponse,
  UploadInitiateResponse,
  User,
} from "../types";

// Base API URL - pointing to FastAPI backend
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(public status: number, public message: string, public data?: any) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Custom fetch wrapper that handles API errors and automatically includes credentials for cookies
 */
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Essential for sending/receiving HTTP-only cookies
  });

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.detail || response.statusText || "An API error occurred",
      data
    );
  }

  return data as T;
}

// -- Auth --

export const api = {
  auth: {
    me: () => fetchApi<User>("/auth/me"),
    login: (email: string, password: string) =>
      fetchApi<User>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string) =>
      fetchApi<User>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    logout: () => fetchApi<void>("/auth/logout", { method: "POST" }),
  },

  // -- Upload --
  
  upload: {
    initiate: (filename: string, file_size: number, mime_type: string, language_code = "en-IN") =>
      fetchApi<UploadInitiateResponse>("/uploads/initiate", {
        method: "POST",
        body: JSON.stringify({ filename, file_size, mime_type, language_code }),
      }),
    complete: (audio_file_id: string, parts: { part_number: number; etag: string }[]) =>
      fetchApi<{ status: string }>(`/uploads/${audio_file_id}/complete`, {
        method: "POST",
        body: JSON.stringify({ parts }),
      }),
    abort: (audio_file_id: string) =>
      fetchApi<void>(`/uploads/${audio_file_id}/abort`, {
        method: "POST",
      }),
  },

  // -- Recordings --
  
  recordings: {
    list: (limit = 50, offset = 0) =>
      fetchApi<RecordingListItem[]>(`/recordings?limit=${limit}&offset=${offset}`),
      
    get: (id: string) => fetchApi<RecordingDetail>(`/recordings/${id}`),
    
    update: (id: string, display_name: string) =>
      fetchApi<RecordingDetail>(`/recordings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ display_name }),
      }),
      
    delete: (id: string) =>
      fetchApi<void>(`/recordings/${id}`, { method: "DELETE" }),
      
    getStatus: (id: string) =>
      fetchApi<RecordingStatusResponse>(`/recordings/${id}/status`),
      
    getAudioUrl: (id: string) =>
      fetchApi<AudioUrlResponse>(`/recordings/${id}/audio-url`),
      
    searchTranscript: (id: string, query: string, limit = 10) =>
      fetchApi<TranscriptSearchResponse>(
        `/recordings/${id}/transcript/search?q=${encodeURIComponent(query)}&limit=${limit}`
      ),
  },
};
