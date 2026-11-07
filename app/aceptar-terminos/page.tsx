import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { TERMINOS_VERSION } from "@/lib/terminos";
import TextoTerminos from "@/components/TextoTerminos";
import BotonEnvio from "@/components/BotonEnvio";

export const dynamic = "force-dynamic";

async function aceptar(f: FormData) {
  "use server";
  await perfilActual();
  if (String(f.get("acepto") ?? "") !== "on") redirect("/aceptar-terminos?error=" + encodeURIComponent("Marca la casilla para aceptar los términos."));
  const { error } = await createClient().rpc("aceptar_terminos", { p_version: TERMINOS_VERSION });
  if (error) redirect("/aceptar-terminos?error=" + encodeURIComponent("No se pudo guardar tu aceptación: " + error.message));
  redirect("/inicio");
}

// Paso obligatorio: quien aún no aceptó la versión vigente de los términos llega aquí antes de entrar a la plataforma.
export default async function AceptarTerminos({ searchParams }: { searchParams: { error?: string } }) {
  const perfil = await perfilActual();
  const p = perfil as { terminos_version?: string | null };
  if (p.terminos_version === undefined || p.terminos_version === TERMINOS_VERSION) redirect("/inicio");
  return (
    <main className="center" style={{ alignItems: "flex-start", flexDirection: "column" }}>
      <form className="card" action={aceptar} style={{ maxWidth: 780, width: "100%" }}>
        <div className="logo"><img src="/logo-elitefx.png" alt="ELITE FX · Trading de Alta Precisión" /></div>
        <h1>Términos y condiciones</h1>
        <p className="sub">Para seguir usando la plataforma necesitamos que leas y aceptes los términos. Recuerda: todo el contenido es educativo y no es una recomendación de inversión.</p>
        <div style={{ maxHeight: "50vh", overflowY: "auto", padding: "12px 14px", border: "1px solid var(--bd)", borderRadius: 12, marginBottom: 14 }}>
          <TextoTerminos />
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 }}>
          <input type="checkbox" name="acepto" required style={{ width: "auto", marginTop: 3 }} />
          <span>He leído y acepto los términos y condiciones y la <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="lk">política de privacidad</a>, y entiendo que el contenido es educativo y no constituye una recomendación de inversión.</span>
        </label>
        {searchParams.error && <p className="err">{searchParams.error}</p>}
        <BotonEnvio className="btn" enviando="Guardando…">Acepto y continuar</BotonEnvio>
        <p className="mu" style={{ textAlign: "center", marginTop: 12 }}>Si no estás de acuerdo, puedes cerrar sesión.</p>
      </form>
      <form action="/auth/salir" method="post" style={{ textAlign: "center", marginTop: 8 }}>
        <button className="lk" type="submit">Cerrar sesión</button>
      </form>
    </main>
  );
}
