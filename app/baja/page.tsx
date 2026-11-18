import { tokenBaja } from "@/lib/correos";
import { darDeBaja } from "./actions";

export const dynamic = "force-dynamic";

// Página pública: la persona confirma que no quiere recibir correos masivos de ELITE FX (el enlace va firmado en cada correo).
export default async function Baja({ searchParams }: { searchParams: { e?: string; t?: string; ok?: string } }) {
  const email = (searchParams.e ?? "").trim().toLowerCase();
  const valido = !!email && searchParams.t === tokenBaja(email);
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 16px" }}>
      <img src="/logo-elitefx.png" alt="ELITE FX" style={{ width: 160, height: "auto", display: "block", margin: "0 auto 22px" }} />
      <h1 style={{ textAlign: "center" }}>Dejar de recibir correos</h1>
      {searchParams.ok ? (
        <p className="okmsg" style={{ textAlign: "center" }}>Listo. Ya no te enviaremos correos masivos. Los correos de tu cuenta (como recuperar tu contraseña) seguirán llegando.</p>
      ) : valido ? (
        <form action={darDeBaja} className="fm">
          <p className="sub" style={{ textAlign: "center" }}>¿Quieres dejar de recibir los correos de ELITE FX en <b>{email}</b>?</p>
          <input type="hidden" name="e" value={email} />
          <input type="hidden" name="t" value={searchParams.t} />
          <button className="btn sd">Sí, dejar de recibirlos</button>
        </form>
      ) : (
        <p className="alerta">Este enlace no es válido. Usa el enlace que aparece al pie del correo.</p>
      )}
    </div>
  );
}
