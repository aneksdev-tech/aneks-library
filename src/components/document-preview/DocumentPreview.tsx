import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { PDFViewer } from "./PDFViewer";
import { ImageViewer } from "./ImageViewer";
import { DocxViewer } from "./DocxViewer";

interface DocumentPreviewProps {
  url: string;
  token: string;
  filePath: string;
  title?: string;
}

export function DocumentPreview({
  url,
  token,
  filePath,
  title,
}: DocumentPreviewProps) {
  const [blob, setBlob] = useState<Blob>();
  const [blobUrl, setBlobUrl] = useState<string>();

  useEffect(() => {
    let objectUrl: string | undefined;

    async function loadPreview() {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!response.ok) {
        throw new Error("Unable to load preview.");
      }

      const previewBlob = await response.blob();

      objectUrl = URL.createObjectURL(previewBlob);

      setBlob(previewBlob);
      setBlobUrl(objectUrl);
    }

    loadPreview().catch(console.error);

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url, token]);

  const disableContextMenu = (
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    e.preventDefault();
  };

  const ext = filePath.split(".").pop()?.toLowerCase();

  const today = new Date().toLocaleDateString();

  if (!blob || !blobUrl) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        Preparing preview...
      </div>
    );
  }

  return (
    <div
      onContextMenu={disableContextMenu}
      className="relative select-none"
    >

      {ext === "pdf" ? (
        <PDFViewer url={blobUrl} />
      ) : ext === "docx" ? (
        <DocxViewer blob={blob} />
      ) : ["jpg", "jpeg", "png", "gif", "webp"].includes(ext ?? "") ? (
        <ImageViewer
          url={blobUrl}
          alt={title}
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-12 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>

          <h3 className="mt-4 text-lg font-semibold">
            Preview not available
          </h3>

          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            This file type is not yet supported for in-browser preview.
            Downloading requires a Premium subscription.
          </p>
        </div>
      )}
    </div>
  );
}