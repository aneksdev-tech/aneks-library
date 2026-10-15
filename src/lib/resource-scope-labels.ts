type ResourceScopeField = "college" | "department" | "level" | "semester";

const ALL_SCOPE_LABELS: Record<ResourceScopeField, string> = {
  college: "All Colleges",
  department: "All Departments",
  level: "All Levels",
  semester: "Both Semesters",
};

export function getResourceScopeLabel(
  value: string | null | undefined,
  field: ResourceScopeField,
): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue.toLowerCase() === "all") {
    return ALL_SCOPE_LABELS[field];
  }

  return normalizedValue;
}