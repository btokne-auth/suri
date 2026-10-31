# Step 10b — applicant checklist restyle (branch `design-checklist`)

## Goal (applicant only, reviewer is 10c)
Manifest header/tabs/progress, rows with 9px marker + DOC-01 + sentence + mono tag, reading skeleton + beam, ANALYSIS COMPLETE line, + photo upload, Suri asks, Check by hand, work log. 390px no scroll, laptop log beside list.

## Inputs reviewed
- `docs/DESIGN.md` locked tokens + mono + manifest + beam
- `docs/mockups/checklist-phone.html` 390px reference (ignore x-dc/helmet/support.js/DCLogic)
- `app/globals.css` tokens --bg/#0D0E10 --surface/#141518 --line/#1E1F23 --line-strong/#26272C --text/#EDEDEF --text-2/#8B8D94 --text-3/#5C5E66 --match/#7FD6A6 --check/#F0C46A --mismatch/#F29A9A --accent/#7B8CFF + landing classes + old .set-page/.set-wrap
- `app/set/[submissionId]/client.js` 556 lines: BTN/SMALLBTN/RESCOLOR, shrinkForUpload, sid/data/msg/busy/view/imgUrls poll 3s, upload/review/ocr, applicant h1>rows>action/reason>checks>not_checked>work_log step_type:message
- `app/set/[submissionId]/page.js` wrapper only — no change
- `app/api/submissions/[id]/route.js` GET {submission, process:{label,not_checked}, rows:[{doc_type,label,locked,status,action,reason,document_id}], checks:[{result,reason,field_key,rule,compared_label,document_id}], fields, work_log, clarifications}
- `lib/documents/*` builtins fields [{key,type}] no label; saved bundle.docs label

## Corrections (approved) — must be in implementation
1. Tags explicit, no default READY. READY only if action==="ready".
2. Progress read = uploaded AND finished (document_id present && status not uploaded/reading). ANALYSIS COMPLETE only when every doc read; add "· N TO FIX" when >0.
3. Reading skeleton+beam+READING… only, no field counts.
4. Work log sentence from step_type + doc label, never raw message.
5. Field label fallback: underscores->spaces, capitalize first letter only.
6. Colors only DESIGN tokens + darker borders; remove #a60 etc in new CSS.
7. page.js no change.

## 1 — Status tag & marker mapping (single source, never default READY)
Checked in order:
- !document_id / missing / action upload -> "+ UPLOAD" var(--text-2) / var(--line-strong)
- uploaded/reading -> "READING…" var(--accent) / #2C3156
- action ready -> "✓ READY" var(--match) / #1F4A33
- please confirm / answered -> "▪ CONFIRM" var(--check) / #3D2F10
- retake_needed -> "↻ RETAKE" var(--mismatch) / #4A2A2A
- wrong_document -> "✕ WRONG DOCUMENT" var(--mismatch) / #4A2A2A
- error -> "↻ TRY AGAIN" var(--mismatch) / #4A2A2A
- approved -> "✓ APPROVED" var(--match) / #1F4A33
- rejected -> "✕ REJECTED" var(--mismatch) / #4A2A2A
- has mismatch/invalid checks -> "✕ MISMATCH" var(--mismatch) / #4A2A2A
- fallback unknown -> "▪ CONFIRM" never READY

Marker background = tag color. Helper getTag(row,docChecks) returns {text,cls,markerBg}.

## 2 — Progress + ANALYSIS COMPLETE
```
isRead(r)= r && r.document_id && r.status!=="uploaded" && r.status!=="reading"
readCount=rows.filter(isRead).length; total=rows.length; allRead= total>0 && rows.every(isRead)
readyN=rows.filter(r=>getTag(r,checksFor(r.document_id)).text==="✓ READY").length
confirmN=rows.filter(r=>getTag(r).text==="▪ CONFIRM").length
fixN=rows.filter(r=>["↻ RETAKE","✕ WRONG DOCUMENT","↻ TRY AGAIN","✕ MISMATCH","✕ REJECTED"].includes(getTag(r).text)).length
```
Header shows "N OF M READ" (mono 11px #5C5E66) + dashed 1px. Stats 3-col 24px + 7px dot. Line mono 11px .12em #5C5E66: "ANALYSIS COMPLETE · N READY · N TO CONFIRM" + "· N TO FIX" if fixN>0, only when allRead.

## 3 — Files changed
### app/globals.css — add "Checklist — Step 10b" section
Append after landing 390 block, keep old .set-page. Classes:
- page/header/brand/tabs/tab-active, intro h1 28px mono subtitle 15px #8B8D94
- progress label 12px .18em + count 11px #5C5E66, stats grid 3-col
- row 18px pad #1E1F23 border, marker 9px, docid 10px .14em #5C5E66, name 16px 600, sentence 14px #8B8D94, tag 10px .12em 1px variants upload/reading/ready/confirm/fix
- skeleton 120px #0A0B0C #1E1F23 pre 11px #3A3C42 em #8B8D94 beam 16px gradient #7B8CFF 2.2s alternate + prefers-reduced-motion none
- checks ml 28px match/check/mismatch b colors var(--match/check/mismatch)
- upload-btn mono 12px #8B8D94 border --line-strong hover --text-2 focus --accent
- ask card --surface/--line 12px label 10px .14em q 15px input 44px btn primary #EDEDEF / secondary transparent
- hand card --surface/--line-strong 12px, log head 15px + badge 10px .12em list 14px divider #17181B time 12px mono #5C5E66
- phone 390: page 16px pad, header 12px, row 14px, skeleton/checks ml 0, log row stack

### app/set/[submissionId]/client.js — applicant view only
- Add helpers fieldLabelFallback (underscore->space first-cap only), getTag, isRead, workLogSentence (step_type+label), checks helpers reuse isSelfCheck/comparedLabelText/cleanReason but render with CSS classes not RESCOLOR.
- Header JSX: logo SVG S+bar + mono Suri + tabs checklist-tabs (shared for both views).
- Intro your papers + process.label.
- Progress + stats computed.
- Manifest: rows.map DOC-0x marker/tag -> skeleton if reading else checks + field labels + sentence (row.reason plain) . Upload keep input hidden accessible label + "+ photo" checklist-upload-btn + Upload button busy logic unchanged.
- Suri asks checklist-ask, Check by hand checklist-hand, log checklist-log with plain sentences.
- Reviewer view untouched except reuses header/tabs/log wrappers; no API/logic change; keep --webpack.

### app/set/[submissionId]/page.js — no change

## Verification
npm run build -- --webpack, 390px/laptop no scroll, tags per table, progress/ANALYSIS rules, no field keys raw, log plain sentences, reviewer still works, no DESIGN/mockup edits, no .env, no commit.



