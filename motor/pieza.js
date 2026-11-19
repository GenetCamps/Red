/* Red DAIMAY · Crear pieza (20-nov-2026). Se abre desde Editor → Diseñar → «Crear pieza».
   - Plantillas con medidas reales por defecto (mesa de costura, prensa, inyectora, CNC, banda, horno…): se ajustan largo, ancho, alto,
     opciones propias de cada una y color; vista previa 3D con una persona de 1.70 m para dar escala.
   - «Colocar en el plano» la pone una vez; «Guardar en Mis piezas» la deja en el catálogo de la planta para todos (pl/<planta>/piezas/lib).
   - Modo Pro «Armar con bloques»: cajas y cilindros con imán de 5 cm para equipos que no encajan en ninguna plantilla.
   Las formas se dibujan con prmParts del gemelo (build/pieza_patch.py), así el plano y la vista previa son idénticos. */
const QC = ['#d93030', '#f07f1a', '#f2c200', '#8bc34a', '#2fa84f', '#14b8a6', '#2fd3e0', '#2f6fd6', '#1d3f78', '#8e5bd6', '#e05a9a', '#ffffff', '#9aa3ab', '#3d434a', '#15171a', '#8a6d4b'];
const SN = ['No', 'Sí'];
const OPTS = {
  '@mesacos': [['maq', 'Máquina', [['poste', 'De poste'], ['plana', 'Plana']]], ['silla', 'Silla', SN], ['conos', 'Porta-conos', SN], ['oper', 'Operador sentado', SN]],
  '@prensa': [['cols', 'Columnas', [[4, '4 columnas'], [2, '2 laterales']]], ['guarda', 'Cortina de seguridad', SN], ['tablero', 'Tablero y bimanual', SN]],
  '@inyectora': [['robot', 'Robot cartesiano', SN], ['guarda', 'Guarda', SN]],
  '@cnc': [['torreta', 'Torreta andon', SN]] };
const TPL = [['@mesacos', 'Mesa de costura', '⊞'], ['@mesa', 'Mesa de trabajo', '▭'], ['@prensa', 'Prensa', '▥'], ['@inyectora', 'Inyectora', '▤'], ['@cnc', 'Máquina CNC', '▣'],
  ['@maquina', 'Máquina genérica', '■'], ['@banda', 'Banda', '═'], ['@horno', 'Horno', '♨'], ['@anaquel', 'Rack / anaquel', '☰'], ['@carro', 'Carro WIP', '⊟'],
  ['@gabinete', 'Gabinete eléctrico', '▯'], ['@caja', 'Caja', '□'], ['@cilindro', 'Cilindro / tanque', '◯'], ['@valla', 'Valla', '╤'], ['@tapete', 'Tapete', '▬']];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r2 = v => Math.round(v * 100) / 100, snap = v => Math.round(v / .05) * .05;

export function init(ctx) {
  const { THREE, PRM_T } = ctx;
  const S = { open: false, mode: 'tpl', t: '@mesacos', P: null, name: '', blocks: [], bsel: 0, lib: [], key: 'rd_piezas_' + (ctx.id || 'gemelo') };
  const RO = () => !!window.RD_RO;
  const who = () => { try { return (window.RD_ME || parent.RD_ME || {}).nombre || ''; } catch (_) { return ''; } };

  /* ---------- Mis piezas: biblioteca por planta, compartida con la base de la Red (o en este navegador si el gemelo se abre solo) ---------- */
  function register(list) { S.lib = (list || []).filter(x => x && x.id && x.id.startsWith('@u_')); let used = false;
    S.lib.forEach(x => { PRM_T[x.id] = { n: x.n, def: x.def, base: x.base || null, parts: x.parts || null, grp: 'Mis piezas', hide: !!x.hide, by: x.by, at: x.at }; });
    try { used = (ctx.SCN()?.adds || []).some(a => String(a.src).startsWith('@u_')); } catch (_) {}
    try { ctx.edBuildCat(); if (ctx.ED.tab === 'cat') ctx.edRenderCat(); } catch (_) {}
    if (used) try { ctx.edApplyAll(); } catch (_) {}
    if (S.open) render(); }
  let DBR = null;
  (function wire(n) { const d = ctx.db?.();
    if (d) { DBR = d.doc('piezas/lib'); DBR.onSnapshot(s => register(s.exists ? (s.data() || {}).list : []), () => {}); return; }
    if (!window.claude?.use || n > 40) { try { register(JSON.parse(localStorage.getItem(S.key) || '[]')); } catch (_) {} return; }
    setTimeout(() => wire(n + 1), 500); })(0);
  async function saveLib(list) { S.lib = list; register(list);
    if (DBR) { try { await DBR.set({ list, at: Date.now() }); } catch (e) { ctx.edToast('No se pudo guardar en Mis piezas (' + (e?.code || e?.message || 'error') + ')'); } }
    else try { localStorage.setItem(S.key, JSON.stringify(list)); } catch (_) {} }

  /* ---------- vista previa 3D ---------- */
  let R = null, scene, cam, grp, ang = .7, tilt = .5, zoom = 1, raf = 0;
  const MAT = { wh: { roughness: .5, metalness: .15 }, blk: { roughness: .6 }, al: { metalness: .55, roughness: .35 } };
  function ensure(cv) { if (R && R.domElement === cv) return; R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight('#ffffff', '#59626c', 1.25)); const dl = new THREE.DirectionalLight('#ffffff', 1.6); dl.position.set(5, 9, 6); scene.add(dl);
    cam = new THREE.PerspectiveCamera(32, 1, .05, 400); const g = new THREE.GridHelper(20, 40, '#8b939c', '#c9ced3'); g.material.transparent = true; g.material.opacity = .55; scene.add(g);
    grp = new THREE.Group(); scene.add(grp);
    let drag = null; cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY, ang, tilt]; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (!drag) return; ang = drag[2] - (e.clientX - drag[0]) * .01; tilt = Math.max(.08, Math.min(1.35, drag[3] + (e.clientY - drag[1]) * .006)); frame(); });
    cv.addEventListener('pointerup', () => { drag = null; }); cv.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(.4, Math.min(2.6, zoom * (e.deltaY > 0 ? 1.1 : .9))); frame(); }, { passive: false }); }
  const UNIT = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
  function preview() { const cv = document.getElementById('pzCv'); if (!cv) return; ensure(cv);
    grp.children.slice().forEach(m => { grp.remove(m); m.material?.dispose?.(); });
    const key = S.mode === 'pro' ? '@__pro' : S.t, P = S.mode === 'pro' ? proP() : S.P; let parts = [];
    try { parts = ctx.prmParts(key, P); } catch (e) { console.warn(e); }
    parts.forEach(q => { const mat = q.mat === 'led' ? new THREE.MeshBasicMaterial({ color: q.c }) : new THREE.MeshStandardMaterial({ color: q.c, ...(MAT[q.mat] || MAT.wh) });
      const m = new THREE.Mesh(UNIT, mat); m.matrixAutoUpdate = false; m.matrix.copy(q.m); grp.add(m); });
    // persona de referencia 1.70 m
    const pm = new THREE.MeshStandardMaterial({ color: '#8b939c', roughness: .8 }), px = (+P.l || 1) / 2 + .6, pz = 0;
    [[px, 0, pz, .3, .85, .2], [px, .85, pz, .38, .6, .22], [px, 1.47, pz, .2, .23, .2]].forEach(([x, y, z, sx, sy, sz]) => { const m = new THREE.Mesh(UNIT, pm); m.position.set(x, y, z); m.scale.set(sx, sy, sz); grp.add(m); });
    frame(); }
  function frame() { if (!R) return; const cv = R.domElement, w = cv.clientWidth || 400, h = cv.clientHeight || 300; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const b = new THREE.Box3().setFromObject(grp), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()), r = Math.max(1.2, sz.length() / 2) / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * .95 * zoom;
    cam.position.set(c.x + Math.cos(ang) * Math.cos(tilt) * r, c.y + Math.sin(tilt) * r, c.z + Math.sin(ang) * Math.cos(tilt) * r); cam.lookAt(c); R.render(scene, cam); }

  /* ---------- modo Pro: bloques ---------- */
  const proBox = () => { const B = S.blocks; if (!B.length) return { x0: 0, x1: 1, z0: 0, z1: 1, h: 1 }; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, h = 0;
    B.forEach(q => { const hl = q.l / 2, hd = (q.k === 'cil' ? q.l : q.d) / 2; x0 = Math.min(x0, q.x - hl); x1 = Math.max(x1, q.x + hl); z0 = Math.min(z0, q.z - hd); z1 = Math.max(z1, q.z + hd); h = Math.max(h, q.y + q.h); }); return { x0, x1, z0, z1, h }; };
  function proDef() { const b = proBox(), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    return { def: { l: r2(b.x1 - b.x0) || 1, d: r2(b.z1 - b.z0) || 1, h: r2(b.h) || 1, c: S.blocks[0]?.c || '#9aa3ab' }, parts: S.blocks.map(q => ({ k: q.k, x: r2(q.x - cx), y: r2(q.y), z: r2(q.z - cz), l: q.l, d: q.k === 'cil' ? q.l : q.d, h: q.h, c: q.c, mat: q.k === 'cil' ? 'al' : 'wh' })) }; }
  function proP() { const D = proDef(); PRM_T['@__pro'] = { n: 'Pieza armada', def: D.def, parts: D.parts, hide: true }; return D.def; }

  /* ---------- pantalla ---------- */
  function setT(t) { S.t = t; const U = PRM_T[t]; S.P = Object.assign({}, U?.def || {}); S.name = U && U.grp === 'Mis piezas' ? U.n : ''; zoom = 1; }
  function open(t) { if (RO()) { ctx.edToast('Tu usuario es de solo ver: no puede crear piezas.'); return; } if (!document.getElementById('pzCss')) css();
    let w = document.getElementById('pz'); if (!w) { w = document.createElement('div'); w.id = 'pz'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'Crear pieza'); document.body.appendChild(w); wireUI(w); }
    if (t || !S.P) setT(t || S.t); S.open = true; w.hidden = false; render(); }
  function close() { S.open = false; const w = document.getElementById('pz'); if (w) w.hidden = true; }
  function optsOf(t) { const U = PRM_T[t]; return OPTS[t] || (U && U.base ? OPTS[U.base] : null) || []; }
  function optRows(t, P, pre) { return optsOf(t).map(([k, n, vals]) => `<div class="pz-op"><span>${n}</span><div class="pz-seg">${vals.map((v, i) => { const val = Array.isArray(v) ? v[0] : i, lab = Array.isArray(v) ? v[1] : v;
    return `<button data-${pre}="${k}" data-v="${val}" aria-pressed="${String(P[k]) === String(val)}">${lab}</button>`; }).join('')}</div></div>`).join(''); }
  function colorRow(cur, attr) { return `<div class="pz-col">${QC.map(c => `<button data-${attr}="${c}" style="background:${c}" aria-label="Color ${c}" aria-pressed="${String(cur).toLowerCase() === c}"></button>`).join('')}<label class="pz-libre" title="Pro · color libre"><input type="color" data-${attr}l="1" value="${esc(cur || '#9aa3ab')}">Pro · libre</label></div>`; }
  function num(id, lab, v, min, max, step) { return `<label class="pz-num"><span>${lab}</span><input type="number" data-pzn="${id}" min="${min}" max="${max}" step="${step}" value="${r2(v)}"><input type="range" data-pzr="${id}" min="${min}" max="${max}" step="${step}" value="${r2(v)}" aria-label="${lab}"></label>`; }
  function render() { const w = document.getElementById('pz'); if (!w || !S.open) return; const mine = S.lib.filter(x => !x.hide);
    const left = `<div class="pz-l"><div class="pz-tabs"><button data-pzm="tpl" aria-pressed="${S.mode === 'tpl'}">Plantillas</button><button data-pzm="pro" aria-pressed="${S.mode === 'pro'}">Pro · armar con bloques</button></div>
      ${S.mode === 'tpl' ? `<div class="pz-grid">${TPL.filter(([k]) => PRM_T[k]).map(([k, n, ic]) => `<button data-pzt="${k}" aria-pressed="${S.t === k}"><i>${ic}</i>${n}</button>`).join('')}</div>
        <h4>Mis piezas <small>${mine.length ? mine.length + ' en esta planta' : 'aún no hay'}</small></h4>${mine.length ? `<div class="pz-mis">${mine.map(x => `<div><button data-pzt="${x.id}" aria-pressed="${S.t === x.id}">${esc(x.n)}<small>${r2(x.def.l)} × ${r2(x.def.d)} × ${r2(x.def.h)} m${x.by ? ' · ' + esc(x.by) : ''}</small></button><button class="pz-x" data-pzdel="${x.id}" title="Quitar de Mis piezas (las ya colocadas se quedan)" aria-label="Quitar ${esc(x.n)}">×</button></div>`).join('')}</div>` : '<p class="pz-tip">Guarda aquí las piezas que uses seguido; las ve toda la planta en el catálogo.</p>'}`
      : `<p class="pz-tip">Para equipos que no se parecen a ninguna plantilla. Junta cajas y cilindros; todo se acomoda cada 5 cm.</p><div class="pz-blq">${S.blocks.map((q, i) => `<button data-pzb="${i}" aria-pressed="${i === S.bsel}"><i style="background:${q.c}"></i>${q.k === 'cil' ? 'Cilindro' : 'Caja'} ${i + 1}<small>${r2(q.l)} × ${r2(q.k === 'cil' ? q.l : q.d)} × ${r2(q.h)} m</small></button>`).join('') || '<p class="pz-tip">Agrega el primer bloque.</p>'}</div>
        <div class="pz-row"><button data-pza="caja">+ Caja</button><button data-pza="cil">+ Cilindro</button></div>`}</div>`;
    let right;
    if (S.mode === 'tpl') { const P = S.P, U = PRM_T[S.t] || {};
      right = `<h3>${esc(U.grp === 'Mis piezas' ? U.n : (TPL.find(x => x[0] === S.t) || [, U.n || ''])[1])}</h3>
        <div class="pz-sec">Medidas</div>${num('l', 'Largo (m)', P.l, .2, 20, .05)}${num('d', 'Ancho (m)', P.d, .05, 8, .05)}${num('h', 'Alto (m)', P.h, .01, 8, .05)}
        ${optsOf(S.t).length ? `<div class="pz-sec">Opciones</div>${optRows(S.t, P, 'pzo')}` : ''}
        <div class="pz-sec">Color</div>${colorRow(P.c, 'pzc')}${S.t === '@mesacos' && +P.oper ? `<div class="pz-sec">Color del uniforme</div>${colorRow(P.uc, 'pzu')}` : ''}
        <div class="pz-sec">Nombre para Mis piezas</div><input class="pz-in" data-pzname="1" maxlength="60" placeholder="Por ejemplo Prensa 200 t línea 4" value="${esc(S.name)}">`; }
    else { const q = S.blocks[S.bsel];
      right = `<h3>Pieza armada</h3>${q ? `<div class="pz-sec">${q.k === 'cil' ? 'Cilindro' : 'Caja'} ${S.bsel + 1}</div>
        ${num('bl', q.k === 'cil' ? 'Diámetro (m)' : 'Largo (m)', q.l, .05, 15, .05)}${q.k === 'cil' ? '' : num('bd', 'Ancho (m)', q.d, .05, 8, .05)}${num('bh', 'Alto (m)', q.h, .02, 8, .05)}
        ${num('bx', 'Posición a lo largo (m)', q.x, -10, 10, .05)}${num('bz', 'Posición a lo ancho (m)', q.z, -6, 6, .05)}${num('by', 'Altura desde el piso (m)', q.y, 0, 8, .05)}
        <div class="pz-row"><button data-pza="encima">Ponerlo encima del anterior</button><button data-pza="dup">Duplicar</button><button data-pza="del" class="pz-del">Quitar</button></div>
        <div class="pz-sec">Color del bloque</div>${colorRow(q.c, 'pzbc')}` : '<p class="pz-tip">Empieza con «+ Caja»: por ejemplo la base de la máquina.</p>'}
        <div class="pz-sec">Nombre para Mis piezas</div><input class="pz-in" data-pzname="1" maxlength="60" placeholder="Por ejemplo Robot de pegado" value="${esc(S.name)}">`; }
    const D = S.mode === 'pro' ? proDef().def : S.P;
    w.innerHTML = `<div class="pz-box"><header><b>Crear pieza</b><span>Elige una forma, ajústala y colócala en el plano</span><button class="pz-x" data-pzx="1" aria-label="Cerrar">×</button></header>
      <div class="pz-body">${left}<div class="pz-c"><canvas id="pzCv" aria-label="Vista previa de la pieza; arrastra para girar"></canvas><p class="pz-tip">Arrastra para girar · rueda para acercar · la figura gris mide 1.70 m · ${r2(D.l)} × ${r2(D.d)} × ${r2(D.h)} m</p></div>
      <div class="pz-r">${right}</div></div>
      <footer><span class="pz-tip">${S.mode === 'pro' && !S.blocks.length ? 'Agrega al menos un bloque.' : 'Después de colocarla se mueve, gira (R), duplica y se le cambian medidas como cualquier pieza.'}</span>
        <button data-pzgo="1" ${S.mode === 'pro' && !S.blocks.length ? 'disabled' : ''}>Colocar en el plano</button><button class="pri" data-pzsave="1" ${S.mode === 'pro' && !S.blocks.length ? 'disabled' : ''}>Guardar en Mis piezas y colocar</button></footer></div>`;
    preview(); }
  function setNum(k, v) { if (!isFinite(v)) return;
    if (S.mode === 'tpl') { if (v > 0) S.P[k] = r2(v); }
    else { const q = S.blocks[S.bsel]; if (!q) return; const m = { bl: 'l', bd: 'd', bh: 'h', bx: 'x', bz: 'z', by: 'y' }[k]; q[m] = ['l', 'd', 'h'].includes(m) ? Math.max(.05, snap(v)) : (m === 'y' ? Math.max(0, snap(v)) : snap(v)); }
    preview(); const w = document.getElementById('pz'); w?.querySelectorAll(`[data-pzn="${k}"],[data-pzr="${k}"]`).forEach(el => { if (document.activeElement !== el) el.value = r2(+v); });
    const tip = w?.querySelector('.pz-c .pz-tip'); if (tip) { const D = S.mode === 'pro' ? proDef().def : S.P; tip.textContent = `Arrastra para girar · rueda para acercar · la figura gris mide 1.70 m · ${r2(D.l)} × ${r2(D.d)} × ${r2(D.h)} m`; } }
  async function place(save) {
    let key, P, label;
    if (S.mode === 'tpl') { key = S.t; P = Object.assign({}, S.P); label = (S.name || (PRM_T[key]?.n) || 'Pieza');
      if (save) { const nm = S.name.trim(); if (!nm) { ctx.edToast('Escribe el nombre para Mis piezas'); document.querySelector('#pz [data-pzname]')?.focus(); return; }
        const base = PRM_T[key]?.base || key, ex = S.lib.find(x => x.id === key);
        if (ex) { ex.n = nm; ex.def = P; ex.at = Date.now(); ex.by = who(); key = ex.id; } else { key = '@u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); S.lib = S.lib.concat([{ id: key, n: nm, base, def: P, by: who(), at: Date.now() }]); }
        await saveLib(S.lib.slice()); label = nm; } }
    else { const D = proDef(); P = D.def; label = S.name.trim() || 'Pieza armada';
      if (!save) { key = '@u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); S.lib = S.lib.concat([{ id: key, n: label, parts: D.parts, def: D.def, by: who(), at: Date.now(), hide: true }]); await saveLib(S.lib.slice()); }
      else { if (!S.name.trim()) { ctx.edToast('Escribe el nombre para Mis piezas'); document.querySelector('#pz [data-pzname]')?.focus(); return; }
        key = '@u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); S.lib = S.lib.concat([{ id: key, n: label, parts: D.parts, def: D.def, by: who(), at: Date.now() }]); await saveLib(S.lib.slice()); } }
    close(); try { if (ctx.ED.tab === 'dis') ctx.edTab('cat'); ctx.edStartPlace(key, label, P); ctx.edToast(save ? `«${label}» quedó en Mis piezas · clic para colocarla` : 'Clic en el plano para colocarla · R gira · Esc cancela'); } catch (e) { console.warn(e); } }
  function wireUI(w) {
    w.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) { if (e.target === w) close(); return; } const d = b.dataset;
      if (d.pzx) return close();
      if (d.pzm) { S.mode = d.pzm; if (S.mode === 'pro' && !S.blocks.length) { S.blocks = [{ k: 'caja', x: 0, y: 0, z: 0, l: 1.2, d: .8, h: .9, c: '#9aa3ab' }]; S.bsel = 0; } S.name = ''; render(); return; }
      if (d.pzt) { setT(d.pzt); render(); return; }
      if (d.pzdel) { const x = S.lib.find(q => q.id === d.pzdel); if (!x || !confirm(`¿Quitar «${x.n}» de Mis piezas? Las que ya están colocadas en el plano se quedan.`)) return; x.hide = true; saveLib(S.lib.slice()); if (S.t === x.id) setT('@mesacos'); render(); return; }
      if (d.pzo) { S.P[d.pzo] = isNaN(+d.v) ? d.v : +d.v; render(); return; }
      if (d.pzc) { if (S.mode === 'tpl') S.P.c = d.pzc; render(); return; }
      if (d.pzu) { S.P.uc = d.pzu; render(); return; }
      if (d.pzbc) { const q = S.blocks[S.bsel]; if (q) q.c = d.pzbc; render(); return; }
      if (d.pzb) { S.bsel = +d.pzb; render(); return; }
      if (d.pza) { const B = S.blocks, q = B[S.bsel];
        if (d.pza === 'caja' || d.pza === 'cil') { const top = B.length ? proBox().h : 0; B.push(d.pza === 'cil' ? { k: 'cil', x: 0, y: snap(top), z: 0, l: .5, d: .5, h: .8, c: '#c9ced3' } : { k: 'caja', x: 0, y: snap(top), z: 0, l: .8, d: .6, h: .5, c: '#9aa3ab' }); S.bsel = B.length - 1; }
        else if (q && d.pza === 'dup') { B.push({ ...q, x: snap(q.x + q.l + .05) }); S.bsel = B.length - 1; }
        else if (q && d.pza === 'del') { B.splice(S.bsel, 1); S.bsel = Math.max(0, S.bsel - 1); }
        else if (q && d.pza === 'encima' && S.bsel > 0) { const p = B[S.bsel - 1]; q.y = snap(p.y + p.h); q.x = p.x; q.z = p.z; }
        render(); return; }
      if (d.pzgo) { place(false); return; }
      if (d.pzsave) { place(true); return; } });
    w.addEventListener('input', e => { const t = e.target, d = t.dataset;
      if (d.pzn || d.pzr) { setNum(d.pzn || d.pzr, +t.value); return; }
      if (d.pzname) { S.name = t.value; return; }
      if (d.pzcl) { if (S.mode === 'tpl') { S.P.c = t.value; preview(); } return; }
      if (d.pzul) { S.P.uc = t.value; preview(); return; }
      if (d.pzbcl) { const q = S.blocks[S.bsel]; if (q) { q.c = t.value; preview(); } return; } });
    w.addEventListener('change', e => { if (e.target.dataset.pzn || e.target.dataset.pzr || e.target.type === 'color') render(); });
    addEventListener('keydown', e => { if (S.open && e.key === 'Escape') close(); });
    addEventListener('resize', () => { if (S.open) frame(); }); }
  function css() { const st = document.createElement('style'); st.id = 'pzCss'; st.textContent = `
#pz{position:fixed;inset:0;z-index:120;background:rgba(10,12,15,.55);display:grid;place-items:center;padding:14px;font:14px/1.45 'IBM Plex Sans',system-ui,sans-serif;color:#1C2126}
#pz[hidden]{display:none}#pz button{font:inherit;color:inherit;cursor:pointer}#pz :focus-visible{outline:3px solid #F2C200;outline-offset:2px}
#pz .pz-box{width:min(1180px,100%);max-height:calc(100vh - 28px);background:#E2E5E7;border-radius:12px;overflow:hidden;display:grid;grid-template-rows:auto 1fr auto;box-shadow:0 30px 70px rgba(0,0,0,.45)}
#pz header{display:flex;align-items:baseline;gap:12px;background:#23282E;color:#fff;padding:12px 16px;position:relative}#pz header::after{content:"";position:absolute;left:0;right:0;bottom:-3px;height:2px;background:repeating-linear-gradient(90deg,#E1262D 0 9px,transparent 9px 15px)}
#pz header b{font:600 24px 'Barlow Condensed','Arial Narrow',sans-serif}#pz header span{color:#AEB6BF;font-size:13px;flex:1}#pz .pz-x{background:none;border:0;font-size:22px;line-height:1;padding:0 6px;color:inherit}
#pz .pz-body{display:grid;grid-template-columns:260px minmax(0,1fr) 300px;min-height:0;overflow:hidden}
#pz .pz-l,#pz .pz-r{overflow:auto;padding:12px;min-height:0}#pz .pz-l{border-right:1px solid #C9CED3}#pz .pz-r{border-left:1px solid #C9CED3;background:#F3F4F5}
#pz .pz-c{display:grid;grid-template-rows:1fr auto;min-height:420px;padding:10px;gap:6px}#pz canvas{width:100%;height:100%;min-height:360px;background:linear-gradient(#f3f4f5,#dfe3e6);border-radius:10px;touch-action:none;cursor:grab}
#pz h3{font:600 26px 'Barlow Condensed',sans-serif;margin:0 0 4px;color:#1C2126;letter-spacing:.01em;text-transform:none}#pz h4{font:600 18px 'Barlow Condensed',sans-serif;color:#1C2126;letter-spacing:.01em;text-transform:none;margin:14px 0 6px;display:flex;gap:8px;align-items:baseline}#pz h4 small{font:400 12px 'IBM Plex Sans',sans-serif;color:#5E6873}
#pz .pz-tabs{display:flex;background:#23282E;border-radius:999px;padding:3px;margin-bottom:10px}#pz .pz-tabs button{flex:1;border:0;background:none;color:#AEB6BF;border-radius:999px;padding:6px 8px;font-size:13px}#pz .pz-tabs button[aria-pressed="true"]{background:#fff;color:#23282E;font-weight:600}
#pz .pz-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}#pz .pz-grid button{display:grid;gap:2px;place-items:center;text-align:center;border:1px solid #C9CED3;background:#F3F4F5;border-radius:8px;padding:8px 4px;min-height:60px;font-size:12.5px;font-weight:500}
#pz .pz-grid button i{font-style:normal;font-size:20px;line-height:1}#pz [aria-pressed="true"]{border-color:#23282E}#pz .pz-grid button[aria-pressed="true"],#pz .pz-mis button[aria-pressed="true"],#pz .pz-blq button[aria-pressed="true"]{background:#23282E;color:#fff}
#pz .pz-mis div{display:flex;gap:4px;margin-bottom:4px}#pz .pz-mis button:first-child,#pz .pz-blq button{flex:1;text-align:left;border:1px solid #C9CED3;background:#F3F4F5;border-radius:8px;padding:6px 9px;display:grid}#pz small{font-size:11.5px;opacity:.75}
#pz .pz-blq{display:grid;gap:4px}#pz .pz-blq button{grid-template-columns:14px 1fr;gap:0 8px;align-items:center}#pz .pz-blq i{width:14px;height:14px;border-radius:3px;grid-row:span 2;border:1px solid rgba(0,0,0,.2)}#pz .pz-blq small{grid-column:2}
#pz .pz-sec{font-weight:600;font-size:13px;color:#5E6873;margin:12px 0 5px}#pz .pz-num{display:grid;grid-template-columns:1fr 84px;gap:2px 8px;align-items:center;margin-bottom:6px}#pz .pz-num input[type=range]{grid-column:1/-1;width:100%;accent-color:#E1262D}
#pz .pz-num input[type=number],#pz .pz-in{border:1px solid #C9CED3;border-radius:6px;padding:6px 8px;font:inherit;background:#fff;width:100%;box-sizing:border-box}
#pz .pz-op{display:grid;gap:4px;margin-bottom:8px}#pz .pz-op>span{font-size:13px}#pz .pz-seg{display:flex;gap:4px;flex-wrap:wrap}#pz .pz-seg button,#pz .pz-row button,#pz footer button{border:1px solid #C9CED3;background:#fff;border-radius:6px;padding:6px 11px;min-height:34px}
#pz .pz-seg button[aria-pressed="true"]{background:#23282E;color:#fff}#pz .pz-row{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}#pz .pz-del{color:#b42318}
#pz .pz-col{display:grid;grid-template-columns:repeat(8,1fr);gap:5px}#pz .pz-col button{aspect-ratio:1;border-radius:6px;border:1px solid rgba(0,0,0,.25);padding:0}#pz .pz-col button[aria-pressed="true"]{outline:3px solid #23282E;outline-offset:1px}
#pz .pz-libre{grid-column:1/-1;display:flex;gap:6px;align-items:center;font-size:12.5px;color:#5E6873}#pz .pz-libre input{width:34px;height:24px;border:0;padding:0;background:none}
#pz .pz-tip{font-size:12.5px;color:#5E6873;margin:6px 0}#pz footer{display:flex;gap:8px;align-items:center;padding:10px 14px;background:#F3F4F5;border-top:1px solid #C9CED3}#pz footer .pz-tip{flex:1;margin:0}
#pz footer button.pri{background:#E1262D;border-color:#E1262D;color:#fff;font-weight:600}#pz footer button:disabled{opacity:.45;cursor:default}
@media (max-width:900px){#pz .pz-body{grid-template-columns:1fr;overflow:auto}#pz .pz-l,#pz .pz-r{border:0}#pz .pz-c{min-height:300px}#pz .pz-box{max-height:none;height:100%}}`; document.head.appendChild(st); }

  /* ---------- opciones al editar una pieza ya colocada (panel del objeto en el editor) ---------- */
  let lastT = null;
  function optHtml(t, P) { lastT = t; const o = optsOf(t); if (!o.length) return ''; return `<div class="pz-edop" style="display:grid;gap:6px;margin-top:8px">${o.map(([k, n, vals]) => `<div><div style="font-size:12px;opacity:.75;margin-bottom:3px">${n}</div><div style="display:flex;gap:4px;flex-wrap:wrap">${vals.map((v, i) => { const val = Array.isArray(v) ? v[0] : i, lab = Array.isArray(v) ? v[1] : v;
    return `<button data-pzeo="${k}" data-v="${val}" style="font:inherit;font-size:12px;padding:4px 9px;border-radius:6px;border:1px solid rgba(127,140,155,.4);background:${String(P[k]) === String(val) ? '#E1262D' : 'rgba(127,140,155,.12)'};color:${String(P[k]) === String(val) ? '#fff' : 'inherit'};cursor:pointer">${lab}</button>`; }).join('')}</div></div>`).join('')}</div>`; }
  function optWire(upd) { document.querySelectorAll('[data-pzeo]').forEach(b => b.addEventListener('click', () => { const v = b.dataset.v; upd({ [b.dataset.pzeo]: isNaN(+v) ? v : +v }); })); }
  return { open, close, optHtml, optWire, lib: () => S.lib.slice() };
}
