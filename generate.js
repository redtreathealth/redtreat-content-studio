/**
 * Bild-Generator (Schritt 2). Erzeugt aus einem Text-Prompt ein Foto.
 * Aktuell: Google AI Studio (gratis Key). Provider per .env (IMAGE_PROVIDER).
 *
 *   node generate.js "<prompt>" <outPath> <width> <height>
 *
 * Läuft als Subprozess von render.js – hält den Renderer synchron & einfach.
 */
const fs = require('fs');
const path = require('path');

// winziger .env-Loader (keine Abhängigkeit nötig)
function loadEnv() {
  const p = path.join(__dirname, '.env');
  const env = {};
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return { ...env, ...process.env };
}

function aspect(w, h) {
  const r = w / h;
  if (Math.abs(r - 1) < 0.05) return '1:1';
  if (r < 1) return (h / w > 1.6 ? '9:16' : '3:4');
  return (r > 1.6 ? '16:9' : '4:3');
}

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

// Hochformat-Maße (Vielfache von 8) je nach Zielformat – damit oben Platz für Text bleibt.
function portraitDims(w, h) {
  const a = aspect(w, h);
  if (a === '9:16') return { width: 768, height: 1344 };
  if (a === '3:4') return { width: 896, height: 1152 };
  return { width: 1024, height: 1024 };
}

// --- Cloudflare Workers AI (gratis-Kontingent, FLUX/SDXL) ---
async function cloudflare(prompt, w, h, env) {
  const acct = env.CF_ACCOUNT_ID, token = env.CF_API_TOKEN;
  if (!acct || !token) throw new Error('CF_ACCOUNT_ID / CF_API_TOKEN fehlen in .env');
  const model = env.CF_MODEL || '@cf/black-forest-labs/flux-1-schnell';
  // FLUX: nur {prompt, steps} (quadratisch 1024, beste Qualität). SDXL: width/height + num_steps.
  const isFlux = /flux/i.test(model);
  const d = portraitDims(w, h);
  // Sicherheits-Zusatz gegen NSFW-Blocks (Sauna/Body-Motive)
  const safe = prompt + ', tasteful editorial, fully clothed, modest spa robe or towel, no nudity, no bare skin';
  const body = isFlux ? { prompt: safe, steps: 8 } : { prompt: safe, width: d.width, height: d.height, num_steps: 20 };
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${model}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Cloudflare ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const j = await res.json();
    const b64 = j?.result?.image;
    if (!b64) throw new Error('Cloudflare: kein Bild in der Antwort');
    return Buffer.from(b64, 'base64');
  }
  return Buffer.from(await res.arrayBuffer());
}

async function geminiImagen(prompt, w, h, key) {
  const url = `${GEMINI}/imagen-4.0-generate-001:predict?key=${key}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: aspect(w, h) },
    }),
  });
  if (!res.ok) throw new Error(`Imagen ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const b64 = j?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Imagen: kein Bild in der Antwort');
  return Buffer.from(b64, 'base64');
}

async function geminiFlashImage(prompt, model, key) {
  const url = `${GEMINI}/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const parts = j?.candidates?.[0]?.content?.parts || [];
  const img = parts.find(p => p.inlineData?.data);
  if (!img) throw new Error(`${model}: kein Bild in der Antwort`);
  return Buffer.from(img.inlineData.data, 'base64');
}

async function generate(prompt, outPath, w, h, env) {
  env = env || loadEnv();
  const provider = (env.IMAGE_PROVIDER || 'gemini').toLowerCase();

  if (provider === 'cloudflare') {
    return await cloudflare(prompt, w, h, env);
  }

  if (provider === 'gemini') {
    const key = env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY fehlt in .env');
    // Hinweis: Bilder brauchen bei Google ein Bezahl-Konto. Reihenfolge mit aktuellen Modellen.
    const attempts = [
      () => geminiImagen(prompt, w, h, key),
      () => geminiFlashImage(prompt, 'gemini-3.1-flash-image', key),
      () => geminiFlashImage(prompt, 'gemini-2.5-flash-image', key),
    ];
    let lastErr;
    for (const a of attempts) {
      try { return await a(); } catch (e) { lastErr = e; console.warn('   … ' + e.message); }
    }
    throw lastErr;
  }
  throw new Error(`Provider "${provider}" noch nicht implementiert`);
}

const mimeOf = (b) => (b[0] === 0xFF && b[1] === 0xD8) ? 'image/jpeg' : 'image/png';

// Strenge Bild-QC: vergleicht alle Kandidaten, wählt den anatomisch fehlerfreien & edelsten.
async function qcPick(buffers, env) {
  const key = env.GEMINI_API_KEY;
  if (!key || buffers.length < 2) return 0;
  const parts = [{ text:
    `Du bist die gnadenlose Bild-QC einer Luxus-Werbeagentur. Unten ${buffers.length} Foto-Kandidaten (Index 0..${buffers.length - 1}, in Reihenfolge).
Lehne JEDES Bild mit Anatomie-Fehlern ab: fehlende/zusätzliche/verschmolzene Gliedmaßen, nicht genau zwei klar erkennbare ODER sauber angeschnittene Beine und Arme, verzerrte Hände/Füße/Gesichter, unmögliche Gelenke, doppelte Köpfe.
Wähle den EINEN besten: fehlerfreie Anatomie UND edelster, editorialer Luxus-Look. Antworte NUR JSON {"best":INDEX,"reason":"kurz"}.` }];
  buffers.forEach((b, i) => { parts.push({ text: `Bild ${i}:` }); parts.push({ inline_data: { mime_type: mimeOf(b), data: b.toString('base64') } }); });
  try {
    const r = await fetch(`${GEMINI}/${env.TEXT_MODEL || 'gemini-2.5-flash'}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } }),
    });
    const j = await r.json();
    const t = j?.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
    const pick = JSON.parse(t);
    console.log(`   🔎 QC: Bild ${pick.best} gewählt — ${pick.reason || ''}`);
    return Math.max(0, Math.min(buffers.length - 1, pick.best | 0));
  } catch (e) { console.warn('   … QC übersprungen:', e.message); return 0; }
}

// Wie qcPick, aber liefert ALLE fehlerfreien Indizes (beste zuerst) – für "Top-N auswählen".
async function qcRank(buffers, env) {
  const key = env.GEMINI_API_KEY;
  if (!key || buffers.length < 2) return buffers.map((_, i) => i);
  const parts = [{ text:
    `Du bist die gnadenlose Bild-QC einer Luxus-Werbeagentur. Unten ${buffers.length} Kandidaten (Index 0..${buffers.length - 1}).
Bewerte jeden streng auf KORREKTE ANATOMIE (keine fehlenden/zusätzlichen/verschmolzenen Gliedmaßen, saubere Hände/Füße/Gesichter, unmögliche Gelenke) UND Luxus-Editorial-Look.
Antworte NUR JSON {"clean":[Indizes der fehlerfreien, BESTE zuerst],"rejected":[Indizes mit Fehlern]}.` }];
  buffers.forEach((b, i) => { parts.push({ text: `Bild ${i}:` }); parts.push({ inline_data: { mime_type: mimeOf(b), data: b.toString('base64') } }); });
  try {
    const r = await fetch(`${GEMINI}/${env.TEXT_MODEL || 'gemini-2.5-flash'}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } }),
    });
    const j = await r.json();
    const o = JSON.parse(j?.candidates?.[0]?.content?.parts?.find(p => p.text)?.text);
    const clean = (o.clean || []).filter(i => i >= 0 && i < buffers.length);
    console.log(`   🔎 QC: ${clean.length}/${buffers.length} anatomisch fehlerfrei`);
    return clean.length ? clean : buffers.map((_, i) => i);
  } catch (e) { console.warn('   … QC-Rank übersprungen:', e.message); return buffers.map((_, i) => i); }
}

async function generateBest(prompt, w, h, n, env) {
  console.log(`   … generiere ${n} Varianten …`);
  const buffers = [];
  for (let i = 0; i < n; i++) {
    try { buffers.push(await generate(prompt, null, w, h, env)); } catch (e) { console.warn('   … Variante fehlgeschlagen:', e.message); }
  }
  if (!buffers.length) throw new Error('keine Variante generiert');
  const idx = await qcPick(buffers, env);
  return buffers[idx];
}

async function main() {
  const [, , prompt, outPath, w, h, nArg] = process.argv;
  if (!prompt || !outPath) { console.error('Usage: node generate.js "<prompt>" <outPath> <w> <h> [n]'); process.exit(1); }
  const env = loadEnv();
  const n = Number(nArg) || Number(env.CANDIDATES) || 1;
  const buf = n > 1
    ? await generateBest(prompt, Number(w) || 1080, Number(h) || 1920, n, env)
    : await generate(prompt, outPath, Number(w) || 1080, Number(h) || 1920);
  fs.writeFileSync(outPath, buf);
  console.log('   ✓ Foto generiert:', outPath, `(${Math.round(buf.length / 1024)} KB)`);
}
if (require.main === module) main().catch(e => { console.error('❌ Generator:', e.message); process.exit(4); });
module.exports = { generate, generateBest, qcRank };
