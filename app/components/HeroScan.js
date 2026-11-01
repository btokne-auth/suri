// Hand-written. Hero story, 24-second CSS loop (styles in landing-polish.css, .hs-*):
// scene 1 PICK:  a process is picked on the start screen
// scene 2 READ:  the ID is read, Suri asks about the name, the answer makes it ready
// scene 3 BUILD: someone describes their own check, Suri builds the checklist
export default function HeroScan() {
  return (
    <>
      <svg className="hs" viewBox="0 0 360 320" width="100%" style={{ maxWidth: 360 }} aria-hidden="true">
        <defs>
          <pattern id="h1" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="0.7" fill="#25272C" /></pattern>
          <linearGradient id="trail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7B8CFF" stopOpacity="0" /><stop offset="1" stopColor="#7B8CFF" stopOpacity=".32" /></linearGradient>
          <filter id="blur" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="2.4" /></filter>
        </defs>
        <rect width="360" height="320" fill="url(#h1)" />
        {/* scene 1: pick a process */}
        <g className="hs-sceneA">
          <rect x="40" y="62" width="280" height="196" rx="10" fill="#0D0E10" stroke="#26272C" />
          <text x="56" y="86" fontFamily="JetBrains Mono" fontSize="7.5" letterSpacing="1.4" fill="#8B8D94">01 — CHOOSE A PROCESS</text>
          <rect className="hs-a-row" x="52" y="98" width="256" height="40" rx="6" fill="#0D0E10" stroke="#26272C" />
          <circle cx="68" cy="118" r="5" fill="none" stroke="#8B8D94" />
          <circle className="hs-a-sel" cx="68" cy="118" r="2.6" fill="#EDEDEF" />
          <text x="82" y="116" fontFamily="Manrope, sans-serif" fontSize="10" fill="#EDEDEF">Linawan College scholarship</text>
          <text x="82" y="129" fontFamily="JetBrains Mono" fontSize="7" fill="#5C5E66">3 DOCS · VALID ID, BIRTH CERT, REPORT CARD</text>
          <rect x="52" y="146" width="256" height="40" rx="6" fill="#0D0E10" stroke="#26272C" />
          <circle cx="68" cy="166" r="5" fill="none" stroke="#5C5E66" />
          <text x="82" y="164" fontFamily="Manrope, sans-serif" fontSize="10" fill="#C9CACF">Official receipt check</text>
          <text x="82" y="177" fontFamily="JetBrains Mono" fontSize="7" fill="#5C5E66">1 DOC · ITEMS, VAT AND TOTAL</text>
          <rect x="52" y="194" width="256" height="40" rx="6" fill="none" stroke="#26272C" strokeDasharray="3 3" />
          <text x="64" y="218" fontFamily="JetBrains Mono" fontSize="10" fill="#8B8D94">+</text>
          <text x="82" y="217" fontFamily="Manrope, sans-serif" fontSize="10" fill="#8B8D94">Set up your own check</text>
          <path className="hs-a-cursor" d="M200 121 l0 12 l3.2 -3 l2.4 5 l2 -1 l-2.4 -5 l4.4 0 z" fill="#EDEDEF" stroke="#0D0E10" strokeWidth=".8" />
        </g>

        {/* scene 2: read the ID, ask, confirm */}
        <g className="hs-sceneB">
          <rect x="26" y="40" width="196" height="232" fill="#0D0E10" opacity=".85" />

          {/* the document */}
          <g fontFamily="JetBrains Mono" fontSize="9" style={{ whiteSpace: "pre" }}>
            <rect x="30" y="44" width="188" height="230" fill="none" stroke="#33353B" strokeWidth="1" />
            <rect x="42" y="78" width="164" height="1" fill="#26282D" />
            <rect x="42" y="224" width="164" height="1" fill="#26282D" />
            <text className="hs-off-l1" x="42" y="112" fill="#24262B">░ ▒░ ░░▒ ░ ▒▒░ ░▒ ░ ▒░░ ▒ ░▒</text>
            <text className="hs-off-l2" x="42" y="140" fill="#24262B">▒░ ░ ▒▒░ ░▒░ ░ ▒ ░░▒ ░▒ ░ ▒</text>
            <text className="hs-off-l3" x="42" y="168" fill="#24262B">░▒ ░▒░ ░ ▒▒ ░░ ▒░ ░▒░ ▒ ░░▒</text>
            <text className="hs-off-l4" x="42" y="196" fill="#24262B">▒ ░░▒ ░▒ ░ ▒░▒ ░ ░▒▒ ░ ▒░ ░</text>
            <text className="hs-off-l5" x="42" y="242" fill="#24262B">░▒░ ▒ ░░▒▒ ░ ▒░ ░▒ ░░ ▒▒░ ░</text>
            <text className="hs-off-l6" x="42" y="256" fill="#24262B">▒ ░▒ ░░ ▒▒░ ░ ▒░▒ ░ ░▒ ░▒ ▒</text>
            <text x="42" y="98" fill="#55575E">NAME</text>
            <text x="42" y="126" fill="#55575E">BORN</text>
            <text x="42" y="154" fill="#55575E">SEX</text>
            <text x="42" y="182" fill="#55575E">CITY</text>
            <text x="42" y="210" fill="#55575E">ID NO</text>
          </g>
          <g className="hs-lock"><path d="M12 50V18h32M216 18h32v32M248 270v32h-32M44 302H12v-32" fill="none" stroke="#9A9CA3" strokeWidth="1.6" /></g>

          {/* values: noise decodes into the real text */}
          <g fontFamily="JetBrains Mono" fontSize="9">
            <text className="hs-off-t" x="42" y="66" fill="#3A3C42">▒░▒▒░░▒▒▒░░▒▒░▒░▒░</text>
            <text className="hs-val-t" x="42" y="66" fontSize="9.5" letterSpacing=".6">LINAWAN VOTER ID</text>
            <text className="hs-off-n" x="90" y="98" fill="#3A3C42">░▒▒░▒░░▒▒▒░▒░▒░░▒▒</text>
            <text className="hs-val-n" x="90" y="98">Ma. Theresa S. Reyes</text>
            <text className="hs-off-b" x="90" y="126" fill="#3A3C42">▒░░▒▒░▒░▒░</text>
            <text className="hs-val-b" x="90" y="126">2007-03-14</text>
            <text className="hs-off-s" x="90" y="154" fill="#3A3C42">░▒▒░▒░</text>
            <text className="hs-val-s" x="90" y="154">Female</text>
            <text className="hs-off-c" x="90" y="182" fill="#3A3C42">▒░▒▒░░▒</text>
            <text className="hs-val-c" x="90" y="182">Linawan</text>
            <text className="hs-off-i" x="90" y="210" fill="#3A3C42">░▒░▒▒░▒░░▒▒░▒░</text>
            <text className="hs-val-i" x="90" y="210">LWN-VOT-004827</text>
          </g>

          {/* leader lines and tags */}
          <g fontFamily="JetBrains Mono" fontSize="8.5" letterSpacing=".8">
            <line className="hs-draw-amber" pathLength="100" x1="200" y1="95" x2="252" y2="95" stroke="#F0C46A" strokeWidth="1" />
            <g className="hs-tag-amber"><circle cx="200" cy="95" r="2.2" fill="#F0C46A" /><rect x="252" y="86" width="100" height="18" fill="#0D0E10" stroke="#4A3E1F" /><text x="259" y="98" fill="#F0C46A">NAME ▪ CONFIRM</text></g>

            <line className="hs-draw-green" pathLength="100" x1="200" y1="95" x2="252" y2="95" stroke="#7FD6A6" strokeWidth="1" />
            <g className="hs-tag-green"><circle cx="200" cy="95" r="2.2" fill="#7FD6A6" /><rect x="252" y="86" width="106" height="18" fill="#0D0E10" stroke="#24493A" /><text x="258" y="98" fill="#7FD6A6" letterSpacing=".3">NAME ✓ CONFIRMED</text></g>
            <rect className="hs-pulse" x="252" y="86" width="106" height="18" fill="none" stroke="#7FD6A6" strokeWidth="1" />

            <line className="hs-draw-birth" pathLength="100" x1="150" y1="123" x2="252" y2="123" stroke="#7FD6A6" strokeWidth="1" />
            <g className="hs-tag-birth"><circle cx="150" cy="123" r="2.2" fill="#7FD6A6" /><rect x="252" y="114" width="100" height="18" fill="#0D0E10" stroke="#24493A" /><text x="259" y="126" fill="#7FD6A6">BIRTH ✓ MATCH</text></g>
            <line className="hs-draw-city" pathLength="100" x1="134" y1="179" x2="252" y2="179" stroke="#7FD6A6" strokeWidth="1" />
            <g className="hs-tag-city"><circle cx="134" cy="179" r="2.2" fill="#7FD6A6" /><rect x="252" y="170" width="100" height="18" fill="#0D0E10" stroke="#24493A" /><text x="259" y="182" fill="#7FD6A6">CITY ✓ PASSED</text></g>
          </g>

          {/* scan beam */}
          <g className="hs-beam">
            <rect x="12" y="-14" width="236" height="44" fill="url(#trail)" />
            <rect x="12" y="28.5" width="236" height="4" fill="#7B8CFF" opacity=".7" filter="url(#blur)" />
            <rect x="12" y="30" width="236" height="1.2" fill="#EEF0FF" />
            <rect x="8" y="25" width="2" height="11" fill="#C9D0FF" /><rect x="250" y="25" width="2" height="11" fill="#C9D0FF" />
            <text x="244" y="25" textAnchor="end" fontFamily="JetBrains Mono" fontSize="7" letterSpacing="1.4" fill="#A3AEFF">SCANNING</text>
          </g>

          {/* act 2: Suri asks */}
          <g className="hs-ask">
            <rect x="40" y="226" width="304" height="72" rx="8" fill="#141518" stroke="#2E3036" />
            <rect x="54" y="238" width="5" height="5" fill="#F0C46A" />
            <text x="64" y="243" fontFamily="JetBrains Mono" fontSize="7.5" letterSpacing="1.4" fill="#8B8D94">SURI ASKS · NAME</text>
            <text x="54" y="260" fontFamily="Manrope, sans-serif" fontSize="10" fill="#EDEDEF">
              Is &ldquo;Ma. Theresa&rdquo; the same as Maria Theresa?
            </text>
            <rect className="hs-yes-bg" x="54" y="270" width="98" height="18" rx="4" fill="#0D0E10" stroke="#EDEDEF" />
            <text className="hs-yes-tx" x="103" y="282" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="8" fill="#EDEDEF">Yes, same person</text>
            <rect x="158" y="270" width="36" height="18" rx="4" fill="none" stroke="#2E3036" />
            <text x="176" y="282" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="8" fill="#8B8D94">No</text>
          </g>
          <path className="hs-cursor" d="M110 279 l0 12 l3.2 -3 l2.4 5 l2 -1 l-2.4 -5 l4.4 0 z" fill="#EDEDEF" stroke="#0D0E10" strokeWidth=".8" />
        </g>

        {/* scene 3: build your own check */}
        <g className="hs-sceneC">
          <rect x="30" y="34" width="300" height="262" rx="10" fill="#0D0E10" stroke="#26272C" />
          <text x="46" y="56" fontFamily="JetBrains Mono" fontSize="7.5" letterSpacing="1.4" fill="#8B8D94">SET UP YOUR OWN CHECK</text>
          <rect x="44" y="64" width="272" height="44" rx="6" fill="#141518" stroke="#26272C" />
          <text className="hs-c-t1" x="54" y="81" fontFamily="Manrope, sans-serif" fontSize="9.5" fill="#EDEDEF">Barangay clearance: valid ID and an electric bill.</text>
          <text className="hs-c-t2" x="54" y="97" fontFamily="Manrope, sans-serif" fontSize="9.5" fill="#EDEDEF">Must live in Brgy. Baybayin. No pending case.</text>
          <g className="hs-c-btn">
            <rect x="44" y="116" width="96" height="20" rx="4" fill="#EDEDEF" />
            <text x="92" y="129" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="8" fill="#0D0E10">Build my check</text>
          </g>
          <rect x="44" y="146" width="272" height="1" fill="#1E1F23" />
          <rect className="hs-c-scan" x="44" y="148" width="272" height="1.2" fill="#7B8CFF" />
          <g fontFamily="JetBrains Mono" fontSize="7" letterSpacing="1">
            <g className="hs-c-r1"><rect x="46" y="160" width="6" height="6" fill="#8B8D94" /><text x="60" y="166" fill="#5C5E66">DOC-01</text><text x="104" y="166" fontFamily="Manrope, sans-serif" fontSize="9.5" letterSpacing="0" fill="#EDEDEF">Valid ID</text></g>
            <g className="hs-c-r2"><rect x="46" y="182" width="6" height="6" fill="#8B8D94" /><text x="60" y="188" fill="#5C5E66">DOC-02</text><text x="104" y="188" fontFamily="Manrope, sans-serif" fontSize="9.5" letterSpacing="0" fill="#EDEDEF">Electric bill</text></g>
            <g className="hs-c-r3"><rect x="46" y="204" width="6" height="6" fill="#7FD6A6" /><text x="60" y="210" fill="#7FD6A6">CHECK</text><text x="104" y="210" fontFamily="Manrope, sans-serif" fontSize="9.5" letterSpacing="0" fill="#C9CACF">Name matches on both papers</text></g>
            <g className="hs-c-r4"><rect x="46" y="226" width="6" height="6" fill="#7FD6A6" /><text x="60" y="232" fill="#7FD6A6">CHECK</text><text x="104" y="232" fontFamily="Manrope, sans-serif" fontSize="9.5" letterSpacing="0" fill="#C9CACF">Address contains &ldquo;Baybayin&rdquo;</text></g>
            <g className="hs-c-r5"><rect x="46" y="248" width="6" height="6" fill="#F0C46A" /><text x="60" y="254" fill="#F0C46A">BY HAND</text><text x="104" y="254" fontFamily="Manrope, sans-serif" fontSize="9.5" letterSpacing="0" fill="#C9CACF">No pending case</text><text x="104" y="267" fontSize="6.5" letterSpacing=".6" fill="#5C5E66">A PHOTO CAN&apos;T PROVE THIS</text></g>
          </g>
          <path className="hs-c-cursor" d="M100 128 l0 12 l3.2 -3 l2.4 5 l2 -1 l-2.4 -5 l4.4 0 z" fill="#EDEDEF" stroke="#0D0E10" strokeWidth=".8" />
        </g>
      </svg>

      <span className="hs-status mono" aria-hidden="true">
        <span className="hs-st-0">CHOOSE A PROCESS</span>
        <span className="hs-st-a">ANALYSIS COMPLETE · 2 READY · 1 TO CONFIRM</span>
        <span className="hs-st-b hs-st-good">ANSWERED · 3 READY · 0 TO CONFIRM</span>
        <span className="hs-st-c hs-st-good">CHECKLIST READY · 2 DOCS · 2 CHECKS · 1 BY HAND</span>
      </span>
      <span className="hs-scenes mono" aria-hidden="true">
        <span className="hs-m1"><i className="hs-m1-sq" />PICK</span>
        <span className="hs-m2"><i className="hs-m2-sq" />READ &amp; ASK</span>
        <span className="hs-m3"><i className="hs-m3-sq" />BUILD YOUR OWN</span>
      </span>
      <span className="sr-only-hs">
        Suri in three steps: pick the Linawan scholarship check; Suri reads a sample voter ID, asks whether &ldquo;Ma. Theresa&rdquo; is the same as
        Maria Theresa, and marks it ready after the answer; then someone describes their own check and Suri builds the checklist, leaving
        &ldquo;no pending case&rdquo; to be checked by hand.
      </span>
    </>
  );
}
