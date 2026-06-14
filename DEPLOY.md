# redtreat Content Studio – online stellen (Render, gratis)

Ziel: eine Internet-Adresse, unter der du das Tool im Browser nutzt.
Die Technik ist fertig vorbereitet (Container `Dockerfile` + `render.yaml`).
Du machst nur die Konto-Schritte – ich helfe bei jedem.

## Schritt 1 – Code auf GitHub (kostenlos)
1. Konto auf **github.com** (falls noch keins).
2. Neues, **öffentliches** Repository anlegen, z.B. `redtreat-content-studio` (leer, ohne README).
3. Mir die Repo-Adresse geben (z.B. `https://github.com/deinname/redtreat-content-studio`).
   → Ich lade den Code hoch (`git push`; beim ersten Mal öffnet sich ein GitHub-Login – das bist du).

## Schritt 2 – Render-Web-Service (kostenlos)
1. Konto auf **render.com** (mit GitHub einloggen ist am einfachsten).
2. **New +** → **Web Service** → dein Repo auswählen.
3. Render erkennt den **Dockerfile** automatisch (Runtime „Docker").
4. **Plan: Free.**

## Schritt 3 – Schlüssel als Environment Variables eintragen
Unter **Environment** diese Werte setzen (Werte gebe ich dir):
- `GEMINI_API_KEY`  (geheim)
- `CF_API_TOKEN`    (geheim)
- `CF_ACCOUNT_ID`
- `IMAGE_PROVIDER` = `cloudflare`
- `CF_MODEL` = `@cf/black-forest-labs/flux-1-schnell`
- `CANDIDATES` = `8`
- `TEXT_MODEL` = `gemini-2.5-flash`

→ **Create Web Service.** Render baut den Container (dauert beim ersten Mal ein paar Minuten)
und gibt dir eine Adresse wie `https://redtreat-content-studio.onrender.com`.

## Wichtig (ehrlich)
- **Gratis-Tier:** wenig RAM/CPU → die **Reels** (Browser + Video) können langsam sein oder mal
  abbrechen; die **Bilder** sollten laufen. Schläft nach ~15 Min Inaktivität ein (erster Aufruf danach dauert).
- Für stabilen Dauerbetrieb: später auf einen kleinen Bezahl-Plan (~7 $/Mt) umstellen – ein Klick.
- Die Schlüssel liegen nur bei Render (nie im Code/Repo).
