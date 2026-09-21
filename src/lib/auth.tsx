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
      .from("private_profiles")
      .select(
        [
          "id",
          "full_name",
          "email",
          "avatar_url",
          "bio",
          "phone_number",
          "college",
          "department",
          "level",
          "status",
          "primary_role",
          "reputation",
          "created_at",
          "subscription_plan",
          "subscription_started_at",
          "subscription_expires_at",
        ].join(", "),
      )
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      return false;
    }

    const nextProfile =
      (prof as unknown as Profile) ?? null;

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
        .channel(`profile:${uid}`, {
          config: {
            private: true,
          },
        })
        .on(
          "broadcast",
          {
            event: "profile_access_changed",
          },
          (payload) => {
            const updatedProfile =
              payload.payload as {
                id?: string;
                status?: AccountStatus;
                primary_role?: AppRole;
              };

            if (
              updatedProfile?.id !== uid
            ) {
              return;
            }

            setProfile(
              (currentProfile) =>
                currentProfile
                  ? {
                      ...currentProfile,
                      status:
                        updatedProfile.status ??
                        currentProfile.status,
                      primary_role:
                        updatedProfile.primary_role ??
                        currentProfile.primary_role,
                    }
                  : currentProfile,
            );

            if (
              updatedProfile.primary_role
            ) {
              setRoles([
                updatedProfile.primary_role,
              ]);
            }
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            profileChannel?.unsubscribe();
            profileChannel = null;
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
   * Enforce account-status and admin-area access
   * directly from the authentication provider.
   *
   * This runs whenever the authoritative profile
   * status or primary role changes, including a
   * Supabase Realtime Broadcast.
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

    /*
     * Users with roles that do not have admin-area
     * access must be removed from /admin immediately
     * when their role changes.
     */
    const canAccessAdminArea =
      profile.primary_role === "admin" ||
      profile.primary_role === "co-admin" ||
      profile.primary_role === "lecturer" ||
      profile.primary_role === "staff";

    if (
      currentPath.startsWith("/admin") &&
      !canAccessAdminArea
    ) {
      window.location.replace(
        "/dashboard",
      );

      return;
    }

    /*
     * Active accounts should not remain on
     * account-status restriction pages.
     */
    if (
      profile.status === "active"
    ) {
      if (
        currentPath === "/pending" ||
        currentPath === "/suspended" ||
        currentPath === "/rejected" ||
        currentPath === "/inactive"
      ) {
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
      window.location.replace(
        targetPath,
      );
    }
  }, [
    profile?.status,
    profile?.primary_role,
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