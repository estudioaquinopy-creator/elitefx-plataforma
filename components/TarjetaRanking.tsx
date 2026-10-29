import Link from "next/link";
import CuentaRanking from "@/components/CuentaRanking";
import type { RankingLateral as Datos } from "@/lib/rankingLateral";

const MEDALLA = ["🥇", "🥈", "🥉"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Tarjeta del ranking en Inicio: cuenta regresiva hasta el cierre, podio con premios y la posición de quien mira.
export default function TarjetaRanking({ d }: { d: Datos }) {
  const mes = MESES[Number(d.mes.slice(5, 7)) - 1];
  const enPodio = d.top.some((f) => f.yo);
  return (
    <section className="box" style={{ borderColor: "var(--go)" }}>
      <div className="hd"><h2>🏆 Ranking de {mes}</h2></div>
      <div className="tag" style={{ marginTop: 0 }}>Cierra en</div>
      <CuentaRanking cierre={d.cierre} />
      {[0, 1, 2].map((i) => {
        const f = d.top[i];
        return (
          <div key={i} className="ses" style={f?.yo ? { background: "var(--sf2)", borderRadius: 12, padding: "9px 10px", borderBottom: 0 } : { padding: "7px 0" }}>
            <div className="dt" style={{ minWidth: 36 }}>{MEDALLA[i]}</div>
            <div style={{ flex: 1, minWidth: 0 }}><b>{f ? f.nombre + (f.yo ? " (tú)" : "") : "—"}</b></div>
            {f && <b>{f.puntos} pts</b>}
            <small className="mu" style={{ marginLeft: 8, whiteSpace: "nowrap" }}>{d.premios[i]} USDT</small>
          </div>
        );
      })}
      {d.modo === "vip" && !enPodio && (
        <p style={{ margin: "10px 0 0", padding: "8px 10px", borderRadius: 10, background: "var(--sf2)" }}>
          {d.yo ? <>Tu posición: <b>#{d.yo.pos}</b> con {d.yo.puntos} puntos</> : <span className="mu">Aún no tienes puntos este mes.</span>}
        </p>
      )}
      {d.modo === "gratis" && <p className="mu" style={{ margin: "10px 0 0" }}>Solo los miembros VIP participan y ganan premios.</p>}
      <Link className="btn bl s" href="/comunidad/ranking" style={{ marginTop: 10 }}>Ver ranking completo</Link>
    </section>
  );
}
