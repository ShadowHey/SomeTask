"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { RecordingListItem } from "@/types";
import { useAuth } from "@/components/AuthProvider";

export default function Transcripts() {
  const { isLoading: isAuthLoading } = useAuth();
  const [recordings, setRecordings] = useState<RecordingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<"recording_name" | "original_filename">("recording_name");
  
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);
  
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

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

  const uniqueTags = useMemo(() => {
     const tags = new Set<string>();
     recordings.forEach(r => r.tags?.forEach(t => tags.add(t.name)));
     return Array.from(tags).sort();
  }, [recordings]);

  const filteredRecordings = useMemo(() => {
    return recordings.filter(recording => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (searchField === "recording_name") {
           const val = recording.recording_name?.toLowerCase() || "";
           if (!val.includes(query)) return false;
        } else {
           const val = recording.original_filename.toLowerCase();
           if (!val.includes(query)) return false;
        }
      }
      
      // Tags
      if (selectedTags.length > 0) {
        const recordingTagNames = recording.tags?.map(t => t.name) || [];
        const hasAllTags = selectedTags.every(t => recordingTagNames.includes(t));
        if (!hasAllTags) return false;
      }
      
      // Date Range
      if (startDate || endDate) {
         const d = new Date(recording.created_at);
         if (startDate) {
            const start = new Date(startDate);
            start.setHours(0,0,0,0);
            if (d < start) return false;
         }
         if (endDate) {
            const end = new Date(endDate);
            end.setHours(23,59,59,999);
            if (d > end) return false;
         }
      }
      
      return true;
    });
  }, [recordings, searchQuery, searchField, selectedTags, startDate, endDate]);

  const clearFilters = () => {
     setSearchQuery("");
     setSearchField("recording_name");
     setSelectedTags([]);
     setStartDate("");
     setEndDate("");
  };

  return (
    <div className="px-4 sm:px-0 pb-16">
      <div className="mb-6 border-b border-gray-200 pb-5">
        <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight uppercase tracking-wider">
          All Transcripts
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Filters Row */}
      <div className="mb-8 flex flex-col lg:flex-row gap-4 items-start lg:items-center relative z-40">
        {/* Search */}
        <div className="flex items-center gap-2 border border-gray-200 bg-white rounded-lg p-1 shadow-sm w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search recordings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full border-0 py-1.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-0 bg-transparent"
            />
          </div>
          <div className="h-5 w-px bg-gray-200"></div>
          <select 
            value={searchField}
            onChange={(e) => setSearchField(e.target.value as any)}
            className="border-0 py-1.5 pl-2 pr-8 text-sm text-gray-600 focus:ring-0 bg-transparent cursor-pointer font-medium"
          >
            <option value="recording_name">Recording Name</option>
            <option value="original_filename">Audio Filename</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Tags Filter */}
          <div className="relative">
            <button 
              onClick={() => { setIsTagsDropdownOpen(!isTagsDropdownOpen); setIsDateDropdownOpen(false); }}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium shadow-sm transition-colors ${selectedTags.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
            </button>
            
            {isTagsDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsTagsDropdownOpen(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-2 max-h-60 overflow-y-auto">
                  {uniqueTags.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-gray-500 italic">No tags available</div>
                  ) : (
                    uniqueTags.map(tag => (
                      <label key={tag} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedTags.includes(tag)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTags([...selectedTags, tag]);
                            else setSelectedTags(selectedTags.filter(t => t !== tag));
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                        />
                        <span className="text-sm text-gray-700">#{tag}</span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Date Filter */}
          <div className="relative">
            <button 
              onClick={() => { setIsDateDropdownOpen(!isDateDropdownOpen); setIsTagsDropdownOpen(false); }}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium shadow-sm transition-colors ${(startDate || endDate) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {(startDate || endDate) ? (
                `${startDate ? new Date(startDate).toLocaleDateString() : 'Start'} → ${endDate ? new Date(endDate).toLocaleDateString() : 'End'}`
              ) : (
                'Date Range'
              )}
            </button>
            
            {isDateDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDateDropdownOpen(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
                      <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Clear Filters */}
          {(searchQuery || selectedTags.length > 0 || startDate || endDate) && (
            <button 
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      ) : filteredRecordings.length === 0 ? (
        <div className="text-center rounded-[1.5rem] border border-dashed border-gray-300 p-12 bg-white">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            {recordings.length === 0 ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            )}
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No transcripts found</h3>
          <p className="mt-1 text-sm text-gray-500">
             {recordings.length === 0 ? "Go to Home to upload an audio file." : "Try changing your search or clearing one of the filters."}
          </p>
          <div className="mt-6">
            {recordings.length === 0 ? (
              <Link
                href="/home"
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Upload Audio
              </Link>
            ) : (
              <button
                onClick={clearFilters}
                className="inline-flex items-center rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <ul role="list" className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 relative z-0">
          {filteredRecordings.map((recording) => (
            <li key={recording.id} className="col-span-1 rounded-[1.5rem] bg-white ring-1 ring-gray-900/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_2px_4px_rgba(0,0,0,0.02),0_8px_20px_rgba(0,0,0,0.04),0_16px_32px_rgba(0,0,0,0.02)] hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_4px_8px_rgba(0,0,0,0.03),0_12px_24px_rgba(0,0,0,0.05),0_24px_48px_rgba(0,0,0,0.04)] hover:-translate-y-[3px] transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] flex flex-col overflow-hidden relative group min-h-[440px]">
              <Link href={`/recordings/${recording.id}`} className="flex flex-col h-full p-8 relative z-30">
                
                {/* Top Section */}
                <div className="flex flex-col items-start gap-1 mb-6 relative z-10 w-full">
                  <h3 className={`truncate w-full text-2xl font-bold ${recording.recording_name ? 'text-gray-900' : 'text-gray-400 font-medium'}`}>
                    {recording.recording_name || 'NULL'}
                  </h3>
                  <p className="truncate w-full text-[13px] font-medium text-gray-500">
                    {recording.original_filename}
                  </p>
                </div>

                {/* Status and Language Row */}
                <div className="flex items-center justify-between mb-2 relative z-10 w-full">
                  <div className="rounded border border-gray-100 px-2 py-0.5 bg-gray-50/50 inline-flex items-center">
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                      {recording.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {recording.resolved_language && (
                    <div className="rounded border border-gray-100 px-2 py-0.5 bg-gray-50/50 inline-flex items-center">
                      <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                        {recording.resolved_language}
                      </span>
                    </div>
                  )}
                </div>

                {/* Center Logo Section */}
                <div className="flex-1 flex items-center justify-center relative z-0 py-6 my-2">
                  <div className="absolute inset-0 border border-gray-100 rounded-3xl opacity-50 m-2 pointer-events-none"></div>
                  <img src="/transcriptcardicon.png" alt="Voicy Logo" className="w-56 h-56 object-contain opacity-100 group-hover:scale-[1.03] transition-transform duration-500" />
                </div>

                {/* Bottom Section */}
                <div className="mt-auto flex items-center justify-between relative z-10 pt-4 w-full">
                  <div className="inline-flex">
                    <span className="text-xs font-semibold text-gray-500">
                      {new Date(recording.created_at).toLocaleDateString()} &middot; {new Date(recording.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {recording.duration_seconds != null ? (
                    <div className="inline-flex">
                      <span className="text-xs font-semibold text-gray-500">
                        {Math.floor(recording.duration_seconds / 60)}:
                        {(Math.round(recording.duration_seconds % 60)).toString().padStart(2, '0')}
                      </span>
                    </div>
                  ) : null}
                </div>

              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

