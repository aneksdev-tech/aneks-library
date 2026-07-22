import { getResourceType } from "@/lib/resourceType";

type Props = {
  filePath: string;
};

export function ResourceTypeBadge({
  filePath,
}: Props) {
  const type =
    getResourceType(filePath);

  const Icon =
    type.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${type.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {type.label}
    </span>
  );
}