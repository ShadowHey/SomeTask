"use client";

import { useState, useRef } from "react";
import { uploadAudioFile, UploadProgress } from "@/lib/upload";
import { TranscriptionConfig } from "@/types";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

const SUPPORTED_LANGUAGES = [
  { code: "hi-IN", name: "Hindi" },
  { code: "en-IN", name: "English (India)" },
  { code: "bn-IN", name: "Bengali (India)" },
  { code: "kn-IN", name: "Kannada" },
  { code: "ml-IN", name: "Malayalam" },
  { code: "mr-IN", name: "Marathi" },
  { code: "ta-IN", name: "Tamil" },
  { code: "te-IN", name: "Telugu" },
];

export function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [lang1, setLang1] = useState("hi-IN");
  const [lang2, setLang2] = useState("");
  const [lang3, setLang3] = useState("");

  const [config, setConfig] = useState<TranscriptionConfig>({
    language_code: "hi-IN",
    with_diarization: false,
    num_speakers: 2,
    is_multi_channel: false,
    with_denoise: false,
  });

  const selectedCodes = [lang1, lang2, lang3].filter(Boolean);

  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    const finalConfig: TranscriptionConfig = {
      ...config,
      language_code: selectedCodes.join(","),
    };

    try {
      setError(null);
      await uploadAudioFile(file, finalConfig, (progress) => {
        setUploadProgress(progress);
      });
      onUploadSuccess();
      setTimeout(() => {
        onClose();
        setUploadProgress(null);
        setFile(null);
        setLang1("hi-IN");
        setLang2("");
        setLang3("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setTimeout(() => setUploadProgress(null), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={onClose} />
      
      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 sm:p-8 overflow-hidden transform transition-all text-left">
        <div>
          <h3 className="text-xl font-semibold leading-6 text-gray-900" id="modal-title">Upload Audio Note</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Audio File</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  accept=".wav,.mp3,.ogg,.flac,.aac,.m4a"
                />
              </div>

              {/* Language Identification Section */}
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/70 p-3.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-900">
                    Language Identification
                  </label>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {selectedCodes.length === 1 ? "1 language (Single)" : `${selectedCodes.length} candidate languages`}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Select up to 3 candidate languages. The 1st language acts as the fallback if identification confidence is low.
                </p>

                <div className="space-y-2">
                  {/* Primary Language */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      1. Primary / Fallback Language <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={lang1}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLang1(val);
                        if (lang2 === val) { setLang2(""); setLang3(""); }
                        else if (lang3 === val) { setLang3(""); }
                      }}
                      className="block w-full py-2 px-3 border border-gray-300 bg-white text-gray-900 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Secondary Language */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      2. Second Candidate Language (Optional)
                    </label>
                    <select
                      value={lang2}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLang2(val);
                        if (!val || lang3 === val) { setLang3(""); }
                      }}
                      className="block w-full py-2 px-3 border border-gray-300 bg-white text-gray-900 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">-- None (Only 1 language) --</option>
                      {SUPPORTED_LANGUAGES.filter((l) => l.code !== lang1).map((l) => (
                        <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Tertiary Language */}
                  {lang2 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        3. Third Candidate Language (Optional)
                      </label>
                      <select
                        value={lang3}
                        onChange={(e) => setLang3(e.target.value)}
                        className="block w-full py-2 px-3 border border-gray-300 bg-white text-gray-900 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- None --</option>
                        {SUPPORTED_LANGUAGES.filter((l) => l.code !== lang1 && l.code !== lang2).map((l) => (
                          <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-gray-200 text-xs text-gray-600">
                  <span className="font-medium text-gray-700">API payload code:</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-gray-200 font-mono text-blue-600 font-medium">
                    "{selectedCodes.join(",")}"
                  </code>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="diarization"
                  type="checkbox"
                  checked={config.with_diarization}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setConfig({ 
                      ...config, 
                      with_diarization: checked,
                      num_speakers: checked ? 2 : undefined
                    });
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="diarization" className="ml-2 text-sm text-gray-900 flex items-center gap-1.5 cursor-pointer select-none">
                  <span>Enable Speaker Diarization</span>
                </label>
                <div className="relative flex items-center group ml-1.5">
                  <button
                    type="button"
                    aria-label="Speaker Diarization info"
                    className="text-gray-400 hover:text-gray-600 focus:outline-none flex items-center justify-center cursor-help"
                  >
                    <span className="text-sm font-medium">ⓘ</span>
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block group-focus-within:block w-64 p-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none transition-all">
                    <p className="leading-relaxed">
                      Speaker Diarization separates distinct speakers in the transcript when two people are speaking. Currently, the API supports transcription for up to <strong>2 speakers</strong>.
                    </p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="denoise"
                  type="checkbox"
                  checked={config.with_denoise}
                  onChange={(e) => setConfig({ ...config, with_denoise: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="denoise" className="ml-2 text-sm text-gray-900 flex items-center gap-1.5 cursor-pointer select-none">
                  <span>Enable Noise Reduction</span>
                </label>
                <div className="relative flex items-center group ml-1.5">
                  <button
                    type="button"
                    aria-label="Noise Reduction info"
                    className="text-gray-400 hover:text-gray-600 focus:outline-none flex items-center justify-center cursor-help"
                  >
                    <span className="text-sm font-medium">ⓘ</span>
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block group-focus-within:block w-72 p-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none transition-all">
                    <p className="leading-relaxed">
                      Removes background noise before transcription and diarization. Recommended for noisy audio. Adds ~25% processing time, but billing remains based only on the audio duration, so denoising does not add any extra usage charges. Output format remains unchanged.
                    </p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {uploadProgress && (
            <div className={`mt-4 rounded-md p-4 border ${
              uploadProgress.status === 'error' ? 'bg-red-50 border-red-200' :
              uploadProgress.status === 'success' ? 'bg-green-50 border-green-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{uploadProgress.message}</span>
                <span className="text-sm font-medium text-gray-700">{uploadProgress.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full ${
                    uploadProgress.status === 'error' ? 'bg-red-600' :
                    uploadProgress.status === 'success' ? 'bg-green-600' :
                    'bg-blue-600'
                  } transition-all duration-300`} 
                  style={{ width: `${uploadProgress.progress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="mt-4 text-sm text-red-600">{error}</div>
          )}

          <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              disabled={!file || (uploadProgress !== null && uploadProgress.status !== 'success' && uploadProgress.status !== 'error')}
              className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              onClick={handleUpload}
            >
              Upload
            </button>
            <button
              type="button"
              className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
  );
}
