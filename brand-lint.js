/**
 * Brand-Linter: prüft einen Brief gegen die redtreat-Regeln BEVOR gerendert wird.
 * Gibt { hard: [...], soft: [...] } zurück. Bei hard-Verstößen baut der Renderer nichts.
 */
const brand = require('./brand.config');

function collectText(brief) {
  const parts = [];
  const push = (v) => { if (typeof v === 'string') parts.push(v); };
  push(brief.kicker); push(brief.sub); push(brief.cta); push(brief.store); push(brief.badge);
  (brief.headline || []).forEach(push);
  (brief.stats || []).forEach(s => { push(s.k); });
  (brief.specs || []).forEach(s => { push(s.value); push(s.label); });
  return parts;
}

function lint(brief) {
  const hard = [], soft = [];
  const texts = collectText(brief);
  const r = brand.rules;

  for (const t of texts) {
    for (const re of r.forbiddenClaims)
      if (re.test(t)) hard.push(`Medizin-/Heilaussage nicht erlaubt: „${t}" (${re})`);
    for (const re of r.forbiddenOrigin)
      if (re.test(t)) hard.push(`Herkunft falsch: „${t}" → nutze „${brand.origin}"`);
    for (const re of r.discouraged)
      if (re.test(t)) soft.push(`Heikle Formulierung: „${t}" (${re})`);
  }

  // Logo muss aus der erlaubten Liste kommen.
  const logo = (brief.logo || brand.logo.white).replace(/\\/g, '/');
  if (!r.allowedLogos.includes(logo))
    hard.push(`Logo „${logo}" ist nicht erlaubt. Erlaubt: ${r.allowedLogos.join(', ')}`);

  // Headline-Zeilen nicht zu lang.
  (brief.headline || []).forEach((line, i) => {
    if (line.length > r.maxHeadlineChars)
      soft.push(`Headline-Zeile ${i + 1} ist lang (${line.length}>${r.maxHeadlineChars}): „${line}"`);
  });

  // Format muss bekannt sein.
  if (brief.format && !brand.formats[brief.format])
    hard.push(`Unbekanntes Format „${brief.format}". Erlaubt: ${Object.keys(brand.formats).join(', ')}`);

  return { hard, soft };
}

module.exports = { lint };
