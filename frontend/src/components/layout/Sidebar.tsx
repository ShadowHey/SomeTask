"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname();

  const navItems = [
    {
      name: "Home",
      href: "/home",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    {
      name: "Ask AI",
      href: "/ask-ai",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      name: "All Transcripts",
      href: "/transcripts",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      name: "Logs",
      href: "/logs",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      )
    },
    {
      name: "Usage",
      href: "/usage",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      )
    }
  ];

  const profileItem = {
    name: "Profile",
    href: "/profile",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  };

  return (
    <aside 
      className={`relative bg-[#0d1629] text-gray-300 flex flex-col transition-all duration-300 ease-in-out border-r border-gray-800 z-50 h-full ${
        isExpanded ? "w-60" : "w-[72px]"
      }`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3.5 top-6 bg-white border border-gray-200 rounded-full p-1 text-gray-500 hover:text-gray-700 shadow-sm z-10"
      >
        <svg 
          className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-0" : "rotate-180"}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex-1 py-6 px-3 flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <div key={item.name} className="relative group">
              <Link
                href={item.href}
                className={`flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive 
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" 
                    : "hover:bg-gray-800/50 hover:text-white border border-transparent"
                } ${!isExpanded ? "justify-center" : ""}`}
              >
                {item.icon}
                {isExpanded && <span className="font-medium text-sm whitespace-nowrap">{item.name}</span>}
              </Link>
              {!isExpanded && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden group-hover:block z-50">
                  <div className="bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded shadow-lg whitespace-nowrap">
                    {item.name}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-gray-800">
        <div className="relative group">
          <Link
            href={profileItem.href}
            className={`flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition-colors ${
              pathname.startsWith(profileItem.href)
                ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" 
                : "hover:bg-gray-800/50 hover:text-white border border-transparent"
            } ${!isExpanded ? "justify-center" : ""}`}
          >
            {profileItem.icon}
            {isExpanded && <span className="font-medium text-sm whitespace-nowrap">{profileItem.name}</span>}
          </Link>
          {!isExpanded && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden group-hover:block z-50">
              <div className="bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded shadow-lg whitespace-nowrap">
                {profileItem.name}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
