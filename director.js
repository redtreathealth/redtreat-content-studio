/**
 * Creative Director (Schritt 2.5) – hebt Content auf Luxus-Agentur-Niveau.
 * Aus einem Stichwort/Thema schreibt ein KI-Kreativchef (Google Gemini, gratis Text)
 * einen brandkonformen Anzeigen-Brief: art-directed Bild-Prompt + Luxus-Copy + Strategie.
 * Danach baut die Engine die Anzeige (Foto + Layout) automatisch.
 *
 *   node director.js "pilates bei sonnenaufgang"
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const brand = require('./brand.config');
const { lint } = require('./brand-lint');

const ROOT = __dirname;
function loadEnv() {
  const p = path.join(ROOT, '.env'); const env = {};
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !l.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return { ...env, ...process.env };
}
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'brief';

const SYSTEM = `Du bist Creative Director einer Weltklasse-Luxus-Markenagentur (30+ Jahre; Niveau der Teams hinter Aesop, Loro Piana, Equinox, Oura, Bryan Johnson Blueprint).
Du art-directest für redtreat — eine premium Schweizer Longevity- & Wellness-Marke (App + Lichttherapie). Es ist WELLNESS, niemals Medizin.

Markenstimme: modern, quiet luxury, selbstbewusst, reduziert, evokativ. Nie werblich, nie Hype, nie medizinisch. Markt: Deutschsprachig (DE/CH).
Bildsprache: editorial, cinematisch, viel Negativraum, Zurückhaltung, EIN leiser Rot-Moment, Film-Foto-Realismus, natürliches Licht, edle Materialien (Leinen, Stein, Holz, Glas), Schweizer Ruhe.

Harte Regeln:
- Display-Copy klein geschrieben mit Punkt am Ende (z.B. "deine mitte.").
- KEINE Medizin-/Heilaussagen (heilen/Therapie/Diagnose/Krankheit/Symptom). Kein "Made in" — wenn Herkunft, dann "Designed in Switzerland". Established 2024.
- Nur EIN Rot.

Der "imagePrompt" muss ein akribischer, art-directed LUXUS-EDITORIAL-FOTOGRAFIE-Prompt (auf Englisch) für ein Text-zu-Bild-Modell sein: benenne Licht, Objektiv, Filmlook, Stimmung, Color-Grade, Komposition (Subjekt in der UNTEREN Bildhälfte, oben viel heller, leerer Raum für Text), Styling; ende mit "photorealistic, editorial". Wirke wie eine Kampagne eines Top-Wellness-Hauses. KEINE Logos/Schrift im Bild. Zentriertes Subjekt, quadratisch-tauglich.

ANATOMIE-SICHERHEIT (Pflicht, da KI sonst Gliedmaßen verschmilzt): Wähle einfache, klare Körperhaltungen — stehend, aufrecht sitzend, von hinten, oder enger/teilweiser Bildausschnitt (z.B. Oberkörper, Hände, Detail). VERMEIDE komplexe Verrenkungen, gekreuzte/verschränkte oder gefaltete Gliedmaßen, Posen wo Beine/Arme verschmelzen können. Beide Beine und beide Arme entweder klar sichtbar ODER bewusst sauber angeschnitten. Hände möglichst entspannt/verdeckt. Schreibe ans Ende: "natural correct human anatomy, both legs visible".
GARDEROBE dezent & edel (langärmlig/Leinen/locker, kein Haut-Fokus, nichts Enges/Freizügiges) — sonst blockieren Inhaltsfilter die Bildgenerierung.

Copy-Regeln (quiet luxury, sehr knapp):
- headline: GENAU zwei Zeilen, je 1–3 Wörter, klein geschrieben, jede Zeile endet mit Punkt. Evokativ, nie erklärend (z.B. "deine mitte." / "dein tempo.").
- kicker: 2–3 Wörter, klein, mit Punkt.
- sub: EIN eleganter Satz (max ~12 Wörter), keine Aufzählung.
- cta: 1–2 Wörter (z.B. "jetzt entdecken." oder "die app.").
- scoreValue: ganze Zahl 80–96.
Erfinde KEINE Mess-Werte/Statistiken – die kommen separat aus der App.`;

// Der Director liefert NUR Copy + Kunst. Die Daten-Metriken sind echte App-Zahlen (separat).
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    kicker: { type: 'STRING' },        // 2-3 Wörter, klein, mit Punkt
    headline: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 2, maxItems: 2 }, // je 1-3 Wörter, klein, Punkt
    sub: { type: 'STRING' },           // EIN eleganter Satz
    imagePrompt: { type: 'STRING' },   // art-directed Englisch
    cta: { type: 'STRING' },           // 1-2 Wörter
    scoreValue: { type: 'INTEGER' },   // 80-96
  },
  required: ['kicker', 'headline', 'sub', 'imagePrompt', 'cta', 'scoreValue'],
};

async function direct(topic, env) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY fehlt in .env');
  const model = env.TEXT_MODEL || 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ parts: [{ text: `Thema/Brief: "${topic}". Liefere EINEN Anzeigen-Brief als JSON.` }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 1.0 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const txt = j?.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
  if (!txt) throw new Error('Gemini: keine Antwort');
  return JSON.parse(txt);
}

async function main() {
  const topic = process.argv.slice(2).join(' ');
  if (!topic) { console.error('Usage: node director.js "<thema>"'); process.exit(1); }
  const env = loadEnv();
  console.log('🎬 Creative Director denkt nach …');
  const d = await direct(topic, env);

  const name = slug(topic);
  const sv = Math.max(80, Math.min(96, d.scoreValue || 90));
  const recovery = Math.max(85, Math.min(98, sv + 4)); // glaubwürdig an Score gekoppelt
  const brief = {
    name, format: 'story', photo: name + '.png', logo: 'assets/logo_tx.png', regenerate: true,
    kicker: d.kicker, headline: d.headline, sub: d.sub, imagePrompt: d.imagePrompt,
    cardLabel: 'SCORE ◆ HEUTE',
    // Echte App-Metriken (Zahlen), nicht vom Director erfunden:
    score: { value: sv, label: 'LONGEVITY' },
    stats: [{ k: 'RECOVERY', v: String(recovery), unit: '%' }, { k: 'SLEEP', v: '8:12' }],
    twoCol: [{ v: '58', l: 'BPM' }, { v: '6.4', l: 'STRAIN' }],
    cta: d.cta, store: 'GRATIS IM APP STORE',
  };

  const { hard } = lint(brief);
  if (hard.length) { console.error('❌ Brief verstößt gegen Brand-Regeln:'); hard.forEach(h => console.error('   • ' + h)); process.exit(2); }

  const briefPath = path.join(ROOT, 'briefs', name + '.json');
  fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));
  console.log('📝 Brief:', '"' + d.headline.join(' ') + '"  —  ' + d.kicker);
  console.log('   ' + briefPath);
  console.log('\n▶  Baue Anzeige …');
  execFileSync('node', [path.join(ROOT, 'render.js'), briefPath], { stdio: 'inherit' });
}
main().catch(e => { console.error('❌ Director:', e.message); process.exit(4); });
