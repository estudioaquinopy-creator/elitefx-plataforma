// Estilo "suave" (probado como vista previa): tarjetas redondeadas con sombra, menú limpio con icono de línea fina y bloque de bienvenida en verde.
// Se inyecta con un <style> desde app/(app)/layout.tsx y NO va en globals.css (ver CLAUDE.md). Para apagarlo sin desplegar: ajuste "estilo_nuevo" = 0.
export const CSS_ESTILO_NUEVO = `
.box,.crs{border-radius:20px;border-color:rgba(255,255,255,.05);box-shadow:0 10px 30px rgba(0,0,0,.30)}
html[data-tema="claro"] .box,html[data-tema="claro"] .crs{border-color:rgba(25,50,40,.07);box-shadow:0 8px 26px rgba(25,50,40,.10)}
.drop{border-radius:18px}
.btn,.out,.ico,.search{border-radius:12px}
.main h1{font-weight:700;letter-spacing:-.01em}
@media(min-width:761px){.main{padding-left:36px;padding-right:36px}}

.side{background:#121413;border-right:0;padding:22px 14px;gap:6px;box-shadow:6px 0 24px rgba(0,0,0,.22)}
.nav{border-radius:14px;min-height:46px}
.nav svg{stroke-width:1.7}
.nav.on{background:rgba(0,212,122,.14)!important;box-shadow:none!important;color:var(--tx)!important}
.nav.on .ni{color:var(--ac)!important}
html[data-tema="claro"] .nav.on{background:rgba(0,152,90,.12)!important}

.hero.box{background:linear-gradient(120deg,#0a9d5c 0%,#08774a 58%,#065c39 100%)!important;border-color:transparent;color:#fff;position:relative;overflow:hidden}
.hero.box::after{content:"";position:absolute;right:-60px;bottom:-90px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.10);pointer-events:none}
.hero.box>*{position:relative;z-index:1}
.hero.box h2{color:#fff;font-weight:800}
.hero.box .tag{color:rgba(255,255,255,.88)}
.hero.box .mu{color:rgba(255,255,255,.86)}
.hero.box .bar{background:rgba(255,255,255,.28)}
.hero.box .bar i{background:#fff}
.hero.box .btn.sd{background:transparent;color:#fff;border:2px solid #fff}
.hero.box .btn.sd:hover{background:rgba(255,255,255,.18);filter:none}
.hero.box .th{box-shadow:0 8px 24px rgba(0,0,0,.25)}
`;
