/**
 * Auto-Freisteller: Produktfoto auf (nahezu) einfarbigem Hintergrund → transparentes PNG.
 * Flood-Fill NUR von den Bildrändern entfernt den zusammenhängenden Hintergrund —
 * weiße Produktteile im Inneren (z.B. weißes Panel-Gehäuse) bleiben erhalten.
 * Danach: weiche 1px-Kante + Zuschnitt auf den Produkt-Inhalt. Nutzt das vorhandene Chromium (browser.js).
 */
const fs = require('fs');
const { getBrowser } = require('./browser');

async function cutoutBackground(inPath, outPath, opts = {}) {
  const tol = opts.tolerance ?? 30;     // Farbabstand zum Hintergrund, der noch als Hintergrund gilt
  const feather = opts.feather ?? 1;    // weiche Kante an/aus
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    const raw = fs.readFileSync(inPath);
    const mime = (raw[0] === 0xFF && raw[1] === 0xD8) ? 'image/jpeg' : 'image/png';
    const data = raw.toString('base64');
    await page.setContent(`<canvas id="c"></canvas><img id="i" src="data:${mime};base64,${data}">`);
    const out = await page.evaluate(async ({ tol, feather }) => {
      const i = document.getElementById('i');
      await new Promise(r => { if (i.complete) r(); else i.onload = r; });
      const w = i.naturalWidth, h = i.naturalHeight;
      const c = document.getElementById('c'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'); ctx.drawImage(i, 0, 0);
      const img = ctx.getImageData(0, 0, w, h), d = img.data;

      // Hintergrundfarbe = Mittel der vier Ecken (meist Weiß).
      const cor = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([px, py]) => { const o = (py * w + px) * 4; return [d[o], d[o + 1], d[o + 2]]; });
      const bg = [0, 1, 2].map(k => Math.round(cor.reduce((s, v) => s + v[k], 0) / cor.length));
      const near = (o) => { const a = d[o] - bg[0], b2 = d[o + 1] - bg[1], cc = d[o + 2] - bg[2]; return Math.sqrt(a * a + b2 * b2 + cc * cc) <= tol; };

      // Flood-Fill von allen Randpixeln.
      const mark = new Uint8Array(w * h);
      const st = [];
      for (let px = 0; px < w; px++) { st.push(px, 0, px, h - 1); }
      for (let py = 0; py < h; py++) { st.push(0, py, w - 1, py); }
      while (st.length) {
        const py = st.pop(), px = st.pop();
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const idx = py * w + px; if (mark[idx]) continue;
        if (!near(idx * 4)) continue;
        mark[idx] = 1;
        st.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1);
      }
      for (let idx = 0; idx < w * h; idx++) if (mark[idx]) d[idx * 4 + 3] = 0;

      // Weiche Kante: Pixel mit transparenten Nachbarn leicht ausblenden.
      if (feather) {
        const a = new Uint8Array(w * h); for (let idx = 0; idx < w * h; idx++) a[idx] = d[idx * 4 + 3];
        for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
          const idx = py * w + px; if (a[idx] === 0) continue;
          let n = 0; for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) {
            const nx = px + xx, ny = py + yy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (a[ny * w + nx] === 0) n++;
          }
          if (n) d[idx * 4 + 3] = Math.max(0, Math.round(255 * (1 - (n / 9) * 0.6)));
        }
      }
      ctx.putImageData(img, 0, 0);

      // Auf Produkt-Inhalt zuschneiden.
      let minx = w, miny = h, maxx = 0, maxy = 0, any = false;
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) if (d[(py * w + px) * 4 + 3] > 8) { any = true; if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py; }
      if (!any) return c.toDataURL('image/png');
      const pad = Math.round(Math.max(w, h) * 0.02);
      minx = Math.max(0, minx - pad); miny = Math.max(0, miny - pad); maxx = Math.min(w - 1, maxx + pad); maxy = Math.min(h - 1, maxy + pad);
      const cw = maxx - minx + 1, ch = maxy - miny + 1;
      const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
      c2.getContext('2d').putImageData(ctx.getImageData(minx, miny, cw, ch), 0, 0);
      return c2.toDataURL('image/png');
    }, { tol, feather });
    fs.writeFileSync(outPath, Buffer.from(out.split(',')[1], 'base64'));
    return outPath;
  } finally { await page.close(); }
}

module.exports = { cutoutBackground };

// CLI: node cutout.js <in.png> <out.png>
if (require.main === module) {
  const [, , inP, outP] = process.argv;
  if (!inP || !outP) { console.error('Usage: node cutout.js <in> <out.png>'); process.exit(1); }
  const { closeBrowser } = require('./browser');
  cutoutBackground(inP, outP).then(() => { console.log('✅ freigestellt:', outP); return closeBrowser(); })
    .catch(e => { console.error('❌', e.message); process.exit(1); });
}
