import {
  createFileRoute,
  Outlet,
  useBlocker,
  useNavigate,
} from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Upload as UploadIcon,
  FileText,
  X,
  Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  colleges,
  levels,
  semesters,
  years,
  getDepartments,
} from "@/lib/academicData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MAX_SIZE = 50 * 1024 * 1024;

const ALLOWED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "application/zip",
];

type UploadForm = {
  title: string;
  description: string;
  category_id: string;
  course_code: string;
  college: string;
  department: string;
  semester: string;
  level: string;
  year: string;
};

const createEmptyForm = (): UploadForm => ({
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

type UploadPageProps = {
  draftId?: string;
};

export const Route = createFileRoute("/_authenticated/upload")({
  component: UploadRouteLayout,
});

function UploadRouteLayout() {
  return <Outlet />;
}

export function UploadPage({ draftId }: UploadPageProps) {
  const { user } = useAuth();
  const nav = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [existingFileName, setExistingFileName] = useState("");
  const [existingFilePath, setExistingFilePath] = useState("");
  const [progress, setProgress] = useState(0);

  const [form, setForm] = useState<UploadForm>(
    createEmptyForm(),
  );

  const [initialForm, setInitialForm] = useState<UploadForm>(
    createEmptyForm(),
  );

  const [draftLoaded, setDraftLoaded] = useState(!draftId);

  const [showSubmitConfirm, setShowSubmitConfirm] =
    useState(false);

  const [showDraftConfirm, setShowDraftConfirm] =
    useState(false);

  const [exitAction, setExitAction] = useState<
    "none" | "save" | "discard"
  >("none");

  const inputRef = useRef<HTMLInputElement>(null);
  const allowNavigationRef = useRef(false);

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("sort_order");

      if (error) throw error;

      return data ?? [];
    },
  });

  const { data: draft, isLoading: draftLoading } = useQuery({
    queryKey: ["upload-draft", draftId, user?.id],
    enabled: !!draftId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select(
          "id, title, description, category_id, course_code, college, department, semester, level, year, file_path, file_name, file_size, mime_type, status, uploader_id",
        )
        .eq("id", draftId!)
        .eq("uploader_id", user!.id)
        .eq("status", "draft")
        .maybeSingle();

      if (error) throw error;

      return data;
    },
  });

  useEffect(() => {
  if (!draftId) {
    setDraftLoaded(true);
    return;
  }

  if (!user) {
    return;
  }

  if (draftLoading) {
    return;
  }

  if (!draft) {
    toast.error("Draft not found.");
    nav({ to: "/my-uploads" });
    return;
  }

  const loadedForm: UploadForm = {
    title: draft.title ?? "",
    description: draft.description ?? "",
    category_id: draft.category_id ?? "",
    course_code: draft.course_code ?? "",
    college: draft.college ?? "",
    department: draft.department ?? "",
    semester: draft.semester ?? "",
    level: draft.level ?? "",
    year:
      draft.year !== null && draft.year !== undefined
        ? String(draft.year)
        : "",
  };

  setForm(loadedForm);
  setInitialForm(loadedForm);
  setExistingFileName(draft.file_name ?? "");
  setExistingFilePath(draft.file_path ?? "");
  setDraftLoaded(true);
}, [draft, draftId, draftLoading, nav, user]);

  const isSGS = form.college === "SGS";
  const departments = isSGS 
    ? [] 
    : getDepartments(form.college);

  const isFormChanged =
    JSON.stringify(form) !== JSON.stringify(initialForm);

  const isDirty =
    draftLoaded &&
    (isFormChanged || !!file);

  const blocker = useBlocker({
    shouldBlockFn: () =>
      isDirty && !allowNavigationRef.current,
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  });

  useEffect(() => {
    if (blocker.status !== "blocked") {
      return;
    }

    setExitAction("none");
  }, [blocker.status]);

  const validateFile = (f: File) => {
    if (f.size > MAX_SIZE) {
      return "File must be under 50MB.";
    }

    if (!ALLOWED.includes(f.type)) {
      return "Unsupported file type.";
    }

    return null;
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;

    const error = validateFile(f);

    if (error) {
      toast.error(error);
      return;
    }

    setFile(f);
  };

  const validateForSubmit = () => {
    if (!user) {
      throw new Error("You must be signed in.");
    }

    if (!file && !existingFilePath) {
      throw new Error("Please select a file.");
    }

    if (!form.title.trim()) {
      throw new Error("Title is required");
    }

    if (!form.description.trim()) {
      throw new Error("Description is required");
    }

    if (!form.category_id) {
      throw new Error("Choose a category");
    }

    if (!form.college) {
      throw new Error("Choose a college");
    }

    if (!isSGS && !form.department) {
      throw new Error("Choose a department");
    }

    if (!form.level) {
      throw new Error("Choose a level");
    }

    if (!form.semester) {
      throw new Error("Choose a semester");
    }

    if (!form.course_code.trim()) {
      throw new Error("Course code is required");
    }

    if (!form.year) {
      throw new Error("Choose a year");
    }
  };

  const saveResource = useMutation({
    mutationFn: async ({
      status,
    }: {
      status: "draft" | "pending";
    }) => {
      if (!user) {
        throw new Error("You must be signed in.");
      }

      if (!file && !existingFilePath) {
        throw new Error("Please select a file.");
      }

      let filePath = existingFilePath;
let fileName = existingFileName;
let fileSize: number | undefined;
let mimeType: string | null = null;
let newlyUploadedPath: string | null = null;

if (file) {
  const safeName = file.name.replace(
    /[^a-zA-Z0-9.\-_]/g,
    "_",
  );

  newlyUploadedPath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
  filePath = newlyUploadedPath;
  fileName = file.name;
  fileSize = file.size;
  mimeType = file.type;

  setProgress(30);

  const { error: uploadError } = await supabase.storage
    .from("resources")
    .upload(newlyUploadedPath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  setProgress(70);
} else if (draft) {
  fileSize = draft.file_size;
  mimeType = draft.mime_type;
}

let error;

if (draftId) {
  const result = await supabase
    .from("resources")
    .update({
      category_id: form.category_id || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      course_code: form.course_code.trim() || null,
      college: form.college || null,
      department: form.department || null,
      semester: form.semester || null,
      level: form.level || null,
      year: form.year
        ? parseInt(form.year, 10)
        : null,
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      status,
      deleted_at: null,
      deleted_by: null,
    })
    .eq("id", draftId)
    .eq("uploader_id", user.id)
    .eq("status", "draft");

  error = result.error;
} else {
  const result = await supabase
    .from("resources")
    .insert({
      uploader_id: user.id,
      category_id: form.category_id || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      course_code: form.course_code.trim() || null,
      college: form.college || null,
      department: form.department || null,
      semester: form.semester || null,
      level: form.level || null,
      year: form.year
        ? parseInt(form.year, 10)
        : null,
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      status,
      deleted_at: null,
      deleted_by: null,
    });

  error = result.error;
}

if (error) {
  if (newlyUploadedPath) {
    await supabase.storage
      .from("resources")
      .remove([newlyUploadedPath]);
  }

  throw error;
}

      if (
        draftId &&
        file &&
        existingFilePath &&
        existingFilePath !== newlyUploadedPath
      ) {
        await supabase.storage
          .from("resources")
          .remove([existingFilePath]);
      }

      setProgress(100);
    },
    onSuccess: (_, variables) => {
      const message =
        variables.status === "draft"
          ? draftId
            ? "Draft updated successfully."
            : "Saved as draft."
          : "Uploaded. An admin will review it shortly.";

      toast.success(message);

      setFile(null);
      setProgress(0);
      allowNavigationRef.current = true;

      if (variables.status === "draft") {
        nav({ to: "/my-uploads" });
      } else {
        nav({ to: "/my-uploads" });
      }

      if (blocker.status === "blocked") {
        blocker.proceed();
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setProgress(0);
      setExitAction("none");
    },
  });

  const handleSubmit = () => {
    try {
      validateForSubmit();
      setShowSubmitConfirm(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Please complete the required fields.",
      );
    }
  };

  const handleSaveDraft = () => {
    if (!user) {
      toast.error("You must be signed in.");
      return;
    }

    if (!file && !existingFilePath) {
      toast.error("Please select a file before saving a draft.");
      return;
    }

    setShowDraftConfirm(true);
  };

  const confirmSubmit = () => {
    setShowSubmitConfirm(false);

    saveResource.mutate({
      status: "pending",
    });
  };

  const confirmSaveDraft = () => {
    setShowDraftConfirm(false);

    saveResource.mutate({
      status: "draft",
    });
  };

  const handleDiscard = () => {
  allowNavigationRef.current = true;

  if (blocker.status === "blocked") {
    blocker.proceed();
  }
};

  const handleExitSave = () => {
    setExitAction("save");

    if (!file && !existingFilePath) {
      toast.error("Please select a file before saving a draft.");
      setExitAction("none");
      return;
    }

    saveResource.mutate({
      status: "draft",
    });
  };

  const title = useMemo(
    () => (draftId ? "Continue your draft" : "Contribute a new resource"),
    [draftId],
  );

  if (draftId && (draftLoading || !draftLoaded)) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">
            {draftId ? "Draft" : "Upload"}
          </p>

          <h1 className="mt-1 font-display text-3xl font-semibold">
            {title}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {draftId
              ? "Continue editing your saved resource before submitting it for review."
              : "Your upload will be reviewed by an admin before appearing in the library."}
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
          className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft"
        >
          <div>
            <Label>File</Label>

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onFile(event.dataTransfer.files?.[0]);
              }}
              onClick={() => inputRef.current?.click()}
              className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/30 p-10 text-center transition-colors hover:border-primary/40 hover:bg-secondary/50"
            >
              {file ? (
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />

                  <div className="text-left">
                    <p className="font-medium">
                      {file.name}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setFile(null);
                    }}
                    className="ml-3 rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : existingFileName ? (
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />

                  <div className="text-left">
                    <p className="font-medium">
                      {existingFileName}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Current draft file
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <UploadIcon className="h-8 w-8 text-muted-foreground" />

                  <p className="mt-3 text-sm font-medium">
                    Drag & drop or click to upload
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF, DOCX, PPTX, ZIP, PNG, JPG — up to 50MB
                  </p>
                </>
              )}

              <input
                ref={inputRef}
                type="file"
                hidden
                onChange={(event) =>
                  onFile(
                    event.target.files?.[0] ?? undefined,
                  )
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="title">Title *</Label>

              <Input
                id="title"
                required
                value={form.title}
                onChange={(event) =>
                  setForm({
                    ...form,
                    title: event.target.value,
                  })
                }
                className="mt-1.5"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="desc">Description *</Label>

              <Textarea
                id="desc"
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setForm({
                    ...form,
                    description: event.target.value,
                  })
                }
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Category *</Label>

              <Select
                value={form.category_id}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                    category_id: value,
                  })
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>

                <SelectContent>
                  {cats?.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="course">
                Course Code *
              </Label>

              <Input
                id="course"
                placeholder="e.g. CSC 301"
                value={form.course_code}
                onChange={(event) =>
                  setForm({
                    ...form,
                    course_code: event.target.value,
                  })
                }
                className="mt-1.5"
              />
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
                    <SelectItem
                      key={college.id}
                      value={college.id}
                    >
                      <>
                        <span className="sm:hidden">
                          {college.id}
                        </span>

                        <span className="hidden sm:inline">
                          {college.name} ({college.id})
                        </span>
                      </>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isSGS && (
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
        {departments.map((department) => (
          <SelectItem
            key={department}
            value={department}
          >
            {department}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}

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
                    <SelectItem
                      key={level}
                      value={level}
                    >
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
                    <SelectItem
                      key={semester}
                      value={semester}
                    >
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
                  <SelectValue placeholder="Choose Year" />
                </SelectTrigger>

                <SelectContent>
                  {years.map((year) => (
                    <SelectItem
                      key={year}
                      value={year.toString()}
                    >
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {progress > 0 && (
            <Progress value={progress} />
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                nav({ to: "/dashboard" })
              }
              disabled={saveResource.isPending}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={
                saveResource.isPending ||
                (!file && !existingFilePath)
              }
            >
              {saveResource.isPending &&
              exitAction === "save" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}

              Save as draft
            </Button>

            <Button
              type="submit"
              disabled={
                saveResource.isPending ||
                (!file && !existingFilePath)
              }
              className="bg-gradient-emerald text-primary-foreground shadow-soft"
            >
              {saveResource.isPending &&
              exitAction !== "save" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}

              Submit for review
            </Button>
          </div>
        </form>
      </div>

      <AlertDialog
        open={showSubmitConfirm}
        onOpenChange={setShowSubmitConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Submit resource for review?
            </AlertDialogTitle>

            <AlertDialogDescription>
              Your resource will be uploaded and sent to an
              administrator for review. It will remain pending
              until an admin reviews it.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Continue editing
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={confirmSubmit}
              className="bg-gradient-emerald text-primary-foreground"
            >
              Submit for review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showDraftConfirm}
        onOpenChange={setShowDraftConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Save as draft?
            </AlertDialogTitle>

            <AlertDialogDescription>
              Your upload will be saved privately as a draft.
              You can return to My Uploads later, continue
              editing it, and submit it for review when ready.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Continue editing
            </AlertDialogCancel>

            <AlertDialogAction onClick={confirmSaveDraft}>
              Save as draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {blocker.status === "blocked" && (
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Save your progress?
              </AlertDialogTitle>

              <AlertDialogDescription>
                You have unsaved upload information. Would you
                like to save this resource as a draft before
                leaving?
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={blocker.reset}
              >
                Continue editing
              </Button>

              <Button
                type="button"
                variant="destructive"
                onClick={handleDiscard}
              >
                Discard
              </Button>

              <Button
                type="button"
                onClick={handleExitSave}
                disabled={saveResource.isPending}
                className="bg-gradient-emerald text-primary-foreground"
              >
                {saveResource.isPending &&
                exitAction === "save" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}

                Save as draft
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}