"use client";
import { useEffect, useRef } from "react";

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

// Cinta de cotizaciones en el pie de Inicio: widget gratuito "Ticker Tape" de TradingView, con su método oficial (el script lee la configuración JSON de su propia etiqueta).
export default function CintaCotizaciones() {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const claro = document.documentElement.dataset.tema === "claro";
    el.innerHTML = "";
    const w = document.createElement("div");
    w.className = "tradingview-widget-container__widget";
    el.appendChild(w);
    const sc = document.createElement("script");
    sc.type = "text/javascript";
    sc.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    sc.async = true;
    sc.innerHTML = JSON.stringify({ symbols: SIMBOLOS, showSymbolLogo: false, colorTheme: claro ? "light" : "dark", isTransparent: true, displayMode: "adaptive", locale: "es" });
    el.appendChild(sc);
    return () => { el.innerHTML = ""; };
  }, []);
  return (
    <div className="cinta no-print" role="region" aria-label="Cotizaciones de los mercados">
      <div ref={caja} className="tradingview-widget-container" />
    </div>
  );
}
