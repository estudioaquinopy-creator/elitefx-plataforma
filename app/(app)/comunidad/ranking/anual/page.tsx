import Link from "next/link";
import { perfilActual, permisos, hoyPY, planRanking } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerAjustes } from "@/lib/ajustes";
import { guardarTextos } from "../../../ajustes-actions";
import { sorteoCfg } from "@/lib/ranking";
import { realizarSorteo } from "./actions";

export const dynamic = "force-dynamic";

type Fila = { user_id: string; nombre: string; puntos: number; meses: number; boletos: number; elegible: boolean };
type Sorteo = { anio: number; premio: string; nombre: string; puntos: number; boletos: number; total_boletos: number; participantes: number; realizado_at: string };
const MEDALLA = ["🥇", "🥈", "🥉"];

export default async function RankingAnual({ searchParams }: { searchParams: { a?: string; error?: string } }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  const gratis = !perm.admin && planRanking(perfil) === "gratis";
  const sb = createClient();
  const aj = await leerAjustes();
  const cfg = sorteoCfg(aj);
  const anioHoy = Number(hoyPY().slice(0, 4));
  const pedido = Number(searchParams.a);
  const anio = Number.isInteger(pedido) && pedido >= 2026 && pedido <= anioHoy ? pedido : anioHoy;
  const anios: number[] = [];
  for (let y = 2026; y <= anioHoy; y++) anios.push(y);

  const { data, error } = await sb.rpc("ranking_anual", { p_anio: anio });
  const falta = !!error;
  const filas = (data ?? []) as Fila[];
  const { data: sd } = await sb.from("sorteos").select("anio, premio, nombre, puntos, boletos, total_boletos, participantes, realizado_at").eq("anio", anio).maybeSingle();
  const sorteo = (sd as Sorteo | null) ?? null;
  const miPos = filas.findIndex((f) => f.user_id === perfil.id);
  const yo = miPos >= 0 ? filas[miPos] : null;
  const part = filas.filter((f) => f.elegible && f.boletos > 0);
  const totalBoletos = part.reduce((a, f) => a + f.boletos, 0);
  const fechaSorteo = (iso: string) => { const d = new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10).split("-"); return d[2] + "/" + d[1] + "/" + d[0]; };

  return (
    <>
      <Link href="/comunidad/ranking" className="back">← Ranking mensual</Link>
      <h1><span className="emo-t">🏅</span> Ranking anual {anio}</h1>
      <p className="sub">Suma los puntos de todos los meses del año. Solo participan los miembros VIP; los administradores no participan.</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}
      {falta && <p className="alerta">Todavía no está activo: corre la migración 0067_ranking_penalizacion_anual.sql en Supabase ({error?.message}).</p>}

      {anios.length > 1 && <div className="chips">{anios.map((y) => <Link key={y} href={"/comunidad/ranking/anual?a=" + y} className={y === anio ? "chip on" : "chip"}>{y}</Link>)}</div>}

      <section className="box" style={{ borderColor: "var(--go)" }}>
        <div className="tag" style={{ marginTop: 0 }}>🎁 Sorteo del año</div>
        <h2 style={{ margin: "4px 0 8px" }}>{sorteo?.premio ?? cfg.premio}</h2>
        <p className="mu" style={{ margin: "0 0 8px" }}>Participan los miembros VIP que sumaron puntos en al menos <b>{cfg.minMeses} meses</b> del año. Cada <b>{cfg.ptsBoleto} puntos</b> del año es <b>1 boleto</b>: cuantos más puntos, más probabilidades. El sorteo lo realiza ELITE FX al cerrar el año y el resultado queda publicado aquí.</p>
        {sorteo ? (
          <p style={{ margin: 0 }}>🎉 Ganó <b>{sorteo.nombre}</b> con {sorteo.boletos} {sorteo.boletos === 1 ? "boleto" : "boletos"} de {sorteo.total_boletos} ({sorteo.participantes} participantes). Sorteo realizado el {fechaSorteo(sorteo.realizado_at)}.</p>
        ) : (
          <small className="mu">Ahora mismo hay {part.length} {part.length === 1 ? "participante" : "participantes"} y {totalBoletos} {totalBoletos === 1 ? "boleto" : "boletos"} en juego.</small>
        )}
        {gratis && <p className="mu" style={{ marginTop: 10 }}>Estás viendo esto como miembro gratuito: el sorteo es solo para miembros VIP.</p>}
        {!perm.admin && !gratis && !falta && (
          <p style={{ margin: "10px 0 0" }}>
            {yo
              ? <>Tu año: <b>{yo.puntos} puntos</b> en <b>{yo.meses}</b> {yo.meses === 1 ? "mes" : "meses"} → <b>{yo.boletos}</b> {yo.boletos === 1 ? "boleto" : "boletos"}.{" "}{yo.elegible ? "✅ Ya cumples el mínimo de meses." : "Te faltan " + Math.max(0, cfg.minMeses - yo.meses) + " " + (cfg.minMeses - yo.meses === 1 ? "mes" : "meses") + " con puntos para participar."}</>
              : "Aún no tienes puntos este año. Participa en la comunidad para sumar."}
          </p>
        )}
        {perm.admin && !falta && (
          <>
            <details className="adm" style={{ marginTop: 10 }}>
              <summary>Configurar el sorteo</summary>
              <form action={guardarTextos} className="fm">
                <input type="hidden" name="ruta" value="/comunidad/ranking/anual" />
                <label>Premio<input name="sorteo_premio" defaultValue={cfg.premio} maxLength={120} /></label>
                <label>Puntos del año por cada boleto<input name="sorteo_pts_boleto" type="number" min={1} max={999} step={1} defaultValue={cfg.ptsBoleto} /></label>
                <label>Meses mínimos con puntos para participar<input name="sorteo_min_meses" type="number" min={1} max={12} step={1} defaultValue={cfg.minMeses} /></label>
                <button className="btn s">Guardar</button>
              </form>
            </details>
            {!sorteo && (
              <details className="adm" style={{ marginTop: 10 }}>
                <summary>Realizar el sorteo de {anio}</summary>
                <form action={realizarSorteo} className="fm">
                  <input type="hidden" name="anio" value={anio} />
                  <input type="hidden" name="premio" value={cfg.premio} />
                  <p className="mu" style={{ margin: 0 }}>Se sortea entre {part.length} participantes ({totalBoletos} boletos), con la probabilidad proporcional a sus boletos. El resultado se guarda y no se puede repetir.</p>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="confirmo" value="1" required style={{ width: "auto" }} /> Confirmo que quiero realizar el sorteo ahora</label>
                  <button className="btn s" disabled={part.length === 0}>Realizar sorteo</button>
                </form>
              </details>
            )}
          </>
        )}
      </section>

      <section className="box">
        <h2>Clasificación del año</h2>
        {filas.length === 0 && !falta && <p className="mu">Todavía nadie sumó puntos en {anio}.</p>}
        {filas.slice(0, 50).map((f, i) => (
          <div key={f.user_id} className="ses" style={f.user_id === perfil.id ? { background: "var(--sf2)", borderRadius: 12, padding: "12px", borderBottom: 0 } : undefined}>
            <div className="dt" style={{ minWidth: 46 }}>{MEDALLA[i] ?? "#" + (i + 1)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{f.nombre}{f.user_id === perfil.id ? " (tú)" : ""}</b>
              <small className="mu" style={{ display: "block" }}>{f.meses} {f.meses === 1 ? "mes" : "meses"} con puntos · {f.boletos} {f.boletos === 1 ? "boleto" : "boletos"}{f.elegible ? " · 🎁 participa" : ""}</small>
            </div>
            <b style={{ fontSize: 18 }}>{f.puntos} pts</b>
          </div>
        ))}
        {filas.length > 50 && <small className="mu">Se muestran los primeros 50.</small>}
        {!gratis && !perm.admin && yo && miPos >= 50 && <p className="mu" style={{ marginTop: 12 }}>Tu posición: <b>#{miPos + 1}</b> con {yo.puntos} puntos.</p>}
      </section>
    </>
  );
}
