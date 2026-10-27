// lib/file-type.js
//
// Build order step 5: real file type from magic bytes, never the extension.
// Only JPG, PNG, PDF are allowed (REQUIREMENTS.md Security Must).

function sniffFileType(bytes) {
  if (!bytes || bytes.length < 4) return null;
  const b = bytes;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" };
  }
  // PDF: 25 50 44 46 ("%PDF")
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return { ext: "pdf", mime: "application/pdf" };
  }
  return null;
}

module.exports = { sniffFileType };
