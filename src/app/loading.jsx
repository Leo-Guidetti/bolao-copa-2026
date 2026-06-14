// Tela de carregamento mostrada automaticamente ao trocar de página (App Router).
// Bola tricolor (branca + vermelho/azul/verde) no espírito da bola da Copa 2026.
export default function Loading() {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3">
      <div className="lg-track">
        <svg className="lg-ball" viewBox="0 0 100 100" role="img" aria-label="Carregando" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="47" fill="#ffffff" stroke="#0b0f14" strokeOpacity="0.15" strokeWidth="1.5" />
          <g>
            <ellipse cx="50" cy="26" rx="12.5" ry="19" fill="#e4002b" />
            <ellipse cx="50" cy="26" rx="12.5" ry="19" fill="#0057b7" transform="rotate(120 50 50)" />
            <ellipse cx="50" cy="26" rx="12.5" ry="19" fill="#16a34a" transform="rotate(240 50 50)" />
          </g>
          <circle cx="50" cy="50" r="6.5" fill="#ffffff" stroke="#0b0f14" strokeOpacity="0.18" strokeWidth="1.2" />
        </svg>
      </div>
      <p className="animate-pulse text-sm font-medium text-[var(--muted)]">Carregando…</p>
      <style>{`
        .lg-track { position: relative; height: 56px; width: 150px; display: flex; align-items: center; justify-content: center; }
        .lg-track::after { content: ""; position: absolute; bottom: 2px; left: 50%; width: 90px; height: 6px; transform: translateX(-50%); border-radius: 9999px; background: rgba(0,0,0,0.18); filter: blur(3px); animation: lg-shadow 1s ease-in-out infinite; }
        .lg-ball { height: 46px; width: 46px; display: block; will-change: transform; animation: lg-roll 1s ease-in-out infinite; }
        @keyframes lg-roll {
          0%   { transform: translateX(-42px) rotate(0deg); }
          50%  { transform: translateX(42px) rotate(360deg); }
          100% { transform: translateX(-42px) rotate(720deg); }
        }
        @keyframes lg-shadow {
          0%, 100% { width: 70px; opacity: 0.5; }
          50%      { width: 100px; opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
