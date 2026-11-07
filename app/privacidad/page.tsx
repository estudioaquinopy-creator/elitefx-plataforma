import Link from "next/link";
import { TextoLegal } from "@/components/TextoTerminos";
import { SECCIONES_PRIVACIDAD, PRIVACIDAD_FECHA } from "@/lib/privacidad";

export const metadata = { title: "Política de privacidad · ELITE FX" };

// Página pública: se puede leer sin iniciar sesión (enlace desde el login, el registro y los términos).
export default function Privacidad() {
  return (
    <main className="center" style={{ alignItems: "flex-start" }}>
      <div className="card" style={{ maxWidth: 780, width: "100%" }}>
        <div className="logo"><img src="/logo-elitefx.png" alt="ELITE FX · Trading de Alta Precisión" /></div>
        <h1>Política de privacidad</h1>
        <TextoLegal secciones={SECCIONES_PRIVACIDAD} fecha={PRIVACIDAD_FECHA} />
        <p style={{ textAlign: "center", marginTop: 16 }}><Link href="/terminos" className="lk">Términos y condiciones</Link> · <Link href="/login" className="lk">Volver al inicio de sesión</Link></p>
      </div>
    </main>
  );
}
