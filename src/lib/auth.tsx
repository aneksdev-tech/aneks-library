import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  Session,
  User,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin"
  | "co-admin"
  | "staff"
  | "student"
  | "lecturer"
  | "researcher"
  | "guest";

export type AccountStatus =
  | "active"
  | "pending"
  | "rejected"
  | "suspended"
  | "inactive";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  phone_number: string | null;
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
  isCoAdmin: boolean;
  isStaff: boolean;

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
  isCoAdmin: false,
  isStaff: false,

  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [loading, setLoading] =
    useState(true);

  const [session, setSession] =
    useState<Session | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [roles, setRoles] =
    useState<AppRole[]>([]);

  const loadProfile = async (
    uid: string,
  ) => {
    const {
      data: prof,
      error,
    } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      console.error(
        "Failed to load user profile:",
        error,
      );

      return false;
    }

    const nextProfile =
      (prof as Profile) ?? null;

    setProfile(nextProfile);

    setRoles(
      nextProfile?.primary_role
        ? [nextProfile.primary_role]
        : [],
    );

    return true;
  };

  const bootstrap = async () => {
    const { data } =
      await supabase.auth.getSession();

    setSession(data.session);

    if (data.session?.user) {
      await loadProfile(
        data.session.user.id,
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    let profileChannel:
      ReturnType<typeof supabase.channel> | null =
      null;

    const setupProfileRealtime = (
      uid: string,
    ) => {
      profileChannel?.unsubscribe();

      profileChannel = supabase
        .channel(`profile-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${uid}`,
          },
          (payload) => {
            const updatedProfile =
              payload.new as Profile;

            console.log(
              "[Auth] PROFILE UPDATE RECEIVED:",
              {
                uid,
                oldStatus:
                  (payload.old as Partial<Profile>)
                    ?.status,
                newStatus:
                  updatedProfile?.status,
                newProfile: updatedProfile,
              },
            );

            if (
              updatedProfile?.id !== uid
            ) {
              return;
            }

            console.log(
              "[Auth] Applying Realtime profile:",
              {
                status:
                  updatedProfile.status,
                role:
                  updatedProfile.primary_role,
              },
            );

            /*
             * The Realtime payload is the latest
             * database row. Apply it directly.
             *
             * Do not immediately refetch here because
             * that can race against the Realtime update.
             */
            setProfile(
              updatedProfile,
            );

            setRoles(
              updatedProfile.primary_role
                ? [
                    updatedProfile.primary_role,
                  ]
                : [],
            );
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log(
              "[Auth] Profile Realtime subscribed:",
              uid,
            );
          }
        });
    };

    void bootstrap();

    const {
      data: sub,
    } = supabase.auth.onAuthStateChange(
      (event, s) => {
        setSession(s);

        if (s?.user) {
          setupProfileRealtime(
            s.user.id,
          );

          setTimeout(() => {
            void loadProfile(
              s.user.id,
            );
          }, 0);
        } else {
          profileChannel?.unsubscribe();
          profileChannel = null;

          setProfile(null);
          setRoles([]);
        }

        if (
          event === "SIGNED_OUT"
        ) {
          profileChannel?.unsubscribe();
          profileChannel = null;

          setProfile(null);
          setRoles([]);
        }
      },
    );

    return () => {
      sub.subscription.unsubscribe();

      profileChannel?.unsubscribe();
      profileChannel = null;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Enforce account-status navigation directly from
   * the authentication provider.
   *
   * This runs whenever the authoritative profile
   * status changes, including a Supabase Realtime
   * UPDATE.
   *
   * This is intentionally independent of the
   * TanStack route beforeLoad lifecycle.
   */
  useEffect(() => {
    if (
      loading ||
      !profile
    ) {
      return;
    }

    const currentPath =
      window.location.pathname;

    console.log(
      "[Auth STATUS NAV]",
      {
        status: profile.status,
        path: currentPath,
      },
    );

    if (
      profile.status === "active"
    ) {
      if (
        currentPath === "/pending" ||
        currentPath === "/suspended" ||
        currentPath === "/rejected" ||
        currentPath === "/inactive"
      ) {
        console.log(
          "[Auth STATUS NAV] ACTIVE → DASHBOARD",
        );

        window.location.replace(
          "/dashboard",
        );
      }

      return;
    }

    const targetPath =
      profile.status === "pending"
        ? "/pending"
        : profile.status === "suspended"
          ? "/suspended"
          : profile.status === "rejected"
            ? "/rejected"
            : profile.status === "inactive"
              ? "/inactive"
              : "/pending";

    if (
      currentPath !== targetPath
    ) {
      console.log(
        "[Auth STATUS NAV] REDIRECT",
        {
          from: currentPath,
          to: targetPath,
        },
      );

      window.location.replace(
        targetPath,
      );
    }
  }, [
    profile?.status,
    loading,
  ]);

  return (
    <AuthCtx.Provider
      value={{
        loading,
        session,
        user:
          session?.user ?? null,
        profile,
        roles,

        isAdmin:
          roles.includes("admin"),

        isCoAdmin:
          roles.includes("co-admin"),

        isStaff:
          roles.includes("staff") ||
          roles.includes("lecturer") ||
          roles.includes("co-admin") ||
          roles.includes("admin"),

        refresh: async () => {
          if (session?.user) {
            await loadProfile(
              session.user.id,
            );
          }
        },

        signOut: async () => {
          await supabase.auth.signOut();

          window.location.href =
            "/auth?mode=login";
        },
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () =>
  useContext(AuthCtx);