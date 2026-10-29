import Link from "next/link";
import CuentaRanking from "@/components/CuentaRanking";

const MEDALLA = ["🥇", "🥈", "🥉"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

type Props = {
  mes: string; // AAAA-MM
  cierre: string; // fecha ISO del cierre
  top: { nombre: string; puntos: number }[];
  premios: number[];
  yo: { pos: number; puntos: number } | null;
  modo: "vip" | "admin" | "gratis";
};

// Tarjeta del ranking en Inicio: cuenta regresiva hasta el cierre, top 3 y la posición de la persona.
export default function TarjetaRanking({ mes, cierre, top, premios, yo, modo }: Props) {
  const nombreMes = MESES[Number(mes.slice(5, 7)) - 1];
  if (modo === "gratis") {
    return (
      <section className="box" style={{ borderColor: "var(--go)" }}>
        <div className="hd"><h2>🏆 Ranking de {nombreMes}</h2></div>
        <p className="mu">Cada mes premiamos con USDT a los 3 miembros VIP que más aportan a la comunidad. Pasa a VIP para participar.</p>
        <Link className="btn bl s" href="/comunidad/ranking">Ver cómo funciona</Link>
      </section>
    );
  }
  return (
    <section className="box" style={{ borderColor: "var(--go)" }}>
      <div className="hd"><h2>🏆 Ranking de {nombreMes}</h2></div>
      <div className="tag" style={{ marginTop: 0 }}>Cierra en</div>
      <CuentaRanking cierre={cierre} />
      {top.length === 0 ? (
        <p className="mu" style={{ margin: "4px 0 0" }}>Todavía nadie suma puntos este mes. ¡Sé el primero!</p>
      ) : (
        top.slice(0, 3).map((f, i) => (
          <div key={i} className="ses" style={{ padding: "7px 0" }}>
            <div className="dt" style={{ minWidth: 36 }}>{MEDALLA[i]}</div>
            <div style={{ flex: 1, minWidth: 0 }}><b>{f.nombre}</b></div>
            <b>{f.puntos} pts</b>
            <small className="mu" style={{ marginLeft: 8, whiteSpace: "nowrap" }}>{premios[i]} USDT</small>
          </div>
        ))
      )}
      {modo === "vip" && (
        <p className="mu" style={{ margin: "10px 0 0" }}>
          {yo ? <>Tu posición: <b>#{yo.pos}</b> con {yo.puntos} puntos</> : "Aún no tienes puntos este mes."}
        </p>
      )}
      <Link className="btn bl s" href="/comunidad/ranking" style={{ marginTop: 10 }}>Ver ranking completo</Link>
    </section>
  );
}
