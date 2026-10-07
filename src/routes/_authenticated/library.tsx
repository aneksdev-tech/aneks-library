import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { useAccess } from "@/hooks/useAccess";
import { supabase } from "@/integrations/supabase/client";
import {
  colleges,
  levels,
  semesters,
  getDepartments,
  ALL_OPTION,
} from "@/lib/academicData";
import { useAuth } from "@/lib/auth";
import {
  Bookmark,
  Download,
  Search,
  Eye,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { EmptyState } from "./dashboard";
import { ResourceTypeBadge } from "@/components/ResourceTypeBadge";

export const Route = createFileRoute(
  "/_authenticated/library",
)({
  head: () => ({
    meta: [
      {
        title: "Library | Aneks Library",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] =
    useState<string>("all");
  const [sort, setSort] = useState<
    "newest" | "downloads" | "bookmarks"
  >("newest");

  const [college, setCollege] =
    useState(ALL_OPTION);

  const [department, setDepartment] =
    useState(ALL_OPTION);

  const [level, setLevel] =
    useState(ALL_OPTION);

  const [semester, setSemester] =
    useState(ALL_OPTION);

  const departments =
    college === ALL_OPTION
      ? []
      : getDepartments(college);

  const { canDownload } = useAccess();

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug")
        .is("deleted_at", null)
        .order("sort_order");

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "library",
      q,
      category,
      college,
      department,
      level,
      semester,
      sort,
    ],
    queryFn: async () => {
      let query = supabase
        .from("public_resources")
        .select(`
          id,
          title,
          description,
          course_code,
          college,
          department,
          level,
          semester,
          year,
          tags,
          category_id,
          download_count,
          bookmark_count,
          created_at,
          file_type,
          category_name,
          category_slug
        `);

      if (category !== ALL_OPTION) {
        query = query.eq("category_id", category);
      }

      if (college !== ALL_OPTION) {
        query = query.eq("college", college);
      }

      if (department !== ALL_OPTION) {
        query = query.eq(
          "department",
          department,
        );
      }

      if (level !== ALL_OPTION) {
        query = query.eq("level", level);
      }

      if (semester !== ALL_OPTION) {
        query = query.eq(
          "semester",
          semester,
        );
      }

      if (q.trim()) {
        query = query.or(
          `title.ilike.%${q}%,description.ilike.%${q}%,course_code.ilike.%${q}%`,
        );
      }

      const orderCol =
        sort === "newest"
          ? "created_at"
          : sort === "downloads"
            ? "download_count"
            : "bookmark_count";

      query = query
        .order(orderCol, {
          ascending: false,
        })
        .limit(60);

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
          Library
        </p>

        <h1 className="mt-1 font-display text-lg font-semibold sm:text-3xl">
          Browse approved resources
        </h1>

        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Search, filter and download the collective
          knowledge of the community.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 shadow-soft sm:p-4">
        <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
          {/* Search */}

          <div className="relative md:col-span-2 xl:col-span-3">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:h-4 sm:w-4" />

            <Input
              placeholder="Search title, course code, description…"
              value={q}
              onChange={(e) =>
                setQ(e.target.value)
              }
              className="h-9 pl-9 text-xs sm:h-10 sm:text-sm"
            />
          </div>

          {/* College */}

          <Select
            value={college}
            onValueChange={(value) => {
              setCollege(value);
              setDepartment(ALL_OPTION);
            }}
          >
            <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
              <SelectValue placeholder="College" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                All Colleges
              </SelectItem>

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

          {/* Department */}

          <Select
            value={department}
            onValueChange={setDepartment}
          >
            <SelectTrigger
              className={`h-9 text-xs sm:h-10 sm:text-sm ${
                college === ALL_OPTION
                  ? "opacity-60"
                  : ""
              }`}
            >
              <span>
                {department === ALL_OPTION
                  ? "All Departments"
                  : department}
              </span>
            </SelectTrigger>

            <SelectContent>
              {college === ALL_OPTION ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Select College first
                </div>
              ) : (
                <>
                  <SelectItem value={ALL_OPTION}>
                    All Departments
                  </SelectItem>

                  {departments.map((dept) => (
                    <SelectItem
                      key={dept}
                      value={dept}
                    >
                      {dept}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>

          {/* Level */}

          <Select
            value={level}
            onValueChange={setLevel}
          >
            <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
              <SelectValue placeholder="Level" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                All Levels
              </SelectItem>

              {levels.map((item) => (
                <SelectItem
                  key={item}
                  value={item}
                >
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Semester */}

          <Select
            value={semester}
            onValueChange={setSemester}
          >
            <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
              <SelectValue placeholder="Semester" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                All Semesters
              </SelectItem>

              {semesters.map((item) => (
                <SelectItem
                  key={item}
                  value={item}
                >
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category */}

          <Select
            value={category}
            onValueChange={setCategory}
          >
            <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
              <SelectValue placeholder="Category" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                All Categories
              </SelectItem>

              {cats?.map((c) => (
                <SelectItem
                  key={c.id}
                  value={c.id}
                >
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}

          <Select
            value={sort}
            onValueChange={(v) =>
              setSort(v as typeof sort)
            }
          >
            <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="newest">
                Newest first
              </SelectItem>

              <SelectItem value="downloads">
                Most downloaded
              </SelectItem>

              <SelectItem value="bookmarks">
                Most bookmarked
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map(
            (_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-border bg-card sm:h-48"
              />
            ),
          )}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {data.map((r) => (
            <ResourceCard
              key={r.id}
              r={r as unknown as ResourceRow}
              canDownload={canDownload}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState
            title="No resources found"
            desc="Try a different search or clear the filters."
          />
        </div>
      )}
    </div>
  );
}

export type ResourceRow = {
  id: string;
  title: string;
  description: string | null;
  course_code: string | null;
  college: string | null;
  department: string | null;
  level: string | null;
  semester: string | null;
  year: number | null;
  tags: string[];
  category_id: string | null;
  download_count: number;
  bookmark_count: number;
  created_at: string;
  file_type: string | null;
  category_name: string | null;
  category_slug: string | null;
};

export function ResourceCard({
  r,
  canDownload,
}: {
  r: ResourceRow;
  canDownload: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [previewing, setPreviewing] =
    useState(false);

  const collegeShort =
    r.college?.match(/\((.*?)\)/)?.[1] ??
    r.college;

  const { data: bookmarked } = useQuery({
    queryKey: ["bookmarked", r.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("resource_id", r.id)
        .eq("user_id", user!.id)
        .maybeSingle();

      return !!data;
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Sign in required");
      }

      if (bookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("resource_id", r.id)
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({
            resource_id: r.id,
            user_id: user.id,
          });

        if (error) {
          throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["bookmarked", r.id],
      });

      qc.invalidateQueries({
        queryKey: ["library"],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update bookmark.",
      );
    },
  });

  const categoryName =
    r.category_name?.trim() ||
    "Uncategorized";

  return (
    <article className="group flex flex-col rounded-2xl border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant sm:p-5">
      <div className="mb-2.5 flex items-center justify-between gap-2 sm:mb-3">
        <span className="min-w-0 flex-1 truncate rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary sm:px-2.5 sm:text-xs">
          {categoryName}
        </span>

        <div className="shrink-0">
          <ResourceTypeBadge
            filePath={
              r.file_type
                ? `.${r.file_type}`
                : ""
            }
          />
        </div>
      </div>

      <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug sm:text-lg">
        {r.title}
      </h3>

      {r.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground sm:mt-2 sm:text-sm">
          {r.description}
        </p>
      )}

      <div className="mt-2.5 space-y-1.5 text-xs sm:mt-3 sm:space-y-2 sm:text-sm">
        {r.course_code && (
          <div className="font-medium text-primary">
            📘 {r.course_code}
          </div>
        )}

        {r.college && (
          <div className="text-muted-foreground">
            🏛️ {collegeShort}
          </div>
        )}

        {r.department && (
          <div className="text-muted-foreground">
            🏢 {r.department}
          </div>
        )}

        {r.level && (
          <div>
            🎓 {r.level}
          </div>
        )}

        {r.semester && (
          <div>
            📅 {r.semester}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between pt-4 text-[10px] text-muted-foreground sm:pt-5 sm:text-xs">
        <span>
          {new Date(
            r.created_at,
          ).toLocaleDateString()}
        </span>

        <span className="inline-flex items-center gap-2.5 sm:gap-3">
          <span className="inline-flex items-center gap-1">
            <Download className="h-3 w-3" />
            {r.download_count}
          </span>

          <span className="inline-flex items-center gap-1">
            <Bookmark className="h-3 w-3" />
            {r.bookmark_count}
          </span>
        </span>
      </div>

      <div className="mt-3 flex gap-1.5 sm:mt-4 sm:gap-2">
        <div className="flex min-w-0 flex-1">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 w-full text-xs sm:h-9 sm:text-sm"
            disabled={previewing}
          >
            <Link
              to="/preview/$resourceId"
              params={{
                resourceId: r.id,
              }}
              onClick={() =>
                setPreviewing(true)
              }
              className="flex items-center justify-center"
            >
              {previewing ? (
                <>
                  <Loader2 className="hidden h-3.5 w-3.5 animate-spin max-[320px]:block" />

                  <span className="block max-[320px]:hidden">
                    Previewing...
                  </span>
                </>
              ) : (
                <>
                  <Eye className="hidden h-3.5 w-3.5 max-[320px]:block" />

                  <span className="block max-[320px]:hidden">
                    Preview
                  </span>
                </>
              )}
            </Link>
          </Button>
        </div>

        <Button
          className="h-8 shrink-0 px-2 sm:h-9"
          variant="outline"
          size="sm"
          onClick={() =>
            toggleBookmark.mutate()
          }
          disabled={toggleBookmark.isPending}
          aria-label="Bookmark"
        >
          <Bookmark
            className={`h-3.5 w-3.5 ${
              bookmarked
                ? "text-yellow-500"
                : "text-muted-foreground"
            }`}
            fill={
              bookmarked
                ? "currentColor"
                : "none"
            }
          />
        </Button>
      </div>
    </article>
  );
}