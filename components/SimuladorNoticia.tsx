"use client";
import { useState } from "react";
import CuentaNoticia from "./CuentaNoticia";

const dos = (n: number) => String(n).padStart(2, "0");
const OPCIONES: [string, number][] = [["en 1 hora", 3600], ["en 30 min", 1800], ["en 5 min", 300], ["en 20 seg", 20]];

// Solo para el administrador: una noticia de ejemplo que empieza dentro del plazo elegido, para ver el contador funcionando en vivo.
export default function SimuladorNoticia() {
  const [objetivo, setObjetivo] = useState<number | null>(null);
  const hora = objetivo ? dos(new Date(objetivo).getHours()) + ":" + dos(new Date(objetivo).getMinutes()) : "--:--";
  return (
    <div>
      <p className="mu" style={{ marginTop: 0 }}>Elige cuándo "sale" la noticia de ejemplo y mira cómo se comporta el contador en tiempo real.</p>
      <div className="chips">
        {OPCIONES.map(([t, s]) => <button key={s} type="button" className="chip" onClick={() => setObjetivo(Date.now() + s * 1000)}>{t}</button>)}
      </div>
      {objetivo && (
        <div className="ses">
          <div className="dt">{hora}</div>
          <div style={{ flex: 1 }}>
            <b>Noticia de ejemplo (simulación)</b>
            <small className="mu" style={{ display: "block" }}>EUR · Previsión 2.0% · Anterior 2.1%</small>
          </div>
          <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <CuentaNoticia key={objetivo} inicio={new Date(objetivo).toISOString()} />
            <span className="pill st-vencido">Alto impacto</span>
          </span>
        </div>
      )}
    </div>
  );
}
