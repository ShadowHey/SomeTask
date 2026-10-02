import { api } from "./api";
import { createClient } from "./supabase";
import { v4 as uuidv4 } from "uuid";

export interface UploadProgress {
  status: "preparing" | "uploading" | "completing" | "success" | "error";
  progress: number; // 0-100
  message: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB
const ALLOWED_MIME_TYPES = [
  "audio/wav",
  "audio/mpeg",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
];

export async function uploadAudioFile(
  file: File,
  config: any,
  recordingName: string,
  tags: string[],
  onProgress?: (progress: UploadProgress) => void
): Promise<void> {
  // Validate file
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File exceeds the maximum limit of 5 GB.");
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.match(/\.(wav|mp3|ogg|flac|aac|m4a)$/i)) {
    throw new Error("Unsupported file format. Please upload WAV, MP3, OGG, FLAC, AAC, or M4A.");
  }

  const supabase = createClient();

  try {
    // 1. Get current user
    onProgress?.({ status: "preparing", progress: 0, message: "Preparing upload..." });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("You must be logged in to upload files.");

    const noteId = uuidv4();
    const fileExtension = file.name.split('.').pop();
    const storagePath = `users/${user.id}/${noteId}.${fileExtension}`;

    // 2. Insert into DB
    onProgress?.({ status: "uploading", progress: 10, message: "Creating record..." });

    const { error: dbError } = await supabase
      .from('audio_notes')
      .insert({
        id: noteId,
        user_id: user.id,
        original_filename: file.name,
        recording_name: recordingName || null,
        storage_path: storagePath,
        size_bytes: file.size,
        status: 'uploading'
      });

    if (dbError) throw new Error(`Failed to create database record: ${dbError.message}`);

    // 3. Upload to Supabase Storage
    onProgress?.({ status: "uploading", progress: 30, message: "Uploading audio data..." });

    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      // Cleanup DB record if upload fails
      await supabase.from('audio_notes').delete().match({ id: noteId });
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // 4. Update status in DB
    onProgress?.({ status: "completing", progress: 90, message: "Finalizing..." });
    const { error: finalizationError } = await supabase
      .from('audio_notes')
      .update({ status: 'uploaded' })
      .match({ id: noteId });
    if (finalizationError) {
      throw new Error(`Failed to finalize upload: ${finalizationError.message}`);
    }

    // 5. Tell FastAPI to start the background job
    await api.recordings.process(noteId, config, recordingName, tags);

    onProgress?.({ status: "success", progress: 100, message: "Upload complete!" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    onProgress?.({ status: "error", progress: 0, message });
    throw error;
  }
}
