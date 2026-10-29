"use client";
import { useEffect, useState } from "react";

// Símbolos de la cinta (widget gratuito "Ticker Tape" de TradingView).
const SIMBOLOS = [
  { description: "Bitcoin", proName: "BITSTAMP:BTCUSD" },
  { description: "Ethereum", proName: "BITSTAMP:ETHUSD" },
  { description: "EUR/USD", proName: "FX:EURUSD" },
  { description: "Oro", proName: "OANDA:XAUUSD" },
  { description: "GBP/USD", proName: "FX:GBPUSD" },
  { description: "USD/CAD", proName: "FX:USDCAD" },
  { description: "USD/JPY", proName: "FX:USDJPY" },
  { description: "AUD/USD", proName: "FX:AUDUSD" },
  { description: "USD/CHF", proName: "FX:USDCHF" },
  { description: "Índice dólar", proName: "TVC:DXY" },
  { description: "Nasdaq 100", proName: "OANDA:NAS100USD" },
  { description: "Plata", proName: "OANDA:XAGUSD" },
];

// Cinta de cotizaciones en el pie de Inicio. Se carga dentro de un iframe aislado (sandbox sin acceso a nuestra sesión ni a nuestros datos).
export default function CintaCotizaciones() {
  const [doc, setDoc] = useState<string | null>(null);
  useEffect(() => {
    const claro = document.documentElement.dataset.tema === "claro";
    const cfg = { symbols: SIMBOLOS, showSymbolLogo: false, colorTheme: claro ? "light" : "dark", isTransparent: true, displayMode: "adaptive", locale: "es" };
    setDoc(
      '<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="' + (claro ? "light" : "dark") + '">' +
      "<style>html,body{margin:0;background:transparent;overflow:hidden}</style></head><body>" +
      '<div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div>' +
      '<script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js" async>' + JSON.stringify(cfg) + "</scr" + "ipt></div></body></html>",
    );
  }, []);
  return (
    <div className="cinta no-print" role="region" aria-label="Cotizaciones de los mercados">
      {doc && <iframe title="Cotizaciones en vivo" srcDoc={doc} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" loading="lazy" referrerPolicy="no-referrer" style={{ border: 0, width: "100%", height: 46, display: "block" }} />}
    </div>
  );
}
