import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fecha = (f: string) => { const [y, m, d] = f.split("-").map(Number); return d + " de " + MESES[m - 1] + " de " + y; };

// Página pública: comprueba que un código de certificado de ELITE FX es auténtico.
export default async function Verificar({ searchParams }: { searchParams: { c?: string } }) {
  const codigo = (searchParams.c ?? "").trim().toUpperCase().slice(0, 20);
  let res: { nombre: string; curso: string; emitido: string } | null = null;
  let consultado = false;
  if (/^EFX-[A-Z0-9]{8}$/.test(codigo)) {
    consultado = true;
    try {
      const { data } = await createClient().rpc("verificar_certificado", { p_codigo: codigo });
      res = ((data ?? []) as { nombre: string; curso: string; emitido: string }[])[0] ?? null;
    } catch { res = null; }
  } else if (codigo) consultado = true;
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 16px" }}>
      <img src="/logo-elitefx.png" alt="ELITE FX" style={{ width: 160, height: "auto", display: "block", margin: "0 auto 22px" }} />
      <h1 style={{ textAlign: "center" }}>Verificar certificado</h1>
      <p className="sub" style={{ textAlign: "center" }}>Escribe el código que aparece al pie del certificado.</p>
      <form method="get" className="fm">
        <label>Código<input name="c" defaultValue={codigo} placeholder="EFX-XXXXXXXX" maxLength={20} autoComplete="off" required /></label>
        <button className="btn sd">Verificar</button>
      </form>
      {consultado && (res ? (
        <section className="box" style={{ marginTop: 16, borderColor: "var(--ac)" }}>
          <div className="tag" style={{ marginTop: 0 }}>✓ Certificado auténtico</div>
          <h2 style={{ margin: "6px 0" }}>{res.nombre}</h2>
          <p className="mu" style={{ margin: 0 }}>Aprobó el <b>{res.curso}</b> de ELITE FX el {fecha(res.emitido)}.</p>
        </section>
      ) : (
        <p className="alerta" style={{ marginTop: 16 }}>No encontramos ningún certificado con ese código. Revisa que esté bien escrito.</p>
      ))}
    </div>
  );
}
