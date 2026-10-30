import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/sesion";
import { leerAjustes } from "@/lib/ajustes";
import { puntosFoto } from "@/lib/ranking";
import FotoObligatoria from "@/components/FotoObligatoria";

export const dynamic = "force-dynamic";

// Paso obligatorio: quien no tiene foto de perfil llega aquí antes de entrar a la plataforma.
export default async function Foto() {
  const perfil = await perfilActual();
  if (perfil.avatar_url) redirect("/inicio");
  const aj = await leerAjustes();
  const pts = puntosFoto(aj.ranking_pts_foto);
  const nombre = (perfil.nombre || perfil.email).trim();
  return (
    <main className="center">
      <div className="card">
        <div className="logo"><img src="/logo-elitefx.png" alt="ELITE FX · Trading de Alta Precisión" /></div>
        <h1>Sube tu foto de perfil</h1>
        <p className="sub">Para entrar a la plataforma necesitamos tu foto, así la comunidad te reconoce. Si eres miembro VIP, además sumas <b>{pts} puntos</b> en el ranking.</p>
        <FotoObligatoria uid={perfil.id} iniciales={((nombre[0] || "?")).toUpperCase()} />
        <form action="/auth/salir" method="post" style={{ marginTop: 16, textAlign: "center" }}>
          <button className="lk" type="submit">Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
