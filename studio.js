/**
 * redtreat Studio (das Tool) – Referenzbilder + Text → 8 Anzeigen + 2 Reels.
 *
 *   1) Lege Beispielbilder in  input/refs/
 *   2) node studio.js "<dein Brief / was du brauchst>"  [anzahlBilder=8]
 *
 * Ablauf: Creative Director (Gemini Vision liest Refs+Text) → Foto-Varianten (FLUX) →
 *         strenge Anatomie-QC → Top-N Anzeigen (On-Brand) → 2 Reels (ffmpeg).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const brand = require('./brand.config');
const { lint } = require('./brand-lint');
const { generate, qcRank } = require('./generate');
const { buildHTML, buildProductHTML, buildHybridHTML, buildStudioHTML, buildEditorialHTML, buildInUseHTML, renderPNG } = require('./render');
const { renderReel } = require('./reelmaker');
const { closeBrowser } = require('./browser');
const { cutoutBackground } = require('./cutout');

const ROOT = __dirname;
const REFS = path.join(ROOT, 'input', 'refs');
const OUT = path.join(ROOT, 'output', 'studio');
const CAND = path.join(ROOT, 'input', 'studio');
const REELS = path.join(ROOT, 'reels');
[OUT, CAND, REELS, REFS].forEach(d => fs.mkdirSync(d, { recursive: true }));

function loadEnv() {
  const p = path.join(ROOT, '.env'); const env = {};
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !l.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return { ...env, ...process.env };
}
const mimeOf = (b) => (b[0] === 0xFF && b[1] === 0xD8) ? 'image/jpeg' : 'image/png';

// Gemini-Aufruf mit Retry + Modell-Fallback: probiert nacheinander verfügbare Modelle.
// Transiente Fehler (429/500/503 = überlastet/Quota-Spitze) → kurz warten & nächstes Modell.
async function callGemini(env, body, tries = 2) {
  const key = env.GEMINI_API_KEY; if (!key) throw new Error('GEMINI_API_KEY fehlt');
  const models = [env.TEXT_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'].filter(Boolean);
  const seen = new Set(); let lastErr = 'unbekannt';
  for (const m of models) {
    if (seen.has(m)) continue; seen.add(m);
    for (let a = 0; a < tries; a++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) return r.json();
      lastErr = `${m} ${r.status}`;
      if (![429, 500, 503].includes(r.status)) { a = tries; break; } // harter Fehler → Modellwechsel bringt evtl. trotzdem was, aber nicht weiter retrien
      await new Promise(s => setTimeout(s, 1200 * (a + 1)));
    }
  }
  throw new Error('Gemini nicht verfügbar (' + lastErr + ')');
}

const SYSTEM = `Du bist Creative Director einer Weltklasse-Luxus-Markenagentur (30+ Jahre) für redtreat — premium Schweizer Longevity- & Wellness-Marke (App + Lichttherapie). WELLNESS, niemals Medizin.
Stimme: modern, quiet luxury, reduziert, evokativ. Bildsprache: editorial, cinematisch, viel Negativraum, EIN leiser Rot-Moment, Film-Realismus, natürliches Licht, edle Materialien, Schweizer Ruhe.
Dir werden REFERENZBILDER und ein Wunsch-Text gegeben. Analysiere die Referenzen (Motiv, Stil, Farbwelt, Licht, Komposition) + den Text und entwirf EINE neue Anzeige, die diese Bildwelt einfängt — als NEUES Bild, nicht kopiert.
Harte Regeln: Display-Copy klein mit Punkt ("deine mitte."). KEINE Medizin-/Heilaussagen. Kein "Made in" (→ "Designed in Switzerland"). Nur EIN Rot. Established 2024.
imagePrompt = akribischer art-directed Luxus-Editorial-FOTO-Prompt (Englisch): Licht, Objektiv, Filmlook, Color-Grade, Komposition (Subjekt untere Bildhälfte, oben heller leerer Raum), Styling; ende mit "photorealistic, editorial". KEINE Logos/Schrift im Bild. Zentriert, quadratisch-tauglich.
ANATOMIE-SICHERHEIT: einfache klare Haltungen (stehend/sitzend/von hinten/enger Ausschnitt), keine Verrenkungen/verschränkten Gliedmaßen; beide Beine+Arme klar sichtbar ODER sauber angeschnitten; ende mit "natural correct human anatomy, both legs visible". GARDEROBE: AUCH WENN Referenzbilder nackte Haut/Oberkörper zeigen — NIEMALS Nacktheit, Oberkörper oder Haut-Fokus beschreiben. Personen IMMER vollständig bekleidet (bei Sauna/Spa: Bademantel/Handtuch, Dampf, Holz) ODER Produkt/Szene ganz ohne Person. Sonst blockiert der Inhaltsfilter ALLES.
Copy knapp: headline genau 2 Zeilen je 1–3 Wörter klein+Punkt; kicker 2–3 Wörter; sub EIN eleganter Satz (≤12 Wörter); cta 1–2 Wörter. scoreValue 80–96. Erfinde KEINE Messwerte.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    kicker: { type: 'STRING' }, headline: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 2, maxItems: 2 },
    sub: { type: 'STRING' }, imagePrompt: { type: 'STRING' }, cta: { type: 'STRING' }, scoreValue: { type: 'INTEGER' },
  },
  required: ['kicker', 'headline', 'sub', 'imagePrompt', 'cta', 'scoreValue'],
};

// Marken-Vorlage, falls Google (Director) nicht verfügbar ist (z.B. Quota) → Tool läuft trotzdem.
function fallbackBrief(briefText) {
  return {
    kicker: 'longevity in motion',
    headline: ['dein moment.', 'dein tempo.'],
    sub: 'Premium Wellness, designed in Switzerland.',
    imagePrompt: 'Cinematic luxury editorial photograph for a premium Swiss wellness brand. Theme: '
      + String(briefText || 'longevity & wellness').slice(0, 150)
      + '. Soft natural light, warm premium materials, calm and aspirational, 35mm film look, subject in the lower half OR no person, large bright empty space at the top for text, photorealistic, editorial. natural correct human anatomy, both legs visible. fully clothed, modest, no nudity, no bare skin.',
    cta: 'jetzt entdecken.', scoreValue: 90,
  };
}

async function director(briefText, env) {
  const refs = fs.existsSync(REFS) ? fs.readdirSync(REFS).filter(f => /\.(png|jpe?g|webp)$/i.test(f)) : [];
  try {
    const key = env.GEMINI_API_KEY; if (!key) throw new Error('GEMINI_API_KEY fehlt');
    const parts = [];
    refs.forEach(f => { const b = fs.readFileSync(path.join(REFS, f)); parts.push({ text: `Referenz ${f}:` }); parts.push({ inline_data: { mime_type: mimeOf(b), data: b.toString('base64') } }); });
    parts.push({ text: `${refs.length ? 'Oben die Referenzbilder. ' : ''}Wunsch/Brief: "${briefText}". Liefere EINEN Anzeigen-Brief als JSON.` });
    const j = await callGemini(env, { systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 1.0 } });
    return { d: JSON.parse(j.candidates[0].content.parts.find(p => p.text).text), refCount: refs.length };
  } catch (e) {
    console.warn('   ⚠️  Creative Director (Google) nicht verfügbar: ' + e.message.slice(0, 70) + ' — nutze Marken-Vorlage.');
    return { d: fallbackBrief(briefText), refCount: refs.length };
  }
}

function makeReel(adPng, outMp4, mode) {
  const f = mode === 'pan'
    ? "scale=2160:3840,zoompan=z='1.11':d=210:x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(on/210)':s=1080x1920:fps=30,fade=t=in:st=0:d=0.6,fade=t=out:st=6.4:d=0.6,format=yuv420p"
    : "scale=2160:3840,zoompan=z='min(zoom+0.00065,1.12)':d=210:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,fade=t=in:st=0:d=0.6,fade=t=out:st=6.4:d=0.6,format=yuv420p";
  execFileSync('ffmpeg', ['-y', '-loop', '1', '-i', adPng, '-vf', f, '-t', '7', '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-movflags', '+faststart', outMp4], { stdio: 'ignore' });
}

// ───────────────────────── PRODUKT-MODUS ─────────────────────────
// Echtes Produktfoto (z.B. SolisPanel) als Hero — KEINE KI-Produkt-Erfindung.
const PRODUCT_SYSTEM = `Du bist Creative Director einer Weltklasse-Luxus-Markenagentur (30+ Jahre) für redtreat — premium Schweizer Longevity- & Wellness-Marke. Du textest eine PRODUKT-Anzeige für ein echtes Hardware-Produkt (z.B. Rotlicht/NIR-Panel). Es ist WELLNESS, niemals Medizin.
Dir wird ein FOTO des echten Produkts gezeigt und ein Brief mit den Produkt-Eckdaten. Das Foto wird unverändert als Hero verwendet — DU erfindest kein Produkt, du schreibst nur die Marken-Copy + ordnest die Specs.
Harte Regeln: Display-Copy klein mit Punkt ("dein licht."). KEINE Medizin-/Heilaussagen (heilen/Therapie/Diagnose/Krankheit/Symptom/schmerzfrei). Kein "Made in" (→ "Designed in Switzerland"). Nur EIN Rot. Established 2024. Erfinde KEINE Messwerte/Zahlen — nutze NUR Specs, die im Brief stehen. Wenn eine Spec nicht im Brief steht, lass sie weg.
Copy: headline genau 2 Zeilen je 1–3 Wörter, klein, mit Punkt; kicker 2–3 Wörter; sub EIN eleganter Nutzen-Satz (≤12 Wörter, kein Heilversprechen); cta 1–2 Wörter; priceLine kurz in GROSSBUCHSTABEN (z.B. "JETZT AUF REDTREAT.CH" oder Aktionspreis falls im Brief).
specs: GENAU 4 Einträge je { value, label }. value = die Kennzahl/das Merkmal kurz (z.B. "8", "180 mW/cm²", "IPX7", "1 Taste"); label = kurze Erklärung (z.B. "Wellenlängen", "max. Leistung", "wasserfest", "Bedienung"). Nimm die echten Werte aus dem Brief.
layout: wähle das Design, das am besten zum Brief/Wunsch passt — 'spotlight' (Produkt im Fokus, schwebend, Spec-Karte; Standard), 'editorial' (große Typo links, Foto rechts über volle Höhe; magazinig), 'split' (Plakat: Foto oben, Textblock unten), 'minimal' (sehr reduziert, viel Raum, eine Claim-Zeile). Wenn der Brief einen Stil nennt (z.B. "minimalistisch", "magazine", "plakativ"), richte dich danach.
scenePrompt: ein art-directed ENGLISCHER Foto-Prompt für die UMGEBUNG, in die das echte Produkt später montiert wird (Hybrid). Beschreibe einen premium, ruhigen Innenraum mit VIEL freier Fläche in der unteren Bildmitte (wo das Produkt stehen wird); warmes natürliches Licht, edle Materialien (Stein, Holz, Leinen, Glas), Schweizer Ruhe, viel Negativraum oben. WICHTIG: KEIN Produkt, KEINE Geräte, KEINE Personen, kein Text. Ende mit "photorealistic, editorial, empty room, lots of empty floor space in the center, no products, no people, no text".`;

const PRODUCT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    kicker: { type: 'STRING' }, headline: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 2, maxItems: 2 },
    sub: { type: 'STRING' }, cta: { type: 'STRING' }, priceLine: { type: 'STRING' },
    layout: { type: 'STRING', enum: ['spotlight', 'editorial', 'split', 'minimal'] },
    scenePrompt: { type: 'STRING' },
    specs: { type: 'ARRAY', minItems: 4, maxItems: 4, items: {
      type: 'OBJECT', properties: { value: { type: 'STRING' }, label: { type: 'STRING' } }, required: ['value', 'label'] } },
  },
  required: ['kicker', 'headline', 'sub', 'cta', 'priceLine', 'layout', 'scenePrompt', 'specs'],
};

function fallbackProductBrief(briefText) {
  return {
    kicker: 'designed in switzerland',
    headline: ['dein licht.', 'dein moment.'],
    sub: 'Premium Wellness-Licht, designed in Switzerland.',
    cta: 'mehr erfahren.', priceLine: 'JETZT AUF REDTREAT.CH', layout: 'spotlight',
    scenePrompt: 'A serene premium minimalist interior, warm natural light, stone and wood and linen, calm Swiss atmosphere, large empty floor space in the center, lots of negative space at the top, photorealistic, editorial, empty room, no products, no people, no text',
    specs: [
      { value: 'Swiss', label: 'Design' }, { value: 'Premium', label: 'Materialien' },
      { value: '1 Taste', label: 'Bedienung' }, { value: 'Wellness', label: 'für jeden Tag' },
    ],
  };
}

async function productDirector(briefText, env, productFile) {
  try {
    const key = env.GEMINI_API_KEY; if (!key) throw new Error('GEMINI_API_KEY fehlt');
    const b = fs.readFileSync(productFile);
    const parts = [
      { text: 'Foto des echten Produkts (wird als Hero verwendet):' },
      { inline_data: { mime_type: mimeOf(b), data: b.toString('base64') } },
      { text: `Produkt-Brief / Eckdaten: "${briefText}". Liefere die Anzeigen-Copy + 4 Specs als JSON.` },
    ];
    const j = await callGemini(env, { systemInstruction: { parts: [{ text: PRODUCT_SYSTEM }] }, contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', responseSchema: PRODUCT_SCHEMA, temperature: 0.9 } });
    return JSON.parse(j.candidates[0].content.parts.find(p => p.text).text);
  } catch (e) {
    console.warn('   ⚠️  Produkt-Director (Google) nicht verfügbar: ' + e.message.slice(0, 70) + ' — nutze Marken-Vorlage.');
    return fallbackProductBrief(briefText);
  }
}

async function productMain(briefText, want, makeReels, env) {
  const fmt = brand.formats.story;
  const imgs = fs.existsSync(REFS) ? fs.readdirSync(REFS).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort() : [];
  if (!imgs.length) { console.error('❌ Produkt-Modus: bitte lade ein echtes Produktfoto hoch.'); process.exit(5); }

  // Director nutzt das erste Foto als Kontext für die Copy.
  const refPng = path.join(CAND, 'use_ref.png');
  fs.copyFileSync(path.join(REFS, imgs[0]), refPng);
  console.log(`📸 ${imgs.length} Lifestyle-Foto(s) · Panel in Anwendung`);

  console.log('🎬 Creative Director schreibt die Copy …');
  const d = await productDirector(briefText, env, refPng);
  console.log(`   "${d.headline.join(' ')}"  —  ${d.kicker}`);

  const briefBase = { format: 'story', kicker: d.kicker, headline: d.headline, sub: d.sub, cta: d.cta };
  const { hard } = lint(briefBase); if (hard.length) { console.error('❌ Brand:', hard.join('; ')); process.exit(2); }

  // Jede Anzeige = ein echtes Lifestyle-Foto (zyklisch), dunkles Editorial, Titel mal unten/mal oben. KEINE Specs.
  const composes = ['bottom', 'top'];
  const variants = ['glow', 'warm', 'mono'];
  console.log(`🎨 Baue ${want} Anzeigen (Panel in Anwendung, dunkel) …`);
  const ads = [];
  for (let k = 0; k < want; k++) {
    const src = imgs[k % imgs.length];
    fs.copyFileSync(path.join(REFS, src), path.join(CAND, `use_${k + 1}.png`));
    const brief = { ...briefBase, name: `ad_${k + 1}`, photo: `studio/use_${k + 1}.png`, compose: composes[k % composes.length], bgVariant: variants[k % variants.length] };
    const outPng = path.join(OUT, `ad_${k + 1}.png`);
    if (await renderPNG(buildInUseHTML(brief), outPng, fmt)) { ads.push(outPng); process.stdout.write(`✓${k + 1} `); }
  }
  console.log('');

  const reels = [];
  if (makeReels && ads.length) {
    console.log('🎞️  Baue Produkt-Reel (sanfter Zoom) …');
    for (let i = 0; i < Math.min(2, ads.length); i++) {
      const mp4 = path.join(REELS, `reel_${i + 1}.mp4`);
      try { makeReel(ads[i], mp4, i % 2 ? 'pan' : 'zoom'); reels.push(mp4); process.stdout.write(`✓${i + 1} `); }
      catch (e) { console.warn('   Reel-Fehler:', e.message); }
    }
    console.log('');
  } else if (!makeReels) { console.log('🎞️  Reels übersprungen (deaktiviert).'); }

  await closeBrowser();
  console.log('\n✅ FERTIG:');
  ads.forEach(a => console.log('   🖼️ ', a));
  reels.forEach(r => console.log('   🎞️ ', r));
}

// ───────────────────────── CLEAN-STUDIO-MODUS ─────────────────────────
// Heller, minimalistischer Look (Omnilux/CurrentBody): echtes Produkt freigestellt + roter Glow auf Creme. Kein FLUX.
async function studioMain(briefText, want, makeReels, env) {
  const fmt = brand.formats.story;
  const imgs = fs.existsSync(REFS) ? fs.readdirSync(REFS).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort() : [];
  if (!imgs.length) { console.error('❌ Clean-Studio: bitte lade ein Produktfoto hoch.'); process.exit(5); }

  console.log('✂️  Stelle das echte Produkt frei …');
  const cutPng = path.join(CAND, 'cutout.png');
  try { await cutoutBackground(path.join(REFS, imgs[0]), cutPng); }
  catch (e) { console.error('❌ Freistellen fehlgeschlagen:', e.message); process.exit(6); }

  console.log('🎬 Creative Director schreibt die Copy …');
  const d = await productDirector(briefText, env, cutPng);
  console.log(`   "${d.headline.join(' ')}"  —  ${d.kicker}`);

  const briefBase = {
    format: 'story', photo: 'studio/cutout.png',
    kicker: d.kicker, headline: d.headline, sub: d.sub, specs: d.specs,
    cta: d.cta, store: d.priceLine || 'JETZT AUF REDTREAT.CH',
  };
  const { hard } = lint(briefBase); if (hard.length) { console.error('❌ Brand:', hard.join('; ')); process.exit(2); }

  const variants = ['glow', 'warm', 'mono', 'glow', 'warm', 'mono', 'glow', 'warm'];
  console.log(`🎨 Baue ${want} Editorial-Anzeigen …`);
  const ads = [];
  for (let k = 0; k < want; k++) {
    const brief = { ...briefBase, name: `ad_${k + 1}`, bgVariant: variants[k % variants.length] };
    const outPng = path.join(OUT, `ad_${k + 1}.png`);
    if (await renderPNG(buildEditorialHTML(brief), outPng, fmt)) { ads.push(outPng); process.stdout.write(`✓${k + 1} `); }
  }
  console.log('');

  const reels = [];
  if (makeReels && ads.length) {
    console.log('🎞️  Baue Reel (sanfter Zoom) …');
    for (let i = 0; i < Math.min(2, ads.length); i++) {
      const mp4 = path.join(REELS, `reel_${i + 1}.mp4`);
      try { makeReel(ads[i], mp4, i % 2 ? 'pan' : 'zoom'); reels.push(mp4); process.stdout.write(`✓${i + 1} `); }
      catch (e) { console.warn('   Reel-Fehler:', e.message); }
    }
    console.log('');
  } else if (!makeReels) { console.log('🎞️  Reels übersprungen (deaktiviert).'); }

  await closeBrowser();
  console.log('\n✅ FERTIG:');
  ads.forEach(a => console.log('   🖼️ ', a));
  reels.forEach(r => console.log('   🎞️ ', r));
}

// ───────────────────────── HYBRID-MODUS ─────────────────────────
// KI generiert eine neue UMGEBUNG (FLUX) — das echte, freigestellte Produkt wird reinmontiert.
async function hybridMain(briefText, want, makeReels, env) {
  const fmt = brand.formats.story;
  const imgs = fs.existsSync(REFS) ? fs.readdirSync(REFS).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort() : [];
  if (!imgs.length) { console.error('❌ Hybrid-Modus: bitte lade ein Produktfoto hoch.'); process.exit(5); }

  // 1) Produkt freistellen (Hintergrund → transparent)
  console.log('✂️  Stelle das echte Produkt frei …');
  const cutPng = path.join(CAND, 'cutout.png');
  try { await cutoutBackground(path.join(REFS, imgs[0]), cutPng); }
  catch (e) { console.error('❌ Freistellen fehlgeschlagen:', e.message); process.exit(6); }

  // 2) Copy + Szene-Prompt
  console.log('🎬 Creative Director schreibt Copy + KI-Szene …');
  const d = await productDirector(briefText, env, cutPng);
  console.log(`   "${d.headline.join(' ')}"  —  ${d.kicker}`);

  // 3) KI-Szenen generieren (FLUX, produkt-/personenfrei)
  const scenePrompt = (d.scenePrompt || 'A serene premium minimalist interior, warm natural light')
    + ', empty room, lots of empty floor space in the center, no products, no devices, no people, no text';
  console.log(`🖼️  Generiere ${want} KI-Szenen (FLUX) …`);
  const scenes = [];
  for (let i = 0; i < want + 2 && scenes.length < want; i++) {
    try { scenes.push(await generate(scenePrompt, null, fmt.w, fmt.h, env)); process.stdout.write('.'); }
    catch { process.stdout.write('x'); }
  }
  console.log('');
  if (!scenes.length) { console.error('❌ Keine KI-Szene generiert (FLUX-Limit?).'); process.exit(3); }

  const briefBase = {
    format: 'story', logo: 'assets/logo_tx.png', photo: 'studio/cutout.png',
    kicker: d.kicker, headline: d.headline, sub: d.sub, specs: d.specs,
    cta: d.cta, store: d.priceLine || 'JETZT AUF REDTREAT.CH',
  };
  const { hard } = lint(briefBase); if (hard.length) { console.error('❌ Brand:', hard.join('; ')); process.exit(2); }

  const variants = ['glow', 'warm', 'mono'];
  console.log(`🎨 Montiere das echte Produkt in ${scenes.length} KI-Szenen …`);
  const ads = [];
  for (let k = 0; k < scenes.length; k++) {
    fs.writeFileSync(path.join(CAND, `scene_${k + 1}.png`), scenes[k]);
    const brief = { ...briefBase, name: `ad_${k + 1}`, scene: `studio/scene_${k + 1}.png`, bgVariant: variants[k % variants.length] };
    const outPng = path.join(OUT, `ad_${k + 1}.png`);
    if (await renderPNG(buildHybridHTML(brief), outPng, fmt)) { ads.push(outPng); process.stdout.write(`✓${k + 1} `); }
  }
  console.log('');

  const reels = [];
  if (makeReels && ads.length) {
    console.log('🎞️  Baue Reel (sanfter Zoom) …');
    for (let i = 0; i < Math.min(2, ads.length); i++) {
      const mp4 = path.join(REELS, `reel_${i + 1}.mp4`);
      try { makeReel(ads[i], mp4, i % 2 ? 'pan' : 'zoom'); reels.push(mp4); process.stdout.write(`✓${i + 1} `); }
      catch (e) { console.warn('   Reel-Fehler:', e.message); }
    }
    console.log('');
  } else if (!makeReels) { console.log('🎞️  Reels übersprungen (deaktiviert).'); }

  await closeBrowser();
  console.log('\n✅ FERTIG:');
  ads.forEach(a => console.log('   🖼️ ', a));
  reels.forEach(r => console.log('   🎞️ ', r));
}

async function main() {
  const briefText = process.argv[2];
  const want = Math.max(1, Math.min(8, Number(process.argv[3]) || 8));
  const makeReels = process.argv[4] !== '0';
  const mode = process.argv[5] || 'lifestyle';
  if (!briefText) { console.error('Usage: node studio.js "<brief>" [anzahl=8] [reels=1] [mode=lifestyle|product]'); process.exit(1); }
  const env = loadEnv();
  if (mode === 'product') return productMain(briefText, want, makeReels, env);
  if (mode === 'studio') return studioMain(briefText, want, makeReels, env);
  if (mode === 'hybrid') return hybridMain(briefText, want, makeReels, env);
  const fmt = brand.formats.story;

  console.log('🎬 Creative Director liest Referenzen + Brief …');
  const { d, refCount } = await director(briefText, env);
  console.log(`   ${refCount} Referenzbild(er) · "${d.headline.join(' ')}"  —  ${d.kicker}`);

  const sv = Math.max(80, Math.min(96, d.scoreValue || 90));
  const briefBase = {
    format: 'story', logo: 'assets/logo_tx.png',
    kicker: d.kicker, headline: d.headline, sub: d.sub, cardLabel: 'SCORE ◆ HEUTE',
    score: { value: sv, label: 'LONGEVITY' },
    stats: [{ k: 'RECOVERY', v: String(Math.min(98, sv + 4)), unit: '%' }, { k: 'SLEEP', v: '8:12' }],
    twoCol: [{ v: '58', l: 'BPM' }, { v: '6.4', l: 'STRAIN' }],
    cta: d.cta, store: 'GRATIS IM APP STORE',
  };
  const { hard } = lint({ ...briefBase, photo: 'x', imagePrompt: d.imagePrompt }); if (hard.length) { console.error('❌ Brand:', hard.join('; ')); process.exit(2); }

  const nCand = Number(env.STUDIO_CANDIDATES) || (want + 4);
  console.log(`🖼️  Generiere ${nCand} Foto-Varianten (FLUX) …`);
  const buffers = [];
  for (let i = 0; i < nCand; i++) { try { buffers.push(await generate(d.imagePrompt, null, fmt.w, fmt.h, env)); process.stdout.write('.'); } catch { process.stdout.write('x'); } }
  console.log('');
  if (!buffers.length) {
    console.log('⚠️  Alle Varianten blockiert — Fallback-Szene ohne Person …');
    const safeScene = 'A serene premium wellness scene: warm wood, soft steam, calm editorial light, minimalist spa interior, no people, photorealistic, lots of empty space at the top';
    for (let i = 0; i < Math.min(4, nCand); i++) { try { buffers.push(await generate(safeScene, null, fmt.w, fmt.h, env)); process.stdout.write('.'); } catch { process.stdout.write('x'); } }
    console.log('');
  }
  if (!buffers.length) { console.error('❌ Keine Bilder generiert'); process.exit(3); }

  const ranked = await qcRank(buffers, env);
  const chosen = ranked.slice(0, want);
  console.log(`🎨 Baue ${chosen.length} Anzeigen …`);
  const ads = [];
  for (let k = 0; k < chosen.length; k++) {
    const bi = chosen[k];
    const cand = path.join(CAND, `cand_${k + 1}.png`); fs.writeFileSync(cand, buffers[bi]);
    const brief = { ...briefBase, name: `ad_${k + 1}`, photo: `studio/cand_${k + 1}.png` };
    const outPng = path.join(OUT, `ad_${k + 1}.png`);
    if (await renderPNG(buildHTML(brief), outPng, fmt)) { ads.push(outPng); process.stdout.write(`✓${k + 1} `); }
  }
  console.log('');

  const reels = [];
  if (makeReels) {
    console.log('🎞️  Baue 2 Explainer-Reels …');
    const feats = ['longevity-score', 'gps-lauf', 'schlaf & recovery', 'food-tracking'];
    for (let i = 0; i < Math.min(2, chosen.length); i++) {
      const cfg = { hero: `input/studio/cand_${i + 1}.png`, appHome: 'assets/app_home.png', logo: 'assets/logo_tx.png',
        kicker: d.kicker, headline: d.headline, score: sv, cta: d.cta, features: feats };
      const mp4 = path.join(REELS, `reel_${i + 1}.mp4`);
      try { await renderReel(cfg, mp4); reels.push(mp4); process.stdout.write(`✓${i + 1} `); } catch (e) { console.warn('   Reel-Fehler:', e.message); }
    }
    console.log('');
  } else { console.log('🎞️  Reels übersprungen (deaktiviert).'); }

  await closeBrowser();
  console.log('\n✅ FERTIG:');
  ads.forEach(a => console.log('   🖼️ ', a));
  reels.forEach(r => console.log('   🎞️ ', r));
}
main().catch(e => { console.error('❌ Studio:', e.message); process.exit(4); });
