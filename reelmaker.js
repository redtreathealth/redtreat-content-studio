/**
 * Reel-Maker – animierter Explainer-Reel (1080x1920 MP4).
 * Szenen: Hook → App taucht auf → Features → Longevity-Score zählt hoch → CTA.
 * Eine seekbare HTML-Timeline wird via Edge (playwright) Frame für Frame abgefilmt → ffmpeg.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { getBrowser } = require('./browser');
const brand = require('./brand.config');

const ROOT = __dirname;
const url = (p) => 'file:///' + path.resolve(ROOT, p).replace(/\\/g, '/');
const DUR = 9.4, FPS = 30;

function buildReelHTML(c) {
  const R = brand.colors.red, CR = brand.colors.cream, BG = brand.colors.bgDark;
  const feats = (c.features || []).slice(0, 4);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
 @font-face{font-family:'Cabin';src:url('${url(brand.fonts.files.Cabin)}') format('truetype');font-weight:100 900}
 @font-face{font-family:'Outfit';src:url('${url(brand.fonts.files.Outfit)}') format('truetype');font-weight:100 900}
 *{margin:0;padding:0;box-sizing:border-box}
 .stage{width:1080px;height:1920px;position:relative;overflow:hidden;background:${BG};font-family:'Outfit',sans-serif}
 .scene{position:absolute;inset:0}
 .hero{position:absolute;inset:0;background:#000 center/cover no-repeat;transform-origin:center}
 .scrim{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(7,7,10,.6),rgba(7,7,10,.1) 30%,rgba(7,7,10,.2) 60%,rgba(7,7,10,.92))}
 .logo{position:absolute;top:64px;left:60px;width:230px}
 .kick{position:absolute;top:980px;left:64px;color:${CR};font-size:24px;letter-spacing:7px;text-transform:uppercase;font-weight:600}
 .h1{position:absolute;top:1020px;left:60px;right:80px;color:${CR};font-family:'Cabin';font-size:118px;line-height:.92;font-weight:700;letter-spacing:-3px;text-transform:lowercase}
 .h1 .r{color:${R}}
 .glow{position:absolute;inset:0;background:radial-gradient(60% 40% at 50% 36%,rgba(225,6,0,.18),transparent 70%)}
 .phone{position:absolute;left:50%;bottom:300px;width:470px;height:1016px;transform:translateX(-50%);
   border-radius:52px;padding:14px;background:linear-gradient(150deg,#2b2b31,#0c0c0f 62%);box-shadow:0 60px 130px rgba(0,0,0,.7)}
 .screen{width:100%;height:100%;border-radius:40px;background:#000 top center/cover no-repeat;overflow:hidden}
 .cap{position:absolute;top:150px;left:0;right:0;text-align:center;color:${CR};font-family:'Cabin';font-size:74px;font-weight:700;letter-spacing:-2px;text-transform:lowercase}
 .phoneS{position:absolute;left:70px;bottom:360px;width:380px;height:822px;border-radius:44px;padding:12px;background:linear-gradient(150deg,#2b2b31,#0c0c0f 62%);box-shadow:0 50px 110px rgba(0,0,0,.7)}
 .chip{position:absolute;right:70px;display:flex;align-items:center;gap:16px;background:rgba(20,20,24,.85);border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:22px 28px;color:${CR};font-size:33px;font-weight:600;box-shadow:0 24px 50px rgba(0,0,0,.5)}
 .chip i{width:14px;height:14px;border-radius:50%;background:${R};box-shadow:0 0 16px 4px rgba(225,6,0,.8)}
 .s3title{position:absolute;top:150px;left:0;right:0;text-align:center;color:${CR};font-family:'Cabin';font-size:64px;font-weight:700;text-transform:lowercase}
 .ring{position:absolute;left:50%;top:560px;transform:translateX(-50%);width:520px;height:520px}
 .s4num{position:absolute;left:0;right:0;top:680px;text-align:center;color:${CR};font-size:240px;font-weight:200;line-height:1}
 .s4label{position:absolute;left:0;right:0;top:980px;text-align:center;color:rgba(251,247,241,.65);font-size:34px;letter-spacing:5px;text-transform:uppercase;font-weight:600}
 .s5logo{position:absolute;left:50%;top:690px;transform:translateX(-50%);width:500px}
 .s5cta{position:absolute;left:50%;top:1160px;transform:translateX(-50%);background:${R};color:#fff;font-size:44px;font-weight:600;letter-spacing:2px;text-transform:uppercase;padding:34px 70px;border-radius:100px;white-space:nowrap}
 .s5store{position:absolute;left:0;right:0;top:1320px;text-align:center;color:rgba(251,247,241,.6);font-size:30px;letter-spacing:4px;text-transform:uppercase}
</style></head><body>
 <div class="stage">
  <div class="scene" id="s1">
    <div class="hero" id="s1hero" style="background-image:url('${url(c.hero)}')"></div>
    <div class="scrim"></div>
    <img class="logo" id="s1logo" src="${url(c.logo)}">
    <div class="kick" id="s1kick">${c.kicker || ''}</div>
    <div class="h1"><span id="s1l1" style="display:inline-block">${c.headline[0]}</span><br><span class="r" id="s1l2" style="display:inline-block">${c.headline[1]}</span></div>
  </div>
  <div class="scene" id="s2">
    <div class="glow"></div>
    <div class="cap" id="s2cap">alles. an einem ort.</div>
    <div class="phone" id="s2phone"><div class="screen" style="background-image:url('${url(c.appHome)}')"></div></div>
  </div>
  <div class="scene" id="s3">
    <div class="s3title" id="s3title">eine app. alles drin.</div>
    <div class="phoneS" id="s3phone"><div class="screen" style="background-image:url('${url(c.appHome)}')"></div></div>
    <div class="chip" id="f1" style="top:430px"><i></i>${feats[0] || ''}</div>
    <div class="chip" id="f2" style="top:560px"><i></i>${feats[1] || ''}</div>
    <div class="chip" id="f3" style="top:690px"><i></i>${feats[2] || ''}</div>
    <div class="chip" id="f4" style="top:820px"><i></i>${feats[3] || ''}</div>
  </div>
  <div class="scene" id="s4">
    <svg class="ring" viewBox="0 0 520 520">
      <circle cx="260" cy="260" r="130" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="22"/>
      <circle id="s4arc" cx="260" cy="260" r="130" fill="none" stroke="#35D07F" stroke-width="22" stroke-linecap="round" stroke-dasharray="817" stroke-dashoffset="817" transform="rotate(-90 260 260)"/>
    </svg>
    <div class="s4num" id="s4num">0</div>
    <div class="s4label" id="s4label">dein longevity-score</div>
  </div>
  <div class="scene" id="s5">
    <img class="s5logo" id="s5logo" src="${url(c.logo)}">
    <div class="s5cta" id="s5cta">${c.cta || 'gratis laden'}</div>
    <div class="s5store" id="s5store">gratis im app store</div>
  </div>
 </div>
 <script>
  var CFG={score:${c.score || 92}}; var DUR=${DUR};
  function clamp(x,a,b){return x<a?a:x>b?b:x;}
  function seg(t,a,b){return clamp((t-a)/(b-a),0,1);}
  function E(x){x=clamp(x,0,1);return 1-Math.pow(1-x,3);}
  function set(id,p,v){var e=document.getElementById(id);if(e)e.style[p]=v;}
  function op(id,v){set(id,'opacity',v);}
  function fade(id,a,b,t){var e=document.getElementById(id);if(!e)return;var o=seg(t,a,a+0.3);if(b<DUR)o=Math.min(o,1-seg(t,b-0.3,b));e.style.opacity=o;e.style.visibility=o<=0.001?'hidden':'visible';}
  window.__seek=function(t){
    fade('s1',0,2.4,t);fade('s2',2.4,4.6,t);fade('s3',4.6,6.8,t);fade('s4',6.8,8.2,t);fade('s5',8.2,DUR,t);
    set('s1hero','transform','scale('+(1+0.07*E(seg(t,0,2.4)))+')');
    op('s1logo',E(seg(t,0.2,0.9)));
    var k=E(seg(t,0.5,1.1));set('s1kick','transform','translateY('+(18*(1-k))+'px)');op('s1kick',k);
    var a1=E(seg(t,0.7,1.5));set('s1l1','transform','translateY('+(40*(1-a1))+'px)');op('s1l1',a1);
    var a2=E(seg(t,1.0,1.8));set('s1l2','transform','translateY('+(40*(1-a2))+'px)');op('s1l2',a2);
    var pp=E(seg(t,2.6,3.6));set('s2phone','transform','translate(-50%,'+((1-pp)*140)+'px)');op('s2phone',pp);
    op('s2cap',E(seg(t,3.5,4.1)));
    op('s3title',E(seg(t,4.7,5.2)));op('s3phone',E(seg(t,4.7,5.3)));
    var fs=[5.0,5.3,5.6,5.9];for(var i=0;i<4;i++){var fp=E(seg(t,fs[i],fs[i]+0.5));set('f'+(i+1),'transform','translateX('+((1-fp)*40)+'px)');op('f'+(i+1),fp);}
    var sp=E(seg(t,6.95,7.9));var val=Math.round(CFG.score*sp);var n=document.getElementById('s4num');if(n)n.textContent=val;
    set('s4arc','strokeDashoffset',817*(1-val/100));op('s4label',E(seg(t,7.4,8.0)));
    var c5=E(seg(t,8.3,8.9));set('s5cta','transform','translateX(-50%) scale('+(0.85+0.15*c5)+')');op('s5cta',c5);
    op('s5logo',E(seg(t,8.25,8.7)));op('s5store',E(seg(t,8.6,9.1)));
  };
  window.__seek(0);
 </script>
</body></html>`;
}

async function renderReel(cfg, outMp4) {
  const html = buildReelHTML(cfg);
  const htmlPath = path.join(ROOT, 'output', '_reel.html');
  fs.writeFileSync(htmlPath, html);
  const framesDir = path.join(ROOT, 'reels', '_frames');
  fs.rmSync(framesDir, { recursive: true, force: true }); fs.mkdirSync(framesDir, { recursive: true });

  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'));
  await page.waitForTimeout(400); // Fonts/Bilder laden
  const total = Math.round(DUR * FPS);
  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.__seek(t), i / FPS);
    await page.screenshot({ path: path.join(framesDir, 'f_' + String(i).padStart(4, '0') + '.png') });
  }
  await page.close();

  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(framesDir, 'f_%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-movflags', '+faststart', outMp4], { stdio: 'ignore' });
  fs.rmSync(framesDir, { recursive: true, force: true });
  return outMp4;
}

module.exports = { renderReel, buildReelHTML };

if (require.main === module) {
  const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const out = process.argv[3] || path.join(ROOT, 'reels', 'explainer.mp4');
  console.log('🎞️  Rendere Explainer-Reel …');
  renderReel(cfg, out).then(() => console.log('✅', out)).catch(e => { console.error('❌', e.message); process.exit(1); });
}
