"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-gray-100 px-4 text-center">
      <div className="w-full max-w-3xl space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
            Audio Notes Platform
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-gray-500">
            Upload your meetings, lectures, and voice memos. Get high-quality transcriptions and intelligent summaries instantly.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <Link
            href="/register"
            className="w-full sm:w-auto rounded-lg bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto rounded-lg bg-white px-8 py-3.5 text-base font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            Sign In
          </Link>
        </div>
        
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3 text-left">
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Secure Storage</h3>
            <p className="mt-2 text-sm text-gray-500">Your audio is uploaded directly to secure Cloudflare R2 object storage.</p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Fast Transcription</h3>
            <p className="mt-2 text-sm text-gray-500">Powered by Gnani STT for high-accuracy, multi-lingual transcription.</p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Smart Summaries</h3>
            <p className="mt-2 text-sm text-gray-500">Google Gemini analyzes your transcripts to highlight key takeaways.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
