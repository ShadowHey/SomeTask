export interface RecordingListItem {
  id: string;
  original_filename: string;
  status: string;
  size_bytes: number | null;
  duration_seconds: number | null;
  summary_preview: string | null;
  created_at: string;
  updated_at: string;
  failure_stage: string | null;
  failure_message: string | null;
}

export interface RecordingDetail {
  id: string;
  original_filename: string;
  storage_path: string;
  status: string;
  size_bytes: number | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
  failure_stage: string | null;
  failure_message: string | null;
  summary: string | null;
  transcript_segments: TranscriptSegment[];
}

export interface TranscriptSegment {
  id: string;
  sequence_number: number;
  start_ms: number | null;
  end_ms: number | null;
  text: string;
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
