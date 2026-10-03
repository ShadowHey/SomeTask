"use client";

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  logout: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // 1. Check active session
    const getSession = async () => {
      const { data: { session: activeSession } } = await supabase.auth.getSession();

      setSession(activeSession);
      setUser(activeSession?.user ?? null);

      if (activeSession) {
        try {
          const p = await api.profile.get();
          setProfile(p);
        } catch (e: any) {
          console.error("Failed to fetch profile", e);
        }
      } else {
        if (!pathname.startsWith("/login") && !pathname.startsWith("/register") && pathname !== "/") {
          router.push("/login");
        }
      }

      setIsLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === 'SIGNED_IN') {
          api.profile.get().then(p => setProfile(p)).catch(async (e: any) => {
            console.error(e);
          });
          if (pathname === "/login" || pathname === "/register" || pathname === "/") {
            router.push("/home");
          }
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          if (!pathname.startsWith("/login") && !pathname.startsWith("/register") && pathname !== "/") {
            router.push("/login");
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]); // Removed router from dependencies as it causes infinite loops in Next.js

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    try {
      const p = await api.profile.get();
      setProfile(p);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isLoading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
