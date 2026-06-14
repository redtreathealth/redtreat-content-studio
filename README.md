# redtreat Content-Engine

Der Kern eures Social-Media-Tools: aus **Brief + Foto** wird **automatisch** eine
**100 % markenkonforme** redtreat-Anzeige (PNG). Bild-Generator und Auto-Posting
werden hier angedockt (Schritt 2 & 3, siehe Roadmap).

## Warum es nicht „off-brand" werden kann
- **Logo, Farben, Schrift, Layout** sind fest in [`brand.config.js`](brand.config.js) verdrahtet.
- Jeder **Text** läuft vorher durch den [`brand-lint.js`](brand-lint.js):
  - ❌ keine Medizin-/Heilaussagen (Wellness, nicht Medizin)
  - ❌ kein „Made in" → immer **„Designed in Switzerland"**
  - ❌ nur das echte redtreat-Logo (nie ein fremdes)
  - ⚠️ warnt bei zu langen Headlines / heiklen Floskeln
- Harte Verstöße ⇒ es wird **gar nichts** gerendert.

## Benutzen
```
node render.js briefs/example_jogger.json
```
→ Ergebnis liegt in `output/<name>.png`.

- Fotos kommen nach `input/`
- Briefs (was auf die Anzeige soll) sind JSON in `briefs/` – Beispiel: [`example_jogger.json`](briefs/example_jogger.json)
- Formate: `story` (1080×1920), `feed` (1080×1350), `square` (1080×1080)

## Roadmap zum fertigen Tool
- [x] **Schritt 1 – On-Brand-Engine** (dieser Ordner): Brief + Foto → fertige Anzeige, brand-geprüft
- [ ] **Schritt 2 – Bild/Video-Generator anbinden** (API: fal.ai / Replicate / FLUX, Video: Veo/Runway). Engine erzeugt das Foto dann selbst aus dem Brief.
- [ ] **Schritt 3 – Web-Zugriff**: kleine Web-Seite/Bot, wo Stefan den Brief eingibt → Vorschau-Link
- [ ] **Schritt 4 – Auto-Posting** (Instagram/TikTok via Meta-API bzw. Postiz) **mit Genehmigungs-Klick**
- [ ] Multi-Format automatisch (Story + Feed + Reel-Cover aus einem Brief)

## Braucht Stefan (für Schritt 2–4)
- API-Schlüssel für einen Bild-Generator (z. B. fal.ai oder Replicate)
- Instagram/Facebook **Business-Account** + einmalige App-Freigabe (Meta)
