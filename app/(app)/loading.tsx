// Se muestra al instante mientras carga la página siguiente.
export default function Cargando() {
  return (
    <div className="skel" aria-busy="true" aria-label="Cargando">
      <div className="sk-spin" />
      <div className="sk sk-t" />
      <div className="sk sk-s" />
      <div className="sk sk-b" />
      <div className="sk sk-b" />
    </div>
  );
}
