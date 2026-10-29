// lib/processes/draft-schema.js
// Step 7c Part 1: Zod schema for a model-drafted process.
// Fixed blocks only; unknown types rejected. No description field: office
// description is request-scoped only, never stored. Server assigns process_key.
const { z } = require("zod");
const BUILTIN_DOC_IDS = ["valid_id", "birth_certificate", "report_card", "official_receipt"];
const FIELD_TYPES = ["name", "date", "number", "text", "choice", "code"];
const RULE_NAMES = ["filipino_name", "same_date", "sum_equals", "equals", "contains", "not_future", "within_months"];
const LIMITS = { MAX_DOCUMENTS: 4, MAX_FIELDS_PER_DOC: 12, MAX_CHECKS: 20, PROCESS_LABEL_MIN: 5, PROCESS_LABEL_MAX: 80, DOC_LABEL_MIN: 3, DOC_LABEL_MAX: 80, FIELD_LABEL_MIN: 2, FIELD_LABEL_MAX: 60, MESSAGE_MIN: 5, MESSAGE_MAX: 200, VALUE_MIN: 1, VALUE_MAX: 80 };
const KEY_RE = /^[a-z0-9_]{2,30}$/;
const DOC_ID_RE = /^[a-z0-9_]{3,30}$/;
const fieldSchema = z.object({ key: z.string().regex(KEY_RE), type: z.enum(FIELD_TYPES), label: z.string().min(2).max(60), required: z.boolean(), maxLength: z.number().int().min(1).max(200).optional(), values: z.array(z.string().min(1).max(40)).min(2).max(20).optional(), min: z.number().optional(), max: z.number().optional() }).strict().superRefine((val, ctx) => {
  if (val.type === "choice" && !val.values) ctx.addIssue({ code: "custom", path: ["values"], message: "Choice fields need a values list." });
  if (val.type !== "choice" && val.values !== undefined) ctx.addIssue({ code: "custom", path: ["values"], message: "Only choice fields take a values list." });
  if (typeof val.min === "number" && typeof val.max === "number" && val.min > val.max) ctx.addIssue({ code: "custom", path: ["max"], message: "max must be at least min." });
});
const newDocSchema = z.object({ id: z.string().regex(DOC_ID_RE).refine((id) => !BUILTIN_DOC_IDS.includes(id), { message: "That id is built-in: use { reuse } instead." }), label: z.string().min(3).max(80), fields: z.array(fieldSchema).min(1).max(12) }).strict().superRefine((val, ctx) => {
  const keys = (val.fields || []).map((f) => f && f.key);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", path: ["fields"], message: "Field keys must be unique within a document." });
});
const reuseSchema = z.object({ reuse: z.enum(BUILTIN_DOC_IDS) }).strict();
const docRefSchema = z.union([reuseSchema, newDocSchema]);
const checkSchema = z.object({ document: z.string().min(1).max(40), field: z.string().regex(KEY_RE), compare_to: z.string().min(1).max(80), rule: z.enum(RULE_NAMES), value: z.string().min(1).max(80).optional(), months: z.number().int().min(1).max(24).optional(), message: z.string().min(5).max(200) }).strict().superRefine((val, ctx) => {
  const needsValue = val.rule === "equals" || val.rule === "contains";
  if (needsValue && val.value === undefined) ctx.addIssue({ code: "custom", path: ["value"], message: val.rule + " needs a value." });
  if (!needsValue && val.value !== undefined) ctx.addIssue({ code: "custom", path: ["value"], message: "value is only for equals/contains." });
  if (val.rule === "within_months" && val.months === undefined) ctx.addIssue({ code: "custom", path: ["months"], message: "within_months needs months (1-24)." });
  if (val.rule !== "within_months" && val.months !== undefined) ctx.addIssue({ code: "custom", path: ["months"], message: "months is only for within_months." });
});
const requirementSchema = z.object({ document: z.string().min(1).max(40), field: z.string().regex(KEY_RE), op: z.enum(["equals", "contains"]), value: z.string().min(1).max(80), message: z.string().min(5).max(200) }).strict();
const draftSchema = z.object({ label: z.string().min(5).max(80), documents: z.array(docRefSchema).min(1).max(4), checks: z.array(checkSchema).min(0).max(20), requirement: requirementSchema.optional() }).strict().superRefine((val, ctx) => {
  const ids = (val.documents || []).map((d) => d.reuse || d.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["documents"], message: "Document ids must be unique." });
  if (val.requirement && !ids.includes(val.requirement.document)) ctx.addIssue({ code: "custom", path: ["requirement", "document"], message: "Requirement document must be one of documents." });
});
function validateDraft(input) {
  const res = draftSchema.safeParse(input);
  if (res.success) return { ok: true, draft: res.data, issues: [] };
  const issues = (res.error.issues || []).map((i) => ({ path: Array.isArray(i.path) ? i.path.join(".") : "", code: i.code || "invalid", message: i.message || "Invalid draft." }));
  return { ok: false, draft: null, issues };
}
function docIdOf(entry) { return entry && (entry.reuse || entry.id); }
function checkDraftCompatibility(draft, lookupDoc) {
  const issues = [];
  const push = (path, code, message) => issues.push({ path, code, message });
  const lookup = typeof lookupDoc === "function" ? lookupDoc : () => null;
  const fieldTypes = {};
  const docIds = [];
  (draft.documents || []).forEach((entry, idx) => {
    const id = docIdOf(entry);
    if (!id) return;
    docIds.push(id);
    if (entry.reuse) {
      const def = lookup(entry.reuse);
      if (!def) { push("documents." + idx, "unknown_document", "Unknown document: " + id + "."); return; }
      const m = {};
      for (const f of def.fields || []) m[f.key] = f.type;
      fieldTypes[id] = m;
    } else {
      const m = {};
      for (const f of entry.fields || []) m[f.key] = f.type;
      fieldTypes[id] = m;
    }
  });
  function fieldType(docId, key) { const m = fieldTypes[docId]; return m ? m[key] : undefined; }
  function parseCompareTo(ct) {
    if (ct === "self" || ct === "value") return { kind: "self" };
    if (ct === "profile.full_name" || ct === "profile.date_of_birth") return { kind: "profile", ref: ct };
    const dot = String(ct).indexOf(".");
    if (dot < 0) return { kind: "bad" };
    const d = String(ct).slice(0, dot);
    const f = String(ct).slice(dot + 1);
    if (!/^[a-z0-9_]{2,40}$/.test(d)) return { kind: "bad" };
    if (!KEY_RE.test(f)) return { kind: "bad" };
    return { kind: "doc", doc: d, field: f };
  }
  (draft.checks || []).forEach((c, idx) => {
    const base = "checks." + idx;
    if (!c || typeof c !== "object") { push(base, "bad_check", "Check is not an object."); return; }
    if (!docIds.includes(c.document)) { push(base + ".document", "unknown_document", "Unknown document: " + c.document + "."); return; }
    const srcType = fieldType(c.document, c.field);
    if (!srcType) { push(base + ".field", "unknown_field", "Unknown field: " + c.field + "."); return; }
    const target = parseCompareTo(c.compare_to);
    if (target.kind === "bad") { push(base + ".compare_to", "bad_compare", "compare_to must be self, profile.full_name, profile.date_of_birth, or docId.fieldKey."); return; }
    if (target.kind === "doc") {
      if (!docIds.includes(target.doc)) { push(base + ".compare_to", "unknown_document", "Unknown document: " + target.doc + "."); return; }
      if (!fieldType(target.doc, target.field)) { push(base + ".compare_to", "unknown_field", "Unknown field: " + target.field + "."); return; }
    }
    const tgtType = target.kind === "doc" ? fieldType(target.doc, target.field) : target.kind === "profile" ? (target.ref === "profile.full_name" ? "name" : "date") : srcType;
    if (c.rule === "filipino_name") {
      if (srcType !== "name" || tgtType !== "name") push(base + ".rule", "type_mismatch", "filipino_name needs name fields.");
      if (target.kind === "self") push(base + ".compare_to", "bad_compare", "filipino_name needs another document or the profile.");
    } else if (c.rule === "same_date") {
      if (srcType !== "date" || tgtType !== "date") push(base + ".rule", "type_mismatch", "same_date needs date fields.");
      if (target.kind === "self") push(base + ".compare_to", "bad_compare", "same_date needs another document or the profile.");
    } else if (c.rule === "equals") {
      if (!["text", "name", "code", "choice"].includes(srcType)) push(base + ".rule", "type_mismatch", "equals needs text/name/code/choice.");
      if (target.kind !== "self") push(base + ".compare_to", "bad_compare", "equals uses compare_to self.");
    } else if (c.rule === "contains") {
      if (!["text", "name", "code"].includes(srcType)) push(base + ".rule", "type_mismatch", "contains needs text/name/code.");
      if (target.kind !== "self") push(base + ".compare_to", "bad_compare", "contains uses compare_to self.");
    } else if (c.rule === "not_future") {
      if (srcType !== "date") push(base + ".rule", "type_mismatch", "not_future needs a date field.");
      if (target.kind !== "self") push(base + ".compare_to", "bad_compare", "not_future uses compare_to self.");
    } else if (c.rule === "within_months") {
      if (srcType !== "date") push(base + ".rule", "type_mismatch", "within_months needs a date field.");
      if (target.kind !== "self") push(base + ".compare_to", "bad_compare", "within_months uses compare_to self.");
    } else if (c.rule === "sum_equals") {
      push(base + ".rule", "unsupported_rule", "sum_equals is not drafted.");
    }
  });
  if (draft.requirement) {
    const r = draft.requirement;
    const srcType = fieldType(r.document, r.field);
    if (!srcType) push("requirement.field", "unknown_field", "Requirement field is not in " + r.document + ".");
    else if (r.op === "equals" && !["text", "name", "code", "choice"].includes(srcType)) push("requirement.op", "type_mismatch", "equals needs text/name/code/choice.");
    else if (r.op === "contains" && !["text", "name", "code"].includes(srcType)) push("requirement.op", "type_mismatch", "contains needs text/name/code.");
  }
  return { ok: issues.length === 0, issues };
}
module.exports = { BUILTIN_DOC_IDS, FIELD_TYPES, RULE_NAMES, LIMITS, draftSchema, validateDraft, checkDraftCompatibility };
