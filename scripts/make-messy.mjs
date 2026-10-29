// scripts/make-messy.mjs
//
// Step 8 (Act 1): dev-only messy-variant maker for the eval.
// Reads clean PNGs from samples/, writes deterministic variants to
// samples/messy/<base>--<variant>.png (.jpg for the jpeg variant).
// Pure-JS jimp only (no native binary). Never touches the app.
// Skips inputs that do not exist yet (render clean PNGs first).
//
// Usage:
//   node scripts/make-messy.mjs
//
// Variants (one defect each, honest reporting):
//   rot8      rotate 8 degrees
//   blur      slight blur (r=4)
//   shadow    dark gradient over the right side (scan, version-agnostic)
//   lowlight  brightness factor 0.55 (multiply, this jimp version)
//   jpeg      JPEG re-encode at quality 30 (noise)
//   cutoff    crop 12% off the right edge

import { mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Jimp } from "jimp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outDir = path.join(root, "samples", "messy");

// Batch: 9 messy files (2 birth cert, 2 valid ID, 2 report card,
// 2 receipt, 1 billing). Covers all 6 defect types at least once.
const BATCH = [
  { src: "samples/birth-certificate-clean.png", variant: "rot8" },
  { src: "samples/birth-certificate-clean.png", variant: "lowlight" },
  { src: "samples/valid-id-clean.png", variant: "blur" },
  { src: "samples/valid-id-clean.png", variant: "shadow" },
  { src: "samples/report-card-clean.png", variant: "jpeg" },
  { src: "samples/report-card-clean-2.png", variant: "cutoff" },
  { src: "samples/official-receipt-clean.png", variant: "rot8" },
  { src: "samples/official-receipt-clean.png", variant: "cutoff" },
  { src: "samples/proof-of-billing.png", variant: "shadow" },
];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function saveImage(img, outPath) {
  if (typeof img.writeAsync === "function") {
    await img.writeAsync(outPath);
  } else {
    await img.write(outPath);
  }
}

// Version-agnostic wrappers: installed jimp v1 uses positional numbers
// for blur/brightness, objects for rotate/crop.
async function opRotate(img, deg) {
  img.rotate({ deg });
}

async function opBlur(img, r) {
  img.blur(r);
}

async function opBrightness(img, val) {
  img.brightness(val);
}

async function opCrop(img, x, y, w, h) {
  img.crop({ x, y, w, h });
}

async function opQuality(img, q) {
  if (typeof img.quality === "function") img.quality(q);
}

function applyShadow(img) {
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  img.scan(0, 0, w, h, function (x, y, idx) {
    if (x > w * 0.45) {
      const t = (x - w * 0.45) / (w * 0.55); // 0 at middle, 1 at right edge
      const factor = 1 - t * 0.55; // darken up to 55%
      this.bitmap.data[idx] = Math.round(this.bitmap.data[idx] * factor);
      this.bitmap.data[idx + 1] = Math.round(this.bitmap.data[idx + 1] * factor);
      this.bitmap.data[idx + 2] = Math.round(this.bitmap.data[idx + 2] * factor);
    }
  });
}

async function makeOne(srcRel, variant) {
  const srcPath = path.join(root, srcRel);
  if (!(await exists(srcPath))) {
    console.log(`skip (missing input, render it first): ${srcRel}`);
    return false;
  }
  const base = path.basename(srcRel, path.extname(srcRel));
  const ext = variant === "jpeg" ? ".jpg" : ".png";
  const outPath = path.join(outDir, `${base}--${variant}${ext}`);
  const img = await Jimp.read(srcPath);
  if (variant === "rot8") {
    await opRotate(img, 8);
  } else if (variant === "blur") {
    await opBlur(img, 4);
  } else if (variant === "shadow") {
    applyShadow(img);
  } else if (variant === "lowlight") {
    await opBrightness(img, 0.55);
  } else if (variant === "jpeg") {
    await opBlur(img, 1);
    await opQuality(img, 30);
  } else if (variant === "cutoff") {
    const w = img.bitmap.width;
    const h = img.bitmap.height;
    const w2 = Math.max(1, Math.floor(w * 0.88));
    await opCrop(img, 0, 0, w2, h);
  } else {
    throw new Error(`unknown variant "${variant}".`);
  }
  await saveImage(img, outPath);
  console.log(`ok: ${path.relative(root, outPath)}`);
  return true;
}

await mkdir(outDir, { recursive: true });
let ok = 0;
let skipped = 0;
for (const job of BATCH) {
  const done = await makeOne(job.src, job.variant);
  if (done) ok += 1;
  else skipped += 1;
}
console.log(`\ndone: ${ok} written, ${skipped} skipped (render missing clean PNGs first).`);
