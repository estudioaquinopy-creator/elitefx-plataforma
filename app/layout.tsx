import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ELITE FX · Plataforma",
  description: "Plataforma de estudio de ELITE FX",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-tema="oscuro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('tema');if(t)document.documentElement.dataset.tema=t}catch(e){}" }} />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
