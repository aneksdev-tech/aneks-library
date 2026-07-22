import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { AccountStatus, AppRole } from "@/lib/auth";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users | Aneks Library" }, { name: "robots", content: "noindex" }] }),
  component: UsersPage,
});

const STATUSES: AccountStatus[] = ["active", "pending", "rejected", "suspended", "inactive"];

function UsersPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () =>
      (await supabase
        .from("profiles")
        .select("id, full_name, email, primary_role, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200)).data ?? [],
  });

  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: AccountStatus }) => {
      const { error } = await supabase.from("profiles").update({ status: v.status }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: id, role: "admin" as AppRole });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Promoted to admin"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-4 font-medium">User</th>
              <th className="p-4 font-medium">Role</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.map((u) => (
              <tr key={u.id}>
                <td className="p-4">
                  <div className="font-medium">{u.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="p-4 capitalize">{u.primary_role}</td>
                <td className="p-4">
                  <Select value={u.status as string} onValueChange={(v) => setStatus.mutate({ id: u.id, status: v as AccountStatus })}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-4 text-right">
                  <Button size="sm" variant="ghost" onClick={() => promote.mutate(u.id)}>
                    <Shield className="mr-1 h-3.5 w-3.5" /> Promote
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
