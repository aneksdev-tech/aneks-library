import { createFileRoute } from "@tanstack/react-router";
import { UploadPage } from "./upload";

export const Route = createFileRoute(
  "/_authenticated/upload/",
)({
  head: () => ({
    meta: [
      {
        title: "Upload | Aneks Library",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
  component: NewUploadPage,
});

function NewUploadPage() {
  return <UploadPage />;
}