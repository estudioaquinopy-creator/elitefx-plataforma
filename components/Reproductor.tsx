"use client";
import { useEffect, useRef, useState } from "react";

declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void } }

function cargarApi(): Promise<void> {
  return new Promise((ok) => {
    if (window.YT && window.YT.Player) return ok();
    const previo = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previo && previo(); ok(); };
    if (!document.getElementById("yt-api")) {
      const s = document.createElement("script");
      s.id = "yt-api"; s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });
}

const fmt = (s: number) => {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60), r = s % 60;
  return m + ":" + (r < 10 ? "0" : "") + r;
};

// Reproductor con solo play/pausa y barra de tiempo (sin título, sin compartir, sin "ver en YouTube").
export default function Reproductor({ id, titulo, auto = false }: { id: string; titulo: string; auto?: boolean }) {
  const caja = useRef<HTMLDivElement>(null);
  const dest = useRef<HTMLDivElement>(null);
  const pl = useRef<any>(null);
  const [juega, setJuega] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let vivo = true, timer: any;
    cargarApi().then(() => {
      if (!vivo || !dest.current) return;
      pl.current = new window.YT.Player(dest.current, {
        videoId: id,
        host: "https://www.youtube-nocookie.com",
        playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, autoplay: auto ? 1 : 0 },
        events: {
          onReady: (e: any) => { setDur(e.target.getDuration()); setListo(true); },
          onStateChange: (e: any) => { setJuega(e.data === 1); if (e.data === 1) setDur(e.target.getDuration()); },
        },
      });
      timer = setInterval(() => { try { pl.current && setT(pl.current.getCurrentTime()); } catch {} }, 400);
    });
    return () => { vivo = false; clearInterval(timer); try { pl.current && pl.current.destroy(); } catch {} };
  }, [id, auto]);

  function alternar() { if (!pl.current || !listo) return; juega ? pl.current.pauseVideo() : pl.current.playVideo(); }
  function ir(v: number) { if (pl.current) { pl.current.seekTo(v, true); setT(v); } }
  function pantalla() { const c = caja.current as any; if (!c) return; if (document.fullscreenElement) document.exitFullscreen(); else (c.requestFullscreen || c.webkitRequestFullscreen)?.call(c); }

  return (
    <div className="rep" ref={caja} aria-label={titulo}>
      <div className="rep-v"><div ref={dest} /></div>
      <div className="rep-bloq" onClick={alternar} />
      {!juega && listo && <button type="button" className="rep-big" onClick={alternar} aria-label="Reproducir">▶</button>}
      <div className="rep-bar">
        <button type="button" onClick={alternar} aria-label={juega ? "Pausar" : "Reproducir"}>{juega ? "❚❚" : "▶"}</button>
        <span>{fmt(t)}</span>
        <input type="range" min={0} max={dur || 1} step={1} value={Math.min(t, dur || 1)} onChange={(e) => ir(Number(e.target.value))} />
        <span>{fmt(dur)}</span>
        <button type="button" onClick={pantalla} aria-label="Pantalla completa">⛶</button>
      </div>
    </div>
  );
}
