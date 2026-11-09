'use strict';
/* ============================================================
   CORE — estado, utilidades, modelo de elementos, deshacer
   Todo elemento de la línea de tiempo es un "item" (datos puros);
   los objetos de ejecución (video/audio) viven en RT.
   ============================================================ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
let _uid = 1; const nid = () => _uid++;
const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeOutBack = p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const easeOutBounce = p => {
  const n = 7.5625, d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + .75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + .9375;
  return n * (p -= 2.625 / d) * p + .984375;
};
const rnd = seed => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const getPath = (o, p) => p.split('.').reduce((a, k) => a && a[k], o);
const setPath = (o, p, v) => { const ks = p.split('.'), l = ks.pop(); ks.reduce((a, k) => a[k], o)[l] = v; };
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const hexA = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };
function fmt(t, ms = true) {
  t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60;
  return String(m).padStart(2, '0') + ':' + (ms ? s.toFixed(2).padStart(5, '0') : String(Math.floor(s)).padStart(2, '0'));
}
const byId = (arr, id) => arr.find(x => x.id === id);
const IN_ARTIFACT = !!(window.claude && window.claude.use); // visor de claude.ai: sin micrófono, sin red libre, descargas vía capacidad
async function download(blob, name) {
  if (IN_ARTIFACT) {
    try {
      const d = await window.claude.use('downloads');
      if (d) { await d.save({ filename: name.replace(/\.srt$/, '.txt'), data: blob }); return; }
    } catch (e) { if (e && e.code === 'declined') return; console.warn('downloads', e); }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}

/* ---------- Estado ---------- */
const ASPECTS = [
  ['16:9', 'YouTube · Horizontal 16:9'], ['9:16', 'TikTok · Reels · Shorts · Stories 9:16'],
  ['1:1', 'Instagram · Cuadrado 1:1'], ['4:5', 'Instagram · Facebook 4:5'],
  ['2:3', 'Pinterest 2:3'], ['3:4', 'Vertical 3:4'], ['4:3', 'Clásico 4:3'], ['21:9', 'Cine 21:9'],
];
const S = {
  W: 1280, H: 720, aspect: '16:9', quality: 720, bg: '#000000',
  media: [], items: [], sel: null,
  tracks: [
    { id: 'fx', kind: 'fx', name: 'Efectos' },
    { id: 'sub', kind: 'text', name: 'Subtítulos' },
    { id: 'txt', kind: 'text', name: 'Texto' },
    { id: 'v2', kind: 'video', name: 'Capa 2' },
    { id: 'v1', kind: 'video', name: 'Principal', main: true },
    { id: 'a1', kind: 'audio', name: 'Audio 1' },
    { id: 'a2', kind: 'audio', name: 'Voz en off' },
  ],
  t: 0, total: 0, playing: false, zoom: 80, exporting: false,
};
const RT = new Map(); // id -> {el, gain, src}
const trackOf = id => byId(S.tracks, id);
const isMain = it => (trackOf(it.track) || {}).main === true;

/* ---------- Fábricas de elementos ---------- */
const COLOR0 = () => ({ look: 'none', lookAmt: 100, b: 100, c: 100, s: 100, hue: 0, temp: 0, tint: 0, sh: 0, hl: 0, bl: 0, vig: 0 });
function mkMedia(m, track, start, trimIn = 0, trimOut = null) {
  const ov = track !== 'v1';
  return {
    id: nid(), type: 'media', mt: m.type, mediaId: m.id, name: m.name, track, start, len: 0,
    trimIn, trimOut: trimOut ?? (m.type === 'image' ? 5 : m.duration),
    x: ov ? 70 : 50, y: ov ? 30 : 50, scale: ov ? 45 : 100, rot: 0, opacity: 100, flipH: false,
    fit: ov ? 'contain' : 'cover', bgBlur: false,
    volume: 100, fadeIn: 0, fadeOut: 0, muted: false,
    inAnim: { type: 'none', dur: .5 }, outAnim: { type: 'none', dur: .5 }, anim: 'none',
    transition: { type: 'none', dur: .6 },
    mask: { type: 'none', x: 50, y: 50, w: 60, h: 60, rot: 0, round: 25, feather: 0, invert: false, anim: 'none', animDur: .8 },
    chroma: { on: false, color: '#00ff00', tol: 35, soft: 12 },
    color: COLOR0(), blend: 'source-over',
  };
}
function mkShape(kind, start) {
  const names = { rect: 'Cuadrado', rounded: 'Rectángulo redondeado', circle: 'Círculo', triangle: 'Triángulo', star: 'Estrella', heart: 'Corazón', diamond: 'Rombo', arrow: 'Flecha', line: 'Línea' };
  return {
    id: nid(), type: 'shape', kind, name: names[kind] || 'Forma', track: 'v2', start, len: 3,
    x: 50, y: 50, scale: 100, rot: 0, opacity: 100, w: kind === 'line' ? 50 : 30, h: kind === 'line' ? 2 : 30,
    fill: '#5b8cff', stroke: '#ffffff', strokeW: 0, radius: 25, shadow: false, blend: 'source-over',
    inAnim: { type: 'zoomIn', dur: .4 }, outAnim: { type: 'none', dur: .4 }, anim: 'none',
  };
}
const TEXT_BASE = {
  font: 'Poppins', size: 54, bold: true, italic: false, upper: false, color: '#ffffff', hlColor: '#ffd400',
  stroke: '#000000', strokeW: 6, bg: '#000000', bgOpacity: 0, shadow: true, glow: '#00e5ff', glowBlur: 0,
  x: 50, y: 40, scale: 100, rot: 0, opacity: 100,
  inAnim: 'fade', outAnim: 'fade', loopAnim: 'none', animDur: .4, animBy: 'all', wordFx: 'none',
};
function mkText(role, start, len, text, style) {
  return { id: nid(), type: 'text', role, name: text, track: role === 'sub' ? 'sub' : 'txt', start, len, text,
    ...TEXT_BASE, y: role === 'sub' ? 84 : 40, ...(style || {}) };
}
const FX_NAMES = {
  zoomIn: 'Zoom in', zoomOut: 'Zoom out', punch: 'Impacto', pulse: 'Latido', blur: 'Desenfoque', blurIn: 'Desenfoque → nítido',
  blurOut: 'Nítido → desenfoque', shake: 'Sacudida', flash: 'Destello', strobe: 'Estroboscopio', rgb: 'Aberración RGB',
  glitch: 'Glitch', vignette: 'Viñeta', grain: 'Grano de película', leak: 'Fuga de luz', bars: 'Barras de cine', look: 'Ajuste de color',
};
function mkFx(kind, start, len = 1.2) {
  return { id: nid(), type: 'fx', kind, name: FX_NAMES[kind], track: 'fx', start, len, amt: 60, flashColor: '#ffffff', color: COLOR0() };
}
function mkAudio(m, track, start, trimIn = 0, trimOut = null) {
  return { id: nid(), type: 'audio', mediaId: m.id, name: m.name, track, start, len: 0, trimIn, trimOut: trimOut ?? m.duration,
    volume: 100, fadeIn: 0, fadeOut: 0, muted: false };
}

/* ---------- Runtime (elementos de medios) ---------- */
function rt(it) {
  let r = RT.get(it.id);
  if (!r) {
    const m = byId(S.media, it.mediaId); r = {};
    if (it.type === 'media') {
      if (m.type === 'image') { r.el = new Image(); r.el.src = m.url; }
      else { r.el = document.createElement('video'); r.el.src = m.url; r.el.preload = 'auto'; r.el.playsInline = true; r.el.setAttribute('webkit-playsinline', ''); }
    } else { r.el = new Audio(m.url); r.el.preload = 'auto'; }
    RT.set(it.id, r);
    if (typeof hookAudio === 'function' && A.ctx) hookAudio(r);
  }
  return r;
}

/* ---------- Deshacer / rehacer ---------- */
const undoStack = [], redoStack = []; let lastPush = 0;
const snapStr = () => JSON.stringify({ items: S.items, tracks: S.tracks, sel: S.sel });
function pushUndo(force) {
  const now = performance.now(); if (!force && now - lastPush < 350) return; lastPush = now;
  undoStack.push(snapStr()); if (undoStack.length > 100) undoStack.shift(); redoStack.length = 0;
}
function restore(str) { const o = JSON.parse(str); S.items = o.items; S.tracks = o.tracks; S.sel = o.sel; changed(true); }
function undo() { if (!undoStack.length) return; redoStack.push(snapStr()); restore(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(snapStr()); restore(redoStack.pop()); }

/* ---------- Layout ---------- */
function layout() {
  let prev = null;
  S.items.forEach(it => { if (it.type === 'media' || it.type === 'audio') it.len = Math.max(.05, it.trimOut - it.trimIn); });
  S.items.filter(i => i.track === 'v1').forEach(c => {
    const ov = (prev && c.transition.type !== 'none') ? Math.min(c.transition.dur, c.len * .9, prev.len * .9) : 0;
    c.ov = ov; c.start = prev ? prev.start + prev.len - ov : 0; prev = c;
  });
  S.total = S.items.reduce((m, i) => Math.max(m, i.start + i.len), 0);
}
const itemsOn = (trackId, t) => {
  const tt = Math.min(t, S.total - .001);
  return S.items.filter(i => i.track === trackId && tt >= i.start && tt < i.start + i.len).sort((a, b) => a.start - b.start);
};
const mainItems = () => S.items.filter(i => i.track === 'v1');

/* ---------- Edición ---------- */
function select(id) { S.sel = id; changed(true); }
function addToMain(m) {
  pushUndo(true);
  const it = mkMedia(m, 'v1', 0); S.items.push(it); S.sel = it.id; changed(true);
}
function addOverlay(m) {
  pushUndo(true);
  const tr = S.tracks.filter(t => t.kind === 'video' && !t.main).pop() || null;
  const it = mkMedia(m, tr ? tr.id : 'v2', S.t); it.trimOut = Math.min(it.trimOut, m.type === 'image' ? 4 : m.duration);
  S.items.push(it); S.sel = it.id; changed(true);
}
function addAudioItem(m, trackId, start) {
  pushUndo(true);
  const it = mkAudio(m, trackId || 'a1', start ?? S.t); S.items.push(it); S.sel = it.id; changed(true); return it;
}
function addShape(kind) { pushUndo(true); const it = mkShape(kind, S.t); S.items.push(it); S.sel = it.id; changed(true); }
function addFx(kind) {
  pushUndo(true); const it = mkFx(kind, S.t, kind === 'look' ? 3 : 1.2); S.items.push(it); S.sel = it.id; changed(true);
}
function addText(role, text, style, len) {
  pushUndo(true);
  const it = mkText(role, S.t, len || (role === 'sub' ? 2.5 : 3), text, style); S.items.push(it); S.sel = it.id; changed(true); return it;
}
function deleteItem(id) { pushUndo(true); S.items = S.items.filter(i => i.id !== id); if (S.sel === id) S.sel = null; changed(true); }
function duplicateItem(id) {
  const it = byId(S.items, id); if (!it) return; pushUndo(true);
  const c = JSON.parse(JSON.stringify(it)); c.id = nid();
  if (isMain(it)) S.items.splice(S.items.indexOf(it) + 1, 0, c);
  else { c.start = it.start + it.len; S.items.push(c); }
  S.sel = c.id; changed(true);
}
function splitItem(it) {
  it = it || byId(S.items, S.sel);
  if (!it || !(S.t > it.start + .05 && S.t < it.start + it.len - .05)) {
    it = mainItems().find(c => S.t > c.start + .05 && S.t < c.start + c.len - .05);
  }
  if (!it) return; pushUndo(true);
  const cut = S.t - it.start, c = JSON.parse(JSON.stringify(it)); c.id = nid();
  if (it.type === 'media' || it.type === 'audio') { c.trimIn = it.trimIn + cut; it.trimOut = it.trimIn + cut; }
  else { c.len = it.len - cut; it.len = cut; }
  c.start = it.start + cut; if (c.transition) c.transition.type = 'none';
  if (it.inAnim) c.inAnim = { ...c.inAnim, type: 'none' };
  if (it.outAnim) it.outAnim = { ...it.outAnim, type: 'none' };
  S.items.splice(S.items.indexOf(it) + 1, 0, c); S.sel = c.id; changed(true);
}
function moveMain(id, dir) {
  const main = mainItems(), i = main.findIndex(c => c.id === id), j = i + dir;
  if (j < 0 || j >= main.length) return; pushUndo(true);
  const a = S.items.indexOf(main[i]), b = S.items.indexOf(main[j]); [S.items[a], S.items[b]] = [S.items[b], S.items[a]];
  S.items.filter(i => i.track === 'v1')[0].transition.type = 'none'; changed(true);
}
function addTrack(kind) {
  pushUndo(true);
  if (kind === 'video') {
    const n = S.tracks.filter(t => t.kind === 'video').length + 1; const idx = S.tracks.findIndex(t => t.kind === 'video');
    S.tracks.splice(idx, 0, { id: 'v' + nid(), kind: 'video', name: 'Capa ' + n });
  } else {
    const n = S.tracks.filter(t => t.kind === 'audio').length + 1; S.tracks.push({ id: 'a' + nid(), kind: 'audio', name: 'Audio ' + n });
  }
  changed(true);
}
function setAspect(key, quality) {
  S.aspect = key; if (quality) S.quality = quality;
  const as = $('#aspect'); if (as && as.value !== key) as.value = key;
  const [a, b] = key.split(':').map(Number); let W, H;
  if (a >= b) { H = S.quality; W = H * a / b; } else { W = S.quality; H = W * b / a; }
  S.W = Math.round(W / 2) * 2; S.H = Math.round(H / 2) * 2;
  canvas.width = S.W; canvas.height = S.H; if (typeof resizeSurfaces === 'function') resizeSurfaces();
}

/* ---------- SRT ---------- */
const srtTime = t => {
  const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const parseSrtTime = str => { const m = str.trim().replace(',', '.').match(/(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/); return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0; };
function exportSRT() {
  const subs = S.items.filter(i => i.type === 'text' && i.track === 'sub').sort((a, b) => a.start - b.start);
  if (!subs.length) return alert('No hay subtítulos.');
  download(new Blob([subs.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.start + s.len)}\n${s.text}\n`).join('\n')], { type: 'text/plain' }), 'subtitulos.srt');
}
function importSRT(text) {
  pushUndo(true);
  const cur = byId(S.items, S.sel); const base = cur && cur.type === 'text' ? styleOf(cur) : subPresetStyle();
  text.replace(/\r/g, '').replace(/^WEBVTT.*\n/, '').split(/\n\n+/).forEach(b => {
    const ls = b.split('\n').filter(l => l.trim() !== ''); const i = ls.findIndex(l => l.includes('-->')); if (i < 0) return;
    const [a, z] = ls[i].split('-->'), s = parseSrtTime(a), e = parseSrtTime(z);
    S.items.push(mkText('sub', s, Math.max(.2, e - s), ls.slice(i + 1).join('\n').replace(/<[^>]+>/g, ''), base));
  });
  changed(true);
}
const STYLE_KEYS = ['font', 'size', 'bold', 'italic', 'upper', 'color', 'hlColor', 'stroke', 'strokeW', 'bg', 'bgOpacity', 'shadow', 'glow', 'glowBlur', 'inAnim', 'outAnim', 'loopAnim', 'animDur', 'animBy', 'wordFx'];
const styleOf = it => Object.fromEntries(STYLE_KEYS.map(k => [k, it[k]]));
