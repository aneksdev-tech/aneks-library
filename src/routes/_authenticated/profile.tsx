import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getContributorLevel, getLevelProgress, getNextContributorLevel, } from "@/lib/reputation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile | Aneks Library" }, { name: "robots", content: "noindex" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user, refresh } = useAuth();

  const isResearcher =
    profile?.primary_role === "researcher";

  const isLecturer =
    profile?.primary_role === "lecturer";

  const isStudent =
    profile?.primary_role === "student";

  const [busy, setBusy] = useState(false);

  const avatarUrl =
    profile?.avatar_url || null;
  
  const contributor = getContributorLevel(
  profile?.reputation ?? 0,
);

const progress = getLevelProgress(
  profile?.reputation ?? 0,
);

const nextLevel = getNextContributorLevel(
  profile?.reputation ?? 0,
);

const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: "",
    bio: "",
    college: "",
    department: "",
    level: "",
  });

  const completionItems = [
  Boolean(profile?.avatar_url),
  Boolean(profile?.full_name),
  Boolean(profile?.bio),
  Boolean(form.college || form.department || form.level),
];

const completion = Math.round(
  (completionItems.filter(Boolean).length /
    completionItems.length) *
    100,
);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        bio: profile.bio ?? "",
        college: profile.college ?? "",
        department: profile.department ?? "",
        level: profile.level ?? "",
      });
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    await refresh();
  };

  const uploadAvatar = async (
  file: File,
) => {
  if (!user) return;

try {
  setBusy(true);

  // Delete previous avatar if it exists
  if (profile?.avatar_url) {
    try {
      const url = new URL(profile.avatar_url);

      const marker = "/storage/v1/object/public/avatar/";
      const index = url.pathname.indexOf(marker);

      if (index !== -1) {
        const oldPath = decodeURIComponent(
          url.pathname.substring(index + marker.length),
        );

        await supabase.storage
          .from("avatar")
          .remove([oldPath]);
      }
    } catch {
      // Ignore parsing errors
    }
  }

    // Store avatar inside the user's folder
const ext =
  file.name.split(".").pop() ?? "png";

const fileName =
  `${user.id}/avatar.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } =
      await supabase.storage
        .from("avatar")
        .upload(fileName, file, {
          upsert: true,
        });

    if (uploadError)
      throw uploadError;

    // Public URL
    const { data } =
      supabase.storage
        .from("avatar")
        .getPublicUrl(fileName);

    // Save URL to profile
    const { error: updateError } =
      await supabase
        .from("profiles")
        .update({
          avatar_url: data.publicUrl,
        })
        .eq("id", user.id);

    if (updateError)
      throw updateError;

    toast.success(
      "Profile photo updated.",
    );

    await refresh();
  } catch (err: any) {
    toast.error(err.message);
  } finally {
    setBusy(false);
  }
};

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Profile</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update your details and academic information.</p>
      </div>
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-col items-center gap-4 border-b pb-6">
  
  <div className="relative">

  {avatarUrl ? (
    <img
      src={avatarUrl}
      alt={profile?.full_name ?? "Avatar"}
      className="h-72 w-56 rounded-3xl border-2 border-primary object-cover shadow-xl"
    />
  ) : (
    <div className="flex h-72 w-56 items-center justify-center rounded-2xl border-2 border-primary bg-muted text-6xl font-bold shadow-lg">
      {(profile?.full_name ?? "U")
        .charAt(0)
        .toUpperCase()}
    </div>
  )}

  <button
    type="button"
    onClick={() => fileInputRef.current?.click()}
    className="absolute bottom-3 right-3 rounded-full bg-primary p-3 text-primary-foreground shadow-lg hover:opacity-90"
  >
    <Camera className="h-5 w-5" />
  </button>

</div>

  <div className="space-y-1 text-center">
    <h2 className="text-xl font-semibold">
      {profile?.full_name || "Unnamed User"}
    </h2>

    {profile?.bio ? (
      <p className="mx-auto max-w-md text-center text-sm text-muted-foreground">
        {profile.bio}
      </p>
    ) : (
      <p className="text-sm italic text-muted-foreground">
        No bio yet.
      </p>
    )}
  </div>

  <div className="flex flex-wrap items-center justify-center gap-2">
    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">
      {profile?.primary_role}
    </span>

    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      {contributor.emoji} {contributor.name}
    </span>
  </div>

  <div className="w-full max-w-sm space-y-2">
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium">
        Reputation
      </span>

      <span className="text-muted-foreground">
        {profile?.reputation ?? 0} pts
      </span>
    </div>

    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-gradient-emerald transition-all duration-500"
        style={{
          width: `${progress}%`,
        }}
      />
    </div>

    <p className="text-center text-xs text-muted-foreground">
      {nextLevel
        ? `${nextLevel.pointsNeeded} pts until ${nextLevel.emoji} ${nextLevel.name}`
        : "Highest contributor level reached 👑"}
    </p>
  </div>

  <p className="text-sm text-muted-foreground">
    Click the camera icon to change your profile photo.
  </p>

  <div className="mt-2 w-full max-w-sm rounded-xl border bg-muted/30 p-4">
  <div className="mb-2 flex items-center justify-between">
    <span className="text-sm font-medium">
      Profile Completion
    </span>

    <span className="text-sm font-semibold">
      {completion}%
    </span>
  </div>

  <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
    <div
      className="h-full rounded-full bg-gradient-emerald transition-all duration-500"
      style={{
        width: `${completion}%`,
      }}
    />
  </div>

  <div className="space-y-1 text-xs">
    <div>
      {profile?.avatar_url ? "✅" : "⬜"} Profile Photo
    </div>

    <div>
      {profile?.full_name ? "✅" : "⬜"} Full Name
    </div>

    <div>
      {profile?.bio ? "✅" : "⬜"} Bio
    </div>

    <div>
      {form.college || form.department || form.level
        ? "✅"
        : "⬜"}{" "}
      Academic Information
    </div>
  </div>
</div>
</div>

<div className="mx-auto w-full max-w-sm rounded-xl border bg-card p-5 text-center">
  <h3 className="mb-5 text-base font-semibold">
    Account
  </h3>

  <div className="space-y-5">
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Plan
      </p>

      <p className="mt-1 text-lg font-semibold capitalize">
        {profile?.subscription_plan ===
        "premium"
          ? "⭐ Premium"
          : "🟢 Free"}
      </p>
    </div>

    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">
        Status
      </span>

      <span className="font-medium capitalize">
        {profile?.status === "active"
          ? "🟢 Active"
          : profile?.status}
      </span>
    </div>

    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">
        Member since
      </span>

      <span className="font-medium">
        {profile?.created_at
          ? new Date(
              profile.created_at,
            ).toLocaleDateString(
              undefined,
              {
                day: "numeric",
                month: "long",
                year: "numeric",
              },
            )
          : "-"}
      </span>
    </div>
  </div>
</div>

<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  className="hidden"
  onChange={(e) => {
    const file =
      e.target.files?.[0];

    if (file) {
      uploadAvatar(file);
    }

    e.target.value = "";
  }}
/>
        <div>
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="fn">Full name</Label>
          <Input id="fn" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="mt-1.5" />
        </div>

        <div className="space-y-4">

  {isStudent && (
  <div className="grid gap-4 sm:grid-cols-3">
    <div>
      <Label htmlFor="c">College</Label>
      <Input
        id="c"
        value={form.college}
        onChange={(e) =>
          setForm({
            ...form,
            college: e.target.value,
          })
        }
        className="mt-1.5"
      />
    </div>

    <div>
      <Label htmlFor="d">Department</Label>
      <Input
        id="d"
        value={form.department}
        onChange={(e) =>
          setForm({
            ...form,
            department: e.target.value,
          })
        }
        className="mt-1.5"
      />
    </div>

    <div>
      <Label htmlFor="l">Level</Label>
      <Input
        id="l"
        value={form.level}
        onChange={(e) =>
          setForm({
            ...form,
            level: e.target.value,
          })
        }
        className="mt-1.5"
      />
    </div>
  </div>
)}

{isLecturer && (
  <div className="grid gap-4 sm:grid-cols-2">
    <div>
      <Label htmlFor="c">College</Label>
      <Input
        id="c"
        value={form.college}
        onChange={(e) =>
          setForm({
            ...form,
            college: e.target.value,
          })
        }
        className="mt-1.5"
      />
    </div>

    <div>
      <Label htmlFor="d">Department</Label>
      <Input
        id="d"
        value={form.department}
        onChange={(e) =>
          setForm({
            ...form,
            department: e.target.value,
          })
        }
        className="mt-1.5"
      />
    </div>
  </div>
)}

{isResearcher && (
  <div className="grid gap-4 sm:grid-cols-2">
    <div>
      <Label htmlFor="c">Institution</Label>
      <Input
        id="c"
        placeholder="e.g. OpenAI"
        value={form.college}
        onChange={(e) =>
          setForm({
            ...form,
            college: e.target.value,
          })
        }
        className="mt-1.5"
      />
    </div>

    <div>
      <Label htmlFor="d">Research Area</Label>
      <Input
        id="d"
        placeholder="e.g. Artificial Intelligence"
        value={form.department}
        onChange={(e) =>
          setForm({
            ...form,
            department: e.target.value,
          })
        }
        className="mt-1.5"
      />
    </div>
  </div>
)}

</div>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy} className="bg-gradient-emerald text-primary-foreground">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
