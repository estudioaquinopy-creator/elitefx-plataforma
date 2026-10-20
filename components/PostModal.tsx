"use client";
import { useEffect, useRef, useState, useTransition } from "react";

type Resp = { ok: boolean; mio: boolean; n: number; error?: string };

// Publicación: vista previa con miniatura y me gusta; al tocarla se abre completa en una caja dentro de la página.
export default function PostModal({ id, vista, detalle, extras, respuestas, nl, mio, nc, puedeLike, alternar }: {
  id: string; vista: React.ReactNode; detalle: React.ReactNode; extras: React.ReactNode; respuestas: React.ReactNode;
  nl: number; mio: boolean; nc: number; puedeLike: boolean; alternar: (postId: string) => Promise<Resp>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [n, setN] = useState(nl);
  const [yo, setYo] = useState(mio);
  const [err, setErr] = useState("");
  const [, iniciar] = useTransition();

  const abrir = () => { const d = ref.current; if (d && !d.open) { d.showModal(); history.replaceState(null, "", "#p" + id); } };
  const cerrar = () => { ref.current?.close(); };
  useEffect(() => { if (location.hash === "#p" + id) abrir(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  function like(e: React.MouseEvent) {
    e.stopPropagation();
    if (!puedeLike) { setErr("Solo los miembros pueden dar me gusta."); return; }
    setErr("");
    const antes = { n, yo };
    setYo(!yo); setN(yo ? n - 1 : n + 1); // respuesta inmediata
    iniciar(async () => {
      try {
        const r = await alternar(id);
        if (r.ok) { setYo(r.mio); setN(r.n); }
        else { setYo(antes.yo); setN(antes.n); setErr(r.error || "No se pudo dar me gusta."); }
      } catch { setYo(antes.yo); setN(antes.n); setErr("No se pudo dar me gusta. Intenta de nuevo."); }
    });
  }
  const boton = (
    <button type="button" className={"lkb" + (yo ? " on" : "")} aria-pressed={yo} onClick={like}>{yo ? "♥" : "♡"} {n > 0 ? n : ""} Me gusta</button>
  );

  return (
    <>
      <div id={"p" + id} className="pv" role="button" tabIndex={0} onClick={abrir} onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) abrir(); }}>
        {vista}
        <div className="pv-acc">
          {boton}
          <span className="mu">💬 {nc}</span>
          {err && <small className="lkerr">{err}</small>}
        </div>
      </div>
      <dialog ref={ref} className="pm" onClick={(e) => { if (e.target === ref.current) cerrar(); }} onClose={() => history.replaceState(null, "", location.pathname + location.search)}>
        <button type="button" className="pm-x" onClick={cerrar} aria-label="Cerrar">✕</button>
        {detalle}
        <div className="acc">
          {boton}
          <span className="mu">💬 {nc} {nc === 1 ? "respuesta" : "respuestas"}</span>
          {err && <small className="lkerr">{err}</small>}
          {extras}
        </div>
        {respuestas}
      </dialog>
    </>
  );
}
