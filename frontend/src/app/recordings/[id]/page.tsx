"use client";

import { useCallback, useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { RecordingDetail, TranscriptSearchResult } from "@/types";
import { useAuth } from "@/components/AuthProvider";
import { AskAI } from "@/components/recordings/AskAI";

// --- Icons ---
const SparklesIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);
const SearchIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const CopyIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);
const ClockIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const CalendarIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const TrashIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const EditIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

// --- Helpers ---
const formatDuration = (seconds?: number | null) => {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const formatTimeMs = (ms?: number | null) => {
  if (ms == null) return '--:--';
  return formatDuration(ms / 1000);
};

const speakerColors = [
  "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-fuchsia-500", 
  "bg-rose-500", "bg-orange-500", "bg-emerald-500", "bg-cyan-500"
];
const getSpeakerColor = (id: number | null | undefined) => {
  if (id == null) return "bg-gray-400";
  return speakerColors[id % speakerColors.length];
};

// --- Components ---
const WaveformVisualizer = ({ isPlaying }: { isPlaying: boolean }) => {
  return (
    <div className="flex items-center gap-[4px] h-16 opacity-80">
      {Array.from({ length: 28 }).map((_, i) => {
        const height = 20 + Math.sin(i * 0.5) * 15 + Math.cos(i * 1.2) * 10 + 20;
        return (
          <div 
            key={i}
            className={`w-1.5 rounded-full ${isPlaying ? 'bg-indigo-500' : 'bg-gray-300'}`}
            style={{ 
              height: `${height}%`,
              transition: 'height 0.2s ease, background-color 0.3s ease',
              animationName: isPlaying ? 'waveformPulse' : 'none',
              animationDuration: '1s',
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
              animationDirection: 'alternate',
              animationDelay: `${i * 0.04}s`
            }}
          />
        );
      })}
    </div>
  );
};


export default function RecordingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { isLoading: isAuthLoading } = useAuth();
  
  const [recording, setRecording] = useState<RecordingDetail | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TranscriptSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const fetchRecording = useCallback(async () => {
    try {
      const data = await api.recordings.get(id);
      setRecording(data);
      setEditName(data.original_filename);
      
      if (data.status !== "created" && data.status !== "uploading") {
        try {
          const response = await api.recordings.getAudioUrl(id);
          setAudioUrl(response.url);
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
  }, [id]);

  useEffect(() => {
    if (isAuthLoading) return;
    const timer = window.setTimeout(() => void fetchRecording(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchRecording, isAuthLoading]);

  // Handle auto-refreshing while generating
  useEffect(() => {
    if (!recording) return;

    const isTranscribing = !["transcription_completed", "transcription_failed", "failed"].includes(recording.status);
    const isSummarizing = recording.summary_status === "queued" || recording.summary_status === "processing";
    
    if (isTranscribing || isSummarizing) {
      const interval = window.setInterval(() => void fetchRecording(), 5_000);
      return () => window.clearInterval(interval);
    }
  }, [recording, fetchRecording]);

  useEffect(() => {
    const doSearch = async () => {
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
    const timer = setTimeout(doSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, id]);

  const handleGenerateSummary = async () => {
    try {
      setIsGeneratingSummary(true);
      const updated = await api.recordings.generateSummary(id);
      setRecording(updated);
    } catch (err) {
      console.error("Summary request failed", err);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleRename = async () => {
    if (!editName.trim() || editName === recording?.original_filename) {
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
      router.push("/transcripts");
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to delete recording");
    }
  };

  const jumpToTime = (ms: number | null) => {
    if (ms !== null && audioRef.current) {
      audioRef.current.currentTime = ms / 1000;
      audioRef.current.play();
    }
  };

  const handleCopyTranscript = () => {
    if (!recording) return;
    const text = recording.transcript_segments.map(s => s.text).join(" ");
    navigator.clipboard.writeText(text);
    alert("Transcript copied to clipboard!");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-gray-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 shadow-sm border border-gray-100 text-center">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Recording not found</h2>
          <p className="text-gray-500 text-sm mb-6">{error || "This recording may have been deleted or is unavailable."}</p>
          <Link href="/transcripts" className="inline-flex items-center justify-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
            Return to Transcripts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes waveformPulse {
          0% { transform: scaleY(0.6); opacity: 0.6; }
          100% { transform: scaleY(1.4); opacity: 1; }
        }
        /* Custom scrollbar for a cleaner look */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
      
      <div className="h-screen bg-[#fafafa] flex flex-col font-sans overflow-hidden">
        
        {/* Header */}
        <header className="shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-md shadow-sm z-20">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <Link href="/transcripts" className="text-gray-400 hover:text-gray-900 transition-colors shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
              </Link>
              <div className="h-5 w-px bg-gray-200 shrink-0"></div>
              
              {isEditingName ? (
                <div className="flex items-center space-x-2 flex-1 max-w-md">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                  />
                  <button onClick={handleRename} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 px-2">Save</button>
                  <button onClick={() => setIsEditingName(false)} className="text-sm font-medium text-gray-500 hover:text-gray-700 px-2">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center space-x-3 min-w-0">
                  <h1 className="text-sm font-semibold text-gray-900 truncate">{recording.original_filename}</h1>
                  <button onClick={() => setIsEditingName(true)} className="text-gray-400 hover:text-indigo-600 transition-colors shrink-0 p-1">
                    <EditIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex items-center ml-4 shrink-0">
              <button
                onClick={handleDelete}
                className="text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
              >
                <TrashIcon className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 overflow-hidden flex">
          <div className="flex flex-col lg:flex-row gap-6 items-start relative w-full h-full">
            
            {/* LEFT SIDEBAR */}
            <div className="w-full lg:w-[320px] xl:w-[360px] flex-shrink-0 flex flex-col space-y-6 h-full pb-8 pr-2">
               
               {/* Recording Identity Card */}
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col group transition-shadow hover:shadow-md">
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex flex-wrap gap-2 mb-5">
                      <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-widest ring-1 ring-emerald-600/20">
                        {recording.status.replace(/_/g, ' ')}
                      </span>
                      {recording.resolved_language && (
                        <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-widest ring-1 ring-blue-600/20">
                          {recording.resolved_language}
                        </span>
                      )}
                    </div>
                    
                    <h2 className="text-base font-semibold text-gray-900 leading-snug mb-1 truncate" title={recording.recording_name || recording.original_filename}>
                      {recording.recording_name || recording.original_filename}
                    </h2>
                    
                    <div className="flex-1 min-h-[120px] flex items-center justify-center my-4">
                       <WaveformVisualizer isPlaying={isPlaying} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs font-medium text-gray-500 pt-4 border-t border-gray-100/80">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        <span>{new Date(recording.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-gray-400" />
                        <span>{formatDuration(recording.duration_seconds)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Native Audio Player integrated cleanly */}
                  <div className="bg-gray-50/80 p-3 border-t border-gray-100">
                    {audioUrl ? (
                      <audio 
                        ref={audioRef} 
                        controls 
                        controlsList="nodownload"
                        className="w-full h-10 rounded outline-none" 
                        src={audioUrl}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                      />
                    ) : (
                      <div className="h-10 flex items-center justify-center text-xs font-medium text-gray-400">
                        Audio track processing...
                      </div>
                    )}
                  </div>
               </div>

               {/* Ask AI Card */}
               <AskAI recordingId={recording.id} />
            </div>

            {/* RIGHT MAIN CONTENT */}
            <div className="flex-1 min-w-0 flex flex-col space-y-6 w-full h-full pb-8">
               
               {/* Transcript Card */}
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col flex-1 min-h-0 overflow-hidden">
                  
                  {/* Sticky Header */}
                  <div className="sticky top-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white/95 backdrop-blur z-10 shrink-0">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">Transcript</h2>
                    <div className="flex items-center gap-3">
                      <div className="relative hidden sm:block group">
                         <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors" />
                         <input 
                           type="text"
                           placeholder="Search..."
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                           className="pl-9 pr-4 py-1.5 text-sm text-gray-900 rounded-full border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none w-40 transition-all focus:w-64 bg-gray-50 focus:bg-white"
                         />
                      </div>
                      <button onClick={handleCopyTranscript} title="Copy Transcript" className="text-gray-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition-colors">
                        <CopyIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 overflow-y-auto px-4 py-2 styled-scrollbar">
                    {recording.transcript_segments.length > 0 ? (
                      <div className="space-y-1 pb-6">
                        {(searchQuery && searchResults.length > 0 ? searchResults : recording.transcript_segments).map((segment: any) => {
                          const isSearchRes = "segment_id" in segment;
                          const key = isSearchRes ? segment.segment_id : segment.id;
                          return (
                            <div 
                              key={key} 
                              className="flex gap-4 p-4 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group" 
                              onClick={() => jumpToTime(segment.start_ms)}
                            >
                              <div className="flex flex-col items-center gap-2 w-14 shrink-0 pt-0.5">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${getSpeakerColor(segment.speaker_id)} ring-2 ring-white`}>
                                  {segment.speaker_id !== null && segment.speaker_id !== undefined ? `S${segment.speaker_id}` : 'AI'}
                                </div>
                                <span className="text-[10px] text-gray-400 font-medium tracking-wider group-hover:text-indigo-600 transition-colors">
                                  {formatTimeMs(segment.start_ms)}
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                                  {segment.speaker_id !== null && segment.speaker_id !== undefined ? `Speaker ${segment.speaker_id}` : 'Unknown Speaker'}
                                </div>
                                <p className="text-gray-800 leading-relaxed text-[15px]">
                                  {segment.text}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        {recording.status === "completed" || recording.status === "transcription_completed" 
                          ? <p>No transcript generated (could be silent audio).</p>
                          : (
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin"></div>
                              <p className="text-sm">Transcribing audio...</p>
                            </div>
                          )
                        }
                      </div>
                    )}
                  </div>
               </div>
               
               {/* Summary Card */}
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shadow-inner">
                         <SparklesIcon className="w-4 h-4 text-indigo-600" />
                      </div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">Summary</h2>
                    </div>
                    {recording.summary_status === 'processing' && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-white px-2.5 py-1 rounded-full animate-pulse ring-1 ring-indigo-200 shadow-sm uppercase tracking-widest">
                        Generating...
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 md:p-8 styled-scrollbar">
                    {recording.summary ? (
                       <div className="prose prose-sm prose-indigo max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                         {recording.summary}
                       </div>
                    ) : recording.summary_status === 'failed' ? (
                       <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                         <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                         </svg>
                         Summary generation failed. The transcript is still available above.
                       </div>
                    ) : (
                       <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-4">
                         <div className="w-8 h-8 border-2 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
                         <p className="text-sm font-medium text-gray-500">Analyzing conversation and generating smart summary...</p>
                       </div>
                    )}
                  </div>
               </div>
               
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
