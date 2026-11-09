import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/sesion";
import { guardarTelefono } from "./actions";

export const dynamic = "force-dynamic";

// Paso obligatorio: quien no tiene teléfono registrado llega aquí antes de entrar a la plataforma.
export default async function Telefono({ searchParams }: { searchParams: { error?: string } }) {
  const perfil = await perfilActual();
  if ((perfil.telefono ?? "").replace(/\D/g, "").length >= 8) redirect("/inicio");
  return (
    <main className="center">
      <div className="card">
        <div className="logo"><img src="/logo-elitefx.png" alt="ELITE FX · Trading de Alta Precisión" /></div>
        <h1>Registra tu número de teléfono</h1>
        <p className="sub">Para seguir usando la plataforma necesitamos tu número de WhatsApp o teléfono, con código de país. Lo usamos solo para contactarte por tu cuenta y tu membresía.</p>
        {searchParams.error && <p className="alerta">{searchParams.error}</p>}
        <form action={guardarTelefono} className="fm">
          <label>Teléfono / WhatsApp<input name="telefono" type="tel" autoComplete="tel" required minLength={8} placeholder="+595 981 123456" /></label>
          <button className="btn sd">Guardar y continuar</button>
        </form>
        <form action="/auth/salir" method="post" style={{ marginTop: 16, textAlign: "center" }}>
          <button className="lk" type="submit">Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
