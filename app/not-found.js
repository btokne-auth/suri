// Hand-written. Shown for any page that doesn't exist (404).
import Link from "next/link";
import "./status-page.css";

export const metadata = { title: "Page not found · Suri" };

export default function NotFound() {
  return (
    <main className="sp-wrap">
      <div className="sp-card">
        <div className="sp-frame" aria-hidden="true">
          <span className="sp-noise">░▒░ ▒▒░░ ▒░▒ ░░▒▒ ░▒</span>
          <span className="sp-beam" />
        </div>
        <span className="sp-label">DOC-404 · NOT FOUND</span>
        <h1 className="sp-title">Suri looked, but this page isn&apos;t here.</h1>
        <p className="sp-text">The link may be old or typed wrong. Your checks are still safe.</p>
        <div className="sp-actions">
          <Link href="/" className="sp-btn sp-btn--primary">
            back to Suri →
          </Link>
          <Link href="/start" className="sp-btn">
            start a check
          </Link>
        </div>
      </div>
    </main>
  );
}
