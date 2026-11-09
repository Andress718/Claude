'use strict';
/* ============================================================
   Editor de Video — todo corre en el navegador (sin servidor).
   Modelo: clips (pista de video) + subs (pista de texto).
   Render: <canvas> 2D. Exportación: captureStream + MediaRecorder.
   ============================================================ */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let _uid = 1; const nid = () => _uid++;

/* ---------- Estado ---------- */
const S = {
  W: 1280, H: 720, fps: 30,
  media: [],           // {id,name,type,url,duration,w,h}
  clips: [],           // ver newClip()
  subs: [],            // ver newSub()
  selClip: null, selSub: null,
  t: 0, total: 0, playing: false, zoom: 80,
  exporting: false,
};
const canvas = $('#screen'), ctx = canvas.getContext('2d');

/* ---------- Utilidades ---------- */
const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const easeOutBack = p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const easeOutBounce = p => {
  const n = 7.5625, d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + .75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + .9375;
  return n * (p -= 2.625 / d) * p + .984375;
};
const getPath = (o, p) => p.split('.').reduce((a, k) => a && a[k], o);
const setPath = (o, p, v) => { const ks = p.split('.'), l = ks.pop(); ks.reduce((a, k) => a[k], o)[l] = v; };
function fmt(t, ms = true) {
  t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60;
  return String(m).padStart(2, '0') + ':' + (ms ? s.toFixed(2).padStart(5, '0') : String(Math.floor(s)).padStart(2, '0'));
}
const byId = (arr, id) => arr.find(x => x.id === id);

/* ---------- Fuentes ---------- */
const FONTS = ['Poppins', 'Montserrat', 'Oswald', 'Bebas Neue', 'Anton', 'Playfair Display', 'Pacifico', 'Lobster',
  'Permanent Marker', 'Roboto Mono', 'Arial', 'Georgia', 'Impact', 'Courier New', 'Verdana'];
function fillFontSelect() {
  const sel = $('#font-select'); sel.innerHTML = '';
  FONTS.forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f; o.style.fontFamily = f; sel.appendChild(o); });
}
function ensureFont(name, bold) {
  return document.fonts.load(`${bold ? 700 : 400} 40px "${name}"`).catch(() => { });
}

/* ---------- Modelos ---------- */
const SUB_DEFAULT = {
  font: 'Poppins', size: 54, bold: true, italic: false, upper: false, shadow: true,
  color: '#ffffff', hlColor: '#ffd400', stroke: '#000000', strokeW: 6, bg: '#000000', bgOpacity: 0,
  x: 50, y: 84, anim: 'fade', animDur: 0.35, animOut: true,
};
const PRESETS = {
  'Clásico': { font: 'Poppins', size: 52, bold: true, color: '#ffffff', stroke: '#000000', strokeW: 6, bgOpacity: 0, shadow: true, upper: false, italic: false },
  'Caja': { font: 'Montserrat', size: 46, bold: true, color: '#ffffff', stroke: '#000000', strokeW: 0, bg: '#000000', bgOpacity: 70, shadow: false, upper: false, italic: false },
  'Neón': { font: 'Oswald', size: 60, bold: true, color: '#7dfcff', stroke: '#0066ff', strokeW: 8, bgOpacity: 0, shadow: true, upper: true, italic: false },
  'Cómic': { font: 'Permanent Marker', size: 62, bold: false, color: '#ffe600', stroke: '#000000', strokeW: 10, bgOpacity: 0, shadow: true, upper: true, italic: false },
  'Karaoke': { font: 'Anton', size: 68, bold: false, color: '#ffffff', hlColor: '#ffd400', stroke: '#000000', strokeW: 8, bgOpacity: 0, shadow: true, upper: true, anim: 'karaoke' },
  'Elegante': { font: 'Playfair Display', size: 48, bold: false, italic: true, color: '#fff7e6', stroke: '#000000', strokeW: 3, bgOpacity: 0, shadow: true, upper: false },
};
function newSub(start, end, text, base) {
  return { id: nid(), text, start, end, ...SUB_DEFAULT, ...(base || {}) };
}
function newClip(media, trimIn = 0, trimOut = null) {
  const c = {
    id: nid(), mediaId: media.id, type: media.type, name: media.name,
    trimIn, trimOut: trimOut ?? (media.type === 'image' ? 4 : media.duration),
    volume: 1, fit: 'cover', anim: 'none',
    transition: { type: 'none', dur: 0.6 },
    filter: { b: 100, c: 100, s: 100, bl: 0 },
    start: 0, len: 0, ov: 0, el: null,
  };
  c.el = makeEl(media);
  return c;
}
function makeEl(media) {
  if (media.type === 'image') { const i = new Image(); i.src = media.url; return i; }
  const v = document.createElement('video');
  v.src = media.url; v.preload = 'auto'; v.playsInline = true; v.crossOrigin = 'anonymous';
  if (audio.ctx) hookAudio(v);
  return v;
}

/* ---------- Deshacer ---------- */
const undoStack = [];
function snapshot() {
  return {
    clips: S.clips.map(c => ({ ...c, transition: { ...c.transition }, filter: { ...c.filter } })),
    subs: S.subs.map(s => ({ ...s })), selClip: S.selClip, selSub: S.selSub,
  };
}
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 80) undoStack.shift(); }
function undo() {
  const s = undoStack.pop(); if (!s) return;
  S.clips = s.clips; S.subs = s.subs; S.selClip = s.selClip; S.selSub = s.selSub;
  changed(true);
}

/* ---------- Layout de la línea de tiempo ---------- */
function layout() {
  S.clips.forEach((c, i) => {
    c.len = Math.max(0.05, c.trimOut - c.trimIn);
    const prev = S.clips[i - 1];
    c.ov = (prev && c.transition.type !== 'none') ? Math.min(c.transition.dur, c.len * .9, prev.len * .9) : 0;
    c.start = prev ? prev.start + prev.len - c.ov : 0;
  });
  const last = S.clips[S.clips.length - 1];
  S.total = last ? last.start + last.len : Math.max(0, ...S.subs.map(s => s.end));
}

/* ---------- Audio (para exportar con sonido) ---------- */
const audio = { ctx: null, dest: null };
function ensureAudio() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  audio.dest = audio.ctx.createMediaStreamDestination();
  S.clips.forEach(c => { if (c.type === 'video') hookAudio(c.el); });
}
function hookAudio(el) {
  if (el._hooked) return; el._hooked = true;
  try {
    const src = audio.ctx.createMediaElementSource(el);
    src.connect(audio.ctx.destination); src.connect(audio.dest);
  } catch (e) { console.warn('audio hook', e); }
}

/* ============================================================
   RENDER
   ============================================================ */
function transitionOpts(type, p) {
  const e = ease(p), W = S.W, H = S.H;
  const base = () => ({ dx: 0, dy: 0, alpha: 1, scale: 1, clip: null });
  const o = base(), i = base();
  switch (type) {
    case 'fade': i.alpha = e; break;
    case 'dip': o.alpha = p < .5 ? 1 - p * 2 : 0; i.alpha = p > .5 ? (p - .5) * 2 : 0; break;
    case 'slideL': o.dx = -W * e; i.dx = W * (1 - e); break;
    case 'slideR': o.dx = W * e; i.dx = -W * (1 - e); break;
    case 'slideU': o.dy = -H * e; i.dy = H * (1 - e); break;
    case 'slideD': o.dy = H * e; i.dy = -H * (1 - e); break;
    case 'wipeL': i.clip = c => { c.beginPath(); c.rect(0, 0, W * e, H); c.clip(); }; break;
    case 'wipeR': i.clip = c => { c.beginPath(); c.rect(W * (1 - e), 0, W * e, H); c.clip(); }; break;
    case 'circle': i.clip = c => { c.beginPath(); c.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * e, 0, Math.PI * 2); c.clip(); }; break;
    case 'zoom': o.scale = 1 + .5 * e; o.alpha = 1 - e; i.scale = .8 + .2 * e; i.alpha = e; break;
  }
  return { o, i };
}

function drawClip(c, t, o) {
  const el = c.el, W = S.W, H = S.H;
  const iw = c.type === 'video' ? el.videoWidth : el.naturalWidth;
  const ih = c.type === 'video' ? el.videoHeight : el.naturalHeight;
  if (!iw || !ih || (c.type === 'video' && el.readyState < 2)) return;
  const q = clamp((t - c.start) / c.len, 0, 1);
  let sc = o.scale, px = 0;
  switch (c.anim) {
    case 'zoomIn': sc *= 1 + .18 * q; break;
    case 'zoomOut': sc *= 1.18 - .18 * q; break;
    case 'panLeft': sc *= 1.15; px = (.5 - q) * .14 * W; break;
    case 'panRight': sc *= 1.15; px = (q - .5) * .14 * W; break;
  }
  const f = c.filter; let flt = '';
  if (f.b !== 100) flt += `brightness(${f.b}%) `;
  if (f.c !== 100) flt += `contrast(${f.c}%) `;
  if (f.s !== 100) flt += `saturate(${f.s}%) `;
  if (f.bl > 0) flt += `blur(${f.bl}px)`;
  ctx.save();
  ctx.globalAlpha = o.alpha;
  if (o.clip) o.clip(ctx);
  ctx.translate(W / 2 + o.dx + px, H / 2 + o.dy);
  ctx.scale(sc, sc);
  if (flt) ctx.filter = flt;
  const s = c.fit === 'contain' ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
  ctx.drawImage(el, -iw * s / 2, -ih * s / 2, iw * s, ih * s);
  ctx.restore();
}

function activeClips(t) {
  const tt = Math.min(t, S.total - 0.001);
  return S.clips.filter(c => tt >= c.start && tt < c.start + c.len).sort((a, b) => a.start - b.start);
}

function drawSub(s, t) {
  const W = S.W, H = S.H, scl = Math.min(W, H) / 720;
  const lt = t - s.start, dur = s.end - s.start;
  const pin = s.animDur > 0 ? clamp(lt / s.animDur, 0, 1) : 1;
  const pout = (s.animOut && s.animDur > 0) ? clamp((s.end - t) / s.animDur, 0, 1) : 1;
  const ei = ease(pin), eo = ease(pout);
  let alpha = 1, dx = 0, dy = 0, zs = 1, chars = Infinity, kar = -1;
  switch (s.anim) {
    case 'fade': alpha = ei * eo; break;
    case 'pop': zs = easeOutBack(pin) * (eo < 1 ? .6 + .4 * eo : 1); alpha = Math.min(ei * 3, 1) * eo; break;
    case 'slideUp': dy = (1 - ei) * 55 * scl - (1 - eo) * 55 * scl; alpha = ei * eo; break;
    case 'slideDown': dy = -(1 - ei) * 55 * scl + (1 - eo) * 55 * scl; alpha = ei * eo; break;
    case 'slideLeft': dx = (1 - ei) * 160 * scl - (1 - eo) * 160 * scl; alpha = ei * eo; break;
    case 'typewriter': chars = pin; alpha = eo; break;
    case 'bounce': dy = -(1 - easeOutBounce(pin)) * 90 * scl; alpha = Math.min(pin * 4, 1) * eo; break;
    case 'zoom': zs = 1.7 - .7 * ei; alpha = ei * eo; break;
    case 'karaoke': alpha = ei * eo; kar = clamp(lt / dur, 0, 1); break;
  }
  if (alpha <= 0.001) return;

  const px = s.size * scl;
  ctx.font = `${s.italic ? 'italic ' : ''}${s.bold ? 700 : 400} ${px}px "${s.font}", sans-serif`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const raw = s.upper ? s.text.toUpperCase() : s.text;
  const maxW = W * .88, spaceW = ctx.measureText(' ').width;
  const lines = [];
  raw.split('\n').forEach(par => {
    let cur = [], curW = 0;
    par.split(/\s+/).filter(Boolean).forEach(w => {
      const ww = ctx.measureText(w).width;
      if (cur.length && curW + spaceW + ww > maxW) { lines.push({ ws: cur, w: curW }); cur = []; curW = 0; }
      curW += (cur.length ? spaceW : 0) + ww; cur.push({ t: w, w: ww });
    });
    lines.push({ ws: cur, w: curW });
  });
  const lineH = px * 1.28, blockH = lines.length * lineH, blockW = Math.max(...lines.map(l => l.w), 1);
  const cx = s.x / 100 * W, cy = s.y / 100 * H, top = cy - blockH / 2;
  const nWords = lines.reduce((a, l) => a + l.ws.length, 0);
  const nChars = lines.reduce((a, l) => a + l.ws.reduce((b, w) => b + w.t.length, 0), 0);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx + dx, cy + dy); ctx.scale(zs, zs); ctx.translate(-cx, -cy);

  if (s.bgOpacity > 0) {
    const pad = px * .35, r = px * .3;
    ctx.fillStyle = hexA(s.bg, s.bgOpacity / 100);
    roundRect(ctx, cx - blockW / 2 - pad, top - pad * .4, blockW + pad * 2, blockH + pad * .8, r); ctx.fill();
  }
  ctx.lineJoin = 'round';
  let gi = 0, ci = 0; const charLimit = chars === Infinity ? Infinity : Math.ceil(nChars * chars);
  lines.forEach((l, li) => {
    let x = cx - l.w / 2; const y = top + lineH * (li + .5);
    l.ws.forEach(w => {
      let txt = w.t;
      if (charLimit !== Infinity) { const left = charLimit - ci; txt = left <= 0 ? '' : txt.slice(0, left); }
      ci += w.t.length;
      if (txt) {
        const hl = kar >= 0 && gi < kar * nWords + 0.0001 && kar > 0;
        if (s.shadow) { ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = px * .15; ctx.shadowOffsetY = px * .05; }
        if (s.strokeW > 0) { ctx.lineWidth = s.strokeW * scl; ctx.strokeStyle = s.stroke; ctx.strokeText(txt, x, y); }
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = hl ? s.hlColor : s.color; ctx.fillText(txt, x, y);
      }
      x += w.w + spaceW; gi++;
    });
  });
  ctx.restore();
  s._box = { x: cx - blockW / 2 - 10, y: top - 10, w: blockW + 20, h: blockH + 20 };
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S.W, S.H);
  const act = activeClips(t), id = { dx: 0, dy: 0, alpha: 1, scale: 1, clip: null };
  if (act.length === 1) drawClip(act[0], t, id);
  else if (act.length >= 2) {
    const out = act[act.length - 2], inc = act[act.length - 1];
    const p = inc.ov > 0 ? clamp((t - inc.start) / inc.ov, 0, 1) : 1;
    const tr = transitionOpts(inc.transition.type, p);
    drawClip(out, t, tr.o); drawClip(inc, t, tr.i);
  }
  S.subs.forEach(s => { s._box = null; if (t >= s.start && t <= s.end) drawSub(s, t); });
  if (S.t_selOutline && S.selSub) {
    const s = byId(S.subs, S.selSub);
    if (s && s._box && !S.exporting) {
      ctx.save(); ctx.strokeStyle = '#a05cc9'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
      ctx.strokeRect(s._box.x, s._box.y, s._box.w, s._box.h); ctx.restore();
    }
  }
}
S.t_selOutline = true;

/* ---------- Sincronía de medios ---------- */
function syncMedia(t) {
  S.clips.forEach((c, i) => {
    if (c.type !== 'video') return;
    const el = c.el, active = t >= c.start && t < c.start + c.len, want = c.trimIn + (t - c.start);
    let vol = c.volume;
    if (c.ov > 0 && t < c.start + c.ov) vol *= clamp((t - c.start) / c.ov, 0, 1);
    const nx = S.clips[i + 1];
    if (nx && nx.ov > 0 && t > nx.start) vol *= 1 - clamp((t - nx.start) / nx.ov, 0, 1);
    el.volume = clamp(vol, 0, 1);
    if (active) {
      if (S.playing) {
        if (el.paused) { el.currentTime = want; el.play().catch(() => { }); }
        else if (Math.abs(el.currentTime - want) > .3) el.currentTime = want;
      } else {
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - want) > .04) el.currentTime = want;
      }
    } else {
      if (!el.paused) el.pause();
      if (t < c.start && c.start - t < 1.2 && Math.abs(el.currentTime - c.trimIn) > .05) el.currentTime = c.trimIn;
    }
  });
}

/* ---------- Bucle principal ---------- */
let wallStart = 0, tStart = 0;
function play() {
  if (S.playing) return;
  if (!S.total) return;
  ensureAudio();
  if (S.t >= S.total - .02) S.t = 0;
  S.playing = true; wallStart = performance.now(); tStart = S.t; $('#btn-play').textContent = '⏸';
}
function pause() {
  S.playing = false; $('#btn-play').textContent = '▶';
  S.clips.forEach(c => c.type === 'video' && c.el.pause());
}
function seek(t) { S.t = clamp(t, 0, S.total); if (S.playing) { wallStart = performance.now(); tStart = S.t; } }

function frame() {
  if (S.playing) {
    S.t = tStart + (performance.now() - wallStart) / 1000;
    if (S.t >= S.total) {
      S.t = S.total; pause();
      if (S.exporting) finishExport();
    }
  }
  syncMedia(S.t);
  render(S.t);
  $('#timecode').textContent = fmt(S.t) + ' / ' + fmt(S.total);
  $('#playhead').style.left = (S.t * S.zoom) + 'px';
  requestAnimationFrame(frame);
}

/* ============================================================
   IMPORTAR MEDIOS
   ============================================================ */
async function importFiles(files) {
  for (const f of files) {
    const type = f.type.startsWith('image') ? 'image' : f.type.startsWith('video') ? 'video' : null;
    if (!type) continue;
    const url = URL.createObjectURL(f);
    const m = { id: nid(), name: f.name, type, url, duration: 4, w: 0, h: 0 };
    if (type === 'video') {
      await new Promise(res => {
        const v = document.createElement('video'); v.preload = 'metadata'; v.src = url;
        v.onloadedmetadata = () => {
          const done = () => { m.duration = v.duration; m.w = v.videoWidth; m.h = v.videoHeight; res(); };
          if (v.duration === Infinity) { v.currentTime = 1e101; v.ontimeupdate = () => { v.ontimeupdate = null; done(); }; } else done();
        };
        v.onerror = () => res();
      });
    } else {
      await new Promise(res => { const i = new Image(); i.onload = () => { m.w = i.naturalWidth; m.h = i.naturalHeight; res(); }; i.onerror = res; i.src = url; });
    }
    S.media.push(m);
    pushUndo();
    const c = newClip(m); S.clips.push(c); S.selClip = c.id;
    if (S.clips.length === 1 && m.w && m.h) autoAspect(m);
  }
  renderBin(); changed(); showTab('clip');
}
function autoAspect(m) { /* mantiene formato elegido; sólo sugiere vertical */
  if (m.h > m.w * 1.2 && S.W > S.H) { $('#aspect').value = '720x1280'; setAspect('720x1280'); }
}
function renderBin() {
  const box = $('#bin-list'); box.innerHTML = '';
  S.media.forEach(m => {
    const d = document.createElement('div'); d.className = 'bin-item'; d.title = 'Clic para añadir al final de la línea de tiempo';
    const th = m.type === 'image' ? Object.assign(new Image(), { src: m.url }) : Object.assign(document.createElement('video'), { src: m.url + '#t=0.5', muted: true, preload: 'metadata' });
    th.className = 'thumb';
    const meta = document.createElement('div'); meta.className = 'meta';
    meta.innerHTML = `<b></b><span>${m.type === 'image' ? 'Imagen' : fmt(m.duration, false)}</span>`; meta.querySelector('b').textContent = m.name;
    d.append(th, meta);
    d.onclick = () => { pushUndo(); const c = newClip(m); S.clips.push(c); S.selClip = c.id; changed(); showTab('clip'); };
    box.appendChild(d);
  });
}

/* ============================================================
   EDICIÓN: dividir / eliminar / mover
   ============================================================ */
function splitAtPlayhead() {
  const c = S.clips.find(c => S.t > c.start + .05 && S.t < c.start + c.len - .05);
  if (!c) return;
  pushUndo();
  const local = c.trimIn + (S.t - c.start);
  const m = byId(S.media, c.mediaId);
  const n = newClip(m, local, c.trimOut);
  n.volume = c.volume; n.fit = c.fit; n.anim = c.anim; n.filter = { ...c.filter };
  c.trimOut = local;
  S.clips.splice(S.clips.indexOf(c) + 1, 0, n);
  S.selClip = n.id; changed();
}
function deleteClip(id) {
  pushUndo(); S.clips = S.clips.filter(c => c.id !== id);
  if (S.selClip === id) S.selClip = null; changed();
}
function moveClip(id, dir) {
  const i = S.clips.findIndex(c => c.id === id), j = i + dir;
  if (j < 0 || j >= S.clips.length) return;
  pushUndo(); [S.clips[i], S.clips[j]] = [S.clips[j], S.clips[i]];
  S.clips[0].transition.type = 'none'; changed();
}
function addSub(text = 'Nuevo subtítulo', start = S.t, end = start + 2.5) {
  pushUndo();
  const cur = byId(S.subs, S.selSub);
  const base = cur ? Object.fromEntries(Object.keys(SUB_DEFAULT).map(k => [k, cur[k]])) : {};
  const s = newSub(start, end, text, base); S.subs.push(s); S.selSub = s.id;
  changed(); showTab('subs');
}
function deleteSub(id) { pushUndo(); S.subs = S.subs.filter(s => s.id !== id); if (S.selSub === id) S.selSub = null; changed(); }

/* ============================================================
   INSPECTOR
   ============================================================ */
function showTab(name) {
  $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $('#tab-subs').hidden = name !== 'subs'; $('#tab-clip').hidden = name !== 'clip';
}
function readVal(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.type === 'number' || el.type === 'range') { const v = parseFloat(el.value); return isNaN(v) ? 0 : v; }
  return el.value;
}
function writeVal(el, v) {
  if (el.type === 'checkbox') el.checked = !!v;
  else if (document.activeElement !== el) el.value = v ?? '';
  const out = el.parentElement.querySelector('output'); if (out) out.textContent = v;
}
function fillInspector() {
  // Subtítulos
  const s = byId(S.subs, S.selSub);
  $('#sub-editor').hidden = !s;
  if (s) $$('[data-s]').forEach(el => writeVal(el, getPath(s, el.dataset.s)));
  const list = $('#sub-list'); list.innerHTML = '';
  [...S.subs].sort((a, b) => a.start - b.start).forEach(x => {
    const d = document.createElement('div'); d.className = 'sub-item' + (x.id === S.selSub ? ' sel' : '');
    d.innerHTML = `<span class="t">${fmt(x.start)}</span><span class="x"></span>`;
    d.querySelector('.x').textContent = x.text.replace(/\n/g, ' ');
    d.onclick = () => { S.selSub = x.id; seek(x.start + .01); changed(); };
    list.appendChild(d);
  });
  // Clip
  const c = byId(S.clips, S.selClip);
  $('#clip-empty').hidden = !!c; $('#clip-editor').hidden = !c;
  if (c) {
    $('#clip-name').textContent = c.name;
    $$('[data-c]').forEach(el => writeVal(el, getPath(c, el.dataset.c)));
    const first = S.clips[0] === c;
    $('#trans-type').disabled = first;
    $('#trans-hint').textContent = first ? 'El primer clip no tiene transición de entrada.' : (c.transition.type !== 'none' ? 'La transición solapa el final del clip anterior con el inicio de este.' : '');
  }
}
function bindInspector() {
  $('#inspector').addEventListener('focusin', () => pushUndo());
  $$('[data-s]').forEach(el => el.addEventListener('input', () => {
    const s = byId(S.subs, S.selSub); if (!s) return;
    const k = el.dataset.s; setPath(s, k, readVal(el));
    if (k === 'font' || k === 'bold') ensureFont(s.font, s.bold);
    if (k === 'start' && s.end < s.start + .1) s.end = s.start + .1;
    if (k === 'end' && s.end < s.start + .1) s.end = s.start + .1;
    changed(false, k === 'text' || k === 'start' || k === 'end');
  }));
  $$('[data-c]').forEach(el => el.addEventListener('input', () => {
    const c = byId(S.clips, S.selClip); if (!c) return;
    const k = el.dataset.c; setPath(c, k, readVal(el));
    if (k === 'trimIn') c.trimIn = clamp(c.trimIn, 0, c.trimOut - .1);
    if (k === 'trimOut') c.trimOut = Math.max(c.trimOut, c.trimIn + .1);
    changed(false, true);
  }));
  $('#presets').innerHTML = '';
  Object.entries(PRESETS).forEach(([name, st]) => {
    const b = document.createElement('button'); b.textContent = name;
    b.style.fontFamily = `"${st.font}"`; b.style.color = st.color;
    b.onclick = () => {
      const s = byId(S.subs, S.selSub); if (!s) return; pushUndo();
      Object.assign(s, { anim: 'fade' }, st); ensureFont(s.font, s.bold); changed();
    };
    $('#presets').appendChild(b);
  });
}

/* ============================================================
   LÍNEA DE TIEMPO (DOM)
   ============================================================ */
function renderTimeline() {
  layout();
  const maxEnd = Math.max(S.total, ...S.subs.map(s => s.end), 10) + 8;
  const w = maxEnd * S.zoom;
  const inner = $('#tl-inner'); inner.style.width = w + 'px';
  // Regla
  const ruler = $('#ruler'); ruler.innerHTML = '';
  const step = S.zoom >= 140 ? .5 : S.zoom >= 60 ? 1 : S.zoom >= 30 ? 5 : 10;
  for (let t = 0; t < maxEnd; t += step) {
    const k = document.createElement('div'); k.className = 'tick'; k.style.left = t * S.zoom + 'px'; k.textContent = fmt(t, false);
    ruler.appendChild(k);
  }
  // Clips
  const tc = $('#track-clips'); tc.innerHTML = '';
  S.clips.forEach(c => {
    const b = document.createElement('div'); b.className = 'block clip' + (c.id === S.selClip ? ' sel' : '');
    b.style.left = c.start * S.zoom + 'px'; b.style.width = c.len * S.zoom + 'px';
    b.innerHTML = `<span></span><i class="h l"></i><i class="h r"></i>`;
    b.querySelector('span').textContent = (c.type === 'image' ? '🖼 ' : '🎞 ') + c.name;
    if (c.ov > 0) { const t = document.createElement('i'); t.className = 'tr'; t.style.width = c.ov * S.zoom + 'px'; b.appendChild(t); }
    b.addEventListener('mousedown', e => {
      e.stopPropagation();
      const h = e.target.classList.contains('h') ? (e.target.classList.contains('l') ? 'l' : 'r') : null;
      S.selClip = c.id; S.lastSel = 'clip'; if (h) startDrag(e, 'clip-' + h, c.id); else { startDrag(e, 'seek'); seekFromEvent(e); }
      changed(false, false, true); showTab('clip');
    });
    tc.appendChild(b);
  });
  // Subs en carriles
  const ts = $('#track-subs'); ts.innerHTML = '';
  const lanes = []; const sorted = [...S.subs].sort((a, b) => a.start - b.start);
  const laneOf = new Map();
  sorted.forEach(s => {
    let l = lanes.findIndex(end => end <= s.start + .001); if (l < 0) { l = lanes.length; lanes.push(0); }
    lanes[l] = s.end; laneOf.set(s.id, l);
  });
  const nl = Math.max(1, lanes.length), lh = 44;
  ts.style.height = Math.max(60, nl * lh + 4) + 'px'; $('#lbl-subs').style.height = ts.style.height;
  S.subs.forEach(s => {
    const b = document.createElement('div'); b.className = 'block sub' + (s.id === S.selSub ? ' sel' : '');
    b.style.setProperty('--lane', laneOf.get(s.id)); b.style.setProperty('--lh', lh + 'px');
    b.style.left = s.start * S.zoom + 'px'; b.style.width = Math.max(10, (s.end - s.start) * S.zoom) + 'px';
    b.innerHTML = `<span></span><i class="h l"></i><i class="h r"></i>`;
    b.querySelector('span').textContent = s.text.replace(/\n/g, ' ');
    b.addEventListener('mousedown', e => {
      e.stopPropagation(); S.selSub = s.id; S.lastSel = 'sub';
      const h = e.target.classList.contains('h') ? (e.target.classList.contains('l') ? 'l' : 'r') : null;
      startDrag(e, h ? 'sub-' + h : 'sub-move', s.id);
      changed(false, false, true); showTab('subs');
    });
    ts.appendChild(b);
  });
}
function seekFromEvent(e) {
  const r = $('#tl-inner').getBoundingClientRect(); seek((e.clientX - r.left) / S.zoom);
}
function startDrag(e, kind, id) {
  const x0 = e.clientX; let pushed = false;
  const c = byId(S.clips, id), s = byId(S.subs, id);
  const o = c ? { ti: c.trimIn, to: c.trimOut } : s ? { st: s.start, en: s.end } : {};
  const mv = ev => {
    const dx = (ev.clientX - x0) / S.zoom;
    if (kind === 'seek') { seekFromEvent(ev); return; }
    if (!pushed && Math.abs(ev.clientX - x0) > 2) { pushUndo(); pushed = true; }
    if (!pushed) return;
    const media = c && byId(S.media, c.mediaId), maxDur = c ? (c.type === 'image' ? 600 : media.duration) : 0;
    if (kind === 'clip-l') c.trimIn = clamp(o.ti + dx, 0, c.trimOut - .1);
    if (kind === 'clip-r') c.trimOut = clamp(o.to + dx, c.trimIn + .1, maxDur);
    if (kind === 'sub-move') { const d = Math.max(dx, -o.st); s.start = o.st + d; s.end = o.en + d; }
    if (kind === 'sub-l') s.start = clamp(o.st + dx, 0, s.end - .1);
    if (kind === 'sub-r') s.end = Math.max(o.en + dx, s.start + .1);
    changed(false, true, true);
  };
  const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
}

/* ---------- Refresco general ---------- */
function changed(fullInspector = true, tl = true, keepInspectorFocus = false) {
  renderTimeline(); fillInspector();
  S.t = clamp(S.t, 0, Math.max(S.total, 0));
}

/* ============================================================
   ARRASTRAR TEXTO EN LA VISTA PREVIA
   ============================================================ */
canvas.addEventListener('mousedown', e => {
  const r = canvas.getBoundingClientRect(), sx = S.W / r.width;
  const mx = (e.clientX - r.left) * sx, my = (e.clientY - r.top) * sx;
  const hit = [...S.subs].reverse().find(s => s._box && mx >= s._box.x && mx <= s._box.x + s._box.w && my >= s._box.y && my <= s._box.y + s._box.h);
  if (!hit) return;
  S.selSub = hit.id; showTab('subs'); changed(); pushUndo();
  const ox = mx - hit.x / 100 * S.W, oy = my - hit.y / 100 * S.H;
  const mv = ev => {
    const x = (ev.clientX - r.left) * sx, y = (ev.clientY - r.top) * sx;
    hit.x = clamp((x - ox) / S.W * 100, 0, 100); hit.y = clamp((y - oy) / S.H * 100, 0, 100);
    $$('[data-s="x"],[data-s="y"]').forEach(el => { el.value = hit[el.dataset.s]; const o = el.parentElement.querySelector('output'); if (o) o.textContent = Math.round(hit[el.dataset.s]); });
  };
  const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
});

/* ============================================================
   SRT
   ============================================================ */
const srtTime = t => {
  const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const parseSrtTime = str => { const m = str.trim().replace(',', '.').match(/(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/); return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0; };
function exportSRT() {
  const txt = [...S.subs].sort((a, b) => a.start - b.start).map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text}\n`).join('\n');
  download(new Blob([txt], { type: 'text/plain' }), 'subtitulos.srt');
}
function importSRT(text) {
  pushUndo();
  const cur = byId(S.subs, S.selSub);
  const base = cur ? Object.fromEntries(Object.keys(SUB_DEFAULT).map(k => [k, cur[k]])) : {};
  text.replace(/\r/g, '').replace(/^WEBVTT.*\n/, '').split(/\n\n+/).forEach(b => {
    const ls = b.split('\n').filter(l => l.trim() !== ''); const i = ls.findIndex(l => l.includes('-->')); if (i < 0) return;
    const [a, z] = ls[i].split('-->');
    S.subs.push(newSub(parseSrtTime(a), parseSrtTime(z), ls.slice(i + 1).join('\n').replace(/<[^>]+>/g, ''), base));
  });
  changed();
}
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ============================================================
   EXPORTAR VIDEO
   ============================================================ */
let rec = null, recChunks = [], recMime = '', recCancel = false;
async function startExport() {
  if (!S.total) return alert('Añade al menos un clip.');
  pause(); ensureAudio();
  await Promise.all(S.subs.map(s => ensureFont(s.font, s.bold)));
  const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  recMime = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  const stream = canvas.captureStream(S.fps);
  audio.dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  rec = new MediaRecorder(stream, { mimeType: recMime, videoBitsPerSecond: 10e6 });
  recChunks = []; recCancel = false;
  rec.ondataavailable = e => e.data.size && recChunks.push(e.data);
  rec.onstop = () => {
    $('#overlay').hidden = true; S.exporting = false;
    if (recCancel) return;
    const ext = recMime.startsWith('video/mp4') ? 'mp4' : 'webm';
    download(new Blob(recChunks, { type: recMime || 'video/webm' }), `mi-video.${ext}`);
  };
  S.exporting = true; $('#overlay').hidden = false;
  seek(0);
  // dar tiempo a que los videos se posicionen en el frame 0
  S.clips.forEach(c => c.type === 'video' && (c.el.currentTime = c.trimIn));
  await new Promise(r => setTimeout(r, 400));
  rec.start(250); play();
  const prog = () => { if (!S.exporting) return; $('#ov-progress').value = S.total ? S.t / S.total : 0; requestAnimationFrame(prog); }; prog();
}
function finishExport() { setTimeout(() => rec && rec.state !== 'inactive' && rec.stop(), 300); }
$('#ov-cancel').onclick = () => { recCancel = true; pause(); if (rec && rec.state !== 'inactive') rec.stop(); };

/* ============================================================
   ASPECTO
   ============================================================ */
function setAspect(v) {
  const [w, h] = v.split('x').map(Number); S.W = w; S.H = h; canvas.width = w; canvas.height = h;
  S.subs.forEach(s => s._box = null);
}

/* ============================================================
   EVENTOS GLOBALES
   ============================================================ */
function bindUI() {
  $('#btn-import').onclick = () => $('#file-media').click();
  $('#file-media').onchange = e => { importFiles([...e.target.files]); e.target.value = ''; };
  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
  document.addEventListener('drop', e => importFiles([...e.dataTransfer.files]));

  $('#btn-play').onclick = () => S.playing ? pause() : play();
  $('#btn-start').onclick = () => seek(0);
  $('#btn-split').onclick = splitAtPlayhead;
  $('#btn-add-sub').onclick = () => addSub();
  $('#btn-add-sub2').onclick = () => addSub();
  $('#btn-del-sub').onclick = () => S.selSub && deleteSub(S.selSub);
  $('#btn-del-clip').onclick = () => S.selClip && deleteClip(S.selClip);
  $('#btn-clip-left').onclick = () => moveClip(S.selClip, -1);
  $('#btn-clip-right').onclick = () => moveClip(S.selClip, 1);
  $('#btn-undo').onclick = undo;
  $('#btn-reset-filter').onclick = () => { const c = byId(S.clips, S.selClip); if (c) { pushUndo(); c.filter = { b: 100, c: 100, s: 100, bl: 0 }; changed(); } };
  $('#btn-apply-all').onclick = () => {
    const cur = byId(S.subs, S.selSub); if (!cur) return; pushUndo();
    S.subs.forEach(s => Object.keys(SUB_DEFAULT).forEach(k => { if (k !== 'x' && k !== 'y') s[k] = cur[k]; })); changed();
  };
  $('#btn-export').onclick = startExport;
  $('#btn-export-srt').onclick = exportSRT;
  $('#btn-import-srt').onclick = () => $('#file-srt').click();
  $('#file-srt').onchange = async e => { const f = e.target.files[0]; if (f) importSRT(await f.text()); e.target.value = ''; };
  $('#btn-upload-font').onclick = () => $('#file-font').click();
  $('#file-font').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const name = f.name.replace(/\.[^.]+$/, '');
    const face = new FontFace(name, await f.arrayBuffer()); await face.load(); document.fonts.add(face);
    if (!FONTS.includes(name)) FONTS.unshift(name); fillFontSelect();
    const s = byId(S.subs, S.selSub); if (s) { pushUndo(); s.font = name; } changed(); e.target.value = '';
  };
  $('#aspect').onchange = e => setAspect(e.target.value);
  $('#zoom').oninput = e => { S.zoom = +e.target.value; renderTimeline(); };
  $$('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));

  // Click en la regla / zona vacía = mover cursor
  $('#tl-inner').addEventListener('mousedown', e => {
    if (e.target.closest('.block')) return;
    seekFromEvent(e); startDrag(e, 'seek');
  });

  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.ctrlKey || e.metaKey) { if (e.key === 'z') { e.preventDefault(); undo(); } return; }
    if (['input', 'textarea', 'select'].includes(tag)) return;
    if (e.code === 'Space') { e.preventDefault(); S.playing ? pause() : play(); }
    else if (e.key === 's' || e.key === 'S') splitAtPlayhead();
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (S.lastSel === 'sub' && S.selSub) deleteSub(S.selSub); else if (S.selClip) deleteClip(S.selClip);
    }
    else if (e.key === 'ArrowLeft') seek(S.t - (e.shiftKey ? 1 : .1));
    else if (e.key === 'ArrowRight') seek(S.t + (e.shiftKey ? 1 : .1));
  });
}

/* ---------- Inicio ---------- */
fillFontSelect(); bindInspector(); bindUI();
FONTS.slice(0, 10).forEach(f => ensureFont(f, true));
changed(); requestAnimationFrame(frame);
window.__editor = { S, importFiles, addSub, play, pause, seek, splitAtPlayhead, startExport }; // para pruebas
