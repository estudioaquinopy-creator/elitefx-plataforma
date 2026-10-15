import Link from "next/link";
import { perfilActual } from "@/lib/sesion";

export default async function Inicio() {
  const perfil = await perfilActual();
  const planTxt = { gratis: "Gratuito", live_trading: "Live Trading", scanner: "Scanner" }[perfil.plan];
  return (
    <>
      <h1>Hola, {perfil.nombre || perfil.email}</h1>
      <p className="sub">Rol: {perfil.rol === "admin" ? "Administrador" : "Alumno"} · Plan: {planTxt}</p>
      <section className="box">
        <h2>Tu ruta de aprendizaje</h2>
        <p className="mu">Empieza por Primeros pasos y avanza curso por curso.</p>
        <Link className="btn s" href="/cursos">Ir a Cursos</Link>
      </section>
    </>
  );
}
