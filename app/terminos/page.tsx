import Link from "next/link";
import TextoTerminos from "@/components/TextoTerminos";

export const metadata = { title: "Términos y condiciones · ELITE FX" };

// Página pública: se puede leer sin iniciar sesión (enlace desde el login y el registro).
export default function Terminos() {
  return (
    <main className="center" style={{ alignItems: "flex-start" }}>
      <div className="card" style={{ maxWidth: 780, width: "100%" }}>
        <div className="logo"><img src="/logo-elitefx.png" alt="ELITE FX · Trading de Alta Precisión" /></div>
        <h1>Términos y condiciones</h1>
        <TextoTerminos />
        <p style={{ textAlign: "center", marginTop: 16 }}><Link href="/login" className="lk">Volver al inicio de sesión</Link></p>
      </div>
    </main>
  );
}
