import { createFileRoute, Link, useRouter, } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getContributorLevel, } from "@/lib/reputation";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute(
  "/profile/$userId",
)({
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { userId } = Route.useParams();
  const router = useRouter();

  const {
    data: profile,
    isLoading,
  } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

      if (error) throw error;

      return data;
    },
  });

  const {
  data: resources,
} = useQuery({
  queryKey: ["public-profile-resources", userId],
  queryFn: async () => {
    const { data, error } =
      await supabase
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
        .order("created_at", {
          ascending: false,
        });

    if (error) throw error;

    return data ?? [];
  },
});

const totalDownloads =
  resources?.reduce(
    (sum, r) => sum + (r.download_count ?? 0),
    0,
  ) ?? 0;

  const contributor =
  getContributorLevel(
    profile?.reputation ?? 0,
  );

  const joinedDate = profile
  ? new Date(profile.created_at).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    })
  : "";

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        Profile not found.
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-3xl space-y-8">
      <Button
      type="button"
      variant="ghost"
      onClick={() => router.history.back()}
    >
      ← Back
      </Button>

      <div className="rounded-3xl border bg-card p-10 shadow-xl">
        <div className="flex flex-col items-center gap-4">

          {profile.avatar_url ? (
            <img
            src={profile.avatar_url}
            alt={profile.full_name}
            className="h-64 w-64 rounded-3xl border-2 border-primary object-cover shadow-xl"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-primary bg-muted text-6xl font-semibold shadow-lg">
              {profile.full_name
                ?.charAt(0)
                .toUpperCase()}
            </div>
          )}

          <div className="space-y-2 text-center">
            <h1 className="flex items-center justify-center gap-2 text-3xl font-semibold">
            {profile.full_name}
            </h1>

            {profile.bio && (
              <p className="mt-2 text-muted-foreground">
                {profile.bio}
              </p>
            )}
            
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {profile.primary_role === "student" && "🟢 Verified Student"}

            {profile.primary_role === "lecturer" && "🎓 Verified Lecturer"}

            {profile.primary_role === "researcher" && "🔬 Verified Researcher"}

            {profile.primary_role === "admin" && "🛡️ Administrator"}
            </span>

            <span className="rounded-full bg-gold/10 px-3 py-1 text-sm font-medium text-gold">
            {contributor.emoji} {contributor.name}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Member since {joinedDate}
            </p>
<div className="mt-8 border-t pt-8">
<div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-center">

  <div className="rounded-xl border p-4 min-w-0">
    <div className="text-2xl font-semibold">
      {resources?.length ?? 0}
    </div>

    <div className="text-xs sm:text-sm text-muted-foreground break-words">
      Resources
    </div>
  </div>

  <div className="rounded-xl border p-4 min-w-0">
    <div className="text-2xl font-semibold">
      {totalDownloads}
    </div>

    <div className="text-xs sm:text-sm text-muted-foreground break-words">
      Downloads
    </div>
  </div>

  <div className="rounded-xl border p-4 min-w-0">
    <div className="text-2xl font-semibold">
  {profile.reputation}
</div>

<div className="text-xs sm:text-sm text-muted-foreground break-words">
  {contributor.name}
</div>

  </div>
</div>
</div>

<div className="rounded-2xl border bg-card p-6 shadow-soft">

  <h2 className="mb-5 text-xl font-semibold">
    Uploaded Resources
  </h2>

  {resources && resources.length > 0 ? (

    <div className="space-y-3">

      {resources.map((resource) => (

        <Link
          key={resource.id}
          to="/preview/$resourceId"
          params={{
            resourceId: resource.id,
          }}
          className="block rounded-xl border p-4 transition hover:bg-muted/40"
        >

          <div className="font-medium">
            {resource.title}
          </div>

          <div className="mt-1 text-sm text-muted-foreground">

            {resource.category?.name}

            {" • "}

            {new Date(
              resource.created_at,
            ).toLocaleDateString()}

            {" • "}

            {resource.download_count} downloads

          </div>

        </Link>

      ))}

    </div>

  ) : (

    <p className="text-muted-foreground">
      No approved resources yet.
    </p>

  )}

</div>
        </div>
      </div>
    </div>
  );
}
