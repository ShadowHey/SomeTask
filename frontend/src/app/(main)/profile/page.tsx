"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, AVATARS } from "@/components/Avatar";
import { api } from "@/lib/api";

export default function Profile() {
  const { user, profile, refreshProfile, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [tempAvatarId, setTempAvatarId] = useState<string | null>(null);

  // API Keys State
  const [hasCustomGemini, setHasCustomGemini] = useState(false);
  const [hasCustomGnani, setHasCustomGnani] = useState(false);
  const [useDefaultGemini, setUseDefaultGemini] = useState(true);
  const [useDefaultGnani, setUseDefaultGnani] = useState(true);
  
  const [isEditingGemini, setIsEditingGemini] = useState(false);
  const [isEditingGnani, setIsEditingGnani] = useState(false);
  const [geminiInput, setGeminiInput] = useState("");
  const [gnaniInput, setGnaniInput] = useState("");
  
  const [isRemoveKeysModalOpen, setIsRemoveKeysModalOpen] = useState(false);

  // Original states for comparison
  const [initialUseDefaultGemini, setInitialUseDefaultGemini] = useState(true);
  const [initialUseDefaultGnani, setInitialUseDefaultGnani] = useState(true);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || "");
    }
  }, [profile]);

  const loadApiKeys = async () => {
    try {
      const keys = await api.profile.getKeys();
      setHasCustomGemini(keys.gemini.has_custom_key);
      setUseDefaultGemini(keys.gemini.use_default);
      setInitialUseDefaultGemini(keys.gemini.use_default);
      
      setHasCustomGnani(keys.gnani.has_custom_key);
      setUseDefaultGnani(keys.gnani.use_default);
      setInitialUseDefaultGnani(keys.gnani.use_default);
    } catch (err) {
      console.error("Failed to load API keys", err);
    }
  };

  useEffect(() => {
    loadApiKeys();
  }, []);

  const hasProfileChanges = username !== (profile?.username || "");
  const hasKeyChanges = 
    (isEditingGemini && geminiInput.trim() !== "") || 
    (isEditingGnani && gnaniInput.trim() !== "") ||
    useDefaultGemini !== initialUseDefaultGemini ||
    useDefaultGnani !== initialUseDefaultGnani;

  const hasChanges = hasProfileChanges || hasKeyChanges;

  const handleSave = async () => {
    // Validation
    if (!useDefaultGemini && !hasCustomGemini && (!isEditingGemini || !geminiInput.trim())) {
      setError("Please enter a Gemini API key or select Use Default.");
      return;
    }
    if (!useDefaultGnani && !hasCustomGnani && (!isEditingGnani || !gnaniInput.trim())) {
      setError("Please enter a Gnani API key or select Use Default.");
      return;
    }

    if (!hasChanges) return;
    
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      if (hasProfileChanges) {
        await api.profile.update({ username });
        await refreshProfile();
      }

      if (hasKeyChanges) {
        const keyUpdatePayload: any = {};
        if (isEditingGemini && geminiInput.trim()) {
          keyUpdatePayload.gemini_api_key = geminiInput.trim();
        }
        if (isEditingGnani && gnaniInput.trim()) {
          keyUpdatePayload.gnani_api_key = gnaniInput.trim();
        }
        if (useDefaultGemini !== initialUseDefaultGemini) {
          keyUpdatePayload.use_default_gemini = useDefaultGemini;
        }
        if (useDefaultGnani !== initialUseDefaultGnani) {
          keyUpdatePayload.use_default_gnani = useDefaultGnani;
        }
        
        await api.profile.updateKeys(keyUpdatePayload);
        await loadApiKeys();
        
        setIsEditingGemini(false);
        setIsEditingGnani(false);
        setGeminiInput("");
        setGnaniInput("");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save changes");
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
  
  const handleRemoveCustomKeys = async () => {
    try {
      await api.profile.removeKeys();
      await loadApiKeys();
      setIsRemoveKeysModalOpen(false);
    } catch (err: any) {
      setError(err.message || "Failed to remove custom keys");
      setIsRemoveKeysModalOpen(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8 pb-32">
      <div className="mb-8">
        <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
          Profile
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your profile information and avatar.
        </p>
      </div>

      <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-xl overflow-hidden mb-6">
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

        <div className="p-8 space-y-8">
          <div>
            <h3 className="text-base font-semibold leading-6 text-gray-900 mb-6">Account Information</h3>
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
                    className="block w-full rounded-md border-0 py-2.5 text-gray-500 bg-gray-50 ring-1 ring-inset ring-gray-300 sm:text-sm sm:leading-6 cursor-not-allowed px-3"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8 space-y-6">
            
            {/* Gemini API Key */}
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900 uppercase tracking-wider mb-2">
                Gemini API Key
              </label>
              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-lg relative rounded-md shadow-sm">
                  <input
                    type={isEditingGemini ? "text" : "password"}
                    value={isEditingGemini ? geminiInput : (hasCustomGemini && !useDefaultGemini ? "••••••••••••••••••••••••" : "")}
                    disabled={!isEditingGemini}
                    onChange={(e) => setGeminiInput(e.target.value)}
                    placeholder={isEditingGemini ? "Enter new Gemini API key" : ""}
                    className={`block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 ${!isEditingGemini ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isEditingGemini) {
                      setIsEditingGemini(false);
                      setGeminiInput("");
                    } else {
                      setIsEditingGemini(true);
                      setGeminiInput("");
                    }
                  }}
                  className="rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                >
                  {isEditingGemini ? "Cancel" : "Edit"}
                </button>
                <label className="flex items-center gap-2 cursor-pointer ml-2">
                  <input
                    type="checkbox"
                    checked={useDefaultGemini}
                    onChange={(e) => setUseDefaultGemini(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-900">use default</span>
                </label>
              </div>
            </div>

            {/* Gnani AI API Key */}
            <div className="pt-2">
              <label className="block text-sm font-medium leading-6 text-gray-900 uppercase tracking-wider mb-2">
                Gnani AI API Key
              </label>
              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-lg relative rounded-md shadow-sm">
                  <input
                    type={isEditingGnani ? "text" : "password"}
                    value={isEditingGnani ? gnaniInput : (hasCustomGnani && !useDefaultGnani ? "••••••••••••••••••••••••" : "")}
                    disabled={!isEditingGnani}
                    onChange={(e) => setGnaniInput(e.target.value)}
                    placeholder={isEditingGnani ? "Enter new Gnani API key" : ""}
                    className={`block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 ${!isEditingGnani ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isEditingGnani) {
                      setIsEditingGnani(false);
                      setGnaniInput("");
                    } else {
                      setIsEditingGnani(true);
                      setGnaniInput("");
                    }
                  }}
                  className="rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                >
                  {isEditingGnani ? "Cancel" : "Edit"}
                </button>
                <label className="flex items-center gap-2 cursor-pointer ml-2">
                  <input
                    type="checkbox"
                    checked={useDefaultGnani}
                    onChange={(e) => setUseDefaultGnani(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-900">use default</span>
                </label>
              </div>
            </div>

          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          {saveSuccess && <p className="text-sm text-green-600 font-medium">Profile changes saved successfully.</p>}

          <div className="pt-6 flex justify-end">
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
      
      {/* Footer Buttons */}
      <div className="flex justify-end items-center gap-4 mt-6">
        <button
          onClick={() => setIsRemoveKeysModalOpen(true)}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
        >
          Remove Custom Keys
        </button>
        <button
          onClick={logout}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
        >
          Sign Out
        </button>
      </div>
      {/* API Key Guide / Info Section */}
      <div className="mt-8 bg-white ring-1 ring-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full border-2 border-blue-600 flex items-center justify-center">
              <span className="text-blue-600 text-xs font-bold font-serif leading-none">i</span>
            </div>
            <h2 className="text-sm font-bold text-gray-900 tracking-wide uppercase">API Key Guide</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6 ml-7">Follow these steps to configure your Gemini and Gnani API keys.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              {/* HOW TO USE A CUSTOM KEY */}
              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">How to Use a Custom Key</h3>
                <ol className="space-y-2 text-sm text-gray-700 list-none font-medium">
                  <li><span className="font-bold text-gray-900 mr-2">1</span> Click <span className="font-semibold text-gray-900">Edit</span> next to Gemini or Gnani</li>
                  <li><span className="font-bold text-gray-900 mr-2">2</span> Enter your API key</li>
                  <li><span className="font-bold text-gray-900 mr-2">3</span> Uncheck <span className="font-semibold text-gray-900">"use default"</span></li>
                  <li><span className="font-bold text-gray-900 mr-2">4</span> Click <span className="font-semibold text-gray-900">Save Changes</span></li>
                </ol>
                <div className="mt-5 bg-amber-50/50 border border-amber-200 p-3 rounded-md">
                  <p className="text-xs font-bold text-amber-800 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    IMPORTANT
                  </p>
                  <p className="text-xs text-amber-900/80 font-medium mt-1">If "use default" is checked, your custom key will NOT be used.</p>
                </div>
              </div>

              {/* TWO SMALL INFO SECTIONS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Get Your API Keys</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Gnani AI</p>
                      <a href="https://app.gnani.ai/voice/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-500 font-medium flex items-center gap-1 group">Create a key <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span></a>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Google Gemini</p>
                      <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-500 font-medium flex items-center gap-1 group">Create a key <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span></a>
                    </div>
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Use Default Keys</h3>
                  <p className="text-xs text-gray-600 mb-3 leading-relaxed">Keep <span className="font-semibold text-gray-800">"use default"</span> checked to use VOICY's default key.</p>
                  <p className="text-xs text-gray-600 leading-relaxed">Gemini and Gnani can be configured independently.</p>
                </div>
              </div>
            </div>

            {/* SECURITY SECTION */}
            <div className="h-full">
              <div className="border border-gray-200 rounded-lg p-5 bg-white h-full flex flex-col">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <span>🔒</span> YOUR API KEYS ARE PROTECTED
                </h3>
                <ul className="space-y-4 flex-1">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-900 font-bold text-xs shrink-0 mt-0.5">✓</span>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Encrypted at rest</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Keys are encrypted before being stored in the database.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-900 font-bold text-xs shrink-0 mt-0.5">✓</span>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Database administrators cannot see your key</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Only encrypted ciphertext is stored.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-900 font-bold text-xs shrink-0 mt-0.5">✓</span>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Decrypted only when needed</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Keys are temporarily decrypted in backend memory when required.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-900 font-bold text-xs shrink-0 mt-0.5">✓</span>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Never returned to the browser</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Your saved plaintext key is never exposed to the frontend.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-900 font-bold text-xs shrink-0 mt-0.5">✓</span>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Always masked after saving</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Saved keys cannot be viewed in plaintext.</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECURITY REMINDER FOOTER */}
        <div className="bg-gray-50 border-t border-gray-200 p-4 px-6">
          <p className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5 mb-1">
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Security Reminder
          </p>
          <p className="text-[11px] text-gray-600 font-medium">For testing, use a separate/scrap API account and key. Never use or share your personal or production API keys.</p>
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

      {/* Remove Keys Modal */}
      {isRemoveKeysModalOpen && (
        <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={() => setIsRemoveKeysModalOpen(false)}></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                      <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                      <h3 className="text-base font-semibold leading-6 text-gray-900" id="modal-title">Remove Custom API Keys?</h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          This will permanently remove your saved Gemini and Gnani API keys. The application will use the default keys afterward. This action cannot be undone.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    type="button"
                    onClick={handleRemoveCustomKeys}
                    className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto"
                  >
                    Remove Keys
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRemoveKeysModalOpen(false)}
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
