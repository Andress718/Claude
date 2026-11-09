'use strict';
/* ============================================================
   UI — biblioteca, inspector, línea de tiempo, interacción
   ============================================================ */
const FONTS = ['Poppins', 'Montserrat', 'Oswald', 'Bebas Neue', 'Anton', 'Playfair Display', 'Pacifico', 'Lobster', 'Permanent Marker', 'Roboto Mono', 'Arial', 'Georgia', 'Impact', 'Courier New', 'Verdana'];
const ensureFont = (n, bold) => document.fonts.load(`${bold ? 700 : 400} 40px "${n}"`).catch(() => { });

/* ---------- Estilos de texto tipo CapCut ---------- */
const TEXT_PRESETS = [
  { n: 'Básico', t: 'Tu texto aquí', s: { font: 'Poppins', size: 64, strokeW: 6, inAnim: 'fade', outAnim: 'fade' } },
  { n: 'Neón', t: 'NEÓN', s: { font: 'Oswald', size: 84, upper: true, stroke: '#00e5ff', strokeW: 3, glow: '#00e5ff', glowBlur: 30, loopAnim: 'flicker', inAnim: 'fade' } },
  { n: 'Pop cómic', t: 'Pop cómic', s: { font: 'Permanent Marker', size: 84, color: '#ffe600', strokeW: 12, upper: true, inAnim: 'pop', animBy: 'word', outAnim: 'zoomOut' } },
  { n: 'Máquina', t: 'Escribiendo...', s: { font: 'Roboto Mono', size: 52, bold: false, color: '#7CFC00', strokeW: 0, bg: '#000000', bgOpacity: 75, shadow: false, inAnim: 'typewriter', outAnim: 'fade' } },
  { n: 'Letras rebotan', t: 'REBOTE', s: { font: 'Anton', size: 96, upper: true, stroke: '#ff3d71', strokeW: 8, inAnim: 'bounce', animBy: 'char', animDur: .5, outAnim: 'fade' } },
  { n: 'Ola', t: 'Ola de letras', s: { font: 'Pacifico', size: 80, bold: false, color: '#ffd6f6', stroke: '#c2187a', strokeW: 6, loopAnim: 'wave', animBy: 'char', inAnim: 'fade' } },
  { n: 'Glitch', t: 'GLITCH', s: { font: 'Bebas Neue', size: 110, stroke: '#ff0050', strokeW: 4, glow: '#00f0ff', glowBlur: 14, inAnim: 'glitch', outAnim: 'glitch', loopAnim: 'shake', animDur: .6 } },
  { n: 'Barra blanca', t: 'Título limpio', s: { font: 'Montserrat', size: 60, color: '#111111', strokeW: 0, bg: '#ffffff', bgOpacity: 100, shadow: false, inAnim: 'fromB', outAnim: 'fromT', animBy: 'word' } },
  { n: 'Giro 3D', t: 'Giro 3D', s: { font: 'Playfair Display', size: 80, italic: true, color: '#fff7e6', strokeW: 2, inAnim: 'flip', animBy: 'char', outAnim: 'blur' } },
  { n: 'Arcoíris', t: 'Arcoíris', s: { font: 'Lobster', size: 96, bold: false, strokeW: 6, loopAnim: 'rainbow', inAnim: 'zoomIn', outAnim: 'zoomOut' } },
  { n: 'Desenfoque', t: 'Aparece suave', s: { font: 'Montserrat', size: 70, inAnim: 'blur', outAnim: 'blur', animDur: .7 } },
  { n: 'Latido', t: 'LATIDO', s: { font: 'Anton', size: 100, color: '#ff3b30', stroke: '#ffffff', strokeW: 6, upper: true, inAnim: 'pop', loopAnim: 'pulse' } },
];
const SUB_PRESETS = [
  { n: 'Clásico', s: { font: 'Poppins', size: 48, strokeW: 6, inAnim: 'fade', outAnim: 'fade' } },
  { n: 'Hormozi', s: { font: 'Anton', size: 62, upper: true, hlColor: '#27e35a', stroke: '#000000', strokeW: 9, inAnim: 'none', outAnim: 'none', wordFx: 'active' } },
  { n: 'Karaoke', s: { font: 'Montserrat', size: 54, hlColor: '#ffd400', strokeW: 7, wordFx: 'karaoke', inAnim: 'fade' } },
  { n: 'Pop por palabra', s: { font: 'Bebas Neue', size: 84, upper: true, hlColor: '#ffe600', strokeW: 8, wordFx: 'activePop', inAnim: 'none', outAnim: 'none' } },
  { n: 'Caja resaltada', s: { font: 'Poppins', size: 50, hlColor: '#ff2d55', strokeW: 0, shadow: false, wordFx: 'activeBox', inAnim: 'fade' } },
  { n: 'Palabras rebotan', s: { font: 'Poppins', size: 54, strokeW: 6, inAnim: 'bounce', animBy: 'word', animDur: .35 } },
  { n: 'Máquina', s: { font: 'Roboto Mono', size: 44, bold: false, bg: '#000000', bgOpacity: 70, strokeW: 0, shadow: false, inAnim: 'typewriter' } },
  { n: 'Caja negra', s: { font: 'Montserrat', size: 44, bg: '#000000', bgOpacity: 70, strokeW: 0, shadow: false, inAnim: 'fromB' } },
  { n: 'Neón', s: { font: 'Oswald', size: 58, upper: true, stroke: '#ff00c8', strokeW: 3, glow: '#ff00c8', glowBlur: 24 } },
  { n: 'Cómic', s: { font: 'Permanent Marker', size: 62, color: '#ffe600', strokeW: 10, upper: true, inAnim: 'pop', animBy: 'word' } },
  { n: 'Elegante', s: { font: 'Playfair Display', size: 48, italic: true, bold: false, color: '#fff7e6', strokeW: 3, inAnim: 'blur' } },
  { n: 'Letras ola', s: { font: 'Pacifico', size: 56, bold: false, color: '#ffd6f6', stroke: '#c2187a', strokeW: 6, loopAnim: 'wave', animBy: 'char' } },
];
const subPresetStyle = () => ({ ...SUB_PRESETS[0].s });
function applyStyle(it, s) {
  STYLE_KEYS.forEach(k => it[k] = TEXT_BASE[k]); Object.assign(it, s); ensureFont(it.font, it.bold);
}
function usePreset(p, role) {
  const sel = byId(S.items, S.sel);
  if (sel && sel.type === 'text' && (sel.track === 'sub') === (role === 'sub')) { pushUndo(true); applyStyle(sel, p.s); changed(true); return; }
  const it = addText(role, role === 'sub' ? 'Nuevo subtítulo' : (p.t || 'Texto'), null); applyStyle(it, p.s); changed(true);
}

/* ============================================================
   BIBLIOTECA
   ============================================================ */
const LIB_TABS = [['media', '🎞', 'Medios'], ['audio', '🎵', 'Audio'], ['text', '🔤', 'Texto'], ['shapes', '⬤', 'Formas'], ['fx', '✨', 'Efectos'], ['looks', '🎨', 'Filtros']];
let libTab = 'media', lookAsAdj = false;
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'on' ? Object.entries(v).forEach(([a, b]) => e.addEventListener(a, b)) : k === 'style' ? Object.assign(e.style, v) : k === 'class' ? e.className = v : e[k] = v);
  kids.flat().forEach(c => e.append(c)); return e;
};
const gridBtn = (label, fn, style) => el('button', { textContent: label, on: { click: fn }, style: style || {} });
function buildLibrary() {
  const tabs = $('#lib-tabs'); tabs.innerHTML = '';
  LIB_TABS.forEach(([k, ic, n]) => tabs.append(el('button', { class: libTab === k ? 'on' : '', on: { click: () => { libTab = k; buildLibrary(); } } }, el('span', { textContent: ic }), n)));
  const b = $('#lib-body'); b.innerHTML = '';
  if (libTab === 'media') {
    b.append(el('button', { class: 'primary wide', textContent: '＋ Importar video / imagen / audio', on: { click: () => $('#file-media').click() } }), el('div', { id: 'bin-list' }),
      el('div', { class: 'drop', id: 'dropzone', textContent: 'Arrastra aquí tus archivos' }));
    renderBin();
  } else if (libTab === 'audio') {
    b.append(el('div', { class: 'sec-title', textContent: 'Voz en off' }),
      el('button', { id: 'btn-rec', class: 'wide', textContent: '● Grabar voz en off', on: { click: toggleRecord } }),
      el('p', { class: 'hint', textContent: 'Graba mientras se reproduce el video desde el cursor. Usa auriculares para evitar eco.' }),
      el('div', { class: 'sec-title', textContent: 'Audio de un video' }),
      el('button', { class: 'wide', textContent: '⇪ Extraer audio del clip seleccionado', on: { click: () => { const it = byId(S.items, S.sel); (it && it.mt === 'video') ? extractAudio(it.id) : alert('Selecciona primero un clip de video.'); } } }),
      el('div', { class: 'sec-title', textContent: 'Música y sonidos' }),
      el('button', { class: 'wide', textContent: '＋ Importar audio', on: { click: () => $('#file-media').click() } }), el('div', { id: 'audio-list' }));
    updateRecUI(); renderBin();
  } else if (libTab === 'text') {
    const opt = (list, cur, on) => { const sl = el('select', { on: { change: e => on(e.target.value) } }); list.forEach(([v, n]) => sl.append(el('option', { value: v, textContent: n, selected: String(v) === String(cur) }))); return sl; };
    const nT = transcribeTargets().length;
    b.append(el('div', { class: 'sec-title', textContent: 'Transcripción automática (voz → subtítulos)' }),
      el('p', { class: 'hint', textContent: 'Usa Whisper en tu navegador. La primera vez descarga el modelo (requiere internet). Si seleccionas un clip, transcribe solo ese; si no, todos los clips con audio.' }),
      el('label', {}, 'Idioma', opt(TR_LANGS, TRC.lang, v => TRC.lang = v)), el('label', {}, 'Modelo', opt(TR_MODELS, TRC.model, v => TRC.model = v)),
      el('label', {}, 'Estilo de los subtítulos', opt(SUB_PRESETS.map((p, i) => [i, p.n]), TRC.preset, v => TRC.preset = +v)),
      el('label', {}, 'Palabras por subtítulo: ', el('output', { textContent: TRC.words }), el('input', { type: 'range', min: 2, max: 12, value: TRC.words, on: { input: e => { TRC.words = +e.target.value; e.target.previousSibling.textContent = TRC.words; } } })),
      el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: TRC.replace, on: { change: e => TRC.replace = e.target.checked } }), 'Reemplazar subtítulos existentes del tramo'),
      el('button', { class: 'primary wide', textContent: '🎙 Transcribir → subtítulos' + (nT ? ` (${nT} clip${nT > 1 ? 's' : ''})` : ''), on: { click: () => startTranscribe() } }),
      el('div', { class: 'sec-title', textContent: 'Títulos animados (estilo CapCut)' }),
      el('div', { class: 'grid g2' }, TEXT_PRESETS.map(p => gridBtn(p.n, () => usePreset(p, 'title'), previewStyle(p.s)))),
      el('p', { class: 'hint', textContent: 'Si hay un texto seleccionado, el estilo se aplica a ese texto. Luego puedes cambiar colores y tipografía en el panel derecho.' }),
      el('div', { class: 'sec-title', textContent: 'Subtítulos' }),
      el('div', { class: 'row' }, gridBtn('＋ Subtítulo', () => addText('sub', 'Nuevo subtítulo', null).len), gridBtn('Importar SRT', () => $('#file-srt').click()), gridBtn('Exportar SRT', exportSRT)),
      el('div', { class: 'row' }, gridBtn('Aplicar este estilo a todos', () => {
        const cur = byId(S.items, S.sel); if (!cur || cur.type !== 'text') return alert('Selecciona un subtítulo.');
        pushUndo(true); S.items.filter(i => i.type === 'text' && i.track === 'sub').forEach(s => Object.assign(s, styleOf(cur))); changed(true);
      })),
      el('div', { class: 'grid g2' }, SUB_PRESETS.map(p => gridBtn(p.n, () => usePreset(p, 'sub'), previewStyle(p.s)))));
  } else if (libTab === 'shapes') {
    const SH = [['rect', '■'], ['rounded', '▢'], ['circle', '●'], ['triangle', '▲'], ['diamond', '◆'], ['star', '★'], ['heart', '♥'], ['arrow', '➜'], ['line', '▬']];
    b.append(el('div', { class: 'sec-title', textContent: 'Formas básicas' }), el('div', { class: 'grid' }, SH.map(([k, ic]) => { const x = gridBtn(ic, () => addShape(k)); x.className = 'shape'; x.title = k; return x; })),
      el('p', { class: 'hint', textContent: 'Las formas van a una capa superior. Cámbiales color, tamaño, animación y mezcla en el panel derecho. También sirven de fondo detrás de un video con máscara.' }));
  } else if (libTab === 'fx') {
    b.append(el('div', { class: 'sec-title', textContent: 'Efectos (se aplican a todo el video durante su duración)' }),
      el('div', { class: 'grid' }, Object.entries(FX_NAMES).filter(([k]) => k !== 'look').map(([k, n]) => gridBtn(n, () => addFx(k)))));
  } else if (libTab === 'looks') {
    b.append(el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: lookAsAdj, on: { change: e => lookAsAdj = e.target.checked } }), 'Como capa de ajuste (afecta a todo el video)'),
      el('div', { class: 'sec-title', textContent: 'Looks de color' }),
      el('div', { class: 'grid' }, [['none', { n: 'Original' }], ...Object.entries(LOOKS)].map(([k, L]) => gridBtn(L.n, () => applyLook(k)))),
      el('p', { class: 'hint', textContent: 'Se aplica al clip seleccionado. Afina con "Filtro y corrección de color" en el panel derecho.' }));
  }
}
const previewStyle = s => ({ fontFamily: `"${s.font}"`, color: s.color || '#fff', background: s.bgOpacity ? s.bg : '', fontStyle: s.italic ? 'italic' : '', textTransform: s.upper ? 'uppercase' : '', fontSize: '14px' });
function applyLook(key) {
  const sel = byId(S.items, S.sel);
  if (!lookAsAdj && sel && sel.type === 'media') { pushUndo(true); sel.color.look = key; changed(true); }
  else if (!lookAsAdj && sel && sel.type === 'fx' && sel.kind === 'look') { pushUndo(true); sel.color.look = key; changed(true); }
  else { if (key === 'none') return; addFx('look'); const f = byId(S.items, S.sel); f.color.look = key; f.name = LOOKS[key].n; changed(true); }
}
function renderBin() {
  const box = $('#bin-list'), abox = $('#audio-list');
  if (box) {
    box.innerHTML = '';
    S.media.filter(m => m.type !== 'audio').forEach(m => box.append(el('div', { class: 'bin-item' },
      el('div', { class: 'thumb', style: { backgroundImage: `url(${m.thumb})` } }),
      el('div', { class: 'meta' }, el('b', { textContent: m.name }), el('span', { textContent: m.type === 'image' ? 'Imagen' : fmt(m.duration, false) })),
      el('div', { class: 'btns' }, el('button', { textContent: '＋ Principal', title: 'Añadir al final de la pista principal', on: { click: () => addToMain(m) } }),
        el('button', { textContent: '⧉ Capa', title: 'Superponer sobre el video en el cursor', on: { click: () => addOverlay(m) } })))));
  }
  if (abox) {
    abox.innerHTML = '';
    S.media.filter(m => m.type === 'audio').forEach(m => abox.append(el('div', { class: 'bin-item' }, el('div', { class: 'thumb', textContent: '🎵' }),
      el('div', { class: 'meta' }, el('b', { textContent: m.name }), el('span', { textContent: fmt(m.duration, false) })),
      el('div', { class: 'btns' }, el('button', { textContent: '＋ Añadir', on: { click: () => addAudioItem(m, 'a1', S.t) } })))));
  }
}

/* ============================================================
   INSPECTOR (generado a partir de esquemas)
   ============================================================ */
const R = (k, l, min, max, step = 1) => ({ t: 'range', k, l, min, max, step });
const N = (k, l, step = .1) => ({ t: 'num', k, l, step });
const C = (k, l) => ({ t: 'color', k, l });
const SEL = (k, l, o, rebuild) => ({ t: 'sel', k, l, o, rebuild });
const CHK = (k, l, rebuild) => ({ t: 'chk', k, l, rebuild });
const BTN = (l, fn, cls) => ({ t: 'btn', l, fn, cls });
const TXT = (k, l) => ({ t: 'txt', k, l });
const TRANS = [['none', 'Ninguna (corte)'], ['fade', 'Fundido cruzado'], ['dip', 'Fundido a negro'], ['slideL', 'Deslizar ←'], ['slideR', 'Deslizar →'], ['slideU', 'Deslizar ↑'], ['slideD', 'Deslizar ↓'], ['wipeL', 'Cortinilla →'], ['wipeR', 'Cortinilla ←'], ['circle', 'Círculo'], ['zoom', 'Zoom']];
const MASKS = [['none', 'Sin máscara'], ['rect', 'Rectángulo'], ['rounded', 'Redondeado'], ['circle', 'Círculo / elipse'], ['triangle', 'Triángulo'], ['diamond', 'Rombo'], ['star', 'Estrella'], ['heart', 'Corazón']];
const dur = (k, l) => R(k, l, .1, 3, .05);
function colorFields(p) {
  return [SEL(p + '.look', 'Filtro (look)', [['none', 'Ninguno'], ...Object.entries(LOOKS).map(([k, v]) => [k, v.n])]), R(p + '.lookAmt', 'Intensidad del filtro', 0, 100),
    R(p + '.b', 'Exposición / brillo', 0, 200), R(p + '.c', 'Contraste', 0, 200), R(p + '.s', 'Saturación', 0, 300), R(p + '.hue', 'Tono (hue)', -180, 180),
    R(p + '.temp', 'Temperatura (frío ↔ cálido)', -100, 100), R(p + '.tint', 'Matiz (verde ↔ magenta)', -100, 100), R(p + '.sh', 'Sombras', -100, 100),
    R(p + '.hl', 'Luces altas', -100, 100), R(p + '.bl', 'Desenfoque', 0, 20, .5), R(p + '.vig', 'Viñeta', 0, 100),
    BTN('Restablecer color', it => { Object.assign(getPath(it, p), COLOR0()); })];
}
const posFields = (opts = {}) => [R('x', 'Posición X %', -50, 150), R('y', 'Posición Y %', -50, 150), R('scale', 'Escala %', 5, 400), R('rot', 'Rotación °', -180, 180), R('opacity', 'Opacidad %', 0, 100), ...(opts.flip ? [CHK('flipH', 'Espejo horizontal')] : [])];
const animFields = (loop, tin = ANIM_IN) => [SEL('inAnim.type', 'Entrada', tin), dur('inAnim.dur', 'Duración entrada'), SEL('outAnim.type', 'Salida', ANIM_IN), dur('outAnim.dur', 'Duración salida'), SEL('anim', 'Movimiento continuo', loop)];
const commonActs = (it, extra = []) => [...extra, BTN('✂ Dividir en cursor', () => splitItem(it)), BTN('⧉ Duplicar', () => duplicateItem(it.id)), BTN('Eliminar', () => deleteItem(it.id), 'danger')];

function schema(it) {
  const main = isMain(it);
  if (it.type === 'media') {
    const idx = mainItems().indexOf(it), m = it.mask, vid = it.mt === 'video';
    return [
      { t: 'Tiempo', f: [N('trimIn', 'Recorte inicio (s)'), N('trimOut', 'Recorte fin (s)'), ...(main ? [] : [N('start', 'Inicio en la línea de tiempo (s)')])] },
      { t: 'Posición y tamaño', f: [...posFields({ flip: 1 }), SEL('fit', 'Ajuste', [['cover', 'Llenar pantalla'], ['contain', 'Ajustar (barras)']], true), ...(main && it.fit === 'contain' ? [CHK('bgBlur', 'Fondo desenfocado')] : [])] },
      { t: 'Mezcla con capas de abajo', f: [SEL('blend', 'Modo de fusión', BLENDS)], closed: 1 },
      { t: 'Animación', f: animFields(ANIM_LOOP_VISUAL) },
      ...(main && idx > 0 ? [{ t: 'Transición de entrada', f: [SEL('transition.type', 'Tipo', TRANS, true), dur('transition.dur', 'Duración')] }] : []),
      { t: 'Máscara (recorte con forma)', f: [SEL('mask.type', 'Forma', MASKS, true), ...(m.type !== 'none' ? [
        R('mask.x', 'Posición X %', 0, 100), R('mask.y', 'Posición Y %', 0, 100), R('mask.w', 'Ancho %', 5, 200), R('mask.h', 'Alto %', 5, 200), R('mask.rot', 'Rotación °', -180, 180),
        ...(m.type === 'rounded' ? [R('mask.round', 'Redondeo', 0, 100)] : []), R('mask.feather', 'Suavizado de borde', 0, 80), CHK('mask.invert', 'Invertir (agujero: se ve lo de atrás)'),
        SEL('mask.anim', 'Animación de máscara', [['none', 'Ninguna'], ['grow', 'Crecer al entrar'], ['pulse', 'Latido'], ['spin', 'Girar']]), R('mask.animDur', 'Duración animación', .1, 3, .1)] : [])] },
      { t: 'Croma (quitar color de fondo)', f: [CHK('chroma.on', 'Activar croma', true), ...(it.chroma.on ? [C('chroma.color', 'Color a eliminar'), R('chroma.tol', 'Tolerancia', 0, 100), R('chroma.soft', 'Suavizado', 0, 50)] : [])], closed: !it.chroma.on },
      { t: 'Filtro y corrección de color', f: colorFields('color') },
      ...(vid ? [{ t: 'Audio del clip', f: [R('volume', 'Volumen %', 0, 200), R('fadeIn', 'Fundido de entrada (s)', 0, 5, .1), R('fadeOut', 'Fundido de salida (s)', 0, 5, .1), CHK('muted', 'Silenciar'), BTN('⇪ Extraer audio a una pista', () => extractAudio(it.id)), BTN('🎙 Generar subtítulos', () => startTranscribe(it))] }] : []),
      { t: 'Acciones', f: commonActs(it, main ? [BTN('◀ Mover', () => moveMain(it.id, -1)), BTN('Mover ▶', () => moveMain(it.id, 1))] : []) },
    ];
  }
  if (it.type === 'shape') return [
    { t: 'Forma', f: [SEL('kind', 'Tipo', [['rect', 'Cuadrado'], ['rounded', 'Rectángulo redondeado'], ['circle', 'Círculo / elipse'], ['triangle', 'Triángulo'], ['diamond', 'Rombo'], ['star', 'Estrella'], ['heart', 'Corazón'], ['arrow', 'Flecha'], ['line', 'Línea']], true),
      R('w', 'Ancho (% del lado menor)', 1, 200), R('h', 'Alto', 1, 200), ...(it.kind === 'rounded' ? [R('radius', 'Redondeo', 0, 100)] : []), C('fill', 'Color de relleno'), C('stroke', 'Color de borde'), R('strokeW', 'Grosor del borde', 0, 40), CHK('shadow', 'Sombra')] },
    { t: 'Posición', f: posFields() }, { t: 'Mezcla', f: [SEL('blend', 'Modo de fusión', BLENDS)], closed: 1 },
    { t: 'Animación', f: animFields(ANIM_LOOP_VISUAL) },
    { t: 'Tiempo', f: [N('start', 'Inicio (s)'), N('len', 'Duración (s)')] }, { t: 'Acciones', f: commonActs(it) },
  ];
  if (it.type === 'text') {
    const sub = it.track === 'sub';
    return [
      { t: sub ? 'Subtítulo' : 'Texto', f: [TXT('text', 'Texto'), N('start', 'Inicio (s)'), N('len', 'Duración (s)')] },
      { t: 'Estilos rápidos', f: [{ t: 'presets', list: sub ? SUB_PRESETS : TEXT_PRESETS, role: sub ? 'sub' : 'title' }], closed: 1 },
      { t: 'Tipografía', f: [{ t: 'font' }, R('size', 'Tamaño', 14, 200), CHK('bold', 'Negrita'), CHK('italic', 'Cursiva'), CHK('upper', 'MAYÚSCULAS'), CHK('shadow', 'Sombra')] },
      { t: 'Colores', f: [C('color', 'Color del texto'), C('hlColor', 'Color de resalte (palabra activa)'), C('stroke', 'Color del contorno'), R('strokeW', 'Grosor del contorno', 0, 30),
        C('bg', 'Color de fondo'), R('bgOpacity', 'Opacidad del fondo', 0, 100), C('glow', 'Color del resplandor'), R('glowBlur', 'Resplandor', 0, 80)] },
      { t: 'Posición', f: posFields() },
      { t: 'Animación', f: [SEL('inAnim', 'Entrada', ANIM_TEXT_IN), SEL('outAnim', 'Salida', ANIM_IN), SEL('loopAnim', 'Movimiento continuo', ANIM_LOOP_TEXT), dur('animDur', 'Duración animación'),
        SEL('animBy', 'Animar por', [['all', 'Todo el texto'], ['word', 'Palabra'], ['char', 'Letra']]),
        SEL('wordFx', 'Resalte palabra a palabra', [['none', 'Ninguno'], ['karaoke', 'Karaoke (progresivo)'], ['active', 'Solo palabra activa'], ['activePop', 'Palabra activa con pop'], ['activeBox', 'Palabra activa en caja']])] },
      { t: 'Acciones', f: commonActs(it) },
    ];
  }
  if (it.type === 'fx') return [
    { t: 'Efecto', f: [SEL('kind', 'Tipo', Object.entries(FX_NAMES), true), R('amt', 'Intensidad', 0, 100), ...(['flash', 'strobe'].includes(it.kind) ? [C('flashColor', 'Color')] : []), N('start', 'Inicio (s)'), N('len', 'Duración (s)')] },
    ...(it.kind === 'look' ? [{ t: 'Filtro y corrección de color', f: colorFields('color') }] : []),
    { t: 'Acciones', f: commonActs(it) },
  ];
  if (it.type === 'audio') return [
    { t: 'Audio', f: [R('volume', 'Volumen %', 0, 200), R('fadeIn', 'Fundido de entrada (s)', 0, 10, .1), R('fadeOut', 'Fundido de salida (s)', 0, 10, .1), CHK('muted', 'Silenciar')] },
    { t: 'Tiempo', f: [N('start', 'Inicio (s)'), N('trimIn', 'Recorte inicio (s)'), N('trimOut', 'Recorte fin (s)')] },
    { t: 'Acciones', f: commonActs(it, [BTN('🎙 Generar subtítulos', () => startTranscribe(it))]) },
  ];
  return [];
}
const KIND_LABEL = { media: 'Video / imagen', shape: 'Forma', text: 'Texto', fx: 'Efecto', audio: 'Audio' };
let inspSig = '', inspFields = [];
function buildInspector(force) {
  const box = $('#inspector'), it = byId(S.items, S.sel);
  if (!it) {
    if (inspSig !== 'none') { inspSig = 'none'; inspFields = []; box.innerHTML = ''; box.append(el('div', { class: 'empty' }, 'Selecciona un elemento\nen la línea de tiempo\npara editarlo.'.split('\n').flatMap(s => [s, el('br')]))); }
    return;
  }
  const sc = schema(it), sig = it.id + '|' + sc.map(s => s.t + ':' + s.f.map(f => f.k || f.l || f.t).join(',')).join(';');
  if (!force && sig === inspSig) { refreshInspector(); return; }
  const prevOpen = {}; box.querySelectorAll('details').forEach(d => prevOpen[d.dataset.t] = d.open);
  inspSig = sig; inspFields = []; box.innerHTML = '';
  box.append(el('h3', { textContent: it.type === 'text' ? it.text.replace(/\n/g, ' ') : it.name }), el('div', { class: 'kind', textContent: KIND_LABEL[it.type] }));
  sc.forEach(sec => {
    const d = el('details', { open: prevOpen[sec.t] !== undefined ? prevOpen[sec.t] : !sec.closed }); d.dataset.t = sec.t; d.append(el('summary', { textContent: sec.t }));
    const acts = el('div', { class: 'acts' });
    sec.f.forEach(f => { const node = mkField(it, f); (f.t === 'btn' ? acts : d).append(node); });
    if (acts.children.length) d.append(acts); box.append(d);
  });
  refreshInspector();
}
function mkField(it, f) {
  if (f.t === 'btn') return el('button', { textContent: f.l, class: f.cls || '', on: { click: () => { pushUndo(true); f.fn(it); changed(true); } } });
  if (f.t === 'presets') return el('div', { class: 'grid g2' }, f.list.map(p => gridBtn(p.n, () => { pushUndo(true); applyStyle(it, p.s); changed(true); }, previewStyle(p.s))));
  const lab = el('label', { class: f.t === 'chk' ? 'inl' : '' }); let inp;
  if (f.t === 'font') {
    f = { ...f, k: 'font' }; inp = el('select'); FONTS.forEach(n => inp.append(el('option', { value: n, textContent: n, style: { fontFamily: n } })));
    lab.append('Fuente', inp); lab.append(el('button', { textContent: 'Subir mi fuente (.ttf/.otf)…', style: { marginTop: '6px', width: '100%' }, type: 'button', on: { click: ev => { ev.preventDefault(); $('#file-font').click(); } } }));
  } else if (f.t === 'range') { inp = el('input', { type: 'range', min: f.min, max: f.max, step: f.step }); lab.append(f.l, el('output'), inp); }
  else if (f.t === 'num') { inp = el('input', { type: 'number', step: f.step }); lab.append(f.l, inp); }
  else if (f.t === 'color') { inp = el('input', { type: 'color' }); lab.append(f.l, inp); }
  else if (f.t === 'chk') { inp = el('input', { type: 'checkbox' }); lab.append(inp, f.l); }
  else if (f.t === 'txt') { inp = el('textarea', { rows: 3 }); lab.append(f.l, inp); }
  else if (f.t === 'sel') { inp = el('select'); f.o.forEach(([v, n]) => inp.append(el('option', { value: v, textContent: n }))); lab.append(f.l, inp); }
  const ev = (f.t === 'sel' || f.t === 'chk') ? 'change' : 'input';
  inp.addEventListener(ev, () => {
    pushUndo(); let v = inp.type === 'checkbox' ? inp.checked : (inp.type === 'range' || inp.type === 'number') ? (parseFloat(inp.value) || 0) : inp.value;
    setPath(it, f.k, v);
    if (f.k === 'font' || f.k === 'bold') ensureFont(it.font, it.bold);
    if (it.type === 'media' || it.type === 'audio') {
      const m = byId(S.media, it.mediaId), max = m && m.type !== 'image' ? m.duration : 1e4;
      if (f.k === 'trimIn') it.trimIn = clamp(it.trimIn, 0, it.trimOut - .1); if (f.k === 'trimOut') it.trimOut = clamp(it.trimOut, it.trimIn + .1, max);
    }
    if (it.type !== 'media' && it.type !== 'audio' && f.k === 'len') it.len = Math.max(.1, it.len);
    if (f.k === 'kind' && it.type === 'fx') it.name = FX_NAMES[it.kind]; if (f.k === 'kind' && it.type === 'shape') it.name = inp.options[inp.selectedIndex].text;
    changed(!!f.rebuild);
  });
  inspFields.push({ inp, f, out: lab.querySelector('output') });
  return lab;
}
function refreshInspector() {
  const it = byId(S.items, S.sel); if (!it) return;
  inspFields.forEach(({ inp, f, out }) => {
    const v = getPath(it, f.k); if (v === undefined) return;
    if (inp.type === 'checkbox') inp.checked = !!v; else if (document.activeElement !== inp) inp.value = v;
    if (out) out.textContent = Math.round(v * 100) / 100;
  });
}

/* ============================================================
   LÍNEA DE TIEMPO
   ============================================================ */
const ICON = { media: '', shape: '◆ ', text: 'T ', fx: '✨ ', audio: '🎵 ' };
function renderTimeline() {
  const maxEnd = Math.max(S.total, 10) + 8, inner = $('#tl-inner'); inner.style.width = maxEnd * S.zoom + 'px';
  const ruler = $('#ruler'); ruler.innerHTML = '';
  const step = S.zoom >= 140 ? .5 : S.zoom >= 60 ? 1 : S.zoom >= 30 ? 5 : 10;
  for (let t = 0; t < maxEnd; t += step) ruler.append(el('div', { class: 'tick', textContent: fmt(t, false), style: { left: t * S.zoom + 'px' } }));
  const rows = $('#rows'), labels = $('#tl-labels'); rows.innerHTML = ''; labels.innerHTML = ''; labels.append(el('div', { class: 'lbl rl' }));
  S.tracks.forEach(tr => {
    const its = S.items.filter(i => i.track === tr.id).sort((a, b) => a.start - b.start), lanes = [], laneOf = new Map();
    its.forEach(i => { let l = lanes.findIndex(e => e <= i.start + .001); if (l < 0) { l = lanes.length; lanes.push(0); } lanes[l] = i.start + i.len; laneOf.set(i.id, l); });
    const lh = tr.main ? 44 : tr.kind === 'audio' ? 34 : 26, h = Math.max(lh + 6, lanes.length * lh + 6);
    const row = el('div', { class: 'trow', style: { height: h + 'px' } }); row.dataset.track = tr.id;
    its.forEach(it => {
      const b = el('div', { class: `block ${it.type}${it.type === 'media' && !tr.main ? ' ov' : ''}${it.id === S.sel ? ' sel' : ''}`,
        style: { left: it.start * S.zoom + 'px', width: Math.max(8, it.len * S.zoom) + 'px', top: 4 + laneOf.get(it.id) * lh + 'px', height: lh - 4 + 'px' } });
      if (it.type === 'media') { const m = byId(S.media, it.mediaId); if (m && m.thumb) b.style.backgroundImage = `linear-gradient(#0000,#0005),url(${m.thumb})`; }
      b.append(el('span', { class: 'lab', textContent: ICON[it.type] + (it.type === 'text' ? it.text.replace(/\n/g, ' ') : it.name) }), el('i', { class: 'h l' }), el('i', { class: 'h r' }));
      if (it.type === 'audio') { const cv = el('canvas', { class: 'wave' }); cv.width = Math.min(5000, Math.max(8, Math.round(it.len * S.zoom))); cv.height = lh - 4; b.prepend(cv); drawWave(cv, it); }
      if (it.ov > 0) b.append(el('i', { class: 'tr', style: { width: it.ov * S.zoom + 'px' } }));
      b.addEventListener('mousedown', e => {
        e.stopPropagation(); const h2 = e.target.classList.contains('h') ? (e.target.classList.contains('l') ? 'l' : 'r') : null;
        if (S.sel !== it.id) { S.sel = it.id; changed(true); }
        itemDrag(e, it, h2 || 'move');
      });
      row.append(b);
    });
    rows.append(row); labels.append(el('div', { class: 'lbl', style: { height: h + 'px' }, textContent: tr.name }));
  });
}
function itemDrag(e, it, kind) {
  const x0 = e.clientX, y0 = e.clientY, st = { start: it.start, len: it.len, trimIn: it.trimIn, trimOut: it.trimOut }; let pushed = false;
  const m = it.mediaId && byId(S.media, it.mediaId), maxDur = m && m.type !== 'image' ? m.duration : 1e4, main = isMain(it), th = 8 / S.zoom;
  const snap = (v, ex) => {
    const c = [S.t, 0, ...S.items.filter(o => o !== it).flatMap(o => [o.start, o.start + o.len])]; let best = v, bd = th;
    c.forEach(x => { const d = Math.abs(x - v); if (d < bd) { bd = d; best = x; } }); return best;
  };
  const compat = tr => (it.type === 'media' && tr.kind === 'video' && !tr.main) || (it.type === 'shape' && tr.kind === 'video' && !tr.main) || (it.type === 'text' && tr.kind === 'text') || (it.type === 'audio' && tr.kind === 'audio') || (it.type === 'fx' && tr.kind === 'fx');
  const mv = ev => {
    if (!pushed) { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 3) return; pushUndo(true); pushed = true; }
    const dx = (ev.clientX - x0) / S.zoom, media = it.type === 'media' || it.type === 'audio';
    if (kind === 'move') {
      if (main) {
        const center = st.start + st.len / 2 + dx, others = mainItems().filter(x => x !== it), ni = others.filter(x => x.start + x.len / 2 < center).length;
        S.items.splice(S.items.indexOf(it), 1); const ref = others[ni]; S.items.splice(ref ? S.items.indexOf(ref) : S.items.indexOf(others[others.length - 1]) + 1 || S.items.length, 0, it);
      } else {
        let ns = Math.max(0, st.start + dx); const a = snap(ns), b = snap(ns + st.len) - st.len; ns = Math.abs(a - ns) <= Math.abs(b - ns) ? a : b; it.start = Math.max(0, ns);
        const row = $$('.trow').find(r => { const q = r.getBoundingClientRect(); return ev.clientY >= q.top && ev.clientY < q.bottom; });
        if (row) { const tr = trackOf(row.dataset.track); if (tr && compat(tr)) it.track = tr.id; }
      }
    } else if (kind === 'l') {
      if (media) { const nt = clamp(st.trimIn + dx, 0, st.trimOut - .1); it.trimIn = nt; if (!main) it.start = st.start + (nt - st.trimIn); }
      else { const ns = clamp(snap(st.start + dx), 0, st.start + st.len - .1); it.len = st.len - (ns - st.start); it.start = ns; }
    } else {
      if (media) it.trimOut = clamp(st.trimOut + dx, st.trimIn + .1, maxDur); else it.len = Math.max(.1, snap(st.start + st.len + dx) - st.start);
    }
    changed(false);
  };
  const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
}
function seekFromEvent(e) { const r = $('#tl-inner').getBoundingClientRect(); seek((e.clientX - r.left) / S.zoom); }
function scrub(e) {
  seekFromEvent(e);
  const mv = ev => seekFromEvent(ev), up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
}

/* ============================================================
   VISTA PREVIA: seleccionar / arrastrar / escalar
   ============================================================ */
canvas.addEventListener('mousedown', e => {
  const r = canvas.getBoundingClientRect(), k = S.W / r.width, mx = (e.clientX - r.left) * k, my = (e.clientY - r.top) * k;
  const id = [...HITS].reverse().find(i => { const b = BOX.get(i); return b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h; });
  if (id == null) return;
  const it = byId(S.items, id); if (!it) return;
  if (S.sel !== id) { S.sel = id; changed(true); }
  pushUndo(true); const ox = mx - S.W * it.x / 100, oy = my - S.H * it.y / 100;
  const mv = ev => { const x = (ev.clientX - r.left) * k, y = (ev.clientY - r.top) * k; it.x = clamp((x - ox) / S.W * 100, -50, 150); it.y = clamp((y - oy) / S.H * 100, -50, 150); refreshInspector(); };
  const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
});
canvas.addEventListener('wheel', e => {
  const it = byId(S.items, S.sel); if (!it || it.scale === undefined) return; e.preventDefault(); pushUndo();
  it.scale = clamp(it.scale * (e.deltaY < 0 ? 1.05 : .95), 5, 400); refreshInspector();
}, { passive: false });

/* ============================================================
   BARRA SUPERIOR Y ATAJOS
   ============================================================ */
function bindUI() {
  const as = $('#aspect'); ASPECTS.forEach(([k, n]) => as.append(el('option', { value: k, textContent: n })));
  as.onchange = e => setAspect(e.target.value); $('#quality').onchange = e => setAspect(S.aspect, +e.target.value);
  $('#bg').oninput = e => S.bg = e.target.value;
  $('#btn-play').onclick = () => S.playing ? pause() : play(); $('#btn-start').onclick = () => seek(0);
  $('#btn-split').onclick = () => splitItem(); $('#btn-undo').onclick = undo; $('#btn-redo').onclick = redo; $('#btn-export').onclick = startExport;
  $('#btn-add-vtrack').onclick = () => addTrack('video'); $('#btn-add-atrack').onclick = () => addTrack('audio');
  $('#file-media').onchange = e => { importFiles([...e.target.files]); e.target.value = ''; };
  $('#file-srt').onchange = async e => { const f = e.target.files[0]; if (f) importSRT(await f.text()); e.target.value = ''; };
  $('#file-font').onchange = async e => {
    const f = e.target.files[0]; if (!f) return; const name = f.name.replace(/\.[^.]+$/, '');
    const face = new FontFace(name, await f.arrayBuffer()); await face.load(); document.fonts.add(face);
    if (!FONTS.includes(name)) FONTS.unshift(name); const it = byId(S.items, S.sel);
    if (it && it.type === 'text') { pushUndo(true); it.font = name; } changed(true); inspSig = ''; buildInspector(true); e.target.value = '';
  };
  $('#zoom').oninput = e => { S.zoom = +e.target.value; renderTimeline(); };
  $('#tl-scroll').addEventListener('scroll', e => { $('#tl-labels').scrollTop = e.target.scrollTop; });
  $('#tl-inner').addEventListener('mousedown', e => { if (e.target.closest('.block')) return; if (e.target.closest('.trow') && S.sel) { S.sel = null; changed(true); } scrub(e); });
  const dz = () => $('#dropzone');
  ['dragenter', 'dragover'].forEach(v => document.addEventListener(v, e => { e.preventDefault(); dz() && dz().classList.add('over'); }));
  ['dragleave', 'drop'].forEach(v => document.addEventListener(v, e => { e.preventDefault(); dz() && dz().classList.remove('over'); }));
  document.addEventListener('drop', e => importFiles([...e.dataTransfer.files]));
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase(), typing = ['textarea', 'select'].includes(tag) || (tag === 'input' && !['range', 'checkbox', 'color'].includes(e.target.type));
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'z') { if (typing) return; e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (e.key.toLowerCase() === 'd' && !typing) { e.preventDefault(); S.sel && duplicateItem(S.sel); } return;
    }
    if (typing) return;
    if (e.code === 'Space') { e.preventDefault(); S.playing ? pause() : play(); }
    else if (e.key === 's' || e.key === 'S') splitItem();
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (S.sel) deleteItem(S.sel); }
    else if (e.key === 'ArrowLeft') seek(S.t - (e.shiftKey ? 1 : .1)); else if (e.key === 'ArrowRight') seek(S.t + (e.shiftKey ? 1 : .1));
  });
}
