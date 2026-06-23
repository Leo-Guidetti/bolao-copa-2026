// Roteia a foto do jogador pelo nosso proxy (/api/photo), pra não ser barrada por
// bloqueadores que filtram o CDN do API-Football. Bandeiras (flagcdn) não passam por aqui.
export const photoSrc = (u) => (u ? `/api/photo?u=${encodeURIComponent(u)}` : null);
