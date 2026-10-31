export default function SuriHeader() {
  return (
    <header className="checklist-header suri-header">
      <a href="/" className="checklist-brand" aria-label="Suri home">
        <svg width="22" height="22" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M2 8V2h6M20 2h6v6M26 20v6h-6M8 26H2v-6" fill="none" stroke="#8B8D94" strokeWidth="1.8" />
          <text x="14" y="19.5" textAnchor="middle" fontFamily="Manrope" fontWeight="800" fontSize="16" fill="#EDEDEF">
            S
          </text>
          <rect x="4" y="13.2" width="20" height="1.6" fill="#7B8CFF" />
        </svg>
        <span className="mono checklist-title">Suri</span>
      </a>
    </header>
  );
}
