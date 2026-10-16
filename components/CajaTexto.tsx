"use client";
import { useRef } from "react";

const EMOJIS = ["😀", "😂", "😍", "🔥", "💪", "🎯", "📈", "📉", "💰", "🚀", "✅", "👏", "🙌", "👍", "🤔", "😎", "🏆", "⚡"];

// Cuadro de texto con selector de emoticones.
export default function CajaTexto({ name, rows = 4, placeholder, required = false, maxLength = 2000 }: { name: string; rows?: number; placeholder?: string; required?: boolean; maxLength?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function poner(e: string) {
    const t = ref.current; if (!t) return;
    const a = t.selectionStart ?? t.value.length, b = t.selectionEnd ?? a;
    t.value = t.value.slice(0, a) + e + t.value.slice(b);
    t.focus(); t.selectionStart = t.selectionEnd = a + e.length;
  }
  return (
    <div className="cajat">
      <textarea ref={ref} name={name} rows={rows} placeholder={placeholder} required={required} maxLength={maxLength} />
      <div className="emo" aria-label="Emoticones">
        {EMOJIS.map((e) => <button type="button" key={e} onClick={() => poner(e)} aria-label={"Insertar " + e}>{e}</button>)}
      </div>
    </div>
  );
}
