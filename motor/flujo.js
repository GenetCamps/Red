/* Red DAIMAY · Fase 5 · flujo animado de los yamazumis de operaciones (lo usan motor/visor.js y motor/yamaops.js).
   - Se eligen hasta 30 personas (operaciones) de uno o varios yamazumis del escenario.
   - Aros, tarimas, piezas, columnas de nivel, piezas en la mano o en tránsito y flechas se dibujan por lotes (un InstancedMesh por tipo
     para todas las personas), así 30 personas no cuestan más que 10 antes.
   - Cada una se enlaza con un clic a su estación en el gemelo 3D; se indica si camina y a quién le entrega (el flujo lo define el usuario).
   - La simulación usa los ciclos medidos, no el promedio: los reparte en orden aleatorio y los repite, así el retrabajo aparece con la frecuencia con que se midió.
   - Las piezas avanzan de una operación a la siguiente y se acumulan frente a la que no da el ritmo: ese es el cuello de botella.
   Nada de esto cambia datos del gemelo: solo dibuja. Lo único que se guarda es el enlace, quién camina y a quién entrega (en SCN.yz). */
const CSS = `
#vzFlow{position:fixed;box-sizing:border-box;left:14px;bottom:14px;z-index:60;width:min(520px,calc(100vw - 28px));max-height:min(62vh,560px);overflow:auto;background:rgba(13,18,24,.94);border:1px solid var(--line,#27323e);border-radius:10px;padding:12px 14px;color:var(--ink,#e7ebef);font:13px/1.4 system-ui,'Segoe UI',sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45)}
#vzFlow h4{margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;gap:10px;align-items:center}
#vzFlow .fl-ctl{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}
#vzFlow button{background:var(--raise,#1b232c);border:1px solid var(--line,#27323e);border-radius:6px;color:inherit;font:inherit;padding:5px 9px;cursor:pointer;min-height:30px}
#vzFlow button.on{background:#FFB020;border-color:#FFB020;color:#12181F;font-weight:600}
#vzFlow button:focus-visible{outline:2px solid #FFB020;outline-offset:2px}
#vzFlow .fl-sep{width:1px;height:20px;background:var(--line,#27323e);margin:0 2px}
#vzFlow table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
#vzFlow th,#vzFlow td{padding:4px 6px;text-align:right;border-bottom:1px solid #1f2933;white-space:nowrap}
#vzFlow th{font-weight:600;color:var(--dim,#a9b3bd);font-size:12px}
#vzFlow th:first-child,#vzFlow td:first-child{text-align:left;white-space:normal}
#vzFlow td i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}
#vzFlow tr.neck td{color:#ff7a70;font-weight:600}
#vzFlow.compact .fl-ctl,#vzFlow.compact table{display:none} #vzFlow.compact{width:min(430px,calc(100vw - 28px))} #vzFlow.compact .fl-sum{margin-top:0}
#vzFlow .fl-sum{margin-top:8px;color:var(--dim,#a9b3bd)} #vzFlow .fl-sum b{color:var(--ink,#e7ebef)}
#vzLink{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:60;background:rgba(13,18,24,.95);border:1px solid #FFB020;border-radius:10px;padding:10px 14px;color:#e7ebef;font:13px/1.4 system-ui,'Segoe UI',sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 28px);box-shadow:0 10px 30px rgba(0,0,0,.45)}
#vzLink b{color:#FFB020} #vzLink button{background:#1b232c;border:1px solid #27323e;border-radius:6px;color:inherit;font:inherit;padding:5px 9px;cursor:pointer;min-height:30px}
`;
import { win } from './ventanas.js';
export const MAX = 30;
export function create(api) {
  const { THREE, scene, ctx, esc, fmtN } = api;
  const stl = document.createElement('style'); stl.textContent = CSS; document.head.appendChild(stl);
  const vida = () => window.__vida, rd = () => window.__rd || {};
  const all = () => { const S = api.S(), out = []; (Array.isArray(S?.yz) ? S.yz : []).forEach(Y => Y.ops.forEach(o => out.push({ Y, o }))); return out; };
  const scope = () => { let Y = null; try { Y = api.yz?.(); } catch (_) {} if (!Y) return null; const s = new Set([Y.id]); if (Y.junto && (api.S()?.yz || []).some(q => q.id === Y.junto)) s.add(Y.junto); return s; };
  const anim = () => { const s = scope(); return all().filter(x => x.o.anim && (!s || s.has(x.Y.id))); };
  const byId = id => all().find(x => x.o.id === id) || null;
  const short = o => o.est ? `${o.est} ${o.pos} ${o.lado}` : o.name;
  const who = o => o.oper ? `${short(o)} · ${o.oper}` : o.name;
  const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;

  /* ---------- elegir quién se anima ---------- */
  function toggle(id, v) { const x = byId(id); if (!x) return ''; const on = v === undefined ? !x.o.anim : !!v;
    if (on && !x.o.anim && anim().length >= MAX) return `Ya hay ${MAX} personas elegidas para animar en este yamazumi. Quita una antes de agregar otra.`;
    x.o.anim = on; api.save(); return ''; }

  /* ---------- dibujo auxiliar en 3D ---------- */
  let G = null;
  const clearG = () => { if (!G) return; scene.remove(G); G.traverse(m => { m.geometry?.dispose(); if (m.material) { m.material.map?.dispose(); m.material.dispose(); } }); G = null; };
  const newG = () => { clearG(); G = new THREE.Group(); scene.add(G); return G; };
  function ring(x, z, col, r = .85) { const g = new THREE.RingGeometry(r - .16, r, 36); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .95, depthTest: false, depthWrite: false, side: THREE.DoubleSide })); m.position.set(x, .06, z); m.renderOrder = 61; return m; }
  function label() { const c = document.createElement('canvas'); c.width = 448; c.height = 128; const tex = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })); sp.scale.set(4.2, 1.2, 1); sp.renderOrder = 70; sp.userData = { c, tex, key: '' }; return sp; }
  function chipLabel() { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const tex = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })); sp.scale.set(.9, .9, 1); sp.renderOrder = 70; sp.userData = { c, tex, key: '' }; return sp; }
  let PB = 6;   // letreros que se pueden repintar por cuadro; los demás se pintan en los siguientes (evita tirones con 30 personas)
  function paintChip(sp, txt, col) { const key = txt + '|' + col, u = sp.userData; if (u.key === key || PB <= 0) return; PB--; u.key = key; const g = u.c.getContext('2d');
    g.clearRect(0, 0, 128, 128); g.fillStyle = col; g.beginPath(); g.arc(64, 64, txt ? 58 : 30, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(13,18,24,.85)'; g.lineWidth = 8; g.stroke();
    if (txt) { g.fillStyle = col === '#FFB020' ? '#12181F' : '#ffffff'; g.font = `700 ${txt.length > 2 ? 46 : 60}px system-ui, Segoe UI, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 64, 68); } u.tex.needsUpdate = true; }
  function paint(sp, l1, l2, col) { const key = l1 + '|' + l2 + '|' + col, u = sp.userData; if (u.key === key || PB <= 0) return; PB -= 2; u.key = key; const g = u.c.getContext('2d'), W = u.c.width, H = u.c.height;
    g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(13,18,24,.9)'; g.beginPath(); g.roundRect(2, 2, W - 4, H - 4, 16); g.fill(); g.fillStyle = col; g.beginPath(); g.roundRect(2, 2, 16, H - 4, [16, 0, 0, 16]); g.fill();
    g.fillStyle = '#e7ebef'; g.font = '600 34px system-ui, Segoe UI, sans-serif'; g.textBaseline = 'middle'; g.fillText(cut(l1, 24), 30, 42); g.fillStyle = col === '#7c8a97' ? '#a9b3bd' : col; g.font = '600 30px system-ui, Segoe UI, sans-serif'; g.fillText(cut(l2, 28), 30, 90); u.tex.needsUpdate = true; }
  function arrow(a, b, col) { const g = new THREE.Group(), dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < .3) return g;
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], .1, a[1]), new THREE.Vector3(b[0], .1, b[1])]); const ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: .8, depthTest: false })); ln.renderOrder = 60; g.add(ln);
    const cg = new THREE.ConeGeometry(.22, .6, 12); cg.rotateZ(-Math.PI / 2); const cn = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: col, depthTest: false })); cn.position.set(a[0] + dx * .55, .1, a[1] + dz * .55); cn.rotation.y = -Math.atan2(dz, dx); cn.renderOrder = 60; g.add(cn); return g; }

  /* ---------- enlazar con clic en el gemelo ---------- */
  let LK = null, chip = null, pd = null;
  const cv = () => rd().renderer?.domElement;
  const RC = new THREE.Raycaster(), PL = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), V3 = new THREE.Vector3();
  function ground(e) { const c = cv(), cam = rd().camera; if (!c || !cam) return null; const r = c.getBoundingClientRect();
    RC.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam); return RC.ray.intersectPlane(PL, V3) ? [V3.x, V3.z] : null; }
  const onDown = e => { pd = [e.clientX, e.clientY]; };
  const onUp = e => { if (!LK || !pd) return; const d = Math.hypot(e.clientX - pd[0], e.clientY - pd[1]); pd = null; if (d > 6 || e.button > 0) return; const p = ground(e); if (p) place(p); };
  const listen = on => { const c = cv(); if (!c) return; c[on ? 'addEventListener' : 'removeEventListener']('pointerdown', onDown, true); c[on ? 'addEventListener' : 'removeEventListener']('pointerup', onUp, true); };
  function linkMarks() { const g = newG(); anim().concat(LK ? LK.q.filter(x => !x.o.anim) : []).forEach(x => { if (!x.o.link) return; const cur = LK && LK.q[LK.i] === x; g.add(ring(x.o.link.x, x.o.link.z, cur ? '#FFB020' : '#199e70'));
      const sp = label(); paint(sp, short(x.o), x.o.oper || (x.o.link.oid != null ? 'figura del gemelo' : 'punto libre'), '#199e70'); sp.position.set(x.o.link.x, 2.7, x.o.link.z); g.add(sp); }); }
  function chipLink() { chip?.remove(); const x = LK.q[LK.i]; chip = document.createElement('div'); chip.id = 'vzLink';
    chip.innerHTML = `<span>Haz clic en la estación de <b>${esc(who(x.o))}</b> (${LK.i + 1} de ${LK.q.length})</span><button data-k="skip">Saltar</button><button data-k="end">Terminar</button>`;
    chip.addEventListener('click', e => { const k = e.target.closest('button')?.dataset.k; if (k === 'skip') next(); else if (k === 'end') endLink(); }); document.body.appendChild(chip); }
  function next() { LK.i++; if (LK.i >= LK.q.length) endLink(); else { chipLink(); linkMarks(); } }
  function place(p) { const x = LK.q[LK.i], n = vida()?.nearestOp?.(p[0], p[1], 1.5);
    x.o.link = n ? { x: +n.x.toFixed(2), z: +n.z.toFixed(2), oid: n.id } : { x: +p[0].toFixed(2), z: +p[1].toFixed(2) }; api.save(); next(); }
  function link(ids) { stop(); const q = (ids || []).map(byId).filter(Boolean); if (!q.length) return; LK = { q, i: 0 }; api.hideReport(); listen(true); chipLink(); linkMarks(); }
  function endLink() { if (!LK) return; LK = null; listen(false); chip?.remove(); chip = null; clearG(); api.showReport(); }
  function unlink(id) { const x = byId(id); if (x) { delete x.o.link; api.save(); } }

  /* ---------- simulación ---------- */
  let SIM = null, hud = null;
  const BOX = new THREE.BoxGeometry(.32, .32, .32), CAP = 54, UNIT = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), DISC = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  const LVL = { ok: '#199e70', wip: '#FFB020', neck: '#ff5a4f' };
  const COL = { work: '#199e70', idle: '#7c8a97', wip: '#FFB020', neck: '#ff5a4f' };

  /* ---------- lotes: un InstancedMesh por tipo de marca para todas las personas ---------- */
  const RINGG = (() => { const gg = new THREE.RingGeometry(.69, .85, 36); gg.rotateX(-Math.PI / 2); return gg; })(), CONEG = (() => { const cg = new THREE.ConeGeometry(.22, .6, 12); cg.rotateZ(-Math.PI / 2); return cg; })();
  const IM = (geo, mat, n, o = {}) => { const im = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); im.count = 0; im.frustumCulled = false; im.raycast = () => {}; im.userData.noLote = true; if (o.ro != null) im.renderOrder = o.ro; im.castShadow = !!o.cast; return im; };
  const _o = new THREE.Object3D(), _cc = new THREE.Color();
  function batches(N, g) { const n = N.length;
    const B = { rings: IM(RINGG, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .95, depthTest: false, depthWrite: false, side: THREE.DoubleSide }), n, { ro: 61 }),
      pals: IM(UNIT, new THREE.MeshStandardMaterial({ color: '#8a6a43', roughness: .9 }), n, { cast: true }),
      wip: IM(BOX, new THREE.MeshStandardMaterial({ color: '#e0a23a', roughness: .7 }), n * CAP),
      lvl: IM(UNIT, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .85, depthWrite: false }), n),
      hand: IM(BOX, new THREE.MeshStandardMaterial({ color: '#e0a23a', roughness: .7 }), n), fly: IM(BOX, null, 256),
      stain: new THREE.Mesh(DISC, new THREE.MeshBasicMaterial({ color: LVL.neck, transparent: true, opacity: .28, depthWrite: false })) };
    B.fly.material = B.hand.material; B.stain.renderOrder = 59; B.stain.visible = false;
    N.forEach((p, i) => { _o.position.set(p.x, .06, p.z); _o.rotation.set(0, 0, 0); _o.scale.set(1, 1, 1); _o.updateMatrix(); B.rings.setMatrixAt(i, _o.matrix); B.rings.setColorAt(i, _cc.set(COL.idle));
      _o.position.set(p.wp[0], 0, p.wp[1]); _o.rotation.set(0, p.yaw, 0); _o.scale.set(1.2, .12, 1.2); _o.updateMatrix(); B.pals.setMatrixAt(i, _o.matrix);
      B.lvl.setColorAt(i, _cc.set(LVL.ok)); p.i = i; p.dq = 0; });
    B.rings.count = n; B.pals.count = n; B.lvl.count = n;
    Object.values(B).forEach(x => g.add(x)); g.userData.B = B; return B; }
  function arrows(N, g) { const pts = [], cones = [];
    N.forEach(n => { if (!n.nx) return; const a = [n.x, n.z], b = [n.nx.x, n.nx.z], dx = b[0] - a[0], dz = b[1] - a[1]; if (Math.hypot(dx, dz) < .3) return;
      pts.push(new THREE.Vector3(a[0], .1, a[1]), new THREE.Vector3(b[0], .1, b[1])); cones.push([a[0] + dx * .55, a[1] + dz * .55, -Math.atan2(dz, dx)]); });
    if (!pts.length) return; const ln = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#8fb7ff', transparent: true, opacity: .8, depthTest: false })); ln.renderOrder = 60; ln.raycast = () => {}; g.add(ln);
    const cn = IM(CONEG, new THREE.MeshBasicMaterial({ color: '#8fb7ff', depthTest: false }), cones.length, { ro: 60 });
    cones.forEach(([x, z, r], i) => { _o.position.set(x, .1, z); _o.rotation.set(0, r, 0); _o.scale.set(1, 1, 1); _o.updateMatrix(); cn.setMatrixAt(i, _o.matrix); }); cn.count = cones.length; g.add(cn); }
  function draw(n) { if (!n.bag.length) { const c = (n.o.cycles || []).map(x => +x.t).filter(t => t > 0); if (!c.length) c.push(60);
      for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } n.bag = c; } return n.bag.pop(); }
  function start() {
    const V = vida(); if (!V?.drive) return 'La capa de operadores del gemelo no está disponible en esta página.';
    const A = anim(), L = A.filter(x => x.o.link); if (!A.length) return 'Marca con ▶ a las personas que quieres animar.';
    if (!L.length) return 'Ninguna de las personas elegidas está enlazada a su estación. Usa «Enlazar en 3D».';
    stop(); endLink(); api.hideReport(); const g = newG();
    const N = L.map(({ Y, o }) => { const h = V.drive('yz' + o.id, { oid: o.link.oid, x: o.link.x, z: o.link.z }), yaw = h.yaw, f = [Math.cos(-yaw), Math.sin(-yaw)], sd = [-f[1], f[0]];
      const n = { Y, o, h, x: h.x, z: h.z, yaw, f, sd, takt: +Y.takt || 0, q: 0, fly: 0, busy: false, rem: 0, dur: 0, bag: [], done: 0, tw: 0, ts: 0, nx: null, preds: 0, arr: 0, st: '' };
      n.wp = [n.x + sd[0] * .95, n.z + sd[1] * .95];
      n.sp = label(); n.sp.position.set(n.x, 2.75, n.z); g.add(n.sp); n.dot = chipLabel(); n.dot.position.set(n.x, 2.35, n.z); g.add(n.dot); return n; });
    batches(N, g);
    N.forEach(n => { n.nx = N.find(m => m.o.id === n.o.next && m !== n) || null; if (n.nx) n.nx.preds++; });
    arrows(N, g);
    const tk = N.map(n => n.takt).find(t => t > 0) || 0; N.forEach(n => { n.tk = n.takt || tk; n.arr = n.tk; });
    SIM = { N, g, labels: 'min', hov: null, pin: null, clock: 0, out: 0, speed: 10, feed: tk ? 'takt' : 'libre', tk, pause: false, F: [], ui: 0, miss: A.length - L.length };
    S0hover(true); V.ext(tick); openHud();
    const xs = N.map(n => n.x), zs = N.map(n => n.z), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2, ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    try { ctx.goOrbit(cx, cz, Math.max(16, ext * 1.5), ctx.orbit.T.th, .95); } catch (_) {}
    return '';
  }
  function stepNode(n, h, S) {
    if (!n.preds) { if (S.feed === 'takt' && n.tk > 0) { n.arr += h; while (n.arr >= n.tk) { n.arr -= n.tk; n.q++; } } else if (n.q < 1) n.q = 1; }
    if (!n.busy && n.q > 0) { n.q--; n.dur = draw(n); n.rem = n.dur; n.busy = true; }
    if (n.busy) { n.rem -= h; n.tw += h; if (n.rem <= 0) { n.busy = false; n.done++; if (n.nx) { n.nx.q++; if (!n.o.walk) { n.nx.fly++; S.F.push({ a: [n.x, n.z], n: n.nx, t: 0, m: null }); } } else S.out++; } }
    else n.ts += h;
  }
  const M4 = new THREE.Matrix4();
  function tick(dt, st) {
    const S = SIM; if (!S) return; PB = 6; const rdt = Math.min(dt, .25);
    if (!S.pause && st.playing !== false) { let left = rdt * S.speed; while (left > 1e-9) { const h = Math.min(.5, left); left -= h; S.clock += h; for (const n of S.N) stepNode(n, h, S); } }
    // piezas en tránsito (solo dibujo)
    const B = S.g.userData.B; let nf = 0;
    for (let i = S.F.length - 1; i >= 0; i--) { const f = S.F[i]; f.t += rdt / .8; const k = Math.min(1, f.t), b = f.n.wp;
      if (k >= 1) { f.n.fly = Math.max(0, f.n.fly - 1); S.F.splice(i, 1); continue; }
      if (nf < 256) { M4.makeTranslation(f.a[0] + (b[0] - f.a[0]) * k, 1 + Math.sin(Math.PI * k) * 1.1 - k * .8, f.a[1] + (b[1] - f.a[1]) * k); B.fly.setMatrixAt(nf++, M4); } }
    B.fly.count = nf; B.fly.instanceMatrix.needsUpdate = true;
    let neck = null; for (const n of S.N) { const q = Math.max(0, n.q - n.fly); n.dq = q; if (q > (n.qmax || 0)) n.qmax = q; if (q >= 2 && (!neck || q > neck.dq)) neck = n; } S.neck = neck;
    let nh = 0, wipDirty = false, neckDone = false;
    for (const n of S.N) {
      // operador
      let s = { mode: n.busy ? 'work' : 'idle' };
      if (n.busy && n.o.walk) { const u = 1 - n.rem / Math.max(1e-6, n.dur), T = n.nx ? [n.nx.x, n.nx.z] : [n.x + n.sd[0] * -2.5, n.z + n.sd[1] * -2.5]; let dx = T[0] - n.x, dz = T[1] - n.z, L = Math.hypot(dx, dz);
        if (u > .7 && L > .5) { const D = Math.max(.3, L - .8), go = u < .85, k = go ? (u - .7) / .15 : 1 - (u - .85) / .15, e = k * k * (3 - 2 * k), ux = dx / L, uz = dz / L, x = n.x + ux * D * e, z = n.z + uz * D * e, yaw = -Math.atan2(go ? uz : -uz, go ? ux : -ux);
          s = { mode: 'walk', x, z, yaw, dist: D * e, carry: go }; if (go) { M4.makeTranslation(x + ux * .38, 1.05, z + uz * .38); B.hand.setMatrixAt(nh++, M4); } } }
      n.h.set(s);
      // inventario frente a la estación
      const q = Math.min(CAP, n.dq); if (n.wq !== q) { n.wq = q; wipDirty = true; }
      { const neckN = n === S.neck, h = n.dq > 0 ? Math.min(4, .15 + n.dq * .12) : 0, lc = neckN ? LVL.neck : n.dq >= 2 ? LVL.wip : LVL.ok;
        _o.position.set(n.wp[0] + n.sd[0] * .85, 0, n.wp[1] + n.sd[1] * .85); _o.rotation.set(0, 0, 0); _o.scale.set(.18, h || 1e-4, .18); _o.updateMatrix(); B.lvl.setMatrixAt(n.i, _o.matrix);
        if (n.lc !== lc) { n.lc = lc; B.lvl.setColorAt(n.i, _cc.set(lc)); B.lvl.instanceColor.needsUpdate = true; }
        if (neckN) { neckDone = true; const r = Math.min(5, 1.3 + n.dq * .08); B.stain.position.set(n.x, .05, n.z); B.stain.scale.set(r, 1, r); B.stain.material.opacity = .2 + .12 * Math.sin(S.clock * .8 / Math.max(1, S.speed / 10)); } }
      const col = n === neck ? COL.neck : n.dq >= 2 ? COL.wip : n.busy ? COL.work : COL.idle; n.col = col; if (n.rc !== col) { n.rc = col; B.rings.setColorAt(n.i, _cc.set(col)); B.rings.instanceColor.needsUpdate = true; }
      const full = S.labels === 'all' || n === neck || n === S.hov || n === S.pin; n.sp.visible = full; n.dot.visible = !full;
      if (!full) { paintChip(n.dot, n.dq ? String(Math.min(999, n.dq)) : '', col); continue; }
      paint(n.sp, n.o.oper || short(n.o), n === neck ? `CUELLO · ${n.dq} en espera` : n.dq ? `${n.dq} en espera` : n.busy ? 'trabajando' : 'sin material', col);
    }
    B.hand.count = nh; B.hand.instanceMatrix.needsUpdate = true; B.lvl.instanceMatrix.needsUpdate = true; B.stain.visible = neckDone;
    if (wipDirty) { let k = 0; for (const n of S.N) { const c0 = Math.cos(n.yaw), s0 = Math.sin(n.yaw);
        for (let j = 0; j < n.wq; j++) { const a = j % 3 - 1, b = Math.floor(j / 3) % 3 - 1, l = Math.floor(j / 9), lx = a * .37, lz = b * .37;
          M4.makeTranslation(n.wp[0] + lx * c0 + lz * s0, .12 + .17 + l * .34, n.wp[1] - lx * s0 + lz * c0); B.wip.setMatrixAt(k++, M4); } }
      B.wip.count = k; B.wip.instanceMatrix.needsUpdate = true; }
    S.ui += rdt; if (S.ui > .3) { S.ui = 0; hudBody(); } else hudDrip();
  }
  const mmss = s => { const m = Math.floor(s / 60); return (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ':' + String(Math.floor(s % 60)).padStart(2, '0')); };
  /* pasar el cursor o tocar a una persona muestra su letrero completo */
  const nearNode = e => { const S = SIM, p = S && ground(e); if (!p) return null; let best = null, bd = 2.2 * 2.2; for (const n of S.N) { const d = (n.x - p[0]) ** 2 + (n.z - p[1]) ** 2; if (d < bd) { bd = d; best = n; } } return best; };
  const onHover = e => { if (SIM) SIM.hov = nearNode(e); };
  let hd = null; const onHd = e => { hd = [e.clientX, e.clientY]; };
  const onHu = e => { if (!SIM || !hd || Math.hypot(e.clientX - hd[0], e.clientY - hd[1]) > 6) return; const n = nearNode(e); SIM.pin = n && SIM.pin !== n ? n : null; };
  function S0hover(on) { const c = cv(); if (!c) return; const f = on ? 'addEventListener' : 'removeEventListener'; c[f]('pointermove', onHover); c[f]('pointerdown', onHd, true); c[f]('pointerup', onHu, true); }
  let hudFull = false, hudWin = null;
  function openHud() { hudWin?.remove(); hud?.remove(); hud = document.createElement('div'); hud.id = 'vzFlow'; hud.setAttribute('role', 'region'); hud.setAttribute('aria-label', 'Flujo animado');
    hud.className = hudFull ? '' : 'compact';
    hud.innerHTML = `<h4><span>${SIM.N.length} personas animadas</span><span><button data-k="ana" title="Proyectar estas personas a un turno de 8 o 12 horas con paros y costos">Análisis de turno</button> <button data-k="more" aria-expanded="${hudFull}">${hudFull ? 'Ocultar tabla' : 'Ver tabla y controles'}</button> <button data-k="back">Volver al reporte</button></span></h4>
      <div class="fl-ctl"><span>Velocidad</span>${[1, 10, 30, 60].map(v => `<button data-sp="${v}">×${v}</button>`).join('')}<i class="fl-sep"></i><button data-k="pause">Pausa</button><button data-k="reset">Reiniciar</button></div>
      <div class="fl-ctl"><span>Entrada de material</span><button data-fd="takt" title="Entra una pieza cada takt: se ve quién no alcanza la demanda">Al ritmo del takt</button><button data-fd="libre" title="La primera operación nunca se queda sin material: se ve el cuello propio de la línea">Sin límite</button></div>
      <div class="fl-ctl"><span>Letreros</span><button data-lb="min" title="Solo un punto con las piezas en espera; el nombre aparece al pasar el cursor o al tocar a la persona">Discretos</button><button data-lb="all" title="Nombre y estado de todas las personas">Todos</button></div>
      <div class="fl-body"></div>`;
    hud.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !SIM) return;
      if (b.dataset.sp) SIM.speed = +b.dataset.sp; else if (b.dataset.lb) SIM.labels = b.dataset.lb; else if (b.dataset.fd) { if (b.dataset.fd === 'takt' && !SIM.tk) return; SIM.feed = b.dataset.fd; } else if (b.dataset.k === 'pause') SIM.pause = !SIM.pause;
      else if (b.dataset.k === 'more') { hudFull = !hudFull; hud.classList.toggle('compact', !hudFull); b.textContent = hudFull ? 'Ocultar tabla' : 'Ver tabla y controles'; b.setAttribute('aria-expanded', String(hudFull)); return; }
      else if (b.dataset.k === 'ana') { api.ana?.()?.open('anim'); return; }
      else if (b.dataset.k === 'reset') { start(); return; } else if (b.dataset.k === 'back') { stop(); api.showReport(); return; } hudCtl(); });
    document.body.appendChild(hud); hudWin = win(hud, { title: 'Flujo animado', key: 'flujo' }); hudCtl(); hudBody(); }
  function hudCtl() { if (!hud || !SIM) return; hud.querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', +b.dataset.sp === SIM.speed)); hud.querySelectorAll('[data-lb]').forEach(b => b.classList.toggle('on', b.dataset.lb === SIM.labels)); hud.querySelectorAll('[data-fd]').forEach(b => { b.classList.toggle('on', b.dataset.fd === SIM.feed); if (b.dataset.fd === 'takt') b.disabled = !SIM.tk; });
    const p = hud.querySelector('[data-k=pause]'); p.textContent = SIM.pause ? 'Reanudar' : 'Pausa'; p.classList.toggle('on', SIM.pause); }
  const NFC = {}, fastN = (v, d = 0) => (NFC[d] ||= new Intl.NumberFormat('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d })).format(isFinite(v) ? v : 0);
  function hudBody() { if (!hud || !SIM || hud.style.display === 'none') return; const S = SIM, fmtN = fastN, f1 = v => fastN(v, 1);
    const rowsA = !hudFull ? [] : S.N.map(n => { const tot = n.tw + n.ts, av = n.done ? n.tw / n.done : 0, mean = (n.o.cycles || []).reduce((a, c) => a + (+c.t || 0), 0) / Math.max(1, (n.o.cycles || []).length);
      return `<tr class="${n === S.neck ? 'neck' : ''}"><td><i style="background:${n.col || COL.idle}"></i>${esc(cut(n.o.oper || short(n.o), 22))}<br><small style="color:#a9b3bd">${esc(short(n.o))}${n.o.walk ? ' · camina' : ''} → ${n.nx ? esc(cut(n.nx.o.oper || short(n.nx.o), 16)) : 'salida'}</small></td><td>${f1(n.done ? av : mean)} s${n.tk ? `<br><small style="color:${mean > n.tk ? '#ff7a70' : '#a9b3bd'}">${fmtN(mean / n.tk * 100, 0)}% takt</small>` : ''}</td><td>${tot ? fmtN(n.tw / tot * 100, 0) : 0}%</td><td${tot && n.ts / tot > .2 ? ' style="color:#FFB020"' : ''}>${tot ? fmtN(n.ts / tot * 100, 0) : 0}%<br><small style="color:#a9b3bd">${fmtN(n.ts / 60, 0)} min</small></td><td>${n.dq || 0}</td><td>${n.qmax || 0}</td><td>${n.done}</td></tr>`; });
    const rows = rowsA.join('');
    const rate = S.clock > 0 ? S.out / S.clock * 3600 : 0, req = S.tk ? 3600 / S.tk : 0;
    const htmlAll = `<table><thead><tr><th>Persona</th><th>Ciclo</th><th title="Tiempo con pieza en la mano">Trabajando</th><th title="Tiempo parado sin pieza (en gris en el 3D)">Esperando material</th><th title="Piezas esperando a esta persona ahora">Cola</th><th title="La mayor cola que ha tenido">Cola máx.</th><th>Hechas</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="fl-sum">Tiempo simulado <b>${mmss(S.clock)}</b> · salida <b>${S.out}</b> pzs (${f1(rate)} pzs/h${req ? ` de ${f1(req)} requeridas` : ''})<br>${S.neck ? `Cuello de botella ahora: <b style="color:#ff7a70">${esc(who(S.neck.o))}</b>, ${S.neck.dq} piezas en cola` : (() => { const tot = n => n.tw + n.ts, m = S.N.slice().sort((a, b) => (b.ts / Math.max(1, tot(b))) - (a.ts / Math.max(1, tot(a))))[0]; return m && tot(m) ? `Sin cola por ahora: la línea va más rápido que la entrada. Quien más espera material: <b>${esc(m.o.oper || short(m.o))}</b> (${fmtN(m.ts / tot(m) * 100, 0)}%)` : 'Sin acumulación por ahora'; })()}${S.miss ? `<br>${S.miss} persona(s) elegida(s) sin enlazar no entran en la animación.` : ''}</div>`;
    const fb = hud.querySelector('.fl-body'), tb = fb.querySelector('tbody'), m = htmlAll.indexOf('<div class="fl-sum">');
    // con la tabla abierta no se reescribe todo de golpe: se guarda lo nuevo y cada cuadro se actualizan unas pocas filas (hudDrip)
    if (hudFull && tb && tb.rows.length === rowsA.length && hud._rows) { hud._next = rowsA; const sum = fb.querySelector('.fl-sum'), nsum = htmlAll.slice(m); if (sum && sum.outerHTML !== nsum) sum.outerHTML = nsum; }
    else { fb.innerHTML = hudFull ? htmlAll : htmlAll.slice(m); hud._rows = hudFull ? rowsA.slice() : null; hud._next = null; } }
  function hudDrip() { if (!hud || !hud._next || !hud._rows) return; const tb = hud.querySelector('tbody'), R = hud._next, n = R.length; if (!tb || tb.rows.length !== n) { hud._next = null; return; }
    let done = 0, c = hud._cur || 0; for (let k = 0; k < n && done < 4; k++) { c = (c + 1) % n; if (hud._rows[c] !== R[c]) { tb.rows[c].outerHTML = R[c]; hud._rows[c] = R[c]; done++; } }
    hud._cur = c; if (!done) hud._next = null; }
  function stop() { if (!SIM) return; S0hover(false); const V = vida(); V?.ext(null); V?.undriveAll(); SIM = null; hudWin?.remove(); hudWin = null; hud?.remove(); hud = null; clearG(); }

  return { MAX, all, anim, scope, byId, short, who, toggle, link, endLink, unlink, start, stop,
    state: () => SIM ? { running: true, clock: SIM.clock, out: SIM.out, speed: SIM.speed, feed: SIM.feed, neck: SIM.neck ? who(SIM.neck.o) : null, nodes: SIM.N.map(n => ({ name: n.o.name, q: n.q, done: n.done, busy: n.busy, next: n.nx?.o.name || null })) } : { running: false, linking: !!LK, anim: anim().length },
    sim: () => SIM, tick };
}
