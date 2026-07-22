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

const execFileAsync = promisify(execFile);

const SOFFICE =
  "C:\\Program Files\\LibreOffice\\program\\soffice.com";

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

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const WATERMARK_PATH = path.join(
  __dirname,
  "aneks-watermark.png",
);

async function processPdf(
  pdfBytes,
  email,
) {
  const pdfDoc =
    await PDFDocument.load(pdfBytes);

  const pages =
    pdfDoc.getPages();

  const font =
    await pdfDoc.embedFont(
      StandardFonts.Helvetica,
    );

  const now = new Date();

  const date =
    now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const time =
    now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const watermarkText =
`Aneks Library

Downloaded by:
${email}

${date}
${time}`;

  for (const page of pages) {

    const { width, height } =
      page.getSize();

    page.drawText(
      watermarkText,
      {
        x: width * 0.22,
        y: height * 0.35,

        size: 28,

        font,

        color: rgb(
          0.72,
          0.72,
          0.72,
        ),

        opacity: 0.08,

        rotate: degrees(-45),
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

    const watermarkBuffer =
      await fs.readFile(WATERMARK_PATH);

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

    // -----------------------------------------
    // Responsive watermark size
    // -----------------------------------------

    const watermarkWidth = Math.round(
      width * 0.25,
    );

    const watermark =
      await sharp(watermarkBuffer)
        .resize({
          width: watermarkWidth,
        })
        .png()
        .toBuffer();

    const composites = [];

    // -----------------------------------------
    // JPG / JPEG
    // Multiple tiled watermark
    // -----------------------------------------

    if (
      format === "jpeg" ||
      format === "jpg"
    ) {

      const spacing =
        watermarkWidth * 2.8;

      for (
        let y = -watermarkWidth;
        y < height + watermarkWidth;
        y += spacing
      ) {

        const offset =
          Math.floor(y / spacing) % 2 === 0
            ? 0
            : spacing / 2;

        for (
          let x = -watermarkWidth + offset;
          x < width + watermarkWidth;
          x += spacing
        ) {

          composites.push({
            input: watermark,
            left: Math.round(x),
            top: Math.round(y),
          });

        }

      }

    }

    // -----------------------------------------
    // PNG / WEBP
    // Single centered watermark
    // -----------------------------------------

    else {

      const meta =
        await sharp(watermark)
          .metadata();

      const wmWidth =
        meta.width ?? watermarkWidth;

      const wmHeight =
        meta.height ?? watermarkWidth;

      composites.push({

        input: watermark,

        left: Math.round(
          (width - wmWidth) / 2,
        ),

        top: Math.round(
          (height - wmHeight) / 2,
        ),

      });

    }

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
      pdf,
      email,
    } = req.body;

    if (!pdf) {
      return res.status(400).json({
        error: "Missing PDF.",
      });
    }

    if (!email) {
      return res.status(400).json({
        error: "Missing email.",
      });
    }

    const pdfBytes = Buffer.from(
      pdf,
      "base64",
    );

    console.log(
      "Received PDF:",
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
      docx,
      email,
    } = req.body;

    if (!docx) {
      return res.status(400).json({
        error: "Missing DOCX.",
      });
    }

    if (!email) {
      return res.status(400).json({
        error: "Missing email.",
      });
    }

    const docxBytes =
      Buffer.from(
        docx,
        "base64",
      );

    console.log(
      "Received DOCX:",
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

const PORT = 3001;

app.listen(PORT, () => {
  console.log(
    `Watermark server running on port ${PORT}`,
  );
});