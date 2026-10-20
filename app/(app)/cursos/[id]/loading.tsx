export default function Cargando() {
  return (
    <div className="skel" aria-busy="true" aria-label="Cargando">
      <div className="sk-spin" />
      <div className="sk sk-t" />
      <div className="sk" style={{ height: 320 }} />
      <div className="sk sk-b" />
    </div>
  );
}
