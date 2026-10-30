export default function HeroScan() {
  return (
    <svg viewBox="0 0 360 320" width="100%" style={{ maxWidth: 360 }} aria-hidden="true">
      <defs>
        <pattern id="h1" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="0.7" fill="#25272C" /></pattern>
        <pattern id="h3" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1" fill="#55575E" /></pattern>
        <linearGradient id="trail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7B8CFF" stopOpacity="0" /><stop offset="1" stopColor="#7B8CFF" stopOpacity=".32" /></linearGradient>
        <filter id="blur" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="2.4" /></filter>
      </defs>
      <rect width="360" height="320" fill="url(#h1)" />
      <rect x="26" y="40" width="196" height="232" fill="#0D0E10" opacity=".85" />
      <g fontFamily="JetBrains Mono" fontSize="9" fill="#3A3C42" style={{ whiteSpace: "pre" }}>
        <rect x="30" y="44" width="188" height="230" fill="none" stroke="#33353B" strokeWidth="1" />
        <rect x="42" y="78" width="164" height="1" fill="#26282D" />
        <rect x="42" y="224" width="164" height="1" fill="#26282D" />
        <text className="off" x="42" y="112" fill="#24262B" style={{ animationDelay: "1.38s" }}>░ ▒░ ░░▒ ░ ▒▒░ ░▒ ░ ▒░░ ▒ ░▒</text>
        <text className="off" x="42" y="140" fill="#24262B" style={{ animationDelay: "1.61s" }}>▒░ ░ ▒▒░ ░▒░ ░ ▒ ░░▒ ░▒ ░ ▒</text>
        <text className="off" x="42" y="168" fill="#24262B" style={{ animationDelay: "1.84s" }}>░▒ ░▒░ ░ ▒▒ ░░ ▒░ ░▒░ ▒ ░░▒</text>
        <text className="off" x="42" y="196" fill="#24262B" style={{ animationDelay: "2.07s" }}>▒ ░░▒ ░▒ ░ ▒░▒ ░ ░▒▒ ░ ▒░ ░</text>
        <text className="off" x="42" y="242" fill="#24262B" style={{ animationDelay: "2.46s" }}>░▒░ ▒ ░░▒▒ ░ ▒░ ░▒ ░░ ▒▒░ ░</text>
        <text className="off" x="42" y="256" fill="#24262B" style={{ animationDelay: "2.57s" }}>▒ ░▒ ░░ ▒▒░ ░ ▒░▒ ░ ░▒ ░▒ ▒</text>
        <text x="42" y="98" fill="#55575E">NAME</text>
        <text x="42" y="126" fill="#55575E">BORN</text>
        <text x="42" y="154" fill="#55575E">SEX</text>
        <text x="42" y="182" fill="#55575E">CITY</text>
        <text x="42" y="210" fill="#55575E">ID NO</text>
      </g>
      <g className="lock"><path d="M12 50V18h32M216 18h32v32M248 270v32h-32M44 302H12v-32" fill="none" stroke="#9A9CA3" strokeWidth="1.6" /></g>
      <g fontFamily="JetBrains Mono" fontSize="9">
        <text className="off" x="42" y="66" fill="#3A3C42" style={{ animationDelay: ".99s" }}>▒░▒▒░░▒▒▒░░▒▒░▒░▒░</text>
        <text className="val" x="42" y="66" fontSize="9.5" letterSpacing=".6" style={{ animationDelay: ".99s" }}>LINAWAN VOTER ID</text>
        <text className="off" x="90" y="98" fill="#3A3C42" style={{ animationDelay: "1.26s" }}>░▒▒░▒░░▒▒▒░▒░▒░░▒▒</text>
        <text className="val" x="90" y="98" style={{ animationDelay: "1.26s" }}>Ma. Theresa S. Reyes</text>
        <text className="off" x="90" y="126" fill="#3A3C42" style={{ animationDelay: "1.49s" }}>▒░░▒▒░▒░▒░</text>
        <text className="val" x="90" y="126" style={{ animationDelay: "1.49s" }}>2007-03-14</text>
        <text className="off" x="90" y="154" fill="#3A3C42" style={{ animationDelay: "1.73s" }}>░▒▒░▒░</text>
        <text className="val" x="90" y="154" style={{ animationDelay: "1.73s" }}>Female</text>
        <text className="off" x="90" y="182" fill="#3A3C42" style={{ animationDelay: "1.96s" }}>▒░▒▒░░▒</text>
        <text className="val" x="90" y="182" style={{ animationDelay: "1.96s" }}>Linawan</text>
        <text className="off" x="90" y="210" fill="#3A3C42" style={{ animationDelay: "2.19s" }}>░▒░▒▒░▒░░▒▒░▒░</text>
        <text className="val" x="90" y="210" style={{ animationDelay: "2.19s" }}>LWN-VOT-004827</text>
      </g>
      <g fontFamily="JetBrains Mono" fontSize="8.5" letterSpacing=".8">
        <line className="draw" pathLength="100" x1="200" y1="95" x2="252" y2="95" stroke="#F0C46A" strokeWidth="1" style={{ animationDelay: "1.4s" }} />
        <g className="on" style={{ animationDelay: "1.55s" }}><circle cx="200" cy="95" r="2.2" fill="#F0C46A" /><rect x="252" y="86" width="100" height="18" fill="#0D0E10" stroke="#4A3E1F" /><text x="259" y="98" fill="#F0C46A">NAME ▪ CONFIRM</text></g>
        <line className="draw" pathLength="100" x1="150" y1="123" x2="252" y2="123" stroke="#7FD6A6" strokeWidth="1" style={{ animationDelay: "1.65s" }} />
        <g className="on" style={{ animationDelay: "1.8s" }}><circle cx="150" cy="123" r="2.2" fill="#7FD6A6" /><rect x="252" y="114" width="100" height="18" fill="#0D0E10" stroke="#24493A" /><text x="259" y="126" fill="#7FD6A6">BIRTH ✓ MATCH</text></g>
        <line className="draw" pathLength="100" x1="134" y1="179" x2="252" y2="179" stroke="#7FD6A6" strokeWidth="1" style={{ animationDelay: "2.1s" }} />
        <g className="on" style={{ animationDelay: "2.25s" }}><circle cx="134" cy="179" r="2.2" fill="#7FD6A6" /><rect x="252" y="170" width="100" height="18" fill="#0D0E10" stroke="#24493A" /><text x="259" y="182" fill="#7FD6A6">CITY ✓ PASSED</text></g>
      </g>
      <g className="beam">
        <rect x="12" y="-14" width="236" height="44" fill="url(#trail)" />
        <rect x="12" y="28.5" width="236" height="4" fill="#7B8CFF" opacity=".7" filter="url(#blur)" />
        <rect x="12" y="30" width="236" height="1.2" fill="#EEF0FF" />
        <rect x="8" y="25" width="2" height="11" fill="#C9D0FF" /><rect x="250" y="25" width="2" height="11" fill="#C9D0FF" />
        <text x="244" y="25" textAnchor="end" fontFamily="JetBrains Mono" fontSize="7" letterSpacing="1.4" fill="#A3AEFF">SCANNING</text>
      </g>
    </svg>
  );
}
