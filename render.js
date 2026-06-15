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
 * PRODUKT-MODUS: echtes Produktfoto als Hero + Spec-Karte (statt Lifestyle-Score).
 * Für Hardware (z.B. SolisPanel) — die App erfindet KEIN Produkt, sie inszeniert das echte Foto.
 * Erwartet zusätzlich: brief.specs = [{ value, label }], optional brief.bgVariant ('glow'|'warm'|'mono').
 */
function buildProductHTML(brief) {
  const C = brand.colors, F = brand.fonts;
  const fmt = brand.formats[brief.format || 'story'];
  const product = fileUrl(path.join('input', brief.photo));
  const logo = fileUrl(brief.logo || brand.logo.white);
  const cabin = fileUrl(brand.fonts.files.Cabin);
  const outfit = fileUrl(brand.fonts.files.Outfit);

  const headline = (brief.headline || []).map((line, i) =>
    i === (brief.headline.length - 1) ? `<span class="r">${esc(line)}</span>` : esc(line)
  ).join('<br>');

  const specs = (brief.specs || []).slice(0, 4).map(s =>
    `<div class="spec"><div class="sv">${esc(s.value || '')}</div><div class="sl">${esc(s.label || '')}</div></div>`
  ).join('');

  const bg = {
    glow: `radial-gradient(78% 52% at 50% 40%, rgba(224,37,44,.17), transparent 62%), ${C.bgDark}`,
    warm: `radial-gradient(90% 58% at 50% 38%, rgba(184,132,26,.15), transparent 60%), linear-gradient(180deg,#110d0c,${C.bgDark})`,
    mono: `radial-gradient(80% 55% at 50% 38%, rgba(255,255,255,.07), transparent 60%), ${C.bgDark}`,
  }[brief.bgVariant || 'glow'];

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
 @font-face{font-family:'Cabin';src:url('${cabin}') format('truetype');font-weight:100 900;font-style:normal}
 @font-face{font-family:'Outfit';src:url('${outfit}') format('truetype');font-weight:100 900;font-style:normal}
 html,body{margin:0;padding:0}*{box-sizing:border-box}
 .ad{position:relative;width:${fmt.w}px;height:${fmt.h}px;overflow:hidden;background:${bg};font-family:${F.body}}
 .mono{font-family:${F.body}}
 .grain{position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;
   background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
 .logo{position:absolute;top:60px;left:58px;width:236px;height:auto;filter:drop-shadow(0 3px 16px rgba(0,0,0,.5))}
 .kick{position:absolute;top:300px;left:62px;display:flex;align-items:center;gap:16px;color:rgba(251,247,241,.85);font-size:22px;letter-spacing:6px;font-weight:600;text-transform:uppercase}
 .kick .ln{width:54px;height:2px;background:${C.red};display:block}
 .h1{position:absolute;top:330px;left:58px;right:110px;color:${C.cream};font-family:${F.display};font-size:104px;line-height:.92;font-weight:700;letter-spacing:-3px;text-transform:lowercase;text-shadow:0 6px 30px rgba(0,0,0,.45)}
 .h1 .r{color:${C.red}}
 .spot{position:absolute;top:556px;left:50%;transform:translateX(-50%);width:1010px;height:680px;
   background:radial-gradient(48% 44% at 50% 46%, rgba(255,255,255,.11), transparent 70%)}
 .floor{position:absolute;top:1192px;left:50%;transform:translateX(-50%);width:660px;height:96px;
   background:radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.55), transparent 70%);filter:blur(9px)}
 .hero{position:absolute;top:560px;left:50%;transform:translateX(-50%);width:902px;height:672px;object-fit:contain;
   filter:drop-shadow(0 48px 66px rgba(0,0,0,.62))}
 .pcard{position:absolute;left:78px;right:78px;top:1306px;border-radius:36px;padding:32px 40px 30px;
   background:rgba(13,11,13,.42);border:1px solid rgba(255,255,255,.15);
   backdrop-filter:blur(28px) saturate(125%);-webkit-backdrop-filter:blur(28px) saturate(125%);
   box-shadow:0 54px 120px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.09)}
 .psub{color:rgba(251,247,241,.74);font-size:27px;font-weight:500;line-height:1.32;margin-bottom:24px}
 .specs{display:grid;grid-template-columns:1fr 1fr;gap:22px 30px}
 .spec{border-left:2px solid rgba(224,37,44,.65);padding-left:18px}
 .spec .sv{color:${C.cream};font-size:46px;font-weight:300;letter-spacing:-1px;line-height:1}
 .spec .sl{color:rgba(251,247,241,.55);font-size:21px;letter-spacing:1px;margin-top:6px;font-weight:500}
 .cta{position:absolute;bottom:122px;left:0;right:0;text-align:center}
 .cta .pill{display:inline-flex;align-items:center;gap:14px;background:${C.red};color:#fff;font-size:31px;font-weight:600;letter-spacing:2px;text-transform:uppercase;padding:25px 52px;border-radius:100px;box-shadow:0 24px 54px rgba(224,37,44,.5)}
 .store{position:absolute;bottom:76px;left:0;right:0;text-align:center;color:rgba(251,247,241,.62);font-size:21px;letter-spacing:3px;font-weight:500}
</style></head><body>
 <div class="ad">
  <img class="logo" src="${logo}">
  ${brief.kicker ? `<div class="kick"><span class="ln"></span>${esc(brief.kicker)}</div>` : ''}
  <div class="h1">${headline}</div>
  <div class="spot"></div><div class="floor"></div>
  <img class="hero" src="${product}">
  <div class="pcard">
    ${brief.sub ? `<div class="psub">${esc(brief.sub)}</div>` : ''}
    <div class="specs">${specs}</div>
  </div>
  ${brief.cta ? `<div class="cta"><span class="pill">${esc(brief.cta)} ◆</span></div>` : ''}
  ${brief.store ? `<div class="store mono">${esc(brief.store)}</div>` : ''}
  <div class="grain"></div>
 </div>
</body></html>`;
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
module.exports = { buildHTML, buildProductHTML, renderPNG };
