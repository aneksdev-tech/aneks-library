import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Check,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import {
  getContributorLevel,
  getLevelProgress,
  getNextContributorLevel,
} from "@/lib/reputation";
import { supabase } from "@/integrations/supabase/client";

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

import {
  colleges,
  levels,
  getDepartments,
} from "@/lib/academicData";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user, refresh } = useAuth();

  const isResearcher = profile?.primary_role === "researcher";
  const isLecturer = profile?.primary_role === "lecturer";
  const isStudent = profile?.primary_role === "student";
  const isStaff = profile?.primary_role === "staff";

  const hasAcademicInformation =
    isStudent ||
    isLecturer ||
    isStaff ||
    isResearcher;

  const needsLevel = isStudent;

  const roleLabel =
    profile?.primary_role
      ? profile.primary_role
          .split("-")
          .map(
            (word) =>
              word.charAt(0).toUpperCase() + word.slice(1),
          )
          .join(" ")
      : "User";

  const contributor = getContributorLevel(
    profile?.reputation ?? 0,
  );

  const progress = getLevelProgress(
    profile?.reputation ?? 0,
  );

  const nextLevel = getNextContributorLevel(
    profile?.reputation ?? 0,
  );

  const planLabel =
    profile?.subscription_plan === "premium"
      ? "⭐ Premium"
      : "🟢 Free";

  const avatarUrl = profile?.avatar_url || null;

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    bio: "",
    phone_number: "",
    college: "",
    department: "",
    level: "",
  });

  /*
   * This represents the last SAVED state.
   * It is intentionally separate from `form` so the completion
   * percentage never changes merely because the user is typing.
   */
  const [savedForm, setSavedForm] = useState({
    full_name: "",
    bio: "",
    phone_number: "",
    college: "",
    department: "",
    level: "",
  });

  useEffect(() => {
    if (!profile) return;

    const initialForm = {
      full_name: profile.full_name ?? "",
      bio: profile.bio ?? "",
      phone_number: profile.phone_number ?? "",
      college: profile.college ?? "",
      department: profile.department ?? "",
      level: profile.level ?? "",
    };

    setForm(initialForm);
    setSavedForm(initialForm);
  }, [profile]);

  const setField = (
    field: keyof typeof form,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const departments = useMemo(
    () => getDepartments(form.college),
    [form.college],
  );

  /*
   * Full name validation
   */
  const fullNameValid =
    /^[A-Za-z\s'-]{3,}$/.test(
      form.full_name.trim(),
    );

  /*
   * Phone number:
   *
   * Formatting characters are allowed while typing:
   * + ( ) . - and spaces.
   *
   * The actual number of digits, ignoring formatting,
   * must be between 13 and 15 digits.
   *
   * Empty phone number is allowed because the field is optional.
   */
  const phoneDigits = form.phone_number.replace(
    /\D/g,
    "",
  );

  const phoneValid =
    form.phone_number.trim() === "" ||
    (phoneDigits.length >= 13 &&
      phoneDigits.length <= 15);

    /*
   * Academic information completion is role-specific
   * and based ONLY on saved values.
   *
   * Student:
   *   College + Department + Level
   *
   * Lecturer / Staff / Researcher:
   *   College/Institution + Department/Research Area
   *
   * Users without academic information:
   *   No academic requirement.
   */
  const academicComplete = hasAcademicInformation
    ? isStudent
      ? Boolean(
          savedForm.college.trim() &&
            savedForm.department.trim() &&
            savedForm.level.trim(),
        )
      : Boolean(
          savedForm.college.trim() &&
            savedForm.department.trim(),
        )
    : true;

  /*
   * Phone completion:
   * The phone number is considered complete only when
   * it contains 13–15 actual digits, ignoring formatting
   * characters such as spaces, +, (), . and -.
   */
  const savedPhoneDigits =
    savedForm.phone_number.replace(/\D/g, "");

  const phoneComplete =
    savedPhoneDigits.length >= 13 &&
    savedPhoneDigits.length <= 15;

  /*
   * Completion is based ONLY on saved profile information.
   *
   * Without academic information:
   *   4 items × 25% = 100%
   *
   * With academic information:
   *   5 items × 20% = 100%
   *
   * Academic requirements themselves remain role-specific.
   */
  const completionItems = [
    Boolean(profile?.avatar_url),
    Boolean(savedForm.full_name.trim()),
    phoneComplete,
    Boolean(savedForm.bio.trim()),
    ...(hasAcademicInformation
      ? [academicComplete]
      : []),
  ];

  const completion = Math.round(
    (completionItems.filter(Boolean).length /
      completionItems.length) *
      100,
  );

  /*
   * Determine whether anything has changed since the
   * last successful save.
   */
  const isDirty =
    form.full_name !== savedForm.full_name ||
    form.bio !== savedForm.bio ||
    form.phone_number !== savedForm.phone_number ||
    form.college !== savedForm.college ||
    form.department !== savedForm.department ||
    form.level !== savedForm.level;

  /*
   * Save button validation.
   *
   * Phone is optional, but if supplied it must contain
   * exactly 13–15 digits.
   */
  const academicValid = hasAcademicInformation
    ? isStudent
      ? Boolean(
          form.college &&
            form.department &&
            form.level,
        )
      : Boolean(
          form.college &&
            form.department,
        )
    : true;

  const canSave =
    !busy &&
    isDirty &&
    fullNameValid &&
    phoneValid &&
    academicValid;

  const save = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();

    if (!user) {
      toast.error(
        "Unable to identify your account.",
      );
      return;
    }

    if (!fullNameValid) {
      toast.error(
        "Full name must be at least 3 letters and contain only letters, spaces, apostrophes, or hyphens.",
      );
      return;
    }

    if (!phoneValid) {
      toast.error(
        "Phone number must contain 13–15 digits.",
      );
      return;
    }

    if (!academicValid) {
      toast.error(
        isStudent
          ? "Please select your college, department, and level."
          : "Please select your college and department.",
      );
      return;
    }

    if (!isDirty) {
      return;
    }

    setBusy(true);

    try {
      const updateData = {
        full_name: form.full_name.trim(),
        bio: form.bio.trim(),
        phone_number: form.phone_number.trim(),
        college: form.college,
        department: form.department,
        level: isStudent ? form.level : "",
      };

      const { error } =
        await supabase
          .from("profiles")
          .update(updateData)
          .eq("id", user.id);

      if (error) {
        toast.error(error.message);
        return;
      }

      /*
       * Immediately update the saved snapshot.
       * This makes the Save button disabled again and
       * prevents completion from reacting to unsaved data.
       */
      setForm(updateData);
      setSavedForm(updateData);

      toast.success(
        "Profile updated successfully.",
      );

      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update profile.",
      );
    } finally {
      setBusy(false);
    }
  };

  const uploadAvatar = async (
    file: File,
  ) => {
    if (!user) return;

    /*
     * Basic image validation.
     */
    if (!file.type.startsWith("image/")) {
      toast.error(
        "Please select a valid image file.",
      );
      return;
    }

    /*
     * Prevent unnecessarily large uploads.
     */
    if (file.size > 5 * 1024 * 1024) {
      toast.error(
        "Profile photo must be 5MB or smaller.",
      );
      return;
    }

    try {
      setBusy(true);

      /*
       * Delete previous avatar if it exists.
       */
      if (profile?.avatar_url) {
        try {
          const url = new URL(
            profile.avatar_url,
          );

          const marker =
            "/storage/v1/object/public/avatar/";

          const index =
            url.pathname.indexOf(marker);

          if (index !== -1) {
            const oldPath =
              decodeURIComponent(
                url.pathname.substring(
                  index + marker.length,
                ),
              );

            await supabase.storage
              .from("avatar")
              .remove([oldPath]);
          }
        } catch {
          /*
           * Ignore URL parsing/deletion errors.
           * The new avatar can still be uploaded.
           */
        }
      }

      const ext =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase() || "png";

      const fileName =
        `${user.id}/avatar.${ext}`;

      const { error: uploadError } =
        await supabase.storage
          .from("avatar")
          .upload(
            fileName,
            file,
            {
              upsert: true,
              contentType: file.type,
            },
          );

      if (uploadError) {
        throw uploadError;
      }

      const { data } =
        supabase.storage
          .from("avatar")
          .getPublicUrl(fileName);

      const { error: updateError } =
        await supabase
          .from("profiles")
          .update({
            avatar_url:
              data.publicUrl,
          })
          .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      toast.success(
        "Profile photo updated.",
      );

      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update profile photo.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-gold">
          Profile
        </p>

        <h1 className="mt-1 font-display text-2xl font-semibold">
          Your account
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Manage your personal information,
          academic details, and account profile.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main profile card */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {/* Profile identity */}
          <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
            <div className="flex flex-col items-start gap-6">
              <div className="flex w-full flex-col items-start gap-6 sm:flex-row sm:items-start">
                <div className="relative shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={
                        profile?.full_name ||
                        "Profile avatar"
                      }
                      className="h-40 w-32 rounded-2xl border-2 border-primary/30 object-cover shadow-xl"
                    />
                  ) : (
                    <div className="flex h-40 w-32 items-center justify-center rounded-2xl border-2 border-primary/30 bg-muted text-5xl font-bold shadow-lg">
                      {(
                        profile?.full_name ||
                        "U"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Change profile photo"
                    title="Change profile photo"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center justify-start gap-2">
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {roleLabel}
                    </span>

                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {contributor.emoji}{" "}
                      {contributor.name}
                    </span>
                  </div>

                  <h2 className="mt-3 truncate font-display text-2xl font-semibold">
                    {profile?.full_name ||
                      "Unnamed User"}
                  </h2>

                  <div className="mt-2 flex items-center justify-start gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />

                    <span className="truncate">
                      {user?.email ||
                        "No email available"}
                    </span>
                  </div>

                  {profile?.bio ? (
                    <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                      {profile.bio}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm italic text-muted-foreground">
                      No bio yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Completion — intentionally before editable information */}
          <div className="border-b border-border sm:p-2">
            <div className="rounded-2xl border border-none bg-muted/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Profile
                  </p>

                  <h3 className="mt-1 text-base font-semibold">
                    Completion
                  </h3>
                </div>

                <span className="text-2xl font-semibold">
                  {completion}%
                </span>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-emerald transition-all duration-500"
                  style={{
                    width: `${completion}%`,
                  }}
                />
              </div>

                <div className="mt-5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Profile photo
                  </span>

                  <span>
                    {profile?.avatar_url
                      ? "✅"
                      : "⬜"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Full name
                  </span>

                  <span>
                    {savedForm.full_name.trim()
                      ? "✅"
                      : "⬜"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Phone number
                  </span>

                  <span>
                    {phoneComplete
                      ? "✅"
                      : "⬜"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Bio
                  </span>

                  <span>
                    {savedForm.bio.trim()
                      ? "✅"
                      : "⬜"}
                  </span>
                </div>

                {hasAcademicInformation && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Academic information
                    </span>

                    <span>
                      {academicComplete
                        ? "✅"
                        : "⬜"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Editable information */}
          <form
            onSubmit={save}
            className="space-y-7 p-6 sm:p-8"
          >
            <div>
              <div className="mb-4">
                <h3 className="text-base font-semibold">
                  Personal information
                </h3>

                <p className="mt-1 text-xs text-muted-foreground">
                  Keep your account information
                  accurate and up to date.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <Label htmlFor="email">
                    Email address
                  </Label>

                  <Input
                    id="email"
                    value={
                      user?.email ?? ""
                    }
                    disabled
                    className="mt-1.5 bg-muted/50"
                  />

                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Your email address is
                    managed by your account
                    authentication.
                  </p>
                </div>

                <div>
                  <Label htmlFor="full-name">
                    Full name
                  </Label>

                  <Input
                    id="full-name"
                    value={form.full_name}
                    onChange={(e) =>
                      setField(
                        "full_name",
                        e.target.value,
                      )
                    }
                    className="mt-1.5"
                    placeholder="Enter your full name"
                  />

                  {form.full_name &&
                    !fullNameValid && (
                      <p className="mt-1.5 text-xs text-destructive">
                        Full name must be at least
                        3 letters and contain only
                        letters, spaces, apostrophes,
                        or hyphens.
                      </p>
                    )}
                </div>

                <div>
                  <Label htmlFor="phone">
                    Phone number
                  </Label>

                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={20}
                    value={
                      form.phone_number
                    }
                    onChange={(e) => {
                      const value =
                        e.target.value;

                      /*
                       * Allow only:
                       * digits
                       * spaces
                       * +
                       * parentheses
                       * periods
                       * hyphens
                       */
                      if (
                        !/^[+]?[0-9\s().-]*$/.test(
                          value,
                        )
                      ) {
                        return;
                      }

                      setField(
                        "phone_number",
                        value,
                      );
                    }}
                    placeholder="+234 800 000 0000"
                    className="mt-1.5"
                  />

                  {form.phone_number &&
                  !phoneValid ? (
                    <p className="mt-1.5 text-xs text-destructive">
                      Enter a valid phone number
                      containing 13–15 digits.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Only you and authorized administrators can access your phone number.
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="bio">
                    Bio
                  </Label>

                  <Textarea
                    id="bio"
                    rows={4}
                    maxLength={500}
                    value={form.bio}
                    onChange={(e) =>
                      setField(
                        "bio",
                        e.target.value,
                      )
                    }
                    className="mt-1.5 resize-none"
                    placeholder="Tell the Aneks Library community a little about yourself..."
                  />

                  <p className="mt-1.5 text-right text-xs text-muted-foreground">
                    {form.bio.length}/500
                  </p>
                </div>
              </div>
            </div>

            {/* Academic information */}
            {hasAcademicInformation && (
              <div className="border-t border-border pt-7">
                <div className="mb-4">
                  <h3 className="text-base font-semibold">
                    Academic information
                  </h3>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Select the information that
                    matches your current academic
                    role.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* College / Institution */}
                  <div
                    className={
                      isStudent
                        ? "sm:col-span-2"
                        : "sm:col-span-1"
                    }
                  >
                    <Label htmlFor="college">
                      {isResearcher
                        ? "Institution"
                        : "College"}
                    </Label>

                    {isResearcher ? (
                      <Input
                        id="college"
                        value={form.college}
                        onChange={(e) =>
                          setField(
                            "college",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. OpenAI"
                        className="mt-1.5"
                      />
                    ) : (
                      <Select
                        value={
                          form.college
                        }
                        onValueChange={(
                          value,
                        ) => {
                          setForm(
                            (current) => ({
                              ...current,
                              college:
                                value,
                              department:
                                "",
                            }),
                          );
                        }}
                      >
                        <SelectTrigger
                          id="college"
                          className="mt-1.5 w-full"
                        >
                          <SelectValue placeholder="Select College" />
                        </SelectTrigger>

                        <SelectContent>
                          {colleges.map(
                            (college) => (
                              <SelectItem
                                key={
                                  college.id
                                }
                                value={
                                  college.id
                                }
                              >
                                <span className="sm:hidden">
                                  {
                                    college.id
                                  }
                                </span>

                                <span className="hidden sm:inline">
                                  {
                                    college.name
                                  }
                                </span>
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Department / Research Area */}
                  <div>
                    <Label htmlFor="department">
                      {isResearcher
                        ? "Research Area"
                        : "Department"}
                    </Label>

                    {isResearcher ? (
                      <Input
                        id="department"
                        value={
                          form.department
                        }
                        onChange={(e) =>
                          setField(
                            "department",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. Artificial Intelligence"
                        className="mt-1.5"
                      />
                    ) : (
                      <Select
                        value={
                          form.department
                        }
                        onValueChange={(
                          value,
                        ) =>
                          setField(
                            "department",
                            value,
                          )
                        }
                        disabled={
                          !form.college
                        }
                      >
                        <SelectTrigger
                          id="department"
                          className="mt-1.5 w-full"
                        >
                          <SelectValue
                            placeholder={
                              form.college
                                ? "Select Department"
                                : "Select College first"
                            }
                          />
                        </SelectTrigger>

                        <SelectContent>
                          {!form.college ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              Select College
                              first
                            </div>
                          ) : departments.length ===
                            0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              No departments
                              available
                            </div>
                          ) : (
                            departments.map(
                              (
                                department,
                              ) => (
                                <SelectItem
                                  key={
                                    department
                                  }
                                  value={
                                    department
                                  }
                                >
                                  {
                                    department
                                  }
                                </SelectItem>
                              ),
                            )
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Level — Student only */}
                  {needsLevel && (
                    <div>
                      <Label htmlFor="level">
                        Level
                      </Label>

                      <Select
                        value={form.level}
                        onValueChange={(
                          value,
                        ) =>
                          setField(
                            "level",
                            value,
                          )
                        }
                      >
                        <SelectTrigger
                          id="level"
                          className="mt-1.5 w-full"
                        >
                          <SelectValue placeholder="Select Level" />
                        </SelectTrigger>

                        <SelectContent>
                          {levels.map(
                            (level) => (
                              <SelectItem
                                key={level}
                                value={level}
                              >
                                {level}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Save area */}
            <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                {isDirty ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    You have unsaved changes.
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    All changes are saved.
                  </span>
                )}
              </div>

              <Button
                type="submit"
                disabled={!canSave}
                className="bg-gradient-emerald text-primary-foreground shadow-soft"
              >
                {busy && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}

                {busy
                  ? "Saving..."
                  : "Save changes"}
              </Button>
            </div>
          </form>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Reputation */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Contribution
                </p>

                <h3 className="mt-1 text-base font-semibold">
                  Reputation
                </h3>
              </div>

              <span className="text-lg font-semibold">
                {profile?.reputation ?? 0}

                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  pts
                </span>
              </span>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-xl">
                {contributor.emoji}
              </div>

              <div>
                <p className="font-medium">
                  {contributor.name}
                </p>

                <p className="text-xs text-muted-foreground">
                  Contributor level
                </p>
              </div>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-emerald transition-all duration-500"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              {nextLevel
                ? `${nextLevel.pointsNeeded} pts until ${nextLevel.emoji} ${nextLevel.name}`
                : "Highest contributor level reached 👑"}
            </p>
          </div>

          {/* Account */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />

              <h3 className="text-base font-semibold">
                Account
              </h3>
            </div>

            <div className="mt-5 divide-y divide-border">
              <div className="flex items-center justify-between py-3 first:pt-0">
                <span className="text-sm text-muted-foreground">
                  Plan
                </span>

                <span className="text-sm font-medium">
                  {planLabel}
                </span>
              </div>

              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-muted-foreground">
                  Status
                </span>

                <span className="text-sm font-medium capitalize">
                  {profile?.status ===
                  "active"
                    ? "🟢 Active"
                    : profile?.status ||
                      "-"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
                <span className="text-sm text-muted-foreground">
                  Member since
                </span>

                <span className="text-right text-sm font-medium">
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
        </div>
      </div>

      {/* Hidden avatar input */}
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
    </div>
  );
}