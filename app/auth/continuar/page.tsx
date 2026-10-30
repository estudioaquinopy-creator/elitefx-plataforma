import Tema from "@/components/Tema";

export const dynamic = "force-dynamic";

// Página intermedia del enlace del correo: el código se canjea solo al pulsar el botón.
export default function Continuar({ searchParams }: { searchParams: { token_hash?: string; type?: string } }) {
  const token = searchParams.token_hash ?? "";
  const type = searchParams.type ?? "";
  return (
    <main className="center">
      <div style={{ position: "fixed", top: 16, right: 16 }}><Tema /></div>
      <form className="card" method="post" action="/auth/confirmar">
        <div className="logo"><img src="/logo-elitefx.png" alt="ELITE FX · Trading de Alta Precisión" /></div>
        <h1>{type === "invite" ? "Activa tu cuenta" : "Elige tu contraseña nueva"}</h1>
        <p className="sub">Pulsa el botón para continuar y crear tu contraseña.</p>
        <input type="hidden" name="token_hash" value={token} />
        <input type="hidden" name="type" value={type} />
        <button className="btn" type="submit">Continuar</button>
      </form>
    </main>
  );
}
