import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload as UploadIcon, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { academicData, colleges, levels, semesters, years } from "@/lib/academicData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "image/png", "image/jpeg", "application/zip"];

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "Upload | Aneks Library" }, { name: "robots", content: "noindex" }] }),
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
  college: "",
  department: "",
  semester: "",
  level: "",
  year: new Date().getFullYear().toString(),
});

const departments =
  form.college && form.college in academicData
    ? academicData[form.college as keyof typeof academicData]
    : [];

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

  if (!form.title.trim())
    throw new Error("Title is required");

  if (!form.category_id)
    throw new Error("Choose a category");

  if (!form.college)
    throw new Error("Choose a college");

  if (!form.department)
    throw new Error("Choose a department");

  if (!form.level)
    throw new Error("Choose a level");

  if (!form.semester)
    throw new Error("Choose a semester");

  if (!form.course_code.trim())
    throw new Error("Course code is required");

  if (!form.year)
    throw new Error("Choose a year");

  const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(
    /[^a-zA-Z0-9.\-_]/g,
    "_"
  )}`;

  setProgress(30);

  const { error: upErr } = await supabase.storage
    .from("resources")
    .upload(path, file, {
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

    course_code: form.course_code.trim(),

    college: form.college,
    department: form.department,
    semester: form.semester,
    level: form.level,

    year: parseInt(form.year),

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
            <Label htmlFor="desc">Description *</Label>
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
            <Label htmlFor="course">Course Code *</Label>
            <Input id="course" placeholder="e.g. CSC 301" value={form.course_code} onChange={(e) => setForm({ ...form, course_code: e.target.value })} className="mt-1.5" />
          </div>
          <div>
  <Label>College *</Label>
  <Select
    value={form.college}
    onValueChange={(value) =>
      setForm({
        ...form,
        college: value,
        department: "",
      })
    }
  >
    <SelectTrigger className="mt-1.5">
      <SelectValue placeholder="Choose College" />
    </SelectTrigger>

    <SelectContent>
      {colleges.map((college) => (
        <SelectItem key={college} value={college}>
          {college}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

<div>
  <Label>Department *</Label>

  <Select
    value={form.department}
    onValueChange={(value) =>
      setForm({
        ...form,
        department: value,
      })
    }
    disabled={!form.college}
  >
    <SelectTrigger className="mt-1.5">
      <SelectValue
        placeholder={
          form.college
            ? "Choose Department"
            : "Select College first"
        }
      />
    </SelectTrigger>

    <SelectContent>
      {departments.map((dept) => (
        <SelectItem key={dept} value={dept}>
          {dept}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

<div>
  <Label>Level *</Label>

  <Select
    value={form.level}
    onValueChange={(value) =>
      setForm({
        ...form,
        level: value,
      })
    }
  >
    <SelectTrigger className="mt-1.5">
      <SelectValue placeholder="Choose Level" />
    </SelectTrigger>

    <SelectContent>
      {levels.map((level) => (
        <SelectItem key={level} value={level}>
          {level}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

<div>
  <Label>Semester *</Label>

  <Select
    value={form.semester}
    onValueChange={(value) =>
      setForm({
        ...form,
        semester: value,
      })
    }
  >
    <SelectTrigger className="mt-1.5">
      <SelectValue placeholder="Choose Semester" />
    </SelectTrigger>

    <SelectContent>
      {semesters.map((semester) => (
        <SelectItem key={semester} value={semester}>
          {semester}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

<div>
  <Label>Year *</Label>

  <Select
    value={form.year}
    onValueChange={(value) =>
      setForm({
        ...form,
        year: value,
      })
    }
  >
    <SelectTrigger className="mt-1.5">
      <SelectValue />
    </SelectTrigger>

    <SelectContent>
      {years.map((year) => (
        <SelectItem key={year} value={year.toString()}>
          {year}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
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
