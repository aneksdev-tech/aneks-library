import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload as UploadIcon, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "image/png", "image/jpeg", "application/zip"];

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "Upload — Aneks Library" }, { name: "robots", content: "noindex" }] }),
  component: UploadPage,
});

function UploadPage() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category_id: "",
    course_code: "",
    department: profile?.department ?? "",
    level: profile?.level ?? "",
    author: profile?.full_name ?? "",
    year: new Date().getFullYear().toString(),
    tags: "",
  });

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id, name").order("sort_order")).data ?? [],
  });

  const validateFile = (f: File) => {
    if (f.size > MAX_SIZE) return "File must be under 50MB.";
    if (!ALLOWED.includes(f.type)) return "Unsupported file type.";
    return null;
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const err = validateFile(f);
    if (err) return toast.error(err);
    setFile(f);
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!user || !file) throw new Error("No file selected");
      if (!form.title.trim()) throw new Error("Title is required");
      if (!form.category_id) throw new Error("Choose a category");

      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      setProgress(30);
      const { error: upErr } = await supabase.storage.from("resources").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      setProgress(70);

      const { error: insErr } = await supabase.from("resources").insert({
        uploader_id: user.id,
        category_id: form.category_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        course_code: form.course_code.trim() || null,
        department: form.department.trim() || null,
        level: form.level.trim() || null,
        author: form.author.trim() || null,
        year: form.year ? parseInt(form.year) : null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        status: "pending",
      });
      if (insErr) throw insErr;
      setProgress(100);
    },
    onSuccess: () => {
      toast.success("Uploaded. An admin will review it shortly.");
      nav({ to: "/my-uploads" });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setProgress(0);
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Upload</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Contribute a new resource</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your upload will be reviewed by an admin before appearing in the library.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          upload.mutate();
        }}
        className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft"
      >
        {/* Dropzone */}
        <div>
          <Label>File</Label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/30 p-10 text-center transition-colors hover:border-primary/40 hover:bg-secondary/50"
          >
            {file ? (
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="ml-3 rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <UploadIcon className="h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Drag & drop or click to upload</p>
                <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, PPTX, ZIP, PNG, JPG — up to 50MB</p>
              </>
            )}
            <input ref={inputRef} type="file" hidden onChange={(e) => onFile(e.target.files?.[0] ?? undefined)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label>Category *</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Choose one" /></SelectTrigger>
              <SelectContent>
                {cats?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="course">Course code</Label>
            <Input id="course" placeholder="e.g. CSC 301" value={form.course_code} onChange={(e) => setForm({ ...form, course_code: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="dept">Department</Label>
            <Input id="dept" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="level">Level</Label>
            <Input id="level" placeholder="e.g. 300" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="author">Author</Label>
            <Input id="author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="year">Year</Label>
            <Input id="year" type="number" min="1990" max="2100" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="mt-1.5" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input id="tags" placeholder="e.g. algorithms, midterm, 2024" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="mt-1.5" />
          </div>
        </div>

        {progress > 0 && <Progress value={progress} />}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => nav({ to: "/dashboard" })}>Cancel</Button>
          <Button type="submit" disabled={upload.isPending || !file} className="bg-gradient-emerald text-primary-foreground shadow-soft">
            {upload.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit for review
          </Button>
        </div>
      </form>
    </div>
  );
}
