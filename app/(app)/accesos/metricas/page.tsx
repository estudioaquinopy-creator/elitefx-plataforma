import Link from "next/link";
import { notFound } from "next/navigation";
import { perfilActual, hoyPY } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { clienteAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type M = {
  actividad_desde: string | null; hoy: number; ayer: number; d7: number; d30: number;
  por_dia: { dia: string; n: number }[]; por_hora: { hora: number; vistas: number; usuarios: number }[]; por_semana: { dow: number; usuarios: number; vistas: number }[];
  secciones: { seccion: string; vistas: number; usuarios: number }[]; top_usuarios: { id: string; nombre: string; dias: number; vistas: number }[];
  registros_dia: { dia: string; n: number }[]; registros_hoy: number; registros_30: number;
  tipos: { total: number; vip: number; prueba: number; alumno: number; nuevo: number };
  por_vencer_7: number; vencidos_30: number; nuevos_vip_30: number; vip_sin_actividad_14: number;
  lecciones_30: number; alumnos_estudian_30: number; top_cursos: { curso: string; lecciones: number }[];
  examenes_30: { intentos: number; aprobados: number }; certificados_30: number;
  publicaciones_30: number; respuestas_30: number; dudas_30: number; dudas_sin_responder: number;
  visitas_pendientes: number; liquid_pendientes: number; liquid_aprobadas: number;
};
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SEC: Record<string, string> = { inicio: "Inicio", cursos: "Cursos", calendario: "Calendario", comunidad: "Comunidad", journal: "Journal", noticias: "Noticias", aliados: "Broker", visitas: "Visitas", referidos: "Referidos", perfil: "Perfil", tutoriales: "Tutoriales", otra: "Otras" };
const corto = (iso: string) => { const d = new Date(iso + "T12:00:00"); return d.getDate() + "/" + (d.getMonth() + 1); };
const pct = (a: number, b: number) => (b ? Math.round((a * 100) / b) + " %" : "—");

function Barras({ datos, etiqueta, alto = 120 }: { datos: { k: string; v: number; sub?: string }[]; etiqueta?: (d: { k: string; v: number }, i: number) => string | null; alto?: number }) {
  const max = Math.max(1, ...datos.map((d) => d.v));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: alto + 22, overflowX: "auto" }}>
      {datos.map((d, i) => (
        <div key={i} title={d.k + ": " + d.v + (d.sub ? " · " + d.sub : "")} style={{ flex: 1, minWidth: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
          <small className="mu" style={{ fontSize: 10, lineHeight: 1 }}>{d.v > 0 ? d.v : ""}</small>
          <div style={{ width: "100%", height: Math.max(2, Math.round((d.v / max) * alto)), background: d.v === max && max > 1 ? "var(--go)" : "var(--ac)", opacity: d.v ? 1 : 0.25, borderRadius: 3 }} />
          <small className="mu" style={{ fontSize: 10, height: 14 }}>{etiqueta ? etiqueta(d, i) ?? "" : d.k}</small>
        </div>
      ))}
    </div>
  );
}
const Kpi = ({ t, v, s }: { t: string; v: string | number; s?: string }) => <div className="box"><span className="mu">{t}</span><b>{v}</b>{s && <small className="mu">{s}</small>}</div>;

type R = {
  desde: string; hasta: string; registros: number; registros_dia: { dia: string; n: number }[]; pruebas: number; nuevos_vip: number;
  renovaciones: number; renovaron_personas: number; renovaciones_desde: string | null; vencieron: number; por_vencer: number;
  activos: number; actividad_desde: string | null; lecciones: number; alumnos_estudian: number; examenes: number; examenes_aprobados: number;
  certificados: number; publicaciones: number; respuestas: number; dudas: number;
};
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const sumaDias = (iso: string, n: number) => new Date(new Date(iso + "T00:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
const larga = (iso: string) => { const [a, m, d] = iso.split("-"); return d + "/" + m + "/" + a; };

export default async function Metricas({ searchParams }: { searchParams?: { desde?: string; hasta?: string; ver?: string } }) {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin") notFound();
  const sb = createClient();
  const { data, error } = await sb.rpc("metricas_accesos");
  const m = data as M | null;

  // Rango de fechas elegido por el administrador (opcional).
  const hoyIso = hoyPY();
  const qd = searchParams?.desde ?? "";
  const qh = searchParams?.hasta ?? "";
  const hayRango = ISO.test(qd) && ISO.test(qh);
  let rg: R | null = null;
  let errRango: string | null = null;
  if (hayRango) {
    const { data: rd, error: re } = await sb.rpc("metricas_rango", { p_desde: qd, p_hasta: qh });
    rg = (rd as R | null) ?? null;
    if (re) errRango = re.message;
  }
  // Lista de personas detrás de un número (al tocarlo).
  type Fila = { id: string; nombre: string; email: string; telefono: string | null; fecha: string; nota?: string };
  const ver = ["registros", "vip", "pruebas", "renovaciones", "vencieron"].includes(searchParams?.ver ?? "") ? (searchParams!.ver as string) : "";
  let filas: Fila[] = [];
  let tituloLista = "";
  if (hayRango && rg && ver) {
    const t0 = qd + "T00:00:00-03:00";
    const t1 = sumaDias(qh, 1) + "T00:00:00-03:00";
    const COLS = "id, nombre, email, telefono, created_at, vip_desde, vence";
    type P = { id: string; nombre: string | null; email: string | null; telefono: string | null; created_at: string; vip_desde: string | null; vence: string | null };
    const fila = (x: P, fecha: string, nota?: string): Fila => ({ id: x.id, nombre: (x.nombre ?? "").trim() || (x.email ?? "").split("@")[0], email: x.email ?? "", telefono: x.telefono, fecha, nota });
    const porIds = async (ids: string[]) => {
      if (!ids.length) return new Map<string, P>();
      const { data: ps } = await sb.from("perfiles").select(COLS).in("id", ids).neq("rol", "admin");
      return new Map(((ps ?? []) as P[]).map((x) => [x.id, x]));
    };
    if (ver === "registros") {
      tituloLista = "Registros nuevos";
      const { data: ps } = await sb.from("perfiles").select(COLS).neq("rol", "admin").gte("created_at", t0).lt("created_at", t1).order("created_at", { ascending: false }).limit(500);
      filas = ((ps ?? []) as P[]).map((x) => fila(x, x.created_at));
    } else if (ver === "vip") {
      tituloLista = "Pasaron a VIP por primera vez";
      const { data: ps } = await sb.from("perfiles").select(COLS).neq("rol", "admin").gte("vip_desde", t0).lt("vip_desde", t1).order("vip_desde", { ascending: false }).limit(500);
      filas = ((ps ?? []) as P[]).map((x) => fila(x, x.vip_desde ?? x.created_at, x.vence ? "vence " + larga(x.vence) : undefined));
    } else if (ver === "pruebas") {
      tituloLista = "Pruebas VIP canjeadas";
      const { data: cs } = await sb.from("pruebas_canjeadas").select("user_id, canjeado_at").gte("canjeado_at", t0).lt("canjeado_at", t1).order("canjeado_at", { ascending: false }).limit(500);
      const rows = (cs ?? []) as { user_id: string; canjeado_at: string }[];
      const mp = await porIds(rows.map((r) => r.user_id));
      filas = rows.filter((r) => mp.has(r.user_id)).map((r) => fila(mp.get(r.user_id)!, r.canjeado_at));
    } else if (ver === "renovaciones") {
      tituloLista = "Renovaciones VIP";
      const { data: rs } = await sb.from("renovaciones").select("user_id, created_at, vence_antes, vence_despues").gte("created_at", t0).lt("created_at", t1).order("created_at", { ascending: false }).limit(500);
      const rows = (rs ?? []) as { user_id: string; created_at: string; vence_antes: string | null; vence_despues: string | null }[];
      const mp = await porIds(rows.map((r) => r.user_id));
      filas = rows.filter((r) => mp.has(r.user_id)).map((r) => fila(mp.get(r.user_id)!, r.created_at, (r.vence_antes ? larga(r.vence_antes) : "sin fecha") + " → " + (r.vence_despues ? larga(r.vence_despues) : "—")));
    } else if (ver === "vencieron") {
      tituloLista = "Vencieron en el período";
      const { data: ps } = await sb.from("perfiles").select(COLS).neq("rol", "admin").gte("vence", qd).lte("vence", qh).lt("vence", hoyIso).is("prueba_hasta", null).or("plan.neq.gratis,es_alumno.eq.true").order("vence", { ascending: false }).limit(500);
      filas = ((ps ?? []) as P[]).map((x) => fila(x, (x.vence ?? "") + "T12:00:00-03:00"));
    }
  }
  const mesIni = hoyIso.slice(0, 8) + "01";
  const mesPasadoFin = sumaDias(mesIni, -1);
  const mesPasadoIni = mesPasadoFin.slice(0, 8) + "01";
  const atajos = [
    { t: "Hoy", d: hoyIso, h: hoyIso },
    { t: "Últimos 7 días", d: sumaDias(hoyIso, -6), h: hoyIso },
    { t: "Últimos 30 días", d: sumaDias(hoyIso, -29), h: hoyIso },
    { t: "Este mes", d: mesIni, h: hoyIso },
    { t: "Mes pasado", d: mesPasadoIni, h: mesPasadoFin },
  ];

  // Inicios de sesión (último ingreso de cada persona) desde el sistema de acceso: sirve desde el primer día.
  let ing = { hoy: 0, d7: 0, d30: 0, nunca: 0, total: 0 };
  const adm = clienteAdmin();
  if (adm) {
    const hoy = hoyPY();
    const { data: ps } = await sb.from("perfiles").select("id, rol");
    const noAdmin = new Set(((ps ?? []) as { id: string; rol: string }[]).filter((p) => p.rol !== "admin").map((p) => p.id));
    for (let pg = 1; pg <= 20; pg++) {
      const { data: lu } = await adm.auth.admin.listUsers({ page: pg, perPage: 1000 });
      const us = lu?.users ?? [];
      for (const u of us) {
        if (!noAdmin.has(u.id)) continue;
        ing.total++;
        if (!u.last_sign_in_at) { ing.nunca++; continue; }
        const dia = new Date(new Date(u.last_sign_in_at).getTime() - 3 * 3600000).toISOString().slice(0, 10);
        const dif = (new Date(hoy + "T00:00:00Z").getTime() - new Date(dia + "T00:00:00Z").getTime()) / 86400000;
        if (dif === 0) ing.hoy++;
        if (dif < 7) ing.d7++;
        if (dif < 30) ing.d30++;
      }
      if (us.length < 1000) break;
    }
  }

  const KpiVer = ({ v, t, n, s: sub }: { v: string; t: string; n: number; s?: string }) => (
    <Link href={"/accesos/metricas?desde=" + qd + "&hasta=" + qh + "&ver=" + v + "#lista"} className="box" style={{ textDecoration: "none", color: "inherit", outline: ver === v ? "2px solid var(--ac)" : undefined }}>
      <span className="mu">{t}</span><b>{n}</b>{sub && <small className="mu">{sub}</small>}
    </Link>
  );
  const horaTop = m ? [...m.por_hora].sort((a, b) => b.vistas - a.vistas)[0] : null;
  const diaTop = m ? [...m.por_semana].sort((a, b) => b.usuarios - a.usuarios)[0] : null;
  const sinDatos = !m || (m.actividad_desde === null);
  const dias = m?.actividad_desde ? Math.max(1, Math.round((new Date(hoyPY() + "T00:00:00Z").getTime() - new Date(m.actividad_desde + "T00:00:00Z").getTime()) / 86400000) + 1) : 0;

  return (
    <>
      <Link href="/accesos" className="back">← Accesos y membresías</Link>
      <h1>Métricas</h1>
      <p className="sub">Cómo se mueve la plataforma: quién entra, cuándo, qué usa y cómo van las membresías. Horario de Paraguay; no incluye a los administradores.</p>
      {error && <p className="alerta">No se pudieron cargar las métricas ({error.message}). Si dice que la función no existe, corre la migración 0056_metricas_accesos.sql en Supabase.</p>}

      <section className="box">
        <h2>Ingresos</h2>
        <p className="mu" style={{ margin: "0 0 10px" }}>Por último inicio de sesión de cada persona (disponible desde ya).</p>
        <div className="kp" style={{ marginBottom: 0 }}>
          <Kpi t="Ingresaron hoy" v={ing.hoy} s={pct(ing.hoy, ing.total) + " de " + ing.total} />
          <Kpi t="Últimos 7 días" v={ing.d7} s={pct(ing.d7, ing.total)} />
          <Kpi t="Últimos 30 días" v={ing.d30} s={pct(ing.d30, ing.total)} />
          <Kpi t="Nunca ingresaron" v={ing.nunca} s={pct(ing.nunca, ing.total)} />
        </div>
      </section>

      <section className="box">
        <h2>Ver un período</h2>
        <p className="mu" style={{ margin: "0 0 10px" }}>Elige de qué fecha a qué fecha quieres ver los números (horario de Paraguay, ambas fechas incluidas).</p>
        <form method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <label>Desde<br /><input type="date" name="desde" defaultValue={hayRango ? qd : mesIni} max={hoyIso} required /></label>
          <label>Hasta<br /><input type="date" name="hasta" defaultValue={hayRango ? qh : hoyIso} max={hoyIso} required /></label>
          <button className="btn s" type="submit">Ver</button>
          {hayRango && <Link href="/accesos/metricas" className="mu">Quitar período</Link>}
        </form>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {atajos.map((a) => <Link key={a.t} href={"/accesos/metricas?desde=" + a.d + "&hasta=" + a.h} className="btn g s">{a.t}</Link>)}
        </div>
        {errRango && <p className="alerta">No se pudo calcular el período ({errRango}). Si dice que la función no existe, corre la migración 0066_metricas_rango_renovaciones.sql en Supabase.</p>}
        {rg && (
          <>
            <h3>Del {larga(rg.desde)} al {larga(rg.hasta)}</h3>
            <div className="kp">
              <KpiVer v="registros" t="Registros nuevos" n={rg.registros} s="entraron al registro gratuito" />
              <KpiVer v="pruebas" t="Pruebas VIP canjeadas" n={rg.pruebas} />
              <KpiVer v="vip" t="Pasaron a VIP" n={rg.nuevos_vip} s="por primera vez" />
              <KpiVer v="renovaciones" t="Renovaciones VIP" n={rg.renovaciones} s={rg.renovaron_personas + " personas"} />
              <KpiVer v="vencieron" t="Vencieron" n={rg.vencieron} s={rg.por_vencer ? rg.por_vencer + " vencen en este período (aún no)" : undefined} />
            </div>
            <p className="mu" style={{ margin: "-4px 0 10px" }}>Toca un número para ver quiénes son.</p>
            {ver && (
              <div id="lista" className="box" style={{ marginBottom: 12 }}>
                <h3 style={{ marginTop: 0 }}>{tituloLista} · {filas.length}{filas.length >= 500 ? " (se muestran las primeras 500)" : ""}</h3>
                {filas.length === 0 && <p className="mu">Nadie en este período.</p>}
                {filas.map((f, i) => (
                  <div key={f.id + i} className="ses" style={{ padding: "6px 0", flexWrap: "wrap", gap: 8 }}>
                    <Link href={"/accesos?q=" + encodeURIComponent(f.email)} style={{ flex: 1, minWidth: 180 }}><b>{f.nombre}</b><br /><small className="mu">{f.email}{f.telefono ? " · " + f.telefono : ""}</small></Link>
                    <small className="mu" style={{ textAlign: "right" }}>{larga(new Date(new Date(f.fecha).getTime() - 3 * 3600000).toISOString().slice(0, 10))}{f.nota ? <><br />{f.nota}</> : null}</small>
                  </div>
                ))}
              </div>
            )}
            {rg.renovaciones_desde
              ? <p className="mu" style={{ margin: "0 0 10px" }}>Las renovaciones se registran desde el {larga(new Date(new Date(rg.renovaciones_desde).getTime() - 3 * 3600000).toISOString().slice(0, 10))}; antes de esa fecha no hay dato.</p>
              : <p className="mu" style={{ margin: "0 0 10px" }}>Las renovaciones empiezan a contarse desde que se corrió la migración 0066 (aún no hay ninguna).</p>}
            <div className="kp">
              <Kpi t="Personas activas" v={rg.actividad_desde ? rg.activos : "—"} s={rg.actividad_desde ? "datos desde el " + larga(rg.actividad_desde) : "sin datos de actividad"} />
              <Kpi t="Lecciones completadas" v={rg.lecciones} s={rg.alumnos_estudian + " personas estudiando"} />
              <Kpi t="Exámenes" v={rg.examenes} s={pct(rg.examenes_aprobados, rg.examenes) + " aprobados"} />
              <Kpi t="Certificados emitidos" v={rg.certificados} />
              <Kpi t="Comunidad" v={rg.publicaciones} s={rg.respuestas + " respuestas · " + rg.dudas + " dudas en lecciones"} />
            </div>
            {rg.registros_dia.length > 1 && (
              <>
                <h3>Registros nuevos por día</h3>
                <Barras alto={90} datos={rg.registros_dia.map((d) => ({ k: corto(d.dia), v: d.n }))} etiqueta={(d, i) => (i % Math.max(1, Math.round(rg!.registros_dia.length / 8)) === 0 ? d.k : null)} />
              </>
            )}
          </>
        )}
      </section>

      <h2 style={{ marginTop: 24 }}>Resumen general (últimos 30 días)</h2>

      {m && (
        <>
          <section className="box">
            <h2>Actividad en la plataforma</h2>
            {sinDatos
              ? <p className="mu">Todavía no hay datos. La actividad (visitas por hora, sección y día) empieza a registrarse desde que se publicó esta versión; en unas horas ya verás los primeros números.</p>
              : <p className="mu" style={{ margin: "0 0 10px" }}>Registrando desde el {corto(m.actividad_desde!)} ({dias} {dias === 1 ? "día" : "días"} de datos).</p>}
            <div className="kp">
              <Kpi t="Activos hoy" v={m.hoy} s={"ayer: " + m.ayer} />
              <Kpi t="Activos 7 días" v={m.d7} />
              <Kpi t="Activos 30 días" v={m.d30} />
              <Kpi t="Hora de más actividad" v={horaTop && horaTop.vistas > 0 ? String(horaTop.hora).padStart(2, "0") + ":00" : "—"} s={horaTop && horaTop.vistas > 0 ? horaTop.usuarios + " personas distintas" : undefined} />
              <Kpi t="Día más activo" v={diaTop && diaTop.usuarios > 0 ? DIAS[diaTop.dow] : "—"} />
            </div>
            <h3>Personas activas por día (30 días)</h3>
            <Barras datos={m.por_dia.map((d) => ({ k: corto(d.dia), v: d.n }))} etiqueta={(d, i) => (i % 5 === 0 ? d.k : null)} />
            <h3>Actividad por hora del día (vistas, últimos 30 días)</h3>
            <Barras datos={m.por_hora.map((d) => ({ k: String(d.hora) + "h", v: Number(d.vistas), sub: d.usuarios + " personas" }))} etiqueta={(d, i) => (i % 3 === 0 ? d.k : null)} />
            <h3>Por día de la semana (personas activas)</h3>
            <Barras alto={90} datos={[1, 2, 3, 4, 5, 6, 0].map((g) => { const x = m.por_semana.find((s) => s.dow === g); return { k: DIAS[g].slice(0, 3), v: x?.usuarios ?? 0 }; })} />
          </section>

          <section className="box">
            <h2>Qué usan</h2>
            {m.secciones.length === 0 && <p className="mu">Sin datos todavía.</p>}
            {m.secciones.map((s) => (
              <div key={s.seccion} className="ses" style={{ padding: "6px 0" }}>
                <b style={{ width: 120 }}>{SEC[s.seccion] ?? s.seccion}</b>
                <div style={{ flex: 1, background: "var(--bg2, rgba(255,255,255,.06))", borderRadius: 4, height: 10 }}><div style={{ width: Math.round((s.vistas / m.secciones[0].vistas) * 100) + "%", height: "100%", background: "var(--ac)", borderRadius: 4 }} /></div>
                <small className="mu" style={{ width: 150, textAlign: "right" }}>{s.vistas} vistas · {s.usuarios} personas</small>
              </div>
            ))}
            <h3>Los más activos (30 días)</h3>
            {m.top_usuarios.length === 0 && <p className="mu">Sin datos todavía.</p>}
            {m.top_usuarios.map((u, i) => <div key={u.id} className="ses" style={{ padding: "5px 0" }}><b style={{ width: 26 }}>{i + 1}</b><span style={{ flex: 1 }}>{u.nombre}</span><small className="mu">{u.dias} días · {u.vistas} vistas</small></div>)}
          </section>

          <section className="box">
            <h2>Membresías</h2>
            <div className="kp">
              <Kpi t="Personas (sin admins)" v={m.tipos.total} />
              <Kpi t="VIP vigentes" v={m.tipos.vip} s={pct(m.tipos.vip, m.tipos.total)} />
              <Kpi t="En prueba VIP" v={m.tipos.prueba} />
              <Kpi t="Gratuito alumno" v={m.tipos.alumno} s="fueron VIP / ex alumnos" />
              <Kpi t="Gratuito nuevo" v={m.tipos.nuevo} />
            </div>
            <div className="kp" style={{ marginBottom: 0 }}>
              <Kpi t="Pasaron a VIP (30 días)" v={m.nuevos_vip_30} />
              <Kpi t="Por vencer (7 días)" v={m.por_vencer_7} />
              <Kpi t="Vencieron (30 días)" v={m.vencidos_30} />
              <Kpi t="VIP sin entrar hace 14 días" v={sinDatos ? "—" : m.vip_sin_actividad_14} s={sinDatos ? "disponible con más datos" : "riesgo de no renovar"} />
              <Kpi t="Registros hoy" v={m.registros_hoy} s={m.registros_30 + " en 30 días"} />
            </div>
            <h3>Registros nuevos por día (30 días)</h3>
            <Barras alto={90} datos={m.registros_dia.map((d) => ({ k: corto(d.dia), v: d.n }))} etiqueta={(d, i) => (i % 5 === 0 ? d.k : null)} />
          </section>

          <section className="box">
            <h2>Estudio y comunidad (30 días)</h2>
            <div className="kp">
              <Kpi t="Lecciones completadas" v={m.lecciones_30} s={m.alumnos_estudian_30 + " personas estudiando"} />
              <Kpi t="Exámenes" v={m.examenes_30.intentos} s={pct(m.examenes_30.aprobados, m.examenes_30.intentos) + " aprobados"} />
              <Kpi t="Certificados emitidos" v={m.certificados_30} />
              <Kpi t="Publicaciones" v={m.publicaciones_30} s={m.respuestas_30 + " respuestas"} />
              <Kpi t="Dudas en lecciones" v={m.dudas_30} s={m.dudas_sin_responder + " sin responder"} />
            </div>
            {m.top_cursos.length > 0 && <><h3>Cursos con más lecciones completadas</h3>{m.top_cursos.map((c) => <div key={c.curso} className="ses" style={{ padding: "5px 0" }}><span style={{ flex: 1 }}>{c.curso}</span><b>{c.lecciones}</b></div>)}</>}
            <h3>Pendientes del equipo</h3>
            <div className="kp" style={{ marginBottom: 0 }}>
              <Kpi t="Visitas por aprobar" v={m.visitas_pendientes} />
              <Kpi t="Cuentas de Liquid por revisar" v={m.liquid_pendientes} s={m.liquid_aprobadas + " aprobadas"} />
              <Kpi t="Dudas sin responder" v={m.dudas_sin_responder} />
            </div>
          </section>
        </>
      )}
    </>
  );
}
