/**
 * Gemeinsamer Browser-Baustein (plattform-unabhängig).
 * Standard: mitgeliefertes Chromium (läuft lokal UND auf Linux-Server identisch).
 * Optional BROWSER_CHANNEL=msedge|chrome, um einen installierten Browser zu nutzen.
 */
const { chromium } = require('playwright');
let _b = null;

async function getBrowser() {
  if (_b && _b.isConnected()) return _b;
  const channel = process.env.BROWSER_CHANNEL;
  const opts = { headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] };
  if (channel) opts.channel = channel;
  _b = await chromium.launch(opts);
  return _b;
}

async function closeBrowser() { if (_b) { try { await _b.close(); } catch {} _b = null; } }

// Lädt eine lokale HTML-Datei (file://) und liefert einen PNG-Screenshot in w×h.
async function shotFile(fileUrl, w, h) {
  const b = await getBrowser();
  const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  try {
    await page.goto(fileUrl, { waitUntil: 'load' });
    try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {}
    await page.waitForTimeout(150);
    return await page.screenshot({ type: 'png' });
  } finally { await page.close(); }
}

module.exports = { getBrowser, closeBrowser, shotFile };
