/* Red DAIMAY · racks y carros que viajan con un runner, tugger o montacargas (lo usa motor/visor.js).
   - El enlace se guarda en la ruta del runner: r.racks = [{ oid, a, b }]  (a = parada donde lo toma, b = parada donde lo entrega).
   - Mientras la simulación corre, la primera vez que el runner llega a la parada «a» engancha el rack y desde ahí lo lleva
     en todo su circuito: lleno de «a» a «b» y vacío de «b» de regreso a «a» (ida lleno, vuelta vacío, siempre el mismo runner).
   - Tuggers y runners lo arrastran detrás; un montacargas lo lleva al frente, a la altura de sus uñas.
   - El rack original no se borra: se esconde y en su lugar se dibuja una copia que se mueve. Al quitar el enlace o al
     detener la simulación vuelve a su lugar del plano. */
const CSS = `#rkPick{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:60;background:rgba(13,18,24,.95);border:1px solid #FFB020;border-radius:10px;padding:10px 14px;color:#e7ebef;font:13px/1.4 system-ui,'Segoe UI',sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 28px);box-shadow:0 10px 30px rgba(0,0,0,.45)}
#rkPick b{color:#FFB020} #rkPick button{background:#1b232c;border:1px solid #27323e;border-radius:6px;color:inherit;font:inherit;padding:5px 9px;cursor:pointer;min-height:30px}`;
export const MAXDIM = 4.5;
export function create({ THREE, scene, OBJS, RT, PICK, applyObj }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const rd = () => window.__rd || {};
  const Z0 = new THREE.Matrix4().makeScale(0, 0, 0), M = new THREE.Matrix4(), T = new THREE.Matrix4();
  const ok = o => o && o.kind !== 'op' && !o.del && o.slots && o.slots.length && Math.max(o.l || 0, o.d || 0) <= MAXDIM;
  const name = oid => { const o = OBJS.get(oid); return o ? (o.name || o.id) : 'objeto ' + oid; };

  /* ---------- elegir el rack con un clic en el gemelo ---------- */
  let PK = null;
  function pick(onDone, onCancel) {
    endPick(); const c = rd().renderer?.domElement, cam = rd().camera; if (!c || !cam) { onCancel?.('El gemelo no está listo.'); return; }
    const chip = document.createElement('div'); chip.id = 'rkPick';
    chip.innerHTML = `<span>Haz clic en el <b>rack o carro</b> que mueve este runner (máximo ${MAXDIM} m de largo)</span><button type="button">Cancelar</button>`;
    document.body.appendChild(chip); chip.querySelector('button').onclick = () => { endPick(); onCancel?.(''); };
    const RC = new THREE.Raycaster(), V2 = new THREE.Vector2(); let dn = null;
    const down = e => { dn = [e.clientX, e.clientY]; };
    const up = e => { if (!dn || Math.hypot(e.clientX - dn[0], e.clientY - dn[1]) > 6 || e.button > 0) return; dn = null; const r = c.getBoundingClientRect();
      V2.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); RC.setFromCamera(V2, cam);
      for (const h of RC.intersectObjects(PICK, false)) { const o = h.object.userData?.objOf?.[h.instanceId];
        if (!o) continue; if (!ok(o)) { chip.querySelector('span').innerHTML = `<b>${o.name || 'Ese objeto'}</b> no se puede enlazar (es un operador o mide más de ${MAXDIM} m). Elige un rack o carro.`; return; }
        e.stopPropagation(); endPick(); onDone(o); return; } };
    c.addEventListener('pointerdown', down, true); c.addEventListener('pointerup', up, true);
    PK = { chip, off: () => { c.removeEventListener('pointerdown', down, true); c.removeEventListener('pointerup', up, true); chip.remove(); } };
  }
  function endPick() { if (PK) { PK.off(); PK = null; } }

  /* ---------- copia móvil del rack ---------- */
  function attach(o) {
    const cx = o.p[0] + o.off[0], cz = o.p[1] + o.off[1], g = new THREE.Group(); T.makeTranslation(-cx, 0, -cz);
    for (const s of o.slots) { s.b.im.getMatrixAt(s.i, M); const mat = s.b.im.material.clone(); const ic = s.b.cs?.[s.i]; if (ic !== undefined && ic !== null && mat.color) mat.color.set(ic);
      else if (s.b.im.instanceColor && mat.color) { const c = new THREE.Color(); s.b.im.getColorAt(s.i, c); mat.color.multiply(c); }
      const m = new THREE.Mesh(s.b.geo || s.b.im.geometry, mat); m.matrixAutoUpdate = false; m.matrix.multiplyMatrices(T, M); m.castShadow = true; m.userData.noLote = true; g.add(m);
      s.b.im.setMatrixAt(s.i, Z0); s.b.im.instanceMatrix.needsUpdate = true; }
    const bb = new THREE.Box3(); g.updateMatrixWorld(true); g.children.forEach(m => { m.geometry.computeBoundingBox?.(); const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrix); bb.union(b); });
    const sz = bb.getSize(new THREE.Vector3()), load = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.3, sz.x * .8), Math.min(.6, Math.max(.25, sz.y * .3)), Math.max(.3, sz.z * .8)), new THREE.MeshStandardMaterial({ color: '#e0a23a', roughness: .7 }));
    load.position.set((bb.min.x + bb.max.x) / 2, bb.max.y + .02 + load.geometry.parameters.height / 2, (bb.min.z + bb.max.z) / 2); load.userData.noLote = true; g.add(load);
    g.userData = { noLote: true, load, len: Math.max(sz.x, sz.z) }; scene.add(g); return g;
  }
  function detach(S) { if (S.g) { scene.remove(S.g); S.g.traverse(m => { if (m.material && m !== S.g) m.material.dispose?.(); }); S.g.userData.load?.geometry.dispose(); S.g = null; } const o = OBJS.get(S.oid); if (o) applyObj(o); }

  /* ---------- cada cuadro ---------- */
  const ST = new Map(), V = new THREE.Vector3();
  function tick() { step(); requestAnimationFrame(tick); }
  function step() {
    const seen = new Set();
    for (const R of RT.values()) { const def = R.def, L = def && Array.isArray(def.racks) ? def.racks : [], stops = def?.stops || [], n = stops.length;
      for (const k of L) { const key = def.id + '|' + k.oid, o = OBJS.get(k.oid); if (!ok(o)) continue; seen.add(key);
        let S = ST.get(key); if (!S) ST.set(key, S = { oid: k.oid, g: null, full: false, prev: null, dir: [1, 0], h0: null });
        const pos = R.obj?.position; if (!R.P || !pos || !n) { if (S.g) detach(S); continue; }
        const at = R.wait > 0 ? ((R.next - 1 + n) % n) : -1;
        if (!S.g) { if (at !== +k.a) continue; S.g = attach(o); S.full = true; S.prev = [pos.x, pos.z]; S.h0 = null; }
        if (at === +k.a) S.full = true; else if (at === +k.b) S.full = false;
        const dx = pos.x - S.prev[0], dz = pos.z - S.prev[1], dl = Math.hypot(dx, dz); if (dl > .02) { S.dir = [dx / dl, dz / dl]; S.prev = [pos.x, pos.z]; }
        const fork = !!R.obj.userData?.carr, d = S.g.userData.len / 2 + (fork ? 1.1 : 1.3), sg = fork ? 1 : -1, hd = Math.atan2(S.dir[1], S.dir[0]); if (S.h0 === null) S.h0 = hd;
        S.g.position.set(pos.x + sg * S.dir[0] * d, fork ? Math.max(0, (R.obj.userData.carrY ?? R.obj.userData.carr.position.y) - .1) : 0, pos.z + sg * S.dir[1] * d);
        S.g.rotation.y = -(hd - S.h0); S.g.userData.load.visible = S.full; } }
    for (const [key, S] of ST) if (!seen.has(key)) { detach(S); ST.delete(key); }
  }
  requestAnimationFrame(tick);
  return { pick, endPick, ok, name, _dbg: { RT, OBJS, step }, state: () => [...ST.values()].map(S => ({ rack: name(S.oid), enganchado: !!S.g, lleno: S.full })) };
}
