import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile | Aneks Library" }, { name: "robots", content: "noindex" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    bio: "",
    college: "",
    department: "",
    level: "",
  });

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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Profile</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update your details and academic information.</p>
      </div>
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
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
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="c">College</Label>
            <Input id="c" value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="d">Department</Label>
            <Input id="d" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="l">Level</Label>
            <Input id="l" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="mt-1.5" />
          </div>
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
