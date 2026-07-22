import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Archive,
  File,
} from "lucide-react";

export function getResourceType(filePath: string) {
  const ext =
    filePath
      .split(".")
      .pop()
      ?.toLowerCase() ?? "";

  switch (ext) {
    case "pdf":
      return {
        label: "PDF",
        icon: FileText,
        className:
          "bg-red-100 text-red-700 border-red-200",
      };

    case "doc":
    case "docx":
      return {
        label: "Word",
        icon: FileText,
        className:
          "bg-blue-100 text-blue-700 border-blue-200",
      };

    case "ppt":
    case "pptx":
      return {
        label: "Slides",
        icon: Presentation,
        className:
          "bg-orange-100 text-orange-700 border-orange-200",
      };

    case "xls":
    case "xlsx":
      return {
        label: "Spreadsheet",
        icon: FileSpreadsheet,
        className:
          "bg-green-100 text-green-700 border-green-200",
      };

    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
      return {
        label: "Image",
        icon: ImageIcon,
        className:
          "bg-purple-100 text-purple-700 border-purple-200",
      };

    case "zip":
    case "rar":
    case "7z":
      return {
        label: "Archive",
        icon: Archive,
        className:
          "bg-gray-100 text-gray-700 border-gray-200",
      };

    default:
      return {
        label: "File",
        icon: File,
        className:
          "bg-muted text-muted-foreground border-border",
      };
  }
}