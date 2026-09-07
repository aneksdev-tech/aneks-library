import {
  createFileRoute,
  Link,
  useRouter,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getContributorLevel } from "@/lib/reputation";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute(
  "/profile/$userId",
)({
  component: PublicProfilePage,
});

const roleLabels: Record<string, string> = {
  admin: "🛡️ Administrator",
  "co-admin": "🛡️ Co-admin",
  lecturer: "🎓 Verified Lecturer",
  staff: "👤 Verified Staff",
  student: "🟢 Verified Student",
  researcher: "🔬 Verified Researcher",
  guest: "👤 Guest",
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
        .from("profiles")
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

  const joinedDate = profile
    ? new Date(
        profile.created_at,
      ).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
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

  const roleLabel =
    roleLabels[profile.primary_role] ??
    "👤 Member";

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
    <div className="mx-auto w-full max-w-3xl space-y-5 px-1 sm:px-0">
      <Button
        type="button"
        variant="ghost"
        onClick={() => router.history.back()}
        className="px-2"
      >
        ← Back
      </Button>

      <section className="rounded-2xl border bg-card p-5 shadow-xl sm:p-8">
        <div className="flex flex-col items-center text-center">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name ?? "Profile"}
              className="h-40 w-40 rounded-2xl border-2 border-primary object-cover shadow-xl sm:h-48 sm:w-48"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-primary bg-muted text-5xl font-semibold shadow-lg sm:h-48 sm:w-48 sm:text-6xl">
              {initials}
            </div>
          )}

          <div className="mt-5 max-w-2xl space-y-2">
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">
              {profile.full_name ?? "Unknown user"}
            </h1>

            {profile.bio && (
              <p className="leading-relaxed text-muted-foreground">
                {profile.bio}
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {roleLabel}
            </span>

            <span className="rounded-full bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
              {contributor.emoji}{" "}
              {contributor.name}
            </span>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Member since {joinedDate}
          </p>
        </div>

        <div className="mt-7 border-t pt-6">
          <div className="grid grid-cols-3 gap-2 text-center sm:gap-4">
            <div className="min-w-0 px-1">
              <div className="text-xl font-semibold sm:text-2xl">
                {resources?.length ?? 0}
              </div>

              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Resources
              </div>
            </div>

            <div className="min-w-0 border-x px-1">
              <div className="text-xl font-semibold sm:text-2xl">
                {totalDownloads}
              </div>

              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Downloads
              </div>
            </div>

            <div className="min-w-0 px-1">
              <div className="text-xl font-semibold sm:text-2xl">
                {profile.reputation}
              </div>

              <div className="mt-1 break-words text-xs text-muted-foreground sm:text-sm">
                {contributor.name}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 border-t pt-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">
              Uploaded Resources
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Approved resources uploaded by this member.
            </p>
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
                  className="block rounded-xl border p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="font-medium leading-snug">
                    {resource.title}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
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

                    <span>
                      {resource.download_count}{" "}
                      downloads
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No approved resources yet.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}