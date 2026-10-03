import React from "react";


export const metadata = {
  title: "Architecture - VOICY",
  description: "End-to-end technical documentation of the VOICY application architecture.",
};

export default function ArchitecturePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 pb-8 md:px-8 md:pb-12">
        <header className="mb-12 border-b border-gray-200 pb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">System Architecture</h1>
          <p className="text-lg text-gray-600">
            Technical documentation covering the end-to-end implementation of the VOICY platform, including processing flows, background jobs, and data architecture.
          </p>
        </header>

        <div className="space-y-16">
          {/* 1. SYSTEM OVERVIEW */}
          <section id="overview" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 0 0-.12-1.03l-2.268-9.64a3.375 3.375 0 0 0-3.285-2.602H7.923a3.375 3.375 0 0 0-3.285 2.602l-2.268 9.64a4.5 4.5 0 0 0-.12 1.03v.228m19.5 0a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3m19.5 0a3 3 0 0 0-3-3H5.25a3 3 0 0 0-3 3m16.5 0h.008v.008h-.008v-.008Zm-3 0h.008v.008h-.008v-.008Z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">1. System Overview</h2>
            </div>
            <div className="prose prose-indigo max-w-none text-gray-700 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p>
                VOICY is a full-stack web application designed to securely store, transcribe, and summarize audio recordings. The system operates entirely on a decoupled frontend/backend architecture.
              </p>
              <p>
                The frontend is built with Next.js 14 (React) and communicates via REST API with a FastAPI backend. Authentication and file storage are managed through Supabase. For intensive tasks like transcription and summarization, the FastAPI backend relies on a Redis-backed background worker queue using ARQ, orchestrating external calls to Gnani AI (for Speech-to-Text) and Google Gemini (for summarization). Data persistence is handled by PostgreSQL using SQLAlchemy.
              </p>
            </div>
          </section>

          {/* ARCHITECTURE MAP */}
          <section id="architecture-map" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Technical Architecture Map</h2>
            </div>
            
            <div className="w-full bg-slate-50 border border-gray-200 rounded-2xl p-8 overflow-x-auto shadow-sm mb-16">
              <div className="min-w-[800px] flex flex-col items-center font-mono text-sm relative z-10 py-4">
                
                {/* USER */}
                <div className="flex flex-col items-center">
                  <div className="border-2 border-slate-800 bg-white px-6 py-2 shadow-[4px_4px_0px_#1e293b] font-bold text-lg rounded-lg">
                    👤 USER
                  </div>
                  <div className="h-10 border-l-2 border-slate-800 relative">
                    <div className="absolute -bottom-1 -left-[5px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
                    <div className="absolute top-2 ml-3 bg-slate-50 px-2 text-xs text-slate-600 whitespace-nowrap font-sans">Uploads Audio</div>
                  </div>
                </div>

                {/* FRONTEND */}
                <div className="flex flex-col items-center relative w-full mt-1">
                  <div className="w-80 border-2 border-slate-800 bg-blue-50 p-4 shadow-[4px_4px_0px_#1e293b] rounded-xl text-center z-10 relative">
                    <div className="font-bold text-blue-900 text-base">VOICY FRONTEND</div>
                    <div className="text-xs text-blue-700 mt-1">frontend/src/app/...</div>
                    <div className="text-xs text-slate-600 mt-3 border-t border-blue-200 pt-2 flex justify-between font-sans">
                      <span>Request/Response</span>
                      <span>Polling UI</span>
                    </div>
                  </div>
                  
                  {/* Auth Connect */}
                  <div className="absolute left-1/2 -ml-[280px] top-4 flex items-center">
                    <div className="border-2 border-slate-800 bg-white p-3 rounded-lg shadow-[4px_4px_0px_#1e293b] text-center w-32">
                      <div className="font-bold text-xs text-slate-800">Authentication</div>
                      <div className="text-[10px] text-slate-500 font-sans">Supabase Auth</div>
                    </div>
                    <div className="w-16 border-t-2 border-slate-800 border-dashed relative">
                      <div className="absolute -right-1 -top-[5px] w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-slate-800"></div>
                    </div>
                  </div>
                </div>

                {/* Split from Frontend to Storage & API */}
                <div className="flex w-full max-w-3xl justify-center gap-24 relative mt-1">
                  {/* Storage Path */}
                  <div className="flex flex-col items-center w-48">
                    <div className="h-12 border-l-2 border-slate-800 border-dashed relative">
                      <div className="absolute -bottom-1 -left-[5px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
                      <div className="absolute top-2 -ml-28 bg-slate-50 px-2 text-[10px] text-slate-500 whitespace-nowrap text-right w-24 font-sans">Direct Binary<br/>Upload</div>
                    </div>
                    <div className="w-40 h-40 border-2 border-slate-800 bg-purple-50 p-4 shadow-[4px_4px_0px_#1e293b] rounded-full text-center flex flex-col justify-center items-center relative z-10">
                      <div className="font-bold text-purple-900 text-sm">STORAGE</div>
                      <div className="text-[10px] text-purple-700 mt-1 font-sans">Supabase Buckets</div>
                      <div className="text-[9px] text-red-600 mt-3 font-bold bg-white px-2 py-1 rounded border border-red-200 font-sans">Fail ➔ UI Error</div>
                    </div>
                  </div>

                  {/* API Path */}
                  <div className="flex flex-col items-center w-64">
                    <div className="h-12 border-l-2 border-slate-800 relative">
                      <div className="absolute -bottom-1 -left-[5px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
                      <div className="absolute top-2 ml-3 bg-slate-50 px-2 text-[10px] text-slate-500 whitespace-nowrap font-sans">POST /process</div>
                    </div>
                    <div className="w-full border-2 border-slate-800 bg-emerald-50 p-4 shadow-[4px_4px_0px_#1e293b] rounded-xl text-center relative z-10">
                      <div className="font-bold text-emerald-900 text-sm">BACKEND API</div>
                      <div className="text-[10px] text-emerald-700 mt-1">backend/app/api/...</div>
                      
                      {/* Database connection from API */}
                      <div className="absolute top-1/2 -right-[150px] -mt-[12px] flex items-center">
                        <div className="w-12 border-t-2 border-slate-800 relative">
                          <div className="absolute -right-1 -top-[5px] w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-slate-800"></div>
                        </div>
                        <div className="border-2 border-slate-800 bg-white p-3 rounded-xl shadow-[4px_4px_0px_#1e293b] text-center w-36 flex flex-col justify-center">
                          <div className="font-bold text-xs text-slate-800 border-b-2 border-slate-200 pb-1 mb-1 font-sans">PostgreSQL DB</div>
                          <div className="text-[10px] text-slate-600 font-sans leading-tight">AudioRecord, Profile, API Keys</div>
                        </div>
                      </div>
                    </div>

                    {/* ARQ Queue */}
                    <div className="h-12 border-l-2 border-slate-800 relative mt-1">
                      <div className="absolute -bottom-1 -left-[5px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
                      <div className="absolute top-2 ml-3 bg-slate-50 px-2 text-[10px] text-slate-500 whitespace-nowrap font-sans">Enqueues Job</div>
                    </div>
                    <div className="w-full border-2 border-slate-800 bg-amber-50 p-3 shadow-[4px_4px_0px_#1e293b] rounded-lg text-center z-10">
                      <div className="font-bold text-amber-900 text-sm">REDIS / ARQ QUEUE</div>
                      <div className="text-[9px] text-red-600 mt-1 font-bold font-sans">Enqueue Fail ➔ API 500</div>
                    </div>

                    {/* Background Worker */}
                    <div className="h-12 border-l-2 border-slate-800 relative mt-1">
                      <div className="absolute -bottom-1 -left-[5px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
                    </div>
                    <div className="w-72 border-2 border-slate-800 bg-rose-50 p-4 shadow-[4px_4px_0px_#1e293b] rounded-xl text-center z-10 relative">
                      <div className="font-bold text-rose-900 text-sm">BACKGROUND WORKER</div>
                      <div className="text-[10px] text-rose-700 mt-1">backend/app/workers/...</div>
                      <div className="text-[10px] text-slate-600 mt-2 border-t border-rose-200 pt-2 font-sans">Async processing & orchestration</div>

                      {/* System Logs connection */}
                      <div className="absolute top-1/2 -left-[140px] -mt-[12px] flex items-center">
                        <div className="border-2 border-slate-800 bg-gray-800 text-white p-3 rounded-lg shadow-[4px_4px_0px_#94a3b8] text-center w-28">
                          <div className="font-bold text-xs font-sans">System Logs</div>
                          <div className="text-[9px] text-gray-300 font-sans mt-1">Tracks failures</div>
                        </div>
                        <div className="w-12 border-t-2 border-slate-800 border-dashed relative">
                          <div className="absolute -left-1 -top-[5px] w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-r-[6px] border-r-slate-800"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Worker branches to Gnani, DB, and Gemini */}
                <div className="flex w-full max-w-4xl justify-center gap-4 relative mt-1">
                  
                  {/* Gnani STT */}
                  <div className="flex flex-col items-center w-1/3">
                    <div className="w-full h-12 border-l-2 border-t-2 border-slate-800 rounded-tl-xl ml-[50%] relative left-[25%]"></div>
                    <div className="h-6 border-l-2 border-slate-800 relative">
                      <div className="absolute -bottom-1 -left-[5px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
                    </div>
                    <div className="w-11/12 border-2 border-slate-800 bg-orange-50 p-4 shadow-[4px_4px_0px_#1e293b] rounded-xl text-center z-10">
                      <div className="font-bold text-orange-900 text-sm">GNANI STT</div>
                      <div className="text-[10px] text-orange-700 mt-1 font-sans">Batch API Integration</div>
                      <div className="text-[9px] text-red-600 mt-3 font-bold bg-white px-2 py-1 rounded border border-red-200 font-sans inline-block">API Fail ➔ Worker Retry</div>
                    </div>
                  </div>

                  {/* Transcript DB Segment */}
                  <div className="flex flex-col items-center w-1/3">
                    <div className="h-16 border-l-2 border-slate-800 relative">
                      <div className="absolute -bottom-1 -left-[5px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
                    </div>
                    <div className="w-40 h-32 border-2 border-slate-800 bg-white p-4 shadow-[4px_4px_0px_#1e293b] rounded-full text-center flex flex-col justify-center items-center z-10 mt-2">
                      <div className="font-bold text-slate-900 text-sm">TRANSCRIPT</div>
                      <div className="text-[10px] text-slate-500 mt-1 font-sans">Stored in DB</div>
                    </div>
                  </div>

                  {/* Gemini Summary */}
                  <div className="flex flex-col items-center w-1/3">
                    <div className="w-full h-12 border-r-2 border-t-2 border-slate-800 rounded-tr-xl mr-[50%] relative right-[25%]"></div>
                    <div className="h-6 border-l-2 border-slate-800 relative">
                      <div className="absolute -bottom-1 -left-[5px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
                    </div>
                    <div className="w-11/12 border-2 border-slate-800 bg-sky-50 p-4 shadow-[4px_4px_0px_#1e293b] rounded-xl text-center z-10">
                      <div className="font-bold text-sky-900 text-sm">GEMINI SUMMARY</div>
                      <div className="text-[10px] text-sky-700 mt-1 font-sans">Flash API</div>
                      <div className="text-[9px] text-red-600 mt-3 font-bold bg-white px-2 py-1 rounded border border-red-200 font-sans inline-block">Summary Fail ➔ Log</div>
                    </div>
                  </div>
                </div>

                {/* Final Path */}
                <div className="flex flex-col items-center mt-6 w-full">
                  <div className="h-12 border-l-2 border-slate-800 border-dashed relative">
                    <div className="absolute -bottom-1 -left-[5px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
                  </div>
                  <div className="w-96 border-2 border-slate-800 bg-white p-4 shadow-[4px_4px_0px_#1e293b] rounded-xl text-center z-10 mt-1">
                    <div className="font-bold text-slate-900 font-sans text-base">RECORDING DETAIL PAGE</div>
                    <div className="text-xs text-slate-500 mt-1 font-sans">Displays final Transcript & Summary to User</div>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* 3. END-TO-END PROCESSING FLOW */}
          <section id="processing-flow" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">2. End-to-End Processing Flow</h2>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <ol className="relative border-l border-gray-200 ml-3 space-y-6">
                <li className="pl-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-4 ring-white">
                    <span className="text-xs font-bold text-blue-600">1</span>
                  </span>
                  <h3 className="font-bold text-gray-900 mb-1">Audio Upload (Frontend)</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">frontend/src/lib/upload.ts</code> handles uploading directly to Supabase Storage via standard REST. The backend never receives the raw binary file to avoid memory bloat.
                  </p>
                </li>
                <li className="pl-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-4 ring-white">
                    <span className="text-xs font-bold text-blue-600">2</span>
                  </span>
                  <h3 className="font-bold text-gray-900 mb-1">Record Creation (API)</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">backend/app/api/routes/recordings.py</code> receives the Supabase storage path and creates an <code className="text-xs">AudioNote</code> record. It synchronously enqueues an ARQ background job and returns immediately.
                  </p>
                </li>
                <li className="pl-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-4 ring-white">
                    <span className="text-xs font-bold text-blue-600">3</span>
                  </span>
                  <h3 className="font-bold text-gray-900 mb-1">Gnani Transcription (Worker)</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">backend/app/workers/tasks.py</code> (<code className="text-xs">process_transcription</code>) downloads the file, chunks it if &gt;4 hours, and submits it to Gnani's Batch STT API. It either awaits a webhook or polls Gnani every 10 seconds for completion.
                  </p>
                </li>
                <li className="pl-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-4 ring-white">
                    <span className="text-xs font-bold text-blue-600">4</span>
                  </span>
                  <h3 className="font-bold text-gray-900 mb-1">Transcript Storage (Worker)</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Once transcribed, <code className="text-xs">_store_transcripts</code> parses Gnani's JSON, adjusts timestamps for chunks, and bulk-inserts <code className="text-xs">TranscriptSegment</code> rows into PostgreSQL. It marks the audio as complete and automatically queues the summary.
                  </p>
                </li>
                <li className="pl-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-4 ring-white">
                    <span className="text-xs font-bold text-blue-600">5</span>
                  </span>
                  <h3 className="font-bold text-gray-900 mb-1">Gemini Summary (Worker)</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">backend/app/workers/tasks.py</code> (<code className="text-xs">generate_summary</code>) reconstructs the transcript text and calls the Gemini API to generate a smart summary. Results are saved to the database.
                  </p>
                </li>
              </ol>
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                <strong>Failure Handling:</strong> Every stage executes inside a try/except block. Failures are written to the <code className="text-xs bg-gray-200 px-1 py-0.5 rounded">ProcessingJob</code> and <code className="text-xs bg-gray-200 px-1 py-0.5 rounded">AudioNote.failure_stage</code> columns. Retryable external errors automatically back off and retry.
              </div>
            </div>
          </section>

          {/* 3. FILE STORAGE */}
          <section id="file-storage" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">3. File Storage</h2>
            </div>
            <div className="prose prose-indigo max-w-none text-gray-700 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <ul className="space-y-2">
                <li><strong>Location:</strong> Files are stored securely in a private Supabase Storage bucket.</li>
                <li><strong>Path Generation:</strong> The path is generated on the frontend as <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">user_id/UUID_original_filename</code> to prevent collisions.</li>
                <li><strong>Backend Access:</strong> The backend retrieves a short-lived (expiry in config, typically 1 hour) presigned URL using the Supabase admin client to stream/download the file or pass it to APIs.</li>
                <li><strong>Gnani Access:</strong> Gnani is provided the presigned URL directly.</li>
                <li><strong>Failures:</strong> If file upload fails, the UI throws an immediate error. If the backend fails to fetch the file later, the background job marks the recording status as <code className="text-xs text-red-600">failed</code>.</li>
              </ul>
            </div>
          </section>

          {/* 4. LONG AUDIO HANDLING */}
          <section id="long-audio" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-100 rounded-lg">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">4. Long Audio Handling</h2>
            </div>
            <div className="prose prose-indigo max-w-none text-gray-700 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p>
                Gnani's Batch API enforces a strict 4-hour limit on audio files. VOICY natively supports processing audio beyond 4 hours through automated chunking implemented in <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">backend/app/workers/chunking.py</code>.
              </p>
              <ul>
                <li><strong>Probing:</strong> The worker streams the file using <code className="text-xs">httpx</code> to a temporary file and uses <code className="text-xs">ffmpeg.probe</code> to check duration.</li>
                <li><strong>Strategy:</strong> If duration &le; 14400 seconds (4 hours), no chunking occurs. If &gt; 4 hours, the file is split using <code className="text-xs">ffmpeg</code> into exactly 3.5-hour chunks to safely stay under limits.</li>
                <li><strong>Processing:</strong> Each chunk is uploaded to Supabase Storage as a separate part (e.g., <code className="text-xs">_part0.mp3</code>), and presigned URLs are generated for each chunk.</li>
                <li><strong>Orchestration:</strong> All chunk URLs are submitted to Gnani simultaneously. The worker polls all Job IDs. Once all complete, the backend applies the precise millisecond offsets to combine the returned transcripts sequentially.</li>
              </ul>
            </div>
          </section>

          {/* 5. SYNCHRONOUS VS BACKGROUND */}
          <section id="sync-vs-async" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-teal-100 rounded-lg">
                <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">5. Synchronous vs Background Processing</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-3 border-b pb-2">Synchronous (API Requests)</h3>
                <ul className="text-sm text-gray-700 space-y-2 list-disc pl-4">
                  <li>User authentication and session validation</li>
                  <li>CRUD operations for user profiles and tags</li>
                  <li>Fetching transcripts, summaries, and history</li>
                  <li>Securely decrypting API keys from DB</li>
                  <li>Validating storage paths and enqueueing jobs</li>
                </ul>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-3 border-b pb-2">Asynchronous (ARQ Workers)</h3>
                <ul className="text-sm text-gray-700 space-y-2 list-disc pl-4">
                  <li>Audio duration probing and FFmpeg chunking</li>
                  <li>Gnani transcription API submission & polling</li>
                  <li>Parsing massive transcription JSON payloads</li>
                  <li>Google Gemini summary generation</li>
                  <li>System Logging and Usage Record generation</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 6. DATABASE ARCHITECTURE */}
          <section id="database" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">6. Database Architecture</h2>
            </div>
            <div className="prose prose-indigo max-w-none text-gray-700 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-3 px-4 font-bold text-gray-900">Model</th>
                    <th className="py-3 px-4 font-bold text-gray-900">Responsibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3 px-4 font-mono font-medium text-indigo-600">AudioNote</td>
                    <td className="py-3 px-4">Core entity representing a recording. Stores metadata, storage paths, explicit statuses (<code className="text-xs">created, uploading, queued, failed...</code>), and the final AI summary.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono font-medium text-indigo-600">TranscriptSegment</td>
                    <td className="py-3 px-4">Stores individual timestamped transcript lines. Mapped one-to-many from <code className="text-xs">AudioNote</code>. Heavily queried for UI rendering.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono font-medium text-indigo-600">ProcessingJob</td>
                    <td className="py-3 px-4">Tracks ARQ background worker jobs. Maintains provider job IDs (Gnani), retry attempts, raw JSON responses, and error traces.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono font-medium text-indigo-600">UserApiKeys</td>
                    <td className="py-3 px-4">Stores symmetrically encrypted (Fernet) BYOK API keys for Gemini and Gnani, and preferences for using system defaults.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono font-medium text-indigo-600">SystemLog & UsageRecord</td>
                    <td className="py-3 px-4">Immutable audit trails for UI timeline logs and cost/duration usage ledgers. Separates metrics from application state.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 7. API / BACKEND ARCHITECTURE */}
          <section id="api-architecture" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 0 0-.12-1.03l-2.268-9.64a3.375 3.375 0 0 0-3.285-2.602H7.923a3.375 3.375 0 0 0-3.285 2.602l-2.268 9.64a4.5 4.5 0 0 0-.12 1.03v.228m19.5 0a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3m19.5 0a3 3 0 0 0-3-3H5.25a3 3 0 0 0-3 3m16.5 0h.008v.008h-.008v-.008Zm-3 0h.008v.008h-.008v-.008Z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">7. API / Backend Architecture</h2>
            </div>
            <div className="prose prose-indigo max-w-none text-gray-700 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p>The FastAPI backend leverages asynchronous routing and SQLAlchemy 2.0 async sessions.</p>
              <ul>
                <li><strong><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">POST /api/recordings/upload</code></strong>: Initializes an <code className="text-xs">AudioNote</code>, enqueues the <code className="text-xs">process_transcription</code> worker job, and returns the ID.</li>
                <li><strong><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">GET /api/recordings/{"{id}"}</code></strong>: Fetches the recording, transcript segments (ordered), and summaries.</li>
                <li><strong><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">POST /api/recordings/{"{id}"}/summary</code></strong>: Manual fallback endpoint to queue Gemini summarization for legacy recordings.</li>
                <li><strong><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">GET /api/logs</code></strong>: Serves paginated, strictly-typed system logs for the frontend audit dashboard.</li>
                <li><strong><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">PUT /api/profiles/keys</code></strong>: Securely accepts plaintext API keys, encrypts them in-memory, and persists to DB.</li>
              </ul>
            </div>
          </section>

          {/* 8. EXTERNAL SERVICES */}
          <section id="external-services" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-rose-100 rounded-lg">
                <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">8. External Services</h2>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                <strong className="block text-gray-900 mb-1">Gnani AI</strong>
                <p className="text-sm text-gray-600">Used strictly via their Batch STT API for transcription. The 60s REST endpoint is completely bypassed.</p>
              </div>
              <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                <strong className="block text-gray-900 mb-1">Google Gemini</strong>
                <p className="text-sm text-gray-600">Provides post-transcription summarization using the <code className="text-xs">google-genai</code> Python SDK.</p>
              </div>
              <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                <strong className="block text-gray-900 mb-1">Supabase (Storage & Auth)</strong>
                <p className="text-sm text-gray-600">Handles OAuth/Email authentication and S3-compatible private file storage for raw audio.</p>
              </div>
              <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                <strong className="block text-gray-900 mb-1">Redis & PostgreSQL</strong>
                <p className="text-sm text-gray-600">Redis serves the ARQ queue mechanism. PostgreSQL handles all relational data storage.</p>
              </div>
            </div>
          </section>

          {/* 9. ERROR HANDLING */}
          <section id="error-handling" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2.25m0 4.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">9. Error Handling</h2>
            </div>
            <div className="prose prose-indigo max-w-none text-gray-700 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p>Failures are localized and actively visible to the user via UI banners and the System Logs page.</p>
              <ul>
                <li><strong>Retry Mechanics:</strong> Transient errors in Gnani/Gemini (rate limits, 5xx) raise a <code className="text-xs">retryable=True</code> exception. ARQ automatically retries at intervals defined in <code className="text-xs">tasks.py</code> (1m, 5m, 10m).</li>
                <li><strong>Terminal Failures:</strong> Permanent errors (400 Bad Request, invalid file type) halt the queue. The <code className="text-xs">ProcessingJob</code> gets a <code className="text-xs">failed</code> status, and the failure message is exposed in <code className="text-xs">SystemLogs</code>.</li>
                <li><strong>Isolation:</strong> A failure during summary generation does <em>not</em> rollback the successful transcription. The UI explicitly handles <code className="text-xs">summary_status === 'failed'</code> by preserving the transcript and showing a fallback generation button.</li>
              </ul>
            </div>
          </section>

          {/* 10. SECURITY */}
          <section id="security" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">10. Security Implementation</h2>
            </div>
            <div className="prose prose-indigo max-w-none text-gray-700 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <ul>
                <li><strong>API Key Encryption:</strong> Custom BYOK keys are encrypted at rest using Python cryptography <code className="text-xs">Fernet</code> (AES encryption). The encryption secret is passed via <code className="text-xs">ENCRYPTION_KEY</code> environment variable.</li>
                <li><strong>Zero-Trust Frontend:</strong> The API endpoints that fetch user profiles are heavily sanitized. The backend <em>never</em> returns decrypted or plaintext API keys to the frontend, verifying instead via booleans (e.g. <code className="text-xs">has_custom_gnani</code>).</li>
                <li><strong>Row Level Security:</strong> All endpoints enforce <code className="text-xs">Depends(get_current_user)</code>. Operations validate that <code className="text-xs">note.user_id == current_user.id</code> before proceeding.</li>
              </ul>
            </div>
          </section>

          {/* 11. LIMITATIONS & 12. FUTURE IMPROVEMENTS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section id="limitations" className="scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gray-200 rounded-lg">
                  <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">11. Current Limitations</h2>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
                <ul className="text-sm text-gray-700 space-y-3 list-disc pl-4">
                  <li><strong>Polling Dependency:</strong> Webhook infrastructure is implemented for Gnani, but polling is often the default path due to local NAT configurations blocking external webhooks.</li>
                  <li><strong>Single-Node Processing:</strong> FFmpeg audio chunking happens on the same hardware executing the FastAPI server/worker, which could CPU-starve the API if many 4-hour audio files are uploaded concurrently.</li>
                  <li><strong>No WebSocket Streams:</strong> The frontend relies on interval polling to update the transcript status UI rather than utilizing WebSockets or Server-Sent Events (SSE).</li>
                </ul>
              </div>
            </section>
            
            <section id="future" className="scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">12. Future Improvements</h2>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
                <ul className="text-sm text-gray-700 space-y-3 list-disc pl-4">
                  <li><strong>Dedicated Media Server:</strong> Offload FFmpeg audio chunking and processing to a dedicated AWS Lambda function or a highly scaled media-worker cluster to protect API availability.</li>
                  <li><strong>SSE Implementation:</strong> Replace frontend REST polling for job status with Server-Sent Events to reduce database load and provide immediate feedback.</li>
                  <li><strong>Caching Layer:</strong> Implement Redis caching for heavily accessed, immutable TranscriptSegments to reduce PostgreSQL sequential scans on the <code className="text-xs">recordings/[id]</code> page.</li>
                </ul>
              </div>
            </section>
          </div>

          {/* 13. REPOSITORY LINK */}
          <section id="repository" className="scroll-mt-8 pt-8 border-t border-gray-200">
            <div className="bg-indigo-900 text-white p-8 rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Source Code</h2>
                <p className="text-indigo-200">Explore the complete VOICY implementation on GitHub.</p>
              </div>
              <a 
                href="https://github.com/ShadowHey/SomeTask" 
                target="_blank" 
                rel="noopener noreferrer"
                className="shrink-0 bg-white text-indigo-900 hover:bg-indigo-50 font-bold py-3 px-6 rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                View GitHub Repository
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
              </a>
            </div>
          </section>

        </div>
      </div>
  );
}

function SparklesIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  );
}
