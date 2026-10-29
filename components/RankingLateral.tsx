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
      ) : d.top.length === 0 ? (
        <small>Nadie suma puntos todavía</small>
      ) : (
        d.top.map((f, i) => (
          <span key={i} className="rkl-f"><span>{MEDALLA[i]} {f.nombre}</span><b>{f.puntos}</b></span>
        ))
      )}
      {d.modo === "vip" && <small className="rkl-yo">{d.yo ? "Tu posición: #" + d.yo.pos + " · " + d.yo.puntos + " pts" : "Aún no tienes puntos"}</small>}
    </Link>
  );
}
