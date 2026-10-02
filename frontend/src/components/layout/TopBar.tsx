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
              <Link href="/home" className="text-xl font-bold text-blue-600">
                Audio Notes
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
