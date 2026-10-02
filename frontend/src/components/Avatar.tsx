import React from "react";

export const AVATARS = [
  { id: "avatar-01", src: "/avatars/avatar-01.jpeg" },
  { id: "avatar-02", src: "/avatars/avatar-02.jpeg" },
  { id: "avatar-03", src: "/avatars/avatar-03.jpeg" },
  { id: "avatar-04", src: "/avatars/avatar-04.jpeg" },
  { id: "avatar-05", src: "/avatars/avatar-05.jpeg" },
  { id: "avatar-06", src: "/avatars/avatar-06.jpeg" },
];

interface AvatarProps {
  avatarId?: string | null;
  className?: string;
  onClick?: () => void;
}

export function Avatar({ avatarId, className = "w-8 h-8", onClick }: AvatarProps) {
  const avatar = AVATARS.find((a) => a.id === avatarId);

  if (!avatar) {
    return (
      <div
        onClick={onClick}
        className={`flex items-center justify-center bg-gray-100 text-gray-500 rounded-full border border-gray-200 overflow-hidden cursor-default flex-shrink-0 transition-colors ${className} ${
          onClick ? "cursor-pointer hover:bg-gray-200" : ""
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="w-1/2 h-1/2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
          />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={avatar.src}
      alt="User avatar"
      onClick={onClick}
      className={`rounded-full object-cover border border-gray-200 flex-shrink-0 transition-opacity ${className} ${
        onClick ? "cursor-pointer hover:opacity-90" : ""
      }`}
    />
  );
}
