# Suri design (step 10)

This replaces the old "Night scan" plan. The look is **locked**. Build what is written here and in `docs/mockups/`, nothing extra.

## Reference files

`docs/mockups/` holds the approved screens as plain HTML/CSS. Copy colors, sizes, spacing and markup patterns from them.

| File | Screen |
| --- | --- |
| `landing.html` | Front page `/` (includes the hero scan animation) |
| `checklist-phone.html` | Applicant checklist, phone width 390px |
| `reviewer-laptop.html` | Reviewer view, laptop width 1280px |

The mockups are design references, not code to paste. Ignore `<x-dc>`, `<helmet>`, `support.js` and the `DCLogic` script at the bottom. Turn inline styles into the project's normal styling (Tailwind v4 classes + the CSS tokens below).

## Direction in one line

Clean, dark, structured (Bryl Lim-style foundation: mono labels, numbered sections, thin dividers, white primary buttons) with Suri's own scanner signature: square markers, `DOC-0x` manifest labels, an ASCII skeleton while reading, a scan beam, and an "ANALYSIS COMPLETE" line.

## Tokens (put in `app/globals.css` as CSS variables)

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0D0E10` | Page background |
| `--surface` | `#141518` | Raised cards, radius 12px |
| `--line` | `#1E1F23` | Hairline dividers and card borders |
| `--line-strong` | `#26272C` | Input borders, pill borders |
| `--text` | `#EDEDEF` | Main text |
| `--text-2` | `#8B8D94` | Secondary text, labels |
| `--text-3` | `#5C5E66` | Faint text, counts |
| `--match` | `#7FD6A6` | Ready / match / passed |
| `--check` | `#F0C46A` | Needs confirming / question |
| `--mismatch` | `#F29A9A` | Mismatch / problem |
| `--accent` | `#7B8CFF` | **Only** the scan beam, the logo bar and focus rings |

Dark only. The theme toggle in the landing mockup is **out of scope**; do not build it.

## Type

- **JetBrains Mono** for structure: labels, section numbers ("01 — start a check"), `DOC-01`, status tags, stats, buttons in lists.
- **Manrope** for body text and document names.
- Load both with `next/font/google` in `app/layout.js`. No other fonts.
- Small mono labels: 10–11px, uppercase, letter-spacing .12–.14em, color `--text-2`.

## Signature elements

1. **Manifest rows.** Each document is a row: 9px square marker (color = status) · `DOC-01` mono label · document name · one plain sentence · small mono status tag on the right (`▪ CONFIRM`, `✓ READY`, etc., 1px border in a darker shade of the status color).
2. **Reading state.** While a document is being read, show the ASCII skeleton (`░ ▒` noise rows with field labels) with the scan beam moving over it. When reading finishes, the noise fades out and the real values appear. It is a loading state only.
3. **ANALYSIS COMPLETE line.** After all reading finishes, a mono line like `ANALYSIS COMPLETE · 2 READY · 1 TO CONFIRM`.
4. **Suri's question card.** Plain raised card (`--surface`, `--line` border), label `SURI ASKS`, the question, then answer buttons.
5. **Reviewer leader line.** On the document photo, a thin line from the field to a tag like `FULL NAME · CONFIRM`.

Not part of the design (tried and rejected): rubber stamps, manila/warm accent, Filipino slogan copy, paper-sheet documents, grain texture, big glow.

## Motion

- Landing hero: the 8-second CSS loop in `landing.html` (corners lock on → beam sweeps → noise decodes into values → leader lines draw → tags appear → typed ANALYSIS COMPLETE line). CSS only, no animation library.
- Hover / press: arrow `→` nudges 2px right on hover, list rows get a faint `--surface` background, buttons scale to .98 on press.
- Focus: visible 2px `--accent` focus ring on every interactive element.
- `prefers-reduced-motion: reduce`: no animation; show the final state (values visible, tags visible, line fully typed, no beam).

## Polish fixes that belong to step 10

- `/` still shows the Next.js starter → replace with the landing page.
- Tab title says "Create Next App" → `Suri`, with a one-line description.
- Field keys shown as code (e.g. `full_name`) on the checklist, reviewer, `/setup` and the OCR compare card → show the plain label from the document definition.
- Work log labels shown as code → plain words.
- Reviewer header repeats text → show it once.
- Wrong-document label reads "(form 138 style)" → plain name only.
- Override note box has no border → add `--line-strong` border. "Overridden" banner appears twice → once.
- Amounts formatted inconsistently → one format everywhere (e.g. `₱1,234.50`).
- Profile error shows twice → once.
- "use YYYY-MM-DD" message → plain wording that matches the Month / Day / Year fields.

## Build order (one branch per part, fresh Cline task each)

| Part | Branch | What |
| --- | --- | --- |
| 10a | `design-base` | Fonts, tokens, page title, landing page `/` with hero animation |
| 10b | `design-checklist` | Applicant checklist restyle (manifest rows, reading state, ANALYSIS COMPLETE line, question card) |
| 10c | `design-reviewer` | Reviewer view restyle + its polish fixes |
| 10d | `design-polish` | `/start`, `/profile`, `/setup`, OCR card, amounts, remaining polish fixes |

10a is done: fonts, tokens, title and landing page are built. The landing page's "how it works ↗", "scorecard ↗" and "github ↗" links were left out on purpose because those pages don't exist yet. They come back in step 11, when the repo is public and they can point to the README and `docs/SCORECARD.md`.

## Rules

- Small targeted edits. Never recreate an existing file. No logic, route or database changes; this step is looks and wording only.
- No new npm packages.
- Always `--webpack`.
- Phone first: everything must work at 390px wide with no sideways scroll.
- Text contrast stays readable (labels never darker than `--text-3` on `--bg`).
