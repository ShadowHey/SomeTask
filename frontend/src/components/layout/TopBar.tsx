"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export function TopBar() {
  const { user, logout } = useAuth();

  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-40 w-full">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              <Link href="/home" className="flex items-center gap-2 text-xl font-bold text-blue-600 font-[family-name:var(--font-jakarta)] tracking-tight">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <path d="M2 13v2a2 2 0 0 0 4 0V5a2 2 0 0 1 4 0v14a2 2 0 0 0 4 0V5a2 2 0 0 1 4 0v10a2 2 0 0 0 4 0v-2" />
                </svg>
                VOICY
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500 hidden sm:block">
              {user?.email}
            </span>
            <button
              onClick={logout}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
