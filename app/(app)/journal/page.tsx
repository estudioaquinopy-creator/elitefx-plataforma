import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { perfilActual, permisos, hoyPY } from "@/lib/sesion";
import { borrarOperacion, guardarOperacion } from "./actions";

export const dynamic = "force-dynamic";

type Op = { id: string; fecha: string; par: string; direccion: string; resultado: number; notas: string };
const PARES = ["XAUUSD", "EURUSD", "GBPUSD", "USDCAD"];
const money = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("es-PY", { maximumFractionDigits: 2 });

export default async function Journal({ searchParams }: { searchParams: { error?: string } }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  if (!perm.journal) {
    return (
      <>
        <h1>Journal</h1>
        <section className="box"><div className="tag">Solo miembros</div><p className="mu">El journal de trading es para miembros.</p><Link className="btn sd" href="/ayuda">Quiero ser miembro</Link></section>
      </>
    );
  }
  const { data } = await createClient().from("operaciones").select("*").eq("user_id", perfil.id).order("fecha", { ascending: false }).order("created_at", { ascending: false });
  const ops = ((data ?? []) as Op[]).map((o) => ({ ...o, resultado: Number(o.resultado) }));
  const n = ops.length;
  const ganadas = ops.filter((o) => o.resultado > 0).length;
  const neto = ops.reduce((a, o) => a + o.resultado, 0);
  const mejor = n ? Math.max(...ops.map((o) => o.resultado)) : 0;
  const peor = n ? Math.min(...ops.map((o) => o.resultado)) : 0;

  return (
    <>
      <h1>Journal</h1>
      <p className="sub">Tu diario de trading: registra cada operación y mira tus estadísticas. Es personal; nadie más lo ve.</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}

      <div className="kp">
        <div className="box"><span className="mu">Operaciones</span><b>{n}</b></div>
        <div className="box"><span className="mu">% de aciertos</span><b>{n ? Math.round((ganadas / n) * 100) + "%" : "—"}</b></div>
        <div className="box"><span className="mu">Resultado neto</span><b className={neto < 0 ? "neg" : neto > 0 ? "pos" : ""}>{money(neto)}</b></div>
        <div className="box"><span className="mu">Mejor / peor</span><b>{n ? money(mejor) + " / " + money(peor) : "—"}</b></div>
      </div>

      <div className="cols">
        <section className="box">
          <h2>Nueva operación</h2>
          <form action={guardarOperacion} className="fm">
            <div className="f2">
              <label>Fecha<input type="date" name="fecha" defaultValue={hoyPY()} required /></label>
              <label>Resultado ($, negativo si perdiste)<input name="resultado" inputMode="decimal" placeholder="Ej.: 120 o -45" required /></label>
            </div>
            <div className="f2">
              <label>Par<input name="par" list="pares" defaultValue="XAUUSD" required /></label>
              <label>Dirección
                <select name="direccion" defaultValue="compra"><option value="compra">Compra</option><option value="venta">Venta</option></select>
              </label>
            </div>
            <datalist id="pares">{PARES.map((p) => <option key={p} value={p} />)}</datalist>
            <label>Notas<textarea name="notas" rows={3} placeholder="¿Por qué entraste? ¿Qué aprendiste?" /></label>
            <button className="btn s">Guardar operación</button>
          </form>
        </section>

        <section className="box">
          <h2>Tus operaciones</h2>
          {n === 0 && <p className="mu">Aún no registraste operaciones.</p>}
          {ops.map((o) => (
            <div key={o.id} className="ses">
              <div style={{ flex: 1 }}>
                <b>{o.par} · {o.direccion === "compra" ? "Compra" : "Venta"}</b>
                <small className="mu" style={{ display: "block" }}>{new Date(o.fecha + "T00:00:00").toLocaleDateString("es-PY")}{o.notas ? " · " + o.notas : ""}</small>
              </div>
              <span className={o.resultado < 0 ? "neg" : "pos"}>{money(o.resultado)}</span>
              <form action={borrarOperacion}>
                <input type="hidden" name="id" value={o.id} />
                <button className="btn g s">Eliminar</button>
              </form>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
