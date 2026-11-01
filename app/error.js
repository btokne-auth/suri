"use client";
// Hand-written. Shown when a page crashes. Never shows the internal error text.
import Link from "next/link";
import "./status-page.css";

export default function Error({ reset }) {
  return (
    <main className="sp-wrap">
      <div className="sp-card">
        <div className="sp-frame sp-frame--error" aria-hidden="true">
          <span className="sp-noise">░▒░ ▒▒░░ ▒░▒ ░░▒▒ ░▒</span>
          <span className="sp-beam" />
        </div>
        <span className="sp-label sp-label--error">SOMETHING WENT WRONG</span>
        <h1 className="sp-title">Suri hit a snag loading this page.</h1>
        <p className="sp-text">Your saved checks are still there. Try again, or go back to the start.</p>
        <div className="sp-actions">
          <button type="button" className="sp-btn sp-btn--primary" onClick={() => reset()}>
            try again
          </button>
          <Link href="/" className="sp-btn">
            back to Suri
          </Link>
        </div>
      </div>
    </main>
  );
}
