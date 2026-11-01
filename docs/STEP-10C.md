# Step 10c — reviewer view + compare card restyle (branch `design-reviewer`) — PLAN ONLY

> No code changed yet. Looks/wording only, no API/logic, no new packages, always --webpack.

## 0) Branch & preconditions
- Branch design-reviewer (HEAD b6ce867 clean). Inputs: DESIGN tokens, reviewer-laptop.html (ignore x-dc/helmet/support.js/DCLogic), STEP-10B tags/tokens, globals.css Checklist 10b, client.js ~926 lines view==='reviewer'+OCR, lib/ocr-compare.js, SCHEDULE polish list, package.json --webpack.

## 1) Goal (reviewer view only)
Card per doc (DOC-0x, name, same tag never READY, plain sentence). Photo left fixed rounded new-tab/overlay laptop, top phone. Fields: plain LABEL never raw keys, value, mono confidence high/medium/low low in --check, check lines match/check/mismatch colors same as only for match vs compared with otherwise, no checks→just value. Correct small text per field same behaviour, Approve/Reject outlined bottom (Approve --match, Reject --mismatch) same behaviour. Clarifications quiet --surface card once per doc, Hand like applicant. Polish: header once, wrong-doc plain name no "(form 138 style)", override --line-strong border, Overridden once. Compare table Field|Suri|Plain OCR honest. No leader lines unless real positions. Phone 390 no scroll, laptop uses width.

## 2) Detailed plan
### 1. Card
Reuse getTag(row,docChecks): !document_id→+ UPLOAD var(--text-2)/#26272C; uploaded/reading→READING… var(--accent)/#2C3156; action ready→✓ READY var(--match)/#1F4A33; please confirm/answered→▪ CONFIRM var(--check)/#3D2F10; retake→↻ RETAKE var(--mismatch)/#4A2A2A; wrong_document→✕ WRONG DOCUMENT same; error→↻ TRY AGAIN same; approved→✓ APPROVED var(--match); rejected→✕ REJECTED var(--mismatch); mismatch/invalid→✕ MISMATCH; fallback ▪ CONFIRM never READY. Marker bg=tag. Card .reviewer-card bg var(--surface) 1px var(--line) 12px, header marker 9px + DOC-01 mono 10px .14em #5C5E66 + name 16px 600 + sentence 14px #8B8D94 + tag 10px .12em 1px darker border.

### 2. Photo
globals.css: .reviewer-card-inner flex column gap16 pad14/16 → @768 row gap24; .reviewer-photo-wrap flex none w100→@768 w300 (380 ref fit 1080); .reviewer-photo w100 aspect4/3 contain bg#0A0B0C border1 var(--line) radius12; <a target=_blank>. Phone min0 max100 no h-scroll. Correction2: metadata under photo (hash/size/type) ONLY if real data on page (imgUrls headers, data.fields meta, sha) — never placeholder abc… 612KB jpeg. Join present by · mono 11px var(--text-3). Correction3: do NOT add SURI/PLAIN OCR/GUESSES stats under photo unless real data already on page (fields counts, ocrByDoc foundCount, checks totals) — else omit entirely.

### 3. Fields
humanFieldLabel/fieldLabelFallback every label never raw. Value 600 15px var(--text) wrap. Confidence mono 10px .12em high/medium var(--text-3) low var(--check). Grid 120px 1fr auto gap16 baseline pad14/0 border-bottom var(--line); phone 1fr auto label 1/-1. Correct small text ml8 font500 12px mono var(--text-2) transparent underline offset3 min28 pad4/6 hover var(--text) focus accent — keep inline edit exactly. Checks ml136 desktop 0 mobile .checklist-checkline-match/check/mismatch var(--match/check/mismatch) cleanReason + suffix isSelfCheck?'':match?' — same as '+comparedLabelText:' — compared with '+comparedLabelText. No “no checks”.

### 4. Approve/Reject
Keep handleReview/handleCorrect/reviewBusy/msg exactly. Footer flex gap10 wrap mt16. Approve 600 15px var(--text) transparent border1 var(--match) radius8 pad0/20 min44 hover rgba(127,214,166,.08) active scale.98 focus accent. Reject same border var(--mismatch) hover rgba(242,154,154,.08). aria-busy disabled.

### 5. Clarifications/Hand
Once per doc .reviewer-clarif-card bg var(--surface) border1 var(--line) radius12 pad14/16 gap10 14px lh1.5 header SURI ASKED mono 10px .12em var(--text-2)+Q+divider 1px var(--line)+APPLICANT ANSWERED+A var(--text-2). Hand reuse .checklist-hand border1 var(--line-strong) bg var(--surface) radius12 pad16. No logic change.

### 6. Polish
Header once: remove duplicate “A person decides” keep badge ● needs a decision + subtitle once + set id once. Wrong-doc plain name: row.reason directly (wrongDocumentReason plain) remove “ (form 138 style)” literal; strip parenthetical if needed. Override border: inline #888 → .checklist-msg--override border1 var(--line-strong) bg var(--surface) radius8 pad12. Banner once: keep data.process.override_note single <p class=checklist-msg--override><b>Overridden:</b>…</p>; guard msg not dup (msg&&msg!==override_note&&msg!=='Overridden. A person decides.').

### 7. Compare with plain OCR — compact table (honest)
lib/ocr-compare.js ocrFoundInText({fieldDef,ocrText,expected}) type-aware checks if Suri value appears in raw OCR text (name baseNormalize+expandShortNames indexOf, number normalizeAmount tokens, date normText+dateCandidates 12 variants, choice RegExp \\bexp\\b, code flat [\\s\\-_], default normText indexOf) returns boolean — does NOT extract independently. Plain OCR never produces own value. So column must be honest found-in-text not extraction. Score Correction1: “Suri read X/Y fields · Plain OCR found Z of those values in its text” not “Suri 9/9”. Compute total=perField.length suriRead=perField.filter(f=>f.value_text!=null&&!f.unreadable).length ocrFound=perField.filter(f=>f.found).length. Markup .reviewer-ocr-score mono 11px .12em var(--text-3). Table width100 collapse 14px header Field|Suri (Muse Spark)|Plain OCR (no AI) honest cells found?‘✓ found in text’:‘✕ not found’ colors var(--match)/var(--mismatch) Field via humanFieldLabel Suri via f.value_text. Row border var(--line) header 10px .12em var(--text-2) uppercase cells pad10/8. Note mono 11px #5C5E66 “Plain OCR checks if Suri's value appears in raw Tesseract text — it doesn't extract fields on its own.” Subtitle Correction2: “Voter's ID style · read in 5.8 s · one question answered” show each ONLY if real data exists (docTypeLabel from bundle/docs or OCR_BUILTIN_DEFS, readSeconds from doc.created_at/work_log, clarifications.length) joined by · else omit never placeholder. Raw <details><summary mono Show raw OCR text> <pre bg var(--surface) border var(--line) radius8 pad12 max180 overflow auto pre-wrap 12px mono var(--text-2). Actions Copy/Run again/Hide text 11px .08em mono var(--text-2) transparent underline pad4/8 min28 hover var(--text). Keep lazy tesseract singleton fetch image-proxy recognize logger progress PDF friendly. Phone wrapper overflow-x auto no page scroll. Only reviewer view.

### 8. No leader lines — field positions do NOT exist
Search bbox|bounding|coordinates|field.*position → only tesseract core wasm internals; app selects id,doc_type,status,created_at,looks_like,quality_problems + extracted_fields field_key,value_text,confidence,unreadable — no x/y. lib/ocr-compare text only. No field position data exists. Do not add SVG leader lines FULL NAME·CONFIRM on photo; keep plain image; do not invent coordinates.

### 9. Phone + laptop
Phone 390 flex column photo w100 fields 1fr auto checks ml0 actions wrap table wrapper overflow-auto min280 no h-scroll (html,body max100 overflow-x hidden already, set-page pad16). Laptop max1080 set-docs flex1 1 0 photo 300-380 gap24-40 use width. Test 360/390/768/1024/1280 no h-scroll focus visible 44px targets prefers-reduced-motion beam none.

## 3) Files changed
- app/globals.css append “Reviewer — Step 10c” after Checklist 10b keep old set-page/wrap: add .reviewer-card/header/inner/photo-wrap/photo/photo-meta/fields/field/label/value/conf/conf-low/checks/correct-btn/clarif-card/actions/approve/reject/override/ocr-score/table/raw/pre/summary/action/header + checklist-msg--override fix + media 768 + reduced-motion. Reuse tokens var(--bg/surface/line/line-strong/text/text-2/text-3/match/check/mismatch/accent) + darker borders #1F4A33/#3D2F10/#4A2A2A/#2C3156. No new hex.
- app/set/[submissionId]/client.js reviewer view only applicant untouched: no new imports (lazy tesseract), reuse fieldLabelFallback/humanFieldLabel/getTag/isRead/cleanReason/isSelfCheck/comparedLabelText, cards photo conditional meta+no fake stats Correction2/3, plain labels confidence low --check, checks same as vs compared with, Correct same, Approve/Reject outlined --match/--mismatch, clarif/hand, header once/wrong-doc plain/override border+dedup, compare table honest score Correction1+conditional subtitle+note+raw+actions, keep review/ocr logic polling.
- app/set/[submissionId]/page.js no change. lib/ocr-compare.js no change. docs/DESIGN.md docs/SCOPE.md docs/mockups no change. package.json keep --webpack no new deps.

## 4) Not changed
Applicant view, any API/DB/migration/decideUsability/validateExtraction/quality/retry, OCR logic, amount/profile/setup polish (10d), fonts/tokens/landing (10a), .env/secrets.

## 5) Verification
npm run build -- --webpack + lint pass; 390+1280 no h-scroll 44px focus; tags never READY; no raw keys; confidence low --check; checks same as only match no “no checks”; clarif once quiet Hand like applicant; header once wrong-doc plain override border --line-strong banner once; compare score exact “Suri read X/Y fields · Plain OCR found Z of those values in its text” honest ✓ found/✕ not found + note + collapsed raw Copy/Run/Hide no fake stats no placeholders; no leader lines; no regressions.

## 6) Build order — Correction 4
In one go no waiting — single commit on design-reviewer implementing §2 all together then build+phone/laptop checks.

---
*Corrections 1-4 applied. No implementation yet.*

