import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Download,
  FileQuestion,
  FlaskConical,
  FolderKanban,
  NotebookPen,
  Presentation,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Bookmark,
  BarChart3,
  UserCog,
  Mail,
  MessageCircle,
  Sun,
  Moon,
  GraduationCap,
} from "lucide-react";
import { useState } from "react";
import heroImg from "@/assets/hero7.jpeg";
import logo from "@/assets/Logo__Circle (2).png";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aneks Library | Built for Academic Exellence" },
      {
        name: "description",
        content:
          "A premium academic repository for students, lecturers and researchers. Upload past questions, projects, seminar papers, notes and research.",
      },
      { property: "og:title", content: "Aneks Library | Access Academic Resources Instantly" },
      {
        property: "og:description",
        content: "Built for Academic Exellence",
      },
    ],
  }),
  component: LandingPage,
});

const stats = [
  { label: "Resources", value: "12k+" },
  { label: "Departments", value: "40+" },
  { label: "Downloads", value: "250k+" },
  { label: "Active Users", value: "2k+" },
];

const features = [
  { icon: Upload, title: "Upload Resources", desc: "Contribute past questions, notes, projects and more in seconds." },
  { icon: Search, title: "Fast Search", desc: "Instant, filterable search across every category and department." },
  { icon: Download, title: "Unlimited Premium Downloads", desc: "Free users preview resources while Premium members enjoy unlimited secure downloads." },
  { icon: ShieldCheck, title: "Verified Accounts", desc: "Email verification, role-aware sessions and row-level security." },
  { icon: UserCog, title: "Role-Based Access", desc: "Distinct experiences for students, lecturers, researchers and admins." },
  { icon: Shield, title: "Admin Moderation", desc: "Every upload is reviewed before it goes public. Quality guaranteed." },
  { icon: BarChart3, title: "Learning Insights", desc: "Track uploads, downloads and community engagement over time." },
  { icon: Bookmark, title: "Bookmarks", desc: "Save the resources you love and sync them across all your devices." },
];

const categories = [
  { icon: FileQuestion, name: "Past Questions", desc: "Previous exam & test papers", slug: "past-questions" },
  { icon: FolderKanban, name: "Projects", desc: "Final-year & semester projects", slug: "projects" },
  { icon: Presentation, name: "Seminars", desc: "Seminar papers & slide decks", slug: "seminars" },
  { icon: ClipboardList, name: "Assignments", desc: "Coursework & solutions", slug: "assignments" },
  { icon: NotebookPen, name: "Lecture Notes", desc: "Course notes & summaries", slug: "lecture-notes" },
  { icon: FlaskConical, name: "Research Papers", desc: "Academic publications", slug: "research-papers" },
  { icon: BookOpen, name: "E-books", desc: "Textbooks & references", slug: "e-books" },
];

const steps = [
  { n: "01", title: "Create Account", desc: "Create an account as a student, lecturer or researcher, free forever." },
  { n: "02", title: "Browse Resources", desc: "Browse structured academic contents." },
  { n: "03", title: "Upload", desc: "An admin reviews and approves your upload, usually within a day." },
  { n: "04", title: "Available", desc: "Once approved, your resource is discoverable and downloadable by the community." },
  { n: "05", title: "Preview Instantly", desc: "Preview academic resources before download." },
  { n: "06", title: "Download (Premium)", desc: "Premium subscription required before academic resources download." },
];

const testimonials = [
  {
    name: "Adaeze N.",
    role: "300L, Computer Science, MOUAU",
    quote:
      "Aneks Library saved my semester. Every past question I needed was one search away — and the interface actually feels premium.",
  },
  {
    name: "Dr. Ibrahim K.",
    role: "Lecturer, Electrical Engineering, MOUAU",
    quote:
      "Distributing course materials used to mean five emails and a WhatsApp group. Now students just find them here.",
  },
  {
    name: "Chidinma O.",
    role: "400L, Department of Chemistry, MOUAU",
    quote:
      "The moderation queue keeps quality high. It reads like a real academic archive, not a random file dump.",
  },
];

const faqs = [
  {
    q: "Can I use Aneks Library for free?",
    a: "Yes. Free members can browse, preview, read, and bookmark resources. Premium members enjoy unlimited downloads, exclusive materials and an ad-free experience.",
  },
  {
    q: "Why Premium?",
    a: "Premium keeps the platform sustainable while allowing us to maintain high-quality academic resources for students.",
  },
  {
    q: "Do I need approval to upload?",
    a: "No. You can upload anytime. An admin reviews each resource before it goes public to keep quality high.",
  },
  {
    q: "Who can access my uploads?",
    a: "Approved resources are visible to everyone. Pending or rejected uploads are visible only to you and admins.",
  },
  {
    q: "Can lecturers approve resources?",
    a: "No. Only admins can approve, reject or delete resources. Lecturers upload and manage their own contributions.",
  },
  {
    q: "How is my data protected?",
    a: "We use row-level security, private storage buckets and signed download URLs. Only you control your account.",
  },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="rounded-md border border-border bg-card p-2 text-muted-foreground shadow-soft transition-colors hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function Header() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
        <img
          src={logo}
          alt="Aneks Library"
          className="h-10 w-10 rounded-lg object-contain"
        />

          <span className="font-display text-lg font-semibold tracking-tight">
        <span className="text-gold">Aneks</span>Library
    </span>
</Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
  <a href="#features" className="transition-colors hover:text-foreground">
    Features
  </a>

  <a href="#categories" className="transition-colors hover:text-foreground">
    Categories
  </a>

  <Link
    to="/pricing"
    className="transition-colors hover:text-primary font-medium"
  >
    Pricing
  </Link>

  <a href="#how" className="transition-colors hover:text-foreground">
    How it works
  </a>

  <a href="#faq" className="transition-colors hover:text-foreground">
    FAQ
  </a>
</nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session ? (
            <Button asChild size="sm" className="bg-gradient-emerald text-primary-foreground shadow-soft">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth" search={{ mode: "login" }}>Login</Link>
              </Button>
              <Button asChild size="sm" className="bg-gradient-emerald text-primary-foreground shadow-soft">
                <Link to="/auth" search={{ mode: "register" }}>Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Header />

      {/* HERO — split screen */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_20%_0%,color-mix(in_oklab,var(--color-primary)_18%,transparent),transparent)]" />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              Designed for MOUAU Students • Expanding to More Universities
            </div>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            <span className="text-gold">Smart Digital Library,</span> built for Academic Excellence
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Access past questions, lecture notes, projects, seminar papers, research materials and premium academic resources from one secure platform. Built first for Michael Okpara University of Agriculture, Umudike (MOUAU), with plans to expand across Nigerian universities.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-emerald text-primary-foreground shadow-elegant">
                <Link to="/auth" search={{ mode: "register" }}>
                  Get started <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/library">Login</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
              <Link to="/pricing">Premium Plans</Link>
              </Button>
            </div>
            <dl className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-border/60 bg-card/60 p-4 shadow-soft">
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</dt>
                  <dd className="mt-1 font-display text-2xl font-semibold">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-emerald opacity-20 blur-3xl" />
            <div className="overflow-hidden rounded-3xl border border-border shadow-elegant">
              <img
                src={heroImg}
                alt="Illustration of an academic library reading room"
                width={1280}
                height={1024}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-0 -left-0 hidden max-w-[220px] rounded-2xl border border-border bg-card p-4 shadow-elegant sm:block">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5 text-primary" /> Helped Students
              </div>
              <div className="mt-1 font-display text-2xl font-semibold">10k+</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-14 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-gold">Features</p>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              Everything a serious academic community needs.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border/60 bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
              >
                <span className="inline-grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section id="categories" className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-14 flex items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-gold">Categories</p>
              <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
                Everything You Need to Excel Academically.
              </h2>
            </div>
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/library">Browse library <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => (
              <Link
                key={c.slug}
                to="/library"
                className="group rounded-2xl border border-border/60 bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant"
              >
                <span className="inline-grid h-11 w-11 place-items-center rounded-xl bg-gradient-emerald text-primary-foreground">
                  <c.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{c.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Browse <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-14 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-gold">How it works</p>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              From upload to download, in four steps.
            </h2>
          </div>
          <ol className="grid gap-4 md:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.n} className="relative rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
                <div className="flex items-center gap-3">
                  <span className="font-display text-3xl font-semibold text-gold">{s.n}</span>
                  {i < steps.length - 1 && (
                    <span className="hidden h-px flex-1 bg-border md:block" aria-hidden />
                  )}
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-14 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-gold">Voices</p>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              Trusted by students, lecturers and researchers.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.name} className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
                <blockquote className="text-sm leading-relaxed text-foreground">"{t.quote}"</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-emerald text-sm font-medium text-primary-foreground">
                    {t.name[0]}
                  </span>
                  <div>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <div className="mb-10 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-gold">FAQ</p>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Common questions.</h2>
          </div>
          <Accordion type="single" collapsible className="rounded-2xl border border-border/60 bg-card px-4 shadow-soft">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border/60 last:border-b-0">
                <AccordionTrigger className="text-left font-display text-base">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="border-t border-border/60">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Contact</p>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Need Help? We're always ready to assist MOUAU students with their academic journey.</h2>
          <p className="mt-3 text-muted-foreground">
            Reach out on email or WhatsApp — we usually respond within a few hours.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-emerald text-primary-foreground shadow-elegant">
              <a href="mailto:hello@anekslibrary.com">
                <Mail className="mr-2 h-4 w-4" /> Email us
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a
                href="https://wa.me/2340000000000"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-gradient-emerald text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-semibold"><span className="text-gold">Aneks</span>Library</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              The official digital academic library built for Michael Okpara University of Agriculture, Umudike (MOUAU). Helping students study smarter.
            </p>
          </div>
          <div>
            <div className="mb-3 text-sm font-medium">Product</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/library" className="hover:text-foreground">Library</Link></li>
              <li><a href="#features" className="hover:text-foreground">Features</a></li>
              <li><a href="#categories" className="hover:text-foreground">Categories</a></li>
              <li><Link to="/pricing" className="hover:text-foreground">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-sm font-medium">Company</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
              <li><a href="mailto:hello@anekslibrary.com" className="hover:text-foreground">Contact</a></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-sm font-medium">Newsletter</div>
            <p className="text-sm text-muted-foreground">Occasional updates on new categories and improvements.</p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <input
                type="email"
                required
                placeholder="you@university.edu"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="submit" className="bg-gradient-emerald text-primary-foreground">Join</Button>
            </form>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
            <p>© {new Date().getFullYear()} Aneks Library. All rights reserved.</p>
            <p>Built with ❤️ by AneksDev Technologies.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
