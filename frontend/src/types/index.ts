export interface TranscriptionConfig {
  language_code: string;
  with_diarization?: boolean;
  num_speakers?: number;
  is_multi_channel?: boolean;
  with_denoise?: boolean;
  bias_list?: string[];
  bias_score?: number;
}

export interface RecordingListItem {
  id: string;
  original_filename: string;
  status: string;
  summary_status: string;
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
  summary_status: string;
  transcription_config: TranscriptionConfig | null;
  resolved_language: string | null;
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
  speaker_id: number | null;
  confidence: number | null;
  language_detected: string | null;
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
