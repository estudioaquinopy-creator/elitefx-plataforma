export default function Ayuda() {
  return (
    <>
      <h1>Ayuda y soporte</h1>
      <p className="sub">¿Tienes dudas o algún problema con la plataforma?</p>
      <section className="box">
        <h2>Contacto</h2>
        <p className="mu">
          Escríbenos por WhatsApp al{" "}
          <a href="https://wa.me/595987174242" target="_blank" rel="noopener noreferrer" style={{ color: "var(--ac)" }}>+595 987 174 242</a>{" "}
          o por correo a{" "}
          <a href="mailto:soporte@elitefx.com.py" style={{ color: "var(--ac)" }}>soporte@elitefx.com.py</a>.
        </p>
        <h2 style={{ marginTop: 18 }}>Preguntas frecuentes</h2>
        <p className="mu"><b>No puedo ver un curso.</b> Algunos cursos son solo para miembros. Si ya eres miembro y no lo ves, escríbenos.</p>
        <p className="mu"><b>Olvidé mi contraseña.</b> Entra en tu perfil → Cambiar contraseña, o pídenos que la restablezcamos.</p>
      </section>
    </>
  );
}
