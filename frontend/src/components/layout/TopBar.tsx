"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/Avatar";

export function TopBar() {
  const { user, profile, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
            {profile && (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-2 focus:outline-none"
                >
                  <Avatar avatarId={profile?.avatar_id} className="w-9 h-9 shadow-sm" />
                  <svg className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50 overflow-hidden divide-y divide-gray-100">
                      <div className="px-4 py-4 flex items-center space-x-3 bg-gray-50/50">
                        <Avatar avatarId={profile?.avatar_id} className="w-12 h-12" />
                        <div className="flex flex-col overflow-hidden">
                          {profile?.username && (
                            <span className="text-sm font-semibold text-gray-900 truncate">
                              @{profile.username}
                            </span>
                          )}
                          <span className="text-xs text-gray-500 truncate" title={user?.email || ""}>
                            {user?.email}
                          </span>
                        </div>
                      </div>
                      <div className="py-1">
                        <Link
                          href="/profile"
                          onClick={() => setIsDropdownOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Profile
                        </Link>
                        <Link
                          href="#"
                          onClick={() => setIsDropdownOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Settings
                        </Link>
                      </div>
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            logout();
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {!profile && (
              <button
                onClick={logout}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
