"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { borrarMensajeSala, bloquearEnSala } from "@/app/(app)/comunidad/sala/actions";
import { SALA_DESDE, SALA_HASTA, salaAbierta } from "@/lib/sala";

export type MsgSala = { id: string; user_id: string; autor_nombre: string; autor_avatar: string | null; autor_admin: boolean; texto: string; imagen_url: string | null; created_at: string };

const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-PY", { timeZone: "America/Asuncion", hour: "2-digit", minute: "2-digit", hour12: false });
const dia = (iso: string) => new Date(iso).toLocaleDateString("es-PY", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit" });
const EMOJIS = ["😀", "😂", "😅", "😎", "🤔", "😬", "😡", "😢", "👍", "👎", "👏", "🙌", "💪", "🙏", "🤝", "🔥", "🚀", "🎯", "💰", "💵", "📈", "📉", "✅", "❌", "⚠️", "🟢", "🔴", "🟡", "⏰", "👀", "💚", "❤️", "🏆", "🎉", "😴", "🤑", "😱", "🧠", "📊", "🥇"];
const iniciales = (n: string) => (n || "?").split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();

export default function SalaChat({ yo, esAdmin, inicial, bloqueado }: { yo: string; esAdmin: boolean; inicial: MsgSala[]; bloqueado: boolean }) {
  const [msgs, setMsgs] = useState<MsgSala[]>(inicial);
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
    };
    const canal = sb.channel("sala-trading")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sala_mensajes" }, (p) => {
        const n = p.new as MsgSala;
        setMsgs((m) => (m.some((x) => x.id === n.id) ? m : [...m, n].slice(-300)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "sala_mensajes" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) setMsgs((m) => m.filter((x) => x.id !== id));
      })
      .subscribe((estado) => { vivoRef.current = estado === "SUBSCRIBED"; setEnVivo(estado === "SUBSCRIBED"); });
    const t = setInterval(() => { setAbierta(salaAbierta()); if (!vivoRef.current) recargar(); }, 5000);
    return () => { clearInterval(t); sb.removeChannel(canal); };
  }, []);

  // Baja al último mensaje si la persona ya estaba abajo.
  useEffect(() => {
    const c = caja.current;
    if (c && cerca.current) c.scrollTop = c.scrollHeight;
  }, [msgs]);

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
    const { data, error } = await sb.from("sala_mensajes").insert({ user_id: yo, texto: t, imagen_url: url, imagen_path: path }).select("*").single();
    if (error) {
      setErr(error.message.includes("sala_mensajes") && error.message.includes("does not exist") ? "La sala todavía no está activada." : error.message);
      if (path) await sb.storage.from("sala").remove([path]);
    } else if (data) {
      cerca.current = true;
      setMsgs((m) => (m.some((x) => x.id === (data as MsgSala).id) ? m : [...m, data as MsgSala]));
      setTexto(""); setFoto(null);
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
            <div key={m.id}>
              {sep && <div className="mu" style={{ textAlign: "center", fontSize: 12, margin: "4px 0 8px" }}>{sep === dia(new Date().toISOString()) ? "Hoy" : sep}</div>}
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: mio ? "row-reverse" : "row" }}>
                {m.autor_avatar
                  ? <img src={m.autor_avatar} alt="" width={34} height={34} style={{ borderRadius: "50%", objectFit: "cover", flex: "none" }} />
                  : <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--sf2)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{iniciales(m.autor_nombre)}</span>}
                <div style={{ maxWidth: "78%", background: mio ? "rgba(0,212,122,.16)" : "var(--sf2)", borderRadius: 12, padding: "8px 12px" }}>
                  <div style={{ fontSize: 12, marginBottom: 2 }}>
                    <b>{m.autor_nombre || "Miembro"}</b>
                    {m.autor_admin && <span style={{ marginLeft: 6, color: "var(--go)", fontWeight: 700 }}>Educador</span>}
                    <span className="mu" style={{ marginLeft: 8 }}>{hora(m.created_at)}</span>
                  </div>
                  {m.texto && <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.texto}</div>}
                  {m.imagen_url && <a href={m.imagen_url} target="_blank" rel="noopener noreferrer"><img src={m.imagen_url} alt="Imagen enviada" style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 8, marginTop: 6, display: "block" }} /></a>}
                  {esAdmin && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <form action={async (f) => { await borrarMensajeSala(f); setMsgs((x) => x.filter((y) => y.id !== m.id)); }}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="btn g s" style={{ fontSize: 11, padding: "2px 8px", minHeight: 0 }}>Eliminar</button>
                      </form>
                      {!mio && (
                        <form action={bloquearEnSala} style={{ display: "flex", gap: 4 }} onSubmit={(e) => { if (!window.confirm("¿Bloquear a " + (m.autor_nombre || "esta persona") + " en la sala?")) e.preventDefault(); }}>
                          <input type="hidden" name="user" value={m.user_id} />
                          <select name="horas" defaultValue="24" style={{ fontSize: 11, padding: "2px 4px", minHeight: 0 }}>
                            <option value="1">1 hora</option><option value="24">24 horas</option><option value="168">7 días</option><option value="0">Permanente</option>
                          </select>
                          <button className="btn g s" style={{ fontSize: 11, padding: "2px 8px", minHeight: 0 }}>Bloquear</button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ borderTop: "1px solid var(--bd)", padding: 12 }}>
        {err && <p className="alerta" style={{ margin: "0 0 8px" }}>{err}</p>}
        {bloqueado && <p className="alerta" style={{ margin: "0 0 8px" }}>Un administrador te bloqueó en la sala de trading. Puedes leer, pero no escribir.</p>}
        {!bloqueado && !abierta && <p className="mu" style={{ margin: "0 0 8px" }}>La sala está cerrada. Abre todos los días a las {SALA_DESDE} y cierra a las {SALA_HASTA} (hora de Paraguay).</p>}
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
