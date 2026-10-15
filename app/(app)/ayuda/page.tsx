export default function Ayuda() {
  return (
    <>
      <h1>Ayuda y soporte</h1>
      <p className="sub">¿Tienes dudas o algún problema con la plataforma?</p>
      <section className="box">
        <h2>Contacto</h2>
        <p className="mu">Escríbenos por WhatsApp: [NÚMERO DE SOPORTE] o por correo: [CORREO DE SOPORTE].</p>
        <h2 style={{ marginTop: 18 }}>Preguntas frecuentes</h2>
        <p className="mu"><b>No puedo ver un curso.</b> Algunos cursos son solo para miembros. Si ya eres miembro y no lo ves, escríbenos.</p>
        <p className="mu"><b>Olvidé mi contraseña.</b> Entra en tu perfil → Cambiar contraseña, o pídenos que la restablezcamos.</p>
      </section>
    </>
  );
}
