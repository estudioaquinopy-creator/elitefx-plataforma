"use client";
import { useEffect, useState } from "react";
import { TERMINOS_VERSION } from "@/lib/terminos";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Tema from "@/components/Tema";
import { createClient } from "@/lib/supabase/client";
import { REFERIDOS_DESDE } from "@/lib/referidos";
import Captcha, { CAPTCHA_ACTIVO } from "@/components/Captcha";
import { validarClave, traducirErrorClave } from "@/lib/clave";
import { enviarEventoMeta } from "@/lib/metaPixel";

export default function Registro() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [codigo, setCodigo] = useState("");
  // El campo de código solo se muestra desde la fecha de inicio de los referidos (la base de datos también la controla).
  const [verCodigo, setVerCodigo] = useState(false);
  useEffect(() => {
    setVerCodigo(new Date() >= new Date(REFERIDOS_DESDE + "T00:00:00-03:00"));
    try { const r = new URLSearchParams(window.location.search).get("ref"); if (r) setCodigo(r.trim().toUpperCase().slice(0, 20)); } catch { /* sin enlace de referido */ }
  }, []);
  // Enlace de prueba VIP (/registro?prueba=CÓDIGO): se comprueba si sigue vigente y cuántos días da.
  const [prueba, setPrueba] = useState("");
  const [infoPrueba, setInfoPrueba] = useState<{ valida: boolean; dias: number } | null>(null);
  useEffect(() => {
    try {
      const p = (new URLSearchParams(window.location.search).get("prueba") ?? "").trim().toUpperCase().slice(0, 20);
      if (!p) return;
      setPrueba(p);
      createClient().rpc("prueba_info", { p_codigo: p }).then(({ data }) => {
        const f = (data as { valida: boolean; dias: number }[] | null)?.[0];
        setInfoPrueba(f ? { valida: true, dias: f.dias } : { valida: false, dias: 0 });
      }, () => setInfoPrueba({ valida: false, dias: 0 }));
    } catch { /* sin enlace de prueba */ }
  }, []);
  // Enlace para ex alumnos (/registro?alumno=CÓDIGO): queda como gratuito alumno si el código sigue vigente.
  const [alumno, setAlumno] = useState("");
  const [alumnoOk, setAlumnoOk] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const a = (new URLSearchParams(window.location.search).get("alumno") ?? "").trim().toUpperCase().slice(0, 20);
      if (!a) return;
      setAlumno(a);
      createClient().rpc("alumno_enlace_valido", { p_codigo: a }).then(({ data }) => setAlumnoOk(data === true), () => setAlumnoOk(false));
    } catch { /* sin enlace de alumno */ }
  }, []);
  const [err, setErr] = useState("");
  const [listo, setListo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [reinicio, setReinicio] = useState(0);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const n = nombre.trim().replace(/\s+/g, " ");
    const t = tel.replace(/[^\d+]/g, "");
    if (n.split(" ").length < 2) return setErr("Escribe tu nombre completo (nombre y apellido).");
    if (t.replace(/\D/g, "").length < 8) return setErr("Escribe un número de teléfono válido, con código de país (ej.: +595981123456).");
    const vc = validarClave(pw);
    if (vc) return setErr(vc);
    if (pw !== pw2) return setErr("Las contraseñas no coinciden.");
    const cod = codigo.trim().toUpperCase();
    if (verCodigo && cod && !/^EFX-[A-Z0-9]{6}$/.test(cod)) return setErr("El código de referido no es válido (ejemplo: EFX-1A2B3C). Déjalo vacío si no tienes uno.");
    if (!acepta) return setErr("Debes aceptar los términos y condiciones para crear tu cuenta.");
    if (CAPTCHA_ACTIVO && !token) return setErr("Completa la verificación de seguridad.");
    setBusy(true);
    const sb = createClient();
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pw, options: { ...(CAPTCHA_ACTIVO ? { captchaToken: token } : {}), data: { nombre: n, telefono: t, ...(cod ? { codigo_ref: cod } : {}), ...(prueba ? { codigo_prueba: prueba } : {}), ...(alumno ? { codigo_alumno: alumno } : {}) } } });
    if (error) {
      setBusy(false);
      setReinicio((x) => x + 1);
      const m = error.message.toLowerCase();
      if (m.includes("captcha")) return setErr("No pudimos verificar que eres una persona. Inténtalo de nuevo.");
      if (m.includes("already") || m.includes("registered")) return setErr("Ese correo ya tiene una cuenta. Inicia sesión.");
      if (m.includes("rate") || m.includes("limit")) return setErr("Demasiados intentos. Espera unos minutos e inténtalo otra vez.");
      return setErr(traducirErrorClave(error.message) || "No se pudo crear la cuenta: " + error.message);
    }
    enviarEventoMeta("CompleteRegistration", {}, { email: email.trim(), telefono: t, nombre: n });
    // Si el proyecto no pide confirmar el correo, la sesión ya está activa: guardamos el teléfono.
    if (data.session && data.user) {
      await sb.from("perfiles").update({ nombre: n, telefono: t }).eq("id", data.user.id);
      await sb.rpc("aceptar_terminos", { p_version: TERMINOS_VERSION }); // si falla (migración 0052 sin correr) no bloquea el registro
      router.replace("/inicio"); router.refresh();
      return;
    }
    setBusy(false);
    setListo(true);
  }

  return (
    <main className="center">
      <div style={{ position: "fixed", top: 16, right: 16 }}><Tema /></div>
      <form className="card" onSubmit={crear}>
        <div className="logo"><img src="/logo-elitefx.png" alt="ELITE FX · Trading de Alta Precisión" /></div>
        <h1>Crea tu cuenta gratis</h1>
        {listo ? (
          <>
            <p className="okmsg">Te enviamos un correo para confirmar tu cuenta. Ábrelo, confirma y luego inicia sesión.</p>
            <Link className="btn" href="/login" style={{ textAlign: "center" }}>Ir a iniciar sesión</Link>
          </>
        ) : (
          <>
            <p className="sub">Accede al Curso básico y a nuestro broker recomendado.</p>
            {alumnoOk === true && <p className="okmsg">👋 ¡Bienvenido de vuelta! Al crear tu cuenta tendrás acceso a todos tus cursos y tutoriales.</p>}
            {alumnoOk === false && <p className="err">Este enlace ya no está vigente. Puedes crear tu cuenta gratuita igualmente.</p>}
            {infoPrueba?.valida && <p className="okmsg">🎁 ¡Tienes una invitación! Al crear tu cuenta recibes <b>{infoPrueba.dias} días de acceso VIP</b> gratis.</p>}
            {infoPrueba && !infoPrueba.valida && <p className="err">Esta invitación ya venció o se completó el cupo. Puedes crear tu cuenta gratuita igualmente.</p>}
            <label>Nombre completo<input autoComplete="name" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" /></label>
            <label>Teléfono / WhatsApp<input type="tel" autoComplete="tel" required value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+595 981 123456" /></label>
            <label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Contraseña (mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo)<input type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
            <label>Repite la contraseña<input type="password" autoComplete="new-password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
            {verCodigo && <label>Código de referido (opcional)<input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="EFX-1A2B3C" maxLength={20} autoComplete="off" /></label>}
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "4px 0 12px" }}>
              <input type="checkbox" required checked={acepta} onChange={(e) => setAcepta(e.target.checked)} style={{ width: "auto", marginTop: 3 }} />
              <span style={{ fontSize: 13 }}>Soy mayor de 18 años y acepto los <a href="/terminos" target="_blank" rel="noopener noreferrer" className="lk">términos y condiciones</a> y la <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="lk">política de privacidad</a>. Entiendo que todo el contenido es educativo y no es una recomendación de inversión.</span>
            </label>
            <Captcha onToken={setToken} reinicio={reinicio} />
            {err && <p className="err">{err}</p>}
            <button className="btn" disabled={busy}>{busy ? "Creando tu cuenta…" : "Crear cuenta"}</button>
            <p className="mu" style={{ textAlign: "center", marginTop: 12 }}>¿Ya tienes cuenta? <Link href="/login" className="lk">Inicia sesión</Link></p>
          </>
        )}
      </form>
    </main>
  );
}
