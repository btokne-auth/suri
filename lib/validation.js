// lib/validation.js
//
// Build order step 3: settings + rules.
// Zod schemas built from document settings. Code validates model output.
// A value that breaks a rule is never fixed or dropped: it stays in `fields`
// and becomes an entry in `issues` ("looks wrong").
//
// validateExtraction(docTypeId, modelOutput) -> { ok, fields, issues }
// No name matching or cross-document comparison here (that's step 6).

const { z } = require("zod");
const { getDocumentType } = require("./documents");
const { normalizeAmount } = require("./normalize-amount.js");

// Letters incl. ñ/accents, spaces, hyphens, apostrophes, periods. No digits.
const NAME_RE = /^[\p{L} .'\-’]+$/u;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isRealCalendarDate(ymd) {
  if (!DATE_RE.test(ymd)) return false;
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

function isFutureDate(ymd) {
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  const dt = Date.UTC(y, mo - 1, d);
  const now = new Date();
  const todayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return dt > todayUTC;
}

// Envelope every field must have: { value, confidence, unreadable }.
const envelopeSchema = z.object({
  value: z.union([z.string(), z.number(), z.null()]),
  confidence: z.enum(["high", "medium", "low"]),
  unreadable: z.boolean(),
  found_on_page: z.string().optional(),
});

function friendlyDateLabel(key) {
  if (key === "date_of_birth") return "Birth date";
  if (key === "date_issued") return "Issue date";
  return key;
}

function friendlyNumberLabel(key) {
  if (key === "general_average") return "General average";
  if (key === "subtotal_amount") return "Subtotal";
  if (key === "vat_amount") return "VAT";
  if (key === "total_amount") return "Total";
  if (key === "item_1_amount") return "Item 1 amount";
  if (key === "item_2_amount") return "Item 2 amount";
  if (key === "item_3_amount") return "Item 3 amount";
  return key;
}

// Step 7b: peso normalization lives in lib/normalize-amount.js (browser-safe shared).

// Step 9A: quality + document_match (same single model call, strictly validated)
// Only validated enum values are ever stored in documents.quality_problems / looks_like.
const QUALITY_PROBLEMS = ["blurry", "dark", "glare", "cut_off", "angle"];
const QUALITY_REASONS = {
  blurry: "The photo is too blurry. Please retake it in better light.",
  dark: "The photo is too dark. Please retake it in better light.",
  glare: "There is glare on the photo. Please retake it without flash.",
  cut_off: "The document is cut off. Please retake it to show the full page.",
  angle: "The photo is taken at an angle. Please retake it straight on.",
};
const qualitySchema = z
  .object({
    usable: z.boolean(),
    problems: z
      .array(z.enum(QUALITY_PROBLEMS))
      .max(5)
      .refine((arr) => new Set(arr).size === arr.length, { message: "duplicate problems" }),
  })
  .strict();

function buildDocumentMatchSchema(allowedIds) {
  const base =
    Array.isArray(allowedIds) && allowedIds.length > 0
      ? allowedIds
      : ["birth_certificate", "valid_id", "report_card", "official_receipt"];
  const allowed = new Set([...base, "other"]);
  return z
    .object({
      matches_expected: z.boolean(),
      looks_like: z.string().refine((v) => allowed.has(v), {
        message: "looks_like must be one of: " + [...allowed].join(", ") + ".",
      }),
    })
    .strict();
}

// Build a Zod schema for one field's VALUE (null handled separately).
// Built from the settings file: type + limits per field.
function buildValueSchema(def) {
  const max = def.maxLength || 200;

  if (def.type === "name") {
    return z
      .string()
      .min(1, { message: def.key + " looks wrong: value is empty." })
      .max(def.maxLength || 100, {
        message: def.key + " looks wrong: too long.",
      })
      .refine((v) => v === v.trim(), {
        message: def.key + " looks wrong: extra spaces at the start or end.",
      })
      .refine((v) => !/\d/.test(v), {
        message: def.key + " looks wrong: names can't include digits.",
      })
      .refine((v) => NAME_RE.test(v.trim()), {
        message: def.key + " looks wrong: use letters, spaces, hyphens only.",
      });
  }

  if (def.type === "date") {
    return z
      .string()
      .refine((v) => DATE_RE.test(v), {
        message: def.key + " looks wrong: use YYYY-MM-DD.",
      })
      .refine((v) => isRealCalendarDate(v), {
        message: def.key + " looks wrong: not a real calendar date.",
      })
      .refine((v) => !isFutureDate(v), {
        message: friendlyDateLabel(def.key) + " can't be in the future.",
      });
  }

  if (def.type === "number") {
    const lo = typeof def.min === "number" ? def.min : null;
    const hi = typeof def.max === "number" ? def.max : null;
    const rangeMsg =
      lo !== null && hi !== null
        ? friendlyNumberLabel(def.key) + " must be between " + lo + " and " + hi + "."
        : def.key + " looks wrong: out of range.";
    let s = z.number({ error: def.key + " looks wrong: expected a number." });
    if (lo !== null) s = s.min(lo, { message: rangeMsg });
    if (hi !== null) s = s.max(hi, { message: rangeMsg });
    return s;
  }

  if (def.type === "choice") {
    const vals = def.values || [];
    return z.string().refine((v) => vals.includes(v), {
      message: def.key + " looks wrong: must be one of: " + vals.join(", ") + ".",
    });
  }

  if (def.type === "code") {
    let s = z
      .string()
      .min(1, { message: def.key + " looks wrong: value is empty." })
      .max(def.maxLength || 30, {
        message: def.key + " looks wrong: too long.",
      })
      .refine((v) => v === v.trim(), {
        message: def.key + " looks wrong: extra spaces at the start or end.",
      });
    if (def.pattern) {
      const re = new RegExp(def.pattern);
      s = s.refine((v) => re.test(v.trim()), {
        message: def.key + " looks wrong: unexpected format.",
      });
    }
    return s;
  }

  // text (default)
  return z
    .string()
    .min(1, { message: def.key + " looks wrong: value is empty." })
    .max(max, { message: def.key + " looks wrong: too long." })
    .refine((v) => v === v.trim(), {
      message: def.key + " looks wrong: extra spaces at the start or end.",
    });
}

function firstZodMessage(parseError, fallback) {
  const iss = parseError && parseError.issues && parseError.issues[0];
  if (iss && typeof iss.message === "string" && iss.message) return iss.message;
  return fallback;
}

function codeForIssue(def, zodError) {
  const iss = zodError && zodError.issues && zodError.issues[0];
  const zcode = iss && iss.code;
  if (zcode === "too_big") return "out_of_range";
  if (zcode === "too_small") return "too_small";
  if (zcode === "invalid_type") return "invalid_type";
  if (def.type === "number") return "out_of_range";
  return "looks_wrong";
}

function extractQualityAndMatch(modelOutput, allowedIds) {
  let quality = null;
  let documentMatch = null;
  const extraIssues = [];
  if (modelOutput && Object.prototype.hasOwnProperty.call(modelOutput, "quality")) {
    const rawQ = modelOutput.quality;
    if (rawQ === null || rawQ === undefined) {
      // missing treated as default below
    } else if (!isPlainObject(rawQ)) {
      extraIssues.push({
        field: "quality",
        code: "bad_quality",
        message: "quality has the wrong shape: expected { usable, problems }.",
      });
    } else {
      const qres = qualitySchema.safeParse(rawQ);
      if (!qres.success) {
        extraIssues.push({
          field: "quality",
          code: "bad_quality",
          message: firstZodMessage(qres.error, "quality looks wrong."),
        });
      } else {
        quality = qres.data;
      }
    }
  }
  if (modelOutput && Object.prototype.hasOwnProperty.call(modelOutput, "document_match")) {
    const rawM = modelOutput.document_match;
    if (rawM === null || rawM === undefined) {
    } else if (!isPlainObject(rawM)) {
      extraIssues.push({
        field: "document_match",
        code: "bad_document_match",
        message: "document_match has the wrong shape: expected { matches_expected, looks_like }.",
      });
    } else {
      const schema = buildDocumentMatchSchema(allowedIds);
      const mres = schema.safeParse(rawM);
      if (!mres.success) {
        extraIssues.push({
          field: "document_match",
          code: "bad_document_match",
          message: firstZodMessage(mres.error, "document_match looks wrong."),
        });
      } else {
        documentMatch = mres.data;
      }
    }
  }
  if (!quality && extraIssues.filter((i) => i.field === "quality").length === 0) {
    quality = { usable: true, problems: [] };
  }
  return { quality, documentMatch, extraIssues };
}

function validateExtraction(docTypeId, modelOutput, opts) {
  const docType = getDocumentType(docTypeId);
  if (!docType) {
    return {
      ok: false,
      fields: {},
      quality: { usable: true, problems: [] },
      documentMatch: null,
      issues: [
        {
          field: null,
          code: "unknown_doc_type",
          message: 'Unknown document type "' + String(docTypeId) + '".',
        },
      ],
    };
  }

  if (!isPlainObject(modelOutput) || !isPlainObject(modelOutput.fields)) {
    return {
      ok: false,
      fields: {},
      quality: { usable: true, problems: [] },
      documentMatch: null,
      issues: [
        {
          field: null,
          code: "bad_shape",
          message:
            "Model output has the wrong shape: expected { fields: { ... } }.",
        },
      ],
    };
  }

  const allowedIds = opts && Array.isArray(opts.allowedDocIds) ? opts.allowedDocIds : null;
  const qm = extractQualityAndMatch(modelOutput, allowedIds);
  const fields = {};
  const issues = [...qm.extraIssues];
  const allowed = new Set(docType.fields.map((f) => f.key));

  // Anything outside the fixed schema is rejected by code.
  for (const key of Object.keys(modelOutput.fields)) {
    if (!allowed.has(key)) {
      issues.push({
        field: key,
        code: "unexpected_field",
        message: 'Unexpected field "' + key + '" is not part of ' + docTypeId + ".",
      });
    }
  }

  for (const def of docType.fields) {
    const raw = modelOutput.fields[def.key];

    if (raw === undefined) {
      fields[def.key] = { value: null, confidence: "low", unreadable: false };
      if (def.required) {
        issues.push({
          field: def.key,
          code: "missing_required",
          message: def.key + " is required but was missing.",
        });
      }
      continue;
    }

    const env = envelopeSchema.safeParse(raw);
    if (!env.success) {
      fields[def.key] = raw;
      issues.push({
        field: def.key,
        code: "bad_shape",
        message:
          '"' + def.key + '" has the wrong shape: expected { value, confidence, unreadable }.',
      });
      continue;
    }

    // Keep the original value: never fixed or dropped.
    fields[def.key] = raw;

    if (raw.unreadable === true) {
      if (def.required) {
        issues.push({
          field: def.key,
          code: "unreadable",
          message: "Couldn't read " + def.key + ", please retake.",
        });
      }
      continue;
    }

    if (raw.value === null) {
      if (def.required) {
        issues.push({
          field: def.key,
          code: "missing_required",
          message: def.key + " is required but was missing.",
        });
      }
      continue;
    }

    if (typeof raw.value === "string" && raw.value.trim() === "") {
      if (def.required) {
        issues.push({
          field: def.key,
          code: "missing_required",
          message: def.key + " is required but was empty.",
        });
      } else {
        issues.push({
          field: def.key,
          code: "looks_wrong",
          message: def.key + " looks wrong: value is empty.",
        });
      }
      continue;
    }

    const schema = buildValueSchema(def);
    let toCheck = raw.value;
    if (def.type === "number" && typeof raw.value === "string") {
      const n = normalizeAmount(raw.value);
      if (n !== null) toCheck = n;
    }
    const res = schema.safeParse(toCheck);
    if (!res.success) {
      issues.push({
        field: def.key,
        code: codeForIssue(def, res.error),
        message: firstZodMessage(res.error, def.key + " looks wrong."),
      });
    }
  }

  return { ok: issues.length === 0, fields, quality: qm.quality, documentMatch: qm.documentMatch, issues };
}

// Step 7c Part 2: validate against an explicit doc def (builtins or saved
// inline defs). Builtins keep the old behavior via validateExtraction.
// New document types enforce a date floor (opts.dateFloor defaults to
// 1900-01-01; pass null for no floor, e.g. builtins). Flag never fix:
// bad values stay in `fields` + `issues`.
function validateExtractionWithDef(docDef, modelOutput, opts) {
  const hasOpts = opts !== undefined && opts !== null;
  const dateFloor = hasOpts && Object.prototype.hasOwnProperty.call(opts, "dateFloor")
    ? opts.dateFloor
    : "1900-01-01";
  const allowedIds = hasOpts && Array.isArray(opts.allowedDocIds) ? opts.allowedDocIds : null;
  const docTypeId = docDef && typeof docDef.id === "string" ? docDef.id : "document";
  if (!docDef || !Array.isArray(docDef.fields)) {
    return {
      ok: false,
      fields: {},
      quality: { usable: true, problems: [] },
      documentMatch: null,
      issues: [
        {
          field: null,
          code: "unknown_doc_type",
          message: 'Unknown document type "' + String(docTypeId) + '".',
        },
      ],
    };
  }

  if (!isPlainObject(modelOutput) || !isPlainObject(modelOutput.fields)) {
    return {
      ok: false,
      fields: {},
      quality: { usable: true, problems: [] },
      documentMatch: null,
      issues: [
        {
          field: null,
          code: "bad_shape",
          message:
            "Model output has the wrong shape: expected { fields: { ... } }.",
        },
      ],
    };
  }

  const qm = extractQualityAndMatch(modelOutput, allowedIds);
  const fields = {};
  const issues = [...qm.extraIssues];
  const allowed = new Set(docDef.fields.map((f) => f.key));

  for (const key of Object.keys(modelOutput.fields)) {
    if (!allowed.has(key)) {
      issues.push({
        field: key,
        code: "unexpected_field",
        message: 'Unexpected field "' + key + '" is not part of ' + docTypeId + ".",
      });
    }
  }

  for (const def of docDef.fields) {
    const raw = modelOutput.fields[def.key];

    if (raw === undefined) {
      fields[def.key] = { value: null, confidence: "low", unreadable: false };
      if (def.required) {
        issues.push({
          field: def.key,
          code: "missing_required",
          message: def.key + " is required but was missing.",
        });
      }
      continue;
    }

    const env = envelopeSchema.safeParse(raw);
    if (!env.success) {
      fields[def.key] = raw;
      issues.push({
        field: def.key,
        code: "bad_shape",
        message:
          '"' + def.key + '" has the wrong shape: expected { value, confidence, unreadable }.',
      });
      continue;
    }

    fields[def.key] = raw;

    if (raw.unreadable === true) {
      if (def.required) {
        issues.push({
          field: def.key,
          code: "unreadable",
          message: "Couldn't read " + def.key + ", please retake.",
        });
      }
      continue;
    }

    if (raw.value === null) {
      if (def.required) {
        issues.push({
          field: def.key,
          code: "missing_required",
          message: def.key + " is required but was missing.",
        });
      }
      continue;
    }

    if (typeof raw.value === "string" && raw.value.trim() === "") {
      if (def.required) {
        issues.push({
          field: def.key,
          code: "missing_required",
          message: def.key + " is required but was empty.",
        });
      } else {
        issues.push({
          field: def.key,
          code: "looks_wrong",
          message: def.key + " looks wrong: value is empty.",
        });
      }
      continue;
    }

    const schema = buildValueSchema(def);
    let toCheck = raw.value;
    if (def.type === "number" && typeof raw.value === "string") {
      const n = normalizeAmount(raw.value);
      if (n !== null) toCheck = n;
    }
    const res = schema.safeParse(toCheck);
    if (!res.success) {
      issues.push({
        field: def.key,
        code: codeForIssue(def, res.error),
        message: firstZodMessage(res.error, def.key + " looks wrong."),
      });
      continue;
    }

    // New-doc date floor: real dates before the floor are flagged, never fixed.
    if (def.type === "date" && dateFloor && typeof raw.value === "string") {
      const v = raw.value;
      if (isRealCalendarDate(v) && !isFutureDate(v) && v < dateFloor) {
        issues.push({
          field: def.key,
          code: "looks_wrong",
          message: def.key + " looks wrong: date can't be before " + dateFloor + ".",
        });
      }
    }
  }

  return { ok: issues.length === 0, fields, quality: qm.quality, documentMatch: qm.documentMatch, issues };
}

module.exports = {
  validateExtraction,
  validateExtractionWithDef,
  buildValueSchema,
  normalizeAmount,
  QUALITY_PROBLEMS,
  QUALITY_REASONS,
  qualitySchema,
  buildDocumentMatchSchema,
};


