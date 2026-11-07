"use client";
import { useRef, useState } from "react";
import { buscarMencionables } from "@/app/(app)/comunidad/actions";

const EMOJIS = ["😀", "😂", "😍", "🔥", "💪", "🎯", "📈", "📉", "💰", "🚀", "✅", "👏", "🙌", "👍", "🤔", "😎", "🏆", "⚡"];

// Cuadro de texto con selector de emoticones desplegable (compacto).
export default function CajaTexto({ name, rows = 3, placeholder, required = false, maxLength = 2000, autoFocus = false, defaultValue }: { name: string; rows?: number; placeholder?: string; required?: boolean; maxLength?: number; autoFocus?: boolean; defaultValue?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [emo, setEmo] = useState(false);
  const [sug, setSug] = useState<{ id: string; nombre: string; educador: boolean }[]>([]);
  const seq = useRef(0);
  // Al escribir "@nombre" sugiere educadores y miembros para mencionar.
  async function alEscribir() {
    const t = ref.current; if (!t) return;
    const pos = t.selectionStart ?? t.value.length;
    const m = /(?:^|\s)@([\p{L}'.-]{1,}(?: [\p{L}'.-]*)?)$/u.exec(t.value.slice(0, pos));
    const n = ++seq.current;
    if (!m) { setSug([]); return; }
    try {
      const r = await buscarMencionables(m[1]);
      if (n === seq.current) setSug(r);
    } catch { if (n === seq.current) setSug([]); }
  }
  function mencionar(nombre: string) {
    const t = ref.current; if (!t) return;
    const pos = t.selectionStart ?? t.value.length;
    const antes = t.value.slice(0, pos).replace(/@[^@]*$/, "@" + nombre + " ");
    t.value = antes + t.value.slice(pos);
    t.focus(); t.selectionStart = t.selectionEnd = antes.length;
    setSug([]);
  }
  function poner(e: string) {
    const t = ref.current; if (!t) return;
    const a = t.selectionStart ?? t.value.length, b = t.selectionEnd ?? a;
    t.value = t.value.slice(0, a) + e + t.value.slice(b);
    t.focus(); t.selectionStart = t.selectionEnd = a + e.length;
  }
  return (
    <div className="cajat">
      <textarea ref={ref} name={name} rows={rows} placeholder={placeholder} required={required} maxLength={maxLength} autoFocus={autoFocus} defaultValue={defaultValue} onInput={alEscribir} />
      <button type="button" className="emot" onClick={() => setEmo(!emo)} aria-label="Emoticones" aria-expanded={emo}>😊</button>
      {sug.length > 0 && (
        <div className="menc" role="listbox" aria-label="Mencionar">
          {sug.map((u) => <button type="button" key={u.id} onMouseDown={(e) => { e.preventDefault(); mencionar(u.nombre); }}>{u.nombre}{u.educador && <small> · Educador</small>}</button>)}
        </div>
      )}
      {emo && (
        <div className="emo" aria-label="Emoticones">
          {EMOJIS.map((e) => <button type="button" key={e} onClick={() => poner(e)} aria-label={"Insertar " + e}>{e}</button>)}
        </div>
      )}
    </div>
  );
}
