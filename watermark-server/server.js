import express from "express";
import cors from "cors";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb, degrees, } from "pdf-lib";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { v4 as uuid } from "uuid";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { WATERMARK, createWatermarkSvg, } from "./watermarkTemplate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

dotenv.config({
  path: "../.env",
  override: false,
});

const execFileAsync = promisify(execFile);

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL is missing");
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SOFFICE =
  process.platform === "win32"
    ? "C:\\Program Files\\LibreOffice\\program\\soffice.com"
    : "soffice";

const app = express();

app.use(cors());

app.use(
  express.json({
    limit: "20mb",
  }),
);

// -------------------------------------------------
// DOCX → PDF Converter
// -------------------------------------------------

async function processDocx(
  docxBuffer,
) {
  const id = uuid();

  const tempDir =
    os.tmpdir();

  const inputPath =
    path.join(
      tempDir,
      `${id}.docx`,
    );

  const outputDir =
    path.join(
      tempDir,
      id,
    );

  await fs.mkdir(outputDir, {
    recursive: true,
  });

  await fs.writeFile(
    inputPath,
    docxBuffer,
  );

  const stat = await fs.stat(inputPath);

console.log(
  "DOCX written:",
  inputPath,
  stat.size,
  "bytes",
);

  const result = await execFileAsync(
  SOFFICE,
  [
    "--headless",
    "--convert-to",
    "pdf",
    "--outdir",
    outputDir,
    inputPath,
  ],
);

console.log("LibreOffice stdout:");
console.log(result.stdout);

console.log("LibreOffice stderr:");
console.log(result.stderr);

  const files =
  await fs.readdir(outputDir);

console.log("Output directory:", files);

const pdfFile =
  files.find((f) =>
    f.toLowerCase().endsWith(".pdf")
  );

if (!pdfFile) {
  throw new Error(
    "LibreOffice did not generate a PDF."
  );
}

const pdfPath =
  path.join(outputDir, pdfFile);

const pdfBytes =
  await fs.readFile(pdfPath);


  await fs.rm(inputPath, {
    force: true,
  });

  await fs.rm(outputDir, {
    recursive: true,
    force: true,
  });

  return pdfBytes;
}

async function processPdf(
  pdfBytes,
  email,
) {
  const pdfDoc =
    await PDFDocument.load(pdfBytes);

  const pages =
    pdfDoc.getPages();

  for (const page of pages) {

    const { width, height } =
      page.getSize();

    // Calculate desired width (same idea as images)
    const watermarkWidth =
      Math.round(
        Math.min(width, height) * 1.50,
      );

    // Prepare watermark with Sharp
    const watermarkBuffer =
      await sharp(
        path.join(
          __dirname,
          "aneks-watermark.png",
        ),
      )
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

    const rotatedMeta =
  await sharp(
    watermarkBuffer,
  ).metadata();

const wmWidth =
  rotatedMeta.width ?? 0;

const wmHeight =
  rotatedMeta.height ?? 0;

const watermarkImage =
  await pdfDoc.embedPng(
    watermarkBuffer,
  );

    page.drawImage(
  watermarkImage,
  {
    x: (width - wmWidth) / 2,

    y: (height - wmHeight) / 2,

    width: wmWidth,

    height: wmHeight,

    opacity: WATERMARK.opacity,
  },
);
}

  return Buffer.from(
    await pdfDoc.save(),
  );
}

app.get("/", (req, res) => {
  res.json({
    service: "Aneks Library Watermark Server",
    status: "Running",
  });
});

app.post("/watermark", async (req, res) => {
  console.log("===== VERSION 2 =====");
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        error: "Missing image.",
      });
    }

    const imageBuffer = Buffer.from(
      image,
      "base64",
    );

    console.log(
      "Received image:",
      imageBuffer.length,
      "bytes",
    );

      const original =
      sharp(imageBuffer);

    const metadata =
      await original.metadata();

    const format =
      metadata.format ?? "jpeg";

    const width =
      metadata.width ?? 0;

    const height =
      metadata.height ?? 0;

    if (!width || !height) {
      return res.status(400).json({
        error:
          "Unable to determine image size.",
      });
    }

  const watermarkSvg =
  createWatermarkSvg(
    width,
    height,
  );

const watermarkBuffer =
  Buffer.from(watermarkSvg);

const watermark =
  await sharp(watermarkBuffer)
    .png()
    .toBuffer();

const meta =
  await sharp(watermark).metadata();

const wmWidth =
  meta.width ?? width;

const wmHeight =
  meta.height ?? height;

const composites = [
  {
    input: watermark,
    left: Math.round(
      (width - wmWidth) / 2,
    ),
    top: Math.round(
      (height - wmHeight) / 2,
    ),
  },
];

    // -----------------------------------------
    // Apply watermark
    // -----------------------------------------

    const processed =
      original.composite(composites);

    let output;

    switch (format) {

      case "png":

        output =
          await processed
            .png()
            .toBuffer();

        break;

      case "webp":

        output =
          await processed
            .webp({
              quality: 100,
            })
            .toBuffer();

        break;

      default:

        output =
          await processed
            .jpeg({
              quality: 100,
            })
            .toBuffer();

    }

    // -----------------------------------------
    // Return image
    // -----------------------------------------

    let contentType =
      "image/jpeg";

    if (format === "png") {
      contentType = "image/png";
    }

    if (format === "webp") {
      contentType = "image/webp";
    }

    res.setHeader(
      "Content-Type",
      contentType,
    );

    return res.send(output);

  } catch (err) {

  console.error(
  "DOCX conversion failed:",
  typeof err === "object" &&
  err !== null &&
  "stderr" in err
    ? String(err.stderr).trim()
    : err instanceof Error
      ? err.message
      : String(err),
);

  const stderr =
    err &&
    typeof err === "object" &&
    "stderr" in err
      ? String(err.stderr)
      : "";

  // Bad or unsupported DOCX
  if (
    stderr.includes("source file could not be loaded")
  ) {
    return res.status(400).json({
      error:
        "This DOCX file appears to be damaged or uses an unsupported document structure. Please upload a valid Microsoft Word (.docx) document.",
    });
  }

  if (
    message.includes(
      "LibreOffice did not generate a PDF"
    )
  ) {
    return res.status(400).json({
      error:
        "This DOCX document could not be converted to PDF.",
    });
  }

  return res.status(500).json({
    error:
      "Unable to process this DOCX document.",
  });

}

});

app.post("/watermark-pdf", async (req, res) => {
  try {

    const {
      filePath,
      email,
    } = req.body;

    if (!filePath) {
      return res.status(400).json({
        error: "Missing filePath.",
      });
    }

    if (!email) {
      return res.status(400).json({
        error: "Missing email.",
      });
    }

    const {
      data: pdfBlob,
      error: downloadError,
    } = await supabase.storage
      .from("resources")
      .download(filePath);

    if (downloadError || !pdfBlob) {

      console.error(downloadError);

      return res.status(404).json({
        error: "Unable to download PDF from Storage.",
      });

    }

    const pdfBytes =
      Buffer.from(
        await pdfBlob.arrayBuffer(),
      );

    console.log(
      "Downloaded PDF:",
      pdfBytes.length,
      "bytes",
    );


    const output =
      await processPdf(
        pdfBytes,
        email,
      );

    res.setHeader(
      "Content-Type",
      "application/pdf",
    );

    return res.send(output);

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : String(err),
    });

  }
});

app.post("/watermark-docx", async (req, res) => {

  try {

    const {
  filePath,
  email,
} = req.body;

    if (!filePath) {
      return res.status(400).json({
      error: "Missing filePath.",
    });
    }

    if (!email) {
      return res.status(400).json({
        error: "Missing email.",
      });
    }

    const {
  data: docxBlob,
  error: downloadError,
} = await supabase.storage
  .from("resources")
  .download(filePath);

if (downloadError || !docxBlob) {

  console.error(downloadError);

  return res.status(404).json({
    error: "Unable to download DOCX from Storage.",
  });

}

const docxBytes = Buffer.from(
  await docxBlob.arrayBuffer(),
);

console.log(
  "Downloaded DOCX:",
  docxBytes.length,
  "bytes",
);

    const pdfBytes =
      await processDocx(
        docxBytes,
      );

    console.log(
      "DOCX converted to PDF.",
    );

    const output =
      await processPdf(
        pdfBytes,
        email,
      );

    console.log(
      "DOCX watermark applied.",
    );

    res.setHeader(
      "Content-Type",
      "application/pdf",
    );

    return res.send(output);

  } catch (err) {

    console.error(err);

    const stderr =
      typeof err === "object" &&
      err !== null &&
      "stderr" in err
        ? String(err.stderr).toLowerCase()
        : "";

    const message =
      err instanceof Error
        ? err.message.toLowerCase()
        : String(err).toLowerCase();

    if (
  stderr.includes("source file could not be loaded") ||
  stderr.includes("could not find platform independent libraries") ||
  message.includes("source file could not be loaded")
) {
  return res.status(400).json({
    error:
      "This DOCX file appears to be damaged or uses an unsupported document structure. Please upload a valid Microsoft Word (.docx) document.",
  });
}

    return res.status(500).json({
      error:
        "Unable to process this DOCX document at this time.",
    });

  }

});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(
    `Watermark server running on port ${PORT}`,
  );
});