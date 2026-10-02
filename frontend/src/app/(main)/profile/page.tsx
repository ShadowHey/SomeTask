"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, AVATARS } from "@/components/Avatar";
import { api } from "@/lib/api";

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [tempAvatarId, setTempAvatarId] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || "");
    }
  }, [profile]);

  const hasChanges = username !== (profile?.username || "");

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await api.profile.update({ username });
      await refreshProfile();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAvatar = async () => {
    if (!tempAvatarId || tempAvatarId === profile?.avatar_id) {
      setIsAvatarModalOpen(false);
      return;
    }
    try {
      await api.profile.update({ avatar_id: tempAvatarId });
      await refreshProfile();
      setIsAvatarModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to update avatar");
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
          Profile
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your profile information and avatar.
        </p>
      </div>

      <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-xl overflow-hidden">
        <div className="p-8 border-b border-gray-200 flex flex-col sm:flex-row items-center gap-6 bg-gray-50/50">
          <Avatar avatarId={profile?.avatar_id} className="w-24 h-24 ring-4 ring-white shadow-md" />
          <div className="flex flex-col items-center sm:items-start space-y-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user?.email?.split('@')[0]}</h2>
              {profile?.username && <p className="text-sm font-medium text-blue-600">@{profile.username}</p>}
            </div>
            <button
              onClick={() => {
                setTempAvatarId(profile?.avatar_id || null);
                setIsAvatarModalOpen(true);
              }}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
            >
              Change Avatar
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900">Account Information</h3>
          
          <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-8">
            <div>
              <label htmlFor="username" className="block text-sm font-medium leading-6 text-gray-900">
                Username
              </label>
              <div className="relative mt-2 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">@</span>
                </div>
                <input
                  type="text"
                  name="username"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="block w-full rounded-md border-0 py-2.5 pl-8 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  placeholder="username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
                Email
              </label>
              <div className="mt-2">
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="block w-full rounded-md border-0 py-2.5 text-gray-500 bg-gray-50 ring-1 ring-inset ring-gray-300 sm:text-sm sm:leading-6 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          {saveSuccess && <p className="text-sm text-green-600 font-medium">Profile updated successfully!</p>}

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className={`rounded-md px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors ${
                hasChanges && !isSaving ? "bg-blue-600 hover:bg-blue-500" : "bg-blue-300 cursor-not-allowed"
              }`}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {isAvatarModalOpen && (
        <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={() => setIsAvatarModalOpen(false)}></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                      <h3 className="text-lg font-semibold leading-6 text-gray-900" id="modal-title">
                        Choose your avatar
                      </h3>
                      <p className="mt-2 text-sm text-gray-500">
                        Pick a new avatar for your VOICY profile.
                      </p>
                      <div className="mt-8 grid grid-cols-3 gap-6 justify-items-center">
                        {AVATARS.map((a) => (
                          <div
                            key={a.id}
                            onClick={() => setTempAvatarId(a.id)}
                            className={`relative cursor-pointer rounded-full transition-transform hover:scale-105 ${
                              tempAvatarId === a.id ? "ring-4 ring-blue-600 ring-offset-2" : "ring-1 ring-gray-200"
                            }`}
                          >
                            <img src={a.src} alt={a.id} className="w-24 h-24 rounded-full object-cover" />
                            {tempAvatarId === a.id && (
                              <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1 shadow-sm border-2 border-white">
                                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    type="button"
                    onClick={handleSaveAvatar}
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                  >
                    Save Avatar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAvatarModalOpen(false)}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
