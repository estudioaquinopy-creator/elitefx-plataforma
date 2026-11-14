// Estilos del calendario minimalista: se incluyen solo en la página del calendario (no en globals.css).
export const CSS_CALENDARIO = `/* Calendario minimalista: sin cajas ni botones; la información completa aparece al tocar una sesión. */
.calmin.box{background:transparent;border:0;box-shadow:none;padding:0}
.calmin .calnav{justify-content:center;gap:18px;font-size:15px;font-weight:600;margin-bottom:6px}
.calmin .leyenda{justify-content:center;gap:12px;font-size:11px;margin:0 0 18px;opacity:.8}
.calmin .leyenda i{width:8px;height:8px;border-radius:50%}
.calmin .sem{gap:0;border-top:1px solid var(--bd);grid-template-columns:repeat(7,minmax(0,1fr))}
.calmin .sdia{border:0;border-radius:0;background:transparent;box-shadow:none;min-height:150px;padding:14px 10px 10px;gap:6px;border-right:1px solid var(--bd)}
.calmin .sdia:last-child{border-right:0}
.calmin .sdh{border:0;padding:0 0 8px;flex-direction:column;align-items:flex-start;gap:0;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.calmin .sdh b{font-size:20px;font-weight:600;text-transform:none;letter-spacing:0}
.calmin .sdia.hoy{background:transparent;border-color:var(--bd)}
.calmin .sdia.hoy .sdh span::after{content:""}
.calmin .sdia.hoy .sdh b{color:var(--ac)}
.calmin .sv{opacity:.35;font-size:13px}
.calmin .sc{border:0;border-left:2px solid var(--c,var(--ac));border-radius:0 8px 8px 0;background:transparent;padding:4px 8px;gap:1px;transform:none;box-shadow:none;flex-direction:column;position:relative}
.calmin .sc:hover{background:var(--sf2);transform:none;box-shadow:none}
.calmin .sc .sh{font:600 12px 'Sora',sans-serif;color:var(--mu)}
.calmin .sc b{font-size:13px;font-weight:500;line-height:1.25}
.calmin .sc.fin{opacity:.28;filter:grayscale(.7)}
.calmin .sc.fin:hover{opacity:.6}
.calmin .svivo{font-size:10px;font-weight:700;color:#fff;background:#e5484d;border-radius:999px;padding:1px 7px;align-self:flex-start;margin-top:3px;animation:vivop 1.6s ease-in-out infinite}
@keyframes vivop{50%{opacity:.55}}
@media (max-width:760px){
  .calmin .sem{display:block}
  .calmin .sdia{display:grid;grid-template-columns:64px 1fr;column-gap:10px;align-items:start;border-right:0;border-bottom:1px solid var(--bd);padding:12px 4px;min-height:0}
  .calmin .sdh{grid-row:1 / span 20}
  .calmin .sdh b{font-size:22px}
}
`;
