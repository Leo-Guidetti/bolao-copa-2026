import { flagUrl } from "@/lib/flags";
import { photoSrc } from "@/lib/photo";

const SIZES = {
  sm: { box: "h-7 w-7", f: "h-3 w-3" },
  md: { box: "h-9 w-9", f: "h-4 w-4" },
  lg: { box: "h-12 w-12", f: "h-5 w-5" },
};

// Avatar do jogador: foto (quando há) ou silhueta neutra, com a bandeira como ícone redondo no canto.
export default function PlayerAvatar({ player, size = "md", className = "" }) {
  const s = SIZES[size] || SIZES.md;
  const flag = flagUrl(player?.team);
  return (
    <span className={`relative inline-block shrink-0 ${s.box} ${className}`}>
      <span className="block h-full w-full overflow-hidden rounded-full bg-[var(--hover)]">
        {player?.photoUrl ? (
          <img src={photoSrc(player.photoUrl)} alt={player?.name || ""} loading="lazy" className="h-full w-full object-cover object-top" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-full w-full text-[var(--faint)]" fill="currentColor"><circle cx="12" cy="9" r="4" /><path d="M4 20.5c0-4.1 3.6-6.5 8-6.5s8 2.4 8 6.5V21H4z" /></svg>
        )}
      </span>
      {flag && (
        <span className={`absolute -bottom-0.5 -left-0.5 ${s.f} overflow-hidden rounded-full ring-2 ring-[var(--surface)]`}>
          <img src={flag} alt={player?.team || ""} className="h-full w-full object-cover" />
        </span>
      )}
    </span>
  );
}
