'use strict';
/* ============================================================
   PLAN DE EDICIÓN — importa cortes, zooms y textos (JSON) sobre el video.
   Los tiempos del plan se dan en el tiempo ORIGINAL del video; el editor
   los traslada solo a la línea de tiempo ya cortada.
   ============================================================ */
const PLAN_EXAMPLE = {
  version: 1,
  cuts: [{ from: 12.0, to: 14.5 }],
  zooms: [{ at: 3.0, len: 1.2, type: 'punch', amt: 60 }, { at: 20.0, len: 4, type: 'zoomIn', amt: 40 }],
  texts: [{ at: 1.0, len: 2.5, text: 'TÍTULO', preset: 'Pop cómic', y: 30 }],
  subtitles: [{ at: 5.0, len: 2.0, text: 'Texto corregido del subtítulo' }],
  subtitleStyle: 'Hormozi', replaceSubtitles: false, cutTransition: { type: 'none', dur: 0.3 },
};
function applyPlan(plan) {
  const sel = byId(S.items, S.sel), vids = mainItems().filter(i => i.mt === 'video');
  const clip = sel && isMain(sel) && sel.mt === 'video' ? sel : vids[0];
  if (!clip) throw new Error('Importa primero un video en la pista principal.');
  pushUndo(true);
  const before = new Set(S.items.map(i => i.id)), inCutRanges = [];
  // 1) cortes → segmentos que se conservan
  let cuts = (plan.cuts || []).map(c => [Math.max(clip.trimIn, +c.from), Math.min(clip.trimOut, +c.to)]).filter(c => c[1] - c[0] > .05).sort((a, b) => a[0] - b[0]);
  const keep = []; let cur = clip.trimIn;
  cuts.forEach(([a, b]) => { if (a > cur) keep.push([cur, a]); cur = Math.max(cur, b); inCutRanges.push([a, b]); });
  if (cur < clip.trimOut) keep.push([cur, clip.trimOut]);
  const segs = keep.filter(k => k[1] - k[0] > .1); if (!segs.length) throw new Error('El plan elimina todo el video.');
  const ct = plan.cutTransition || {};
  const clones = segs.map((k, i) => {
    const c = JSON.parse(JSON.stringify(clip)); c.id = nid(); c.trimIn = k[0]; c.trimOut = k[1];
    c.transition = i > 0 ? { type: ct.type || 'none', dur: ct.dur || .3 } : { type: 'none', dur: .6 };
    if (i > 0) c.inAnim = { ...c.inAnim, type: 'none' }; if (i < segs.length - 1) c.outAnim = { ...c.outAnim, type: 'none' }; return c;
  });
  S.items.splice(S.items.indexOf(clip), 1, ...clones); layout();
  const inCut = t => inCutRanges.some(([a, b]) => t >= a && t < b);
  const map = t => {
    for (const c of clones) if (t >= c.trimIn && t <= c.trimOut) return Math.round((c.start + t - c.trimIn) * 100) / 100;
    const nx = clones.find(c => c.trimIn > t), last = clones[clones.length - 1];
    return Math.round((nx ? nx.start : last.start + last.len) * 100) / 100;
  };
  let nCuts = cuts.length, nZ = 0, nT = 0, nS = 0;
  // 2) subtítulos ya existentes: reubicar según los cortes (o reemplazar)
  if (plan.replaceSubtitles) S.items = S.items.filter(i => !(i.type === 'text' && i.track === 'sub'));
  else if (cuts.length) S.items = S.items.filter(i => {
    if (!(i.type === 'text' && i.track === 'sub' && before.has(i.id))) return true;
    const s = i.start, e = i.start + i.len; if (inCut(s) && inCut(e - .01)) return false;
    const ns = map(s), ne = map(e); i.start = ns; i.len = Math.max(.3, ne - ns); return true;
  });
  // 3) zooms / efectos
  (plan.zooms || []).forEach(z => {
    const at = +z.at; if (isNaN(at) || inCut(at)) return; const kind = FX_NAMES[z.type] && z.type !== 'look' ? z.type : 'zoomIn';
    const fx = mkFx(kind, map(at), +z.len || 1.2); if (z.amt != null) fx.amt = clamp(+z.amt, 0, 100); S.items.push(fx); nZ++;
  });
  // 4) textos
  (plan.texts || []).forEach(t => {
    const at = +t.at; if (isNaN(at) || inCut(at) || !t.text) return;
    const pr = TEXT_PRESETS.find(p => p.n.toLowerCase() === String(t.preset || '').toLowerCase());
    const it = mkText('title', map(at), +t.len || 2.5, String(t.text), pr ? pr.s : null);
    ['x', 'y', 'size', 'scale', 'rot'].forEach(k => { if (t[k] != null) it[k] = +t[k]; }); S.items.push(it); nT++;
  });
  // 5) subtítulos nuevos del plan
  const sp = SUB_PRESETS.find(p => p.n.toLowerCase() === String(plan.subtitleStyle || '').toLowerCase());
  (plan.subtitles || []).forEach(t => {
    const at = +t.at; if (isNaN(at) || inCut(at) || !t.text) return;
    S.items.push(mkText('sub', map(at), +t.len || 2, String(t.text), sp ? sp.s : subPresetStyle())); nS++;
  });
  S.items.filter(i => i.type === 'text').forEach(i => ensureFont(i.font, i.bold));
  S.sel = null; changed(true); seek(0);
  return `Plan aplicado: ${nCuts} corte(s), ${nZ} zoom(s)/efecto(s), ${nT} texto(s), ${nS} subtítulo(s) nuevo(s).`;
}
function transcriptText() {
  return S.items.filter(i => i.type === 'text' && i.track === 'sub').sort((a, b) => a.start - b.start)
    .map(i => `[${fmt(i.start)} → ${fmt(i.start + i.len)}] ${i.text.replace(/\n/g, ' ')}`).join('\n');
}
function bindPlanUI() {
  const ov = $('#plan-overlay'), ta = $('#plan-text'), msg = $('#plan-msg'); const say = (t, bad) => { msg.textContent = t; msg.style.color = bad ? '#e5484d' : '#46c37b'; };
  $('#btn-plan').onclick = () => { ov.hidden = false; say(''); };
  $('#plan-close').onclick = () => ov.hidden = true;
  $('#plan-example').onclick = () => { ta.value = JSON.stringify(PLAN_EXAMPLE, null, 2); say('Ejemplo insertado: cámbialo o pega tu plan.'); };
  $('#plan-apply').onclick = () => {
    try { say(applyPlan(JSON.parse(ta.value))); } catch (e) { say(e instanceof SyntaxError ? 'El JSON no es válido: ' + e.message : e.message, true); }
  };
  $('#plan-copy').onclick = async () => {
    const t = transcriptText(); if (!t) return say('Aún no hay subtítulos. Transcribe primero el video.', true);
    try { await navigator.clipboard.writeText(t); say('Transcripción copiada. Pégala en el chat.'); } catch (_) { ta.value = t; ta.select(); say('Copia el texto seleccionado y pégalo en el chat.'); }
  };
}
bindPlanUI();
