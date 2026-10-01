import { api } from "./api";
import { UploadPartUrl } from "../types";

export interface UploadProgress {
  status: "initializing" | "uploading" | "completing" | "success" | "error";
  progress: number; // 0 to 100
  message?: string;
}

/**
 * Handles the complete multipart upload flow:
 * 1. Initiates upload with backend
 * 2. Chunks file and uploads parts to R2 presigned URLs
 * 3. Completes upload with backend
 */
export async function uploadAudioFile(
  file: File,
  languageCode: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<string> {
  let audioFileId: string | null = null;

  try {
    onProgress?.({ status: "initializing", progress: 0, message: "Preparing upload..." });

    // 1. Initiate upload
    const initResponse = await api.upload.initiate(
      file.name,
      file.size,
      file.type || "audio/mp3",
      languageCode
    );

    audioFileId = initResponse.audio_file_id;
    const { upload_id, part_urls, part_size } = initResponse;

    onProgress?.({ status: "uploading", progress: 5, message: "Uploading audio data..." });

    // 2. Upload parts to R2 in parallel with concurrency limit
    const uploadedParts: { part_number: number; etag: string }[] = [];
    let completedPartsCount = 0;
    const totalParts = part_urls.length;

    // A simple concurrency queue (e.g. 3 parts at a time)
    const MAX_CONCURRENCY = 3;
    const queue = [...part_urls];

    const worker = async () => {
      while (queue.length > 0) {
        const part = queue.shift();
        if (!part) break;

        const start = (part.part_number - 1) * part_size;
        const end = Math.min(start + part_size, file.size);
        const blob = file.slice(start, end);

        // Upload chunk directly to R2 using PUT
        const response = await fetch(part.url, {
          method: "PUT",
          body: blob,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload part ${part.part_number}: ${response.statusText}`);
        }

        // R2 returns ETag in headers, with quotes. Need to extract it.
        const etag = response.headers.get("etag")?.replace(/"/g, "") || "";
        
        if (!etag) {
           console.warn(`No ETag returned for part ${part.part_number}. This might fail completion.`);
        }

        uploadedParts.push({
          part_number: part.part_number,
          etag,
        });

        completedPartsCount++;
        
        // Update progress (from 5% to 90%)
        const progressPercent = 5 + Math.floor((completedPartsCount / totalParts) * 85);
        onProgress?.({ 
          status: "uploading", 
          progress: progressPercent,
          message: `Uploading... ${Math.round((completedPartsCount / totalParts) * 100)}%` 
        });
      }
    };

    // Run workers
    const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, totalParts) }, worker);
    await Promise.all(workers);

    // 3. Complete upload
    onProgress?.({ status: "completing", progress: 95, message: "Finalizing processing..." });
    
    await api.upload.complete(audioFileId, uploadedParts);
    
    onProgress?.({ status: "success", progress: 100, message: "Upload complete!" });
    
    return audioFileId;

  } catch (error) {
    // Attempt to abort if we failed midway and have an ID
    if (audioFileId) {
      try {
        await api.upload.abort(audioFileId);
      } catch (abortError) {
        console.error("Failed to abort upload after error:", abortError);
      }
    }
    
    onProgress?.({ 
      status: "error", 
      progress: 0, 
      message: error instanceof Error ? error.message : "Upload failed" 
    });
    
    throw error;
  }
}
