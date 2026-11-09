'use strict';
/* ============================================================
   AUDIO — mezcla (WebAudio), sincronía, extraer audio, voz en off
   ============================================================ */
const A = { ctx: null, dest: null };
function ensureAudio() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  try {
    A.ctx = new (window.AudioContext || window.webkitAudioContext)(); A.dest = A.ctx.createMediaStreamDestination();
    RT.forEach(r => hookAudio(r));
  } catch (e) { console.warn('audio', e); }
}
function hookAudio(r) {
  if (r.gain || !(r.el instanceof HTMLMediaElement) || !A.ctx) return;
  try {
    const src = A.ctx.createMediaElementSource(r.el); r.gain = A.ctx.createGain();
    src.connect(r.gain); r.gain.connect(A.ctx.destination); r.gain.connect(A.dest);
  } catch (e) { console.warn('hook', e); }
}
const setVol = (r, v) => { if (r.gain) r.gain.gain.value = Math.max(0, v); else r.el.volume = clamp(v, 0, 1); };

function syncMedia(t) {
  S.items.forEach(it => {
    if (!(it.type === 'audio' || (it.type === 'media' && it.mt === 'video'))) return;
    const r = rt(it), el = r.el, lt = t - it.start, active = lt >= 0 && lt < it.len, want = it.trimIn + lt;
    let vol = it.muted ? 0 : it.volume / 100;
    if (it.fadeIn > 0) vol *= clamp(lt / it.fadeIn, 0, 1);
    if (it.fadeOut > 0) vol *= clamp((it.len - lt) / it.fadeOut, 0, 1);
    if (isMain(it)) {
      if (it.ov > 0 && lt < it.ov) vol *= clamp(lt / it.ov, 0, 1);
      const mi = mainItems(), nx = mi[mi.indexOf(it) + 1];
      if (nx && nx.ov > 0 && t > nx.start) vol *= 1 - clamp((t - nx.start) / nx.ov, 0, 1);
    }
    setVol(r, active ? vol : 0);
    if (active) {
      if (S.playing) {
        if (el.paused) { el.currentTime = want; el.play().catch(() => { }); }
        else if (Math.abs(el.currentTime - want) > .3) el.currentTime = want;
      } else {
        if (!el.paused) el.pause();
        if (it.type === 'media' && Math.abs(el.currentTime - want) > .04) el.currentTime = want;
      }
    } else {
      if (!el.paused) el.pause();
      if (it.type === 'media' && lt < 0 && lt > -1.2 && Math.abs(el.currentTime - it.trimIn) > .05) el.currentTime = it.trimIn;
    }
  });
}
function silenceAll() { RT.forEach(r => r.el instanceof HTMLMediaElement && !r.el.paused && r.el.pause()); }

/* ---------- Extraer audio del video ---------- */
function pickAudioTrack(start, len) {
  for (const tr of S.tracks.filter(k => k.kind === 'audio')) {
    if (!S.items.some(i => i.track === tr.id && i.start < start + len && i.start + i.len > start)) return tr.id;
  }
  S.tracks.push({ id: 'a' + nid(), kind: 'audio', name: 'Audio ' + (S.tracks.filter(k => k.kind === 'audio').length + 1) });
  return S.tracks[S.tracks.length - 1].id;
}
function extractAudio(id) {
  const it = byId(S.items, id); if (!it || it.mt !== 'video') return;
  pushUndo(true);
  const m = byId(S.media, it.mediaId), a = mkAudio(m, pickAudioTrack(it.start, it.len), it.start, it.trimIn, it.trimOut);
  a.name = 'Audio · ' + it.name; a.volume = it.volume; S.items.push(a); it.muted = true; S.sel = a.id; changed(true);
}

/* ---------- Voz en off ---------- */
let VO = null;
async function toggleRecord() {
  if (VO) return stopRecord();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { return alert('No se pudo acceder al micrófono: ' + e.message + '\n(Permite el micrófono en el navegador; la página debe abrirse desde http://localhost o https).'); }
  ensureAudio();
  const mr = new MediaRecorder(stream), chunks = [], t0 = S.t, w0 = performance.now();
  mr.ondataavailable = e => e.data.size && chunks.push(e.data);
  mr.onstop = async () => {
    stream.getTracks().forEach(x => x.stop());
    const dur = (performance.now() - w0) / 1000, blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
    VO = null; updateRecUI();
    const m = await registerMedia(new File([blob], 'Voz en off ' + fmt(t0, false) + '.webm', { type: blob.type }), dur);
    if (m) { renderBin(); addAudioItem(m, 'a2', t0); }
  };
  mr.start(250); VO = { mr, w0 }; updateRecUI(); play();
}
function stopRecord() { if (!VO) return; pause(); if (VO.mr.state !== 'inactive') VO.mr.stop(); }
function updateRecUI() {
  const b = $('#btn-rec'); if (!b) return;
  b.classList.toggle('rec', !!VO); b.textContent = VO ? '■ Detener grabación' : '● Grabar voz en off';
}

/* ---------- Forma de onda ---------- */
const PEAKS = new Map();
function peaksFor(m) {
  if (!PEAKS.has(m.id)) PEAKS.set(m.id, (async () => {
    try {
      const buf = await (await fetch(m.url)).arrayBuffer(), oc = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
      const ab = await oc.decodeAudioData(buf), ch = ab.getChannelData(0), n = Math.max(1, Math.ceil(ab.duration * 50)), per = Math.floor(ch.length / n) || 1, p = new Float32Array(n);
      for (let i = 0; i < n; i++) { let mx = 0; for (let j = i * per; j < Math.min(ch.length, (i + 1) * per); j += 8) mx = Math.max(mx, Math.abs(ch[j])); p[i] = mx; }
      return p;
    } catch (e) { return null; }
  })());
  return PEAKS.get(m.id);
}
async function drawWave(cv, it) {
  const m = byId(S.media, it.mediaId), p = m && await peaksFor(m); if (!p) return;
  const g = cv.getContext('2d'), w = cv.width, h = cv.height; g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.75)';
  for (let x = 0; x < w; x++) {
    const a = Math.floor((it.trimIn + x / w * it.len) * 50), b = Math.max(a + 1, Math.floor((it.trimIn + (x + 1) / w * it.len) * 50)); let mx = 0;
    for (let i = a; i < b && i < p.length; i++) mx = Math.max(mx, p[i]);
    const bh = Math.max(1, Math.min(1, mx * 1.4) * h); g.fillRect(x, (h - bh) / 2, 1, bh);
  }
}
