// lib/processes/describe.js
//
// Step 7c Part 1: pure formatter. Turns a validated draft into readable
// checklist lines (documents -> fields -> checks in plain words) for the
// confirm screen. No database, no model, no secrets.

function docLabelOf(docId, lookupDoc) {
  if (typeof lookupDoc === "function") {
    try {
      const def = lookupDoc(docId);
      if (def && def.label) return def.label;
    } catch {
      // fall through to the raw id
    }
  }
  return String(docId);
}

function fieldLabelOf(docId, key, draft, lookupDoc) {
  const docs = (draft && draft.documents) || [];
  for (const entry of docs) {
    const id = entry && (entry.reuse || entry.id);
    if (id !== docId || !entry.fields) continue;
    const found = entry.fields.find((f) => f && f.key === key);
    if (found && found.label) return found.label;
  }
  if (typeof lookupDoc === "function") {
    try {
      const def = lookupDoc(docId);
      const found = def && (def.fields || []).find((f) => f && f.key === key);
      if (found && found.label) return found.label;
    } catch {
      // fall through
    }
  }
  return String(key).replace(/_/g, " ");
}

function describeCheck(c, draft, lookupDoc) {
  if (!c || typeof c !== "object") return "Check this document.";
  const srcDoc = docLabelOf(c.document, lookupDoc);
  const srcField = fieldLabelOf(c.document, c.field, draft, lookupDoc);
  const ct = String(c.compare_to || "");
  if (c.rule === "filipino_name") {
    if (ct === "profile.full_name") return srcField + " on " + srcDoc + " matches your profile name.";
    const dot = ct.indexOf(".");
    if (dot > 0) {
      const otherDoc = docLabelOf(ct.slice(0, dot), lookupDoc);
      return srcField + " on " + srcDoc + " matches the name on " + otherDoc + ".";
    }
    return srcField + " on " + srcDoc + " matches across documents.";
  }
  if (c.rule === "same_date") {
    if (ct === "profile.date_of_birth") return srcField + " on " + srcDoc + " matches your profile birth date.";
    const dot = ct.indexOf(".");
    if (dot > 0) {
      const otherDoc = docLabelOf(ct.slice(0, dot), lookupDoc);
      return srcField + " on " + srcDoc + " matches the date on " + otherDoc + ".";
    }
    return srcField + " on " + srcDoc + " matches across documents.";
  }
  if (c.rule === "equals") return srcField + ' must equal "' + c.value + '".';
  if (c.rule === "contains")
    return srcField + ' must contain "' + c.value + '".';
  if (c.rule === "not_future") return srcField + " must not be in the future.";
  if (c.rule === "within_months")
    return (
      srcField + " must be within the last " + c.months + " month" + (c.months === 1 ? "" : "s") + "."
    );
  if (c.rule === "age_limit") {
    const hasMin = Number.isInteger(c.min_age);
    const hasMax = Number.isInteger(c.max_age);
    if (hasMin && hasMax) return srcField + " on " + srcDoc + " must be between " + c.min_age + " and " + c.max_age + " years old.";
    if (hasMin) return srcField + " on " + srcDoc + " must be at least " + c.min_age + " years old.";
    if (hasMax) return srcField + " on " + srcDoc + " must be at most " + c.max_age + " years old.";
    return srcField + " on " + srcDoc + " is checked.";
  }
  if (c.rule === "sum_equals") return "Amounts on " + srcDoc + " must add up.";
  return srcField + " on " + srcDoc + " is checked.";
}

function describeRequirement(req, lookupDoc) {
  if (!req) return null;
  const doc = docLabelOf(req.document, lookupDoc);
  const fieldWord = String(req.field || "value").replace(/_/g, " ");
  return (
    "First check " + fieldWord + " on " + doc + " (" + req.op + ' "' + req.value + '"): ' + req.message
  );
}

// describeDraft(draft, lookupDoc) -> readable structure for the confirm screen.
function describeDraft(draft, lookupDoc) {
  const d = draft || {};
  const documents = (d.documents || []).map((entry) => {
    const id = (entry && (entry.reuse || entry.id)) || "document";
    const label = entry.reuse
      ? docLabelOf(entry.reuse, lookupDoc)
      : entry.label || id;
    let fields = [];
    if (entry.reuse && typeof lookupDoc === "function") {
      try {
        const def = lookupDoc(entry.reuse);
        fields = (def && def.fields ? def.fields : []).map(
          (f) => (f.label || f.key) + " (" + f.type + (f.required ? ", required" : "") + ")"
        );
      } catch {
        fields = [];
      }
    } else {
      fields = (entry.fields || []).map(
        (f) => (f.label || f.key) + " (" + f.type + (f.required ? ", required" : "") + ")"
      );
    }
    return { id, label, reused: !!entry.reuse, fields };
  });
  const checks = (d.checks || []).map((c) => describeCheck(c, d, lookupDoc));
  const not_checked = Array.isArray(d.not_checked) ? d.not_checked.slice(0, 5) : [];
  const needs_more_info = typeof d.needs_more_info === 'string' ? d.needs_more_info : null;
  return {
    title: d.label || "New process",
    documents,
    checks,
    requirement: describeRequirement(d.requirement, lookupDoc),
    not_checked,
    needs_more_info,
  };
}

module.exports = { describeDraft, describeCheck, describeRequirement };
