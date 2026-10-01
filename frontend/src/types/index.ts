export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface UploadPartUrl {
  part_number: number;
  url: string;
}

export interface UploadInitiateResponse {
  audio_file_id: string;
  upload_id: string;
  object_key: string;
  part_urls: UploadPartUrl[];
  part_size: number;
}

export interface RecordingListItem {
  id: string;
  original_filename: string;
  display_name: string;
  size_bytes: number | null;
  duration_seconds: number | null;
  status: string;
  language_code: string | null;
  summary_preview: string | null;
  created_at: string;
  uploaded_at: string | null;
  completed_at: string | null;
  failure_stage: string | null;
  failure_message: string | null;
}

export interface TranscriptSegment {
  id: string;
  sequence: number;
  start_ms: number | null;
  end_ms: number | null;
  text: string;
}

export interface Summary {
  content: string | null;
  provider: string;
  model: string | null;
  status: string;
  created_at: string;
}

export interface RecordingDetail {
  id: string;
  original_filename: string;
  display_name: string;
  size_bytes: number | null;
  duration_seconds: number | null;
  status: string;
  language_code: string | null;
  mime_type: string;
  created_at: string;
  uploaded_at: string | null;
  completed_at: string | null;
  failure_stage: string | null;
  failure_code: string | null;
  failure_message: string | null;
  transcript_segments: TranscriptSegment[];
  summary: Summary | null;
}

export interface ProcessingJob {
  id: string;
  job_type: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface RecordingStatusResponse {
  audio_file_id: string;
  status: string;
  failure_stage: string | null;
  failure_message: string | null;
  processing_jobs: ProcessingJob[];
}

export interface AudioUrlResponse {
  url: string;
  expires_in: number;
}

export interface TranscriptSearchResult {
  segment_id: string;
  text: string;
  start_ms: number | null;
  end_ms: number | null;
  similarity: number;
}

export interface TranscriptSearchResponse {
  query: string;
  results: TranscriptSearchResult[];
  total: number;
}
