"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, AVATARS } from "@/components/Avatar";
import { api } from "@/lib/api";

export function OnboardingModal() {
  const { profile, refreshProfile, isLoading } = useAuth();
  const [step, setStep] = useState<"username" | "avatar">("username");
  const [username, setUsername] = useState("");
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if onboarding is needed
  const needsUsername = profile && !profile.username;
  const needsAvatar = profile && !profile.avatar_id;
  const isVisible = !isLoading && profile && (needsUsername || needsAvatar);

  useEffect(() => {
    if (needsUsername) {
      setStep("username");
    } else if (needsAvatar) {
      setStep("avatar");
    }
  }, [needsUsername, needsAvatar]);

  if (!isVisible) return null;

  const handleNext = () => {
    if (step === "username") {
      if (!username.trim() || username.length < 3) {
        setError("Username must be at least 3 characters long");
        return;
      }
      setError(null);
      setStep("avatar");
    }
  };

  const handleComplete = async () => {
    if (!avatarId && step === "avatar") {
      setError("Please select an avatar");
      return;
    }
    
    setIsSaving(true);
    setError(null);
    try {
      const updateData: any = {};
      if (needsUsername) updateData.username = username;
      if (needsAvatar) updateData.avatar_id = avatarId;
      
      await api.profile.update(updateData);
      await refreshProfile();
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative z-[100]" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm transition-opacity"></div>
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
          <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-gray-100">
            {step === "username" && (
              <div className="px-8 pt-8 pb-8">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold leading-6 text-gray-900 font-[family-name:var(--font-jakarta)] tracking-tight">
                    Welcome to VOICY
                  </h3>
                  <p className="mt-3 text-sm text-gray-500">
                    Let's set up your profile. First, choose a unique username.
                  </p>
                </div>
                
                <div>
                  <label htmlFor="onboarding-username" className="block text-sm font-medium leading-6 text-gray-900">
                    Username
                  </label>
                  <div className="relative mt-2 rounded-md shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-gray-400 sm:text-sm">@</span>
                    </div>
                    <input
                      type="text"
                      name="username"
                      id="onboarding-username"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                        setError(null);
                      }}
                      className="block w-full rounded-md border-0 py-3 pl-8 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                      placeholder="username"
                      autoFocus
                    />
                  </div>
                  {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </div>

                <div className="mt-8">
                  <button
                    onClick={handleNext}
                    className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === "avatar" && (
              <div className="px-8 pt-8 pb-8">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold leading-6 text-gray-900 font-[family-name:var(--font-jakarta)] tracking-tight">
                    Choose your avatar
                  </h3>
                  <p className="mt-3 text-sm text-gray-500">
                    Pick an avatar that feels like you.
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-6 justify-items-center mb-8">
                  {AVATARS.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => {
                        setAvatarId(a.id);
                        setError(null);
                      }}
                      className={`relative cursor-pointer rounded-full transition-transform hover:scale-105 ${
                        avatarId === a.id ? "ring-4 ring-blue-600 ring-offset-2" : "ring-1 ring-gray-200"
                      }`}
                    >
                      <img src={a.src} alt={a.id} className="w-24 h-24 rounded-full object-cover" />
                      {avatarId === a.id && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1 shadow-sm border-2 border-white">
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {error && <p className="mt-2 text-sm text-red-600 text-center mb-4">{error}</p>}

                <div className="mt-8 flex gap-3">
                  {needsUsername && (
                    <button
                      onClick={() => setStep("username")}
                      disabled={isSaving}
                      className="flex w-1/3 justify-center rounded-md bg-white px-3 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleComplete}
                    disabled={isSaving}
                    className={`flex ${needsUsername ? "w-2/3" : "w-full"} justify-center rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 transition-colors`}
                  >
                    {isSaving ? "Saving..." : "Complete Setup"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
