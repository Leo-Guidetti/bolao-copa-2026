export default function manifest() {
  return {
    name: "Leigos da Bola | Copa 2026",
    short_name: "Leigos da Bola",
    description: "Bolão da Copa 2026 entre amigos.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f6e3b",
    theme_color: "#0f6e3b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
