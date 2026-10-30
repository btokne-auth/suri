# Step 10a part 2 — landing extras (branch `landing-extras`)

## Goal (nothing else — 8 items)
1. Sidebar first group: add `your checks` → `/start#your-checks`
2. Sidebar second group (after divider): `how it works` → `#how-it-works`, `accuracy` → `#accuracy`, `privacy` → `#privacy` (mockup style)
3. Hero: under two paras add mono link `how it works ↓` → `#how-it-works` (like hero links in `docs/mockups/landing.html`)
4. Stats row: `id="accuracy"`
5. Section `02 — how it works` (id=`how-it-works`), same header as 01, 3 rows:
   - 01 Take a photo of each document.
   - 02 Suri reads it and checks it against your other papers and the office's rules.
   - 03 It tells you what's ready and what to fix. When it isn't sure, it asks. A person always decides.
6. Section `03 — privacy` (id=`privacy`), same header style, 3 lines:
   - Use sample documents only. Never upload a real ID.
   - Uploads and results are deleted automatically after 7 days.
   - No account needed. You only see your own checks.
7. Smooth scroll only if `prefers-reduced-motion: no-preference`: `html { scroll-behavior: smooth }`
8. Phone 390px: top bar keeps only `start a check` + `set up your own`; new sections stack, no sideways scroll.

## Inputs reviewed
- `docs/DESIGN.md` — tokens, type, motion, build order (10a done, hero links left out on purpose)
- `app/page.js` — sidebar 2 links (/start active, /setup), divider + foot, hero title+2 paras, stats no id, section 01 only
- `app/globals.css` — landing classes, keyframes, prefers-reduced-motion, @media 768px/480px
- `app/start/client.js` — saved-checks block has no `id`
- `docs/mockups/landing.html` — sidebar: -> start a check (#EDEDEF), set up your own + your checks (#8B8D94), divider #1E1F23, second nav how it works/accuracy/privacy (#8B8D94); hero links mono 13px #8B8D94
- `app/components/HeroScan.js`, `app/layout.js`, `package.json` (--webpack)

## Current vs required — gaps
| Required | Now | Fix |
|---|---|---|
| Sidebar your checks → /start#your-checks | 2 links only | Add `<a href="/start#your-checks">your checks</a>` |
| /start saved section id="your-checks" | no id | Add `id="your-checks"` |
| Sidebar 2nd group after divider | divider → foot, no nav | Insert nav after divider with 3 links |
| Hero mono link how it works ↓ | no link | Add `<a href="#how-it-works">` |
| Stats id="accuracy" | no id | Add `id="accuracy"` |
| 02 how it works | missing | Add section id="how-it-works" after 01 |
| 03 privacy | missing | Add section id="privacy" after 02 |
| Smooth scroll no-preference | none | Add media query |
| Phone 390 keeps only 2 top links | 768px shows all nav links | Hide extra links + stack rows |

## Files to edit (small targeted edits, never recreate)
1. `app/start/client.js` — 1 line
2. `app/page.js` — sidebar, hero, stats id, 2 new sections
3. `app/globals.css` — smooth scroll, hero link, how/privacy, phone

Do NOT touch: `docs/DESIGN.md`, `docs/mockups/*`, API/DB/logic, `.env*`, no new packages, keep --webpack.

## 1) `app/start/client.js`
Before:
```js
{saved.length > 0 && (
  <div style={{ marginTop: 16 }}>
    <h2>Your checks</h2>
    {saved.map(row)}
  </div>
)}
```
After:
```js
{saved.length > 0 && (
  <div id="your-checks" style={{ marginTop: 16 }}>
    <h2>Your checks</h2>
    {saved.map(row)}
  </div>
)}
```

## 2) `app/page.js` — sidebar
### 2a first group (+ your checks)
Before:
```jsx
<nav className="mono landing-nav" aria-label="Primary">
  <a href="/start" className="active">→ start a check</a>
  <a href="/setup">set up your own</a>
</nav>
```
After:
```jsx
<nav className="mono landing-nav" aria-label="Primary">
  <a href="/start" className="active">→ start a check</a>
  <a href="/setup">set up your own</a>
  <a href="/start#your-checks" className="landing-nav-extra">your checks</a>
</nav>
```

### 2b second group (no second divider — one divider only)
Before:
```jsx
<div className="landing-sidebar-divider" />
<div className="landing-sidebar-foot">
```
After (approved: first nav, one divider, second nav, foot):
```jsx
<div className="landing-sidebar-divider" />
<nav className="mono landing-nav landing-nav-secondary" aria-label="Secondary">
  <a href="#how-it-works">how it works</a>
  <a href="#accuracy">accuracy</a>
  <a href="#privacy">privacy</a>
</nav>
<div className="landing-sidebar-foot">
```

### 2c hero link `how it works ↓`
Before hero-copy ends:
```jsx
  <p className="landing-copy-muted">It never guesses...</p>
</div>
```
After:
```jsx
  <p className="landing-copy-muted">It never guesses. When it isn't sure, it asks. A person always decides.</p>
  <a href="#how-it-works" className="mono landing-hero-link">how it works ↓</a>
</div>
```

### 2d stats id="accuracy"
```jsx
<div id="accuracy" className="landing-stats">
```

### 2e Section 02 — how it works after 01
```jsx
<section id="how-it-works" className="landing-section">
  <div className="landing-section-head">
    <span className="landing-section-title">02 — how it works</span>
  </div>
  <div className="landing-how-list">
    <div className="landing-how-row">
      <span className="landing-how-num">01</span>
      <span className="landing-how-text">Take a photo of each document.</span>
    </div>
    <div className="landing-how-row">
      <span className="landing-how-num">02</span>
      <span className="landing-how-text">Suri reads it and checks it against your other papers and the office's rules.</span>
    </div>
    <div className="landing-how-row">
      <span className="landing-how-num">03</span>
      <span className="landing-how-text">It tells you what's ready and what to fix. When it isn't sure, it asks. A person always decides.</span>
    </div>
  </div>
</section>
```

### 2f Section 03 — privacy after 02
```jsx
<section id="privacy" className="landing-section">
  <div className="landing-section-head">
    <span className="landing-section-title">03 — privacy</span>
  </div>
  <div className="landing-privacy-list">
    <p className="landing-privacy-line">Use sample documents only. Never upload a real ID.</p>
    <p className="landing-privacy-line">Uploads and results are deleted automatically after 7 days.</p>
    <p className="landing-privacy-line">No account needed. You only see your own checks.</p>
  </div>
</section>
```
Order: 01 → 02 → 03 → footer.

## 3) `app/globals.css`
### 3a smooth scroll
After `html { color-scheme: dark }`:
```css
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}
```

### 3b hero link
```css
.landing-hero-link {
  font-family: var(--font-jetbrains-mono), monospace;
  font-size: 13px;
  color: var(--text-2);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  width: fit-content;
}
.landing-hero-link:hover { color: #ffffff; }
.landing-hero-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

### 3c how it works rows
```css
.landing-how-list { display: flex; flex-direction: column; }
.landing-how-row {
  display: flex; gap: 16px; padding: 16px 0;
  border-bottom: 1px solid var(--line); align-items: flex-start;
}
.landing-how-num {
  font-family: var(--font-jetbrains-mono), monospace;
  font-size: 12px; color: var(--text-3); flex: none;
  line-height: 1.6; letter-spacing: 0.06em;
}
.landing-how-text { font-size: 15px; line-height: 1.6; color: var(--text-2); min-width: 0; }
```

### 3d privacy lines
```css
.landing-privacy-list { display: flex; flex-direction: column; }
.landing-privacy-line {
  margin: 0; padding: 16px 0; border-bottom: 1px solid var(--line);
  font-size: 15px; line-height: 1.6; color: var(--text-2);
}
```

### 3e phone 390 keeps only 2 links + stack no scroll
```css
@media (max-width: 768px) {
  .landing-nav-secondary, .landing-nav-extra { display: none; }
  .landing-how-row { gap: 12px; }
  .landing-how-text, .landing-privacy-line { overflow-wrap: break-word; word-break: break-word; }
}
@media (max-width: 390px) {
  .landing-inner { padding: 0 16px; }
  .landing-how-row, .landing-privacy-line { padding: 14px 0; }
}
```

## Verification
1. `npm run dev -- --webpack` landing loads no errors
2. Desktop 1280px: sidebar 3+3 links one divider, hero link, stats anchor, 01/02/03 headers
3. Anchors scroll: your checks → /start#your-checks, hero/sidebar → #how-it-works/#accuracy/#privacy, smooth scroll
4. prefers-reduced-motion reduce disables smooth scroll
5. Phone 390px: top bar only 2 links, no horizontal scroll, hero stacks, stats 1-col, rows stack
6. `npm run build -- --webpack` passes
7. No .env, no DESIGN/mockups, no API/DB, no new packages
8. Contrast readable

## Rules
- Small targeted edits, never recreate files
- No docs/DESIGN.md or docs/mockups edits
- No logic/API/DB, no new packages, always --webpack
- No .env read, no commit

