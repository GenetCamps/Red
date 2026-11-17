/* Red DAIMAY · gráficos 3D de los gemelos (piloto en Planta 4).
   Tres niveles, elegidos solos según el equipo (y ajustables en la barra: «Gráficos»):
   - Básica: como siempre + contorno de lo seleccionado (casi sin costo).
   - Media:  + sombra de contacto bajo máquinas, racks y equipos (una sola llamada de dibujo) y brillo en andones.
   - Alta:   + oclusión ambiental en pantalla (las esquinas y bases se oscurecen como en la realidad).
   La oclusión reconstruye la distancia desde la profundidad logarítmica del motor (d = log2(1+w) / log2(far+1)),
   así que no necesita una segunda pasada de normales. Si la computadora no da el ancho, en «Auto» se baja sola. */
const LV = ['basica', 'media', 'alta'], NAME = { basica: 'Básica', media: 'Media', alta: 'Alta' }, PILOT = ['p4'];

export function init(ctx) {
  const { THREE, scene, renderer, camera, OBJS, PICK, id } = ctx;
  if (!PILOT.includes(id)) return null;
  let pref = 'auto'; try { pref = localStorage.getItem('rd_gfx') || 'auto'; } catch (_) {}
  const gpu = (() => { try { const gl = renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); return x ? String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL)) : ''; } catch (_) { return ''; } })();
  const mobile = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const autoLv = () => mobile || /swiftshader|llvmpipe|software|basic render/i.test(gpu) ? 'basica' : 'alta';
  let LVL = pref === 'auto' ? autoLv() : pref;
  const ON = { blobs: false, halos: false, ao: false };

  /* ---------------- sombra de contacto (rectángulo difuminado bajo cada objeto) ---------------- */
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.filter = 'blur(13px)'; g.fillStyle = '#000'; g.beginPath(); g.roundRect ? g.roundRect(28, 28, 72, 72, 10) : g.rect(28, 28, 72, 72); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; })();
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, map: blobTex, transparent: true, opacity: .4, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  let blobIM = null, blobSig = '';
  const SKIP = /tapete|piso|marca|pasillo|zona|área|area|franja|cruce/i;
  const blobList = () => [...OBJS.values()].filter(o => { const a = (o.l || 0) * (o.d || 0); return a > .12 && a < 600 && o.kind !== 'sign' && !String(o.id).startsWith('mat_') && !SKIP.test(o.name || '') && !(o.off && o.off[1] > .5); });
  function buildBlobs() { const L = blobList(), sig = L.length + ':' + L.reduce((s, o) => s + o.p[0] * 3.1 + o.p[1] * 1.7 + o.a + o.l + o.d, 0).toFixed(2);
    if (sig === blobSig && blobIM) return; blobSig = sig;
    if (blobIM) { scene.remove(blobIM); blobIM.dispose(); blobIM = null; } if (!L.length) return;
    const im = new THREE.InstancedMesh(blobGeo, blobMat, L.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    L.forEach((o, i) => { const k = 1 / .6; p.set(o.p[0] + (o.off?.[0] || 0), .03, o.p[1] + (o.off?.[2] || 0)); q.setFromAxisAngle(up, -(o.a || 0)); s.set((o.l + .28) * k, 1, (o.d + .28) * k); im.setMatrixAt(i, m.compose(p, q, s)); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.renderOrder = 2; im.castShadow = im.receiveShadow = false; im.raycast = () => {}; im.userData.noLote = true; im.name = 'rd-sombra-contacto';
    im.visible = ON.blobs; blobIM = im; scene.add(im); }

  /* ---------------- brillo en andones (rojo parpadea) ---------------- */
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.18, 'rgba(255,255,255,.85)'); gr.addColorStop(.45, 'rgba(255,255,255,.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const smat = (hex, op) => new THREE.SpriteMaterial({ map: glowTex, color: hex, transparent: true, opacity: op, depthWrite: false, toneMapped: false, fog: true });
  const HAL = { g: new THREE.Group(), mats: { red: smat(0xff2a1a, .9), amb: smat(0xffa31a, .75), grn: smat(0x2fe07a, .55) }, n: 0, sig: '' };
  HAL.g.name = 'rd-brillo'; HAL.g.userData.noLote = true; scene.add(HAL.g);
  function andons() { const out = []; scene.traverse(o => { if (o.isInstancedMesh && o.instanceColor && o.material && o.material.isMeshBasicMaterial && o.count < 5000 && !o.name.startsWith('rd-')) out.push(o); }); return out; }
  function buildHalos() { const A = andons(), M = new THREE.Matrix4(), v = new THREE.Vector3(), c = new THREE.Color(), hsl = {};
    let sig = A.length + ':'; A.forEach(im => { sig += im.count + '/' + im.instanceMatrix.version + '/' + (im.instanceColor?.version || 0) + ';'; });
    if (sig === HAL.sig) return; HAL.sig = sig; HAL.g.clear(); let n = 0;
    A.forEach(im => { im.updateWorldMatrix(true, false); for (let i = 0; i < im.count && n < 400; i++) { im.getMatrixAt(i, M); M.premultiply(im.matrixWorld); v.set(0, .5, 0).applyMatrix4(M); im.getColorAt(i, c); c.getHSL(hsl);
      if (hsl.s < .35 || hsl.l < .12) continue; const k = hsl.h < .045 || hsl.h > .93 ? 'red' : hsl.h < .16 ? 'amb' : 'grn';
      const sp = new THREE.Sprite(HAL.mats[k]); sp.position.copy(v); const sc = k === 'red' ? 2.6 : k === 'amb' ? 1.7 : 1.2; sp.scale.set(sc, sc, 1); sp.raycast = () => {}; sp.renderOrder = 5; HAL.g.add(sp); n++; } });
    HAL.n = n; }

  /* ---------------- contorno de lo seleccionado ---------------- */
  const SEL = { g: new THREE.Group(), key: null, o: null, mesh: null, t: 0 }; SEL.g.name = 'rd-seleccion'; SEL.g.userData.noLote = true; scene.add(SEL.g);
  const lineA = new THREE.LineBasicMaterial({ color: 0x38d9ff, transparent: true, opacity: .95, depthWrite: false, toneMapped: false });
  const lineB = new THREE.LineBasicMaterial({ color: 0x38d9ff, transparent: true, opacity: .28, depthTest: false, depthWrite: false, toneMapped: false });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x38d9ff, transparent: true, opacity: .75, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const EDG = new WeakMap(); const edgesOf = g => { let e = EDG.get(g); if (!e) { e = new THREE.EdgesGeometry(g, 35); EDG.set(g, e); } return e; };
  function clearSel() { SEL.g.children.slice().forEach(c => { SEL.g.remove(c); if (c.userData.own) c.geometry.dispose(); }); SEL.extra?.forEach(x => x.parent?.remove(x)); SEL.extra = []; SEL.key = null; SEL.o = null; SEL.mesh = null; }
  function ring(cx, cz, w, d, a) { const s = new THREE.Shape(), h = new THREE.Path(), W = w / 2 + .35, D = d / 2 + .35, t = .12;
    s.moveTo(-W, -D); s.lineTo(W, -D); s.lineTo(W, D); s.lineTo(-W, D); s.closePath(); h.moveTo(-W + t, -D + t); h.lineTo(-W + t, D - t); h.lineTo(W - t, D - t); h.lineTo(W - t, -D + t); h.closePath(); s.holes.push(h);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(Math.PI / 2), ringMat); m.position.set(cx, .05, cz); m.rotation.y = -(a || 0); m.renderOrder = 6; m.userData.own = true; m.raycast = () => {}; return m; }
  function drawObj(o) { const M = new THREE.Matrix4(), pos = []; let n = 0;
    for (const sl of o.slots || []) { const im = sl.b && sl.b.im; if (!im || n > 120) continue; n++; const e = edgesOf(im.geometry); im.getMatrixAt(sl.i, M); M.premultiply(im.matrixWorld); const a = e.attributes.position, v = new THREE.Vector3();
      for (let k = 0; k < a.count; k++) { v.fromBufferAttribute(a, k).applyMatrix4(M); pos.push(v.x, v.y, v.z); } }
    (o.meshes || []).slice(0, 60).forEach(ms => { if (!ms.geometry) return; ms.updateWorldMatrix(true, false); const e = edgesOf(ms.geometry), a = e.attributes.position, v = new THREE.Vector3(); for (let k = 0; k < a.count; k++) { v.fromBufferAttribute(a, k).applyMatrix4(ms.matrixWorld); pos.push(v.x, v.y, v.z); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const A = new THREE.LineSegments(g, lineA), B = new THREE.LineSegments(g, lineB); A.userData.own = true; B.renderOrder = 7; A.renderOrder = 6; [A, B].forEach(x => { x.raycast = () => {}; x.frustumCulled = false; });
    SEL.g.add(A, B, ring(o.p[0] + (o.off?.[0] || 0), o.p[1] + (o.off?.[2] || 0), o.l || .6, o.d || .6, o.a)); }
  function drawMesh(root) { SEL.extra = []; let n = 0; const box = new THREE.Box3().setFromObject(root);
    root.traverse(ms => { if (!ms.isMesh || ms.isInstancedMesh || n > 80 || !ms.geometry) return; n++; const A = new THREE.LineSegments(edgesOf(ms.geometry), lineA), B = new THREE.LineSegments(edgesOf(ms.geometry), lineB);
      A.renderOrder = 6; B.renderOrder = 7; [A, B].forEach(x => { x.raycast = () => {}; x.userData.noLote = true; }); ms.add(A, B); SEL.extra.push(A, B); });
    if (!box.isEmpty()) { const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()); SEL.g.add(ring(c.x, c.z, s.x, s.z, 0)); } }
  const visUp = o => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
  const RC = new THREE.Raycaster(), NDC = new THREE.Vector2();
  function pickAt(cx, cy) { const r = renderer.domElement.getBoundingClientRect(); NDC.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1); RC.setFromCamera(NDC, camera);
    const hits = RC.intersectObjects(PICK, false).filter(h => visUp(h.object)); clearSel(); const h = hits[0]; if (!h) return;
    const ob = h.object.isInstancedMesh && h.instanceId != null ? h.object.userData.objOf?.[h.instanceId] : null;
    if (ob) { SEL.key = 'o:' + ob.id; SEL.o = ob; drawObj(ob); return; }
    let root = h.object; while (root.parent && root.parent.parent && root.parent !== scene && root.parent.parent !== scene) root = root.parent;
    if (h.object.isInstancedMesh) return; SEL.key = 'm:' + root.uuid; SEL.mesh = root; drawMesh(root); }
  let down = null; const cv = renderer.domElement;
  cv.addEventListener('pointerdown', e => { down = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
  cv.addEventListener('pointerup', e => { if (!down) return; const ok = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 450; down = null;
    const tool = ctx.state?.().tool; if (ok && (!tool || tool === 'info' || tool === 'move')) pickAt(e.clientX, e.clientY); });
  addEventListener('keydown', e => { if (e.key === 'Escape') clearSel(); });

  /* ---------------- oclusión ambiental en pantalla (Alta) ---------------- */
  const AO = { rt: null, a: null, b: null, w: 0, h: 0 };
  const FS = new THREE.BufferGeometry(); FS.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), qScene = new THREE.Scene(), quad = new THREE.Mesh(FS); quad.frustumCulled = false; qScene.add(quad);
  const VS = 'varying vec2 vUv; void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }';
  const DEPTH = `uniform sampler2D tDepth; uniform float uLogF; uniform vec2 uP;
    float vz(vec2 uv){ float d = texture2D(tDepth, uv).x; return -(exp2(d * uLogF) - 1.); }
    vec3 vp(vec2 uv){ float z = vz(uv); vec2 n = uv * 2. - 1.; return vec3(n.x * -z / uP.x, n.y * -z / uP.y, z); }`;
  const aoMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { tDepth: { value: null }, uLogF: { value: 1 }, uP: { value: new THREE.Vector2(1, 1) }, uRes: { value: new THREE.Vector2(1, 1) }, uR: { value: 1.4 }, uI: { value: 2.6 } },
    vertexShader: VS, fragmentShader: `varying vec2 vUv; uniform vec2 uRes; uniform float uR, uI; ${DEPTH}
    void main(){ float d = texture2D(tDepth, vUv).x; if (d >= .99999) { gl_FragColor = vec4(1.); return; }
      vec3 p = vp(vUv); vec2 tx = 1. / uRes;
      vec3 a1 = vp(vUv + vec2(tx.x, 0.)) - p, a2 = p - vp(vUv - vec2(tx.x, 0.)), b1 = vp(vUv + vec2(0., tx.y)) - p, b2 = p - vp(vUv - vec2(0., tx.y));
      vec3 n = normalize(cross(abs(a1.z) < abs(a2.z) ? a1 : a2, abs(b1.z) < abs(b2.z) ? b1 : b2)); if (dot(n, p) > 0.) n = -n;
      float rpx = min(90., uR * uP.y / -p.z * .5 * uRes.y); if (rpx < 1.5) { gl_FragColor = vec4(1.); return; }
      float ang = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))), occ = 0.;
      for (int i = 0; i < 12; i++) { float f = (float(i) + .5) / 12.; float r = sqrt(f) * rpx; float a = ang + float(i) * 2.3999632;
        vec2 suv = vUv + vec2(cos(a), sin(a)) * r * tx; if (suv.x < 0. || suv.y < 0. || suv.x > 1. || suv.y > 1.) continue;
        vec3 v = vp(suv) - p; float vv = dot(v, v), len = sqrt(vv) + 1e-4;
        occ += max(0., dot(v, n) / len - .12) * max(0., 1. - vv / (uR * uR)); }
      float ao = clamp(1. - uI * occ / 12. * 1.6, 0., 1.); gl_FragColor = vec4(ao, ao, ao, 1.); }` });
  const blurMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { tAO: { value: null }, tDepth: { value: null }, uLogF: { value: 1 }, uP: { value: new THREE.Vector2(1, 1) }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: VS, fragmentShader: `varying vec2 vUv; uniform sampler2D tAO; uniform vec2 uRes; ${DEPTH}
    void main(){ float z = vz(vUv), s = 0., w = 0.; vec2 tx = 1. / uRes;
      for (int x = -2; x <= 2; x++) for (int y = -2; y <= 2; y++) { vec2 o = vec2(float(x), float(y)) * tx * 1.25; float zz = vz(vUv + o); float k = exp(-abs(zz - z) / (.04 * -z + .05)); s += texture2D(tAO, vUv + o).r * k; w += k; }
      float a = s / max(w, 1e-4); gl_FragColor = vec4(a, a, a, 1.); }` });
  const outMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
    uniforms: { tColor: { value: null }, tAO: { value: null }, tDepth: { value: null }, uK: { value: 1 } },
    vertexShader: VS, fragmentShader: `varying vec2 vUv; uniform sampler2D tColor, tAO, tDepth; uniform float uK;
    void main(){ vec4 c = texture2D(tColor, vUv); float d = texture2D(tDepth, vUv).x; float ao = mix(1., texture2D(tAO, vUv).r, uK);
      gl_FragColor = vec4(c.rgb * ao, 1.);
      #include <tonemapping_fragment>
      if (d >= .99999) gl_FragColor.rgb = c.rgb;
      #include <colorspace_fragment>
    }` });
  function ensureRT() { const v = renderer.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(2, v.x | 0), h = Math.max(2, v.y | 0); if (AO.rt && AO.w === w && AO.h === h) return;
    AO.rt?.dispose(); AO.a?.dispose(); AO.b?.dispose(); AO.w = w; AO.h = h;
    const dt = new THREE.DepthTexture(w, h); dt.type = THREE.FloatType;
    AO.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4, depthTexture: dt });
    const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1); AO.a = new THREE.WebGLRenderTarget(hw, hh); AO.b = new THREE.WebGLRenderTarget(hw, hh); }
  const orig = renderer.render.bind(renderer);
  let aoFail = false;
  renderer.render = function (s, c) {
    if (!ON.ao || aoFail || s !== scene) return orig(s, c);
    try { ensureRT(); const prev = renderer.getRenderTarget(), logF = Math.log2(c.far + 1), P = c.projectionMatrix.elements;
      renderer.setRenderTarget(AO.rt); orig(s, c);
      for (const m of [aoMat, blurMat]) { m.uniforms.tDepth.value = AO.rt.depthTexture; m.uniforms.uLogF.value = logF; m.uniforms.uP.value.set(P[0], P[5]); m.uniforms.uRes.value.set(AO.a.width, AO.a.height); }
      quad.material = aoMat; renderer.setRenderTarget(AO.a); orig(qScene, qCam);
      blurMat.uniforms.tAO.value = AO.a.texture; quad.material = blurMat; renderer.setRenderTarget(AO.b); orig(qScene, qCam);
      outMat.uniforms.tColor.value = AO.rt.texture; outMat.uniforms.tAO.value = AO.b.texture; outMat.uniforms.tDepth.value = AO.rt.depthTexture;
      quad.material = outMat; renderer.setRenderTarget(prev); orig(qScene, qCam);
    } catch (e) { aoFail = true; console.warn('Oclusión ambiental desactivada:', e); renderer.setRenderTarget(null); orig(s, c); } };

  /* ---------------- niveles, selector y ajuste automático ---------------- */
  function apply(lv) { LVL = lv; ON.blobs = lv !== 'basica'; ON.halos = lv !== 'basica'; ON.ao = lv === 'alta';
    blobMat.opacity = lv === 'alta' ? .26 : .36; if (blobIM) blobIM.visible = ON.blobs; HAL.g.visible = ON.halos;
    if (ON.blobs) buildBlobs(); if (ON.halos) buildHalos(); paintSeg(); }
  function opsSel() { const sp = document.getElementById('oSpeed'); if (!sp || document.getElementById('oGfx')) return;
    sp.insertAdjacentHTML('afterend', `<select id="oGfx" aria-label="Calidad de gráficos" title="Calidad de gráficos 3D"><option value="auto">Gráficos: auto</option>${LV.map(v => `<option value="${v}">Gráficos: ${NAME[v].toLowerCase()}</option>`).join('')}</select>`);
    document.getElementById('oGfx').addEventListener('change', e => set(e.target.value)); }
  function paintSeg() { opsSel(); const o = document.getElementById('oGfx'); if (o) { o.value = pref; o.options[0].textContent = 'Gráficos: auto' + (pref === 'auto' ? ' (' + NAME[LVL].toLowerCase() + ')' : ''); }
    const s = document.getElementById('gfxMode'); if (!s) return; s.querySelectorAll('button').forEach(b => { const on = b.dataset.v === LVL; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    s.title = pref === 'auto' ? `Calidad de gráficos: ${NAME[LVL]} (elegida automáticamente para este equipo)` : `Calidad de gráficos: ${NAME[LVL]}`; }
  function set(v) { pref = v; try { localStorage.setItem('rd_gfx', v); } catch (_) {} apply(v === 'auto' ? autoLv() : v); }
  const fm = document.getElementById('floorMode');
  if (fm && !document.getElementById('gfxMode')) { fm.insertAdjacentHTML('afterend', `<div class="seg" id="gfxMode" role="group" aria-label="Calidad de gráficos"><span class="seglabel">Gráficos</span>${LV.map(v => `<button data-v="${v}">${NAME[v]}</button>`).join('')}</div>`);
    document.getElementById('gfxMode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) set(b.dataset.v); }); }
  // en «Auto», si el equipo no da el ancho con la oclusión (menos de 24 cuadros por segundo), pasa de Alta a Media (Media casi no cuesta)
  let fr = 0, t0 = performance.now(), checks = 0;
  (function tick(now) { fr++; if (now - t0 > 3000) { const fps = fr * 1000 / (now - t0); fr = 0; t0 = now; checks++;
      if (pref === 'auto' && fps < 24 && LVL === 'alta' && !document.hidden) { apply('media'); console.info('Gráficos: bajados a', LVL, '(', fps.toFixed(0), 'cuadros/s)'); }
      if (!document.getElementById('oGfx')) paintSeg(); if (ON.blobs) buildBlobs(); if (ON.halos) buildHalos(); if (SEL.o) { const o = SEL.o; clearSel(); SEL.key = 'o:' + o.id; SEL.o = o; drawObj(o); } }
    const k = .55 + .45 * Math.sin(now * .006); HAL.mats.red.opacity = .3 + .65 * k; ringMat.opacity = .5 + .35 * Math.sin(now * .005);
    requestAnimationFrame(tick); })(performance.now());
  setTimeout(() => apply(LVL), 1500);
  apply(LVL);
  const tune = o => { if (o.r != null) aoMat.uniforms.uR.value = o.r; if (o.i != null) aoMat.uniforms.uI.value = o.i; if (o.k != null) outMat.uniforms.uK.value = o.k; if (o.blob != null) blobMat.opacity = o.blob; };
  return { set, tune, _blobs: () => blobList().map(o => ({ id: o.id, kind: o.kind, name: o.name, p: o.p, l: o.l, d: o.d, a: o.a })), level: () => LVL, pref: () => pref, gpu, select: pickAt, clear: clearSel, state: () => ({ LVL, pref, blobs: blobIM?.count || 0, halos: HAL.n, sel: SEL.key, aoFail }) };
}
