"use client";

import { useState } from "react";

// Hand-written. "Why not just OCR?" — hover (or tap) a row on the left and the
// matching part of the example on the right lights up; everything else dims.
// Numbers come from docs/SCORECARD.md (25 sample documents).
const ROWS = [
  { key: "what", label: "What you get", ocr: "A block of raw text", suri: "Labeled fields: name, birth date, address, amounts" },
  { key: "phone", label: "Phone photos (35 fields)", ocr: "9 read right (26%)", suri: "35 read right (100%)" },
  { key: "all", label: "All 179 sample fields", ocr: "135 read right (75.4%)", suri: "171 read right (95.5%), 0 wrong values" },
  { key: "unreadable", label: "When it can't read a photo", ocr: "Returns text anyway, right or wrong", suri: "Asks for a retake and says what's wrong" },
  { key: "names", label: "Filipino names", ocr: "Not its job", suri: "Knows Ma., Sto./Sta., dela Cruz. Asks when unsure" },
  { key: "compare", label: "Compares your papers", ocr: "Not its job", suri: "Names, dates and amounts across papers, checked by code" },
  { key: "rules", label: "Office rules", ocr: "None", suri: "Built from plain words, confirmed by a person" },
];

// which rows light up each part of the example
const OCR_LINES = [
  { text: ["LINAWAN V", "0", "TER ", "1", "D"], links: ["what", "phone", "all", "unreadable"] },
  { text: ["NAME Ma Theresa S", ",", " Reyes"], links: ["what", "phone", "all", "unreadable", "names"] },
  { text: ["B", "0", "RN 2", "OO", "7-", "O", "3-", "l", "4"], links: ["what", "phone", "all", "unreadable", "compare"] },
  { text: ["CITY Lin", "aw an", ""], links: ["what", "phone", "all", "unreadable", "rules"] },
  { text: ["ID N", "0", " LWN-V", "0", "T-", "OO", "4827"], links: ["what", "phone", "all", "unreadable"] },
];
const FIELDS = [
  { k: "FULL NAME", v: "Ma. Theresa S. Reyes", tag: "▪ ASKS: SAME AS MARIA?", ask: true, links: ["what", "phone", "all", "names"] },
  { k: "BIRTH DATE", v: "2007-03-14", tag: "✓ MATCHES BIRTH CERT", links: ["what", "phone", "all", "compare"] },
  { k: "CITY", v: "Linawan", tag: "✓ OFFICE RULE PASSED", links: ["what", "phone", "all", "rules"] },
  { k: "ID NUMBER", v: "LWN-VOT-004827", tag: "✓ READ", links: ["what", "phone", "all"] },
];

function lit(active, links) {
  if (!active) return "";
  return links.includes(active) ? " is-lit" : " is-dim";
}

export default function WhySuri() {
  const [active, setActive] = useState(null);

  return (
    <div className={"ws" + (active ? " ws--active" : "")}>
      <div className="ws-rows" onMouseLeave={() => setActive(null)}>
        {ROWS.map((r) => (
          <div
            key={r.key}
            className={"ws-row" + (active === r.key ? " is-on" : active ? " is-off" : "")}
            tabIndex={0}
            onMouseEnter={() => setActive(r.key)}
            onFocus={() => setActive(r.key)}
            onBlur={() => setActive(null)}
            onClick={() => setActive(active === r.key ? null : r.key)}
          >
            <span className="ws-label">{r.label}</span>
            <span className="ws-ocr">{r.ocr}</span>
            <span className="ws-suri">{r.suri}</span>
          </div>
        ))}
      </div>

      <div className="ws-demo" aria-label="Example: the same phone photo read by plain OCR and by Suri">
        <div className="ws-demo-head">
          <span>SAME PHONE PHOTO</span>
          <span className="ws-demo-tag">ILLUSTRATION · SAMPLE VOTER ID</span>
        </div>

        <div className={"ws-card ws-card--ocr" + lit(active, ["what", "phone", "all", "unreadable", "names", "compare", "rules"])}>
          <span className="ws-card-label">PLAIN OCR</span>
          <div className="ws-ocr-text">
            {OCR_LINES.map((line, i) => (
              <div key={i} className={"ws-ocr-line" + lit(active, line.links)}>
                {line.text.map((part, j) =>
                  j % 2 === 1 ? <mark key={j}>{part}</mark> : <span key={j}>{part}</span>
                )}
              </div>
            ))}
          </div>
          <p className="ws-card-foot">Text only. You still find each field and check it yourself.</p>
        </div>

        <div className={"ws-card ws-card--suri" + lit(active, ["what", "phone", "all", "names", "compare", "rules"])}>
          <span className="ws-card-label">SURI</span>
          <div className="ws-fields">
            {FIELDS.map((f) => (
              <div key={f.k} className={"ws-field" + lit(active, f.links)}>
                <span className="ws-field-key">{f.k}</span>
                <span className="ws-field-val">{f.v}</span>
                <span className={"ws-tag" + (f.ask ? " ws-tag--ask" : "")}>{f.tag}</span>
              </div>
            ))}
          </div>
          <p className="ws-card-foot ws-card-foot--suri">Fields, already checked. You answer one question.</p>
        </div>
      </div>
    </div>
  );
}
