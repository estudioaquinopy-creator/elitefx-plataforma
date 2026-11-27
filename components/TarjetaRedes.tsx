import Link from "next/link";
import type { GrupoRedes } from "@/lib/redes";

// Tarjeta de redes sociales en Inicio (debajo del ranking): un botón por cuenta de Instagram ("Síguenos" = ELITE FX, "Sígueme" = Marcos Aquino).
// Sin título, para ocupar poco. Crece (flex: 1) hasta quedar a la altura del final de la columna izquierda de Inicio (el cuadro de brokers),
// con el contenido centrado. Los enlaces se cargan en /redes (solo administradores).
export default function TarjetaRedes({ redes, editar }: { redes: GrupoRedes[]; editar: boolean }) {
  const lista = redes.flatMap((g) => g.items.map((r) => ({ g: g.grupo, ...r })));
  if (lista.length === 0 && !editar) return null;
  return (
    <section className="box" style={{ flex: 1, display: "flex", alignItems: "center", padding: "12px 14px" }}>
      {lista.length === 0 ? (
        <p className="mu" style={{ margin: 0 }}>Todavía no hay redes cargadas. <Link href="/redes" style={{ color: "var(--ac)" }}>+ Agregar redes sociales</Link></p>
      ) : (
        <div style={{ display: "flex", gap: 8, width: "100%", alignItems: "center" }}>
          {lista.map((r) => (
            <a key={r.g + r.nombre} href={r.url} target="_blank" rel="noopener noreferrer" title={"Instagram · " + r.g} aria-label={"Instagram · " + r.g} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 10px", borderRadius: 12, border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)", textDecoration: "none", minWidth: 0 }}>
              <span style={{ flex: "none", width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#6a2cff 0%,#d62976 50%,#fa7e1e 100%)" }}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.3" cy="6.7" r=".6" fill="#fff" />
                </svg>
              </span>
              <b style={{ fontSize: 14, whiteSpace: "nowrap" }}>{r.g === "Marcos Aquino" ? "Sígueme" : "Síguenos"}</b>
            </a>
          ))}
          {editar && <Link href="/redes" title="Editar redes" aria-label="Editar redes" className="mu" style={{ flex: "none", padding: "4px 6px", textDecoration: "none", fontSize: 15 }}>✎</Link>}
        </div>
      )}
    </section>
  );
}
