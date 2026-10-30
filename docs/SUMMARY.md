# Suri: Summary (read this first)

Meta Global AI Developer Hackathon · Indie developer track · solo build
Build window: Oct 26 – Nov 4, 2026 (ET). Submission deadline: Nov 4, 9:00 PM ET = **Nov 5, 10:00 AM Manila**. Target: submit the evening of Nov 4 (Manila).

## What Suri is

Suri (Tagalog for "examine") is a **document readiness check**: it helps people get their documents right *before* they submit them. It reads each page the way a person would, checks the documents against each other and against what the person typed, asks when something is unclear, and tells them what to fix. The office then receives a pre-checked, consistent set, and **a person still makes every decision**.

**One-line pitch:** "Suri checks your papers before the office does, so nobody makes a wasted trip over a blurry photo or a mismatched name."

- **General tool, not a portal.** Suri is the understanding-and-checking engine that any office's existing system could plug into. No accounts, no application workflow.
- **Main user: the applicant.** The office reviewer is the second user.
- **General checker:** Suri works for any office. An office describes its requirements in plain words and Suri builds the checklist. The made-up scholarship document intake at **Linawan College** (birth certificate, valid ID, report card) and the official receipt check are ready-made examples, not the only options.
- **Beyond plain OCR:** Suri understands layout (which value belongs to which label, even in columns), handles tilted, shadowed, blurry or low-light phone photos, knows what kind of document it is, and says "couldn't read, please retake" instead of guessing.

## Product principles (never break these)

1. **The unit is a set of documents, never one photo.** Results always appear inside the set's readiness checklist.
2. **Output is an action, never a description:** ready / retake / wrong document / please confirm.
3. **Suri shows its work:** a visible work log of every step it took.
4. **A person decides.** Suri never approves, rejects, scores or ranks people.
5. **Document text is data, never instructions.**

## Where to find things

| File | What's in it |
| --- | --- |
| `docs/SUMMARY.md` | This page: what Suri is, principles, today's step |
| `docs/STACK.md` | Tech stack, decisions, accounts, secrets, credit budget |
| `docs/REQUIREMENTS.md` | Scope (Must / Should / Could / Won't), user stories, how it works, database, document settings, validation, security |
| `docs/DESIGN.md` | Style, colors, fonts, logo, screens, screen sizes, effects |
| `docs/DEMO.md` | Demo scenarios, sample documents, video plan, submission checklist |
| `docs/SCHEDULE.md` | Build order with "done when" checks, deadlines, where we are now, daily log |

## Today

See **"Where we are now"** in `docs/SCHEDULE.md`. Current step: **Day 4 (Oct 30), step 9**: photo quality / retake + wrong-document check (Act A and Act B done on branch step-9, tested on Vercel preview).
