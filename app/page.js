import HeroScan from "./components/HeroScan.js";
import "./landing-polish.css";
import { listProcesses } from "../lib/processes/index.js";

function shortTitle(id, label) {
  if (id === "linawan_scholarship_intake") return "Linawan College scholarship";
  if (id === "receipt_check") return "Official receipt check";
  return label || id;
}

function shortDesc(id) {
  if (id === "linawan_scholarship_intake") return "Valid ID, birth certificate, report card. Linawan residents only.";
  if (id === "receipt_check") return "Items add up, VAT and total match, date is valid.";
  return "";
}

function docCount(id, docs) {
  const n = Array.isArray(docs) ? docs.length : 0;
  return `${n} doc${n === 1 ? "" : "s"}`;
}

export default function Home() {
  const processes = listProcesses();

  return (
    <div className="landing-wrap">
      <div className="landing-shell">
        <aside className="landing-sidebar">
          <div className="landing-logo">
            <svg width="22" height="22" viewBox="0 0 28 28" aria-hidden="true">
              <path d="M2 8V2h6M20 2h6v6M26 20v6h-6M8 26H2v-6" fill="none" stroke="#8B8D94" strokeWidth="1.8" />
              <text x="14" y="19.5" textAnchor="middle" fontFamily="Manrope" fontWeight="800" fontSize="16" fill="#EDEDEF">
                S
              </text>
              <rect x="4" y="13.2" width="20" height="1.6" fill="#7B8CFF" />
            </svg>
            <span className="mono" style={{ fontSize: 17 }}>Suri</span>
          </div>
          <nav className="mono landing-nav" aria-label="Primary">
            <a href="/start" className="active">
              → start a check
            </a>
            <a href="/setup">set up your own</a>
            <a href="/start#your-checks" className="landing-nav-extra">
              your checks
            </a>
          </nav>
          <div className="landing-sidebar-divider" />
          <nav className="mono landing-nav landing-nav-secondary" aria-label="Secondary">
            <a href="#how-it-works">how it works</a>
            <a href="#accuracy">accuracy</a>
            <a href="#privacy">privacy</a>
          </nav>
          <div className="landing-sidebar-foot">
            <span>Built for the Meta Global AI Developer Hackathon.</span>
          </div>
        </aside>

        <main className="landing-main">
          <div className="landing-inner">
            <div className="landing-hero">
              <div className="landing-hero-scan">
                <HeroScan />
                <span className="mono" style={{ fontSize: 11, letterSpacing: ".06em", color: "#8B8D94", height: 16 }}>
                  <span className="type">ANALYSIS COMPLETE · 2 READY · 1 TO CONFIRM</span>
                </span>
              </div>
              <div className="landing-hero-copy">
                <h1 className="landing-title">Suri</h1>
                <p className="landing-copy">
                  Check your papers before the office does. Take a photo of each document. Suri reads it, checks it against your
                  other papers and the office&apos;s rules, and tells you what to fix.
                </p>
                <p className="landing-copy-muted">It never guesses. When it isn&apos;t sure, it asks. A person always decides.</p>
                <div className="mono landing-hero-links">
                  <a href="#how-it-works" className="landing-hero-link">
                    how it works ↓
                  </a>
                  <a href="https://github.com/btokne-auth/suri/blob/main/docs/SCORECARD.md" target="_blank" rel="noopener noreferrer" className="landing-hero-link">
                    scorecard ↗
                  </a>
                  <a href="https://github.com/btokne-auth/suri" target="_blank" rel="noopener noreferrer" className="landing-hero-link">
                    github ↗
                  </a>
                </div>
              </div>
            </div>

            <div id="accuracy" className="landing-stats">
              <div className="landing-stat" tabIndex={0}>
                <span className="landing-stat-value">95.5%</span>
                <span className="landing-stat-label">FIELDS READ RIGHT</span>
                <span className="landing-bars" aria-hidden="true">
                  <span className="landing-bar"><span className="landing-bar-name">Suri</span><span className="landing-bar-track"><span className="landing-bar-fill" style={{ width: "95.5%" }} /></span><span className="landing-bar-num">95.5</span></span>
                  <span className="landing-bar landing-bar--ocr"><span className="landing-bar-name">OCR</span><span className="landing-bar-track"><span className="landing-bar-fill" style={{ width: "75.4%" }} /></span><span className="landing-bar-num">75.4</span></span>
                </span>
                <span className="landing-stat-detail">171 of 179 fields · 25 sample documents</span>
              </div>
              <div className="landing-stat landing-stat--match" tabIndex={0}>
                <span className="landing-stat-value">0</span>
                <span className="landing-stat-label">WRONG VALUES</span>
                <span className="landing-stat-detail">Never invented a value across 179 fields. When unsure, it asked.</span>
              </div>
              <div className="landing-stat" tabIndex={0}>
                <span className="landing-stat-value">
                  100% <span className="landing-stat-vs">vs 26%</span>
                </span>
                <span className="landing-stat-label">PHONE PHOTOS VS PLAIN OCR</span>
                <span className="landing-bars" aria-hidden="true">
                  <span className="landing-bar"><span className="landing-bar-name">Suri</span><span className="landing-bar-track"><span className="landing-bar-fill" style={{ width: "100%" }} /></span><span className="landing-bar-num">100</span></span>
                  <span className="landing-bar landing-bar--ocr"><span className="landing-bar-name">OCR</span><span className="landing-bar-track"><span className="landing-bar-fill" style={{ width: "26%" }} /></span><span className="landing-bar-num">26</span></span>
                </span>
                <span className="landing-stat-detail">35 of 35 phone-photo fields vs 9 of 35</span>
              </div>
            </div>

            <section className="landing-section">
              <div className="landing-section-head">
                <span className="landing-section-title">01 — start a check</span>
                <a href="/setup" className="landing-section-link">
                  SET UP YOUR OWN →
                </a>
              </div>
              {processes.map((p) => (
                <a key={p.id} href={`/start?process=${encodeURIComponent(p.id)}`} className="landing-process-row">
                  <span className="landing-process-main">
                    <span className="landing-process-name">{shortTitle(p.id, p.label)}</span>
                    <span className="landing-process-desc">{shortDesc(p.id) || p.label}</span>
                  </span>
                  <span className="landing-process-docs">{docCount(p.id, p.documents)}</span>
                  <span className="landing-process-cta">start →</span>
                </a>
              ))}
            </section>

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
                  <span className="landing-how-text">Suri reads it and checks it against your other papers and the office&apos;s rules.</span>
                </div>
                <div className="landing-how-row">
                  <span className="landing-how-num">03</span>
                  <span className="landing-how-text">It tells you what&apos;s ready and what to fix. When it isn&apos;t sure, it asks. A person always decides.</span>
                </div>
              </div>
            </section>

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

            <p className="landing-footer">SAMPLE DOCUMENTS ONLY · UPLOADS DELETED AFTER 7 DAYS</p>
          </div>
        </main>
      </div>
    </div>
  );
}
