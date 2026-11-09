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

export default async function Metricas() {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin") notFound();
  const sb = createClient();
  const { data, error } = await sb.rpc("metricas_accesos");
  const m = data as M | null;

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
