'use strict';
/* ============================================================
   TRANSCRIPCIÓN — voz a texto con Whisper (transformers.js)
   Corre en un Worker dentro del navegador. La 1.ª vez descarga el
   modelo (se guarda en caché del navegador). Requiere internet para
   descargar el motor y el modelo; después el audio no sale de tu equipo.
   ============================================================ */
const TRC = { lang: 'spanish', model: 'onnx-community/whisper-base', preset: 1, words: 6, replace: false };
const TR_LANGS = [['spanish', 'Español'], ['english', 'Inglés'], ['portuguese', 'Portugués'], ['french', 'Francés'], ['german', 'Alemán'], ['italian', 'Italiano'], ['catalan', 'Catalán'], ['auto', 'Detectar automáticamente']];
const TR_MODELS = [['onnx-community/whisper-tiny', 'Rápido · tiny (~40 MB)'], ['onnx-community/whisper-base', 'Equilibrado · base (~75 MB)'], ['onnx-community/whisper-small', 'Preciso · small (~250 MB, más lento)']];
const TR = { worker: null, model: '', handler: null, onProgress: null, cancel: false, busy: false };

const WORKER_SRC = `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';
env.allowLocalModels = false;
let asr = null, device = 'wasm'; const files = {};
const post = m => self.postMessage(m);
self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      const cb = p => {
        if (p.status === 'progress' && p.total) { files[p.file] = { l: p.loaded, t: p.total }; let l = 0, t = 0; for (const k in files) { l += files[k].l; t += files[k].t; } post({ type: 'progress', pct: l / t, label: 'Descargando modelo… ' + Math.round(l / 1e6) + ' / ' + Math.round(t / 1e6) + ' MB' }); }
      };
      const tryDev = async dev => pipeline('automatic-speech-recognition', m.model, { device: dev, dtype: dev === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8', progress_callback: cb });
      try { if (self.navigator && navigator.gpu) { asr = await tryDev('webgpu'); device = 'webgpu'; } else throw 0; }
      catch (_) { asr = await tryDev('wasm'); device = 'wasm'; }
      post({ type: 'ready', device });
    } else if (m.type === 'run') {
      const o = { task: 'transcribe', return_timestamps: true, chunk_length_s: 30 }; if (m.lang && m.lang !== 'auto') o.language = m.lang;
      const out = await asr(m.audio, o);
      post({ type: 'result', id: m.id, chunks: out.chunks && out.chunks.length ? out.chunks : [{ text: out.text, timestamp: [0, m.dur] }] });
    }
  } catch (err) { post({ type: 'error', message: String((err && err.message) || err) }); }
};`;

function getWhisper() {
  if (TR.worker && TR.model === TRC.model) return TR.worker;
  if (TR.worker) TR.worker.terminate();
  const w = window.WhisperWorkerFactory ? window.WhisperWorkerFactory() : new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })), { type: 'module' });
  w.onmessage = e => {
    const m = e.data;
    if (m.type === 'progress') TR.onProgress && TR.onProgress(m);
    else if (m.type === 'ready' || m.type === 'result') { const h = TR.handler; TR.handler = null; h && h.res(m); }
    else if (m.type === 'error') { const h = TR.handler; TR.handler = null; h && h.rej(new Error(m.message)); }
  };
  w.onerror = () => { const h = TR.handler; TR.handler = null; h && h.rej(new Error('No se pudo cargar el motor de transcripción. Comprueba tu conexión a internet y usa Chrome/Edge actualizado.')); TR.worker = null; };
  TR.worker = w; TR.model = TRC.model; TR.ready = false; return w;
}
const wcall = (w, msg, transfer) => new Promise((res, rej) => { TR.handler = { res, rej }; w.postMessage(msg, transfer || []); });

/* ---------- Audio → PCM 16 kHz mono ---------- */
async function pcmOf(it) {
  const m = byId(S.media, it.mediaId), buf = await (await fetch(m.url)).arrayBuffer();
  const ab = await new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 16000).decodeAudioData(buf);
  const n = ab.length, mono = new Float32Array(n);
  for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / ab.numberOfChannels; }
  return mono.subarray(Math.floor(it.trimIn * 16000), Math.min(n, Math.ceil(it.trimOut * 16000)));
}
const rmsOf = a => { let s = 0; for (let i = 0; i < a.length; i += 4) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, a.length / 4)); };
function quietCut(pcm, a, b) { // punto más silencioso entre a y b para no cortar palabras
  const f = 1600; let best = b, bv = Infinity;
  for (let i = Math.max(0, a); i + f < b; i += f) { const v = rmsOf(pcm.subarray(i, i + f)); if (v < bv) { bv = v; best = i + f / 2; } }
  return Math.floor(best);
}
const HALLU = /amara\.org|subt[ií]tulos (realizados|por|de)|thanks for watching|gracias por (ver|vuestra atenci)|^\s*[\[(♪]/i;

async function transcribeItem(it, w, base, total, setStatus) {
  const pcm = await pcmOf(it), SR = 16000, WIN = 30 * SR, segs = []; let pos = 0;
  while (pos < pcm.length && !TR.cancel) {
    let end = Math.min(pcm.length, pos + WIN); if (end < pcm.length) end = Math.max(pos + 10 * SR, quietCut(pcm, end - 4 * SR, end));
    const slice = pcm.slice(pos, end);
    if (rmsOf(slice) > .004) {
      const res = await wcall(w, { type: 'run', id: nid(), audio: slice, lang: TRC.lang, dur: slice.length / SR }, [slice.buffer]);
      (res.chunks || []).forEach(c => {
        const text = (c.text || '').trim(); if (!text || HALLU.test(text)) return;
        const s = pos / SR + (c.timestamp[0] || 0), e = pos / SR + (c.timestamp[1] ?? (end - pos) / SR); segs.push({ s, e: Math.max(e, s + .3), text });
      });
    }
    pos = end; setStatus('Transcribiendo… ' + Math.round((base + pos / pcm.length) / total * 100) + ' %', (base + pos / pcm.length) / total);
  }
  return segs;
}
function splitSegs(segs, maxWords) { // frases largas → subtítulos cortos con tiempos proporcionales
  const out = [];
  segs.forEach(g => {
    const words = g.text.split(/\s+/).filter(Boolean); if (!words.length) return;
    const n = Math.ceil(words.length / maxWords), per = Math.ceil(words.length / n), chars = g.text.replace(/\s+/g, '').length || 1; let t = g.s, i = 0;
    while (i < words.length) {
      const part = words.slice(i, i + per), c = part.join('').length, d = Math.max(.4, (g.e - g.s) * c / chars);
      out.push({ s: t, e: t + d, text: part.join(' ') }); t += d; i += per;
    }
  });
  for (let i = 0; i < out.length - 1; i++) if (out[i].e > out[i + 1].s) out[i].e = Math.max(out[i].s + .3, out[i + 1].s - .02);
  return out;
}
function transcribeTargets() {
  const sel = byId(S.items, S.sel);
  if (sel && (sel.type === 'audio' || (sel.type === 'media' && sel.mt === 'video'))) return [sel];
  return S.items.filter(i => !i.muted && (i.type === 'audio' || (i.type === 'media' && i.mt === 'video')));
}
async function startTranscribe(only) {
  if (TR.busy) return;
  const targets = only ? [only] : transcribeTargets();
  if (!targets.length) return alert('No hay audio para transcribir. Importa un video o audio (o selecciónalo en la línea de tiempo).');
  TR.busy = true; TR.cancel = false;
  const ov = $('#tr-overlay'), bar = $('#tr-progress'), msg = $('#tr-msg'); ov.hidden = false; bar.removeAttribute('value'); msg.textContent = 'Preparando…';
  const setStatus = (t, p) => { msg.textContent = t; if (p != null) bar.value = p; };
  try {
    const w = getWhisper();
    if (!TR.ready) {
      TR.onProgress = m => setStatus(m.label, m.pct);
      const r = await wcall(w, { type: 'load', model: TRC.model }); TR.ready = true; TR.device = r.device;
    }
    TR.onProgress = null; bar.value = 0;
    const created = [], style = SUB_PRESETS[TRC.preset].s;
    for (let k = 0; k < targets.length && !TR.cancel; k++) {
      const it = targets[k], segs = splitSegs(await transcribeItem(it, w, k, targets.length, setStatus), TRC.words);
      segs.forEach(g => { const st = it.start + g.s, len = Math.min(g.e - g.s, it.start + it.len - st); if (len > .1) created.push({ start: Math.round(st * 100) / 100, len: Math.round(len * 100) / 100, text: g.text, lo: it.start, hi: it.start + it.len }); });
    }
    if (TR.cancel) throw new Error('cancelado');
    if (!created.length) { alert('No se detectó voz en el audio.'); }
    else {
      pushUndo(true);
      if (TRC.replace) S.items = S.items.filter(i => !(i.type === 'text' && i.track === 'sub' && created.some(c => i.start >= c.lo && i.start < c.hi)));
      let first = null;
      await ensureFont(style.font, style.bold !== false);
      created.forEach(c => { const s = mkText('sub', c.start, c.len, c.text, style); S.items.push(s); first = first || s; });
      S.sel = first.id; changed(true); seek(first.start + .01);
    }
  } catch (e) { if (e.message !== 'cancelado') alert('Transcripción fallida: ' + e.message); }
  finally { TR.busy = false; TR.onProgress = null; ov.hidden = true; }
}
$('#tr-cancel').onclick = () => { TR.cancel = true; if (TR.worker) { TR.worker.terminate(); TR.worker = null; TR.ready = false; } if (TR.handler) { TR.handler.rej(new Error('cancelado')); TR.handler = null; } };
