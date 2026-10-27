// lib/profile.js
//
// Build order step 5: profile validation.
// Zod schema for POST /api/profile. Reuses step-3 name/date rules from
// lib/validation.js (letters incl. ñ/accents, real calendar date, not future).
// Server is the real check; the browser only mirrors messages.

const { z } = require("zod");

// Same name rule as step 3: letters incl. ñ/accents, spaces, hyphens,
// apostrophes, periods. No digits or symbols.
const NAME_RE = /^[\p{L} .'\-’]+$/u;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function nameField(label, { required = true, maxLength = 100 } = {}) {
  let s = z.string({ error: label + " looks wrong: use letters only." });
  if (!required) {
    s = s.optional();
  }
  // Optional empty string means "not given".
  return s.refine(
    (v) => {
      if (v === undefined) return !required;
      const t = v.trim();
      if (t === "") return !required;
      if (t.length > maxLength) return false;
      if (/\d/.test(t)) return false;
      return NAME_RE.test(t);
    },
    { message: label + " looks wrong: use letters, spaces, hyphens only." }
  );
}

const profileSchema = z.object({
  given_name: nameField("Given name", { required: true, maxLength: 100 }),
  middle_name: nameField("Middle name", { required: false, maxLength: 100 }),
  surname: nameField("Surname", { required: true, maxLength: 100 }),
  suffix: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (v === undefined) return true;
        const t = v.trim();
        if (t === "") return true;
        return t.length <= 10 && /^(Jr\.?|Sr\.?|II|III|IV)$/i.test(t);
      },
      { message: "Suffix looks wrong: Jr, Sr, II, III or IV only." }
    ),
  birth_date: z
    .string({ error: "Birth date can't be empty." })
    .refine((v) => DATE_RE.test(v), {
      message: "Birth date looks wrong: use YYYY-MM-DD.",
    })
    .refine((v) => isRealCalendarDate(v), {
      message: "Birth date looks wrong: not a real calendar date.",
    })
    .refine((v) => !isFutureDate(v), {
      message: "Birth date can't be in the future.",
    }),
  city_municipality: z
    .string({ error: "City/municipality can't be empty." })
    .min(1, { message: "City/municipality can't be empty." })
    .max(80, { message: "City/municipality looks wrong: too long." })
    .refine((v) => v === v.trim(), {
      message: "City/municipality looks wrong: extra spaces at the start or end.",
    }),
});

function validateProfile(input) {
  const res = profileSchema.safeParse(input);
  if (res.success) {
    const out = { ...res.data };
    for (const k of ["given_name", "middle_name", "surname", "suffix", "city_municipality"]) {
      if (typeof out[k] === "string") out[k] = out[k].trim();
      if (out[k] === "") out[k] = null;
    }
    if (out.suffix === undefined) out.suffix = null;
    if (out.middle_name === undefined) out.middle_name = null;
    return { ok: true, profile: out, issues: [] };
  }
  const issues = res.error.issues.map((i) => ({
    field: String(i.path && i.path[0]) || null,
    code: "looks_wrong",
    message: i.message,
  }));
  return { ok: false, profile: null, issues };
}

module.exports = { profileSchema, validateProfile };
