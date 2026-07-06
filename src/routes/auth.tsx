import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, GraduationCap, Loader2, Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import heroImg from "@/assets/hero-library.jpg";

const searchSchema = z.object({
  mode: z.enum(["login", "register", "forgot"]).catch("login"),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Aneks Library" },
      { name: "description", content: "Sign in or create an Aneks Library account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const ROLES = [
  { value: "student", label: "Student" },
  { value: "lecturer", label: "Lecturer" },
  { value: "researcher", label: "Researcher" },
] as const;

function AuthPage() {
  const { mode, next } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: next || "/dashboard" });
    }
  }, [loading, session, navigate, next]);

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Left — form */}
      <div className="relative flex flex-col p-6 sm:p-10">
        <Link to="/" className="inline-flex w-fit items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-gradient-emerald text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-semibold">Aneks<span className="text-gold">.</span>Library</span>
        </Link>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          {mode === "login" && <LoginForm />}
          {mode === "register" && <RegisterForm />}
          {mode === "forgot" && <ForgotForm />}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>

      {/* Right — visual */}
      <div className="relative hidden lg:block">
        <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-emerald opacity-80 mix-blend-multiply" />
        <div className="relative flex h-full flex-col justify-end p-12 text-primary-foreground">
          <p className="text-xs uppercase tracking-[0.2em] text-gold">The academic archive</p>
          <h2 className="mt-3 max-w-md font-display text-4xl font-semibold leading-tight">
            Every past question, project and paper — one calm library.
          </h2>
          <p className="mt-3 max-w-md text-sm text-primary-foreground/80">
            Join thousands of students and lecturers sharing quality resources across universities.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const navigate = useNavigate();

  const handleGoogle = async () => {
  setBusy(true);

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });

    if (error) {
      toast.error(error.message);
    }
  } finally {
    setBusy(false);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!remember) sessionStorage.setItem("aneks-remember", "0");
    toast.success("Welcome back.");
    navigate({ to: "/dashboard" });
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to your Aneks Library account.</p>

      <Button
        type="button"
        variant="outline"
        className="mt-6 w-full"
        onClick={handleGoogle}
        disabled={busy}
      >
        <GoogleIcon /> Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or email <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/auth" search={{ mode: "forgot" }} className="text-xs text-primary hover:underline">
              Forgot?
            </Link>
          </div>
          <div className="relative mt-1.5">
            <Input id="password" type={showPass ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded border-border" />
          Remember me on this device
        </label>
        <Button type="submit" disabled={busy} className="w-full bg-gradient-emerald text-primary-foreground shadow-soft">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link to="/auth" search={{ mode: "register" }} className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

function RegisterForm() {
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<"student" | "lecturer" | "researcher">("student");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm: "",
    college: "",
    department: "",
    level: "",
  });
  const navigate = useNavigate();

  const isStudent = role === "student";
  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleGoogle = async () => {
  setBusy(true);

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });

    if (error) {
      toast.error(error.message);
    }
  } finally {
    setBusy(false);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return toast.error("Passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          full_name: form.full_name,
          role,
          college: isStudent ? form.college : null,
          department: isStudent ? form.department : null,
          level: isStudent ? form.level : null,
        },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to verify your account.");
    navigate({ to: "/verify-email", search: { email: form.email } });
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Create your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">Join Aneks Library — free forever.</p>

      <Button type="button" variant="outline" className="mt-6 w-full" onClick={handleGoogle} disabled={busy}>
        <GoogleIcon /> Continue with Google
      </Button>
      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" required value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setField("email", e.target.value)} className="mt-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1.5">
              <Input id="password" type={showPass ? "text" : "password"} required autoComplete="new-password" value={form.password} onChange={(e) => setField("password", e.target.value)} />
              <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirm">Confirm</Label>
            <Input id="confirm" type={showPass ? "text" : "password"} required value={form.confirm} onChange={(e) => setField("confirm", e.target.value)} className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {!isStudent && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {role === "lecturer" ? "Lecturer" : "Researcher"} accounts require admin approval before dashboard access.
            </p>
          )}
        </div>

        <div className={`grid grid-cols-3 gap-3 transition-opacity ${isStudent ? "opacity-100" : "pointer-events-none opacity-50"}`}>
          <div className="col-span-3 sm:col-span-1">
            <Label htmlFor="college">College</Label>
            <Input id="college" disabled={!isStudent} value={form.college} onChange={(e) => setField("college", e.target.value)} className="mt-1.5" />
          </div>
          <div className="col-span-3 sm:col-span-1">
            <Label htmlFor="dept">Department</Label>
            <Input id="dept" disabled={!isStudent} value={form.department} onChange={(e) => setField("department", e.target.value)} className="mt-1.5" />
          </div>
          <div className="col-span-3 sm:col-span-1">
            <Label htmlFor="level">Level</Label>
            <Input id="level" disabled={!isStudent} placeholder="e.g. 300" value={form.level} onChange={(e) => setField("level", e.target.value)} className="mt-1.5" />
          </div>
        </div>

        <Button type="submit" disabled={busy} className="w-full bg-gradient-emerald text-primary-foreground shadow-soft">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link to="/auth" search={{ mode: "login" }} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function ForgotForm() {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Reset link sent — check your email.");
  };

  return (
    <div>
      <Link to="/auth" search={{ mode: "login" }} className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to sign in
      </Link>
      <h1 className="font-display text-3xl font-semibold">Reset your password</h1>
      <p className="mt-2 text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>

      {sent ? (
        <div className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-6 text-center">
          <Mail className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 font-medium">Check your inbox</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a reset link to <span className="text-foreground">{email}</span>.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-emerald text-primary-foreground shadow-soft">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send reset link
          </Button>
        </form>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.67-2.26 1.06-3.71 1.06-2.85 0-5.27-1.92-6.13-4.5H2.18v2.83A11 11 0 0 0 12 23Z"/>
      <path fill="#FBBC05" d="M5.87 14.14a6.6 6.6 0 0 1 0-4.28V7.03H2.18a11 11 0 0 0 0 9.94l3.69-2.83Z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.03l3.69 2.83C6.73 7.3 9.15 5.38 12 5.38Z"/>
    </svg>
  );
}
