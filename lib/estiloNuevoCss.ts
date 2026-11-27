// Estilo "nuevo" de la plataforma: barra lateral estrecha con iconos de línea, tarjetas blancas/oscuras con sombra suave,
// título en Montserrat, cabecera verde. Se inyecta con un <style> desde app/(app)/layout.tsx SOLO si la persona lo eligió
// (cookie "estilo") y el ajuste global "estilo_nuevo" no es "0". NUNCA mover este bloque a globals.css.
export const CSS_ESTILO_NUEVO = String.raw`
@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Open+Sans:wght@400;600;700&display=swap");
:root,html[data-tema="oscuro"]{--bg:#0f1311;--sf:#181e1b;--sf2:#212925;--bd:#2a332e;--tx:#eef3ef;--mu:#9ba7a1;--ac:#00d47a;--azt:#00d47a;--rail:#0a0d0b;--rail-ic:#b7c2bc;--sombra:0 8px 26px rgba(0,0,0,.38)}
html[data-tema="claro"]{--bg:#fbf7ef;--sf:#ffffff;--sf2:#f3eee3;--bd:#ece5d8;--tx:#2a2c30;--mu:#7b7d85;--ac:#00a463;--azt:#00a463;--rail:#2f3a35;--rail-ic:#cfd8d3;--sombra:0 6px 24px rgba(60,45,20,.10)}
html body{background:var(--bg)!important;font-family:'Open Sans',system-ui,sans-serif!important;color:var(--tx)}
html body h1,html body h2,html body h3,html body .tag,html body .btn,html body button.btn,html body .kp b,html body .num,html body .dt,html body .bdg,html body .av,html body .covt,html body .sdh b,html body .sc .sh,html body .slogo,html body .th,html body .pill,html body .chip,html body .tab{font-family:'Montserrat',system-ui,sans-serif!important}
html body .main h1{background:none!important;-webkit-text-fill-color:currentColor!important;color:var(--tx)!important;font-weight:800;font-size:28px;letter-spacing:-.01em}
html body .main h2{font-weight:700}

/* Pantallas públicas (inicio de sesión, registro, recuperar…) */
html body .center .card{padding:32px!important;max-width:440px}
html body .center h1{font-weight:800;letter-spacing:-.01em}
html body .center .logo{font-weight:800}
html body .center input{min-height:48px}
html body .center a{color:var(--ac)}

/* Pantallas bajas (celular en horizontal): las redes sociales no se montan sobre el menú, quedan al final de la lista */
@media(max-height:760px){html body .redes{position:static!important;bottom:auto!important;margin:14px 0 0!important}}

/* Tarjetas */
html body .box,html body .crs,html body .center .card,html body .card,html body .comp,html body .comp-bar,html body .li,html body .step,html body .sdia,html body .acceso-precio,html body .kp .box{background:var(--sf)!important;background-image:none!important;border:0!important;border-radius:20px!important;box-shadow:var(--sombra)!important}
html body .step,html body .li,html body .sdia{border-radius:14px!important;box-shadow:none!important;background:var(--sf2)!important}
html body .cols>section.box:nth-child(even),html body .cols>div>section.box:nth-child(even){background:var(--sf)!important}
html body .crs:hover,html body .step:hover{transform:translateY(-2px);transition:transform .15s}
html body .grid .crs{border-top:0!important}
html body .grid .crs .cov:not([style]){background:linear-gradient(135deg,#0b8f58,#064a30)!important;border-radius:0}
html body .grid .crs .cov[style]{border-radius:0;background-color:#064a30!important}
html body .grid .crs:nth-child(3n+2) .cov:not([style]){background:linear-gradient(135deg,#17a86b,#0a5a3a)!important}
html body .grid .crs:nth-child(3n) .cov:not([style]){background:linear-gradient(135deg,#0a7a4c,#053a26)!important}

/* Cabecera verde de "Continúa donde lo dejaste" */
html body .hero{background:linear-gradient(120deg,#00b46a 0%,#008a52 100%)!important;color:#fff!important;border-radius:24px!important;position:relative;overflow:hidden;padding:28px!important}
html body .hero::before,html body .hero::after{content:"";position:absolute;border-radius:50%;background:rgba(255,255,255,.14);pointer-events:none}
html body .hero::before{right:-50px;bottom:-80px;width:260px;height:260px}
html body .hero::after{right:120px;bottom:-120px;width:160px;height:160px;background:rgba(255,255,255,.1)}
html body .hero>*{position:relative;z-index:1}
html body .hero .tag,html body .hero p,html body .hero .mu,html body .hero h2{color:#fff!important}
html body .hero h2{font-size:clamp(22px,3vw,30px);font-weight:800}
html body .hero .tag{opacity:.9}
html body .hero .bar{background:rgba(255,255,255,.3)!important}html body .hero .bar i{background:#fff!important}
html body .hero .btn{background:transparent!important;color:#fff!important;border:2px solid #fff!important;border-radius:12px}
html body .hero .btn:hover{background:rgba(255,255,255,.2)!important}
html body .hero .th{background-color:rgba(0,0,0,.25)!important;border-radius:16px;box-shadow:none}

/* Botones, pestañas y filtros */
html body .btn,html body button.btn{border-radius:12px;font-weight:700}
html body .btn.g,html body .btn.s{background:var(--sf2)!important;color:var(--tx)!important;border:0!important}
html body .btn.bl,html body a.btn.bl,html body button.btn.bl{background:var(--ac)!important;color:#04130c!important;border:0!important}
html[data-tema="claro"] body .btn.bl{color:#fff!important}
html body .chip,html body .tab,html body .cd{background:var(--sf)!important;background-image:none!important;border:1px solid var(--bd)!important;color:var(--mu)!important;border-radius:999px;box-shadow:none}
html body .tab{border-radius:12px}
html body .chip.on,html body .tab.on,html body .cd.on{background:var(--ac)!important;color:#fff!important;border-color:var(--ac)!important}
html body .li.on{background:color-mix(in srgb,var(--ac) 18%,transparent)!important;border:0!important}
html body .bar{background:var(--bd)!important;border-radius:6px}html body .bar i{background:var(--ac)!important;border-radius:6px}
html body .num,html body .li .n,html body .dt{background:color-mix(in srgb,var(--ac) 16%,transparent)!important;color:var(--ac)!important;border:0!important}
html body input,html body textarea,html body select{border-radius:12px;background:var(--sf2)!important;border:1px solid var(--bd)!important;color:var(--tx)!important}

/* Cabecera superior */
html body .top{border-bottom:0!important;padding:18px 0!important}
html body .search,html body .ico{background:var(--sf)!important;border:0!important;box-shadow:var(--sombra);border-radius:999px!important}
html body .ico{color:var(--mu)}
html body .av{background:var(--ac)!important;color:#fff!important;border:0!important;box-shadow:var(--sombra)}
html body .drop{background:var(--sf)!important;border:0!important;border-radius:18px!important;box-shadow:0 14px 40px rgba(0,0,0,.28)!important}

/* Barra lateral oscura con iconos de línea, nombres de sección y logo */
html body .side{background:var(--rail)!important;background-image:none!important;border:0!important}
html body .slogo img{filter:none}
html body .nav{color:var(--rail-ic)!important;background:transparent!important;box-shadow:none!important;border-radius:14px!important}
html body .nav:hover{background:rgba(255,255,255,.09)!important}
html body .nav.on{background:rgba(255,255,255,.15)!important;box-shadow:none!important;color:#fff!important}
html body .nav .ni{color:inherit!important}
html body .nav.on .ni{color:var(--ac)!important}
html body .nav .ni svg{width:22px;height:22px;stroke-width:1.7}
html body .nav .pill{background:rgba(255,255,255,.12)!important;color:var(--rail-ic)!important}
html body .ig{background:rgba(255,255,255,.07)!important;border:0!important;color:#fff!important}
html body .igt b{color:#fff!important}html body .igt small{color:var(--rail-ic)!important}
html body .igi svg{stroke:var(--rail-ic)!important}
html body .redit{color:var(--rail-ic)!important}
html[data-tema="claro"] body .nav.on{background:rgba(255,255,255,.16)!important}
html[data-tema="claro"] body .nav.on .ni{color:var(--ac)!important}
html[data-tema="claro"] body .slogo,html[data-tema="claro"] body .slogo span{background:none!important;-webkit-text-fill-color:initial}
html[data-tema="claro"] body .nav .ni{color:inherit!important}
html[data-tema="claro"] body .side{background:var(--rail)!important}
/* Redes sociales minimalistas: un solo icono de Instagram; al acercar o tocar se despliegan dos (ELITE FX y Marcos Aquino) */
html body .redes{flex-direction:row!important;align-items:center!important;gap:4px!important;padding:8px 10px 0!important}
html body .ig{width:30px!important;height:30px!important;padding:0!important;gap:0!important;justify-content:center!important;border:0!important;border-radius:8px!important;box-shadow:none!important;background:transparent!important;transform:none!important;color:var(--rail-ic)!important;cursor:pointer}
html body .ig:hover{background:rgba(255,255,255,.1)!important;color:#fff!important}
html body .ig svg{stroke:currentColor!important}html body .ig svg circle[fill]{fill:currentColor!important}
html body .igsub{animation:igsalta .18s ease-out}
html body .redit{margin-left:2px;font-size:14px;line-height:1;text-decoration:none}
@keyframes igsalta{from{opacity:0;transform:translateX(-6px) scale(.8)}to{opacity:1;transform:none}}
@media(max-width:760px){
  html body .hero{padding:20px!important}
}
`;
