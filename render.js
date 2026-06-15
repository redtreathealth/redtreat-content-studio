/**
 * redtreat Content-Engine – Renderer
 * Nimmt einen Brief (JSON) + ein Foto und baut eine 100% markenkonforme Anzeige (PNG).
 *
 *   node render.js briefs/example_jogger.json
 *
 * Layout, Logo, Farben und Schrift kommen fix aus brand.config.js → kann nicht off-brand werden.
 * Texte werden vorher vom Brand-Linter geprüft (harte Verstöße = Abbruch).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const brand = require('./brand.config');
const { lint } = require('./brand-lint');
const { shotFile, closeBrowser } = require('./browser');

const ROOT = __dirname;

const fileUrl = (p) => 'file:///' + path.resolve(ROOT, p).replace(/\\/g, '/');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildHTML(brief) {
  const C = brand.colors, F = brand.fonts;
  const fmt = brand.formats[brief.format || 'story'];
  const photo = fileUrl(path.join('input', brief.photo));
  const logo = fileUrl(brief.logo || brand.logo.white);
  const cabin = fileUrl(brand.fonts.files.Cabin);
  const outfit = fileUrl(brand.fonts.files.Outfit);

  const ringColor = brand.scoreColor(brief.score?.value ?? 0);
  const circ = 628; // 2*pi*100
  const dash = Math.round(circ * (1 - (brief.score?.value ?? 0) / 100));

  const headline = (brief.headline || []).map((line, i) =>
    i === (brief.headline.length - 1) ? `<span class="r">${esc(line)}</span>` : esc(line)
  ).join('<br>');

  const statRows = (brief.stats || []).map(s =>
    `<div class="srow"><span class="k mono">${esc(s.k)}</span><span class="val">${esc(s.v)}${s.unit ? `<small>${esc(s.unit)}</small>` : ''}</span></div>`
  ).join('');

  const twoCol = (brief.twoCol || []).map(c =>
    `<div class="c"><div class="v">${esc(c.v)}</div><div class="l mono">${esc(c.l)}</div></div>`
  ).join('');

  const badge = brief.badge
    ? `<span class="live mono"><i></i>${esc(brief.badge)}</span>` : '<span></span>';

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
 @font-face{font-family:'Cabin';src:url('${cabin}') format('truetype');font-weight:100 900;font-style:normal}
 @font-face{font-family:'Outfit';src:url('${outfit}') format('truetype');font-weight:100 900;font-style:normal}
 html,body{margin:0;padding:0}*{box-sizing:border-box}
 .ad{position:relative;width:${fmt.w}px;height:${fmt.h}px;overflow:hidden;background:${C.bgDark};font-family:${F.body}}
 .mono{font-family:${F.body}}
 .photo{position:absolute;inset:0;background:${C.bgDark} url('${photo}') center/cover no-repeat}
 .grade{position:absolute;inset:0;background:
   radial-gradient(120% 80% at 28% 34%, rgba(255,150,70,.10), transparent 60%),
   radial-gradient(140% 100% at 50% 122%, rgba(0,0,0,.5), transparent 55%);mix-blend-mode:multiply;opacity:.9}
 .topscrim{position:absolute;left:0;right:0;top:0;height:540px;
   background:linear-gradient(to bottom, rgba(10,7,8,.68) 0%, rgba(10,7,8,.26) 42%, rgba(10,7,8,0) 100%)}
 .botscrim{position:absolute;left:0;right:0;bottom:0;height:700px;
   background:linear-gradient(to top, ${C.bgDark} 4%, rgba(10,7,8,.9) 26%, rgba(10,7,8,.36) 60%, rgba(10,7,8,0) 100%)}
 .grain{position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;
   background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
 .logo{position:absolute;top:60px;left:58px;width:236px;height:auto;filter:drop-shadow(0 3px 16px rgba(0,0,0,.5))}
 .kick{position:absolute;top:300px;left:62px;display:flex;align-items:center;gap:16px;color:rgba(251,247,241,.85);font-size:22px;letter-spacing:6px;font-weight:600;text-transform:uppercase}
 .kick .ln{width:54px;height:2px;background:${C.red};display:block}
 .h1{position:absolute;top:330px;left:58px;right:110px;color:${C.cream};font-family:${F.display};font-size:104px;line-height:.92;font-weight:700;letter-spacing:-3px;text-transform:lowercase;text-shadow:0 6px 30px rgba(0,0,0,.45)}
 .h1 .r{color:${C.red}}
 .card{position:absolute;left:92px;right:92px;top:586px;border-radius:36px;padding:34px 40px 32px;
   background:rgba(13,11,13,.40);border:1px solid rgba(255,255,255,.16);
   backdrop-filter:blur(28px) saturate(125%);-webkit-backdrop-filter:blur(28px) saturate(125%);
   box-shadow:0 54px 120px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.09)}
 .card .ch{display:flex;align-items:center;justify-content:space-between}
 .card .ch .lbl{color:rgba(251,247,241,.5);font-size:21px;letter-spacing:4px;font-weight:600}
 .card .ch .live{display:flex;align-items:center;gap:10px;color:${C.cream};font-size:21px;letter-spacing:2px;font-weight:700}
 .card .ch .live i{width:13px;height:13px;border-radius:50%;background:${C.red};box-shadow:0 0 15px 4px rgba(224,37,44,.9);display:block}
 .card .sub{color:rgba(251,247,241,.72);font-size:25px;font-weight:500;margin-top:8px}
 .body{display:flex;align-items:center;gap:34px;margin-top:22px}
 .ring{position:relative;width:236px;height:236px;flex:0 0 236px}
 .ring .ctr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
 .ring .v{color:${C.cream};font-size:90px;font-weight:200;letter-spacing:-3px;line-height:1}
 .ring .l{color:rgba(251,247,241,.55);font-size:17px;letter-spacing:3px;font-weight:600;margin-top:5px}
 .stats{flex:1}
 .srow{display:flex;justify-content:space-between;align-items:baseline;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.1)}
 .srow .k{color:rgba(251,247,241,.62);font-size:25px;letter-spacing:1.5px}
 .srow .val{color:${C.cream};font-size:36px;font-weight:300}.srow .val small{font-size:21px;color:rgba(251,247,241,.55)}
 .two{display:flex;margin-top:18px}.two .c{flex:1}.two .c+.c{border-left:1px solid rgba(255,255,255,.1);padding-left:26px}
 .two .v{color:${C.cream};font-size:48px;font-weight:300;line-height:1}
 .two .l{color:rgba(251,247,241,.5);font-size:19px;letter-spacing:1.5px;margin-top:6px}
 .cta{position:absolute;bottom:122px;left:0;right:0;text-align:center}
 .cta .pill{display:inline-flex;align-items:center;gap:14px;background:${C.red};color:#fff;font-size:31px;font-weight:600;letter-spacing:2px;text-transform:uppercase;padding:25px 52px;border-radius:100px;box-shadow:0 24px 54px rgba(224,37,44,.5)}
 .store{position:absolute;bottom:76px;left:0;right:0;text-align:center;color:rgba(251,247,241,.62);font-size:21px;letter-spacing:3px;font-weight:500}
</style></head><body>
 <div class="ad">
  <div class="photo"></div><div class="grade"></div><div class="topscrim"></div><div class="botscrim"></div>
  <img class="logo" src="${logo}">
  ${brief.kicker ? `<div class="kick"><span class="ln"></span>${esc(brief.kicker)}</div>` : ''}
  <div class="h1">${headline}</div>
  <div class="card">
    <div class="ch"><span class="lbl mono">${esc(brief.cardLabel || 'SCORE ◆ HEUTE')}</span>${badge}</div>
    ${brief.sub ? `<div class="sub">${esc(brief.sub)}</div>` : ''}
    <div class="body">
      <div class="ring">
        <svg width="236" height="236" viewBox="0 0 236 236">
          <circle cx="118" cy="118" r="100" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="16"/>
          <circle cx="118" cy="118" r="100" fill="none" stroke="${ringColor}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${dash}" transform="rotate(-90 118 118)"/>
        </svg>
        <div class="ctr"><div class="v">${esc(brief.score?.value ?? '')}</div><div class="l mono">${esc(brief.score?.label || 'LONGEVITY')}</div></div>
      </div>
      <div class="stats">${statRows}<div class="two">${twoCol}</div></div>
    </div>
  </div>
  ${brief.cta ? `<div class="cta"><span class="pill">${esc(brief.cta)} ◆</span></div>` : ''}
  ${brief.store ? `<div class="store mono">${esc(brief.store)}</div>` : ''}
  <div class="grain"></div>
 </div>
</body></html>`;
}

/**
 * PRODUKT-MODUS: echtes Produktfoto inszenieren — mit MEHREREN, klar unterschiedlichen Layouts.
 * Der Brief steuert das Design über brief.layout; pro Lauf werden verschiedene Layouts gemischt.
 *   brief.layout    ∈ 'spotlight' | 'editorial' | 'split' | 'minimal'   (Default 'spotlight')
 *   brief.bgVariant ∈ 'glow' | 'warm' | 'mono'
 *   brief.specs     = [{ value, label }]
 * Marke (Farben/Schrift/Logo/keine Claims) bleibt in JEDEM Layout fix → kann nicht off-brand werden.
 */
const PROD_BG = {
  glow: (C) => `radial-gradient(78% 52% at 50% 40%, rgba(224,37,44,.17), transparent 62%), ${C.bgDark}`,
  warm: (C) => `radial-gradient(92% 58% at 50% 36%, rgba(184,132,26,.16), transparent 60%), linear-gradient(180deg,#110d0c,${C.bgDark})`,
  mono: (C) => `radial-gradient(80% 55% at 50% 38%, rgba(255,255,255,.07), transparent 60%), ${C.bgDark}`,
};
const _grainCSS = `.grain{position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}`;

const _kickEl = (b) => b.kicker ? `<div class="kick"><span class="ln"></span>${esc(b.kicker)}</div>` : '';
const _ctaEl = (b) => b.cta ? `<div class="cta"><span class="pill">${esc(b.cta)} ◆</span></div>` : '';
const _storeEl = (b) => b.store ? `<div class="store mono">${esc(b.store)}</div>` : '';
const _subEl = (b, cls) => b.sub ? `<div class="${cls}">${esc(b.sub)}</div>` : '';
const _specGrid = (sp) => (sp || []).slice(0, 4).map(s => `<div class="spec"><div class="sv">${esc(s.value || '')}</div><div class="sl">${esc(s.label || '')}</div></div>`).join('');
const _specList = (sp) => (sp || []).slice(0, 4).map(s => `<div class="lrow"><span class="lv">${esc(s.value || '')}</span><span class="ll">${esc(s.label || '')}</span></div>`).join('');
const _specInline = (sp) => (sp || []).slice(0, 4).map(s => `<b>${esc(s.value || '')}</b> ${esc(s.label || '')}`).join('<span class="dot">·</span>');

// Gemeinsamer Rahmen: Reset, Canvas, Logo/Kicker/CTA/Store-Grundstil, Grain. Layout liefert eigenes CSS + Body.
function _wrap(x, css, body) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
 @font-face{font-family:'Cabin';src:url('${x.cabin}') format('truetype');font-weight:100 900;font-style:normal}
 @font-face{font-family:'Outfit';src:url('${x.outfit}') format('truetype');font-weight:100 900;font-style:normal}
 html,body{margin:0;padding:0}*{box-sizing:border-box}
 .ad{position:relative;width:${x.fmt.w}px;height:${x.fmt.h}px;overflow:hidden;background:${x.bg};font-family:${x.F.body}}
 .mono{font-family:${x.F.body}}
 .logo{position:absolute;top:60px;left:58px;width:228px;height:auto;z-index:5;filter:drop-shadow(0 3px 16px rgba(0,0,0,.5))}
 .kick{display:flex;align-items:center;gap:16px;color:rgba(251,247,241,.85);font-size:22px;letter-spacing:6px;font-weight:600;text-transform:uppercase}
 .kick .ln{width:54px;height:2px;background:${x.C.red};display:block}
 .h1 .r{color:${x.C.red}}
 .cta .pill{display:inline-flex;align-items:center;gap:14px;background:${x.C.red};color:#fff;font-size:31px;font-weight:600;letter-spacing:2px;text-transform:uppercase;padding:25px 52px;border-radius:100px;box-shadow:0 24px 54px rgba(224,37,44,.5)}
 .store{color:rgba(251,247,241,.62);font-size:21px;letter-spacing:3px;font-weight:500}
 ${_grainCSS}
 ${css}
</style></head><body><div class="ad">${body}<div class="grain"></div></div></body></html>`;
}

// 1) SPOTLIGHT — Produkt schwebt zentral, Glas-Spec-Karte darunter.
function _layoutSpotlight(x) {
  const css = `
 .kick{position:absolute;top:300px;left:62px}
 .h1{position:absolute;top:330px;left:58px;right:110px;color:${x.C.cream};font-family:${x.F.display};font-size:104px;line-height:.92;font-weight:700;letter-spacing:-3px;text-transform:lowercase;text-shadow:0 6px 30px rgba(0,0,0,.45)}
 .spot{position:absolute;top:556px;left:50%;transform:translateX(-50%);width:1010px;height:680px;background:radial-gradient(48% 44% at 50% 46%, rgba(255,255,255,.11), transparent 70%)}
 .floor{position:absolute;top:1192px;left:50%;transform:translateX(-50%);width:660px;height:96px;background:radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.55), transparent 70%);filter:blur(9px)}
 .hero{position:absolute;top:560px;left:50%;transform:translateX(-50%);width:902px;height:672px;object-fit:contain;filter:drop-shadow(0 48px 66px rgba(0,0,0,.62))}
 .pcard{position:absolute;left:78px;right:78px;top:1306px;border-radius:36px;padding:32px 40px 30px;background:rgba(13,11,13,.42);border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(28px) saturate(125%);box-shadow:0 54px 120px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.09)}
 .psub{color:rgba(251,247,241,.74);font-size:27px;font-weight:500;line-height:1.32;margin-bottom:24px}
 .specs{display:grid;grid-template-columns:1fr 1fr;gap:22px 30px}
 .spec{border-left:2px solid rgba(224,37,44,.65);padding-left:18px}
 .spec .sv{color:${x.C.cream};font-size:46px;font-weight:300;letter-spacing:-1px;line-height:1}
 .spec .sl{color:rgba(251,247,241,.55);font-size:21px;letter-spacing:1px;margin-top:6px;font-weight:500}
 .cta{position:absolute;bottom:122px;left:0;right:0;text-align:center}
 .store{position:absolute;bottom:76px;left:0;right:0;text-align:center}`;
  const body = `
 <img class="logo" src="${x.logo}">${_kickEl(x.brief)}
 <div class="h1">${x.headline}</div>
 <div class="spot"></div><div class="floor"></div>
 <img class="hero" src="${x.product}">
 <div class="pcard">${_subEl(x.brief, 'psub')}<div class="specs">${_specGrid(x.brief.specs)}</div></div>
 ${_ctaEl(x.brief)}${_storeEl(x.brief)}`;
  return _wrap(x, css, body);
}

// 2) EDITORIAL — vertikaler Split: links große Typo + Spec-Liste, rechts das Foto über volle Höhe.
function _layoutEditorial(x) {
  const css = `
 .photo{position:absolute;top:0;right:0;width:548px;height:1920px;background:${x.C.bgDark} url('${x.product}') center/cover no-repeat}
 .lfade{position:absolute;top:0;right:520px;width:230px;height:1920px;background:linear-gradient(to left, rgba(7,7,10,0), ${x.C.bgDark} 86%)}
 .rfade{position:absolute;top:0;right:0;width:548px;height:1920px;background:linear-gradient(to right, rgba(7,7,10,0) 58%, rgba(7,7,10,.5))}
 .kick{position:absolute;top:300px;left:62px}
 .h1{position:absolute;top:338px;left:58px;width:470px;color:${x.C.cream};font-family:${x.F.display};font-size:106px;line-height:.9;font-weight:700;letter-spacing:-3px;text-transform:lowercase}
 .esub{position:absolute;top:initial;left:62px;width:430px;color:rgba(251,247,241,.72);font-size:26px;font-weight:500;line-height:1.34;top:792px}
 .elist{position:absolute;top:1010px;left:62px;width:440px;display:flex;flex-direction:column;gap:22px}
 .lrow{display:flex;align-items:baseline;gap:14px;border-left:2px solid rgba(224,37,44,.65);padding-left:16px}
 .lrow .lv{color:${x.C.cream};font-size:40px;font-weight:300;letter-spacing:-1px;line-height:1}
 .lrow .ll{color:rgba(251,247,241,.6);font-size:22px;font-weight:500}
 .cta{position:absolute;bottom:150px;left:58px;text-align:left}
 .store{position:absolute;bottom:104px;left:62px}`;
  const body = `
 <div class="photo"></div><div class="rfade"></div><div class="lfade"></div>
 <img class="logo" src="${x.logo}">${_kickEl(x.brief)}
 <div class="h1">${x.headline}</div>
 ${_subEl(x.brief, 'esub')}
 <div class="elist">${_specList(x.brief.specs)}</div>
 ${_ctaEl(x.brief)}${_storeEl(x.brief)}`;
  return _wrap(x, css, body);
}

// 3) SPLIT — Plakat: Foto vollflächig oben, dunkler Textblock unten (Headline + Specs + CTA).
function _layoutSplit(x) {
  const css = `
 .photo{position:absolute;top:0;left:0;right:0;height:1080px;background:${x.C.bgDark} url('${x.product}') center/cover no-repeat}
 .pfade{position:absolute;top:0;left:0;right:0;height:1080px;background:linear-gradient(to bottom, transparent 52%, ${x.C.bgDark} 99%)}
 .kick{position:absolute;top:1142px;left:62px}
 .h1{position:absolute;top:1178px;left:58px;right:80px;color:${x.C.cream};font-family:${x.F.display};font-size:98px;line-height:.92;font-weight:700;letter-spacing:-3px;text-transform:lowercase}
 .psub{position:absolute;top:1376px;left:62px;right:90px;color:rgba(251,247,241,.7);font-size:25px;font-weight:500;line-height:1.3}
 .specs{position:absolute;top:1476px;left:62px;right:62px;display:grid;grid-template-columns:1fr 1fr;gap:20px 30px}
 .spec{border-left:2px solid rgba(224,37,44,.65);padding-left:18px}
 .spec .sv{color:${x.C.cream};font-size:44px;font-weight:300;letter-spacing:-1px;line-height:1}
 .spec .sl{color:rgba(251,247,241,.55);font-size:20px;letter-spacing:1px;margin-top:6px;font-weight:500}
 .cta{position:absolute;bottom:120px;left:58px;text-align:left}
 .store{position:absolute;bottom:74px;left:62px}`;
  const body = `
 <div class="photo"></div><div class="pfade"></div>
 <img class="logo" src="${x.logo}">${_kickEl(x.brief)}
 <div class="h1">${x.headline}</div>
 ${_subEl(x.brief, 'psub')}
 <div class="specs">${_specGrid(x.brief.specs)}</div>
 ${_ctaEl(x.brief)}${_storeEl(x.brief)}`;
  return _wrap(x, css, body);
}

// 4) MINIMAL — sehr reduziert: kleines Produkt, viel Raum, zentrierte Claim-Zeile, dünne Spec-Zeile, Outline-CTA.
function _layoutMinimal(x) {
  const css = `
 .spot{position:absolute;top:430px;left:50%;transform:translateX(-50%);width:760px;height:620px;background:radial-gradient(46% 44% at 50% 48%, rgba(224,37,44,.13), transparent 70%)}
 .hero{position:absolute;top:470px;left:50%;transform:translateX(-50%);width:560px;height:540px;object-fit:contain;filter:drop-shadow(0 40px 60px rgba(0,0,0,.6))}
 .kick{position:absolute;top:1132px;left:0;right:0;justify-content:center}
 .h1{position:absolute;top:1172px;left:0;right:0;text-align:center;color:${x.C.cream};font-family:${x.F.display};font-size:96px;line-height:.95;font-weight:700;letter-spacing:-3px;text-transform:lowercase}
 .msub{position:absolute;top:1376px;left:90px;right:90px;text-align:center;color:rgba(251,247,241,.66);font-size:26px;font-weight:400;line-height:1.3}
 .istrip{position:absolute;top:1496px;left:40px;right:40px;text-align:center;color:rgba(251,247,241,.8);font-size:24px;letter-spacing:.3px}
 .istrip b{color:${x.C.cream};font-weight:600}
 .istrip .dot{color:${x.C.red};margin:0 14px;font-weight:700}
 .cta{position:absolute;bottom:150px;left:0;right:0;text-align:center}
 .cta .pill{background:transparent;color:${x.C.cream};border:1.5px solid rgba(255,255,255,.4);box-shadow:none}
 .store{position:absolute;bottom:96px;left:0;right:0;text-align:center}`;
  const body = `
 <img class="logo" src="${x.logo}">
 <div class="spot"></div>
 <img class="hero" src="${x.product}">
 ${_kickEl(x.brief)}
 <div class="h1">${x.headline}</div>
 ${_subEl(x.brief, 'msub')}
 <div class="istrip">${_specInline(x.brief.specs)}</div>
 ${_ctaEl(x.brief)}${_storeEl(x.brief)}`;
  return _wrap(x, css, body);
}

const PRODUCT_LAYOUTS = { spotlight: _layoutSpotlight, editorial: _layoutEditorial, split: _layoutSplit, minimal: _layoutMinimal };

function buildProductHTML(brief) {
  const C = brand.colors, F = brand.fonts;
  const x = {
    C, F, brief,
    fmt: brand.formats[brief.format || 'story'],
    product: fileUrl(path.join('input', brief.photo)),
    logo: fileUrl(brief.logo || brand.logo.white),
    cabin: fileUrl(brand.fonts.files.Cabin),
    outfit: fileUrl(brand.fonts.files.Outfit),
    bg: (PROD_BG[brief.bgVariant] || PROD_BG.glow)(C),
    headline: (brief.headline || []).map((line, i) =>
      i === (brief.headline.length - 1) ? `<span class="r">${esc(line)}</span>` : esc(line)).join('<br>'),
  };
  return (PRODUCT_LAYOUTS[brief.layout] || _layoutSpotlight)(x);
}

/**
 * HYBRID-MODUS: KI-generierte Szene (brief.scene) + freigestelltes echtes Produkt (brief.photo, transparent)
 * werden komponiert — neue Bildwelt aus der KI, echtes Produkt mit Kontaktschatten reinmontiert.
 * Vielfalt entsteht über verschiedene KI-Szenen pro Lauf.
 */
function buildHybridHTML(brief) {
  const C = brand.colors, F = brand.fonts;
  const x = {
    C, F, brief,
    fmt: brand.formats[brief.format || 'story'],
    logo: fileUrl(brief.logo || brand.logo.white),
    cabin: fileUrl(brand.fonts.files.Cabin),
    outfit: fileUrl(brand.fonts.files.Outfit),
    bg: C.bgDark,
    headline: (brief.headline || []).map((line, i) =>
      i === (brief.headline.length - 1) ? `<span class="r">${esc(line)}</span>` : esc(line)).join('<br>'),
  };
  const scene = fileUrl(path.join('input', brief.scene));
  const cut = fileUrl(path.join('input', brief.photo));
  const tint = { glow: 'rgba(224,37,44,.10)', warm: 'rgba(184,132,26,.12)', mono: 'rgba(255,255,255,.05)' }[brief.bgVariant || 'glow'];
  const strip = (brief.specs || []).slice(0, 4).map(s => `<div class="scol"><div class="sv">${esc(s.value || '')}</div><div class="sl">${esc(s.label || '')}</div></div>`).join('');
  const css = `
 .scene{position:absolute;inset:0;background:${C.bgDark} url('${scene}') center/cover no-repeat}
 .grade{position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 38%, ${tint}, transparent 60%), radial-gradient(150% 100% at 50% 122%, rgba(0,0,0,.55), transparent 55%);mix-blend-mode:multiply;opacity:.92}
 .spill{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);width:1280px;height:1280px;background:radial-gradient(circle at 50% 50%, rgba(255,96,72,.5), rgba(224,37,44,.22) 40%, rgba(224,37,44,0) 68%);mix-blend-mode:screen;filter:blur(8px)}
 .contact{position:absolute;left:50%;transform:translateX(-50%);bottom:388px;width:540px;height:92px;background:radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.62), transparent 70%);filter:blur(11px)}
 .cut{position:absolute;left:50%;transform:translateX(-50%);bottom:392px;height:1044px;object-fit:contain;filter:drop-shadow(0 38px 52px rgba(0,0,0,.5))}
 .topscrim{position:absolute;left:0;right:0;top:0;height:620px;background:linear-gradient(to bottom, rgba(7,7,10,.74) 0%, rgba(7,7,10,.3) 44%, rgba(7,7,10,0) 100%)}
 .botscrim{position:absolute;left:0;right:0;bottom:0;height:760px;background:linear-gradient(to top, ${C.bgDark} 7%, rgba(7,7,10,.92) 30%, rgba(7,7,10,.36) 64%, rgba(7,7,10,0) 100%)}
 .kick{position:absolute;top:300px;left:62px}
 .h1{position:absolute;top:332px;left:58px;right:110px;color:${C.cream};font-family:${F.display};font-size:104px;line-height:.92;font-weight:700;letter-spacing:-3px;text-transform:lowercase;text-shadow:0 6px 30px rgba(0,0,0,.5)}
 .strip{position:absolute;left:64px;right:64px;bottom:298px;display:flex}
 .scol{flex:1;text-align:center;border-left:1px solid rgba(255,255,255,.15);padding:0 6px}
 .scol:first-child{border-left:0}
 .scol .sv{color:${C.cream};font-size:40px;font-weight:300;letter-spacing:-1px;line-height:1}
 .scol .sl{color:rgba(251,247,241,.6);font-size:18px;letter-spacing:.6px;margin-top:7px;font-weight:500;line-height:1.15}
 .cta{position:absolute;bottom:120px;left:0;right:0;text-align:center}
 .store{position:absolute;bottom:74px;left:0;right:0;text-align:center}`;
  const body = `
 <div class="scene"></div><div class="grade"></div><div class="spill"></div>
 <div class="contact"></div><img class="cut" src="${cut}">
 <div class="topscrim"></div><div class="botscrim"></div>
 <img class="logo" src="${x.logo}">${_kickEl(brief)}
 <div class="h1">${x.headline}</div>
 <div class="strip">${strip}</div>
 ${_ctaEl(brief)}${_storeEl(brief)}`;
  return _wrap(x, css, body);
}

/**
 * CLEAN-STUDIO-MODUS: heller, minimalistischer Look (Omnilux/CurrentBody) — freigestelltes Produkt
 * mit rotem Glow-Halo auf hellem Creme-Grund, ink-Typo, viel Weißraum. brief.photo = transparenter Cutout.
 * Heller Hintergrund → Wortmarke als Text (weißes Logo wäre unsichtbar).
 */
function buildStudioHTML(brief) {
  const C = brand.colors, F = brand.fonts;
  const fmt = brand.formats[brief.format || 'story'];
  const cut = fileUrl(path.join('input', brief.photo));
  const cabin = fileUrl(brand.fonts.files.Cabin);
  const outfit = fileUrl(brand.fonts.files.Outfit);
  const headline = (brief.headline || []).map((line, i) =>
    i === (brief.headline.length - 1) ? `<span class="r">${esc(line)}</span>` : esc(line)).join('<br>');
  const strip = (brief.specs || []).slice(0, 4).map(s => `<div class="scol"><div class="sv">${esc(s.value || '')}</div><div class="sl">${esc(s.label || '')}</div></div>`).join('');
  const halo = { glow: 'rgba(224,37,44,.30)', warm: 'rgba(255,120,60,.30)', mono: 'rgba(224,37,44,.15)' }[brief.bgVariant || 'glow'];
  const bg = `radial-gradient(72% 50% at 50% 42%, #FFFFFF, ${C.cream} 60%, #EFE7DB 100%)`;
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
 @font-face{font-family:'Cabin';src:url('${cabin}') format('truetype');font-weight:100 900;font-style:normal}
 @font-face{font-family:'Outfit';src:url('${outfit}') format('truetype');font-weight:100 900;font-style:normal}
 html,body{margin:0;padding:0}*{box-sizing:border-box}
 .ad{position:relative;width:${fmt.w}px;height:${fmt.h}px;overflow:hidden;background:${bg};font-family:${F.body}}
 .wm{position:absolute;top:62px;left:62px;font-family:${F.display};font-weight:700;font-size:46px;letter-spacing:-2px}
 .wm .r{color:${C.red}} .wm .t{color:${C.ink}}
 .kick{position:absolute;top:314px;left:66px;display:flex;align-items:center;gap:16px;color:#8a8076;font-size:22px;letter-spacing:6px;font-weight:600;text-transform:uppercase}
 .kick .ln{width:54px;height:2px;background:${C.red};display:block}
 .h1{position:absolute;top:346px;left:62px;right:110px;color:${C.ink};font-family:${F.display};font-size:104px;line-height:.92;font-weight:700;letter-spacing:-3px;text-transform:lowercase}
 .h1 .r{color:${C.red}}
 .halo{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);width:1180px;height:1180px;background:radial-gradient(circle at 50% 50%, ${halo}, transparent 62%);filter:blur(6px)}
 .floor{position:absolute;left:50%;bottom:392px;transform:translateX(-50%);width:560px;height:84px;background:radial-gradient(50% 50% at 50% 50%, rgba(70,38,26,.20), transparent 70%);filter:blur(10px)}
 .cut{position:absolute;left:50%;bottom:404px;transform:translateX(-50%);height:1006px;object-fit:contain;filter:drop-shadow(0 34px 44px rgba(80,44,32,.26))}
 .strip{position:absolute;left:72px;right:72px;bottom:300px;display:flex}
 .scol{flex:1;text-align:center;border-left:1px solid rgba(29,29,27,.16);padding:0 6px}
 .scol:first-child{border-left:0}
 .scol .sv{color:${C.ink};font-size:40px;font-weight:400;letter-spacing:-1px;line-height:1}
 .scol .sl{color:#8a8076;font-size:18px;letter-spacing:.6px;margin-top:7px;font-weight:500;line-height:1.15}
 .cta{position:absolute;bottom:120px;left:0;right:0;text-align:center}
 .cta .pill{display:inline-flex;align-items:center;gap:14px;background:${C.red};color:#fff;font-size:31px;font-weight:600;letter-spacing:2px;text-transform:uppercase;padding:25px 52px;border-radius:100px;box-shadow:0 20px 44px rgba(224,37,44,.34)}
 .store{position:absolute;bottom:74px;left:0;right:0;text-align:center;color:#8a8076;font-size:21px;letter-spacing:3px;font-weight:500}
</style></head><body><div class="ad">
 <div class="halo"></div>
 <div class="wm"><span class="r">red</span><span class="t">treat</span></div>
 ${brief.kicker ? `<div class="kick"><span class="ln"></span>${esc(brief.kicker)}</div>` : ''}
 <div class="h1">${headline}</div>
 <div class="floor"></div><img class="cut" src="${cut}">
 <div class="strip">${strip}</div>
 ${brief.cta ? `<div class="cta"><span class="pill">${esc(brief.cta)} ◆</span></div>` : ''}
 ${brief.store ? `<div class="store">${esc(brief.store)}</div>` : ''}
</div></body></html>`;
}

/**
 * EDITORIAL-DESIGN (neu, durchgängig) — Swiss/editorial Anmutung:
 * Masthead (Wortmarke + Land) · Hairline-Raster · großer Cabin-Titel · Produkt mit rotem Glow ·
 * präzise Spec-Tabelle (Datenblatt) · Footer mit CTA. Hell (Creme), premium, reduziert.
 * brief.photo = freigestellter Cutout. brief.bgVariant glow|warm|mono steuert nur die Glow-Farbe.
 */
function buildEditorialHTML(brief) {
  const C = brand.colors, F = brand.fonts;
  const fmt = brand.formats[brief.format || 'story'];
  const cut = fileUrl(path.join('input', brief.photo));
  const cabin = fileUrl(brand.fonts.files.Cabin);
  const outfit = fileUrl(brand.fonts.files.Outfit);
  const headline = (brief.headline || []).map((line, i) =>
    i === (brief.headline.length - 1) ? `<span class="r">${esc(line)}</span>` : esc(line)).join('<br>');
  const rows = (brief.specs || []).slice(0, 4).map(s =>
    `<div class="srow"><span class="l">${esc(s.label || '')}</span><span class="v">${esc(s.value || '')}</span></div>`).join('');
  const halo = { glow: 'rgba(224,37,44,.26)', warm: 'rgba(255,118,58,.26)', mono: 'rgba(224,37,44,.13)' }[brief.bgVariant || 'glow'];
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
 @font-face{font-family:'Cabin';src:url('${cabin}') format('truetype');font-weight:100 900;font-style:normal}
 @font-face{font-family:'Outfit';src:url('${outfit}') format('truetype');font-weight:100 900;font-style:normal}
 html,body{margin:0;padding:0}*{box-sizing:border-box}
 .ad{position:relative;width:${fmt.w}px;height:${fmt.h}px;overflow:hidden;font-family:${F.body};
   background:radial-gradient(80% 46% at 50% 40%, #FFFFFF, ${C.cream} 64%, #EEE6DA 100%)}
 .grain{position:absolute;inset:0;opacity:.04;mix-blend-mode:multiply;
   background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
 .mast{position:absolute;top:74px;left:72px;right:72px;display:flex;justify-content:space-between;align-items:baseline}
 .wm{font-family:${F.display};font-weight:700;font-size:42px;letter-spacing:-2px}
 .wm .r{color:${C.red}} .wm .t{color:${C.ink}}
 .meta{color:#8a8076;font-size:20px;letter-spacing:3px;text-transform:uppercase;font-weight:600}
 .rule{position:absolute;left:72px;right:72px;height:1px;background:rgba(29,29,27,.17)}
 .rTop{top:150px}
 .kick{position:absolute;top:200px;left:72px;display:flex;align-items:center;gap:14px;color:#8a8076;font-size:22px;letter-spacing:4px;text-transform:uppercase;font-weight:600}
 .kick .sq{width:13px;height:13px;background:${C.red};display:block}
 .h1{position:absolute;top:242px;left:70px;right:300px;color:${C.ink};font-family:${F.display};font-size:100px;line-height:.92;font-weight:700;letter-spacing:-3px;text-transform:lowercase}
 .h1 .r{color:${C.red}}
 .sub{position:absolute;top:474px;left:72px;right:320px;color:#6b6258;font-size:26px;line-height:1.4;font-weight:400}
 .halo{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:1120px;height:1010px;background:radial-gradient(circle at 50% 48%, ${halo}, transparent 62%);filter:blur(8px)}
 .floor{position:absolute;left:50%;bottom:558px;transform:translateX(-50%);width:520px;height:74px;background:radial-gradient(50% 50% at 50% 50%, rgba(70,38,26,.18), transparent 70%);filter:blur(10px)}
 .hero{position:absolute;left:50%;top:566px;transform:translateX(-50%);height:798px;object-fit:contain;filter:drop-shadow(0 30px 40px rgba(80,44,32,.24))}
 .specs{position:absolute;top:1410px;left:72px;right:72px}
 .srow{display:flex;justify-content:space-between;align-items:baseline;padding:18px 2px;border-top:1px solid rgba(29,29,27,.16)}
 .srow .l{color:#8a8076;font-size:21px;letter-spacing:2px;text-transform:uppercase;font-weight:600}
 .srow .v{color:${C.ink};font-family:${F.display};font-size:38px;font-weight:600;letter-spacing:-.5px}
 .foot{position:absolute;left:72px;right:72px;bottom:92px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(29,29,27,.17);padding-top:30px}
 .cta{display:inline-flex;align-items:center;gap:13px;background:${C.red};color:#fff;font-size:27px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;padding:20px 40px;border-radius:100px}
 .site{color:#8a8076;font-size:22px;letter-spacing:2px;text-transform:uppercase;font-weight:600}
</style></head><body><div class="ad">
 <div class="halo"></div>
 <div class="mast"><div class="wm"><span class="r">red</span><span class="t">treat</span></div><div class="meta">Switzerland · Est. 2024</div></div>
 <div class="rule rTop"></div>
 ${brief.kicker ? `<div class="kick"><span class="sq"></span>${esc(brief.kicker)}</div>` : ''}
 <div class="h1">${headline}</div>
 ${brief.sub ? `<div class="sub">${esc(brief.sub)}</div>` : ''}
 <div class="floor"></div><img class="hero" src="${cut}">
 <div class="specs">${rows}</div>
 <div class="foot">${brief.cta ? `<span class="cta">${esc(brief.cta)} →</span>` : '<span></span>'}<span class="site">redtreat.ch</span></div>
 <div class="grain"></div>
</div></body></html>`;
}

// HTML → PNG via Playwright/Chromium (plattform-unabhängig, zuverlässig)
async function renderPNG(html, outPng, fmt) {
  const tmpHtml = path.join(ROOT, 'output', '_tmp_' + path.basename(outPng) + '.html');
  fs.writeFileSync(tmpHtml, html);
  try {
    const buf = await shotFile('file:///' + tmpHtml.replace(/\\/g, '/'), fmt.w, fmt.h);
    fs.writeFileSync(outPng, buf);
    return true;
  } catch (e) { console.error('   Render-Fehler:', e.message); return false; }
  finally { try { fs.unlinkSync(tmpHtml); } catch {} }
}

async function main() {
  const briefPath = process.argv[2];
  if (!briefPath) { console.error('Usage: node render.js <brief.json>'); process.exit(1); }
  const brief = JSON.parse(fs.readFileSync(path.resolve(ROOT, briefPath), 'utf8'));

  const { hard, soft } = lint(brief);
  soft.forEach(w => console.warn('  ⚠️  ' + w));
  if (hard.length) {
    console.error('\n❌ Brand-Verstoß – Anzeige NICHT gebaut:');
    hard.forEach(h => console.error('   • ' + h));
    process.exit(2);
  }

  const fmt = brand.formats[brief.format || 'story'];

  // Schritt 2: Foto aus dem Brief-Prompt erzeugen (falls gewünscht / noch nicht da)
  if (brief.imagePrompt) {
    const photoPath = path.join(ROOT, 'input', brief.photo);
    if (brief.regenerate || !fs.existsSync(photoPath)) {
      console.log('🖼️  Generiere Foto aus Prompt …');
      execFileSync('node', [path.join(ROOT, 'generate.js'),
        brief.imagePrompt, photoPath, String(fmt.w), String(fmt.h)], { stdio: 'inherit' });
    }
  }

  const out = path.join(ROOT, 'output', (brief.name || 'ad') + '.png');
  console.log(`\n🎨 Baue ${brief.format || 'story'} (${fmt.w}×${fmt.h}) …`);
  const ok = await renderPNG(buildHTML(brief), out, fmt);
  await closeBrowser();
  if (ok) console.log('✅ Fertig:', out);
  else { console.error('❌ Render fehlgeschlagen.'); process.exit(3); }
}
if (require.main === module) main().catch(e => { console.error('❌', e.message); process.exit(1); });
module.exports = { buildHTML, buildProductHTML, buildHybridHTML, buildStudioHTML, buildEditorialHTML, renderPNG };
