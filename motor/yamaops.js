/* Red DAIMAY · Fase 5 · yamazumis de operaciones por línea (lo usa motor/visor.js).
   Importa la plantilla "Yamazumi v5" de Excel (hojas CONFIG y CICLOS) o un CSV, y arma el yamazumi contra takt.
   - Se lee la hoja CICLOS, no la hoja resumen YAMAZUMI: esa se desfasa cuando hay números de operación vacíos.
   - Cada yamazumi tiene nombre, tripulación, turno y takt; se elige qué operaciones entran y se guarda con el escenario (SCN.yz).
   - La categoría es por ciclo, como en la plantilla: la barra reparte el promedio según la categoría de cada ciclo. */
export const CATS = [
  { k: 'va', name: 'Proceso (VA)', col: '#199e70' }, { k: 'insp', name: 'Inspección', col: '#3987e5' }, { k: 'mov', name: 'Movimiento', col: '#d95926' },
  { k: 'esp', name: 'Espera', col: '#d55181' }, { k: 'rew', name: 'Rework', col: '#e5484d' }, { k: 'aju', name: 'Ajuste / Setup', col: '#9085e9' },
  { k: 'cd', name: 'Carga / Descarga', col: '#c98500' }, { k: 'otro', name: 'Sin categoría', col: '#7c8a97' }];
const norm = s => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function catOf(v) { const n = norm(v); if (!n) return 'otro';
  if (n.startsWith('proceso') || n === 'va' || n.includes('valor')) return 'va'; if (n.startsWith('insp')) return 'insp'; if (n.startsWith('mov')) return 'mov';
  if (n.startsWith('esp')) return 'esp'; if (n.startsWith('rew') || n.startsWith('retrab')) return 'rew'; if (n.startsWith('aju') || n.startsWith('set')) return 'aju';
  if (n.startsWith('carga') || n.startsWith('desc') || n === 'c/d') return 'cd'; return CATS.some(c => c.k === n) ? n : 'otro'; }
const uid = () => 'y' + Math.random().toString(36).slice(2, 9);
const num = v => { if (typeof v === 'number') return v; const m = String(v ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };

/* ---------- lector mínimo de .xlsx (zip + xml), sin librerías ---------- */
async function unzip(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf), td = new TextDecoder(); let e = buf.byteLength - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error('El archivo no es un Excel .xlsx válido');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = {};
  for (let i = 0; i < n; i++) { if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true); files[name] = { method, data: u8.subarray(start, start + csize) }; }
  return async name => { const f = files[name] || files[name.replace(/^\//, '')]; if (!f) return null; if (f.method === 0) return td.decode(f.data);
    return await new Response(new Blob([f.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); };
}
const xml = t => new DOMParser().parseFromString(t, 'application/xml');
const tags = (n, t) => [...n.getElementsByTagNameNS('*', t)];
export async function readXlsx(buf) {
  const get = await unzip(buf), wb = xml(await get('xl/workbook.xml')), rels = xml(await get('xl/_rels/workbook.xml.rels'));
  const target = {}; tags(rels, 'Relationship').forEach(r => { target[r.getAttribute('Id')] = r.getAttribute('Target'); });
  const sst = await get('xl/sharedStrings.xml'), SS = sst ? tags(xml(sst), 'si').map(si => tags(si, 't').filter(t => t.parentNode.localName !== 'rPh').map(t => t.textContent).join('')) : [];
  const out = {};
  for (const s of tags(wb, 'sheet')) {
    let t = target[s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')] || ''; t = t.startsWith('/') ? t.slice(1) : 'xl/' + t;
    const x = await get(t); if (!x) continue; const rows = [];
    for (const c of tags(xml(x), 'c')) { const ref = c.getAttribute('r') || '', m = ref.match(/^([A-Z]+)(\d+)$/); if (!m) continue;
      let col = 0; for (const ch of m[1]) col = col * 26 + ch.charCodeAt(0) - 64; const r = +m[2] - 1, ty = c.getAttribute('t'), v = tags(c, 'v')[0]?.textContent;
      let val = ty === 's' ? SS[+v] : ty === 'inlineStr' ? tags(c, 't').map(t => t.textContent).join('') : ty === 'str' || ty === 'e' ? v : v === undefined ? '' : +v;
      if (val === '' || val === undefined) continue; (rows[r] = rows[r] || [])[col - 1] = val; }
    out[s.getAttribute('name')] = rows;
  }
  return out;
}

/* ---------- plantilla Yamazumi v5 ---------- */
export function splitName(name) { const m = String(name || '').trim().match(/^(\S+)\s+(RR|FR)\s+(LH|RH)\s*(.*)$/i);
  return m ? { est: m[1].toUpperCase(), pos: m[2].toUpperCase(), lado: m[3].toUpperCase(), oper: m[4].trim() } : { est: '', pos: '', lado: '', oper: '' }; }
export function parseTemplate(sheets, fileName) {
  const names = Object.keys(sheets), cfg = sheets[names.find(n => norm(n).startsWith('config'))] || [], warn = [];
  const cicName = names.find(n => norm(n).startsWith('ciclo')) || names.find(n => (sheets[n] || []).some(r => r && r.some(c => norm(c) === 'operacion') && r.some(c => norm(c).startsWith('cycle time'))));
  if (!cicName) throw new Error('No encontré la hoja CICLOS (columnas OPERACION y CYCLE TIME).');
  const meta = {}; cfg.forEach(r => { if (!r) return; const i = r.findIndex(c => typeof c === 'string' && c.trim()); if (i < 0) return; const k = norm(r[i]), v = r[i + 1];
    if (k === 'planta') meta.planta = v; else if (k.startsWith('linea')) meta.linea = v; else if (k.startsWith('programa')) meta.programa = v; else if (k.startsWith('estacion')) meta.familia = v;
    else if (k.startsWith('fecha')) meta.fecha = typeof v === 'number' ? new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10) : String(v ?? ''); else if (k === 'turno') meta.turno = v;
    else if (k.startsWith('analista')) meta.analista = v; else if (k.startsWith('takt')) meta.takt = num(v); });
  const rows = sheets[cicName], h = rows.findIndex(r => r && r.some(c => norm(c) === 'operacion') && r.some(c => norm(c).startsWith('cycle time')));
  const H = rows[h].map(norm), cN = H.indexOf('#'), cO = H.indexOf('operacion'), cT = H.findIndex(x => x.startsWith('cycle time')), cC = H.findIndex(x => x.startsWith('categoria')), cM = H.findIndex(x => x.startsWith('comentario'));
  const blocks = new Map();
  for (let i = h + 1; i < rows.length; i++) { const r = rows[i]; if (!r) continue; const t = num(r[cT]); const nm = String(r[cO] ?? '').trim(); if (!(t > 0) && !nm) continue;
    const n = num(r[cN]), key = isFinite(n) ? 'b' + Math.floor((n - 1) / 10) : 'n' + nm; let b = blocks.get(key);
    if (!b) blocks.set(key, b = { blk: isFinite(n) ? Math.floor((n - 1) / 10) + 1 : blocks.size + 1, name: '', cycles: [] });
    if (nm && !b.name) b.name = nm; if (t > 0) b.cycles.push({ t: +t.toFixed(1), cat: catOf(r[cC]), note: String(cM >= 0 ? r[cM] ?? '' : '').trim() }); }
  const ops = [...blocks.values()].filter(b => b.cycles.length).map(b => { const nm = b.name || `Sin nombre (bloque ${b.blk})`; if (!b.name) warn.push(`El bloque ${b.blk} de CICLOS tiene ${b.cycles.length} tiempos pero no tiene nombre de operación.`);
    return { id: uid(), name: nm, ...splitName(b.name), on: true, cycles: b.cycles }; });
  if (!ops.length) throw new Error('La hoja CICLOS no trae tiempos capturados.');
  const few = ops.filter(o => o.cycles.length < 10).length; if (few) warn.push(`${few} de ${ops.length} operaciones tienen menos de 10 ciclos medidos.`);
  const trip = (String(fileName || '').match(/trip\w*\.?\s*([A-Za-z0-9]+)/i) || [])[1] || '';
  return { yz: { id: uid(), name: `${meta.linea || meta.familia || 'Yamazumi'}${trip ? ' · trip. ' + trip.toUpperCase() : ''}`, planta: meta.planta || '', linea: meta.linea || meta.familia || '', programa: meta.programa || '', trip: trip.toUpperCase(), turno: String(meta.turno || ''),
    fecha: meta.fecha || '', analista: meta.analista || '', takt: isFinite(meta.takt) ? meta.takt : 0, src: fileName || '', ops }, warn };
}
/* CSV libre: operacion, ciclo, segundos, categoria, comentario (y opcional takt) */
export function parseCsvOps(text, fileName) {
  const t = text.replace(/^﻿/, ''), first = t.split(/\r?\n/)[0] || '', sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : first.includes('\t') ? '\t' : ',';
  const rows = t.split(/\r?\n/).filter(l => l.trim()).map(l => { const o = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === sep) { o.push(cur); cur = ''; } else cur += ch; } o.push(cur); return o; });
  const H = rows[0].map(norm), col = (...n) => H.findIndex(h => n.some(x => h === x || h.startsWith(x)));
  const cO = col('operacion', 'operador', 'estacion'), cT = col('segundos', 'cycle time', 'tiempo', 'seg'), cC = col('categoria'), cM = col('comentario', 'observ'), cK = col('takt');
  if (cO < 0 || cT < 0) throw new Error('El CSV necesita las columnas "operacion" y "segundos".');
  const by = new Map(); let takt = 0;
  rows.slice(1).forEach(r => { const nm = String(r[cO] || '').trim(), s = num(r[cT]); if (!nm || !(s > 0)) return; if (!by.has(nm)) by.set(nm, { id: uid(), name: nm, ...splitName(nm), on: true, cycles: [] });
    by.get(nm).cycles.push({ t: +s.toFixed(1), cat: catOf(cC >= 0 ? r[cC] : 'va'), note: String(cM >= 0 ? r[cM] || '' : '').trim() }); if (cK >= 0 && num(r[cK]) > 0) takt = num(r[cK]); });
  if (!by.size) throw new Error('El CSV no trae renglones con operación y segundos.');
  const base = String(fileName || 'Yamazumi').replace(/\.[^.]+$/, '');
  return { yz: { id: uid(), name: base, planta: '', linea: base, programa: '', trip: '', turno: '', fecha: '', analista: '', takt, src: fileName || '', ops: [...by.values()] }, warn: [] };
}

export function statOf(o) { const c = o.cycles || [], n = c.length, E = o.els || []; if (!n) return { n: 0, mean: 0, min: 0, max: 0, sd: 0, cv: 0, by: {}, els: E.map(() => ({ n: 0, mean: 0, cv: 0 })), nCe: 0, need: null };
  const ts = c.map(x => +x.t || 0), mean = ts.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(ts.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0, by = {};
  const okE = x => E.length && Array.isArray(x.e) && x.e.length === E.length, ce = c.filter(okE);
  c.forEach(x => { if (okE(x)) x.e.forEach((t, k) => { const ct = E[k].cat || 'otro'; by[ct] = (by[ct] || 0) + (+t || 0) / n; }); else by[x.cat] = (by[x.cat] || 0) + (+x.t || 0) / n; });
  const els = E.map((_, k) => { const v = ce.map(x => +x.e[k] || 0), m = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0, d = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)) : 0; return { n: v.length, mean: m, cv: m ? d / m : 0 }; });
  // ciclos necesarios para ±5 % con 95 % de confianza: N' = (40·√(N·Σx² − (Σx)²) / Σx)²
  const sx = ts.reduce((a, b) => a + b, 0), sx2 = ts.reduce((a, b) => a + b * b, 0), need = n > 1 && sx > 0 ? Math.max(2, Math.ceil((40 * Math.sqrt(Math.max(0, n * sx2 - sx * sx)) / sx) ** 2)) : null;
  return { n, mean, min: Math.min(...ts), max: Math.max(...ts), sd, cv: mean ? sd / mean : 0, by, els, nCe: ce.length, need }; }
/* tiempo normal = promedio × calificación; tiempo estándar = normal × (1 + suplementos). Los suplementos de la operación mandan; si no, los del yamazumi. */
export function stdOf(o, Y) { const s = statOf(o), cal = +o.cal > 0 ? +o.cal : 100, sup = o.sup != null && o.sup !== '' ? +o.sup : (+Y?.sup || 0), tn = s.mean * cal / 100; return { s, cal, sup, tn, te: tn * (1 + sup / 100) }; }
const SUPC = '#b58cf0', TIPICOS = [{ n: 'Tomar pieza', cat: 'cd' }, { n: 'Cargar en el equipo', cat: 'cd' }, { n: 'Proceso', cat: 'va' }, { n: 'Inspeccionar', cat: 'insp' }, { n: 'Dejar pieza', cat: 'mov' }];

/* ---------- vista ---------- */
export function create(api) {
  const { svg, side, esc, fmtN, RO, flow } = api;
  const st = { cur: null, osel: null, sort: false, msg: [], fmsg: '' };
  const list = () => { const S = api.S(); if (!S) return []; if (!Array.isArray(S.yz)) S.yz = []; return S.yz; };
  const cur = () => { const L = list(); return L.find(y => y.id === st.cur) || L[0] || null; };
  const save = () => { api.save(); };
  const f1 = v => fmtN(v, 1);


  /* ---------- cronómetro de piso (celular): ciclo completo o por elementos, con su categoría ---------- */
  const PCSS = `#pcron{position:fixed;inset:0;z-index:90;background:#0b1016;color:#e7ebef;display:flex;flex-direction:column;font:15px/1.4 system-ui,'Segoe UI',sans-serif;padding:max(12px,env(safe-area-inset-top)) 14px max(14px,env(safe-area-inset-bottom));box-sizing:border-box}
#pcron .hd{display:flex;gap:10px;align-items:center}#pcron .hd b{flex:1;font-size:16px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#pcron button{font:inherit;color:inherit;background:#1b232c;border:1px solid #2a3542;border-radius:12px;padding:10px 14px;min-height:48px;cursor:pointer}
#pcron button:focus-visible{outline:3px solid #FFB020;outline-offset:2px}
#pcron .tm{font:700 64px/1.05 ui-monospace,Menlo,Consolas,monospace;text-align:center;margin:12px 0 2px;font-variant-numeric:tabular-nums}
#pcron .et{text-align:center;font:600 17px ui-monospace,Menlo,Consolas,monospace;color:#FFB020;min-height:22px}
#pcron .sub{text-align:center;color:#a9b3bd;font-size:13px;min-height:18px}
#pcron .cats,#pcron .els{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:10px 0}
#pcron .cats button{min-height:40px;padding:6px 10px;font-size:13px;border-radius:99px}
#pcron .cats button.on{color:#0b1016;font-weight:700}
#pcron .els span{font-size:12.5px;padding:5px 9px;border-radius:99px;border:1px solid #2a3542;color:#a9b3bd}
#pcron .els span.done{background:#1d2a36;color:#e7ebef}
#pcron .els span.now{border-color:#FFB020;background:#FFB020;color:#12181F;font-weight:700}
#pcron .lap{width:100%;min-height:120px;font-size:24px;font-weight:800;background:#FFB020;border-color:#FFB020;color:#12181F;border-radius:18px;margin:6px 0;line-height:1.2}
#pcron .row{display:flex;gap:8px}#pcron .row button{flex:1}
#pcron ol{flex:1;overflow:auto;margin:10px 0;padding:0;list-style:none;display:grid;gap:6px;align-content:start}
#pcron li{display:grid;grid-template-columns:34px 1fr auto 44px;gap:8px;align-items:center;background:#131b23;border-radius:10px;padding:6px 8px}
#pcron li i{width:12px;height:12px;border-radius:50%;display:inline-block;margin-right:6px}
#pcron li small{display:block;color:#a9b3bd;font-size:11.5px}
#pcron li button{min-height:40px;padding:4px 8px}
#pcron .save{background:#199e70;border-color:#199e70;color:#fff;font-weight:700}`;
  let PC = null;
  const pfmt = s => { const m = Math.floor(s / 60), x = s - m * 60; return (m ? m + ':' + String(Math.floor(x)).padStart(2, '0') : Math.floor(x)) + '.' + Math.floor((x % 1) * 10); };
  const buzz = () => { try { navigator.vibrate?.(30); } catch (_) {} };
  function pcOpen(op) { if (RO()) return; pcClose(); if (!document.getElementById('pcronCss')) { const s = document.createElement('style'); s.id = 'pcronCss'; document.head.appendChild(s); } document.getElementById('pcronCss').textContent = PCSS;
    PC = { op, els: (op.els || []).filter(x => x && x.n), split: [], laps: [], cat: 'va', t0: null, acc: 0, raf: 0, el: document.createElement('div') }; const el = PC.el; el.id = 'pcron'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Cronómetro de piso');
    el.innerHTML = `<div class="hd"><b>${esc(op.name)}</b><button data-p="x" aria-label="Cerrar sin guardar">Cerrar</button></div>
      <div class="tm" aria-live="off">0.0</div><div class="et"></div><div class="sub"></div>
      <div class="cats" role="group" aria-label="Categoría del siguiente ciclo">${CATS.filter(c => c.k !== 'otro').map(c => `<button data-c="${c.k}" style="border-color:${c.col}">${esc(c.name)}</button>`).join('')}</div>
      <div class="els" aria-label="Elementos de la operación"></div>
      <button class="lap" data-p="lap">Iniciar</button>
      <div class="row"><button data-p="pause">Pausa</button><button data-p="undo">Deshacer</button><button data-p="note">Nota</button></div>
      <ol></ol><div class="row"><button class="save" data-p="save">Guardar ciclos</button></div>`;
    document.body.appendChild(el); el.addEventListener('click', pcClick); pcPaint(); const tick = () => { if (!PC) return; pcTime(); PC.raf = requestAnimationFrame(tick); }; tick(); }
  const pcNow = () => PC.t0 == null ? PC.acc : PC.acc + (performance.now() - PC.t0) / 1000;
  const pcSplit = () => PC.split.reduce((a, b) => a + b, 0);
  const pcStarted = () => !(PC.t0 == null && !PC.acc && !PC.laps.length && !PC.split.length);
  function pcTime() { const el = PC.el.querySelector('.tm'); if (el) el.textContent = pfmt(pcNow()); const et = PC.el.querySelector('.et');
    if (et) et.textContent = PC.els.length && pcStarted() ? `${PC.els[PC.split.length]?.n || ''}: ${pfmt(Math.max(0, pcNow() - pcSplit()))} s` : ''; }
  function pcPaint() { const el = PC.el, n = PC.laps.length, EM = PC.els.length > 0, on = pcStarted(), mean = n ? PC.laps.reduce((a, b) => a + b.t, 0) / n : 0, Y = cur(), takt = +Y?.takt || 0;
    el.querySelector('.cats').hidden = EM; el.querySelector('.els').hidden = !EM;
    el.querySelectorAll('[data-c]').forEach(b => { const o = b.dataset.c === PC.cat, c = CATS.find(x => x.k === b.dataset.c); b.classList.toggle('on', o); b.style.background = o ? c.col : ''; b.setAttribute('aria-pressed', String(o)); });
    if (EM) el.querySelector('.els').innerHTML = PC.els.map((x, k) => `<span class="${k < PC.split.length ? 'done' : k === PC.split.length && on ? 'now' : ''}">${k + 1}. ${esc(x.n)}${k < PC.split.length ? ' · ' + f1(PC.split[k]) : ''}</span>`).join('');
    el.querySelector('.lap').textContent = !on ? (EM ? `Iniciar · ${PC.els[0].n}` : 'Iniciar') : PC.t0 == null ? 'Seguir' : EM ? `Terminó «${PC.els[PC.split.length].n}» (${PC.split.length + 1}/${PC.els.length})` : 'Vuelta · termina ciclo ' + (n + 1);
    el.querySelector('[data-p=pause]').textContent = PC.t0 == null && on ? 'Seguir' : 'Pausa';
    el.querySelector('[data-p=save]').textContent = n ? `Guardar ${n} ciclo${n === 1 ? '' : 's'}` : 'Guardar ciclos';
    const all = statOf({ cycles: (PC.op.cycles || []).concat(PC.laps) }), need = all.need == null ? '' : all.n >= all.need ? ' · muestra suficiente' : ` · faltan ${all.need - all.n} para ±5%`;
    el.querySelector('.sub').textContent = n ? `${n} ciclos · promedio ${pfmt(mean)} s${takt ? ' · ' + fmtN(mean / takt * 100, 0) + '% del takt' : ''}${need}` : EM ? 'Toca «Iniciar» al empezar; luego toca cada vez que termine un elemento. Al terminar el último se cierra el ciclo.' : 'Toca «Iniciar» al empezar el primer ciclo; luego «Vuelta» al terminar cada uno.';
    el.querySelector('ol').innerHTML = PC.laps.map((l, i) => { const c = CATS.find(x => x.k === l.cat) || CATS[7]; return `<li><b>${i + 1}</b><span><i style="background:${c.col}"></i>${esc(c.name)}${l.note ? ' · ' + esc(l.note) : ''}${l.e ? `<small>${l.e.map((t, k) => esc(PC.els[k]?.n || 'E' + (k + 1)) + ' ' + f1(t)).join(' · ')}</small>` : ''}</span><b>${pfmt(l.t)} s</b><button data-del="${i}" aria-label="Borrar ciclo ${i + 1}">×</button></li>`; }).reverse().join(''); }
  function pcClick(e) { const b = e.target.closest('button'); if (!b || !PC) return; const p = b.dataset.p, EM = PC.els.length > 0;
    if (b.dataset.c) { PC.cat = b.dataset.c; pcPaint(); return; }
    if (b.dataset.del !== undefined) { PC.laps.splice(+b.dataset.del, 1); pcPaint(); return; }
    if (p === 'lap') { if (!pcStarted()) { PC.t0 = performance.now(); pcPaint(); buzz(); return; }
      if (PC.t0 == null) { PC.t0 = performance.now(); pcPaint(); return; }
      if (EM) { const et = pcNow() - pcSplit(); if (et < .2) return; PC.split.push(+et.toFixed(1)); buzz();
        if (PC.split.length < PC.els.length) { pcPaint(); return; }
        const ev = PC.split, t = +ev.reduce((a, b2) => a + b2, 0).toFixed(1); let mk = 0; ev.forEach((v, k) => { if (v > ev[mk]) mk = k; });
        PC.laps.push({ t, cat: PC.els[mk].cat || 'va', note: '', e: ev }); PC.split = []; PC.acc = 0; PC.t0 = performance.now(); pcPaint(); return; }
      const t = pcNow(); if (t < .3) return; PC.laps.push({ t: +t.toFixed(1), cat: PC.cat, note: '' }); PC.acc = 0; PC.t0 = performance.now(); pcPaint(); buzz(); return; }
    if (p === 'pause') { if (PC.t0 != null) { PC.acc = pcNow(); PC.t0 = null; } else if (pcStarted()) PC.t0 = performance.now(); pcPaint(); return; }
    if (p === 'undo') { if (PC.split.length) { PC.split.pop(); pcPaint(); return; }
      const l = PC.laps.pop(); if (l) { PC.acc = l.t + pcNow(); if (PC.t0 != null) PC.t0 = performance.now(); PC.split = l.e ? l.e.slice(0, -1) : []; } pcPaint(); return; }
    if (p === 'note') { const l = PC.laps[PC.laps.length - 1]; if (!l) { alert('Primero registra un ciclo.'); return; } const v = prompt('Nota para el ciclo ' + PC.laps.length + ':', l.note || ''); if (v !== null) { l.note = v.trim(); pcPaint(); } return; }
    if (p === 'save') { if (!PC.laps.length) { alert('No hay ciclos completos registrados.'); return; } if (PC.split.length && !confirm('El ciclo en curso no está completo y no se guardará. ¿Guardar los demás?')) return;
      const op = PC.op; op.cycles = (op.cycles || []).concat(PC.laps); const n = PC.laps.length; save(); pcClose(); st.osel = op.id; st.msg = [`Se agregaron ${n} ciclos cronometrados en piso${EM ? ' por elementos' : ''}.`]; api.redraw(); return; }
    if (p === 'x') { if ((PC.laps.length || PC.split.length) && !confirm('¿Cerrar sin guardar los ciclos tomados?')) return; pcClose(); } }
  function pcClose() { if (!PC) return; cancelAnimationFrame(PC.raf); PC.el.remove(); PC = null; }
  function newYzPiso() { const nm = prompt('Nombre del yamazumi (línea o estación):', ''); if (!nm || !nm.trim()) return null; const tk = prompt('Takt en segundos (puedes dejarlo vacío):', ''); const tr = prompt('Tripulación (A, B, C…):', '') || '';
    const Y = { id: uid(), name: nm.trim(), planta: '', linea: nm.trim(), programa: '', trip: tr.trim().toUpperCase(), turno: '', fecha: new Date().toISOString().slice(0, 10), analista: 'Cronometrado en piso', takt: +String(tk || '').replace(',', '.') > 0 ? +String(tk).replace(',', '.') : 0, src: 'Captura en piso', ops: [] };
    list().push(Y); st.cur = Y.id; save(); return Y; }
  function newOpPiso(Y) { const nm = prompt('Nombre de la operación (por ejemplo «CERRADO FR LH Rosa»):', ''); if (!nm || !nm.trim()) return; const o = { id: uid(), name: nm.trim(), ...splitName(nm.trim()), on: true, cycles: [] }; Y.ops.push(o); st.osel = o.id; save(); api.redraw(true); pcOpen(o); }

  function draw() {
    const Y = cur(), o = [], fs = 13;
    if (!Y) { svg.innerHTML = `<rect x="0" y="0" width="900" height="420" rx="6" fill="#12181F"/><text x="450" y="200" text-anchor="middle" font-size="16" fill="#e7ebef">Aún no hay yamazumis de operaciones en este escenario</text><text x="450" y="228" text-anchor="middle" font-size="13" fill="#a9b3bd">Usa «Importar Excel o CSV» en el panel de la derecha (plantilla Yamazumi v5).</text>`; return { x: -16, y: -16, w: 932, h: 452 }; }
    let ops = Y.ops.filter(x => x.on !== false).map(x => ({ o: x, s: statOf(x), d: stdOf(x, Y) })); if (st.sort) ops = ops.slice().sort((a, b) => (st.std ? b.d.te - a.d.te : b.s.mean - a.s.mean));
    const takt = +Y.takt || 0, vmax = Math.max(takt * 1.15, ...ops.map(x => (st.std ? x.d.te : x.s.max) * 1.08), 1), raw = vmax / 5, p10 = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p10, step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p10, top = Math.ceil(vmax / step) * step;
    const slot = 86, W = Math.max(900, 90 + slot * Math.max(1, ops.length) + 30), H = 600, px = 70, py = 40, pw = W - px - 24, ph = H - py - 130, Yv = v => py + ph - (v / top) * ph;
    o.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#12181F" rx="6"/>`);
    for (let v = 0; v <= top + 1e-9; v += step) o.push(`<line x1="${px}" x2="${px + pw}" y1="${Yv(v)}" y2="${Yv(v)}" stroke="#26303b"/><text class="mono" x="${px - 8}" y="${Yv(v) + 4}" text-anchor="end" font-size="${fs - 1}" fill="#6c7783">${fmtN(v, 0)}</text>`);
    o.push(`<text transform="translate(18 ${py + ph / 2}) rotate(-90)" text-anchor="middle" font-size="${fs - 1}" fill="#a9b3bd">${st.std ? 'tiempo estándar (s)' : 'segundos por ciclo (promedio)'}</text>`);
    if (!ops.length) o.push(`<text x="${px + pw / 2}" y="${py + ph / 2}" text-anchor="middle" font-size="${fs}" fill="#a9b3bd">Ninguna operación marcada para este yamazumi</text>`);
    const sw = pw / Math.max(1, ops.length), bw = Math.min(46, sw * .6);
    ops.forEach((x, i) => { const cx = px + sw * i + sw / 2, bx = cx - bw / 2, s = x.s, on = st.osel === x.o.id; let acc = 0; const fct = st.std ? x.d.cal / 100 : 1, val = st.std ? x.d.te : s.mean, hi = st.std ? x.d.te : Math.max(s.max, s.mean);
      const tipB = `${x.o.name} · promedio ${f1(s.mean)} s (${takt ? fmtN(s.mean / takt * 100, 0) + '% del takt' : 'sin takt'}) · mín ${f1(s.min)} · máx ${f1(s.max)} · CV ${fmtN(s.cv * 100, 0)}% · ${s.n} ciclos · estándar ${f1(x.d.te)} s (calificación ${fmtN(x.d.cal, 0)}%, suplementos ${fmtN(x.d.sup, 0)}%)`;
      o.push(`<g data-o="${esc(x.o.id)}" style="cursor:pointer">`);
      CATS.forEach(C => { const v = (s.by[C.k] || 0) * fct; if (!v) return; const y0 = Yv(acc), y1 = Yv(acc + v); acc += v;
        o.push(`<rect x="${bx}" y="${y1}" width="${bw}" height="${Math.max(1, y0 - y1 - 1.5)}" fill="${C.col}" data-tip="${esc(`${x.o.name} · ${C.name}: ${f1(v)} s (${fmtN(v / Math.max(1e-9, s.mean) * 100, 0)}%)`)}"/>`); });
      if (st.std && x.d.te > x.d.tn + 1e-9) { const y0 = Yv(acc), y1 = Yv(x.d.te); o.push(`<rect x="${bx}" y="${y1}" width="${bw}" height="${Math.max(1, y0 - y1 - 1.5)}" fill="${SUPC}" data-tip="${esc(`${x.o.name} · suplementos ${fmtN(x.d.sup, 0)}%: ${f1(x.d.te - x.d.tn)} s`)}"/>`); acc = x.d.te; }
      if (!st.std && s.max > s.mean) o.push(`<rect x="${bx}" y="${Yv(s.max)}" width="${bw}" height="${Math.max(1, Yv(s.mean) - Yv(s.max) - 1.5)}" fill="#8d98a5" fill-opacity=".28" stroke="#8d98a5" stroke-dasharray="3 3" data-tip="${esc(`${x.o.name} · variación medida: máximo ${f1(s.max)} s (${f1(s.max - s.mean)} s sobre el promedio)`)}"/>`);
      if (on) o.push(`<rect x="${bx - 4}" y="${Yv(hi) - 4}" width="${bw + 8}" height="${Yv(0) - Yv(hi) + 8}" fill="none" stroke="#fff" stroke-width="2" rx="3"/>`);
      const over = takt && val > takt, near = takt && !over && !st.std && s.max > takt;
      o.push(`<text class="mono" x="${cx}" y="${Yv(hi) - 8}" text-anchor="middle" font-size="${fs}" font-weight="600" fill="${over ? '#ff5a4f' : near ? '#FFB020' : '#e7ebef'}">${over ? '▲ ' : ''}${takt ? fmtN(val / takt * 100, 0) + '%' : f1(val)}</text>`);
      o.push(`<rect x="${bx - 6}" y="${py}" width="${bw + 12}" height="${ph}" fill="transparent" data-tip="${esc(tipB)}"/>`);
      const l1 = x.o.est ? `${x.o.est} ${x.o.pos} ${x.o.lado}` : x.o.name, l2 = x.o.est ? x.o.oper : '';
      o.push(`<text transform="translate(${cx - 2} ${Yv(0) + 12}) rotate(55)" font-size="${fs - 2}" font-weight="600" fill="#e7ebef">${esc(l1.length > 22 ? l1.slice(0, 21) + '…' : l1)}</text>`);
      if (l2) o.push(`<text transform="translate(${cx - 16} ${Yv(0) + 12}) rotate(55)" font-size="${fs - 3}" fill="#a9b3bd">${esc(l2.length > 22 ? l2.slice(0, 21) + '…' : l2)}</text>`);
      o.push('</g>'); });
    if (takt) o.push(`<line x1="${px}" x2="${px + pw}" y1="${Yv(takt)}" y2="${Yv(takt)}" stroke="#ff5a4f" stroke-width="2" stroke-dasharray="7 4"/><text class="mono" x="${px + pw}" y="${Yv(takt) - 6}" text-anchor="end" font-size="${fs - 1}" fill="#e7ebef">Takt ${f1(takt)} s</text>`);
    o.push(`<line x1="${px}" x2="${px + pw}" y1="${Yv(0)}" y2="${Yv(0)}" stroke="#6c7783"/>`);
    o.push(`<text x="${px}" y="24" font-size="15" font-weight="600" fill="#e7ebef">${esc(Y.name)}</text><text x="${px + pw}" y="24" text-anchor="end" font-size="${fs - 1}" fill="#a9b3bd">${esc([Y.programa, Y.linea, Y.trip ? 'tripulación ' + Y.trip : '', Y.turno, Y.fecha, Y.analista].filter(Boolean).join(' · '))}</text>`);
    svg.innerHTML = o.join(''); return { x: -16, y: -16, w: W + 32, h: H + 32 };
  }


  /* ---------- estudio de tiempos de la operación seleccionada ---------- */
  const IST = 'background:var(--raise,#1b232c);border:1px solid var(--line,#27323e);border-radius:5px;color:inherit;padding:5px 6px;font:inherit;min-width:0;width:100%;box-sizing:border-box';
  function studyCard(o, Y, ro) { const d = stdOf(o, Y), s = d.s, E = o.els || [], dis = ro ? ' disabled' : '', need = s.need, ok = need != null && s.n >= need, takt = +Y.takt || 0;
    const fld = (k, v, ph) => `<input data-sf="${k}" type="number" min="0" step="1" value="${esc(v ?? '')}" placeholder="${esc(ph)}"${dis} style="${IST}">`;
    return `<div style="display:grid;gap:6px;margin:6px 0 8px;padding:8px;border:1px solid var(--line,#27323e);border-radius:6px">
      <b style="font-size:12.5px">Estudio de tiempos</b>
      <p style="margin:0">Tiempo normal <b>${f1(d.tn)} s</b> · estándar <b>${f1(d.te)} s</b>${takt ? ` (${fmtN(d.te / takt * 100, 0)}% del takt)` : ''}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><label class="vz-chk" style="display:grid;gap:3px" title="100 = ritmo normal; más de 100 si el operador trabajó más rápido de lo normal durante la toma">Calificación del ritmo (%)${fld('cal', o.cal, '100')}</label><label class="vz-chk" style="display:grid;gap:3px" title="Fatiga, necesidades personales y demoras inevitables">Suplementos (%)${fld('sup', o.sup, Y.sup ? 'del yamazumi: ' + Y.sup : 'p. ej. 12')}</label></div>
      <p style="margin:0;color:${need == null ? 'inherit' : ok ? '#3ddc97' : '#FFB020'}">${need == null ? 'Toma al menos 2 ciclos para saber cuántos hacen falta.' : ok ? `Muestra suficiente: ${s.n} ciclos (se necesitan ${need} para ±5% con 95% de confianza).` : `Faltan ${need - s.n} ciclos: se necesitan ${need} para ±5% con 95% de confianza (llevas ${s.n}).`}</p>
      <b style="font-size:12.5px;margin-top:4px">Elementos</b>
      ${E.length ? `<div style="display:grid;gap:4px">${E.map((el, k) => { const es = s.els[k]; return `<div style="display:grid;grid-template-columns:minmax(0,1fr) 96px 52px 24px;gap:4px;align-items:center"><input data-el="n" data-k="${k}" value="${esc(el.n)}"${dis} aria-label="Nombre del elemento ${k + 1}" style="${IST}"><select data-el="cat" data-k="${k}"${dis} aria-label="Categoría del elemento ${k + 1}" style="${IST}">${CATS.map(C => `<option value="${C.k}"${C.k === (el.cat || 'va') ? ' selected' : ''}>${esc(C.name)}</option>`).join('')}</select><span class="mono" style="text-align:right" title="${es && es.n ? `${es.n} tomas · CV ${fmtN(es.cv * 100, 0)}%` : 'sin tomas'}">${es && es.n ? f1(es.mean) + ' s' : '—'}</span>${ro ? '<span></span>' : `<button data-elx="${k}" aria-label="Quitar el elemento ${esc(el.n)}">×</button>`}</div>`; }).join('')}</div>
        <p style="margin:0">${s.nCe ? `${s.nCe} de ${s.n} ciclos desglosados por elemento; el yamazumi toma su categoría de cada elemento.` : 'Aún no hay ciclos desglosados: usa «Cronometrar en piso» y toca al terminar cada elemento.'}</p>`
        : '<p style="margin:0">Sin elementos, el cronómetro toma el ciclo completo. Define los pasos (tomar pieza, cargar, coser…) para ver cuál se lleva el tiempo.</p>'}
      ${ro ? '' : `<div class="vz-btns" style="margin:0"><button data-y="eladd">+ Elemento</button>${E.length ? '' : '<button data-y="eltip">Usar elementos típicos</button>'}</div>`}</div>`; }
  function drawSide() {
    const L = list(), Y = cur(), o = [], ro = RO();
    o.push(`<h5>Yamazumis de operaciones</h5>`);
    if (L.length) o.push(`<select data-y="pick" style="width:100%;background:var(--raise,#1b232c);border:1px solid var(--line,#27323e);border-radius:6px;color:inherit;padding:7px;font:inherit">${L.map(y => `<option value="${esc(y.id)}"${Y && y.id === Y.id ? ' selected' : ''}>${esc(y.name)}</option>`).join('')}</select>`);
    if (!ro) o.push(`<div class="vz-btns"><button data-y="pyz" title="Crear un yamazumi sin Excel y cronometrar en piso desde el celular">Nuevo en piso</button>${Y ? '<button data-y="pop" title="Agregar una operación y cronometrarla">Operación en piso</button>' : ''}</div>`);
    if (!ro) o.push(`<div class="vz-btns"><button class="prim" data-y="imp">Importar Excel o CSV</button>${Y ? '<button data-y="dup">Duplicar</button><button data-y="del">Eliminar</button>' : ''}</div><input type="file" accept=".xlsx,.csv,text/csv" hidden>`);
    if (st.msg.length) o.push(`<div class="vz-card" style="border-color:#FFB020"><div class="hd"><b>Avisos de la importación</b><button data-y="msgx" aria-label="Cerrar avisos">×</button></div>${st.msg.map(m => `<p>${esc(m)}</p>`).join('')}</div>`);
    if (Y) {
      const ops = Y.ops.filter(x => x.on !== false), S = ops.map(statOf), takt = +Y.takt || 0, sum = ops.reduce((t, x) => t + (st.std ? stdOf(x, Y).te : statOf(x).mean), 0), over = S.filter(s => takt && s.mean > takt).length, risk = S.filter(s => takt && s.mean <= takt && s.max > takt).length;
      const va = S.reduce((t, s) => t + (s.by.va || 0), 0), inp = (k, v, ph, w) => `<input data-yf="${k}" value="${esc(v ?? '')}" placeholder="${ph}"${ro ? ' disabled' : ''} style="background:var(--raise,#1b232c);border:1px solid var(--line,#27323e);border-radius:5px;color:inherit;padding:5px 6px;font:inherit;min-width:0;width:${w || '100%'};box-sizing:border-box">`;
      o.push(`<div class="vz-card" style="border-color:var(--line,#27323e);background:none"><label class="vz-chk" style="display:grid;gap:3px">Nombre${inp('name', Y.name, 'Nombre del yamazumi')}</label>
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px"><label class="vz-chk" style="display:grid;gap:3px">Tripulación${inp('trip', Y.trip, 'A, B…')}</label><label class="vz-chk" style="display:grid;gap:3px">Turno${inp('turno', Y.turno, 'Turno 1')}</label><label class="vz-chk" style="display:grid;gap:3px">Takt (s)${inp('takt', Y.takt || '', '130')}</label><label class="vz-chk" style="display:grid;gap:3px" title="Suplementos por fatiga y necesidades personales para todas las operaciones (cada operación puede tener los suyos)">Suplem. %${inp('sup', Y.sup || '', '12')}</label></div>
        <p>${esc([Y.programa, Y.linea, Y.fecha, Y.analista].filter(Boolean).join(' · '))}${Y.src ? '<br>Origen: ' + esc(Y.src) : ''}</p></div>`);
      o.push(`<div class="vz-tot">${ops.length} operaciones · suma ${f1(sum)} s${takt ? `<br>${fmtN(sum / takt, 2)} operadores teóricos · balance ${ops.length ? fmtN(sum / (ops.length * takt) * 100, 0) : 0}%` : ''}${sum ? `<br>Valor agregado ${fmtN(va / Math.max(1e-9, S.reduce((t, q) => t + q.mean, 0)) * 100, 0)}% del tiempo medido` : ''}${over ? `<br><span style="color:#ff5a4f">${over} sobre takt</span>` : ''}${risk ? `<br><span style="color:#FFB020">${risk} con máximo sobre takt</span>` : ''}</div>`);
      o.push(`<div class="vz-leg">${CATS.filter(C => S.some(s => s.by[C.k])).map(C => `<span><i style="background:${C.col}"></i>${esc(C.name)}</span>`).join('')}${st.std ? `<span><i style="background:${SUPC}"></i>Suplementos</span>` : '<span><i style="background:#8d98a5;opacity:.5"></i>Variación (máx − media)</span>'}</div>`);
      if (api.turnos?.()) { const tk = +Y.takt || 0, sm = Y.ops.filter(x => x.on !== false).reduce((t, x) => t + statOf(x).mean, 0); o.push(api.turnos().card(Y, tk ? sm / tk : 0)); }
      if (flow) { const A = flow.anim(), miss = A.filter(x => !x.o.link), nm = q => q.oper || flow.short(q), nx = q => { const t = flow.byId(q.next); return t && t.o.anim ? nm(t.o) : 'salida'; };
        o.push(`<div class="vz-card" style="border-color:var(--line,#27323e)"><div class="hd"><b>Animación en 3D</b><span>${A.length} de ${flow.MAX}</span></div><p>Elige con ▶ hasta ${flow.MAX} personas, de uno o varios yamazumis. A cada una dile dónde está (clic en el gemelo), si camina y a quién le entrega.</p>
          ${A.map(x => `<div class="vz-row" data-go="${esc(x.o.id)}" style="grid-template-columns:1fr auto 24px;cursor:pointer"><span><b>${esc(nm(x.o))}</b><small>${esc(x.o.oper ? flow.short(x.o) + ' · ' : '')}${x.o.link ? 'enlazada' : '<span style="color:#FFB020">sin enlazar</span>'}${x.o.walk ? ' · camina' : ''} → ${esc(nx(x.o))}</small></span><em></em><button data-anx="${esc(x.o.id)}" aria-label="Quitar de la animación">×</button></div>`).join('')}
          ${st.fmsg ? `<p style="color:#FFB020">${esc(st.fmsg)}</p>` : ''}
          <div class="vz-btns">${ro || !A.length ? '' : `<button data-y="flink">${miss.length ? `Enlazar en 3D (${miss.length})` : 'Volver a enlazar'}</button>`}<button class="prim" data-y="fgo"${A.length ? '' : ' disabled'}>Animar en 3D</button></div><div class="vz-btns"><button data-y="fana" title="Proyectar a un turno de 8 o 12 horas con paros, demanda y costo por minuto">Análisis de turno${A.length ? '' : ' (todo el yamazumi)'}</button></div></div>`); }
      const sel = Y.ops.find(x => x.id === st.osel);
      if (sel) { const s = statOf(sel);
        o.push(`<div class="vz-card"><div class="hd"><b>${esc(sel.name)}</b><button data-y="osx" aria-label="Quitar selección">×</button></div><p>Promedio ${f1(s.mean)} s · mín ${f1(s.min)} · máx ${f1(s.max)} · CV ${fmtN(s.cv * 100, 0)}% · ${s.n} ciclos</p>${studyCard(sel, Y, ro)}
          ${flow ? `<div style="display:grid;gap:6px;margin:6px 0 8px;padding:8px;border:1px solid var(--line,#27323e);border-radius:6px">
            <label class="vz-chk"><input type="checkbox" data-fa="anim"${sel.anim ? ' checked' : ''}${ro ? ' disabled' : ''}> Animar a esta persona en 3D</label>
            <label class="vz-chk"><input type="checkbox" data-fa="walk"${sel.walk ? ' checked' : ''}${ro ? ' disabled' : ''}> Camina para entregar la pieza</label>
            <label class="vz-chk" style="display:grid;gap:3px">Le entrega a<select data-fa="next"${ro ? ' disabled' : ''} style="background:var(--raise,#1b232c);border:1px solid var(--line,#27323e);border-radius:5px;color:inherit;padding:5px 6px;font:inherit;min-width:0;width:100%"><option value="">Salida de la línea (nadie)</option>${L.map(y => `<optgroup label="${esc(y.name)}">${y.ops.filter(q => q.id !== sel.id).map(q => `<option value="${esc(q.id)}"${q.id === sel.next ? ' selected' : ''}>${esc(q.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
            <p style="margin:0">Estación: ${sel.link ? (sel.link.oid != null ? 'enlazada a una figura del gemelo' : 'enlazada a un punto libre') + ` (${f1(sel.link.x)}, ${f1(sel.link.z)})` : 'sin enlazar'}</p>
            ${ro ? '' : `<div class="vz-btns" style="margin:0"><button data-y="flink1">${sel.link ? 'Cambiar estación' : 'Enlazar con clic'}</button>${sel.link ? '<button data-y="funlink">Quitar enlace</button>' : ''}</div>`}</div>` : ''}
          <div>${sel.cycles.map((c, i) => `<div class="vz-stop" style="grid-template-columns:22px 62px 1fr 24px;cursor:default" title="${esc([c.note, Array.isArray(c.e) ? c.e.map((t, k) => (sel.els?.[k]?.n || 'E' + (k + 1)) + ' ' + t + ' s').join(' · ') : ''].filter(Boolean).join(' — '))}"><b style="background:${(CATS.find(C => C.k === c.cat) || CATS[7]).col}">${i + 1}</b><input data-ct="${i}" type="number" min="0" step="0.1" value="${c.t}"${ro ? ' disabled' : ''} aria-label="Segundos del ciclo ${i + 1}"><select data-cc="${i}"${ro ? ' disabled' : ''} aria-label="Categoría del ciclo ${i + 1}">${CATS.map(C => `<option value="${C.k}"${C.k === c.cat ? ' selected' : ''}>${esc(C.name)}</option>`).join('')}</select>${ro ? '<span></span>' : `<button data-cx="${i}" aria-label="Borrar ciclo ${i + 1}">×</button>`}</div>${c.note ? `<p style="margin:0 0 4px 27px">${esc(c.note)}</p>` : ''}`).join('')}</div>
          ${ro ? '' : '<div class="vz-btns"><button class="prim" data-y="pcron">Cronometrar en piso</button><button data-y="cadd">Agregar ciclo</button></div>'}</div>`); }
      o.push(`<label class="vz-chk"><input type="checkbox" data-y="sort"${st.sort ? ' checked' : ''}> Ordenar de mayor a menor carga</label><label class="vz-chk"><input type="checkbox" data-y="std"${st.std ? ' checked' : ''}> Ver tiempo estándar (calificación y suplementos)</label><p>La casilla decide si la operación entra en este yamazumi; ▶ la agrega a la animación en 3D. Clic en un nombre para ver sus ciclos, su estación y a quién le entrega.</p>`);
      Y.ops.forEach(x => { const s = statOf(x), ov = takt && s.mean > takt;
        o.push(`<div class="vz-row${st.osel === x.id ? ' on' : ''}" data-oid="${esc(x.id)}" style="grid-template-columns:18px 1fr auto 26px;cursor:pointer"><input type="checkbox" data-on="${esc(x.id)}"${x.on !== false ? ' checked' : ''}${ro ? ' disabled' : ''} aria-label="Incluir ${esc(x.name)}"><span><b>${esc(x.est ? `${x.est} ${x.pos} ${x.lado}` : x.name)}</b><small>${esc(x.est ? x.oper + ' · ' : '')}${s.n} ciclos · ${f1(s.min)}–${f1(s.max)} s</small></span><em class="${ov ? 'over' : ''}">${takt ? fmtN(s.mean / takt * 100, 0) + '%' : f1(s.mean) + ' s'}</em>${flow ? `<button data-an="${esc(x.id)}" title="${x.anim ? 'Quitar de la animación' : 'Animar a esta persona en 3D'}" aria-label="${x.anim ? 'Quitar de la animación' : 'Animar en 3D'} ${esc(x.name)}" aria-pressed="${x.anim ? 'true' : 'false'}"${ro ? ' disabled' : ''} style="padding:0;min-width:24px;height:24px;border-radius:5px;border:1px solid ${x.anim ? '#FFB020' : 'var(--line,#27323e)'};background:${x.anim ? '#FFB020' : 'none'};color:${x.anim ? '#12181F' : 'inherit'};cursor:pointer">▶</button>` : ''}</div>`); });
      if (!ro) o.push(`<div class="vz-btns"><button data-y="new">Nuevo yamazumi con las marcadas</button></div>`);
    } else { if (api.turnos?.()) o.push(api.turnos().card(null, 0)); o.push('<p>Importa un archivo de la plantilla «Yamazumi v5» (hojas CONFIG y CICLOS) o un CSV con columnas operacion, segundos, categoria.</p>'); }
    side.innerHTML = o.join('');
  }

  async function importFile(file) {
    try { const isX = /\.xlsx$/i.test(file.name); const r = isX ? parseTemplate(await readXlsx(await file.arrayBuffer()), file.name) : parseCsvOps(await file.text(), file.name);
      const L = list(); let nm = r.yz.name, k = 2; while (L.some(y => y.name === nm)) nm = `${r.yz.name} (${k++})`; r.yz.name = nm;
      L.push(r.yz); st.cur = r.yz.id; st.osel = null; st.msg = r.warn; save(); api.redraw(true);
    } catch (e) { st.msg = ['No se pudo importar ' + file.name + ': ' + (e?.message || e)]; api.redraw(); }
  }
  function click(e) { const t = e.target.closest('[data-o]'); st.osel = t ? (st.osel === t.dataset.o ? null : t.dataset.o) : null; api.redraw(); }
  function sideClick(e) {
    const Y = cur(), b = e.target.closest('button'), y = b?.dataset.y;
    if (y === 'imp') { side.querySelector('input[type=file]').click(); return; }
    if (y === 'msgx') { st.msg = []; api.redraw(); return; }
    if (y === 'osx') { st.osel = null; api.redraw(); return; }
    if (y === 'pyz') { const Yn = newYzPiso(); if (Yn) { api.redraw(true); newOpPiso(Yn); } return; }
    if (y === 'pop' && Y) { newOpPiso(Y); return; }
    if (y === 'pcron' && Y) { const so = Y.ops.find(x => x.id === st.osel); if (so) pcOpen(so); return; }
    if (api.turnos?.()?.cardClick(b)) return;
    if (flow) {
      if (y === 'fana') { api.ana?.()?.open(flow.anim().length ? 'anim' : 'yz'); return; }
      if (y === 'fgo') { st.fmsg = flow.start() || ''; if (st.fmsg) api.redraw(); return; }
      if (y === 'flink') { const A = flow.anim(), m = A.filter(x => !x.o.link); flow.link((m.length ? m : A).map(x => x.o.id)); return; }
      if (y === 'flink1' && st.osel) { flow.link([st.osel]); return; }
      if (y === 'funlink' && st.osel) { flow.unlink(st.osel); api.redraw(); return; }
      if (b?.dataset.anx) { flow.toggle(b.dataset.anx, false); st.fmsg = ''; api.redraw(); return; }
      if (b?.dataset.an) { st.fmsg = flow.toggle(b.dataset.an); api.redraw(); return; }
      const go = e.target.closest('[data-go]'); if (go && !b) { const x = flow.byId(go.dataset.go); if (x) { st.cur = x.Y.id; st.osel = x.o.id; api.redraw(true); } return; }
    }
    if (!Y) return;
    if (y === 'dup' || y === 'new') { const c = JSON.parse(JSON.stringify(Y)); c.id = uid(); c.name = Y.name + (y === 'new' ? ' · selección' : ' (copia)'); if (y === 'new') c.ops = c.ops.filter(x => x.on !== false); const map = {}; c.ops.forEach(x => { const n = uid(); map[x.id] = n; x.id = n; x.on = true; x.anim = false; }); c.ops.forEach(x => { if (x.next) x.next = map[x.next] || ''; });
      list().push(c); st.cur = c.id; st.osel = null; save(); api.redraw(true); return; }
    if (y === 'del') { if (!confirm(`¿Eliminar el yamazumi «${Y.name}»? No se puede deshacer.`)) return; const L = list(); L.splice(L.indexOf(Y), 1); st.cur = null; st.osel = null; save(); api.redraw(true); return; }
    const sel = Y.ops.find(x => x.id === st.osel);
    const hasE = o => (o.cycles || []).some(c => Array.isArray(c.e) && c.e.length === (o.els || []).length);
    if (y === 'eladd' && sel) { if ((sel.els || []).length && hasE(sel) && !confirm('Los ciclos ya desglosados tienen otra cantidad de elementos: seguirán contando su tiempo total, pero sin desglose. ¿Agregar el elemento?')) return;
      const nm = prompt('Nombre del elemento (por ejemplo «Tomar pieza»):', ''); if (!nm || !nm.trim()) return; (sel.els = sel.els || []).push({ n: nm.trim(), cat: 'va' }); save(); api.redraw(); return; }
    if (y === 'eltip' && sel) { sel.els = TIPICOS.map(x => ({ ...x })); save(); api.redraw(); return; }
    if (b?.dataset.elx !== undefined && sel) { const k = +b.dataset.elx, E = sel.els || []; if (!E[k]) return;
      if (hasE(sel) && !confirm(`¿Quitar «${E[k].n}»? En los ciclos ya tomados su tiempo se suma al elemento ${k ? 'anterior' : 'siguiente'}.`)) return;
      (sel.cycles || []).forEach(c => { if (Array.isArray(c.e) && c.e.length === E.length) { if (c.e.length > 1) { const j = k ? k - 1 : 1; c.e[j] = +(c.e[j] + c.e[k]).toFixed(1); } c.e.splice(k, 1); if (!c.e.length) delete c.e; } });
      E.splice(k, 1); if (!E.length) delete sel.els; save(); api.redraw(); return; }
    if (y === 'cadd' && sel) { sel.cycles.push({ t: +statOf(sel).mean.toFixed(1) || 60, cat: 'va', note: '' }); save(); api.redraw(); return; }
    if (b?.dataset.cx !== undefined && sel) { sel.cycles.splice(+b.dataset.cx, 1); save(); api.redraw(); return; }
    const row = e.target.closest('[data-oid]'); if (row && !e.target.closest('input,select,button')) { st.osel = st.osel === row.dataset.oid ? null : row.dataset.oid; api.redraw(); }
  }
  function sideChange(e) {
    const t = e.target, Y = cur();
    if (t.type === 'file') { const f = t.files?.[0]; t.value = ''; if (f) importFile(f); return; }
    if (t.dataset.tu && api.turnos?.()?.cardChange(t)) { api.redraw(); return; }
    if (t.dataset.y === 'pick') { st.cur = t.value; st.osel = null; api.redraw(true); return; }
    if (t.dataset.y === 'sort') { st.sort = t.checked; api.redraw(); return; }
    if (t.dataset.y === 'std') { st.std = t.checked; api.redraw(); return; }
    if (!Y || RO()) return;
    if (t.dataset.yf) { const k = t.dataset.yf; Y[k] = k === 'takt' ? (num(t.value) > 0 ? num(t.value) : 0) : k === 'sup' ? (num(t.value) >= 0 ? num(t.value) : 0) : t.value.trim(); save(); api.redraw(); return; }
    if (t.dataset.fa && flow) { const x = Y.ops.find(q => q.id === st.osel); if (!x) return; const k = t.dataset.fa;
      if (k === 'anim') { st.fmsg = flow.toggle(x.id, t.checked); } else if (k === 'walk') { x.walk = t.checked; save(); } else if (k === 'next') { x.next = t.value; save(); } api.redraw(); return; }
    if (t.dataset.on) { const x = Y.ops.find(q => q.id === t.dataset.on); if (x) { x.on = t.checked; save(); api.redraw(true); } return; }
    const sel = Y.ops.find(x => x.id === st.osel); if (!sel) return;
    if (t.dataset.sf) { const v = t.value === '' ? NaN : num(t.value); if (v >= 0) sel[t.dataset.sf] = v; else delete sel[t.dataset.sf]; save(); api.redraw(); return; }
    if (t.dataset.el) { const E = sel.els || [], k = +t.dataset.k; if (!E[k]) return; if (t.dataset.el === 'n') E[k].n = t.value.trim() || E[k].n; else E[k].cat = t.value; save(); api.redraw(); return; }
    if (t.dataset.ct !== undefined) { const v = num(t.value); if (v > 0) { const c = sel.cycles[+t.dataset.ct]; c.t = +v.toFixed(1); delete c.e; } save(); api.redraw(); }
    else if (t.dataset.cc !== undefined) { sel.cycles[+t.dataset.cc].cat = t.value; save(); api.redraw(); }
  }
  return { pcOpen, pcClose, current: cur, draw, drawSide, click, sideClick, sideChange, importFile, title: () => 'Operaciones · ' + (cur()?.name || 'sin yamazumi'), state: () => ({ n: list().length, cur: cur()?.name || null, ops: cur()?.ops.length || 0, msg: st.msg }) };
}
