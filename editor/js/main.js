'use strict';
/* ============================================================
   MAIN — importación, reproducción, exportación MP4, arranque
   ============================================================ */
function thumbOf(src, w, h) {
  try {
    const c = document.createElement('canvas'); c.width = 160; c.height = 90; const g = c.getContext('2d'), s = Math.max(160 / w, 90 / h);
    g.drawImage(src, 80 - w * s / 2, 45 - h * s / 2, w * s, h * s); return c.toDataURL('image/jpeg', .6);
  } catch (e) { return ''; }
}
async function registerMedia(f, fallbackDur) {
  const type = f.type.startsWith('image') ? 'image' : f.type.startsWith('video') ? 'video' : f.type.startsWith('audio') ? 'audio' : null;
  if (!type) return null;
  const url = URL.createObjectURL(f), m = { id: nid(), name: f.name, type, url, duration: 5, w: 0, h: 0, thumb: '' };
  if (type === 'image') {
    await new Promise(res => { const i = new Image(); i.onload = () => { m.w = i.naturalWidth; m.h = i.naturalHeight; m.thumb = thumbOf(i, m.w, m.h); res(); }; i.onerror = res; i.src = url; });
  } else {
    const e = document.createElement(type === 'video' ? 'video' : 'audio'); e.preload = 'auto'; e.muted = true; e.src = url;
    await new Promise(res => {
      const t = setTimeout(res, 10000);
      e.onloadedmetadata = () => {
        const done = () => { clearTimeout(t); m.duration = isFinite(e.duration) && e.duration > 0 ? e.duration : (fallbackDur || 5); m.w = e.videoWidth || 0; m.h = e.videoHeight || 0; res(); };
        if (e.duration === Infinity) { e.currentTime = 1e101; e.ontimeupdate = () => { e.ontimeupdate = null; done(); }; } else done();
      };
      e.onerror = () => { clearTimeout(t); res(); };
    });
    if (type === 'video' && m.w) {
      await new Promise(res => { const t = setTimeout(res, 4000); e.onseeked = () => { clearTimeout(t); m.thumb = thumbOf(e, m.w, m.h); res(); }; e.currentTime = Math.min(.5, m.duration / 2); });
    }
  }
  S.media.push(m); return m;
}
async function importFiles(files) {
  for (const f of files) {
    const m = await registerMedia(f); if (!m) continue;
    if (m.type === 'audio') addAudioItem(m, 'a1', S.t);
    else {
      const first = !mainItems().length;
      addToMain(m);
      if (first && m.h > m.w * 1.2 && S.W > S.H) { $('#aspect').value = '9:16'; setAspect('9:16'); }
    }
  }
  renderBin();
}

/* ---------- Estado compartido ---------- */
function changed(force = true) {
  layout(); S.t = clamp(S.t, 0, Math.max(S.total, 0));
  renderTimeline(); buildInspector(force);
}

/* ---------- Reproducción ---------- */
let wallStart = 0, tStart = 0;
function play() {
  if (S.playing) return; if (!S.total && !VO) return; ensureAudio();
  if (S.t >= S.total - .02) S.t = 0;
  S.playing = true; wallStart = performance.now(); tStart = S.t; $('#btn-play').textContent = '⏸';
}
function pause() { S.playing = false; $('#btn-play').textContent = '▶'; silenceAll(); }
function seek(t) { S.t = clamp(t, 0, S.total); if (S.playing) { wallStart = performance.now(); tStart = S.t; } }
function frame() {
  if (S.playing) {
    S.t = tStart + (performance.now() - wallStart) / 1000;
    if (S.t >= S.total) { S.t = S.total; pause(); if (S.exporting) finishExport(); }
  }
  try { syncMedia(S.t); render(S.t); } catch (e) { console.error(e); }
  $('#timecode').textContent = fmt(S.t) + ' / ' + fmt(S.total);
  $('#playhead').style.left = S.t * S.zoom + 'px';
  requestAnimationFrame(frame);
}

/* ---------- Exportar MP4 ---------- */
let rec = null, recChunks = [], recMime = '', recCancel = false;
const MP4_TYPES = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.640028,opus', 'video/mp4;codecs=avc1', 'video/mp4'];
const WEBM_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
async function startExport() {
  if (!S.total) return alert('Añade al menos un clip.');
  if (VO) stopRecord();
  pause(); ensureAudio(); await Promise.all(S.items.filter(i => i.type === 'text').map(s => ensureFont(s.font, s.bold)));
  recMime = MP4_TYPES.find(t => MediaRecorder.isTypeSupported(t)) || WEBM_TYPES.find(t => MediaRecorder.isTypeSupported(t)) || '';
  const stream = canvas.captureStream(30);
  if (A.dest) A.dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const bps = Math.round(S.W * S.H * 30 * .12);
  rec = new MediaRecorder(stream, { mimeType: recMime, videoBitsPerSecond: Math.min(16e6, Math.max(3e6, bps)), audioBitsPerSecond: 192000 });
  recChunks = []; recCancel = false;
  rec.ondataavailable = e => e.data.size && recChunks.push(e.data);
  rec.onstop = () => {
    $('#overlay').hidden = true; S.exporting = false;
    if (recCancel) return;
    const mp4 = recMime.startsWith('video/mp4');
    download(new Blob(recChunks, { type: mp4 ? 'video/mp4' : 'video/webm' }), mp4 ? 'mi-video.mp4' : 'mi-video.webm');
    if (!mp4) alert('Tu navegador no puede grabar MP4 directamente, así que se descargó en WebM. Para MP4 usa Chrome o Edge actualizados (o Safari).');
  };
  S.exporting = true; $('#overlay').hidden = false; $('#ov-title').textContent = 'Exportando ' + (recMime.startsWith('video/mp4') ? 'MP4' : 'WebM') + '…';
  seek(0); await new Promise(r => setTimeout(r, 500));
  rec.start(250); play();
  const prog = () => { if (!S.exporting) return; $('#ov-progress').value = S.total ? S.t / S.total : 0; requestAnimationFrame(prog); }; prog();
}
function finishExport() { setTimeout(() => rec && rec.state !== 'inactive' && rec.stop(), 400); }
$('#ov-cancel').onclick = () => { recCancel = true; pause(); if (rec && rec.state !== 'inactive') rec.stop(); S.exporting = false; $('#overlay').hidden = true; };

/* ---------- Arranque ---------- */
bindUI(); buildLibrary(); setAspect('16:9', 720);
FONTS.slice(0, 10).forEach(f => ensureFont(f, true));
document.addEventListener('pointerdown', () => ensureAudio(), { once: true });
$('#inspector').addEventListener('focusin', () => pushUndo());
changed(true); requestAnimationFrame(frame);
window.__ed = { S, RT, importFiles, addText, addShape, addFx, addAudioItem, splitItem, play, pause, seek, startExport, changed, extractAudio, applyLook, toggleRecord, usePreset, TEXT_PRESETS, SUB_PRESETS, setAspect, addOverlay, undo };
