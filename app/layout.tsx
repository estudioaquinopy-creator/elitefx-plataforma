import "./globals.css";
import type { Metadata } from "next";
import PixelMeta from "@/components/PixelMeta";
import { SCRIPT_PIXEL } from "@/lib/metaPixel";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { GA_ACTIVO, GA_ID, SCRIPT_GA } from "@/lib/googleAnalytics";

export const metadata: Metadata = {
  title: "ELITE FX · Plataforma",
  description: "Plataforma de estudio de ELITE FX",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-tema="oscuro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('tema');if(t)document.documentElement.dataset.tema=t}catch(e){}" }} />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_PIXEL }} />
        {GA_ACTIVO && <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />}
        {GA_ACTIVO && <script dangerouslySetInnerHTML={{ __html: SCRIPT_GA }} />}
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <PixelMeta />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
