"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadModal } from "@/components/upload/UploadModal";

export default function Home() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="px-4 sm:px-0 h-full flex flex-col items-center justify-center py-20">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold leading-9 text-gray-900 sm:text-4xl sm:tracking-tight mb-4">
          Your Audio Notes
        </h1>
        <p className="text-lg text-gray-500 mb-8">
          Upload new audio to get it transcribed and summarized.
        </p>
        
        <div className="rounded-xl border-2 border-dashed border-gray-300 p-12 bg-white flex flex-col items-center">
          <div className="mb-6 bg-blue-50 p-4 rounded-full">
            <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all hover:scale-105 active:scale-95"
          >
            Upload Audio
          </button>
        </div>
      </div>

      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onUploadSuccess={() => {
          router.push('/transcripts');
        }} 
      />
    </div>
  );
}
