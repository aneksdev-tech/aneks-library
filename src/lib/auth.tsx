import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "student" | "lecturer" | "researcher";
export type AccountStatus = "active" | "pending" | "rejected" | "suspended" | "inactive";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  college: string | null;
  department: string | null;
  level: string | null;

  status: AccountStatus;
  primary_role: AppRole;
  reputation: number;
  created_at: string;

  subscription_plan: "free" | "premium";
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState>({
  loading: true,
  session: null,
  user: null,
  profile: null,
  roles: [],
  isAdmin: false,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const loadProfile = async (uid: string) => {
    const { data: prof } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", uid)
  .maybeSingle();

const profile = (prof as Profile) ?? null;

setProfile(profile);

setRoles(
  profile?.primary_role
    ? [profile.primary_role]
    : [],
);
  };

  const bootstrap = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) await loadProfile(data.session.user.id);
    setLoading(false);
  };

  useEffect(() => {
    bootstrap();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setRoles([]);
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        loading,
        session,
        user: session?.user ?? null,
        profile,
        roles,
        isAdmin: roles.includes("admin"),
        refresh: async () => {
          if (session?.user) await loadProfile(session.user.id);
        },
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
