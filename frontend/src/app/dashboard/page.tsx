"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { uploadAudioFile, UploadProgress } from "@/lib/upload";
import { UploadModal } from "@/components/upload/UploadModal";
import type { RecordingListItem } from "@/types";
import { useAuth } from "@/components/AuthProvider";

export default function Dashboard() {
  const { isLoading: isAuthLoading } = useAuth();
  const [recordings, setRecordings] = useState<RecordingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const fetchRecordings = useCallback(async () => {
    try {
      const data = await api.recordings.list();
      setRecordings(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load recordings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;

    const initialLoad = window.setTimeout(() => void fetchRecordings(), 0);

    const interval = setInterval(() => {
      void fetchRecordings();
    }, 5000);
    
    return () => {
      window.clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [fetchRecordings, isAuthLoading]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "transcription_completed": return "bg-green-100 text-green-800";
      case "transcription_failed": 
      case "failed": return "bg-red-100 text-red-800";
      case "deleted": return "bg-gray-100 text-gray-800";
      default: return "bg-blue-100 text-blue-800 animate-pulse";
    }
  };

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Your Audio Notes
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Upload new audio to get it transcribed and summarized.
          </p>
        </div>
        <div className="mt-4 sm:ml-4 sm:mt-0">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Upload Audio
          </button>
        </div>
      </div>

      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onUploadSuccess={() => fetchRecordings()} 
      />

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      ) : recordings.length === 0 ? (
        <div className="text-center rounded-lg border-2 border-dashed border-gray-300 p-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No recordings</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by uploading an audio file.</p>
        </div>
      ) : (
        <ul role="list" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {recordings.map((recording) => (
            <li key={recording.id} className="col-span-1 divide-y divide-gray-200 rounded-lg bg-white shadow ring-1 ring-black/5 hover:shadow-md transition-shadow">
              <Link href={`/recordings/${recording.id}`} className="block h-full">
                <div className="flex w-full items-center justify-between space-x-6 p-6">
                  <div className="flex-1 truncate">
                    <div className="flex items-center space-x-3">
                      <h3 className="truncate text-sm font-medium text-gray-900">{recording.original_filename}</h3>
                      <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(recording.status)}`}>
                        {recording.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-gray-500">{recording.original_filename}</p>
                    
                    {recording.summary_preview ? (
                      <p className="mt-4 text-sm text-gray-600 line-clamp-3">
                        {recording.summary_preview}
                      </p>
                    ) : recording.failure_message ? (
                      <p className="mt-4 rounded bg-red-50 p-2 text-sm text-red-700 line-clamp-3">
                        {recording.failure_message}
                      </p>
                    ) : (
                      <div className="mt-4 h-12 rounded bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                        {recording.summary_status === "completed" 
                          ? "Summary available." 
                          : recording.summary_status === "queued" || recording.summary_status === "processing"
                          ? "Generating Summary..." 
                          : recording.status === "transcription_completed"
                          ? "Transcript ready. Generate Summary?"
                          : "Processing Transcript..."}
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 rounded-b-lg">
                  <div className="text-xs text-gray-500 flex justify-between">
                    <span>
                      {new Date(recording.created_at).toLocaleDateString()}
                    </span>
                    {recording.duration_seconds && (
                      <span>
                        {Math.round(recording.duration_seconds / 60)}:
                        {(Math.round(recording.duration_seconds % 60)).toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
