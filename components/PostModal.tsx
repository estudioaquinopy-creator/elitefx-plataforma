"use client";
import { useEffect, useRef } from "react";

// Vista previa de una publicación; al tocarla se abre completa en una caja dentro de la página.
export default function PostModal({ id, vista, children }: { id: string; vista: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const abrir = () => { const d = ref.current; if (d && !d.open) { d.showModal(); history.replaceState(null, "", "#p" + id); } };
  const cerrar = () => { ref.current?.close(); };
  useEffect(() => {
    if (location.hash === "#p" + id) abrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return (
    <>
      <div id={"p" + id} className="pv" role="button" tabIndex={0} onClick={abrir} onKeyDown={(e) => { if (e.key === "Enter") abrir(); }}>
        {vista}
      </div>
      <dialog
        ref={ref}
        className="pm"
        onClick={(e) => { if (e.target === ref.current) cerrar(); }}
        onClose={() => history.replaceState(null, "", location.pathname + location.search)}
      >
        <button type="button" className="pm-x" onClick={cerrar} aria-label="Cerrar">✕</button>
        {children}
      </dialog>
    </>
  );
}
