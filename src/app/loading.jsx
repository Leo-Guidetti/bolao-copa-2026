// Tela de carregamento mostrada automaticamente ao trocar de página (App Router).
export default function Loading() {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3">
      <div className="lg-track">
        <span className="lg-ball" role="img" aria-label="Carregando">⚽</span>
      </div>
      <p className="animate-pulse text-sm font-medium text-[var(--muted)]">Carregando…</p>
      <style>{`
        .lg-track { position: relative; height: 52px; width: 140px; display: flex; align-items: center; justify-content: center; }
        .lg-track::after { content: ""; position: absolute; bottom: 2px; left: 50%; width: 90px; height: 6px; transform: translateX(-50%); border-radius: 9999px; background: rgba(0,0,0,0.18); filter: blur(3px); animation: lg-shadow 1s ease-in-out infinite; }
        .lg-ball { font-size: 42px; line-height: 1; display: inline-block; will-change: transform; animation: lg-roll 1s ease-in-out infinite; }
        @keyframes lg-roll {
          0%   { transform: translateX(-40px) rotate(0deg); }
          50%  { transform: translateX(40px) rotate(360deg); }
          100% { transform: translateX(-40px) rotate(720deg); }
        }
        @keyframes lg-shadow {
          0%, 100% { width: 70px; opacity: 0.5; }
          50%      { width: 100px; opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
