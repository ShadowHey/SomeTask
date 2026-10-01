"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { RecordingDetail, TranscriptSearchResult } from "@/types";
import { useAuth } from "@/components/AuthProvider";

export default function RecordingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  
  const [recording, setRecording] = useState<RecordingDetail | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TranscriptSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetchRecording();
  }, [id]);

  const fetchRecording = async () => {
    try {
      const data = await api.recordings.get(id);
      setRecording(data);
      setEditName(data.display_name);
      
      if (data.status !== "created" && data.status !== "uploading") {
        try {
          const urlData = await api.recordings.getAudioUrl(id);
          setAudioUrl(urlData.url);
        } catch (e) {
          console.error("Failed to load audio URL", e);
        }
      }
    } catch (err) {
      setError("Failed to load recording details");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRename = async () => {
    if (!editName.trim() || editName === recording?.display_name) {
      setIsEditingName(false);
      return;
    }
    
    try {
      const updated = await api.recordings.update(id, editName);
      setRecording(updated);
      setIsEditingName(false);
    } catch (err) {
      console.error("Rename failed", err);
      alert("Failed to rename recording");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this recording?")) return;
    
    try {
      await api.recordings.delete(id);
      router.push("/dashboard");
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to delete recording");
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await api.recordings.searchTranscript(id, searchQuery);
      setSearchResults(res.results);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const jumpToTime = (ms: number | null) => {
    if (ms !== null && audioRef.current) {
      audioRef.current.currentTime = ms / 1000;
      audioRef.current.play();
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-3xl rounded-lg bg-white p-8 shadow text-center">
          <h2 className="text-xl font-semibold text-red-600">Error</h2>
          <p className="mt-2 text-gray-600">{error || "Recording not found"}</p>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-900">
                &larr; Back
              </Link>
              <div className="h-4 w-px bg-gray-300"></div>
              {isEditingName ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                  />
                  <button onClick={handleRename} className="text-sm text-green-600 hover:text-green-700">Save</button>
                  <button onClick={() => setIsEditingName(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <h1 className="text-lg font-semibold text-gray-900">{recording.display_name}</h1>
                  <button onClick={() => setIsEditingName(true)} className="text-gray-400 hover:text-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleDelete}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Audio Player Section */}
            <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Audio</h2>
              {audioUrl ? (
                <audio ref={audioRef} controls className="w-full" src={audioUrl}>
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <div className="flex h-14 items-center justify-center rounded bg-gray-50 text-sm text-gray-500">
                  Audio not available ({recording.status})
                </div>
              )}
            </section>

            {/* Transcript Section */}
            <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Transcript</h2>
                <button
                  onClick={() => {
                    const text = recording.transcript_segments.map(s => s.text).join(" ");
                    navigator.clipboard.writeText(text);
                    alert("Copied to clipboard!");
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Copy All
                </button>
              </div>

              {recording.transcript_segments.length > 0 ? (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {recording.transcript_segments.map((segment) => (
                    <div 
                      key={segment.id} 
                      className="group flex gap-4 hover:bg-gray-50 p-2 rounded cursor-pointer transition-colors"
                      onClick={() => jumpToTime(segment.start_ms)}
                    >
                      <div className="w-16 flex-shrink-0 text-xs font-medium text-gray-400 mt-1">
                        {segment.start_ms !== null ? (
                          <>
                            {Math.floor(segment.start_ms / 60000)}:
                            {Math.floor((segment.start_ms % 60000) / 1000).toString().padStart(2, '0')}
                          </>
                        ) : '--:--'}
                      </div>
                      <p className="text-gray-800">{segment.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm italic">
                  {recording.status === "completed" || recording.status === "summarizing" 
                    ? "No transcript generated (could be silent audio)." 
                    : "Transcript processing..."}
                </p>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* AI Summary Section */}
            <section className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm ring-1 ring-blue-100">
              <div className="flex items-center space-x-2 mb-4">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900">AI Summary</h2>
              </div>
              
              {recording.summary?.content ? (
                <div className="prose prose-sm prose-blue text-gray-700 whitespace-pre-wrap">
                  {recording.summary.content}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  {recording.status === "completed" 
                    ? "Summary generation failed or not available." 
                    : "Generating smart summary..."}
                </p>
              )}
            </section>

            {/* Search Section */}
            <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Search in Transcript</h2>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {isSearching ? "..." : "Search"}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-gray-500">Results</h3>
                  {searchResults.map((result) => (
                    <div 
                      key={result.segment_id} 
                      className="cursor-pointer rounded bg-yellow-50 p-3 text-sm hover:bg-yellow-100 transition-colors"
                      onClick={() => jumpToTime(result.start_ms)}
                    >
                      <div className="font-medium text-yellow-800 mb-1">
                        {result.start_ms !== null && (
                          <span>
                            {Math.floor(result.start_ms / 60000)}:
                            {Math.floor((result.start_ms % 60000) / 1000).toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700">{result.text}</p>
                    </div>
                  ))}
                </div>
              )}
              {searchQuery && searchResults.length === 0 && !isSearching && (
                <p className="mt-4 text-sm text-gray-500">No matches found.</p>
              )}
            </section>

            {/* Details Section */}
            <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 text-sm text-gray-600">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="font-medium text-gray-900">Status</dt>
                  <dd className="capitalize">{recording.status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-medium text-gray-900">Uploaded</dt>
                  <dd>{new Date(recording.created_at).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-medium text-gray-900">Size</dt>
                  <dd>{recording.size_bytes ? (recording.size_bytes / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown'}</dd>
                </div>
                {recording.failure_message && (
                  <div className="mt-4 rounded bg-red-50 p-3">
                    <dt className="font-medium text-red-800">Error ({recording.failure_stage})</dt>
                    <dd className="mt-1 text-red-700">{recording.failure_message}</dd>
                  </div>
                )}
              </dl>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
