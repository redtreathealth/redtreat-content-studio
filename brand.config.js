/**
 * redtreat – Brand Guidelines als Code (Issue 2026, offiziell).
 * EINZIGE Quelle der Wahrheit für Farben, Logo, Schrift, Layout, Aussagen.
 * Renderer + Brand-Linter lesen nur von hier → Ergebnis kann nicht off-brand werden.
 */
module.exports = {
  name: 'redtreat',
  origin: 'Designed in Switzerland', // NIE "Made in ..."
  established: 2024,

  // --- Farben (offizielles Guideline) ---
  colors: {
    red:    '#E10600', // EIN Signal-Rot. Nie geflutet, ein dominanter Rot-Moment pro Layout.
    // Dunkles System (Primär-Canvas):
    black:  '#000000', bgDark: '#07070A', ink: '#1A1B18', surface: '#141418', line: '#26262E',
    // Hell/Support (sparsam):
    cream:  '#FBF7F1', beige: '#EFE6DC', gold: '#B8841A', green: '#1F7A3A',
    // Score-Ring (Daten-Indikator, kein Marken-Rot):
    score: { high: '#35D07F', good: '#9BD15B', mid: '#D8A828', low: '#E2564B' },
  },

  // Offizielle Schriften (redtreat.ch-Theme). Variable Fonts lokal in assets/fonts.
  fonts: {
    display: "'Cabin', -apple-system, 'Segoe UI', sans-serif", // Headlines/Display
    body:    "'Outfit', -apple-system, 'Segoe UI', sans-serif", // Text / Specs / UI
    files: { Cabin: 'assets/fonts/Cabin.ttf', Outfit: 'assets/fonts/Outfit.ttf' },
  },

  logo: { white: 'assets/logo_tx.png', mark: 'assets/mark_tx.png' },

  formats: {
    story:  { w: 1080, h: 1920 },
    feed:   { w: 1080, h: 1350 },
    square: { w: 1080, h: 1080 },
  },

  scoreColor(value) {
    const c = this.colors.score;
    if (value >= 80) return c.high;
    if (value >= 65) return c.good;
    if (value >= 45) return c.mid;
    return c.low;
  },

  rules: {
    // Verbotene Medizin-/Heilaussagen (Wellness, NICHT Medizin) – DE+EN.
    // ("treat" allein NICHT verboten – steckt im Markennamen redtreat.)
    forbiddenClaims: [
      /\bheil\w*/i, /\bheals?\b/i, /\bhealing\b/i, /\bcures?\b/i, /\bcuring\b/i,
      /\btherap\w*/i, /\bkrankheit\w*/i, /\bdisease\b/i, /\bdiagnos\w*/i,
      /\bbehandl\w*/i, /\bmedizini?sch\w*/i, /\bmedical\b/i, /\bclinical(ly)?\b/i,
      /\bklinisch\w*/i, /\bschmerz\w*\s*(weg|frei|los)/i, /\bsymptom\w*/i,
    ],
    forbiddenOrigin: [/\bmade\s+in\b/i, /\bhergestellt\s+in\b/i],
    forbiddenHashtags: [/#?madeinswitzerland/i], // korrekt: #swissdesign
    discouraged: [/\bgarantiert\b/i, /\b100\s*%\s*(gesund|wirksam)/i, /\b0\s*[-–]\s*100\s*%\s*dimm/i],
    allowedLogos: ['assets/logo_tx.png', 'assets/mark_tx.png'],
    maxHeadlineChars: 26,
  },
};
