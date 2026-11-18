/* Red DAIMAY · Fase 9 · «Diseñar» en el editor de layout (19-nov-2026): muros, zonas y letreros desde cero, y plantilla de línea de costura.
   Todo vive en el escenario (SCN.dz), se guarda con el escenario, entra al deshacer del editor y a la bitácora («dibujó o cambió … muros, zonas o letreros»).
   - Muro: clic donde empieza y clic donde termina (sigue encadenando; doble clic o Esc termina). Se ajusta a 10 cm y a 15° (Alt: libre).
   - Zona: clic en dos esquinas. Piso de color translúcido, perímetro amarillo, nombre y m².
   - Letrero: clic donde va. Colgante (2.8 m) o pintado en el piso; R lo gira 90°.
   - Plantilla: N mesas de costura con su operador y silla, en 1 o 2 filas, clonadas de una mesa real de la planta. */
const COLS = ['#d8d3c6', '#f2f0ea', '#6b7178', '#2f6fd6', '#2fa84f', '#f2c200', '#f07f1a', '#d93030', '#8e5bd6', '#14b8a6', '#1d2733', '#c9a27a'];
const WALL = { block: { n: 'Block', w: .2, c: '#d8d3c6' }, malla: { n: 'Malla', w: .05, c: '#9aa3ab' }, mampara: { n: 'Mampara', w: .07, c: '#cfd8df' } };
export function init(X) {
  const { THREE, scene, camera, renderer } = X, E = X.ED, G = new THREE.Group(); G.name = 'disenar'; scene.add(G);
  const S = { tool: 'muro', h: 3, wt: 'block', c: null, zn: 'Zona nueva', zc: '#2f6fd6', lt: 'LÍNEA 1', lc: '#1d3f78', lh: 'colg', pts: [], sel: null, tn: 6, tf: 1, tg: .35, last: '' };
  const uid = () => 'dz' + Math.random().toString(36).slice(2, 9), scn = () => X.SCN(), list = () => (scn().dz = scn().dz || []);
  const snap = v => Math.round(v * 10) / 10, esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .8 }, o));
  /* ---------- texturas ---------- */
  const meshTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 3; for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  function board(text, col, w = 1024, h = 256) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(10, 10, w - 20, 6); g.fillRect(10, h - 16, w - 20, 6);
    let fs = 150; g.font = `700 ${fs}px "Barlow Condensed", Arial, sans-serif`; while (fs > 40 && g.measureText(text).width > w - 60) { fs -= 6; g.font = `700 ${fs}px "Barlow Condensed", Arial, sans-serif`; } g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  function tag(text, sub) { const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d'); g.fillStyle = 'rgba(14,19,24,.82)'; g.beginPath(); g.roundRect(4, 4, 504, 152, 18); g.fill();
    g.fillStyle = '#ffffff'; g.font = '700 54px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.fillText(String(text).slice(0, 22), 256, 72); g.fillStyle = '#ffb321'; g.font = '600 34px system-ui, sans-serif'; g.fillText(sub, 256, 126);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); sp.scale.set(5.2, 1.62, 1); sp.renderOrder = 6; return sp; }
  /* ---------- dibujo ---------- */
  const B1 = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
  function build(d) { const g = new THREE.Group(); g.userData.dz = d.id;
    if (d.k === 'muro') { const T = WALL[d.t] || WALL.block, dx = d.b[0] - d.a[0], dz = d.b[1] - d.a[1], L = Math.hypot(dx, dz); if (L < .05) return g;
      const m = d.t === 'malla' ? new THREE.MeshStandardMaterial({ color: d.c || T.c, map: meshTex, alphaMap: meshTex, transparent: true, side: THREE.DoubleSide, roughness: .5, metalness: .5, depthWrite: false }) : mat(d.c || T.c, d.t === 'mampara' ? { roughness: .4 } : {});
      if (d.t === 'malla') m.map.repeat.set(L / .4, d.h / .4);
      const w = new THREE.Mesh(B1, m); w.scale.set(L, d.h, T.w); w.position.set((d.a[0] + d.b[0]) / 2, 0, (d.a[1] + d.b[1]) / 2); w.rotation.y = -Math.atan2(dz, dx); w.castShadow = d.t !== 'malla'; w.receiveShadow = true; g.add(w);
      if (d.t !== 'block') { const pm = mat('#5d666e', { metalness: .6, roughness: .35 }), n = Math.max(1, Math.round(L / 2.4)); for (let i = 0; i <= n; i++) { const t = i / n, p = new THREE.Mesh(B1, pm); p.scale.set(.06, d.h + .05, .06); p.position.set(d.a[0] + dx * t, 0, d.a[1] + dz * t); g.add(p); } }
      else { const cap = new THREE.Mesh(B1, mat('#b8b2a4')); cap.scale.set(L + .02, .06, T.w + .03); cap.position.set(w.position.x, d.h, w.position.z); cap.rotation.y = w.rotation.y; g.add(cap); } }
    else if (d.k === 'zona') { const [a, b] = d.p, x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]), W = x1 - x0, D = z1 - z0;
      const f = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: d.c, transparent: true, opacity: .22, depthWrite: false })); f.position.set((x0 + x1) / 2, .025, (z0 + z1) / 2); f.renderOrder = 2; g.add(f);
      const ym = new THREE.MeshBasicMaterial({ color: '#f2c200' }), st = (cx, cz, sx, sz) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2), ym); s.position.set(cx, .03, cz); s.renderOrder = 3; g.add(s); };
      st((x0 + x1) / 2, z0, W + .1, .1); st((x0 + x1) / 2, z1, W + .1, .1); st(x0, (z0 + z1) / 2, .1, D); st(x1, (z0 + z1) / 2, .1, D);
      const t = tag(d.name || 'Zona', `${(W * D).toFixed(0)} m²`); t.position.set((x0 + x1) / 2, 2.6, (z0 + z1) / 2); g.add(t); }
    else if (d.k === 'letrero') { const hang = d.h !== 'piso', W = Math.max(2, Math.min(8, String(d.t).length * .42 + 1)), Hh = W / 4, tex = board(String(d.t || ''), d.c || '#1d3f78');
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), new THREE.MeshBasicMaterial({ map: tex, side: hang ? THREE.FrontSide : THREE.DoubleSide }));
      if (hang) { pl.position.set(d.p[0], 2.8, d.p[1]); pl.rotation.y = -(d.a || 0); g.add(pl); const bk = pl.clone(); bk.rotation.y += Math.PI; bk.position.x -= Math.sin(-(d.a || 0)) * .004; bk.position.z -= Math.cos(-(d.a || 0)) * .004; g.add(bk); const cm = new THREE.MeshBasicMaterial({ color: '#555c63' });
        for (const s of [-1, 1]) { const cx = d.p[0] + Math.cos(d.a || 0) * s * W * .4, cz = d.p[1] + Math.sin(d.a || 0) * s * W * .4, cb = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 3, 4).translate(0, 1.5, 0), cm); cb.position.set(cx, 2.8 + Hh / 2, cz); g.add(cb); } }
      else { pl.rotation.x = -Math.PI / 2; pl.rotation.z = -(d.a || 0); pl.position.set(d.p[0], .03, d.p[1]); pl.renderOrder = 3; g.add(pl); } }
    return g; }
  let hash = '', SCNref = null;
  function rebuild(force) { const s = scn(); if (!s) return; const h = JSON.stringify(s.dz || []); if (!force && h === hash && s === SCNref) return; hash = h; SCNref = s;
    G.children.slice().forEach(c => { G.remove(c); c.traverse(o => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } }); }); (s.dz || []).forEach(d => G.add(build(d))); selDraw(); }
  setInterval(() => rebuild(false), 500);
  /* ---------- vista previa y selección ---------- */
  const prev = new THREE.Group(); prev.renderOrder = 9; scene.add(prev); const pmat = new THREE.MeshBasicMaterial({ color: '#48c2ff', transparent: true, opacity: .45, depthTest: false });
  function preview(g) { prev.clear(); if (E.tab !== 'dis' || !g) return; const p = [snap(g.x), snap(g.z)];
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .02, 16), pmat); dot.position.set(p[0], .05, p[1]); prev.add(dot);
    if (S.tool === 'muro' && S.pts.length) { const a = S.pts[S.pts.length - 1], b = ang(a, p), L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > .05) { const m = new THREE.Mesh(B1, pmat); m.scale.set(L, S.h, (WALL[S.wt] || WALL.block).w); m.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2); m.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); prev.add(m); } }
    if (S.tool === 'zona' && S.pts.length) { const a = S.pts[0], W = Math.abs(p[0] - a[0]), D = Math.abs(p[1] - a[1]); if (W > .05 && D > .05) { const f = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), pmat); f.position.set((a[0] + p[0]) / 2, .04, (a[1] + p[1]) / 2); prev.add(f); } }
    if (S.tool === 'linea') { tplPts(p).forEach(q => { const m = new THREE.Mesh(B1, pmat); m.scale.set(q.L, .75, q.D); m.position.set(q.x, 0, q.z); m.rotation.y = -q.a; prev.add(m); }); } }
  const ang = (a, p) => { if (S.free) return p; const dx = p[0] - a[0], dz = p[1] - a[1], L = Math.hypot(dx, dz), t = Math.round(Math.atan2(dz, dx) / (Math.PI / 12)) * (Math.PI / 12); return [snap(a[0] + Math.cos(t) * L), snap(a[1] + Math.sin(t) * L)]; };
  const sel = new THREE.Group(); scene.add(sel);
  function selDraw() { sel.clear(); const d = list().find(x => x.id === S.sel); if (!d) return; const box = new THREE.Box3().setFromObject(G.children.find(c => c.userData.dz === d.id) || new THREE.Object3D()); if (box.isEmpty()) return;
    const h = new THREE.Box3Helper(box.expandByScalar(.08), new THREE.Color('#48c2ff')); h.material.depthTest = false; h.renderOrder = 10; sel.add(h); }
  function pickAt(p) { let best = null, bd = 1e9; for (const d of list()) { let dd = 1e9;
      if (d.k === 'muro') { const ax = d.a[0], az = d.a[1], bx = d.b[0] - ax, bz = d.b[1] - az, L2 = bx * bx + bz * bz || 1, t = Math.max(0, Math.min(1, ((p[0] - ax) * bx + (p[1] - az) * bz) / L2)); dd = Math.hypot(p[0] - ax - bx * t, p[1] - az - bz * t); if (dd > .6) dd = 1e9; }
      else if (d.k === 'zona') { const [a, b] = d.p; if (p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1])) dd = .9; }
      else if (d.k === 'letrero') { dd = Math.hypot(p[0] - d.p[0], p[1] - d.p[1]); if (dd > 2.5) dd = 1e9; }
      if (dd < bd) { bd = dd; best = d; } } return best; }
  /* ---------- plantilla de línea de costura ---------- */
  function tplSrc() { if (tplSrc.c !== undefined) return tplSrc.c; const objs = [...X.OBJS.values()].filter(o => !o.added && !o.del);
    const st = objs.find(o => o.kind === 'equip' && /DECORADO|COSTURA|Costura · módulo|Máquina de coser|CERRADO/.test(o.name || '') && o.l < 1.6 && o.d < 1.3), ops = objs.filter(o => o.kind === 'op' && /sentado con silla/.test(o.name || ''));
    if (!st || !ops.length) return (tplSrc.c = null); const c = [st.p[0], st.p[1]]; let op = null, bd = 9; for (const o of ops) { const d = Math.hypot(o.p[0] - c[0], o.p[1] - c[1]); if (d < bd) { bd = d; op = o; } }
    if (!op || bd > 1.6) return (tplSrc.c = null); const a = st.a || 0, ca = Math.cos(a), sa = Math.sin(a), dx = op.p[0] - c[0], dz = op.p[1] - c[1];
    return (tplSrc.c = { st, op, u: dx * ca + dz * sa, v: -dx * sa + dz * ca, a }); }
  function tplPts(p) { const T = tplSrc(); if (!T) return []; const L = T.st.l, D = T.st.d, out = []; const pitch = L + S.tg;
    for (let r = 0; r < S.tf; r++) for (let i = 0; i < S.tn; i++) { const flip = r === 1, x = p[0] + i * pitch - (S.tn - 1) * pitch / 2, z = p[1] + (flip ? D + 1.4 : 0); out.push({ x, z, L, D, a: flip ? Math.PI : 0, flip }); } return out; }
  function tplPlace(p) { const T = tplSrc(); if (!T) return; const s = scn(); s.adds = s.adds || []; const nw = [];
    for (const q of tplPts(p)) { const ra = q.a - T.a, cc = Math.cos(q.a), ss = Math.sin(q.a), id1 = 'x' + Math.random().toString(36).slice(2, 10), id2 = 'x' + Math.random().toString(36).slice(2, 10);
      s.adds.push({ id: id1, src: T.st.id, p: [+q.x.toFixed(3), +q.z.toFixed(3)], a: +ra.toFixed(4) });
      s.adds.push({ id: id2, src: T.op.id, p: [+(q.x + T.u * cc - T.v * ss).toFixed(3), +(q.z + T.u * ss + T.v * cc).toFixed(3)], a: +ra.toFixed(4) }); nw.push(id1, id2); }
    X.edApplyAll(); X.edSave(); X.edToast(`Línea creada: ${S.tn * S.tf} mesas con su operador y silla. Muévela o ajústala con «Selección».`); }
  /* ---------- clics en el piso ---------- */
  function click(g, e) { if (!g) return; const p = [snap(g.x), snap(g.z)];
    if (S.tool === 'sel') { const d = pickAt(p); S.sel = d ? d.id : null; selDraw(); render(); return; }
    if (S.tool === 'muro') { if (!S.pts.length) { S.pts = [p]; render(); return; } const a = S.pts[S.pts.length - 1], b = ang(a, p); if (Math.hypot(b[0] - a[0], b[1] - a[1]) < .1) return;
      list().push({ id: uid(), k: 'muro', a, b, h: S.h, t: S.wt, c: S.c || undefined }); S.pts.push(b); commit(); return; }
    if (S.tool === 'zona') { if (!S.pts.length) { S.pts = [p]; render(); return; } const a = S.pts[0]; if (Math.abs(p[0] - a[0]) < .3 || Math.abs(p[1] - a[1]) < .3) return;
      const d = { id: uid(), k: 'zona', p: [a, p], name: S.zn || 'Zona', c: S.zc }; list().push(d); S.pts = []; S.sel = d.id; commit(); return; }
    if (S.tool === 'letrero') { const d = { id: uid(), k: 'letrero', p, a: 0, t: S.lt || 'LETRERO', c: S.lc, h: S.lh === 'piso' ? 'piso' : 'colg' }; list().push(d); S.sel = d.id; commit(); return; }
    if (S.tool === 'linea') { tplPlace(p); return; } }
  function commit() { rebuild(true); X.edSave(); render(); }
  function finish() { S.pts = []; prev.clear(); render(); }
  renderer.domElement.addEventListener('pointermove', e => { if (E.tab !== 'dis' || X.tool() !== 'move') { if (prev.children.length) prev.clear(); return; } const [x, y] = X.ndcOf(e); S.free = e.altKey; preview(X.groundAtNDC(x, y)); });
  renderer.domElement.addEventListener('dblclick', e => { if (E.tab === 'dis') finish(); });
  addEventListener('keydown', e => { if (E.tab !== 'dis') return; const tg = e.target.tagName; if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
    if (e.key === 'Escape') { finish(); S.sel = null; selDraw(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); del(S.sel); }
    if ((e.key === 'r' || e.key === 'R') && S.sel) { const d = list().find(x => x.id === S.sel); if (d && d.k === 'letrero') { d.a = ((d.a || 0) + Math.PI / 2) % (Math.PI * 2); commit(); } } });
  function del(id) { const s = scn(); s.dz = list().filter(x => x.id !== id); if (S.sel === id) S.sel = null; commit(); }
  /* ---------- panel ---------- */
  const TOOLS = [['muro', 'Muro', '▭'], ['zona', 'Zona', '▦'], ['letrero', 'Letrero', 'Aa'], ['linea', 'Línea de costura', '⊞'], ['sel', 'Seleccionar', '↖']];
  const sw = (cur, attr) => `<div class="ed-tones">${COLS.map(c => `<button ${attr}="${c}" style="background:${c}" title="${c}" class="${cur === c ? 'on' : ''}"></button>`).join('')}</div>`;
  const seg = (k, opts, cur) => `<div class="dz-seg">${opts.map(([v, n]) => `<button data-dzs="${k}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${n}</button>`).join('')}</div>`;
  function render() { const box = document.getElementById('ed-dis'); if (!box) return; const L = list(), d = L.find(x => x.id === S.sel), T = tplSrc();
    const opts = S.tool === 'muro' ? `<span class="ed-lbl">Alto</span>${seg('h', [[3, '3 m'], [4.5, '4.5 m'], [6, '6 m'], [9, '9 m']], S.h)}<span class="ed-lbl">Tipo</span>${seg('wt', Object.entries(WALL).map(([k, v]) => [k, v.n]), S.wt)}<span class="ed-lbl">Color</span>${sw(S.c || (WALL[S.wt] || WALL.block).c, 'data-dzc')}
        <p class="dz-tip">${S.pts.length ? 'Clic para el siguiente punto · doble clic o Esc para terminar.' : 'Clic donde empieza el muro y clic donde termina. Se ajusta a 10 cm y a 15° (mantén Alt para ángulo libre).'}</p>`
      : S.tool === 'zona' ? `<label class="ed-lbl">Nombre<input id="dzZn" value="${esc(S.zn)}" maxlength="40"></label><span class="ed-lbl">Color</span>${sw(S.zc, 'data-dzz')}<p class="dz-tip">${S.pts.length ? 'Ahora clic en la esquina opuesta.' : 'Clic en una esquina y luego en la esquina opuesta.'}</p>`
      : S.tool === 'letrero' ? `<label class="ed-lbl">Texto<input id="dzLt" value="${esc(S.lt)}" maxlength="40"></label><span class="ed-lbl">Dónde</span>${seg('lh', [['colg', 'Colgante'], ['piso', 'En el piso']], S.lh)}<span class="ed-lbl">Color</span>${sw(S.lc, 'data-dzl')}<p class="dz-tip">Clic donde va. Con «Seleccionar» lo eliges y R lo gira.</p>`
      : S.tool === 'linea' ? (T ? `<span class="ed-lbl">Mesas por fila</span><input id="dzTn" type="number" min="1" max="30" value="${S.tn}"><span class="ed-lbl">Filas</span>${seg('tf', [[1, '1 fila'], [2, '2 filas (frente a frente)']], S.tf)}<span class="ed-lbl">Separación entre mesas</span>${seg('tg', [[.1, '10 cm'], [.35, '35 cm'], [.8, '80 cm']], S.tg)}
          <p class="dz-tip">Se copian la mesa «${esc(T.st.name)}» y su operador con silla. Clic donde va el centro de la línea.</p>` : '<p class="dz-tip">Esta planta no tiene mesas de costura para copiar.</p>')
      : `<p class="dz-tip">Clic sobre un muro, zona o letrero para elegirlo. Supr lo borra.</p>`;
    const props = d ? `<div class="dz-card"><b>${d.k === 'muro' ? 'Muro' : d.k === 'zona' ? 'Zona' : 'Letrero'}</b>${d.k === 'zona' ? `<label class="ed-lbl">Nombre<input id="dzEn" value="${esc(d.name)}" maxlength="40"></label>${sw(d.c, 'data-dzec')}` : d.k === 'letrero' ? `<label class="ed-lbl">Texto<input id="dzEt" value="${esc(d.t)}" maxlength="40"></label>${sw(d.c, 'data-dzec')}<button data-dza="rot">Girar 90°</button>` : `${seg('eh', [[3, '3 m'], [4.5, '4.5 m'], [6, '6 m'], [9, '9 m']], d.h)}${sw(d.c || (WALL[d.t] || WALL.block).c, 'data-dzec')}`}<button data-dza="del" class="dz-del">Borrar</button></div>` : '';
    box.innerHTML = `<div class="dz-tools">${TOOLS.map(([k, n, ic]) => `<button data-dzt="${k}" aria-pressed="${S.tool === k}"><i>${ic}</i>${n}</button>`).join('')}</div>${opts}${props}
      <div class="ed-lbl" style="margin-top:10px">En este escenario · ${L.filter(x => x.k === 'muro').length} muros · ${L.filter(x => x.k === 'zona').length} zonas · ${L.filter(x => x.k === 'letrero').length} letreros</div>
      <div class="dz-list">${L.slice().reverse().slice(0, 40).map(x => `<button data-dzi="${x.id}" aria-pressed="${x.id === S.sel}">${x.k === 'muro' ? '▭ Muro ' + Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]).toFixed(1) + ' m' : x.k === 'zona' ? '▦ ' + esc(x.name) : 'Aa ' + esc(x.t)}</button>`).join('')}</div>`; }
  document.addEventListener('click', e => { const box = document.getElementById('ed-dis'); if (!box || !box.contains(e.target)) return; const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.dzt) { S.tool = b.dataset.dzt; S.pts = []; prev.clear(); render(); return; }
    if (b.dataset.dzs) { const k = b.dataset.dzs, v = b.dataset.v; if (k === 'eh') { const d = list().find(x => x.id === S.sel); if (d) { d.h = +v; commit(); } return; } S[k] = ['h', 'tf', 'tg'].includes(k) ? +v : v; if (k === 'wt') S.c = null; render(); return; }
    if (b.dataset.dzc) { S.c = b.dataset.dzc; render(); return; } if (b.dataset.dzz) { S.zc = b.dataset.dzz; render(); return; } if (b.dataset.dzl) { S.lc = b.dataset.dzl; render(); return; }
    if (b.dataset.dzec) { const d = list().find(x => x.id === S.sel); if (d) { d.c = b.dataset.dzec; commit(); } return; }
    if (b.dataset.dzi) { S.sel = b.dataset.dzi; S.tool = 'sel'; selDraw(); render(); return; }
    if (b.dataset.dza === 'del' && S.sel) del(S.sel);
    if (b.dataset.dza === 'rot' && S.sel) { const d = list().find(x => x.id === S.sel); if (d) { d.a = ((d.a || 0) + Math.PI / 2) % (Math.PI * 2); commit(); } } });
  document.addEventListener('change', e => { const t = e.target; if (!t.closest?.('#ed-dis')) return;
    if (t.id === 'dzZn') S.zn = t.value; if (t.id === 'dzLt') S.lt = t.value; if (t.id === 'dzTn') S.tn = Math.max(1, Math.min(30, +t.value || 1));
    const d = list().find(x => x.id === S.sel); if (d && t.id === 'dzEn') { d.name = t.value; commit(); } if (d && t.id === 'dzEt') { d.t = t.value; commit(); } });
  const st = document.createElement('style'); st.textContent = `#ed-dis .dz-tools{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px}#ed-dis .dz-tools button{display:grid;gap:2px;place-items:center;padding:8px 4px;min-height:52px;font:inherit;font-size:12px;color:inherit;background:rgba(127,140,155,.12);border:1px solid rgba(127,140,155,.3);border-radius:9px;cursor:pointer}
#ed-dis .dz-tools button i{font-style:normal;font-size:17px;font-weight:700}#ed-dis button[aria-pressed="true"]{background:#48c2ff;border-color:#48c2ff;color:#03121c}
#ed-dis .dz-seg{display:flex;gap:4px;flex-wrap:wrap;margin:3px 0 8px}#ed-dis .dz-seg button,#ed-dis .dz-list button,#ed-dis .dz-card button{font:inherit;font-size:12px;color:inherit;background:rgba(127,140,155,.12);border:1px solid rgba(127,140,155,.3);border-radius:7px;padding:5px 9px;min-height:30px;cursor:pointer}
#ed-dis input{width:100%;box-sizing:border-box;margin:3px 0 8px}#ed-dis .dz-tip{font-size:12px;opacity:.75;margin:6px 0}#ed-dis .dz-card{border:1px solid rgba(72,194,255,.5);border-radius:9px;padding:8px;margin:8px 0;display:grid;gap:6px}
.ed-opq{display:grid;grid-template-columns:repeat(8,1fr);gap:5px;margin:4px 0 10px}.ed-opq button{aspect-ratio:1;min-height:26px;border-radius:7px;border:1px solid rgba(0,0,0,.35);box-shadow:inset 0 0 0 1px rgba(255,255,255,.15);cursor:pointer;padding:0}.ed-opq button:hover{transform:scale(1.08)}
#ed-dis .dz-del{color:#ff6b62!important}#ed-dis .dz-list{display:flex;flex-direction:column;gap:3px;max-height:180px;overflow:auto}#ed-dis .dz-list button{text-align:left}`; document.head.appendChild(st);
  rebuild(true);
  return { click, render, rebuild: () => rebuild(true), finish, state: () => ({ ...S, n: list().length, tpl: !!tplSrc() }) };
}
