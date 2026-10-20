"use client";
import { useRef, useState } from "react";

const EMOJIS = ["😀", "😂", "😍", "🔥", "💪", "🎯", "📈", "📉", "💰", "🚀", "✅", "👏", "🙌", "👍", "🤔", "😎", "🏆", "⚡"];

// Cuadro de texto con selector de emoticones desplegable (compacto).
export default function CajaTexto({ name, rows = 3, placeholder, required = false, maxLength = 2000, autoFocus = false }: { name: string; rows?: number; placeholder?: string; required?: boolean; maxLength?: number; autoFocus?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [emo, setEmo] = useState(false);
  function poner(e: string) {
    const t = ref.current; if (!t) return;
    const a = t.selectionStart ?? t.value.length, b = t.selectionEnd ?? a;
    t.value = t.value.slice(0, a) + e + t.value.slice(b);
    t.focus(); t.selectionStart = t.selectionEnd = a + e.length;
  }
  return (
    <div className="cajat">
      <textarea ref={ref} name={name} rows={rows} placeholder={placeholder} required={required} maxLength={maxLength} autoFocus={autoFocus} />
      <button type="button" className="emot" onClick={() => setEmo(!emo)} aria-label="Emoticones" aria-expanded={emo}>😊</button>
      {emo && (
        <div className="emo" aria-label="Emoticones">
          {EMOJIS.map((e) => <button type="button" key={e} onClick={() => poner(e)} aria-label={"Insertar " + e}>{e}</button>)}
        </div>
      )}
    </div>
  );
}
