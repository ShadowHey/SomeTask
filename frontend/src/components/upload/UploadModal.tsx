"use client";

import { useState, useRef } from "react";
import { uploadAudioFile, UploadProgress } from "@/lib/upload";
import { TranscriptionConfig } from "@/types";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [config, setConfig] = useState<TranscriptionConfig>({
    language_code: "hi-IN,en-IN",
    with_diarization: false,
    num_speakers: 2,
    is_multi_channel: false,
    with_denoise: false,
  });

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

    try {
      setError(null);
      await uploadAudioFile(file, config, (progress) => {
        setUploadProgress(progress);
      });
      onUploadSuccess();
      setTimeout(() => {
        onClose();
        setUploadProgress(null);
        setFile(null);
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

              <div>
                <label className="block text-sm font-medium text-gray-700">Language Code</label>
                <select
                  value={config.language_code}
                  onChange={(e) => setConfig({ ...config, language_code: e.target.value })}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="en-IN">English (India)</option>
                  <option value="hi-IN">Hindi (India)</option>
                  <option value="hi-IN,en-IN">Hinglish (Hindi + English)</option>
                  <option value="ta-IN">Tamil (India)</option>
                  <option value="te-IN">Telugu (India)</option>
                  <option value="kn-IN">Kannada (India)</option>
                  <option value="mr-IN">Marathi (India)</option>
                  <option value="bn-IN">Bengali (India)</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  id="diarization"
                  type="checkbox"
                  checked={config.with_diarization}
                  onChange={(e) => setConfig({ ...config, with_diarization: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="diarization" className="block ml-2 text-sm text-gray-900">
                  Enable Speaker Diarization
                </label>
              </div>

              {config.with_diarization && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Number of Speakers</label>
                  <input
                    type="number"
                    min={1}
                    max={2}
                    value={config.num_speakers || 2}
                    onChange={(e) => setConfig({ ...config, num_speakers: parseInt(e.target.value) })}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white text-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Maximum 2 speakers supported.</p>
                </div>
              )}

              <div className="flex items-center">
                <input
                  id="denoise"
                  type="checkbox"
                  checked={config.with_denoise}
                  onChange={(e) => setConfig({ ...config, with_denoise: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="denoise" className="block ml-2 text-sm text-gray-900">
                  Enable Noise Reduction
                </label>
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
