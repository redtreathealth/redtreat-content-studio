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
const { buildHTML, renderPNG } = require('./render');
const { renderReel } = require('./reelmaker');
const { closeBrowser } = require('./browser');

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
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.TEXT_MODEL || 'gemini-2.5-flash'}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 1.0 } }),
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 120)}`);
    const j = await r.json();
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

async function main() {
  const briefText = process.argv[2];
  const want = Math.max(1, Math.min(8, Number(process.argv[3]) || 8));
  const makeReels = process.argv[4] !== '0';
  if (!briefText) { console.error('Usage: node studio.js "<brief>" [anzahl=8]'); process.exit(1); }
  const env = loadEnv();
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
