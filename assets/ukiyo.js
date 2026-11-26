/* =====================================================================
   dio.stesso — UKIYO-E engine (shared)
   paper · printing reveal · woodblock colour blocks · petals · nav
   ===================================================================== */
(function(){
const U = window.UKIYO = {};
const reduce = U.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine   = U.fine   = matchMedia('(pointer: fine)').matches;
const DPR = Math.min(devicePixelRatio || 1, 2);

/* ---------- tiny seeded noise ---------- */
function rng(seed){ let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function noise1(seed){
  const r = rng(seed), pts = Array.from({length:64}, r);
  return x => { x = Math.abs(x) % 63; const i = Math.floor(x), f = x - i, t = f*f*(3-2*f); return pts[i]*(1-t) + pts[i+1]*t; };
}
U.rng = rng; U.noise1 = noise1;

/* ---------- 1. washi paper texture (fibres + goma-zuri specks) ---------- */
(function paper(){
  const S = 420, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), r = rng(7);
  // soft mottling
  for(let i=0;i<70;i++){
    const x=r()*S,y=r()*S,rad=20+r()*70;
    const grd=g.createRadialGradient(x,y,0,x,y,rad);
    grd.addColorStop(0,`rgba(150,110,50,${.025+r()*.03})`);grd.addColorStop(1,'rgba(150,110,50,0)');
    g.fillStyle=grd;g.fillRect(x-rad,y-rad,rad*2,rad*2);
  }
  // long fibres
  g.lineCap='round';
  for(let i=0;i<260;i++){
    let x=r()*S,y=r()*S,a=r()*Math.PI*2,len=8+r()*38;
    g.strokeStyle=`rgba(${r()<.5?'110,80,40':'255,250,240'},${.06+r()*.08})`;g.lineWidth=.4+r()*.7;
    g.beginPath();g.moveTo(x,y);
    for(let k=0;k<4;k++){a+=(r()-.5)*.9;x+=Math.cos(a)*len/4;y+=Math.sin(a)*len/4;g.lineTo(x,y)}
    g.stroke();
  }
  // specks
  for(let i=0;i<420;i++){g.fillStyle=`rgba(70,50,25,${.08+r()*.22})`;g.fillRect(r()*S,r()*S,r()*1.4+.3,r()*1.4+.3)}
  document.documentElement.style.setProperty('--paper-tex',`url(${c.toDataURL('image/png')})`);
})();

/* ---------- 2. rough-edge SVG filter for seals ---------- */
document.body.insertAdjacentHTML('afterbegin',
 `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter></svg>`);

/* ---------- 3. reveal observer ---------- */
const io = new IntersectionObserver(es => es.forEach(e => {
  if(e.isIntersecting){ e.target.classList.add('on'); io.unobserve(e.target); }
}), {threshold:.12, rootMargin:'0px 0px -6% 0px'});
U.observe = root => (root||document).querySelectorAll('.rv,.pr,.stamp,[data-on]').forEach(el => io.observe(el));
U.observe();

/* ---------- 4. nav: stuck / hide on scroll down, drawer, rod ---------- */
const nav = document.querySelector('.nav'), rod = document.querySelector('.rod');
let lastY = 0;
addEventListener('scroll', () => {
  const y = scrollY;
  if(nav){ nav.classList.toggle('stuck', y > 30); nav.classList.toggle('hide', y > 400 && y > lastY + 4 && !document.body.classList.contains('lock')); if(y < lastY - 4) nav.classList.remove('hide'); }
  if(rod){ const h = document.documentElement.scrollHeight - innerHeight; rod.style.transform = `scaleX(${h>0? y/h : 0})`; }
  lastY = y;
}, {passive:true});
const burger = document.querySelector('.burger'), drawer = document.querySelector('.drawer');
U.lock = on => { document.body.classList.toggle('lock', on); document.body.style.overflow = on ? 'hidden' : ''; };
if(burger && drawer){
  const set = o => { drawer.classList.toggle('open', o); burger.classList.toggle('open', o); burger.setAttribute('aria-expanded', o); U.lock(o); };
  burger.addEventListener('click', () => set(!drawer.classList.contains('open')));
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => set(false)));
}

/* ---------- 5. WOODBLOCK COLOUR BLOCKS ----------
   U.printBlocks(host, blocks, {delay})  → stacks one canvas per pigment block,
   each textured (woodgrain, baren, specks), each out of register by ~2px,
   each printed in with the diagonal sweep. The key-line image sits on top
   (mix-blend multiply) inside the same host.
------------------------------------------------- */
function hex(h){ h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function drawBlock(cv, b, seed){
  const W = cv.width, H = cv.height, g = cv.getContext('2d');
  const [R,G,B] = hex(b.color), a0 = b.alpha ?? 1;
  const img = g.createImageData(W, H), d = img.data;
  const n1 = noise1(seed), n2 = noise1(seed+11), wob = (b.wobble ?? 0.035) * H;
  for(let x=0;x<W;x++){
    const edge = (n1(x/W*7) - .5) * 2 * wob + (n2(x/W*23) - .5) * wob * .35;
    for(let y=0;y<H;y++){
      let a = 0; const u = x/W, v = y/H;
      if(b.type === 'sky'){            // bokashi from top, wandering lower edge
        const end = b.to*H + edge, st = (b.from||0)*H;
        const t = (y-st)/(end-st); a = y < st || y > end ? 0 : Math.pow(1 - t, b.pow ?? 1.25) * (st > 0 ? Math.min(1, t/.35) : 1);
      } else if(b.type === 'ground'){  // bokashi from bottom
        const st = b.from*H + edge; a = y < st ? 0 : Math.pow((y-st)/(H-st), b.pow ?? 1.1);
      } else if(b.type === 'band'){    // water/mist band, wiped at both vertical edges + right end
        const y0 = b.y0*H + edge*.5, y1 = b.y1*H + edge*.6;
        if(y > y0 && y < y1 && u >= (b.x0||0) && u <= (b.x1??1)){
          const t = (y-y0)/(y1-y0); a = Math.min(1, Math.sin(t*Math.PI)*1.6);
          const fx = b.fadeX ?? .15, rx = (b.x1??1) - u, lx = u - (b.x0||0);
          a *= Math.min(1, rx/fx, b.x0 ? lx/fx : 1);
        }
      } else if(b.type === 'sun'){
        const dx = (u - b.x)*W, dy = (v - b.y)*H, r = b.r*W;
        const dd = Math.sqrt(dx*dx+dy*dy); a = dd < r ? 1 : dd < r*1.04 ? 1-(dd-r)/(r*.04) : 0;
      }
      if(a <= 0) continue;
      const i = (y*W + x) * 4; d[i]=R; d[i+1]=G; d[i+2]=B; d[i+3]=Math.min(255, a*a0*255);
    }
  }
  g.putImageData(img, 0, 0);
  const r = rng(seed*3+1);
  // woodgrain — wavy iso-lines, darker, on the pigment only
  g.globalCompositeOperation = 'source-atop';
  g.lineWidth = Math.max(1, W/900);
  for(let k=0;k<Math.round(H/7);k++){
    const y0 = r()*H, amp = 3 + r()*10, fr = 2 + r()*4, ph = r()*6;
    g.strokeStyle = `rgba(${R*.6|0},${G*.6|0},${B*.6|0},${.05 + r()*.09})`;
    g.beginPath();
    for(let x=0;x<=W;x+=W/60){ const y = y0 + Math.sin(x/W*fr*Math.PI*2 + ph)*amp + (n1(x/W*9+k)-.5)*amp; x?g.lineTo(x,y):g.moveTo(x,y); }
    g.stroke();
  }
  // baren rubbing — circular arcs knocked out of the ink
  g.globalCompositeOperation = 'destination-out';
  for(let k=0;k<26;k++){
    const x=r()*W,y=r()*H,rad=W*(.03+r()*.08);
    g.strokeStyle=`rgba(0,0,0,${.05+r()*.07})`;g.lineWidth=W*(.006+r()*.012);
    g.beginPath();g.arc(x,y,rad,r()*6,r()*6+2+r()*3);g.stroke();
  }
  // goma-zuri specks
  for(let k=0;k<W*H/900;k++){ g.fillStyle=`rgba(0,0,0,${.15+r()*.2})`; g.fillRect(r()*W,r()*H,1+r()*1.6,1+r()*1.6); }
  g.globalCompositeOperation = 'source-over';
}
U.printBlocks = function(host, blocks, opt={}){
  const rect = host.getBoundingClientRect();
  const W = Math.min(1500, Math.round(rect.width * DPR)), H = Math.round(W * rect.height / rect.width);
  const offs = [[2,-1.5],[-2,1.5],[1.5,2],[-1.5,-2],[2.5,1]];
  const made = [];
  blocks.forEach((b, i) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    cv.className = 'blk pr';
    const [ox, oy] = offs[i % offs.length];
    const bt = (9 + Math.random()*7).toFixed(1), bo = (b.type === 'sun' ? .8 : .5 + Math.random()*.3).toFixed(2);
    cv.style.cssText = `position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:multiply;--rx:${ox*3}px;--ry:${oy*3}px;--pd:${(opt.delay||0) + i*(opt.step ?? .32)}s;translate:${ox}px ${oy}px;--bt:${bt}s;--bo:${bo};animation-delay:-${(Math.random()*8).toFixed(1)}s,0s`;
    drawBlock(cv, b, 101 + i*17 + (opt.seed||0));
    host.insertBefore(cv, host.querySelector('.key'));
    made.push(cv);
  });
  if(opt.now) requestAnimationFrame(() => requestAnimationFrame(() => made.forEach(c => c.classList.add('on'))));
  else made.forEach(c => io.observe(c));
  return made;
};

/* ---------- 6. petals — stepped at 8 fps, like the prints ---------- */
U.petals = function(count){
  if(reduce) return;
  const cv = document.getElementById('petals'); if(!cv) return;
  const g = cv.getContext('2d'); let W, H;
  const fit = () => { W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR; cv.style.width = innerWidth+'px'; cv.style.height = innerHeight+'px'; };
  fit(); addEventListener('resize', fit);
  const r = Math.random, cols = ['#D2533E','#E8A18F','#B5382B','#F0C2B2'];
  const P = Array.from({length: count || (innerWidth < 700 ? 7 : 13)}, () => ({x:r()*W, y:r()*H, s:(4+r()*5)*DPR, a:r()*6, va:(r()-.5)*.6, vx:(.3+r()*.6)*DPR, vy:(.8+r()*1.2)*DPR, c:cols[r()*cols.length|0], ph:r()*6}));
  let wind = 0, lastS = scrollY, t0 = 0;
  addEventListener('scroll', () => { wind = Math.max(-14, Math.min(14, wind + (scrollY - lastS) * .02)); lastS = scrollY; }, {passive:true});
  function tick(t){
    requestAnimationFrame(tick);
    if(t - t0 < 125 || document.hidden) return; t0 = t;   // 8 fps
    g.clearRect(0,0,W,H); wind *= .86;
    for(const p of P){
      p.ph += .5; p.x += (p.vx + Math.sin(p.ph)*1.2 + wind*.6) * 4; p.y += (p.vy - wind*.25) * 4; p.a += p.va;
      if(p.y > H + 20 || p.x > W + 20 || p.x < -20 || p.y < -30){ p.y = -10; p.x = r()*W*.9; }
      g.save(); g.translate(p.x,p.y); g.rotate(p.a); g.scale(1, .55 + Math.sin(p.ph)*.35);
      g.fillStyle = p.c; g.globalAlpha = .75;
      g.beginPath(); g.moveTo(0,-p.s); g.quadraticCurveTo(p.s*.9,0,0,p.s); g.quadraticCurveTo(-p.s*.9,0,0,-p.s); g.fill();
      g.restore();
    }
  }
  requestAnimationFrame(tick);
};

/* ---------- 7. videos play only while on screen ---------- */
U.autoplay = function(sel){
  const vio = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if(e.isIntersecting){ if(v.preload === 'none') v.preload = 'metadata'; v.play().catch(()=>{}); } else v.pause();
  }), {threshold:.35});
  document.querySelectorAll(sel).forEach(v => { if(!reduce) vio.observe(v); });
};

/* ---------- 7b. thumbnails that slowly take on colour, only while visible ---------- */
U.tint = function(sel){
  if(reduce) return;
  const els = [...document.querySelectorAll(sel)];
  els.forEach((el,i) => { el.classList.add('tint'); el.style.setProperty('--td', (-(i*3.7)%16).toFixed(1)+'s'); });
  const tio = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('live', e.isIntersecting)), {rootMargin:'60px'});
  els.forEach(el => tio.observe(el));
};

/* ---------- 8. gentle pointer drift on [data-drift] layers ---------- */
if(fine && !reduce){
  const layers = [...document.querySelectorAll('[data-drift]')];
  if(layers.length){
    let mx=0,my=0,cx=0,cy=0;
    addEventListener('pointermove', e => { mx = e.clientX/innerWidth - .5; my = e.clientY/innerHeight - .5; });
    (function loop(){ cx += (mx-cx)*.06; cy += (my-cy)*.06;
      layers.forEach(l => { const k = +l.dataset.drift; l.style.translate = `${(cx*k).toFixed(2)}px ${(cy*k).toFixed(2)}px`; });
      requestAnimationFrame(loop); })();
  }
}

/* ---------- 9. a note for those who read source ---------- */
console.log('%c裏  %cthere is a reverse side to every print.\n    most of it is not on this page.', 'color:#B5382B;font:700 22px serif', 'color:#6A6052;font:14px serif');
})();
