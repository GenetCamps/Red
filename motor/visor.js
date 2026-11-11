/* Red DAIMAY · Fase 4 · visor vectorial de espagueti y yamazumi (compartido por los 6 gemelos).
   Sustituye la imagen fija del reporte por un dibujo en vectores con zoom y paneo.
   No cambia datos ni cálculos: usa las mismas funciones del motor (buildPath, yamaOf, statsOf...).
   El <canvas id="repCv"> sigue existiendo, oculto, para "Descargar PNG". */
const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const INK = { t1: '#e7ebef', t2: '#a9b3bd', t3: '#6c7783', grid: '#26303b', crit: '#ff5a4f' };

const CSS = `
.rep-body.vz-on{padding:0;overflow:hidden;align-items:stretch;justify-content:stretch}
.rep-body.vz-on #repCv{display:none}
#vz{flex:1;display:flex;min-width:0;min-height:0;font-family:var(--f-body,'IBM Plex Sans',system-ui,sans-serif);color:var(--text,#e7ebef)}
.vz-main{flex:1;position:relative;min-width:0;min-height:0;background:#0b0f13;overflow:hidden}
.vz-main svg{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}
.vz-main svg.drag{cursor:grabbing}
.vz-main svg text{font-family:'IBM Plex Sans',system-ui,sans-serif;pointer-events:none}
.vz-main svg .mono{font-family:'IBM Plex Mono',ui-monospace,monospace}
.vz-main svg.far .vz-lab{display:none}
.vz-main svg [data-r]{cursor:pointer}
.vz-main svg.sel [data-r]:not(.on){opacity:.22}
.vz-tools{position:absolute;left:10px;top:10px;display:flex;gap:4px;align-items:center;background:rgba(14,19,24,.88);border:1px solid var(--line,#27323e);border-radius:8px;padding:4px}
.vz-tools button{background:var(--raise,#1b232c);border:1px solid var(--line,#27323e);border-radius:6px;color:inherit;min-width:32px;height:30px;padding:0 9px;font-size:13px;font-weight:600;cursor:pointer}
.vz-tools button:hover{border-color:var(--amber,#FFB020)}
.vz-tools span{font:11px 'IBM Plex Mono',ui-monospace,monospace;color:var(--dim,#a9b3bd);padding:0 6px;min-width:44px;text-align:center}
.vz-hint{position:absolute;right:10px;bottom:10px;font-size:11px;color:var(--dim,#a9b3bd);background:rgba(14,19,24,.8);border-radius:6px;padding:4px 8px;pointer-events:none}
.vz-scale{position:absolute;left:12px;bottom:12px;font:11px 'IBM Plex Mono',ui-monospace,monospace;color:#e7ebef;pointer-events:none}
.vz-scale i{display:block;height:6px;border:1.5px solid #e7ebef;border-top:0;margin-top:3px}
.vz-tip{position:absolute;z-index:3;max-width:300px;background:#0e1318;border:1px solid var(--line,#27323e);border-radius:6px;padding:6px 8px;font-size:12px;line-height:1.4;pointer-events:none;box-shadow:0 8px 22px rgba(0,0,0,.5)}
.vz-side{width:340px;flex:0 0 340px;overflow:auto;border-left:1px solid var(--line,#27323e);background:var(--panel-solid,#12181f);padding:12px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box}
.vz-side h5{margin:0;font-family:var(--f-display,'Barlow Condensed',Arial,sans-serif);font-size:17px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.vz-side p{margin:0;font-size:11.5px;color:var(--dim,#a9b3bd);line-height:1.45}
.vz-row{display:grid;grid-template-columns:14px 1fr auto;gap:8px;align-items:start;text-align:left;width:100%;background:var(--raise,#1b232c);border:1px solid var(--line,#27323e);border-radius:7px;padding:8px;color:inherit;cursor:pointer;font:inherit}
.vz-row:hover{border-color:var(--amber,#FFB020)}
.vz-row.on{border-color:var(--amber,#FFB020);box-shadow:inset 3px 0 0 var(--amber,#FFB020)}
.vz-row i{width:12px;height:12px;border-radius:3px;margin-top:3px}
.vz-row b{display:block;font-size:12.5px}
.vz-row small{display:block;font:11px 'IBM Plex Mono',ui-monospace,monospace;color:var(--dim,#a9b3bd);margin-top:2px}
.vz-row em{font:600 12px 'IBM Plex Mono',ui-monospace,monospace;font-style:normal;white-space:nowrap}
.vz-row em.over{color:#ff5a4f}
.vz-tot{border-top:1px solid var(--line,#27323e);padding-top:10px;font:600 13px 'IBM Plex Mono',ui-monospace,monospace}
.vz-card{border:1px solid var(--amber,#FFB020);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px;background:rgba(255,176,32,.06)}
.vz-card .hd{display:flex;gap:8px;align-items:center}
.vz-card .hd b{flex:1;font-size:13.5px}
.vz-card .hd button{background:none;border:0;color:var(--dim,#a9b3bd);font-size:18px;cursor:pointer;padding:0 4px}
.vz-el{display:grid;grid-template-columns:12px 1fr auto auto;gap:7px;align-items:center;width:100%;background:none;border:1px solid transparent;border-radius:5px;padding:3px 5px;color:inherit;font:inherit;font-size:12px;cursor:pointer;text-align:left}
.vz-el:hover{border-color:var(--line,#27323e)}
.vz-el.on{border-color:var(--amber,#FFB020);background:rgba(255,176,32,.1)}
.vz-el i{width:11px;height:11px;border-radius:2px}
.vz-el span{font:11px 'IBM Plex Mono',ui-monospace,monospace;color:var(--dim,#a9b3bd)}
.vz-go{background:var(--amber,#FFB020);color:#1a1205;border:0;border-radius:6px;padding:8px 10px;font-weight:700;font-size:12.5px;cursor:pointer}
.vz-go:hover{filter:brightness(1.1)}
.vz-leg{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11px;color:var(--dim,#a9b3bd)}
.vz-leg span{display:flex;gap:5px;align-items:center}
.vz-leg i{width:10px;height:10px;border-radius:2px}
#vzBack{position:fixed;z-index:40;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;gap:10px;align-items:center;background:#0e1318;border:1px solid #FFB020;border-radius:99px;padding:6px 6px 6px 14px;color:#e7ebef;font:12.5px 'IBM Plex Sans',system-ui,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.55);max-width:calc(100% - 24px)}
#vzBack span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#vzBack button{background:#FFB020;color:#1a1205;border:0;border-radius:99px;padding:7px 12px;font-weight:700;font-size:12.5px;cursor:pointer;white-space:nowrap}
.vz-main svg.edit{cursor:crosshair}
.vz-main svg [data-stop]{cursor:move}
.vz-btns{display:flex;gap:6px;flex-wrap:wrap}
.vz-btns button,.vz-cron .acts button{background:var(--raise,#1b232c);border:1px solid var(--line,#27323e);border-radius:6px;color:inherit;padding:7px 10px;font:600 12px 'IBM Plex Sans',system-ui,sans-serif;cursor:pointer}
.vz-btns button:hover,.vz-cron .acts button:hover{border-color:var(--amber,#FFB020)}
.vz-btns button:disabled{opacity:.4;cursor:default}
.vz-btns button.prim,.vz-cron .acts button.prim{background:var(--amber,#FFB020);border-color:var(--amber,#FFB020);color:#1a1205}
.vz-chk{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--dim,#a9b3bd)}
.vz-stop{display:grid;grid-template-columns:22px 1fr 84px 54px 24px;gap:5px;align-items:center;padding:3px;border:1px solid transparent;border-radius:5px;font-size:11.5px;cursor:pointer}
.vz-stop.on{border-color:var(--amber,#FFB020);background:rgba(255,176,32,.1)}
.vz-stop b{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;color:#0e1318}
.vz-stop span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vz-stop select,.vz-stop input{background:var(--raise,#1b232c);border:1px solid var(--line,#27323e);border-radius:4px;color:inherit;font:inherit;padding:3px 4px;min-width:0;width:100%;box-sizing:border-box}
.vz-stop button{background:none;border:0;color:var(--dim,#a9b3bd);cursor:pointer;font-size:15px;padding:0}
.vz-cron{position:absolute;inset:0;z-index:5;background:#0b0f13;display:flex;flex-direction:column;gap:10px;padding:12px;overflow:auto;box-sizing:border-box}
.vz-cron .hd{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.vz-cron .hd b{font-family:var(--f-display,'Barlow Condensed',Arial,sans-serif);font-size:20px;letter-spacing:.03em;flex:1;min-width:160px}
.vz-cron .hd span{font:600 15px 'IBM Plex Mono',ui-monospace,monospace}
.vz-cron .hd #vzcT{font-size:26px;color:var(--amber,#FFB020);min-width:76px;text-align:right}
.vz-pads{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.vz-pads button{display:flex;flex-direction:column;gap:6px;align-items:flex-start;min-height:92px;padding:12px;border-radius:10px;border:2px solid var(--line,#27323e);background:var(--raise,#1b232c);color:inherit;cursor:pointer;text-align:left;font:inherit;touch-action:manipulation}
.vz-pads button i{width:26px;height:6px;border-radius:3px}
.vz-pads button b{font-size:14px}
.vz-pads button em{font:600 20px 'IBM Plex Mono',ui-monospace,monospace;font-style:normal}
.vz-pads button.on{border-color:#fff;background:#243140;box-shadow:0 0 0 3px rgba(255,255,255,.12)}
.vz-cron .acts{display:flex;gap:6px;flex-wrap:wrap}
.vz-cron .acts button{padding:10px 12px;font-size:13px}
.vz-cron table{border-collapse:collapse;font:12px 'IBM Plex Mono',ui-monospace,monospace;width:100%;max-width:760px}
.vz-cron th,.vz-cron td{padding:4px 8px;border-bottom:1px solid var(--line,#27323e);text-align:right}
.vz-cron th:first-child,.vz-cron td:first-child{text-align:left}
.vz-cron tr.avg td{font-weight:700;color:var(--amber,#FFB020)}
.vz-cron p{margin:0;font-size:12px;color:var(--dim,#a9b3bd);line-height:1.45;max-width:760px}
@media (max-width:820px){ #vz{flex-direction:column} .vz-side{width:auto;flex:0 0 auto;max-height:42%;border-left:0;border-top:1px solid var(--line,#27323e)} .vz-hint{display:none} }
`;

export function init(ctx) {
  const { THREE, scene, D } = ctx;
  const body = document.querySelector('#report .rep-body');
  if (!body) return null;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  body.classList.add('vz-on');
  const root = document.createElement('div'); root.id = 'vz';
  root.innerHTML = `<div class="vz-main"><svg xmlns="${NS}" role="img"></svg>
    <div class="vz-tools"><button data-z="out" title="Alejar" aria-label="Alejar">−</button><span id="vzPct">100%</span><button data-z="in" title="Acercar" aria-label="Acercar">+</button><button data-z="fit" title="Ver todo">Ajustar</button><button data-z="svg" title="Descargar el dibujo en vectores">SVG</button></div>
    <div class="vz-scale" hidden><span></span><i></i></div>
    <div class="vz-hint">Rueda o pellizco: zoom · arrastrar: mover · clic: seleccionar</div>
    <div class="vz-tip" hidden></div></div><aside class="vz-side"></aside>`;
  body.appendChild(root);
  const main = root.querySelector('.vz-main'), svg = root.querySelector('svg'), side = root.querySelector('.vz-side');
  const tip = root.querySelector('.vz-tip'), scaleEl = root.querySelector('.vz-scale'), pctEl = root.querySelector('#vzPct');

  const state = { view: 'spag', S: null, over: null, sel: null, el: null, key: '', vb: null, home: null, metres: false, edit: null, snap: true };
  const RO = () => !!window.RD_RO;
  const world = e => { const r = main.getBoundingClientRect(), v = state.vb, { w, h } = size(); return [v.x + (e.clientX - r.left) / w * v.w, v.y + (e.clientY - r.top) / h * v.h]; };
  let drag = null, skipClick = false;

  /* ---------- vista: zoom y paneo sobre el viewBox ---------- */
  const size = () => { const r = main.getBoundingClientRect(); return { w: Math.max(50, r.width), h: Math.max(50, r.height) }; };
  function fitTo(b) {            // ajusta la caja al aspecto del área visible (sin franjas)
    const { w, h } = size(), a = w / h; let bw = b.w, bh = b.h;
    if (bw / bh < a) bw = bh * a; else bh = bw / a;
    return { x: b.x - (bw - b.w) / 2, y: b.y - (bh - b.h) / 2, w: bw, h: bh };
  }
  function applyView() {
    const v = state.vb; if (!v) return;
    svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    const { w } = size(), u = v.w / w;            // unidades del dibujo por pixel
    svg.querySelectorAll('.vz-k').forEach(g => { g.setAttribute('transform', `translate(${g.dataset.x} ${g.dataset.y}) rotate(${g.dataset.a || 0}) scale(${u})`); });
    svg.classList.toggle('far', state.metres && 1 / u < 3.2);
    pctEl.textContent = Math.round(state.home.w / v.w * 100) + '%';
    if (state.metres) { const target = 120 * u, p = Math.pow(10, Math.floor(Math.log10(target))), f = target / p, len = (f < 2 ? 1 : f < 5 ? 2 : 5) * p;
      scaleEl.hidden = false; scaleEl.querySelector('span').textContent = len >= 1 ? len + ' m' : (len * 100) + ' cm'; scaleEl.querySelector('i').style.width = (len / u) + 'px'; }
    else scaleEl.hidden = true;
  }
  function zoomAt(px, py, f) {
    const v = state.vb, { w, h } = size(); if (!v) return;
    const nw = Math.min(state.home.w * 1.6, Math.max(state.home.w / 80, v.w / f)), k = nw / v.w;
    const wx = v.x + px / w * v.w, wy = v.y + py / h * v.h;
    state.vb = { x: wx - px / w * nw, y: wy - py / h * v.h * k, w: nw, h: v.h * k }; applyView();
  }
  function fit() { if (state.home) { state.home = fitTo(state.box); state.vb = { ...state.home }; applyView(); } }
  svg.addEventListener('wheel', e => { e.preventDefault(); const r = main.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0016))); }, { passive: false });
  const ptrs = new Map(); let moved = 0, pinch0 = 0;
  svg.addEventListener('pointerdown', e => {
    const sp = state.edit && e.target.closest('[data-stop]');
    if (sp) { drag = { i: +sp.dataset.stop, el: sp, id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }; try { svg.setPointerCapture(e.pointerId); } catch (_) {} tip.hidden = true; e.preventDefault(); return; }
    ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  svg.addEventListener('pointermove', e => {
    if (drag && e.pointerId === drag.id) { drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY;
      if (drag.moved > 5) { const p = world(e); drag.el.dataset.x = p[0].toFixed(2); drag.el.dataset.y = p[1].toFixed(2); applyView(); } return; }
    const p = ptrs.get(e.pointerId); if (!p) { hover(e); return; }
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 5 && !svg.hasPointerCapture(e.pointerId)) { try { svg.setPointerCapture(e.pointerId); } catch (_) {} svg.classList.add('drag'); tip.hidden = true; }
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    const v = state.vb, { w, h } = size(); if (!v) return;
    if (ptrs.size === 1) { if (moved > 5) { state.vb = { ...v, x: v.x - dx / w * v.w, y: v.y - dy / h * v.h }; applyView(); } }
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = main.getBoundingClientRect();
      if (pinch0 > 0 && d > 0) zoomAt((a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top, d / pinch0); pinch0 = d; }
  });
  const up = e => {
    if (drag && e.pointerId === drag.id) { const d = drag; drag = null; skipClick = true; setTimeout(() => { skipClick = false; }, 60);
      if (e.type === 'pointerup' && d.moved > 5) moveStop(d.i, world(e)); else if (e.type === 'pointerup') { state.edit.sel = state.edit.sel === d.i ? -1 : d.i; redraw(); } else redraw();
      return; }
    ptrs.delete(e.pointerId); svg.classList.remove('drag'); };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  svg.addEventListener('dblclick', e => { if (state.edit) return; const r = main.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, 2); });
  svg.addEventListener('click', e => {
    if (skipClick || moved > 5) return;
    if (state.edit) { if (e.detail <= 1 && !e.target.closest('[data-stop]')) addStop(world(e)); return; }
    const t = e.target.closest('[data-r]');
    if (t) select(t.dataset.r, t.dataset.e || null); else if (state.sel) select(null);
  });
  function hover(e) {
    const t = e.target.closest('[data-tip]'); if (!t) { tip.hidden = true; return; }
    const r = main.getBoundingClientRect(); tip.textContent = t.dataset.tip; tip.hidden = false;
    const x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
    tip.style.left = Math.min(x, r.width - tip.offsetWidth - 8) + 'px'; tip.style.top = Math.min(y, r.height - tip.offsetHeight - 8) + 'px';
  }
  root.querySelector('.vz-tools').addEventListener('click', e => {
    const z = e.target.closest('button')?.dataset.z; if (!z) return; const { w, h } = size();
    if (z === 'in') zoomAt(w / 2, h / 2, 1.5); else if (z === 'out') zoomAt(w / 2, h / 2, 1 / 1.5); else if (z === 'fit') fit(); else if (z === 'svg') saveSvg();
  });
  new ResizeObserver(() => { if (!state.vb || root.offsetParent === null) return; const c = { x: state.vb.x + state.vb.w / 2, y: state.vb.y + state.vb.h / 2 }, { w, h } = size(), nh = state.vb.w * h / w;
    state.vb = { x: state.vb.x, y: c.y - nh / 2, w: state.vb.w, h: nh }; state.home = fitTo(state.box); applyView(); }).observe(main);

  function saveSvg() {
    const c = svg.cloneNode(true), b = state.box; c.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`); c.setAttribute('width', 1600); c.setAttribute('height', Math.round(1600 * b.h / b.w));
    c.removeAttribute('class'); c.querySelectorAll('image').forEach(n => n.remove());
    const u = b.w / 1600; c.querySelectorAll('.vz-k').forEach(g => g.setAttribute('transform', `translate(${g.dataset.x} ${g.dataset.y}) rotate(${g.dataset.a || 0}) scale(${u})`));
    const bg = document.createElementNS(NS, 'rect'); bg.setAttribute('x', b.x); bg.setAttribute('y', b.y); bg.setAttribute('width', b.w); bg.setAttribute('height', b.h); bg.setAttribute('fill', '#161b20'); c.insertBefore(bg, c.firstChild);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(c)], { type: 'image/svg+xml' }));
    a.download = `${state.view === 'yama' ? 'Yamazumi' : 'Espagueti'}_${ctx.id || 'planta'}_${String(state.S?.name || '').replace(/[^\w-]+/g, '_')}.svg`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /* ---------- utilidades de dibujo ---------- */
  const poly = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('');
  const runnerById = id => (state.S?.runners || []).find(r => r.id === id) || null;
  const typeName = r => ctx.TYPES?.[r.type]?.name || r.type || '';
  const buildings = () => D.buildings ? D.buildings.map(b => b.poly) : D.building ? [D.building] : [];

  /* ---------- espagueti ---------- */
  function drawSpag(S, over) {
    const B = ctx.reportBounds(S, over), o = [];
    state.metres = true;
    for (const t of (D.tiles || [])) { const im = ctx.TILE_IMG?.[t.f]; if (im && im.src) o.push(`<image href="${esc(im.src)}" x="${t.x0}" y="${t.z0}" width="${t.x1 - t.x0}" height="${t.z1 - t.z0}" preserveAspectRatio="none"/>`); }
    o.push(`<rect x="${B.x0}" y="${B.z0}" width="${B.x1 - B.x0}" height="${B.z1 - B.z0}" fill="rgba(14,19,24,.52)"/>`);
    buildings().forEach(p => o.push(`<path d="${poly(p)}Z" fill="none" stroke="rgba(231,235,239,.8)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`));
    // objetos eliminados, agregados y reubicados contra el plano
    const OB = ctx.OBJS, rp = ctx.rectPts;
    if (OB && rp) {
      (S.dels || []).forEach(id => { const ob = OB.get(id); if (!ob || ob.kind === 'op') return; const P = rp(ob.p, ob.l, ob.d, ob.a);
        o.push(`<path d="${poly(P)}Z M${P[0][0]} ${P[0][1]}L${P[2][0]} ${P[2][1]}M${P[1][0]} ${P[1][1]}L${P[3][0]} ${P[3][1]}" fill="none" stroke="rgba(255,90,90,.85)" stroke-width="1.2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" data-tip="Eliminado: ${esc(ob.name || id)}"/>`); });
      (S.adds || []).forEach(ad => { const s = OB.get(ad.src); if (!s) return; const off = (S.moves || {})[ad.id] || [0, 0, 0]; const P = rp([ad.p[0] + off[0], ad.p[1] + off[1]], s.l, s.d, s.a + (ad.a || 0) + off[2]);
        o.push(`<path d="${poly(P)}Z" fill="rgba(56,217,255,.55)" stroke="rgb(56,217,255)" stroke-width="1" vector-effect="non-scaling-stroke" data-tip="Agregado: ${esc(s.name || ad.src)}"/>`); });
      Object.entries(S.moves || {}).forEach(([id, off]) => { const ob = OB.get(id); if (!ob || ob.kind === 'op' || ob.added || (S.adds || []).some(a => a.id === id)) return;
        o.push(`<path d="${poly(rp(ob.p, ob.l, ob.d, ob.a))}Z" fill="none" stroke="rgba(255,176,32,.7)" stroke-width="1.2" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"/>`);
        o.push(`<path d="${poly(rp([ob.p[0] + off[0], ob.p[1] + off[1]], ob.l, ob.d, ob.a + off[2]))}Z" fill="rgba(255,176,32,.5)" data-tip="Reubicado: ${esc(ob.name || id)}"/>`); });
    }
    if (over) (over.runners || []).forEach(r => { const P = ctx.buildPath(r); if (P) o.push(`<path d="${poly(P.pts)}" fill="none" stroke="rgba(231,235,239,.55)" stroke-width="2.5" stroke-dasharray="9 7" stroke-linejoin="round" vector-effect="non-scaling-stroke" data-tip="${esc(over.name)} · ${esc(r.name)}"/>`); });
    // grosor por frecuencia: la ruta con más ciclos por hora es la más gruesa
    const cphMax = Math.max(1e-9, ...(S.runners || []).map(r => ctx.statsOf(r, S).cph || 0));
    const stopG = (r, sp, i, ed) => { const nm = ctx.stopName(sp, i), kd = ctx.stopKind ? ctx.stopKind(sp, i) : '', on = ed && state.edit.sel === i;
      return `<g class="vz-k" data-x="${sp.p[0]}" data-y="${sp.p[1]}"${ed ? ` data-stop="${i}"` : ''} data-tip="${esc(`${r.name} · parada ${i + 1}: ${nm}${kd ? ' · ' + kd : ''} · espera ${+sp.dwell || 0} s`)}">${on ? '<circle r="17" fill="none" stroke="#fff" stroke-width="2.5"/>' : ''}<circle r="${ed ? 12.5 : 10.5}" fill="${esc(r.color)}" stroke="#0e1318" stroke-width="2"/><text y="4.5" text-anchor="middle" font-size="13" font-weight="700" fill="#0e1318">${i + 1}</text>`
        + `<g class="vz-lab"><rect x="${ed ? 19 : 14}" y="-9" width="${nm.length * 6.6 + 12}" height="18" rx="3" fill="rgba(14,19,24,.85)"/><text x="${ed ? 25 : 20}" y="4" font-size="11.5" font-weight="600" fill="#e7ebef">${esc(nm)}</text></g></g>`; };
    (S.runners || []).forEach(r => {
      const ed = !!state.edit && state.edit.rid === r.id;
      const P = ctx.buildPath(r);
      if (!P) { if (ed) { o.push(`<g data-r="${esc(r.id)}" class="on">`); (r.stops || []).forEach((sp, i) => o.push(stopG(r, sp, i, true))); o.push('</g>'); } return; }
      const d = poly(P.pts), s = ctx.statsOf(r, S), sw = 2.5 + 4.5 * Math.min(1, (s.cph || 0) / cphMax);
      const tipR = `${r.name} · ${typeName(r)} · ${ctx.fmtN(s.len, 1)} m/ciclo · ciclo ${ctx.fmtMS(s.cycle)} · ${ctx.fmtN(s.cph, 1)} ciclos/h · ${ctx.fmtN(s.mph)} m/h`;
      o.push(`<g data-r="${esc(r.id)}" class="${state.sel === r.id ? 'on' : ''}">`);
      o.push(`<path d="${d}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="${(sw + 3).toFixed(1)}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`);
      o.push(`<path d="${d}" fill="none" stroke="${esc(r.color)}" stroke-width="${sw.toFixed(1)}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`);
      o.push(`<path d="${d}" fill="none" stroke="transparent" stroke-width="18" vector-effect="non-scaling-stroke" pointer-events="stroke" data-tip="${esc(tipR)}"/>`);
      for (let q = 11; q < P.len; q += 22) { const [x, z, a] = ctx.posAt({ P }, q); o.push(`<g class="vz-k" data-x="${x.toFixed(2)}" data-y="${z.toFixed(2)}" data-a="${(a * 180 / Math.PI).toFixed(1)}"><path d="M8 0L-5 -6L-2 0L-5 6Z" fill="${esc(r.color)}" stroke="#0e1318" stroke-width="1.4"/></g>`); }
      (r.stops || []).forEach((sp, i) => o.push(stopG(r, sp, i, ed)));
      o.push('</g>');
    });
    svg.innerHTML = o.join('');
    return { x: B.x0, y: B.z0, w: B.x1 - B.x0, h: B.z1 - B.z0 };
  }

  /* ---------- yamazumi: operadores lado a lado contra lo disponible / el ciclo objetivo ---------- */
  function drawYama(S, C) {
    state.metres = false;
    const ELEMS = ctx.ELEMS, ref = S.ref === 'ciclo' ? 'ciclo' : 'hora', fs = 13, fmtN = ctx.fmtN;
    const runners = S.runners || [];
    const names = [...new Set([...runners.map(r => r.name), ...(C ? (C.runners || []).map(r => r.name) : [])])];
    const val = (y, k) => ref === 'hora' ? (y.reqC !== null ? y.e[k] * y.reqC / 60 : null) : y.e[k] / y.loops / 60;
    const get = (Sx, n) => { const r = (Sx.runners || []).find(x => x.name === n); return r ? { r, y: ctx.yamaOf(r, Sx) } : null; };
    const cols = names.map(n => ({ n, a: C ? get(C, n) : null, b: get(S, n) }));
    let vmax = ref === 'hora' ? +(S.avail || 51) * 1.15 : 1;
    cols.forEach(c => [c.a, c.b].forEach(x => { if (!x) return; const tot = ELEMS.reduce((t, E) => t + (val(x.y, E.k) || 0), 0); vmax = Math.max(vmax, tot * 1.12); if (ref === 'ciclo' && x.y.pitch) vmax = Math.max(vmax, x.y.pitch * 1.15); }));
    const raw = vmax / 5, p10 = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p10, step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p10, top = Math.ceil(vmax / step) * step;
    const pair = !!C, slot = pair ? 150 : 120, W = Math.max(900, 90 + slot * Math.max(1, cols.length) + 30), H = 560;
    const px = 70, py = 34, pw = W - px - 24, ph = H - py - 70, Y = v => py + ph - (v / top) * ph, o = [];
    o.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#12181F" rx="6"/>`);
    for (let v = 0; v <= top + 1e-9; v += step) o.push(`<line x1="${px}" x2="${px + pw}" y1="${Y(v)}" y2="${Y(v)}" stroke="${INK.grid}"/><text class="mono" x="${px - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="${fs - 1}" fill="${INK.t3}">${fmtN(v, step < 1 ? 1 : 0)}</text>`);
    o.push(`<text transform="translate(18 ${py + ph / 2}) rotate(-90)" text-anchor="middle" font-size="${fs - 1}" fill="${INK.t2}">${ref === 'hora' ? 'minutos de trabajo por hora' : 'minutos por ciclo'}</text>`);
    if (!cols.length) o.push(`<text x="${px + pw / 2}" y="${py + ph / 2}" text-anchor="middle" font-size="${fs}" fill="${INK.t2}">Sin runners en el escenario</text>`);
    const sw = pw / Math.max(1, cols.length), bw = Math.min(pair ? 46 : 62, sw * (pair ? .36 : .56)), unit = ref === 'hora' ? 'min/h' : 'min/vuelta';
    const bar = (x, it, ghost) => {
      const y = it.y, rid = ghost ? '' : ` data-r="${esc(it.r.id)}"`; let acc = 0;
      if (ref === 'hora' && y.req === null) { const h = Y(0) - Y(top * .35);
        o.push(`<g${rid} data-tip="${esc(it.r.name)}: falta capturar entregas requeridas por hora"><rect x="${x}" y="${Y(top * .35)}" width="${bw}" height="${h}" fill="transparent" stroke="${INK.t3}" stroke-dasharray="4 4"/><text transform="translate(${x + bw / 2 + 4} ${Y(top * .175)}) rotate(-90)" text-anchor="middle" font-size="${fs - 2}" fill="${INK.t2}">captura entregas/h</text></g>`); return; }
      const segs = ELEMS.map(E => ({ E, v: val(y, E.k) || 0 })).filter(s => s.v > 0), tot = segs.reduce((t, s) => t + s.v, 0);
      o.push(`<g${rid}${!ghost && state.sel === it.r.id ? ' class="on"' : ''}${ghost ? ' opacity=".4"' : ''}>`);
      segs.forEach((sg, i) => { const y0 = Y(acc), y1 = Y(acc + sg.v); acc += sg.v; const h = Math.max(1, y0 - y1 - (i < segs.length - 1 ? 2 : 0));
        const src = sg.E.k === 'x' ? 'medido − modelo' : sg.E.k === 's' ? (S.allow || 0) + '% del tiempo normal' : y.src[sg.E.k] === 'MED' ? 'medido' : 'estimado';
        const tp = `${it.r.name}${ghost ? ' (' + (C?.name || '') + ')' : ''} · ${sg.E.name}: ${fmtN(sg.v, 1)} ${unit} (${fmtN(sg.v / Math.max(1e-9, tot) * 100, 0)}%) · ${src}`;
        const on = !ghost && state.sel === it.r.id && state.el === sg.E.k;
        o.push(`<rect${ghost ? '' : ` data-r="${esc(it.r.id)}" data-e="${sg.E.k}"`} x="${x}" y="${y1}" width="${bw}" height="${h}" fill="${sg.E.col}"${sg.E.hatch ? ' fill-opacity=".6" stroke="' + sg.E.col + '" stroke-dasharray="3 3"' : ''}${on ? ' stroke="#fff" stroke-width="2.5"' : ''} data-tip="${esc(tp)}"/>`);
        if (!ghost && y.src[sg.E.k] === 'MED' && sg.E.k !== 'x' && h > fs) o.push(`<text class="mono" x="${x + bw / 2}" y="${(y0 + y1) / 2 + 4}" text-anchor="middle" font-size="${fs - 2}" fill="#0e1318">M</text>`); });
      if (!ghost) {
        if (ref === 'ciclo' && y.pitch) o.push(`<line x1="${x - 7}" x2="${x + bw + 7}" y1="${Y(y.pitch)}" y2="${Y(y.pitch)}" stroke="${INK.t1}" stroke-width="2" stroke-dasharray="5 3"/>`);
        if (y.sat !== null) o.push(`<text class="mono" x="${x + bw / 2}" y="${Y(acc) - 7}" text-anchor="middle" font-size="${fs}" font-weight="600" fill="${y.sat > 1 ? INK.crit : INK.t1}">${y.sat > 1 ? '▲ ' : ''}${fmtN(y.sat * 100, 0)}%</text>`);
      }
      o.push('</g>');
    };
    cols.forEach((c, i) => { const cx = px + sw * i + sw / 2;
      if (pair) { if (c.a) bar(cx - bw - 3, c.a, true); if (c.b) bar(cx + 3, c.b, false); } else if (c.b) bar(cx - bw / 2, c.b, false);
      const it = c.b || c.a, nm = c.n.length > 17 ? c.n.slice(0, 16) + '…' : c.n;
      o.push(`<rect x="${cx - 5}" y="${Y(0) + 9}" width="10" height="10" rx="2" fill="${esc(it.r.color)}"/><text x="${cx}" y="${Y(0) + 36}" text-anchor="middle" font-size="${fs - 1}" font-weight="600" fill="${INK.t1}">${esc(nm)}</text><text class="mono" x="${cx}" y="${Y(0) + 52}" text-anchor="middle" font-size="${fs - 2}" fill="${INK.t3}">${ctx.fmtMS(it.y.perV)}/v</text>`); });
    if (ref === 'hora') { const av = +(S.avail || 51);
      o.push(`<line x1="${px}" x2="${px + pw}" y1="${Y(av)}" y2="${Y(av)}" stroke="${INK.crit}" stroke-width="2" stroke-dasharray="7 4"/><text class="mono" x="${px + pw}" y="${Y(av) - 6}" text-anchor="end" font-size="${fs - 1}" fill="${INK.t1}">Disponible ${fmtN(av, 0)} min/h = 100%</text>`); }
    o.push(`<line x1="${px}" x2="${px + pw}" y1="${Y(0)}" y2="${Y(0)}" stroke="${INK.t3}"/>`);
    svg.innerHTML = o.join('');
    return { x: -16, y: -16, w: W + 32, h: H + 32 };
  }

  /* ---------- panel lateral ---------- */
  function drawSide() {
    const S = state.S, over = state.over, fmtN = ctx.fmtN, fmtMS = ctx.fmtMS, rs = S.runners || [], o = [];
    const sel = runnerById(state.sel), er = editR();
    if (er) { const E = state.edit, KINDS = [['carga', 'Carga'], ['descarga', 'Descarga'], ['cambio', 'Intercambio'], ['otro', 'Otro']];
      o.push(`<div class="vz-card"><div class="hd"><i style="width:13px;height:13px;border-radius:3px;background:${esc(er.color)}"></i><b>Editando ruta · ${esc(er.name)}</b></div>
        <p>Clic en el plano: agrega una parada ${E.sel >= 0 ? 'después de la ' + (E.sel + 1) : 'al final'}. Arrastra un número para moverlo. Clic en un número lo selecciona; <b>Supr</b> lo borra y <b>Ctrl+Z</b> deshace.</p>
        <label class="vz-chk"><input type="checkbox" data-snap="1"${state.snap ? ' checked' : ''}> Ajustar al pasillo más cercano</label>
        <div>${(er.stops || []).map((s, i) => `<div class="vz-stop${E.sel === i ? ' on' : ''}" data-si="${i}"><b style="background:${esc(er.color)}">${i + 1}</b><span title="${esc(ctx.stopName(s, i))}">${esc(ctx.stopName(s, i))}</span><select data-sk="${i}" aria-label="Tipo de parada ${i + 1}">${KINDS.map(([k, n]) => `<option value="${k}"${ctx.stopKind(s, i) === k ? ' selected' : ''}>${n}</option>`).join('')}</select><input data-sd="${i}" type="number" min="0" max="3600" step="5" value="${+s.dwell || 0}" title="Espera en segundos" aria-label="Espera de la parada ${i + 1} en segundos"><button data-sx="${i}" aria-label="Borrar parada ${i + 1}">×</button></div>`).join('') || '<p>Sin paradas: haz clic en el plano donde inicia la ruta.</p>'}</div>
        <div class="vz-btns"><button data-ed="undo"${E.undo.length ? '' : ' disabled'}>Deshacer${E.undo.length ? ' (' + E.undo.length + ')' : ''}</button><button class="prim" data-ed="done">Terminar</button></div></div>`); }
    else if (sel) { const y = ctx.yamaOf(sel, S), s = ctx.statsOf(sel, S), tot = ctx.ELEMS.reduce((t, E) => t + (y.e[E.k] || 0), 0);
      o.push(`<div class="vz-card"><div class="hd"><i style="width:13px;height:13px;border-radius:3px;background:${esc(sel.color)}"></i><b>${esc(sel.name)} · ${esc(typeName(sel))}</b><button data-x="1" aria-label="Quitar selección">×</button></div>
        <p>${s.n} paradas · ${fmtN(s.len, 1)} m por circuito · ciclo ${fmtMS(y.perV)} por vuelta${y.sat !== null ? ' · carga ' + fmtN(y.sat * 100, 0) + '%' : ''}</p>
        <div>${ctx.ELEMS.filter(E => (y.e[E.k] || 0) > 0).map(E => `<button class="vz-el${state.el === E.k ? ' on' : ''}" data-el="${E.k}"><i style="background:${E.col}"></i>${esc(E.name)}<span>${fmtMS(y.e[E.k])}</span><span>${fmtN(y.e[E.k] / Math.max(1e-9, tot) * 100, 0)}%</span></button>`).join('')}</div>
        <button class="vz-go" data-go="1">Ver en 3D${state.el ? ' · ' + esc(ctx.ELEMS.find(E => E.k === state.el)?.name || '') : ''}</button>
        <div class="vz-btns">${!RO() && state.view !== 'yama' ? '<button data-ed="start">Editar ruta</button>' : ''}<button data-cron="1">Cronometrar${(sel.cron?.laps?.length) ? ' (' + sel.cron.laps.length + ')' : ''}</button></div></div>`); }
    if (state.view === 'yama') {
      const T = ctx.yamaTotals(S);
      o.push(`<h5>Yamazumi · ${T.ref === 'ciclo' ? 'ciclo objetivo' : 'carga por hora'}</h5><div class="vz-leg">${ctx.ELEMS.map(E => `<span><i style="background:${E.col}"></i>${esc(E.name)}</span>`).join('')}</div>`);
      rs.forEach(r => { const y = ctx.yamaOf(r, S);
        o.push(`<button class="vz-row${state.sel === r.id ? ' on' : ''}" data-rid="${esc(r.id)}"><i style="background:${esc(r.color)}"></i><span><b>${esc(r.name)}</b><small>${fmtMS(y.perV)}/vuelta · ${y.req !== null ? fmtN(y.req, 1) + ' req/h' : 'sin demanda'} · cap ${fmtN(y.capV, 1)}/h</small></span><em class="${y.sat !== null && y.sat > 1 ? 'over' : ''}">${y.sat !== null ? fmtN(y.sat * 100, 0) + '%' : '—'}</em></button>`); });
      o.push(`<div class="vz-tot">${T.ref === 'hora' ? `Carga ${fmtN(T.load, 1)} min/h · ${fmtN(T.need, 2)} personas` : `${T.n} runners`}${T.over ? ` · <span style="color:#ff5a4f">${T.over} sobre 100%</span>` : ''}</div>`);
      if (over) o.push(`<p>Barras tenues: ${esc(over.name)}.</p>`);
    } else {
      const tot = ctx.totals(S);
      o.push(`<h5>Diagrama de espagueti</h5><p>${esc(S.name)} · distancias en metros reales sobre el plano.</p>`);
      rs.forEach(r => { const s = ctx.statsOf(r, S), ro = over && (over.runners || []).find(x => x.name === r.name), so = ro && ctx.statsOf(ro, over), dm = so ? s.mph - so.mph : 0;
        const cmp = !over ? '' : so ? `<small style="color:${dm <= 0 ? '#3FB27F' : '#FF6B5C'}">contra ${esc(over.name)}: ${dm > 0 ? '+' : ''}${fmtN(dm)} m/h · ${s.len - so.len > 0 ? '+' : ''}${fmtN(s.len - so.len, 1)} m por ciclo</small>` : `<small>no existe en ${esc(over.name)}</small>`;
        o.push(`<button class="vz-row${state.sel === r.id ? ' on' : ''}" data-rid="${esc(r.id)}"><i style="background:${esc(r.color)}"></i><span><b>${esc(r.name)} · ${esc(typeName(r))}</b><small>${s.n} paradas · ${fmtN(s.len, 1)} m · ciclo ${fmtMS(s.cycle)} · ${fmtN(s.cph, 1)}/h</small>${cmp}</span><em>${fmtN(s.mph)} m/h</em></button>`); });
      o.push('<p>El grosor de cada ruta es proporcional a sus ciclos por hora.</p>');
      o.push(`<div class="vz-tot">Total ${fmtN(tot.mph)} m/h · ${fmtN(tot.mph * (+(S.shiftH || 12)) / 1000, 1)} km/turno</div>`);
      if (over) { const to = ctx.totals(over), d = tot.mph - to.mph; o.push(`<p>Punteado: ${esc(over.name)} (${fmtN(to.mph)} m/h).<br><b style="color:${d <= 0 ? '#3FB27F' : '#FF6B5C'}">Diferencia ${d > 0 ? '+' : ''}${fmtN(d)} m/h${to.mph ? ' (' + (d > 0 ? '+' : '') + fmtN(d / to.mph * 100, 1) + '%)' : ''}</b></p>`); }
      const mv = Object.keys(S.moves || {}).length; if (mv) o.push(`<p style="color:#FFB020">${mv} objetos reubicados contra el plano (ámbar).</p>`);
    }
    if (!rs.length) o.push('<p>Este escenario no tiene runners. Agrega uno en la vista de ingeniería para ver su ruta y su yamazumi.</p>');
    side.innerHTML = o.join('');
  }
  side.addEventListener('click', e => {
    const row = e.target.closest('.vz-stop');
    if (row && state.edit && !e.target.closest('select,input,button')) { const i = +row.dataset.si; state.edit.sel = state.edit.sel === i ? -1 : i; redraw(); return; }
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ed === 'start') startEdit(state.sel);
    else if (b.dataset.ed === 'done') endEdit();
    else if (b.dataset.ed === 'undo') undo();
    else if (b.dataset.sx) delStop(+b.dataset.sx);
    else if (b.dataset.cron) cronOpen(runnerById(state.sel));
    else if (b.dataset.rid) { if (state.edit) endEdit(); select(state.sel === b.dataset.rid ? null : b.dataset.rid); }
    else if (b.dataset.x) select(null);
    else if (b.dataset.el) { state.el = state.el === b.dataset.el ? null : b.dataset.el; redraw(); }
    else if (b.dataset.go) show3D(runnerById(state.sel), state.el);
  });
  side.addEventListener('change', e => {
    const t = e.target, r = editR();
    if (t.dataset.snap) { state.snap = t.checked; return; }
    if (!r) return;
    if (t.dataset.sk !== undefined) { pushUndo(r); r.stops[+t.dataset.sk].kind = t.value; commit(); }
    else if (t.dataset.sd !== undefined) { pushUndo(r); r.stops[+t.dataset.sd].dwell = Math.max(0, +t.value || 0); commit(); }
  });
  function select(id, el) { state.sel = id || null; state.el = id ? (el || null) : null; redraw(); }

  /* ---------- trazo de rutas en 2D ---------- */
  function editR() { return state.edit ? runnerById(state.edit.rid) : null; }
  function pushUndo(r) { const u = state.edit.undo; u.push(JSON.stringify(r.stops || [])); if (u.length > 80) u.shift(); }
  function commit() { try { ctx.changed('runners'); } catch (e) { console.warn('visor: no se pudo guardar la ruta', e); } redraw(); }
  function snap(p) {              // lleva el punto al pasillo marcado más cercano (2.5 m); si no hay, al piso libre más cercano
    const q = [+p[0].toFixed(2), +p[1].toFixed(2)], N = ctx.NAV; if (!state.snap || !N || !ctx.navW) return q;
    const [i, j] = ctx.navCell(q), R = Math.max(1, Math.round(2.5 / N.c)); let best = null, bd = 1e9;
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) if (ctx.navW(i + di, j + dj) === 2) { const d = di * di + dj * dj; if (d < bd) { bd = d; best = [i + di, j + dj]; } }
    if (!best && !ctx.navW(i, j)) best = ctx.navNearest(i, j, Math.round(6 / N.c));
    if (!best) return q;
    const c = ctx.navCenter(best[1] * N.nx + best[0]); return [+c[0].toFixed(2), +c[1].toFixed(2)];
  }
  function startEdit(id) { const r = runnerById(id); if (!r || RO()) return; state.view = 'spag'; state.edit = { rid: r.id, sel: -1, undo: [] }; state.sel = r.id; state.el = null; redraw(); }
  function endEdit() { state.edit = null; redraw(); }
  function addStop(p) { const r = editR(); if (!r) return; pushUndo(r); r.stops = r.stops || [];
    const at = state.edit.sel >= 0 ? state.edit.sel + 1 : r.stops.length;
    r.stops.splice(at, 0, { p: snap(p), dwell: ctx.TYPES?.[r.type]?.dwell ?? 0, seg: 'aisle', label: '' }); state.edit.sel = at; commit(); }
  function moveStop(i, p) { const r = editR(); if (!r || !r.stops[i]) return; pushUndo(r); r.stops[i].p = snap(p); state.edit.sel = i; commit(); }
  function delStop(i) { const r = editR(); if (!r || !r.stops[i]) return; pushUndo(r); r.stops.splice(i, 1); state.edit.sel = Math.min(state.edit.sel, r.stops.length - 1); commit(); }
  function undo() { const r = editR(); if (!r || !state.edit.undo.length) return; r.stops = JSON.parse(state.edit.undo.pop()); state.edit.sel = Math.min(state.edit.sel, r.stops.length - 1); commit(); }
  addEventListener('keydown', e => {
    if (!state.edit || document.querySelector('#report')?.hidden || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName || '')) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.edit.sel >= 0) { e.preventDefault(); delStop(state.edit.sel); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if (e.key === 'Escape') { e.preventDefault(); endEdit(); }
  });

  /* ---------- captura de tiempos: cronómetro de un toque por elemento ---------- */
  const CK = ['tc', 'tv', 'c', 'd', 'o'];
  let cron = null;
  const zero = () => ({ tc: 0, tv: 0, c: 0, d: 0, o: 0 });
  const sumL = l => CK.reduce((t, k) => t + (+l[k] || 0), 0);
  const elemOf = k => ctx.ELEMS.find(E => E.k === k) || { name: k, col: '#888' };
  function cronOpen(r) {
    if (!r) return; cronClose();
    cron = { rid: r.id, laps: (r.cron?.laps || []).map(l => ({ ...zero(), ...l })), cur: zero(), active: null, t0: 0, el: document.createElement('div') };
    cron.el.className = 'vz-cron'; main.appendChild(cron.el);
    cron.el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.k) cronTap(b.dataset.k);
      else if (b.dataset.c === 'lap') cronLap(); else if (b.dataset.c === 'drop') { cron.cur = zero(); cron.active = null; cronRender(); }
      else if (b.dataset.c === 'del') { cron.laps.pop(); cronKeep(); cronRender(); }
      else if (b.dataset.c === 'apply') cronApply(); else if (b.dataset.c === 'exp') cronExport();
      else if (b.dataset.c === 'imp') cron.el.querySelector('input[type=file]').click(); else if (b.dataset.c === 'close') cronClose(); });
    cron.el.addEventListener('change', e => { const f = e.target.files?.[0]; if (f) f.text().then(cronImport); e.target.value = ''; });
    cron.timer = setInterval(cronTick, 200); cronRender();
  }
  function cronClose() { if (!cron) return; clearInterval(cron.timer); cron.el.remove(); cron = null; redraw(); }
  function cronFlush() { if (cron.active) { const n = performance.now(); cron.cur[cron.active] += (n - cron.t0) / 1000; cron.t0 = n; } }
  function cronTap(k) { cronFlush(); if (cron.active === k) cron.active = null; else { cron.active = k; cron.t0 = performance.now(); } cronRender(); }
  function cronLap() { cronFlush(); cron.active = null; if (sumL(cron.cur) > 0.5) { const l = {}; CK.forEach(k => l[k] = +cron.cur[k].toFixed(1)); cron.laps.push(l); cronKeep(); } cron.cur = zero(); cronRender(); }
  function cronKeep() { const r = runnerById(cron.rid); if (!r || RO()) return; r.cron = { laps: cron.laps.slice(-60), t: new Date().toISOString().slice(0, 10) }; try { ctx.changed('meta'); } catch (_) {} }
  function cronAvg() { const a = zero(), n = cron.laps.length; if (n) CK.forEach(k => a[k] = cron.laps.reduce((t, l) => t + (+l[k] || 0), 0) / n); return a; }
  function cronTick() { if (!cron) return; const live = { ...cron.cur }; if (cron.active) live[cron.active] += (performance.now() - cron.t0) / 1000;
    cron.el.querySelectorAll('.vz-pads button').forEach(b => { b.querySelector('em').textContent = ctx.fmtMS(live[b.dataset.k]); });
    const t = cron.el.querySelector('#vzcT'); if (t) t.textContent = ctx.fmtMS(sumL(live)); }
  function cronRender() {
    const r = runnerById(cron.rid); if (!r) { cronClose(); return; } const a = cronAvg(), n = cron.laps.length, f = v => ctx.fmtN(v, 1);
    cron.el.innerHTML = `<div class="hd"><b>Cronómetro · ${esc(r.name)}</b><span>Ciclo ${n + 1}</span><span id="vzcT">0:00</span><div class="acts"><button data-c="close">Cerrar</button></div></div>
      <p>Toca el elemento que el operador empieza a hacer; al tocar otro se cierra el anterior. Tocar el mismo lo pausa. <b>Fin de ciclo</b> guarda la vuelta completa (un circuito de la ruta).</p>
      <div class="vz-pads">${CK.map(k => { const E = elemOf(k); return `<button data-k="${k}" class="${cron.active === k ? 'on' : ''}"><i style="background:${E.col}"></i><b>${esc(E.name)}</b><em>0:00</em></button>`; }).join('')}</div>
      <div class="acts"><button class="prim" data-c="lap">Fin de ciclo</button><button data-c="drop">Descartar ciclo en curso</button>${n ? '<button data-c="del">Borrar último ciclo</button>' : ''}</div>
      ${n ? `<table><thead><tr><th>Ciclo</th>${CK.map(k => `<th>${esc(elemOf(k).name)}</th>`).join('')}<th>Total s</th></tr></thead><tbody>${cron.laps.map((l, i) => `<tr><td>${i + 1}</td>${CK.map(k => `<td>${f(+l[k] || 0)}</td>`).join('')}<td>${f(sumL(l))}</td></tr>`).join('')}<tr class="avg"><td>Promedio (${n})</td>${CK.map(k => `<td>${f(a[k])}</td>`).join('')}<td>${f(sumL(a))}</td></tr></tbody></table>` : '<p>Aún no hay ciclos cronometrados.</p>'}
      <div class="acts">${n && !RO() ? '<button class="prim" data-c="apply">Aplicar promedio al yamazumi</button>' : ''}${n ? '<button data-c="exp">Exportar CSV</button>' : ''}<button data-c="imp">Importar CSV</button><input type="file" accept=".csv,text/csv,text/plain" hidden></div>
      <p>CSV: columnas <b>ciclo, elemento, segundos</b> (y opcional <b>runner</b>). El elemento puede ir por nombre o por clave: tc, tv, c, d, o. Sin columna de ciclo, todo se toma como un solo ciclo promedio.</p>`;
    cronTick();
  }
  function cronApply() {
    const r = runnerById(cron.rid); if (!r || !cron.laps.length || RO()) return; const a = cronAvg(), loops = Math.max(1, Math.round(+r.loops || 1));
    r.meas = {}; CK.forEach(k => r.meas[k] = +a[k].toFixed(1)); r.measCycle = +(sumL(a) / loops).toFixed(1);
    r.cron = { laps: cron.laps.slice(-60), t: new Date().toISOString().slice(0, 10) };
    try { ctx.changed('runners'); } catch (e) { console.warn('visor: no se pudo guardar tiempos', e); }
    const id = r.id; cronClose(); state.sel = id; state.el = null;
    const yb = document.querySelector('#repView [data-v="yama"]'); if (yb && state.view !== 'yama') yb.click(); else redraw();
  }
  function cronExport() {
    const r = runnerById(cron.rid), rows = [['runner', 'ciclo', 'elemento', 'clave', 'segundos']];
    cron.laps.forEach((l, i) => CK.forEach(k => rows.push([r.name, i + 1, elemOf(k).name, k, (+l[k] || 0).toFixed(1)])));
    const csv = '﻿' + rows.map(x => x.map(v => { const t = String(v); return /[",;\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `Tiempos_${ctx.id || 'planta'}_${String(r.name).replace(/[^\w-]+/g, '_')}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function parseCsv(text) {
    const t = text.replace(/^﻿/, ''), first = t.split(/\r?\n/)[0] || '', sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : first.includes('\t') ? '\t' : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < t.length; i++) { const ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(c => c.trim() !== '')) rows.push(row); row = []; }
      else cur += ch; }
    row.push(cur); if (row.some(c => c.trim() !== '')) rows.push(row); return rows;
  }
  function cronImport(text) {
    const r = runnerById(cron.rid), rows = parseCsv(text); if (!r || rows.length < 2) { alert('El archivo no trae renglones de datos.'); return; }
    const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const H = rows[0].map(norm), col = (...n) => H.findIndex(h => n.some(x => h === x || h.startsWith(x)));
    const cE = col('clave', 'elemento', 'element'), cE2 = col('elemento', 'element'), cS = col('segundos', 'seg', 'tiempo', 'time', 's'), cC = col('ciclo', 'cycle', 'vuelta'), cR = col('runner', 'operador', 'ruta');
    if (cE < 0 || cS < 0) { alert('Faltan columnas: se necesitan "elemento" y "segundos".'); return; }
    const keyOf = v => { const n = norm(v); if (CK.includes(n)) return n; const E = ctx.ELEMS.find(E => CK.includes(E.k) && (norm(E.name) === n || norm(E.name).startsWith(n) || n.startsWith(norm(E.name)))); return E ? E.k : n.startsWith('espera') || n.startsWith('otro') ? 'o' : null; };
    const secs = v => { const s = String(v).trim().replace(',', '.'); if (/^\d+:\d+(\.\d+)?$/.test(s)) { const [m, x] = s.split(':'); return +m * 60 + +x; } return parseFloat(s); };
    let data = rows.slice(1); if (cR >= 0 && data.some(x => norm(x[cR]) === norm(r.name))) data = data.filter(x => norm(x[cR]) === norm(r.name));
    const by = new Map(); let bad = 0;
    data.forEach(x => { const k = keyOf(x[cE]) || (cE2 >= 0 ? keyOf(x[cE2]) : null), s = secs(x[cS]); if (!k || !isFinite(s) || s < 0) { bad++; return; }
      const c = cC >= 0 ? String(x[cC]).trim() : '_'; if (!by.has(c)) by.set(c, { l: zero(), n: zero() }); const g = by.get(c); g.l[k] += s; g.n[k]++; });
    if (!by.size) { alert('No se reconoció ningún renglón. Revisa los nombres de elemento y los segundos.'); return; }
    const laps = [...by.values()].map(g => { const l = {}; CK.forEach(k => l[k] = +(cC >= 0 ? g.l[k] : (g.n[k] ? g.l[k] / g.n[k] : 0)).toFixed(1)); return l; });
    cron.laps.push(...laps); cronKeep(); cronRender();
    if (bad) alert(`Se importaron ${laps.length} ciclos. ${bad} renglones no se reconocieron y se omitieron.`);
  }

  function redraw() {
    if (!state.S) return;
    const box = state.view === 'yama' ? drawYama(state.S, state.over) : drawSpag(state.S, state.over);
    svg.classList.toggle('sel', !!state.sel && state.view !== 'yama'); svg.classList.toggle('edit', !!state.edit);
    const key = state.view + '|' + [box.x, box.y, box.w, box.h].map(v => Math.round(v)).join(',');
    state.box = box;
    if (key !== state.key || !state.vb) { state.key = key; state.home = fitTo(box); state.vb = { ...state.home }; }
    applyView(); drawSide();
  }

  /* ---------- resaltado en 3D ---------- */
  let HL = null, backEl = null, raf = 0;
  function clear3D() { if (HL) { scene.remove(HL); HL.traverse(m => { m.geometry?.dispose(); m.material?.dispose(); }); HL = null; } cancelAnimationFrame(raf); backEl?.remove(); backEl = null; }
  function ribbon(pts, w, color) {
    const pos = [], idx = [];
    for (let i = 0; i < pts.length - 1; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 1e-6) continue;
      const nx = -dz / L * w / 2, nz = dx / L * w / 2, b = pos.length / 3; pos.push(x0 + nx, .3, z0 + nz, x0 - nx, .3, z0 - nz, x1 + nx, .3, z1 + nz, x1 - nx, .3, z1 - nz); idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthTest: false, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 60; m.frustumCulled = false; return m;
  }
  function ring(p, color) { const g = new THREE.RingGeometry(1.2, 1.9, 40); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .95, depthTest: false, depthWrite: false, side: THREE.DoubleSide })); m.position.set(p[0], .34, p[1]); m.renderOrder = 61; return m; }
  function span(P, s0, s1) {
    const at = s => { let i = 1; while (i < P.cum.length - 1 && P.cum[i] < s) i++; const a = P.pts[i - 1], b = P.pts[i], c0 = P.cum[i - 1], c1 = P.cum[i], t = c1 > c0 ? Math.min(1, Math.max(0, (s - c0) / (c1 - c0))) : 0; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
    const out = [at(s0)]; P.pts.forEach((p, i) => { if (P.cum[i] > s0 && P.cum[i] < s1) out.push(p); }); out.push(at(s1)); return out;
  }
  function show3D(r, el) {
    if (!r) return; const P = ctx.buildPath(r); if (!P) return;
    clear3D(); HL = new THREE.Group(); const used = [];
    const stops = r.stops || [], n = stops.length, kind = i => ctx.stopKind ? ctx.stopKind(stops[i], i) : (i === 0 ? 'carga' : 'descarga');
    const E = el && ctx.ELEMS.find(x => x.k === el), col = E ? E.col : '#ffffff';
    HL.add(ribbon(P.pts, E ? .35 : .9, E ? '#ffffff' : r.color));
    if (el === 'tc' || el === 'tv') {               // tramos con carga / en vacío, igual que el cálculo del yamazumi
      const after = new Array(n).fill(false); let loaded = false;
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) { const k = kind(i); if (k === 'carga' || k === 'cambio') loaded = true; else if (k === 'descarga') loaded = false; if (pass) after[i] = loaded; }
      for (let i = 0; i < n; i++) if (after[i] === (el === 'tc')) { const pts = span(P, P.stopS[i], i < n - 1 ? P.stopS[i + 1] : P.len); HL.add(ribbon(pts, 1.3, col)); used.push(...pts); }
    } else if (el === 'c' || el === 'd' || el === 'o') {
      stops.forEach((s, i) => { const k = kind(i), hit = el === 'c' ? (k === 'carga' || k === 'cambio') : el === 'd' ? (k === 'descarga' || k === 'cambio') : !['carga', 'descarga', 'cambio'].includes(k); if (hit) { HL.add(ring(s.p, col)); used.push(s.p); } });
    } else stops.forEach(s => HL.add(ring(s.p, '#ffffff')));
    scene.add(HL);
    const pts = used.length ? used : P.pts, xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2, ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    document.querySelector('#report').hidden = true;
    try { ctx.goOrbit(cx, cz, Math.max(28, ext * 1.15), ctx.orbit.T.th, .9); } catch (_) {}
    const t0 = performance.now(); const pulse = () => { if (!HL) return; const k = .62 + .38 * Math.sin((performance.now() - t0) / 260); HL.children.forEach((m, i) => { if (i) m.material.opacity = k; }); raf = requestAnimationFrame(pulse); }; pulse();
    backEl = document.createElement('div'); backEl.id = 'vzBack';
    backEl.innerHTML = `<span>${esc(r.name)}${E ? ' · ' + esc(E.name) : ' · ruta completa'}</span><button>Volver al reporte</button>`;
    backEl.querySelector('button').addEventListener('click', () => { clear3D(); document.querySelector('#report').hidden = false; redraw(); });
    document.body.appendChild(backEl);
  }

  return {
    render(view, S, over) { state.view = view === 'yama' ? 'yama' : 'spag'; state.S = S; state.over = over || null; if (state.sel && !runnerById(state.sel)) { state.sel = null; state.el = null; }
      if (state.edit && (state.view === 'yama' || !editR())) state.edit = null; if (cron && !runnerById(cron.rid)) cronClose(); else redraw(); },
    edit: { start: startEdit, end: endEdit, add: addStop, move: moveStop, del: delStop, undo, snap },
    cron: { open: id => cronOpen(runnerById(id)), tap: k => cronTap(k), lap: () => cronLap(), apply: () => cronApply(), importCsv: t => cronImport(t), close: () => cronClose(), laps: () => cron ? cron.laps : null },
    select, show3D: (id, el) => show3D(runnerById(id), el || null), clear3D, fit,
    state: () => ({ view: state.view, sel: state.sel, el: state.el, vb: state.vb, home: state.home, runners: (state.S?.runners || []).length, nodes: svg.childNodes.length })
  };
}
