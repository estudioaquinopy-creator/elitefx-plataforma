import Link from "next/link";
import CuentaRanking from "@/components/CuentaRanking";
import type { RankingLateral as Datos } from "@/lib/rankingLateral";

const MEDALLA = ["🥇", "🥈", "🥉"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Versión compacta del ranking para el menú lateral (arriba de "Síguenos / Sígueme").
export default function RankingLateral({ d, alNavegar }: { d: Datos; alNavegar?: () => void }) {
  const mes = MESES[Number(d.mes.slice(5, 7)) - 1];
  return (
    <Link href="/comunidad/ranking" onClick={alNavegar} className="rkl" aria-label={"Ranking de " + mes}>
      <span className="rkl-t"><b style={{ whiteSpace: "nowrap" }}>🏆 Ranking</b><CuentaRanking cierre={d.cierre} compacto /></span>
      {d.modo === "gratis" ? (
        <small>Premios en USDT para los miembros VIP</small>
      ) : (
        <>
          {[0, 1, 2].map((i) => {
            const f = d.top[i];
            return (
              <span key={i} className={"rkl-f" + (f?.yo ? " yo" : "")}>
                <span>{MEDALLA[i]} {f ? f.nombre + (f.yo ? " (tú)" : "") : "—"}</span>
                <span className="rkl-p">{f ? <b>{f.puntos}</b> : null}<em>{d.premios[i]} USDT</em></span>
              </span>
            );
          })}
          {d.modo === "vip" && !d.top.some((f) => f.yo) && (
            <span className="rkl-f yo rkl-mi">
              <span>{d.yo ? "#" + d.yo.pos + " · Tú" : "Tú"}</span>
              <span className="rkl-p">{d.yo ? <b>{d.yo.puntos}</b> : <em>Aún sin puntos</em>}</span>
            </span>
          )}
        </>
      )}
    </Link>
  );
}
