import {
  createFileRoute,
  useParams,
} from "@tanstack/react-router";
import { UploadPage } from "./upload";

export const Route = createFileRoute(
  "/_authenticated/upload/$draftId",
)({
  head: () => ({
    meta: [
      {
        title: "Edit Draft | Aneks Library",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
  component: EditDraftPage,
});

function EditDraftPage() {
  const { draftId } = useParams({
    from: "/_authenticated/upload/$draftId",
  });

  return <UploadPage draftId={draftId} />;
}