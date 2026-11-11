/* Red DAIMAY · fusión de piezas estáticas (compartido por los 6 gemelos).
   Algunas capas están hechas de miles de mallas sueltas (P6-7: 9,930 en "equipos de proceso"), y cada una
   cuesta una llamada de dibujo más otra de sombra. Aquí se funden por material en unas cuantas mallas grandes.

   - Las piezas originales NO se borran: pasan a la capa 31, que la cámara no dibuja, y siguen sirviendo para
     seleccionar con clic y para el editor (el rayo de selección también mira la capa 31).
   - Si algo se mueve, aparece o desaparece (editor, cambio de escenario), se detecta por una firma de
     posiciones: se muestran las originales de inmediato y se vuelve a fundir cuando todo queda quieto.
   - Lo que se mueve todo el tiempo (runners, animaciones) nunca se funde. */
const HIDE = 31, MIN = 250;

export function init({ THREE, scene, renderer }) {
  for (const fn of ['setFromCamera', 'intersectObject', 'intersectObjects']) { const orig = THREE.Raycaster.prototype[fn];
    THREE.Raycaster.prototype[fn] = function () { this.layers.enable(HIDE); return orig.apply(this, arguments); }; }
  const G = new Map();            // grupo -> { merged:Group|null, sig, stable, moving, n }
  const M4 = new THREE.Matrix4(), INV = new THREE.Matrix4(), N3 = new THREE.Matrix3(), V = new THREE.Vector3();
  const ok = o => o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !o.userData._lote && !o.userData.noLote && o.geometry && o.geometry.attributes.position && !Array.isArray(o.material) && !o.geometry.morphAttributes?.position;

  // dos materiales distintos pero idénticos en apariencia cuentan como uno (el motor crea uno por pieza)
  const texKey = t => t ? (t.source?.uuid || t.uuid) + '@' + t.repeat.x + ',' + t.repeat.y + ',' + t.offset.x + ',' + t.offset.y + ',' + t.rotation + ',' + t.wrapS + ',' + t.wrapT : '-';
  const MK = new WeakMap();
  function matKey(m) { let k = MK.get(m); const ver = m.version + ':' + (m.color ? m.color.getHex() : 0) + ':' + m.opacity + ':' + (m.emissive ? m.emissive.getHex() : 0);
    if (k && k.ver === ver) return k.key;
    const key = [m.type, m.color ? m.color.getHex() : '', m.roughness ?? '', m.metalness ?? '', m.opacity, m.transparent ? 1 : 0, m.side, m.vertexColors ? 1 : 0, m.depthWrite ? 1 : 0, m.depthTest ? 1 : 0,
      m.emissive ? m.emissive.getHex() : '', m.emissiveIntensity ?? '', m.flatShading ? 1 : 0, m.alphaTest, m.wireframe ? 1 : 0, m.polygonOffset ? m.polygonOffsetFactor + '/' + m.polygonOffsetUnits : '', m.blending, m.toneMapped ? 1 : 0, m.fog ? 1 : 0,
      texKey(m.map), texKey(m.normalMap), texKey(m.roughnessMap), texKey(m.metalnessMap), texKey(m.emissiveMap), texKey(m.alphaMap), texKey(m.aoMap), m.envMapIntensity ?? '', m.clippingPlanes ? 'c' : ''].join('|');
    MK.set(m, { ver, key }); return key; }
  function walk(g, fn) {          // recorre las mallas fundibles con su visibilidad heredada
    const rec = (o, vis) => { if (o.userData._lote) return; const v = vis && o.visible; if (ok(o)) fn(o, v); for (const c of o.children) rec(c, v); };
    for (const c of g.children) rec(c, true);
  }
  function signature(g) { let h = 0, n = 0;
    walk(g, (o, v) => { const e = o.matrixWorld.elements; n++; h = (h * 31 + ((e[12] * 97 + e[13] * 89 + e[14] * 83 + e[0] * 13 + e[5] * 7 + e[10] * 5 + e[2] * 3) * 1000 | 0) + (v ? 1 : 0)) | 0; });
    return h + ':' + n; }
  function count(g) { let n = 0; walk(g, () => n++); return n; }

  function unmerge(g, st) { if (!st.merged) return; g.remove(st.merged); st.merged.traverse(m => { m.geometry?.dispose(); }); st.merged = null; walk(g, o => o.layers.set(0)); }
  function merge(g, st) {
    unmerge(g, st); g.updateMatrixWorld(true); INV.copy(g.matrixWorld).invert();
    const B = new Map();
    walk(g, (o, v) => { if (!v) return; const m = o.material, k = matKey(m) + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + '|' + o.renderOrder;
      let b = B.get(k); if (!b) B.set(k, b = { mat: m, cast: o.castShadow, recv: o.receiveShadow, ro: o.renderOrder, list: [], nv: 0, ni: 0, col: !!m.vertexColors });
      const ge = o.geometry; b.list.push(o); b.nv += ge.attributes.position.count; b.ni += ge.index ? ge.index.count : ge.attributes.position.count; });
    const grp = new THREE.Group(); grp.userData._lote = true; grp.name = 'lote';
    for (const b of B.values()) {
      const P = new Float32Array(b.nv * 3), N = new Float32Array(b.nv * 3), U = new Float32Array(b.nv * 2), C = b.col ? new Float32Array(b.nv * 3).fill(1) : null, I = new Uint32Array(b.ni);
      let vo = 0, io = 0;
      for (const o of b.list) {
        const ge = o.geometry, p = ge.attributes.position, nr = ge.attributes.normal, uv = ge.attributes.uv, cl = ge.attributes.color, n = p.count;
        M4.multiplyMatrices(INV, o.matrixWorld); N3.getNormalMatrix(M4); const flip = M4.determinant() < 0;
        for (let i = 0; i < n; i++) {
          V.fromBufferAttribute(p, i).applyMatrix4(M4); P[(vo + i) * 3] = V.x; P[(vo + i) * 3 + 1] = V.y; P[(vo + i) * 3 + 2] = V.z;
          if (nr) { V.fromBufferAttribute(nr, i).applyMatrix3(N3).normalize(); N[(vo + i) * 3] = V.x; N[(vo + i) * 3 + 1] = V.y; N[(vo + i) * 3 + 2] = V.z; } else N[(vo + i) * 3 + 1] = 1;
          if (uv) { U[(vo + i) * 2] = uv.getX(i); U[(vo + i) * 2 + 1] = uv.getY(i); }
          if (C && cl) { C[(vo + i) * 3] = cl.getX(i); C[(vo + i) * 3 + 1] = cl.getY(i); C[(vo + i) * 3 + 2] = cl.getZ(i); }
        }
        const ix = ge.index, ni = ix ? ix.count : n;
        for (let t = 0; t + 2 < ni; t += 3) { const a = ix ? ix.getX(t) : t, c = ix ? ix.getX(t + 1) : t + 1, d = ix ? ix.getX(t + 2) : t + 2; I[io + t] = vo + a; I[io + t + 1] = vo + (flip ? d : c); I[io + t + 2] = vo + (flip ? c : d); }
        vo += n; io += ni; o.layers.set(HIDE);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      if (C) geo.setAttribute('color', new THREE.BufferAttribute(C, 3)); geo.setIndex(new THREE.BufferAttribute(I, 1)); geo.computeBoundingSphere(); geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.renderOrder = b.ro; mesh.userData._lote = true; mesh.raycast = () => {}; grp.add(mesh);
    }
    g.add(grp); st.merged = grp; st.n = grp.children.length;
  }

  let paused = false;
  function tick() {
    if (paused) return;
    for (const g of scene.children) { if (!g.isGroup || G.has(g) || g.userData._lote) continue; if (count(g) >= MIN) G.set(g, { merged: null, sig: '', stable: 0, moving: 0, n: 0 }); }
    for (const [g, st] of G) {
      if (!g.parent) { G.delete(g); continue; }
      const s = signature(g);
      if (s !== st.sig) { st.sig = s; st.stable = 0; st.moving++; if (st.merged) unmerge(g, st); continue; }   // algo cambió: se ven las originales
      st.stable++; if (st.stable >= 2) st.moving = 0;
      if (!st.merged && st.stable >= 2 && st.moving === 0 && g.visible) { try { merge(g, st); st.sig = signature(g); } catch (e) { console.warn('lote: no se pudo fundir', e); G.delete(g); g.userData._lote = true; } }
    }
  }
  const timer = setInterval(tick, 700);
  // Sombras: recalcularlas cuesta más de la mitad del cuadro en gráficos integrados. Se recalculan 1 de cada 3 cuadros;
  // entre medio se usa el mapa anterior (la sombra de un montacargas va, como mucho, dos cuadros atrás).
  let fr = 0, shOn = !!renderer;
  const sh = () => { if (shOn && renderer.shadowMap.enabled) { renderer.shadowMap.autoUpdate = false; if (fr++ % 3 === 0) renderer.shadowMap.needsUpdate = true; } requestAnimationFrame(sh); };
  if (renderer) requestAnimationFrame(sh);
  return {
    tick, stats: () => [...G].map(([g, st]) => ({ capa: g.userData.key || g.name || '?', piezas: count(g), fundidas: st.merged ? st.n : 0 })),
    sombras(v) { shOn = !!v; if (!shOn && renderer) renderer.shadowMap.autoUpdate = true; },
    pause(v) { paused = !!v; if (paused) for (const [g, st] of G) unmerge(g, st); }, stop() { clearInterval(timer); for (const [g, st] of G) unmerge(g, st); }
  };
}
