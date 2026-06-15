/**
 * redtreat Studio – Web-App.
 * Browser: Bilder hochladen + Brief tippen → 8 Anzeigen + 2 Reels.
 * Startet die Studio-Pipeline (studio.js) als Job und zeigt die Ergebnisse.
 */
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const REFS = path.join(ROOT, 'input', 'refs');
const ADS = path.join(ROOT, 'output', 'studio');
const REELS = path.join(ROOT, 'reels');
[REFS, ADS, REELS, path.join(ROOT, 'input', 'studio')].forEach(d => fs.mkdirSync(d, { recursive: true }));
const clearDir = (d, rx) => { try { fs.readdirSync(d).forEach(f => { if (!rx || rx.test(f)) fs.rmSync(path.join(d, f), { force: true }); }); } catch {} };

const app = express();
const upload = multer({ storage: multer.diskStorage({
  destination: (req, file, cb) => cb(null, REFS),
  filename: (req, file, cb) => cb(null, 'ref_' + Date.now() + '_' + file.originalname.replace(/[^\w.]+/g, '_')),
}) });

const jobs = {};
function stageFrom(line, j) {
  if (line.includes('Produkt-Modus')) j.stage = '📦 Produkt-Modus · dein echtes Foto wird verwendet …';
  else if (line.includes('Creative Director')) j.stage = '🎬 Creative Director schreibt die Copy …';
  else if (line.includes('Generiere')) j.stage = '🖼️ Foto-Varianten werden generiert …';
  else if (line.includes('QC')) j.stage = '🔎 Qualitätskontrolle (Anatomie) …';
  else if (line.includes('Baue ') && line.includes('Anzeigen')) j.stage = '🎨 Anzeigen werden gebaut …';
  else if (line.includes('Reel')) j.stage = '🎞️ Reels werden gebaut …';
}

app.post('/generate', (req, res, next) => { clearDir(REFS); next(); }, upload.array('refs', 8),
  (req, res) => {
    const brief = (req.body.brief || '').trim();
    const count = Math.max(1, Math.min(8, parseInt(req.body.count) || 8));
    if (!brief) return res.status(400).json({ error: 'Bitte einen Brief eingeben.' });
    clearDir(ADS); clearDir(REELS, /\.mp4$/); clearDir(path.join(ROOT, 'input', 'studio'));

    const reelsFlag = (req.body.reels === '1' || req.body.reels === 'on') ? '1' : '0';
    const mode = (req.body.mode === 'product') ? 'product' : 'lifestyle';
    const id = 'job_' + Date.now();
    const j = jobs[id] = { stage: '⏳ Startet …', done: false, error: null, log: '' };
    const child = spawn(process.execPath, [path.join(ROOT, 'studio.js'), brief, String(count), reelsFlag, mode], { cwd: ROOT });
    child.stdout.on('data', d => { j.log += d; String(d).split('\n').forEach(l => l.trim() && stageFrom(l, j)); });
    child.stderr.on('data', d => { j.log += d; });
    child.on('close', () => {
      const adsN = fs.existsSync(ADS) ? fs.readdirSync(ADS).filter(f => /\.png$/.test(f)).length : 0;
      if (!adsN) j.error = mode === 'product'
        ? 'Keine Anzeige erzeugt – hast du ein Produktfoto hochgeladen?'
        : 'Keine Anzeigen erzeugt – prüfe Brief/Keys.';
      j.stage = '✅ Fertig'; j.done = true;
    });
    res.json({ id });
  });

// /status scannt die Ordner LIVE → Bilder erscheinen, sobald fertig (nicht erst nach den Reels)
app.get('/status/:id', (req, res) => {
  const j = jobs[req.params.id]; if (!j) return res.status(404).json({ error: 'unbekannt' });
  const scan = (dir, rx) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => rx.test(f)).sort() : [];
  res.json({
    stage: j.stage, done: j.done, error: j.error,
    ads: scan(ADS, /\.png$/).map(f => '/ads/' + f),
    reels: scan(REELS, /^reel_\d+\.mp4$/).map(f => '/reels/' + f),
  });
});
app.use('/ads', express.static(ADS));
app.use('/reels', express.static(REELS));
app.use('/assets', express.static(path.join(ROOT, 'assets')));
app.get('/', (req, res) => res.type('html').send(PAGE));

const PAGE = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>redtreat Studio</title>
<link href="https://fonts.googleapis.com/css2?family=Cabin:wght@500;700&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
 :root{--red:#E0252C;--cream:#FBF7F1;--bg:#07070A;--surf:#141418;--line:#26262E}
 *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--cream);font-family:'Outfit',sans-serif;-webkit-font-smoothing:antialiased}
 .wrap{max-width:1000px;margin:0 auto;padding:40px 24px 80px}
 header{display:flex;align-items:center;gap:16px;margin-bottom:8px}
 header img{height:54px}
 h1{font-family:'Cabin';font-weight:700;font-size:40px;letter-spacing:-1px;text-transform:lowercase;margin:18px 0 6px}
 h1 .r{color:var(--red)}
 .sub{color:#9a9aa2;font-size:17px;margin-bottom:28px}
 .card{background:var(--surf);border:1px solid var(--line);border-radius:18px;padding:24px;margin-bottom:20px}
 label{display:block;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#9a9aa2;margin-bottom:10px}
 textarea{width:100%;min-height:120px;background:#0e0e12;border:1px solid var(--line);border-radius:12px;color:var(--cream);font-family:inherit;font-size:17px;padding:16px;resize:vertical}
 .drop{border:1.5px dashed #3a3a44;border-radius:12px;padding:26px;text-align:center;color:#9a9aa2;cursor:pointer;transition:.15s}
 .drop:hover{border-color:var(--red);color:var(--cream)}
 .thumbs{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
 .thumbs img{width:84px;height:84px;object-fit:cover;border-radius:10px;border:1px solid var(--line)}
 .row{display:flex;gap:16px;align-items:end;flex-wrap:wrap}
 select{background:#0e0e12;border:1px solid var(--line);color:var(--cream);border-radius:10px;padding:12px 16px;font-family:inherit;font-size:16px}
 button{background:var(--red);color:#fff;border:0;border-radius:100px;padding:18px 40px;font-family:'Outfit';font-weight:600;font-size:18px;letter-spacing:1px;text-transform:uppercase;cursor:pointer}
 button:disabled{opacity:.5;cursor:default}
 .chk{text-transform:none;letter-spacing:0;color:var(--cream);font-size:15px;display:flex;align-items:center;gap:8px;cursor:pointer;margin:0}
 .phint{display:none;color:#9a9aa2;font-size:14.5px;line-height:1.5;margin-top:14px;padding:14px 16px;background:#0e0e12;border:1px solid var(--line);border-radius:12px}
 .phint b{color:var(--cream)}
 .status{margin-top:18px;font-size:17px;color:var(--cream);display:none}
 .spin{display:inline-block;width:16px;height:16px;border:2px solid #555;border-top-color:var(--red);border-radius:50%;animation:s 1s linear infinite;vertical-align:-2px;margin-right:8px}
 @keyframes s{to{transform:rotate(360deg)}}
 .results{display:none;margin-top:10px}
 .h2{font-family:'Cabin';font-weight:700;font-size:24px;text-transform:lowercase;margin:26px 0 14px}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}
 .grid a{display:block;border-radius:12px;overflow:hidden;border:1px solid var(--line)}
 .grid img{width:100%;display:block}
 .reels{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
 .reels video{width:100%;border-radius:14px;border:1px solid var(--line);background:#000}
 .foot{color:#6a6a72;font-size:13px;margin-top:30px}
</style></head><body><div class="wrap">
 <header><img src="/assets/logo_tx.png" alt="redtreat"></header>
 <h1>content <span class="r">studio.</span></h1>
 <div class="sub">Beispielbilder hochladen, Brief schreiben — du bekommst 8 Anzeigen + 2 Reels. 100 % markenkonform.</div>

 <div class="card">
   <label>1 · Referenzbilder (optional)</label>
   <div class="drop" id="drop">Bilder hierher ziehen oder klicken zum Auswählen</div>
   <input type="file" id="files" accept="image/*" multiple hidden>
   <div class="thumbs" id="thumbs"></div>
 </div>

 <div class="card">
   <label>2 · Was brauchst du? (Brief)</label>
   <textarea id="brief" placeholder="z.B. Eine ruhige Anzeige zum Thema Pilates am Morgen, im Stil der hochgeladenen Bilder, edel und reduziert."></textarea>
   <div class="row" style="margin-top:18px">
     <div><label>Modus</label><label class="chk"><input type="checkbox" id="product"> 📦 Produktfoto-Modus</label></div>
     <div><label>Anzahl Anzeigen</label><select id="count"><option>8</option><option>6</option><option>4</option><option>3</option></select></div>
     <div><label>Reels</label><label class="chk"><input type="checkbox" id="reels"> auch 2 Reels <span style="color:#9a9aa2">(langsam auf Gratis)</span></label></div>
     <button id="go">Generieren</button>
   </div>
   <div class="phint" id="phint">📦 <b>Produktfoto-Modus:</b> dein <b>erstes hochgeladenes Bild</b> wird als echtes Produkt verwendet — es wird <b>kein</b> Produkt von der KI erfunden. Schreib die echten Eckdaten in den Brief, z.B.: „SolisPanel NextGen, 8 Wellenlängen (415–850 nm), max 180 mW/cm², wasserfest, 1-Tasten-Bedienung, Wellness".</div>
   <div class="status" id="status"></div>
 </div>

 <div class="results" id="results">
   <div class="h2">deine anzeigen.</div><div class="grid" id="ads"></div>
   <div id="reelsBlock" style="display:none"><div class="h2">deine reels.</div><div class="reels" id="rl"></div></div>
   <div class="foot">Rechtsklick → Speichern, oder antippen zum Öffnen. Vor dem Posten bitte prüfen.</div>
 </div>
</div>
<script>
 const drop=document.getElementById('drop'),files=document.getElementById('files'),thumbs=document.getElementById('thumbs');
 let picked=[];
 drop.onclick=()=>files.click();
 files.onchange=()=>{picked=[...files.files];render();};
 function render(){thumbs.innerHTML='';picked.forEach(f=>{const i=new Image();i.src=URL.createObjectURL(f);thumbs.appendChild(i);});}
 ['dragover','dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();}));
 drop.addEventListener('drop',ev=>{picked=[...ev.dataTransfer.files].filter(f=>f.type.startsWith('image'));render();});

 const go=document.getElementById('go'),status=document.getElementById('status'),results=document.getElementById('results');
 const product=document.getElementById('product'),phint=document.getElementById('phint');
 product.onchange=()=>{phint.style.display=product.checked?'block':'none';};
 go.onclick=async()=>{
   const brief=document.getElementById('brief').value.trim();
   if(!brief){alert('Bitte einen Brief schreiben.');return;}
   if(product.checked&&!picked.length){alert('Produktfoto-Modus: bitte lade zuerst dein echtes Produktfoto hoch.');return;}
   go.disabled=true;results.style.display='none';status.style.display='block';
   status.innerHTML='<span class="spin"></span> Startet …';
   const fd=new FormData();fd.append('brief',brief);fd.append('count',document.getElementById('count').value);
   fd.append('reels',document.getElementById('reels').checked?'1':'0');
   fd.append('mode',product.checked?'product':'lifestyle');
   picked.forEach(f=>fd.append('refs',f));
   let id;
   try{const r=await fetch('/generate',{method:'POST',body:fd});const j=await r.json();if(j.error)throw new Error(j.error);id=j.id;}
   catch(e){status.innerHTML='❌ '+e.message;go.disabled=false;return;}
   const poll=setInterval(async()=>{
     let s; try{ s=await(await fetch('/status/'+id)).json(); }catch(e){ return; }
     if(s.ads&&s.ads.length){
       document.getElementById('ads').innerHTML=s.ads.map(u=>'<a href="'+u+'" target="_blank"><img src="'+u+'"></a>').join('');
       results.style.display='block';
     }
     if(s.reels&&s.reels.length){
       document.getElementById('reelsBlock').style.display='block';
       document.getElementById('rl').innerHTML=s.reels.map(u=>'<video src="'+u+'" controls loop muted playsinline></video>').join('');
     }
     status.innerHTML = s.done ? (s.error?('❌ '+s.error):('✅ Fertig — '+(s.ads?s.ads.length:0)+' Anzeigen'+(s.reels&&s.reels.length?(' + '+s.reels.length+' Reels'):'')+'.')) : ('<span class="spin"></span> '+s.stage);
     if(s.done){clearInterval(poll);go.disabled=false;}
   },1800);
 };
</script></body></html>`;

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log('redtreat Studio läuft auf http://localhost:' + PORT));
