'use strict';
/* ============================================================
   RENDER — composición por capas en <canvas>
   ============================================================ */
const canvas = $('#screen'), ctx = canvas.getContext('2d');
let ic, icx, fxc, fxx, fx2, fx2x, grainC, grainKey = -1;
const BOX = new Map(), HITS = [];
function mkSurf(rf) { const c = document.createElement('canvas'); c.width = S.W; c.height = S.H; return [c, c.getContext('2d', rf ? { willReadFrequently: true } : {})]; }
function resizeSurfaces() { [ic, icx] = mkSurf(true); [fxc, fxx] = mkSurf(false); [fx2, fx2x] = mkSurf(false); }
resizeSurfaces();

/* ---------- Opciones de animación (compartidas con la UI) ---------- */
const ANIM_IN = [['none', 'Ninguna'], ['fade', 'Fundido'], ['zoomIn', 'Zoom in (crece)'], ['zoomOut', 'Zoom out (encoge)'], ['pop', 'Pop con rebote'],
  ['fromL', 'Desde la izquierda'], ['fromR', 'Desde la derecha'], ['fromT', 'Desde arriba'], ['fromB', 'Desde abajo'], ['spin', 'Giro'],
  ['flip', 'Volteo'], ['blur', 'Desenfoque'], ['bounce', 'Caída con rebote'], ['glitch', 'Glitch']];
const ANIM_TEXT_IN = [...ANIM_IN, ['typewriter', 'Máquina de escribir']];
const ANIM_LOOP_VISUAL = [['none', 'Ninguna'], ['zoomIn', 'Zoom lento (acercar)'], ['zoomOut', 'Zoom lento (alejar)'], ['panL', 'Paneo ←'], ['panR', 'Paneo →'],
  ['pulse', 'Latido'], ['float', 'Flotar'], ['shake', 'Temblor'], ['rotate', 'Girar'], ['swing', 'Balanceo']];
const ANIM_LOOP_TEXT = [['none', 'Ninguna'], ['pulse', 'Latido'], ['float', 'Flotar'], ['swing', 'Balanceo'], ['wave', 'Ola (por letra)'],
  ['shake', 'Temblor'], ['glow', 'Resplandor pulsante'], ['flicker', 'Parpadeo neón'], ['rainbow', 'Arcoíris']];
const BLENDS = [['source-over', 'Normal'], ['screen', 'Trama (screen)'], ['multiply', 'Multiplicar'], ['overlay', 'Superponer'], ['lighter', 'Sumar (luz)'],
  ['lighten', 'Aclarar'], ['darken', 'Oscurecer'], ['soft-light', 'Luz suave'], ['hard-light', 'Luz fuerte'], ['difference', 'Diferencia']];

const NEUTRAL = () => ({ a: 1, s: 1, sx: 1, dx: 0, dy: 0, r: 0, bl: 0 });
function animState(type, p) {
  const r = NEUTRAL(), e = ease(p), k = 1 - e;
  switch (type) {
    case 'fade': r.a = e; break;
    case 'zoomIn': r.s = .3 + .7 * e; r.a = Math.min(1, e * 2); break;
    case 'zoomOut': r.s = 1.8 - .8 * e; r.a = e; break;
    case 'pop': r.s = Math.max(.001, easeOutBack(p)); r.a = Math.min(1, p * 4); break;
    case 'fromL': r.dx = -k; r.a = Math.min(1, e * 2); break;
    case 'fromR': r.dx = k; r.a = Math.min(1, e * 2); break;
    case 'fromT': r.dy = -k; r.a = Math.min(1, e * 2); break;
    case 'fromB': r.dy = k; r.a = Math.min(1, e * 2); break;
    case 'spin': r.r = -270 * k; r.s = Math.max(.001, e); r.a = e; break;
    case 'flip': r.sx = Math.max(.001, e); r.a = e; break;
    case 'blur': r.bl = 24 * k; r.a = e; break;
    case 'bounce': r.dy = -(1 - easeOutBounce(p)) * 1.2; r.a = Math.min(1, p * 4); break;
    case 'glitch': { const f = Math.floor(p * 14); r.dx = (rnd(f) - .5) * .5 * k; r.a = p > .6 ? 1 : (rnd(f + 9) > .4 ? 1 : .15); r.sx = 1 + (rnd(f + 3) - .5) * .4 * k; break; }
  }
  return r;
}
function mergeAnim(a, b) { a.a *= b.a; a.s *= b.s; a.sx *= b.sx; a.dx += b.dx; a.dy += b.dy; a.r += b.r; a.bl += b.bl; return a; }
function loopState(type, lt, len) {
  const r = NEUTRAL(), q = clamp(lt / Math.max(len, .01), 0, 1), T = Math.PI * 2;
  switch (type) {
    case 'zoomIn': r.s = 1 + .18 * q; break;
    case 'zoomOut': r.s = 1.18 - .18 * q; break;
    case 'panL': r.s = 1.15; r.dx = (.5 - q) * .23; break;
    case 'panR': r.s = 1.15; r.dx = (q - .5) * .23; break;
    case 'pulse': r.s = 1 + .06 * Math.sin(lt * T * 1.5); break;
    case 'float': r.dy = .035 * Math.sin(lt * T * .6); break;
    case 'shake': { const f = Math.floor(lt * 25); r.dx = (rnd(f) - .5) * .03; r.dy = (rnd(f + 7) - .5) * .03; break; }
    case 'rotate': r.r = lt * 30; break;
    case 'swing': r.r = 8 * Math.sin(lt * T * .5); break;
  }
  return r;
}
function itemAnim(it, t) {
  const lt = t - it.start, A = NEUTRAL();
  if (it.inAnim && it.inAnim.type !== 'none' && lt < it.inAnim.dur) mergeAnim(A, animState(it.inAnim.type, clamp(lt / it.inAnim.dur, 0, 1)));
  const rem = it.len - lt;
  if (it.outAnim && it.outAnim.type !== 'none' && rem < it.outAnim.dur) mergeAnim(A, animState(it.outAnim.type, clamp(rem / it.outAnim.dur, 0, 1)));
  if (it.anim && it.anim !== 'none') mergeAnim(A, loopState(it.anim, lt, it.len));
  return A;
}

/* ---------- Formas (también usadas por máscaras) ---------- */
function shapePath(c, kind, w, h, round = 25) {
  const x = -w / 2, y = -h / 2; c.beginPath();
  const poly = pts => { pts.forEach(([a, b], i) => i ? c.lineTo(a * w, b * h) : c.moveTo(a * w, b * h)); c.closePath(); };
  switch (kind) {
    case 'rounded': case 'line': { const r = Math.min(Math.abs(w), Math.abs(h)) / 2 * (kind === 'line' ? 1 : round / 100);
      if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); break; }
    case 'circle': c.ellipse(0, 0, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2); break;
    case 'triangle': poly([[0, -.5], [.5, .5], [-.5, .5]]); break;
    case 'diamond': poly([[0, -.5], [.5, 0], [0, .5], [-.5, 0]]); break;
    case 'arrow': poly([[-.5, -.15], [.1, -.15], [.1, -.4], [.5, 0], [.1, .4], [.1, .15], [-.5, .15]]); break;
    case 'star': { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? .22 : .5; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } poly(pts); break; }
    case 'heart':
      c.moveTo(0, .5 * h); c.bezierCurveTo(-.15 * w, .35 * h, -.5 * w, .1 * h, -.5 * w, -.2 * h);
      c.bezierCurveTo(-.5 * w, -.5 * h, -.1 * w, -.5 * h, 0, -.2 * h); c.bezierCurveTo(.1 * w, -.5 * h, .5 * w, -.5 * h, .5 * w, -.2 * h);
      c.bezierCurveTo(.5 * w, .1 * h, .15 * w, .35 * h, 0, .5 * h); c.closePath(); break;
    default: c.rect(x, y, w, h);
  }
}

/* ---------- Color: looks + corrección ---------- */
const LOOKS = {
  bw: { n: 'Blanco y negro', gray: 1, con: 1.15 }, noir: { n: 'Noir', gray: 1, con: 1.5, bri: .85, vig: 45 },
  sepia: { n: 'Sepia', sepia: .85, con: 1.05 }, vintage: { n: 'Vintage', sepia: .35, con: .9, sat: 1.2, bri: 1.05, temp: 20, sh: 15, vig: 25 },
  cine: { n: 'Cine teal-naranja', con: 1.15, sat: 1.1, ts: [-.04, .02, .06], th: [.07, .02, -.05] },
  warm: { n: 'Cálido', sat: 1.15, temp: 35 }, cool: { n: 'Frío', sat: 1.05, temp: -35 },
  vivid: { n: 'Vívido', sat: 1.6, con: 1.1 }, fade: { n: 'Mate', con: .85, bri: 1.1, sat: .8, sh: 25 },
  drama: { n: 'Dramático', con: 1.35, sat: .85, bri: .9, vig: 35 }, pastel: { n: 'Pastel', sat: .75, bri: 1.15, con: .9, th: [.04, 0, .04] },
  cyber: { n: 'Cyberpunk', sat: 1.5, con: 1.2, hue: -20, ts: [.05, -.03, .1], th: [.1, -.02, .08] },
  gold: { n: 'Hora dorada', temp: 45, sat: 1.2, bri: 1.05, th: [.08, .04, -.04] },
  matrix: { n: 'Matrix', sat: .7, con: 1.1, ts: [-.05, .05, -.05], th: [-.05, .1, -.05] }, neg: { n: 'Negativo', inv: 1 },
};
function colorSpec(col, extraBlur = 0) {
  const L = col.look !== 'none' ? LOOKS[col.look] : null, k = col.lookAmt / 100;
  let br = col.b / 100, co = col.c / 100, sa = col.s / 100, hu = col.hue, gr = 0, se = 0, inv = 0;
  let temp = col.temp, tint = col.tint, sh = col.sh, hl = col.hl, vig = col.vig, ts = null, th = null;
  if (L) {
    br *= lerp(1, L.bri ?? 1, k); co *= lerp(1, L.con ?? 1, k); sa *= lerp(1, L.sat ?? 1, k); hu += (L.hue || 0) * k;
    gr = (L.gray || 0) * k; se = (L.sepia || 0) * k; inv = (L.inv || 0) * k; temp += (L.temp || 0) * k; sh += (L.sh || 0) * k;
    vig += (L.vig || 0) * k; if (L.ts) ts = L.ts.map(v => v * k); if (L.th) th = L.th.map(v => v * k);
  }
  let css = '';
  if (br !== 1) css += `brightness(${br.toFixed(3)}) `; if (co !== 1) css += `contrast(${co.toFixed(3)}) `;
  if (sa !== 1) css += `saturate(${sa.toFixed(3)}) `; if (hu) css += `hue-rotate(${hu}deg) `;
  if (gr) css += `grayscale(${gr.toFixed(3)}) `; if (se) css += `sepia(${se.toFixed(3)}) `; if (inv) css += `invert(${inv.toFixed(3)}) `;
  const bl = col.bl + extraBlur; if (bl > 0) css += `blur(${bl.toFixed(1)}px)`;
  return { css: css.trim() || 'none', grade: (temp || tint || sh || hl || ts || th) ? { temp, tint, sh, hl, ts, th } : null, vig };
}
function gradePixels(c, g) {
  const img = c.getImageData(0, 0, S.W, S.H), d = img.data;
  const lr = new Float32Array(256), lg = new Float32Array(256), lb = new Float32Array(256);
  for (let v = 0; v < 256; v++) {
    let x = v / 255; x += g.sh / 100 * .2 * (1 - x) * (1 - x); x += g.hl / 100 * .2 * x * x;
    lr[v] = x * (1 + g.temp / 100 * .2) * 255; lg[v] = x * (1 - g.tint / 100 * .15) * 255; lb[v] = x * (1 - g.temp / 100 * .2) * 255;
  }
  const ts = g.ts, th = g.th;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    let r = lr[d[i]], gg = lg[d[i + 1]], b = lb[d[i + 2]];
    if (ts || th) {
      const l = (r + gg + b) / 765, ws = (1 - l) * (1 - l), wh = l * l;
      if (ts) { r += ts[0] * 255 * ws; gg += ts[1] * 255 * ws; b += ts[2] * 255 * ws; }
      if (th) { r += th[0] * 255 * wh; gg += th[1] * 255 * wh; b += th[2] * 255 * wh; }
    }
    d[i] = r; d[i + 1] = gg; d[i + 2] = b;
  }
  c.putImageData(img, 0, 0);
}
function vignette(c, amt, op) {
  const W = S.W, H = S.H, g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .25, W / 2, H / 2, Math.hypot(W, H) * .55);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${clamp(amt / 100 * .9, 0, 1)})`);
  c.save(); c.globalCompositeOperation = op; c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
}
function chromaKey(c, k) {
  const img = c.getImageData(0, 0, S.W, S.H), d = img.data, [kr, kg, kb] = hexRgb(k.color), tol = k.tol * 4.4, soft = Math.max(1, k.soft * 4.4);
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - kr, dg = d[i + 1] - kg, db = d[i + 2] - kb, dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < tol) d[i + 3] = 0; else if (dist < tol + soft) d[i + 3] *= (dist - tol) / soft;
  }
  c.putImageData(img, 0, 0);
}

/* ---------- Medios ---------- */
function srcDims(it) {
  const el = rt(it).el;
  if (it.mt === 'video') return el.readyState >= 2 && el.videoWidth ? [el.videoWidth, el.videoHeight] : null;
  return el.naturalWidth ? [el.naturalWidth, el.naturalHeight] : null;
}
function applyMask(c, it, t, w, h) {
  const m = it.mask, lt = t - it.start; let k = 1, rot = m.rot;
  if (m.anim === 'grow') k = ease(clamp(lt / m.animDur, 0, 1)); else if (m.anim === 'pulse') k = 1 + .12 * Math.sin(lt * 6); else if (m.anim === 'spin') rot += lt * 90;
  c.save(); c.globalCompositeOperation = m.invert ? 'destination-out' : 'destination-in';
  c.filter = m.feather > 0 ? `blur(${m.feather}px)` : 'none'; c.fillStyle = '#000';
  c.translate((m.x - 50) / 100 * w, (m.y - 50) / 100 * h); c.rotate(rot * Math.PI / 180);
  shapePath(c, m.type, m.w / 100 * w * k, m.h / 100 * h * k, m.round); c.fill(); c.restore();
}
function paintMedia(c, it, t, o, A, alpha, withMask, spec) {
  const d = srcDims(it); if (!d) return false;
  const [iw, ih] = d, W = S.W, H = S.H, el = rt(it).el;
  const s = it.fit === 'contain' ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih), w = iw * s, h = ih * s;
  const sc = it.scale / 100 * A.s * o.scale, cx = W * it.x / 100 + o.dx + A.dx * W * .6, cy = H * it.y / 100 + o.dy + A.dy * H * .6;
  c.save(); c.globalAlpha = alpha;
  if (it.bgBlur && it.fit === 'contain' && isMain(it)) {
    const sb = Math.max(W / iw, H / ih) * 1.1; c.save(); c.filter = 'blur(28px) brightness(.65)';
    c.drawImage(el, W / 2 - iw * sb / 2, H / 2 - ih * sb / 2, iw * sb, ih * sb); c.restore();
  }
  c.translate(cx, cy); c.rotate((it.rot + A.r) * Math.PI / 180); c.scale(sc * (it.flipH ? -1 : 1) * A.sx, sc);
  c.filter = A.bl ? colorSpec(it.color, A.bl).css : spec.css;
  c.drawImage(el, -w / 2, -h / 2, w, h);
  if (withMask && it.mask.type !== 'none') { c.filter = 'none'; applyMask(c, it, t, w, h); }
  c.restore();
  const rad = (it.rot + A.r) * Math.PI / 180, hw = w * sc / 2, hh = h * sc / 2;
  const ex = Math.abs(hw * Math.cos(rad)) + Math.abs(hh * Math.sin(rad)), ey = Math.abs(hw * Math.sin(rad)) + Math.abs(hh * Math.cos(rad));
  BOX.set(it.id, { x: cx - ex, y: cy - ey, w: 2 * ex, h: 2 * ey });
  return true;
}
const ID_OPTS = Object.freeze({ dx: 0, dy: 0, alpha: 1, scale: 1, clip: null });
function drawMedia(it, t, o) {
  const A = itemAnim(it, t), spec = colorSpec(it.color, 0), alpha = it.opacity / 100 * A.a * o.alpha;
  if (alpha <= 0.002) return;
  const off = it.mask.type !== 'none' || it.chroma.on || spec.grade || spec.vig > 0;
  ctx.save(); if (o.clip) o.clip(ctx); ctx.globalCompositeOperation = it.blend;
  if (!off) paintMedia(ctx, it, t, o, A, alpha, false, spec);
  else {
    icx.setTransform(1, 0, 0, 1, 0, 0); icx.globalCompositeOperation = 'source-over'; icx.globalAlpha = 1; icx.filter = 'none'; icx.clearRect(0, 0, S.W, S.H);
    if (paintMedia(icx, it, t, o, A, 1, true, spec)) {
      if (it.chroma.on) chromaKey(icx, it.chroma);
      if (spec.grade) gradePixels(icx, spec.grade);
      if (spec.vig > 0) vignette(icx, spec.vig, 'source-atop');
      ctx.globalAlpha = alpha; ctx.drawImage(ic, 0, 0);
    }
  }
  ctx.restore();
  if (!isMain(it)) HITS.push(it.id);
}
function drawShape(it, t) {
  const A = itemAnim(it, t), W = S.W, H = S.H, m = Math.min(W, H), alpha = it.opacity / 100 * A.a;
  if (alpha <= .002) return;
  const w = it.w / 100 * m, h = it.h / 100 * m, sc = it.scale / 100 * A.s;
  const cx = W * it.x / 100 + A.dx * W * .6, cy = H * it.y / 100 + A.dy * H * .6;
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = it.blend;
  if (A.bl) ctx.filter = `blur(${A.bl}px)`;
  ctx.translate(cx, cy); ctx.rotate((it.rot + A.r) * Math.PI / 180); ctx.scale(sc * A.sx, sc);
  if (it.shadow) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; }
  shapePath(ctx, it.kind, w, h, it.radius); ctx.fillStyle = it.fill; ctx.fill();
  if (it.strokeW > 0) { ctx.shadowColor = 'transparent'; ctx.lineWidth = it.strokeW; ctx.strokeStyle = it.stroke; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.restore();
  const rad = (it.rot + A.r) * Math.PI / 180, ex = Math.abs(w * sc / 2 * Math.cos(rad)) + Math.abs(h * sc / 2 * Math.sin(rad)), ey = Math.abs(w * sc / 2 * Math.sin(rad)) + Math.abs(h * sc / 2 * Math.cos(rad));
  BOX.set(it.id, { x: cx - ex, y: cy - ey, w: 2 * ex, h: 2 * ey }); HITS.push(it.id);
}

/* ---------- Transiciones (pista principal) ---------- */
function transitionOpts(type, p) {
  const e = ease(p), W = S.W, H = S.H, base = () => ({ dx: 0, dy: 0, alpha: 1, scale: 1, clip: null }), o = base(), i = base();
  switch (type) {
    case 'fade': i.alpha = e; break;
    case 'dip': o.alpha = p < .5 ? 1 - p * 2 : 0; i.alpha = p > .5 ? (p - .5) * 2 : 0; break;
    case 'slideL': o.dx = -W * e; i.dx = W * (1 - e); break; case 'slideR': o.dx = W * e; i.dx = -W * (1 - e); break;
    case 'slideU': o.dy = -H * e; i.dy = H * (1 - e); break; case 'slideD': o.dy = H * e; i.dy = -H * (1 - e); break;
    case 'wipeL': i.clip = c => { c.beginPath(); c.rect(0, 0, W * e, H); c.clip(); }; break;
    case 'wipeR': i.clip = c => { c.beginPath(); c.rect(W * (1 - e), 0, W * e, H); c.clip(); }; break;
    case 'circle': i.clip = c => { c.beginPath(); c.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * e, 0, Math.PI * 2); c.clip(); }; break;
    case 'zoom': o.scale = 1 + .5 * e; o.alpha = 1 - e; i.scale = .8 + .2 * e; i.alpha = e; break;
  }
  return { o, i };
}
function drawMain(act, t) {
  if (act.length === 1) drawMedia(act[0], t, ID_OPTS);
  else if (act.length >= 2) {
    const out = act[act.length - 2], inc = act[act.length - 1], p = inc.ov > 0 ? clamp((t - inc.start) / inc.ov, 0, 1) : 1, tr = transitionOpts(inc.transition.type, p);
    drawMedia(out, t, tr.o); drawMedia(inc, t, tr.i);
  }
}

/* ---------- Efectos de video (capa de efectos) ---------- */
function snapFrame() { fxx.setTransform(1, 0, 0, 1, 0, 0); fxx.clearRect(0, 0, S.W, S.H); fxx.drawImage(canvas, 0, 0); }
function fxTransform({ s = 1, dx = 0, dy = 0, rot = 0, filter = 'none' }) {
  snapFrame(); ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S.W, S.H); ctx.filter = filter;
  ctx.translate(S.W / 2 + dx, S.H / 2 + dy); ctx.rotate(rot); ctx.scale(s, s); ctx.drawImage(fxc, -S.W / 2, -S.H / 2); ctx.restore();
}
function rgbSplit(off, oy = 0) {
  snapFrame(); ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S.W, S.H); ctx.globalCompositeOperation = 'lighter';
  [['#ff0000', off, oy], ['#00ff00', 0, 0], ['#0000ff', -off, -oy]].forEach(([col, dx, dy]) => {
    fx2x.globalCompositeOperation = 'source-over'; fx2x.clearRect(0, 0, S.W, S.H); fx2x.drawImage(fxc, 0, 0);
    fx2x.globalCompositeOperation = 'multiply'; fx2x.fillStyle = col; fx2x.fillRect(0, 0, S.W, S.H); fx2x.globalCompositeOperation = 'source-over';
    ctx.drawImage(fx2, dx, dy);
  });
  ctx.restore();
}
function applyFx(fx, t) {
  const lt = t - fx.start, p = clamp(lt / fx.len, 0, 1), a = fx.amt / 100, W = S.W, H = S.H, scl = Math.min(W, H) / 720;
  switch (fx.kind) {
    case 'zoomIn': fxTransform({ s: 1 + .7 * a * ease(p) }); break;
    case 'zoomOut': fxTransform({ s: 1 + .7 * a * (1 - ease(p)) }); break;
    case 'punch': fxTransform({ s: 1 + .5 * a * (1 - easeOut(p)) }); break;
    case 'pulse': fxTransform({ s: 1 + .12 * a * Math.abs(Math.sin(lt * Math.PI * 2)) }); break;
    case 'blur': fxTransform({ s: 1.04, filter: `blur(${24 * a * scl}px)` }); break;
    case 'blurIn': fxTransform({ s: 1.04, filter: `blur(${24 * a * scl * (1 - ease(p))}px)` }); break;
    case 'blurOut': fxTransform({ s: 1.04, filter: `blur(${24 * a * scl * ease(p)}px)` }); break;
    case 'shake': { const f = Math.floor(lt * 30); fxTransform({ s: 1.07, dx: (rnd(f) - .5) * 2 * 40 * a * scl, dy: (rnd(f + 5) - .5) * 2 * 40 * a * scl, rot: (rnd(f + 9) - .5) * .05 * a }); break; }
    case 'flash': { ctx.save(); ctx.globalAlpha = clamp(a * 1.4 * (1 - ease(p)), 0, 1); ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, W, H); ctx.restore(); break; }
    case 'strobe': if (Math.floor(lt * 10) % 2 === 0) { ctx.save(); ctx.globalAlpha = .85 * a; ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, W, H); ctx.restore(); } break;
    case 'rgb': rgbSplit(22 * a * scl * (.5 + .5 * Math.sin(lt * 9))); break;
    case 'glitch': {
      const f = Math.floor(lt * 12); rgbSplit((rnd(f) * 30 + 6) * a * scl, (rnd(f + 3) - .5) * 8 * a * scl); snapFrame();
      for (let i = 0; i < 6; i++) { const y = rnd(f * 7 + i) * H, h = (.01 + rnd(f * 3 + i) * .08) * H, dx = (rnd(f * 5 + i) - .5) * .25 * W * a; ctx.drawImage(fxc, 0, y, W, h, dx, y, W, h); }
      break;
    }
    case 'vignette': vignette(ctx, a * 100 * 1.1, 'source-over'); break;
    case 'grain': {
      const key = Math.floor(t * 18); if (!grainC) { grainC = document.createElement('canvas'); grainC.width = grainC.height = 256; }
      if (key !== grainKey) { grainKey = key; const g = grainC.getContext('2d'), im = g.createImageData(256, 256); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }
      ctx.save(); ctx.globalAlpha = .45 * a; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(grainC, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore(); break;
    }
    case 'leak': {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = a * Math.sin(Math.PI * p);
      const cx = W * (p * 1.5 - .25), g = ctx.createRadialGradient(cx, H * .3, 0, cx, H * .3, W * .6);
      g.addColorStop(0, 'rgba(255,190,80,.95)'); g.addColorStop(.5, 'rgba(255,90,60,.45)'); g.addColorStop(1, 'rgba(255,60,120,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); break;
    }
    case 'bars': { const h = H * .13 * a * ease(Math.min(1, p * 5, (1 - p) * 5 + .0001)); ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h); ctx.restore(); break; }
    case 'look': {
      const sp = colorSpec(fx.color, 0); if (sp.css !== 'none') fxTransform({ filter: sp.css });
      if (sp.grade) gradePixels(ctx, sp.grade); if (sp.vig > 0) vignette(ctx, sp.vig, 'source-over'); break;
    }
  }
}

/* ---------- Texto animado ---------- */
function drawText(it, t) {
  const W = S.W, H = S.H, scl = Math.min(W, H) / 720, lt = t - it.start, len = it.len, px = it.size * scl;
  ctx.save();
  ctx.font = `${it.italic ? 'italic ' : ''}${it.bold ? 700 : 400} ${px}px "${it.font}", sans-serif`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
  const raw = it.upper ? it.text.toUpperCase() : it.text, spaceW = ctx.measureText(' ').width, maxW = W * .88;
  const byChar = it.animBy === 'char' || it.inAnim === 'typewriter';
  const lines = []; let wi = 0;
  raw.split('\n').forEach(par => {
    let cur = { us: [], w: 0 };
    par.split(/\s+/).filter(Boolean).forEach(word => {
      const ww = ctx.measureText(word).width;
      if (cur.us.length && cur.w + spaceW + ww > maxW) { lines.push(cur); cur = { us: [], w: 0 }; }
      let x = cur.w + (cur.us.length ? spaceW : 0); const idx = wi++;
      if (byChar) for (const ch of word) { const cw = ctx.measureText(ch).width; cur.us.push({ t: ch, x, w: cw, wi: idx }); x += cw; }
      else { cur.us.push({ t: word, x, w: ww, wi: idx }); x += ww; }
      cur.w = x;
    });
    lines.push(cur);
  });
  const nW = Math.max(1, wi), nU = Math.max(1, lines.reduce((a, l) => a + l.us.length, 0));
  const lineH = px * 1.28, blockH = lines.length * lineH, blockW = Math.max(1, ...lines.map(l => l.w));
  const cx = W * it.x / 100, cy = H * it.y / 100, top = cy - blockH / 2;

  // bucle a nivel de bloque
  const T = Math.PI * 2, L = { s: 1, dy: 0, r: 0, a: 1, glow: 1 };
  switch (it.loopAnim) {
    case 'pulse': L.s = 1 + .06 * Math.sin(lt * T * 1.6); break;
    case 'float': L.dy = Math.sin(lt * T * .7) * px * .15; break;
    case 'swing': L.r = 6 * Math.sin(lt * T * .6); break;
    case 'glow': L.glow = .5 + .5 * Math.sin(lt * T * 1.2) + .15; break;
    case 'flicker': L.a = rnd(Math.floor(lt * 18)) > .15 ? 1 : .25; break;
  }
  const step = it.animBy === 'all' ? 0 : Math.min(it.animBy === 'char' ? .045 : .12, len * .5 / nU);
  const typeTotal = Math.min(Math.max(it.animDur, nU * .04), len * .7);
  const prog = clamp(lt / Math.max(len, .01), 0, .9999), aw = Math.floor(prog * nW);

  // estados por unidad
  let gi = 0, maxA = 0; const st = [];
  lines.forEach(l => l.us.forEach(u => {
    const pin = it.animDur > 0 ? clamp((lt - gi * step) / it.animDur, 0, 1) : 1;
    const pout = it.animDur > 0 ? clamp((len - lt - (nU - 1 - gi) * step) / it.animDur, 0, 1) : 1;
    const s = it.inAnim === 'typewriter' || it.inAnim === 'none' ? NEUTRAL() : animState(it.inAnim, pin);
    if (it.inAnim === 'typewriter') s.a = lt >= gi / nU * typeTotal ? 1 : 0;
    if (it.outAnim !== 'none') mergeAnim(s, animState(it.outAnim, pout));
    if (it.loopAnim === 'wave') s.dy += Math.sin(lt * 6 + gi * .6) * .22;
    if (it.loopAnim === 'shake') { const f = Math.floor(lt * 25); s.dx += (rnd(f + gi) - .5) * .12; s.dy += (rnd(f + gi + 50) - .5) * .12; }
    u.st = s; maxA = Math.max(maxA, s.a); gi++;
  }));

  ctx.translate(cx, cy + L.dy); ctx.rotate((it.rot + L.r) * Math.PI / 180); ctx.scale(it.scale / 100 * L.s, it.scale / 100 * L.s); ctx.translate(-cx, -cy);
  const baseA = it.opacity / 100 * L.a;
  if (it.bgOpacity > 0 && maxA > 0) {
    const pad = px * .35; ctx.globalAlpha = baseA * maxA; ctx.fillStyle = hexA(it.bg, it.bgOpacity / 100);
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(cx - blockW / 2 - pad, top - pad * .4, blockW + pad * 2, blockH + pad * .8, px * .3); else ctx.rect(cx - blockW / 2 - pad, top - pad * .4, blockW + pad * 2, blockH + pad * .8); ctx.fill();
  }
  gi = 0;
  lines.forEach((l, li) => l.us.forEach(u => {
    const s = u.st, uy = top + lineH * (li + .5), ux = cx - l.w / 2 + u.x + u.w / 2;
    if (s.a > .002) {
      ctx.save();
      const active = it.wordFx !== 'none' && u.wi === aw, passed = u.wi <= aw;
      let col = it.color;
      if (it.wordFx === 'karaoke' && passed) col = it.hlColor; else if ((it.wordFx === 'active' || it.wordFx === 'activePop') && active) col = it.hlColor;
      if (it.loopAnim === 'rainbow') col = `hsl(${(lt * 120 + gi * 25) % 360},100%,60%)`;
      const pop = it.wordFx === 'activePop' && active ? 1.22 : 1;
      ctx.translate(ux + s.dx * px * 1.2, uy + s.dy * px * 1.2); ctx.rotate(s.r * Math.PI / 180); ctx.scale(s.s * s.sx * pop, s.s * pop);
      ctx.globalAlpha = baseA * s.a; if (s.bl > .1) ctx.filter = `blur(${s.bl * scl}px)`;
      if (it.wordFx === 'activeBox' && active) { ctx.fillStyle = it.hlColor; ctx.beginPath(); const bx = -u.w / 2 - px * .12; if (ctx.roundRect) ctx.roundRect(bx, -lineH * .42, u.w + px * .24, lineH * .84, px * .18); else ctx.rect(bx, -lineH * .42, u.w + px * .24, lineH * .84); ctx.fill(); }
      if (it.glowBlur > 0) { ctx.shadowColor = it.glow; ctx.shadowBlur = it.glowBlur * scl * L.glow; }
      else if (it.shadow) { ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = px * .15; ctx.shadowOffsetY = px * .05; }
      if (it.strokeW > 0) { ctx.lineWidth = it.strokeW * scl; ctx.strokeStyle = it.stroke; ctx.strokeText(u.t, -u.w / 2, 0); }
      if (!(it.glowBlur > 0)) ctx.shadowColor = 'transparent';
      ctx.fillStyle = col; ctx.fillText(u.t, -u.w / 2, 0);
      if (it.glowBlur > 0) ctx.fillText(u.t, -u.w / 2, 0);
      ctx.restore();
    }
    gi++;
  }));
  ctx.restore();
  const sc = it.scale / 100 * L.s;
  BOX.set(it.id, { x: cx - blockW * sc / 2 - 10, y: cy + L.dy - blockH * sc / 2 - 10, w: blockW * sc + 20, h: blockH * sc + 20 });
  HITS.push(it.id);
}

/* ---------- Fotograma completo ---------- */
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = S.bg; ctx.fillRect(0, 0, S.W, S.H); BOX.clear(); HITS.length = 0;
  for (const tr of S.tracks.filter(k => k.kind === 'video').reverse()) {
    const act = itemsOn(tr.id, t);
    if (tr.main) drawMain(act, t); else act.forEach(it => it.type === 'shape' ? drawShape(it, t) : drawMedia(it, t, ID_OPTS));
  }
  const tt = Math.min(t, S.total - .001);
  S.items.filter(i => i.type === 'fx' && tt >= i.start && tt < i.start + i.len).forEach(fx => applyFx(fx, t));
  for (const tr of S.tracks.filter(k => k.kind === 'text').reverse()) itemsOn(tr.id, t).forEach(it => drawText(it, t));
  const sel = byId(S.items, S.sel), b = sel && BOX.get(sel.id);
  if (b && !S.exporting && !isMain(sel)) {
    ctx.save(); ctx.strokeStyle = '#5b8cff'; ctx.lineWidth = 2 * Math.max(1, S.W / 1280); ctx.setLineDash([10, 7]); ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.restore();
  }
}
