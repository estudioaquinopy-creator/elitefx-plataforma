"use client";
import { useRouter } from "next/navigation";

// Filtro de monedas de Noticias: cada persona elige las que quiere ver y se recuerda en su navegador.
export default function FiltroMonedas({ todas, activas, dia }: { todas: string[]; activas: string[]; dia: string }) {
  const router = useRouter();
  function alternar(m: string) {
    const nuevas = activas.includes(m) ? activas.filter((x) => x !== m) : todas.filter((x) => activas.includes(x) || x === m);
    if (nuevas.length === 0) return; // siempre queda al menos una
    document.cookie = "noticias_monedas=" + nuevas.join(".") + "; path=/; max-age=31536000; samesite=lax";
    router.replace("/noticias" + (dia ? "?d=" + dia : ""));
    router.refresh();
  }
  return (
    <div className="chips" style={{ marginBottom: 12 }} role="group" aria-label="Monedas">
      <span className="mu" style={{ alignSelf: "center", fontSize: 13 }}>Monedas:</span>
      {todas.map((m) => (
        <button key={m} type="button" className={activas.includes(m) ? "chip on" : "chip"} aria-pressed={activas.includes(m)} onClick={() => alternar(m)}>{m}</button>
      ))}
    </div>
  );
}
