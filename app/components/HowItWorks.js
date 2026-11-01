"use client";

import { useState } from "react";

// Hand-written. Exam-outline style: pick a step on the left, details on the right.
// The selection stays until another step is picked.
const STEPS = [
  {
    num: "01",
    title: "Take a photo",
    lead: "One photo or PDF per document on the checklist.",
    parts: [
      {
        title: "What you upload",
        points: [
          "A phone photo or a PDF of each document",
          "The checklist shows which documents the office needs",
          "Sample documents only, never a real ID",
        ],
      },
      {
        title: "If the photo is bad",
        points: [
          "Blurry, dark or cut off: Suri says what's wrong",
          "It reads the photo a second time before asking for a retake",
          "Wrong document: it says what the photo looks like instead",
        ],
      },
    ],
  },
  {
    num: "02",
    title: "Suri reads and checks",
    lead: "The model reads. Plain code does the checking.",
    parts: [
      {
        title: "Reading",
        points: [
          "Meta Muse Spark 1.3 reads each field from the photo",
          "Every model call is logged with the model name and the time it took",
        ],
      },
      {
        title: "Checking",
        points: [
          "Code, not the model, compares names, dates and amounts",
          "Against your other papers, your profile and the office's rules",
          "Knows Filipino names: \"Ma.\" for Maria, middle initials, name order",
        ],
      },
    ],
  },
  {
    num: "03",
    title: "You get an answer",
    lead: "Ready, confirm or fix, each with one plain reason.",
    parts: [
      {
        title: "When it isn't sure",
        points: [
          "It asks one question and shows both values",
          "Your answer goes to the reviewer with the document",
        ],
      },
      {
        title: "What it won't decide",
        points: [
          "Things a photo can't prove go to \"check by hand\"",
          "It never says a document is genuine",
          "A person always approves or rejects",
        ],
      },
    ],
  },
];

export default function HowItWorks() {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(0);
  const step = STEPS[active];

  function pick(i) {
    setActive(i);
    setOpen(0);
  }

  function onKey(e, i) {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const n = (i + 1) % STEPS.length;
      pick(n);
      document.getElementById(`hiw-tab-${n}`)?.focus();
    }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const n = (i - 1 + STEPS.length) % STEPS.length;
      pick(n);
      document.getElementById(`hiw-tab-${n}`)?.focus();
    }
  }

  return (
    <div className="hiw">
      <div className="hiw-list" role="tablist" aria-label="How it works" aria-orientation="vertical">
        {STEPS.map((s, i) => (
          <button
            key={s.num}
            id={`hiw-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls="hiw-panel"
            tabIndex={i === active ? 0 : -1}
            className={`hiw-tab${i === active ? " is-active" : ""}`}
            onClick={() => pick(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="hiw-marker" aria-hidden="true" />
            <span className="hiw-tab-text">
              STEP {s.num}: {s.title}
            </span>
          </button>
        ))}
      </div>

      <div id="hiw-panel" className="hiw-panel" role="tabpanel" aria-labelledby={`hiw-tab-${active}`} key={step.num}>
        <span className="hiw-panel-num">STEP {step.num}</span>
        <h3 className="hiw-panel-title">{step.title}</h3>
        <p className="hiw-panel-lead">{step.lead}</p>

        <div className="hiw-acc">
          {step.parts.map((part, j) => {
            const isOpen = open === j;
            return (
              <div key={part.title} className={`hiw-acc-item${isOpen ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="hiw-acc-head"
                  aria-expanded={isOpen}
                  aria-controls={`hiw-acc-${j}`}
                  onClick={() => setOpen(isOpen ? -1 : j)}
                >
                  <span>{part.title}</span>
                  <span className="hiw-chevron" aria-hidden="true">
                    ⌄
                  </span>
                </button>
                <ul id={`hiw-acc-${j}`} className="hiw-acc-body" hidden={!isOpen}>
                  {part.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
