import Link from "next/link";
import type { GrupoRedes } from "@/lib/redes";

// Tarjeta de redes sociales en Inicio (debajo del ranking): un botón por cuenta de Instagram (ELITE FX y Marcos Aquino).
// Los enlaces se cargan en /redes (solo administradores). Sin enlaces cargados no se muestra nada (el admin ve cómo agregarlos).
export default function TarjetaRedes({ redes, editar }: { redes: GrupoRedes[]; editar: boolean }) {
  const lista = redes.flatMap((g) => g.items.map((r) => ({ g: g.grupo, ...r })));
  if (lista.length === 0 && !editar) return null;
  return (
    <section className="box">
      <div className="hd"><h2>Síguenos en Instagram</h2></div>
      {lista.length === 0 ? (
        <p className="mu" style={{ margin: 0 }}>Todavía no hay redes cargadas. <Link href="/redes" style={{ color: "var(--ac)" }}>+ Agregar redes sociales</Link></p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: lista.length > 1 ? "repeat(auto-fit, minmax(150px, 1fr))" : "1fr", gap: 10 }}>
            {lista.map((r) => (
              <a key={r.g + r.nombre} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)", textDecoration: "none", minWidth: 0 }}>
                <span style={{ flex: "none", width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#6a2cff 0%,#d62976 50%,#fa7e1e 100%)" }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.3" cy="6.7" r=".6" fill="#fff" />
                  </svg>
                </span>
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, minWidth: 0 }}>
                  <small className="mu">{r.g === "Marcos Aquino" ? "Sígueme" : "Síguenos"}</small>
                  <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.g}</b>
                </span>
              </a>
            ))}
          </div>
          {editar && <Link href="/redes" className="mu" style={{ display: "inline-block", marginTop: 10, fontSize: 12 }}>Editar redes</Link>}
        </>
      )}
    </section>
  );
}
