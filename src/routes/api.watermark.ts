import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import path from "node:path";

const BUCKET = "resources";
const OUTPUT_BUCKET = "watermarked-temp";

const WATERMARK = {
  text: "ANEKS LIBRARY",
  rotation: 55,
  opacity: 0.05,
  horizontalOffset: 60,
  verticalOffset: -110,
  imageTitleScale: 0.07,
  letterSpacing: 0.3,
  color: { r: 0, g: 0, b: 0 },
};

type WatermarkType = "image" | "pdf";

type WatermarkAssets = {
  watermarkPng: Buffer;
};

let assetsPromise: Promise<WatermarkAssets> | undefined;

async function loadAssets(request: Request): Promise<WatermarkAssets> {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      const assetUrl = (filename: string) =>
        new URL(`/watermark-assets/${filename}`, request.url);

      const pngResponse = await fetch(
        assetUrl("aneks-watermark.png"),
      );

      if (!pngResponse.ok) {
        throw new Error("Unable to load watermark assets.");
      }

      return {
        watermarkPng: Buffer.from(
          await pngResponse.arrayBuffer(),
        ),
      };
    })().catch((error) => {
      assetsPromise = undefined;
      throw error;
    });
  }

  return assetsPromise;
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isSafeResourcePath(filePath: unknown): filePath is string {
  if (
    typeof filePath !== "string" ||
    filePath.length === 0 ||
    filePath.length > 1024 ||
    filePath.startsWith("/") ||
    filePath.includes("\\") ||
    filePath.includes("\0") ||
    filePath.includes("://")
  ) {
    return false;
  }

  const segments = filePath.split("/");

  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== "." &&
      segment !== "..",
  );
}

function getImageContentType(format: string): string | null {
  switch (format) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return null;
  }
}

function createWatermarkSvg(
  width: number,
  height: number,
): string {
  const fontSize =
    Math.min(width, height) * WATERMARK.imageTitleScale;

  return `
<svg xmlns="http://www.w3.org/2000/svg"
     width="${width}" height="${height}">
  <g transform="
    translate(
      ${width / 2 + WATERMARK.horizontalOffset}
      ${height / 2 + WATERMARK.verticalOffset}
    )
    rotate(${-WATERMARK.rotation})
  ">
    <text
      x="0"
      y="0"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="sans-serif"
      font-size="${fontSize}"
      letter-spacing="${WATERMARK.letterSpacing}"
      fill="rgba(
        ${WATERMARK.color.r},
        ${WATERMARK.color.g},
        ${WATERMARK.color.b},
        ${WATERMARK.opacity}
      )"
    >${WATERMARK.text}</text>
  </g>
</svg>`;
}

async function watermarkImage(
  originalBytes: Buffer,
  assets: WatermarkAssets,
): Promise<{ bytes: Buffer; contentType: string }> {
  const original = sharp(originalBytes);
  const metadata = await original.metadata();

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const contentType = getImageContentType(metadata.format ?? "");

  if (!width || !height || !contentType) {
    throw new Error("Unsupported or invalid image.");
  }

 const svg = createWatermarkSvg(width, height);

  const watermark = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

const watermarkMetadata = await sharp(watermark).metadata();

  const composites = [
    {
      input: watermark,
      left: Math.round(
        (width - (watermarkMetadata.width ?? width)) / 2,
      ),
      top: Math.round(
        (height - (watermarkMetadata.height ?? height)) / 2,
      ),
    },
  ];

  const processed = original.composite(composites);

  let bytes: Buffer;

  switch (metadata.format) {
    case "png":
      bytes = await processed.png().toBuffer();
      break;

    case "webp":
      bytes = await processed
        .webp({ quality: 100 })
        .toBuffer();
      break;

    default:
      bytes = await processed
        .jpeg({ quality: 100 })
        .toBuffer();
  }

  return { bytes, contentType };
}

async function watermarkPdf(
  originalBytes: Buffer,
  watermarkPng: Buffer,
): Promise<Buffer> {
  const pdf = await PDFDocument.load(originalBytes);
  const pages = pdf.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    const watermarkWidth = Math.round(
      Math.min(width, height) * 1.5,
    );

    const rotatedWatermark = await sharp(watermarkPng)
      .resize({
        width: watermarkWidth,
        withoutEnlargement: true,
      })
      .rotate(-WATERMARK.rotation, {
        background: {
          r: 0,
          g: 0,
          b: 0,
          alpha: 0,
        },
      })
      .png()
      .toBuffer();

    const watermarkMetadata = await sharp(
      rotatedWatermark,
    ).metadata();

    const watermarkImage = await pdf.embedPng(
      rotatedWatermark,
    );

    const imageWidth = watermarkMetadata.width ?? 0;
    const imageHeight = watermarkMetadata.height ?? 0;

    page.drawImage(watermarkImage, {
      x: (width - imageWidth) / 2,
      y: (height - imageHeight) / 2,
      width: imageWidth,
      height: imageHeight,
      opacity: WATERMARK.opacity,
    });
  }

  return Buffer.from(await pdf.save());
}

async function handleWatermark(
  request: Request,
): Promise<Response> {
  const expectedSecret = process.env.WATERMARK_SERVER_SECRET;
  const suppliedSecret = request.headers.get("X-Watermark-Secret");

  if (
    !expectedSecret ||
    !suppliedSecret ||
    suppliedSecret !== expectedSecret
  ) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Watermark server environment is incomplete.");

    return jsonResponse(
      { error: "Watermark service is not configured." },
      500,
    );
  }

  let body: {
    filePath?: unknown;
    type?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request." }, 400);
  }

  const { filePath, type } = body;

  if (!isSafeResourcePath(filePath)) {
    return jsonResponse({ error: "Invalid resource path." }, 400);
  }

  if (type !== "image" && type !== "pdf") {
    return jsonResponse(
      { error: "Type must be image or pdf." },
      400,
    );
  }

  const extension = path.extname(filePath).toLowerCase();

  const supportedImage = [".jpg", ".jpeg", ".png", ".webp"].includes(
    extension,
  );

  if (
    (type === "image" && !supportedImage) ||
    (type === "pdf" && extension !== ".pdf")
  ) {
    return jsonResponse(
      { error: "File type does not match the requested operation." },
      400,
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  try {
    const { data: originalBlob, error: downloadError } =
      await supabase.storage
        .from(BUCKET)
        .download(filePath);

    if (downloadError || !originalBlob) {
      console.error(
        "Watermark original download failed:",
        downloadError?.message,
      );

      return jsonResponse(
        { error: "Unable to retrieve the original resource." },
        404,
      );
    }

    const originalBytes = Buffer.from(
      await originalBlob.arrayBuffer(),
    );

    const assets = await loadAssets(request);

    let outputBytes: Buffer;
    let contentType: string;

    if (type === "image") {
      const result = await watermarkImage(
        originalBytes,
        assets,
      );

      outputBytes = result.bytes;
      contentType = result.contentType;
    } else {
      outputBytes = await watermarkPdf(
        originalBytes,
        assets.watermarkPng,
      );

      contentType = "application/pdf";
    }

    const requestId = crypto.randomUUID();
    const timestamp = Date.now();

    const originalName = path.posix
      .basename(filePath)
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    const outputName = `${timestamp}-${originalName}`;
    const outputPath = `${requestId}/${outputName}`;

    const { error: uploadError } = await supabase.storage
      .from(OUTPUT_BUCKET)
      .upload(outputPath, outputBytes, {
        contentType,
        upsert: false,
        cacheControl: "0",
      });

    if (uploadError) {
      console.error(
        "Watermarked file upload failed:",
        uploadError.message,
      );

      return jsonResponse(
        { error: "Unable to store the processed resource." },
        500,
      );
    }

    return jsonResponse({
      success: true,
      bucket: OUTPUT_BUCKET,
      path: outputPath,
      contentType,
      filename: outputName,
      size: outputBytes.length,
    });
  } catch (error) {
    console.error(
      "Watermark processing failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return jsonResponse(
      { error: "Unable to process this resource." },
      500,
    );
  }
}

export const Route = createFileRoute("/api/watermark")({
  server: {
    handlers: {
      POST: ({ request }) => handleWatermark(request),
    },
  },
});