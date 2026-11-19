"use client";
import { useEffect, useRef, useState } from "react";
import { achicar, TIPOS_OK, MAX_IMAGENES, MAX_TOTAL } from "@/lib/imagenCliente";

// Elegir hasta 3 imágenes para un formulario (publicar o responder). Las archivos viajan en el campo `imagenes` del formulario.
// Se agregan de a una (o varias), se ven en miniatura y se pueden quitar. Al reiniciar el formulario se vacía solo.
export default function SelectorImagenes({ max = MAX_IMAGENES, etiqueta = "Imagen", compacto = false }: { max?: number; etiqueta?: string; compacto?: boolean }) {
  const destino = useRef<HTMLInputElement>(null); // el que lleva el nombre `imagenes` (con los archivos ya preparados)
  const [lista, setLista] = useState<{ f: File; url: string }[]>([]);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const actual = useRef(lista);
  actual.current = lista;

  function volcar(l: { f: File }[]) {
    const dt = new DataTransfer();
    l.forEach((x) => dt.items.add(x.f));
    if (destino.current) destino.current.files = dt.files;
  }
  function vaciar() { actual.current.forEach((x) => URL.revokeObjectURL(x.url)); setLista([]); setAviso(""); }

  // Cuando el formulario se reinicia (después de publicar o responder), se limpian las miniaturas.
  useEffect(() => {
    const form = destino.current?.form;
    if (!form) return;
    const h = () => vaciar();
    form.addEventListener("reset", h);
    return () => form.removeEventListener("reset", h);
  }, []);
  useEffect(() => () => { actual.current.forEach((x) => URL.revokeObjectURL(x.url)); }, []);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const inp = e.target;
    const nuevos = Array.from(inp.files ?? []);
    inp.value = "";
    if (!nuevos.length) return;
    setAviso(""); setOcupado(true);
    let l = [...actual.current];
    for (const f0 of nuevos) {
      if (l.length >= max) { setAviso("Máximo " + max + " imágenes."); break; }
      let f = await achicar(f0, 1600, 0.82, 200 * 1024);
      if (f.size > 1.2 * 1024 * 1024) f = await achicar(f, 1280, 0.72, 0);
      if (!TIPOS_OK.includes(f.type) || f.size > 4.5 * 1024 * 1024) { setAviso("⚠ Una imagen no es válida (usa JPG, PNG, WEBP o GIF)."); continue; }
      if (l.reduce((s, x) => s + x.f.size, 0) + f.size > MAX_TOTAL) { setAviso("⚠ Las imágenes pesan demasiado juntas. Usa menos o más livianas."); continue; }
      l = [...l, { f, url: URL.createObjectURL(f) }];
    }
    setLista(l); volcar(l); setOcupado(false);
  }
  function quitar(i: number) {
    const l = actual.current.filter((_, k) => k !== i);
    URL.revokeObjectURL(actual.current[i].url);
    setLista(l); volcar(l); setAviso("");
  }

  return (
    <div className={"selimg" + (compacto ? " compacto" : "")}>
      <input ref={destino} type="file" name="imagenes" multiple hidden tabIndex={-1} aria-hidden="true" />
      <div className="selimg-f">
        {lista.map((x, i) => (
          <span key={x.url} className="selimg-m">
            <img src={x.url} alt={"Imagen " + (i + 1)} />
            <button type="button" onClick={() => quitar(i)} aria-label={"Quitar imagen " + (i + 1)}>✕</button>
          </span>
        ))}
        {lista.length < max && (
          <label className={compacto ? "selimg-ic" : "comp-i selimg-b"} title={"Adjuntar imagen (hasta " + max + ")"} aria-label={"Adjuntar imagen (hasta " + max + ")"}>
            {compacto
              ? <>{ocupado ? <span className="btn-spin" aria-hidden="true" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8" /></svg>}{lista.length > 0 && <small>{lista.length}/{max}</small>}</>
              : <>🖼️ <span>{ocupado ? "Preparando…" : etiqueta + (max > 1 ? " (" + lista.length + "/" + max + ")" : "")}</span></>}
            <input type="file" accept="image/*" multiple={max > 1} hidden disabled={ocupado} onChange={elegir} />
          </label>
        )}
      </div>
      {aviso && <small className="lkerr" role="alert">{aviso}</small>}
    </div>
  );
}
