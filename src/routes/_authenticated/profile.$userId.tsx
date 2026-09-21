import {
  createFileRoute,
  Link,
  useRouter,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  FileText,
  Shield,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getContributorLevel } from "@/lib/reputation";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute(
  "/_authenticated/profile/$userId",
)({
  component: PublicProfilePage,
});

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  "co-admin": "Co-admin",
  lecturer: "Lecturer",
  staff: "Staff",
  student: "Student",
  researcher: "Researcher",
  guest: "Guest",
};

const roleIcons: Record<string, typeof UserRound> = {
  admin: Shield,
  "co-admin": Shield,
  lecturer: UserRound,
  staff: UserRound,
  student: UserRound,
  researcher: UserRound,
  guest: UserRound,
};

function PublicProfilePage() {
  const { userId } = Route.useParams();
  const router = useRouter();

  const {
    data: profile,
    isLoading,
  } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_profiles")
        .select(`
          id,
          full_name,
          bio,
          avatar_url,
          primary_role,
          reputation,
          created_at
        `)
        .eq("id", userId)
        .single();

      if (error) throw error;

      return data;
    },
  });

  const { data: resources } = useQuery({
    queryKey: ["public-profile-resources", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select(`
          id,
          title,
          download_count,
          created_at,
          category:categories(name)
        `)
        .eq("uploader_id", userId)
        .eq("status", "approved")
        .is("deleted_at", null)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return data ?? [];
    },
  });

  const totalDownloads =
    resources?.reduce(
      (sum, resource) =>
        sum + (resource.download_count ?? 0),
      0,
    ) ?? 0;

  const contributor = getContributorLevel(
    profile?.reputation ?? 0,
  );

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(
        undefined,
        {
          month: "long",
          year: "numeric",
        },
      )
    : "";

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center px-4">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-[60vh] items-center justify-center px-4">
        Profile not found.
      </div>
    );
  }

  const roleKey = profile.primary_role ?? "guest";
  const roleLabel =
    roleLabels[roleKey] ?? "Member";
  const RoleIcon =
    roleIcons[roleKey] ?? UserRound;

  const initials = (() => {
    const name = profile.full_name?.trim();

    if (!name) {
      return "?";
    }

    const parts = name.split(/\s+/);

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return (
      parts[0][0] + parts[1][0]
    ).toUpperCase();
  })();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.history.back()}
          className="-ml-2 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          Profile
        </p>

        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
          {profile.full_name ?? "Unknown user"}
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Public profile and contribution history.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <main className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="shrink-0">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={
                        profile.full_name ??
                        "Profile"
                      }
                      className="h-40 w-32 rounded-2xl border-2 border-primary/30 object-cover shadow-xl"
                    />
                  ) : (
                    <div className="flex h-40 w-32 items-center justify-center rounded-2xl border-2 border-primary/30 bg-muted text-4xl font-semibold shadow-lg">
                      {initials}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      <RoleIcon className="h-3.5 w-3.5" />
                      {roleLabel}
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
                      {contributor.emoji}
                      {contributor.name}
                    </span>
                  </div>

                  <h2 className="mt-4 font-display text-2xl font-semibold sm:text-3xl">
                    {profile.full_name ??
                      "Unknown user"}
                  </h2>

                  {profile.bio && (
                    <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">
                      {profile.bio}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />
                      Member since{" "}
                      {joinedDate}
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-4 w-4" />
                      Public profile
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-3 text-center">
                <div className="min-w-0 px-2">
                  <div className="text-2xl font-semibold">
                    {resources?.length ?? 0}
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    Resources
                  </div>
                </div>

                <div className="min-w-0 border-x px-2">
                  <div className="text-2xl font-semibold">
                    {totalDownloads}
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    Downloads
                  </div>
                </div>

                <div className="min-w-0 px-2">
                  <div className="text-2xl font-semibold">
                    {profile.reputation}
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    Reputation
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>

              <div>
                <h2 className="text-lg font-semibold">
                  Uploaded Resources
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Approved resources uploaded by this member.
                </p>
              </div>
            </div>

            {resources && resources.length > 0 ? (
              <div className="space-y-2">
                {resources.map((resource) => (
                  <Link
                    key={resource.id}
                    to="/preview/$resourceId"
                    params={{
                      resourceId: resource.id,
                    }}
                    className="block rounded-xl border border-border p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="font-medium leading-snug">
                      {resource.title}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      {resource.category?.name && (
                        <span>
                          {resource.category.name}
                        </span>
                      )}

                      {resource.category?.name && (
                        <span aria-hidden="true">
                          •
                        </span>
                      )}

                      <span>
                        {new Date(
                          resource.created_at,
                        ).toLocaleDateString()}
                      </span>

                      <span aria-hidden="true">
                        •
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <Download className="h-3.5 w-3.5" />
                        {resource.download_count}{" "}
                        downloads
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground/60" />

                <p className="mt-3 text-sm text-muted-foreground">
                  No approved resources yet.
                </p>
              </div>
            )}
          </section>
        </main>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
                {contributor.emoji}
              </div>

              <div>
                <h2 className="font-semibold">
                  Contribution
                </h2>

                <p className="text-sm text-muted-foreground">
                  Public reputation
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  Reputation
                </span>

                <span className="font-semibold">
                  {profile.reputation}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  Contributor level
                </span>

                <span className="text-right text-sm font-medium text-gold">
                  {contributor.name}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold">
                  Profile Overview
                </h2>

                <p className="text-sm text-muted-foreground">
                  Public information
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4 border-t border-border pt-5">
              <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  Role
                </span>

                <span className="text-right text-sm font-medium">
                  {roleLabel}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  Member since
                </span>

                <span className="text-right text-sm font-medium">
                  {joinedDate}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  Resources
                </span>

                <span className="text-right text-sm font-medium">
                  {resources?.length ?? 0}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  Downloads
                </span>

                <span className="text-right text-sm font-medium">
                  {totalDownloads}
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}