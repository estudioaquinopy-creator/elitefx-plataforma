"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { borrarMensajeSala, bloquearEnSala } from "@/app/(app)/comunidad/sala/actions";
import { SALA_DESDE, SALA_HASTA, salaAbierta } from "@/lib/sala";

export type MsgSala = { id: string; user_id: string; autor_nombre: string; autor_avatar: string | null; autor_admin: boolean; texto: string; imagen_url: string | null; created_at: string; responde_a?: string | null; resp_nombre?: string | null; resp_texto?: string | null; imagen_path?: string | null; editado_at?: string | null };
export type ReaccionSala = { mensaje_id: string; user_id: string; emoji: string };
const REACCIONES = ["👍", "❤️", "🔥", "😂", "🎯", "🚀"];

const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-PY", { timeZone: "America/Asuncion", hour: "2-digit", minute: "2-digit", hour12: false });
const dia = (iso: string) => new Date(iso).toLocaleDateString("es-PY", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit" });
const EMOJIS = ["😀", "😂", "😅", "😎", "🤔", "😬", "😡", "😢", "👍", "👎", "👏", "🙌", "💪", "🙏", "🤝", "🔥", "🚀", "🎯", "💰", "💵", "📈", "📉", "✅", "❌", "⚠️", "🟢", "🔴", "🟡", "⏰", "👀", "💚", "❤️", "🏆", "🎉", "😴", "🤑", "😱", "🧠", "📊", "🥇"];
const iniciales = (n: string) => (n || "?").split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();

export default function SalaChat({ yo, esAdmin, inicial, reaccionesIni, bloqueado }: { yo: string; esAdmin: boolean; inicial: MsgSala[]; reaccionesIni: ReaccionSala[]; bloqueado: boolean }) {
  const [msgs, setMsgs] = useState<MsgSala[]>(inicial);
  const [reacs, setReacs] = useState<ReaccionSala[]>(reaccionesIni);
  const [respondiendo, setRespondiendo] = useState<MsgSala | null>(null);
  const [menu, setMenu] = useState("");
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [abierta, setAbierta] = useState(salaAbierta());
  const [enVivo, setEnVivo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const cerca = useRef(true);
  const vivoRef = useRef(false);
  const archivo = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const [emojis, setEmojis] = useState(false);

  // Inserta el emoji donde está el cursor.
  function poner(e: string) {
    const a = area.current;
    const ini = a?.selectionStart ?? texto.length, fin = a?.selectionEnd ?? texto.length;
    const nuevo = (texto.slice(0, ini) + e + texto.slice(fin)).slice(0, 500);
    setTexto(nuevo);
    requestAnimationFrame(() => { if (a) { a.focus(); const pos = Math.min(ini + e.length, nuevo.length); a.setSelectionRange(pos, pos); } });
  }

  // Mensajes en tiempo real (y, si la conexión en vivo no está disponible, se vuelve a pedir la lista cada pocos segundos).
  useEffect(() => {
    const sb = createClient();
    const recargar = async () => {
      const { data } = await sb.from("sala_mensajes").select("*").order("created_at", { ascending: false }).limit(200);
      if (data) setMsgs((data as MsgSala[]).reverse());
      const rr = await sb.from("sala_reacciones").select("mensaje_id, user_id, emoji").limit(3000);
      if (rr.data) setReacs(rr.data as ReaccionSala[]);
    };
    const canal = sb.channel("sala-trading")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sala_mensajes" }, (p) => {
        const n = p.new as MsgSala;
        setMsgs((m) => (m.some((x) => x.id === n.id) ? m : [...m, n].slice(-300)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sala_mensajes" }, (p) => {
        const n = p.new as MsgSala;
        setMsgs((m) => m.map((x) => (x.id === n.id ? { ...x, ...n } : x)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "sala_mensajes" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) { setMsgs((m) => m.filter((x) => x.id !== id)); setReacs((r) => r.filter((x) => x.mensaje_id !== id)); }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sala_reacciones" }, (p) => {
        const n = p.new as ReaccionSala;
        setReacs((r) => (r.some((x) => x.mensaje_id === n.mensaje_id && x.user_id === n.user_id && x.emoji === n.emoji) ? r : [...r, n]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "sala_reacciones" }, (p) => {
        const o = p.old as Partial<ReaccionSala>;
        if (o.mensaje_id && o.user_id && o.emoji) setReacs((r) => r.filter((x) => !(x.mensaje_id === o.mensaje_id && x.user_id === o.user_id && x.emoji === o.emoji)));
      })
      .subscribe((estado) => { vivoRef.current = estado === "SUBSCRIBED"; setEnVivo(estado === "SUBSCRIBED"); });
    const t = setInterval(() => { setAbierta(salaAbierta()); setAhoraMs(Date.now()); if (!vivoRef.current) recargar(); }, 5000);
    return () => { clearInterval(t); sb.removeChannel(canal); };
  }, []);

  // Baja al último mensaje si la persona ya estaba abajo.
  useEffect(() => {
    const c = caja.current;
    if (c && cerca.current) c.scrollTop = c.scrollHeight;
  }, [msgs]);

  // Pone o quita mi reacción a un mensaje (se ve al instante y se confirma en la base).
  async function reaccionar(id: string, emoji: string) {
    if (bloqueado || !abierta) return;
    setAbrirReac("");
    const ya = reacs.some((x) => x.mensaje_id === id && x.user_id === yo && x.emoji === emoji);
    const sb = createClient();
    setErr("");
    if (ya) {
      setReacs((r) => r.filter((x) => !(x.mensaje_id === id && x.user_id === yo && x.emoji === emoji)));
      const { error } = await sb.from("sala_reacciones").delete().eq("mensaje_id", id).eq("user_id", yo).eq("emoji", emoji);
      if (error) { setErr(error.message); setReacs((r) => [...r, { mensaje_id: id, user_id: yo, emoji }]); }
    } else {
      setReacs((r) => [...r, { mensaje_id: id, user_id: yo, emoji }]);
      const { error } = await sb.from("sala_reacciones").insert({ mensaje_id: id, user_id: yo, emoji });
      if (error) { setErr(error.message.includes("sala_reacciones") && error.message.includes("does not exist") ? "Las reacciones todavía no están activadas." : error.message); setReacs((r) => r.filter((x) => !(x.mensaje_id === id && x.user_id === yo && x.emoji === emoji))); }
    }
  }

  // Eliminar mi mensaje (solo durante el primer minuto) y editarlo (hasta 5 minutos).
  async function eliminarMio(m: MsgSala) {
    if (!window.confirm("¿Eliminar tu mensaje?")) return;
    setErr("");
    const sb = createClient();
    const { data, error } = await sb.from("sala_mensajes").delete().eq("id", m.id).select("id");
    if (error) { setErr(error.message); return; }
    if (!data || data.length === 0) { setErr("Ya pasó más de un minuto: este mensaje ya no se puede eliminar."); return; }
    setMsgs((x) => x.filter((y) => y.id !== m.id));
    if (m.imagen_path) await sb.storage.from("sala").remove([m.imagen_path]);
  }
  async function guardarEdicion() {
    if (!editando) return;
    setErr("");
    const sb = createClient();
    const { data, error } = await sb.from("sala_mensajes").update({ texto: editando.texto }).eq("id", editando.id).select("*").single();
    if (error) { setErr(error.message.includes("0 rows") || error.message.includes("coerce") ? "Ya pasaron más de 5 minutos: este mensaje ya no se puede editar." : error.message); return; }
    if (data) setMsgs((m) => m.map((x) => (x.id === editando.id ? { ...x, ...(data as MsgSala) } : x)));
    setEditando(null);
  }

  function irA(id: string) {
    const el = document.getElementById("sala-" + id);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.style.transition = "background .3s"; el.style.background = "rgba(0,212,122,.18)";
    setTimeout(() => { el.style.background = ""; }, 1200);
  }

  async function enviar() {
    if (enviando || bloqueado || !abierta) return;
    const t = texto.trim();
    if (!t && !foto) return;
    setErr(""); setEnviando(true);
    const sb = createClient();
    let url: string | null = null, path: string | null = null;
    if (foto) {
      if (!TIPOS.includes(foto.type)) { setErr("La imagen debe ser JPG, PNG, WEBP o GIF."); setEnviando(false); return; }
      if (foto.size > 5 * 1024 * 1024) { setErr("La imagen pesa más de 5 MB."); setEnviando(false); return; }
      const ext = (foto.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      path = yo + "/" + crypto.randomUUID() + "." + ext;
      const up = await sb.storage.from("sala").upload(path, foto, { contentType: foto.type });
      if (up.error) { setErr("No se pudo subir la imagen: " + up.error.message); setEnviando(false); return; }
      url = sb.storage.from("sala").getPublicUrl(path).data.publicUrl;
    }
    const { data, error } = await sb.from("sala_mensajes").insert({ user_id: yo, texto: t, imagen_url: url, imagen_path: path, ...(respondiendo ? { responde_a: respondiendo.id } : {}) }).select("*").single();
    if (error) {
      setErr(error.message.includes("sala_mensajes") && error.message.includes("does not exist") ? "La sala todavía no está activada." : error.message);
      if (path) await sb.storage.from("sala").remove([path]);
    } else if (data) {
      cerca.current = true;
      setMsgs((m) => (m.some((x) => x.id === (data as MsgSala).id) ? m : [...m, data as MsgSala]));
      setTexto(""); setFoto(null); setRespondiendo(null);
      if (archivo.current) archivo.current.value = "";
    }
    setEnviando(false);
  }

  const deshabilitado = bloqueado || !abierta;
  let ultimoDia = "";
  return (
    <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--bd)", borderRadius: 14, background: "var(--sf)", overflow: "hidden" }}>
      <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--bd)", display: "flex", justifyContent: "space-between", fontSize: 13 }} className="mu">
        <span>● {abierta ? "Sala abierta" : "Sala cerrada"} · {SALA_DESDE} a {SALA_HASTA} (hora de Paraguay)</span>
        <span>{enVivo ? "En vivo" : "Conectando…"}</span>
      </div>
      <div
        ref={caja}
        onScroll={(e) => { const c = e.currentTarget; cerca.current = c.scrollHeight - c.scrollTop - c.clientHeight < 80; }}
        style={{ height: "58vh", minHeight: 320, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
      >
        {msgs.length === 0 && <p className="mu" style={{ margin: "auto", textAlign: "center" }}>Todavía no hay mensajes en las últimas 24 horas. ¡Escribe el primero!</p>}
        {msgs.map((m) => {
          const d = dia(m.created_at);
          const sep = d !== ultimoDia ? d : "";
          ultimoDia = d;
          const mio = m.user_id === yo;
          return (
            <div key={m.id} id={"sala-" + m.id} style={{ borderRadius: 10 }}>
              {sep && <div className="mu" style={{ textAlign: "center", fontSize: 12, margin: "4px 0 8px" }}>{sep === dia(new Date().toISOString()) ? "Hoy" : sep}</div>}
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: mio ? "row-reverse" : "row" }}>
                {m.autor_avatar
                  ? <img src={m.autor_avatar} alt="" width={34} height={34} style={{ borderRadius: "50%", objectFit: "cover", flex: "none" }} />
                  : <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--sf2)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{iniciales(m.autor_nombre)}</span>}
                <div style={{ maxWidth: "78%", background: mio ? "rgba(0,212,122,.16)" : "var(--sf2)", borderRadius: 12, padding: "8px 12px" }}>
                  <div style={{ fontSize: 12, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    <b>{m.autor_nombre || "Miembro"}</b>
                    {m.autor_admin && <span style={{ marginLeft: 6, color: "var(--go)", fontWeight: 700 }}>Educador</span>}
                    <span className="mu" style={{ marginLeft: 8 }}>{hora(m.created_at)}{m.editado_at ? " · editado" : ""}</span>
                    <button type="button" className="mu" aria-label="Opciones" onClick={() => setMenu(menu === m.id ? "" : m.id)} style={{ marginLeft: "auto", border: 0, background: "transparent", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px", opacity: .6 }}>⋯</button>
                  </div>
                  {m.resp_nombre && (
                    <div
                      onClick={() => m.responde_a && irA(m.responde_a)}
                      style={{ borderLeft: "3px solid var(--ac)", background: "rgba(255,255,255,.05)", borderRadius: 6, padding: "4px 8px", margin: "2px 0 6px", fontSize: 12, cursor: m.responde_a ? "pointer" : "default" }}
                    >
                      <b>{m.resp_nombre}</b>
                      <div className="mu" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 360 }}>{m.resp_texto}</div>
                    </div>
                  )}
                  {editando?.id === m.id ? (
                    <div>
                      <textarea value={editando.texto} onChange={(e) => setEditando({ id: m.id, texto: e.target.value })} rows={2} maxLength={500} autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); guardarEdicion(); } if (e.key === "Escape") setEditando(null); }}
                        style={{ width: "100%", minWidth: 220, resize: "none", margin: 0 }} />
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button type="button" className="btn s" style={{ fontSize: 12, padding: "2px 10px", minHeight: 0, width: "auto", margin: 0 }} onClick={guardarEdicion}>Guardar</button>
                        <button type="button" className="btn g s" style={{ fontSize: 12, padding: "2px 10px", minHeight: 0, width: "auto", margin: 0 }} onClick={() => setEditando(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (m.texto && <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.texto}</div>)}
                  {m.imagen_url && <a href={m.imagen_url} target="_blank" rel="noopener noreferrer"><img src={m.imagen_url} alt="Imagen enviada" style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 8, marginTop: 6, display: "block" }} /></a>}
                  {(() => {
                    const grupos = REACCIONES.map((e) => ({ e, n: reacs.filter((x) => x.mensaje_id === m.id && x.emoji === e).length, yo: reacs.some((x) => x.mensaje_id === m.id && x.emoji === e && x.user_id === yo) })).filter((g) => g.n > 0);
                    const puedeEditar = mio && ahoraMs - new Date(m.created_at).getTime() < 5 * 60000 && (m.texto || !m.imagen_url) && editando?.id !== m.id;
                    const puedeBorrarMio = mio && ahoraMs - new Date(m.created_at).getTime() < 60000;
                    const itemSt = { display: "block", width: "100%", textAlign: "left" as const, fontSize: 13, border: 0, background: "transparent", color: "var(--tx)", cursor: "pointer", padding: "6px 10px", borderRadius: 6, margin: 0 };
                    return (
                      <>
                        {grupos.length > 0 && (
                          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                            {grupos.map((g) => (
                              <button key={g.e} type="button" onClick={() => reaccionar(m.id, g.e)} disabled={deshabilitado}
                                style={{ fontSize: 13, padding: "1px 8px", borderRadius: 999, border: "1px solid " + (g.yo ? "var(--ac)" : "var(--bd)"), background: g.yo ? "rgba(0,212,122,.18)" : "transparent", color: "var(--tx)", cursor: "pointer" }}>
                                {g.e} {g.n}
                              </button>
                            ))}
                          </div>
                        )}
                        {menu === m.id && (
                          <div style={{ marginTop: 6, padding: 4, border: "1px solid var(--bd)", borderRadius: 10, background: "var(--sf)", minWidth: 180 }}>
                            {!deshabilitado && (
                              <div style={{ display: "flex", gap: 2, padding: "2px 4px", flexWrap: "wrap" }}>
                                {REACCIONES.map((e) => <button key={e} type="button" onClick={() => { reaccionar(m.id, e); setMenu(""); }} style={{ fontSize: 18, border: 0, background: "transparent", cursor: "pointer", padding: 2 }} aria-label={e}>{e}</button>)}
                              </div>
                            )}
                            {!deshabilitado && <button type="button" style={itemSt} onClick={() => { setRespondiendo(m); setMenu(""); area.current?.focus(); }}>Responder</button>}
                            {puedeEditar && <button type="button" style={itemSt} onClick={() => { setEditando({ id: m.id, texto: m.texto }); setMenu(""); }}>Editar</button>}
                            {esAdmin ? (
                              <form action={async (f) => { await borrarMensajeSala(f); setMsgs((x) => x.filter((y) => y.id !== m.id)); setMenu(""); }}>
                                <input type="hidden" name="id" value={m.id} />
                                <button style={itemSt}>Eliminar</button>
                              </form>
                            ) : (puedeBorrarMio && <button type="button" style={itemSt} onClick={() => { setMenu(""); eliminarMio(m); }}>Eliminar</button>)}
                            {esAdmin && !mio && (
                              <form action={bloquearEnSala} style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 10px" }} onSubmit={(e) => { if (!window.confirm("¿Bloquear a " + (m.autor_nombre || "esta persona") + " en el chat?")) e.preventDefault(); }}>
                                <input type="hidden" name="user" value={m.user_id} />
                                <select name="horas" defaultValue="24" style={{ fontSize: 12, padding: "2px 4px", minHeight: 0, width: "auto", margin: 0 }}>
                                  <option value="1">1 hora</option><option value="24">24 horas</option><option value="168">7 días</option><option value="0">Permanente</option>
                                </select>
                                <button className="btn g s" style={{ fontSize: 12, padding: "2px 8px", minHeight: 0, width: "auto", margin: 0 }}>Bloquear</button>
                              </form>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ borderTop: "1px solid var(--bd)", padding: 12 }}>
        {err && <p className="alerta" style={{ margin: "0 0 8px" }}>{err}</p>}
        {bloqueado && <p className="alerta" style={{ margin: "0 0 8px" }}>Un administrador te bloqueó en el chat en vivo. Puedes leer, pero no escribir.</p>}
        {!bloqueado && !abierta && <p className="mu" style={{ margin: "0 0 8px" }}>La sala está cerrada. Abre todos los días a las {SALA_DESDE} y cierra a las {SALA_HASTA} (hora de Paraguay).</p>}
        {respondiendo && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", borderLeft: "3px solid var(--ac)", background: "var(--sf2)", borderRadius: 8, padding: "6px 10px", margin: "0 0 8px", fontSize: 13 }}>
            <div style={{ minWidth: 0 }}>
              <b>Respondiendo a {respondiendo.autor_nombre || "Miembro"}</b>
              <div className="mu" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{respondiendo.texto || "📷 Imagen"}</div>
            </div>
            <button type="button" onClick={() => setRespondiendo(null)} style={{ border: 0, background: "transparent", color: "var(--tx)", cursor: "pointer", fontSize: 16 }} aria-label="Cancelar respuesta">✕</button>
          </div>
        )}
        {foto && <p className="mu" style={{ margin: "0 0 8px" }}>📎 {foto.name} <button type="button" className="btn g s" style={{ fontSize: 11, padding: "2px 8px", minHeight: 0 }} onClick={() => { setFoto(null); if (archivo.current) archivo.current.value = ""; }}>Quitar</button></p>}
        {emojis && !deshabilitado && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 8, marginBottom: 8, border: "1px solid var(--bd)", borderRadius: 12, background: "var(--sf2)" }}>
            {EMOJIS.map((e) => <button key={e} type="button" onClick={() => poner(e)} style={{ fontSize: 22, lineHeight: 1, padding: 6, border: 0, background: "transparent", cursor: "pointer" }} aria-label={e}>{e}</button>)}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <label className="btn g s" style={{ cursor: deshabilitado ? "not-allowed" : "pointer", opacity: deshabilitado ? 0.5 : 1, margin: 0, flex: "none", width: "auto", height: 44, display: "grid", placeItems: "center" }} title="Enviar una imagen o un gráfico">
            📷
            <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} disabled={deshabilitado} onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" className="btn g s" style={{ margin: 0, flex: "none", width: "auto", height: 44 }} disabled={deshabilitado} onClick={() => setEmojis((v) => !v)} title="Emojis" aria-label="Emojis">😀</button>
          <textarea
            ref={area}
            value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={500} disabled={deshabilitado}
            placeholder={deshabilitado ? "No puedes escribir ahora" : "Escribe un mensaje…"}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            style={{ flex: "1 1 auto", minWidth: 0, width: "auto", resize: "none", minHeight: 44, maxHeight: 140, margin: 0 }}
          />
          <button type="button" className="btn s" onClick={enviar} disabled={deshabilitado || enviando} style={{ margin: 0, flex: "none", width: "auto", minWidth: 0, padding: "0 18px", height: 44 }}>{enviando ? "…" : "Enviar"}</button>
        </div>
      </div>
    </div>
  );
}
