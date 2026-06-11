import "./globals.css";
import Nav from "@/components/Nav";
import Providers from "@/components/Providers";

export const metadata = {
  metadataBase: new URL("https://leigos-da-copa2026.vercel.app"),
  title: "Leigos da Bola | Copa 2026",
  description: "Bolão da Copa 2026 entre amigos: dê palpites nos placares e monte sua seleção.",
  applicationName: "Leigos da Bola",
  appleWebApp: { capable: true, title: "Leigos da Bola", statusBarStyle: "default" },
  openGraph: {
    title: "Leigos da Bola | Copa 2026",
    description: "Bolão da Copa 2026 entre amigos: palpite nos placares e monte sua seleção.",
    url: "https://leigos-da-copa2026.vercel.app",
    siteName: "Leigos da Bola",
    locale: "pt_BR",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Leigos da Bola | Copa 2026", description: "Bolão da Copa 2026 entre amigos." },
};
export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#0f6e3b" };

// App 100% dinâmico: evita pré-renderização estática no build (next-auth lê NEXTAUTH_URL em tempo de execução).
export const dynamic = "force-dynamic";

const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia&&matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body className="font-sans">
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
