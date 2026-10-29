# Suri: Design

Polish happens on Day 8, after the features work. Build plain, readable screens first.

## Style: "geek chic"

Sleek, minimalist and functional, with a techy, modern look.
- Lots of dark space, few elements per screen; every element has a job
- Thin 1px borders and hairline dividers instead of heavy boxes or shadows
- Monospace only for data (field values, hashes, confidence, status codes); Manrope for everything else
- Small, quiet labels; the document and its fields are the hero
- Motion only where it means something (the scan beam while reading)

## Colors: "Night scan"

**Dark mode is the default.** A small header toggle switches to light mode; the choice is remembered on that device (wrapped in try/catch, in case storage is blocked). Define colors once as CSS variables; never hard-code colors in components.

| Role | Dark mode | Light mode |
| --- | --- | --- |
| Page background | `#15171E` | `#F5F6FA` |
| Card / surface | `#1F222B` | `#FFFFFF` (border `#E1E3EA`) |
| Main text | `#E9EAF0` | `#15171E` |
| Secondary text | `#9AA0B4` | `#5B6070` |
| Accent (logo, main button) | `#7B8CFF`, button text `#10142E` | `#4C5BD9`, button text `#FFFFFF` |
| Match (badge bg / text) | `#173B2A` / `#7FD6A6` | `#E3F4EA` / `#1D6B44` |
| Check | `#3D2F10` / `#F0C46A` | `#FBF0D9` / `#7A5208` |
| Mismatch | `#401C1C` / `#F29A9A` | `#FBE5E5` / `#8E2424` |

The accent is darker in light mode because the periwinkle is too faint on white. Never rely on color alone: every badge also has a word (Match / Check / Mismatch).

## Fonts

- **Manrope** for everything (free, Google Fonts, loaded with `next/font`)
- A monospace font (for example JetBrains Mono) only for data values

## Visual references (principles only, no copied assets)

Direction for the scanner interface, not assets to copy. Everything is our own implementation.

- **Detroit: Become Human** (analysis mode): leader lines from a label to its spot, small "analysis complete" notices when a read finishes.
- **Star Wars Jedi: Fallen Order** (BD-1): a scan sweep across the photo while reading, then short databank-style entries per document.
- **Death Stranding**: manifest-style cargo lists — one thin status line per document, codes over prose.
- **GitHub Learn exam outline**: monospace all-caps labels, small square markers, expandable rows for detail.
- **ASCII loading idea** inspired by `ascii-reveal` by quanhoangindex (MIT). Our own implementation, credited in the README.
- **Step 10 signature elements (do these 3 well):**
  1. Scan beam + ASCII "scanning" placeholder while a document is reading.
  2. Manifest-style checklist (for example `DOC-01 VALID ID ▪ READY`): square status markers, one thin status line per document, expandable to show its checks.
  3. Result line like `ANALYSIS COMPLETE · 2 READY · 1 TO FIX`.
- **Bonus only** if "where it came from" (step 9) survives: leader lines from a field label to its spot on the photo in the reviewer view.
- **Fonts:** Manrope (main) + one free monospace font from Google Fonts (JetBrains Mono or IBM Plex Mono) for labels and codes.
- **Readability rules:** body text 16px, strong contrast; thin lines and glow are decoration only; works at 360px.

## Logo: "Scan beam S"

- A bold Manrope **S** inside four camera corners, crossed by a horizontal accent-colored scan beam, next to the **Suri** wordmark in Manrope ExtraBold
- Flat: no 3D or glow in the logo itself
- [ ] Logo SVG (made during the build), plus PNG exports in light and dark
- [ ] Favicon: S + beam on a rounded dark square (camera corners dropped at small sizes)

## Screens

**Header (every screen):** logo · **Applicant / Reviewer** switch · light/dark toggle

| # | Screen | What's on it |
| --- | --- | --- |
| 1 | **Landing** | Logo, isometric SVG hero (Should), one-line pitch, sample process picker (Linawan College intake; Receipt check), **Start** button |
| 2 | **Profile form** | Given name, middle name, surname, suffix, birth date, city/municipality; validation messages beside each field |
| 3 | **Set view (applicant)** | The readiness checklist: one row per required document (upload slot, status, ready / fix this + plain reason); the requirement document first, other slots locked until it passes; Suri's work log beside it (below it on phones); questions from Suri appear here (Should) |
| 4 | **Reviewer view** | Per document: image beside the fields Suri read, flags highlighted with reasons, the applicant's answers, approve / correct / reject; "Compare with plain OCR" (Should); tap a field to highlight it on the image (Should); work log |

No dashboard page. No single-document result page.

## Screen sizes

- Phone first for the applicant screens; laptop first for the reviewer view
- Check every screen at **360px**, **768px** and **1280px** before calling it done
- File input offers the camera on phones
- Tap targets at least 44px; no sideways scrolling on phones
- Reviewer view on a phone: image on top, fields below
- Slow or patchy internet: clear loading states, statuses update on their own, a retry button on errors

## Effects (CSS only; Day 8, after the feature checks pass)

- **Should:** scan beam sweeping across the document photo while its status is `reading` (matches the logo)
- **Should (Suri's visual trademark):** light isometric hero on the landing screen: one hand-made SVG (a few KB) of a document in camera corners, thin glowing lines (CSS drop-shadow), the scan beam sweeping across it. Built right after the scan beam since they share the animation. No 3D library, no extra tool
- **Should:** light mode toggle
- **Could:** soft accent glow on the main button and logo
- All effects turn off when the device has "reduce motion" set
