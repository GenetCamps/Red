/* Red DAIMAY · ventanas flotantes de los gemelos (lo cargan motor/visor.js y motor/flujo.js).
   - win(el, {title, key}): le pone a un panel una barra para arrastrarlo y un botón para minimizarlo a una pastilla.
     La posición y si está minimizado se recuerdan por navegador (localStorage 'rd_win_<key>').
   - El mapa de calor 5S (capa 'net5s' del gemelo) gana un botón «Ocultar 5S» y una pastilla para volver a mostrarlo.
   - Pone el logo de DAIMAY en el encabezado del gemelo. */
const CSS = `
.rd-wbar{display:flex;align-items:center;gap:8px;margin:-4px -4px 8px;padding:4px 6px;border-radius:7px;cursor:grab;user-select:none;touch-action:none;background:rgba(127,140,155,.14)}
.rd-wbar:active{cursor:grabbing}
.rd-wbar .rd-wt{flex:1;font:600 12px/1.2 system-ui,'Segoe UI',sans-serif;letter-spacing:.04em;text-transform:uppercase;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-wbar button{all:unset;cursor:pointer;width:26px;height:24px;border-radius:6px;text-align:center;font:700 16px/24px system-ui,sans-serif;border:1px solid rgba(127,140,155,.45)}
.rd-wbar button:hover{background:rgba(127,140,155,.25)} .rd-wbar button:focus-visible,#rdTray button:focus-visible,.rd-5s:focus-visible{outline:2px solid #FFB020;outline-offset:2px}
#rdTray{position:fixed;left:12px;top:50%;transform:translateY(-50%);z-index:70;display:flex;flex-direction:column;gap:6px;align-items:flex-start;pointer-events:none}
#rdTray button{all:unset;pointer-events:auto;cursor:pointer;background:rgba(13,18,24,.94);color:#e7ebef;border:1px solid #FFB020;border-radius:99px;padding:6px 12px;font:600 12px/1.2 system-ui,'Segoe UI',sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35)}
#rdTray button:hover{background:#FFB020;color:#12181F}
.rd-5s{all:unset;position:fixed;z-index:46;cursor:pointer;background:#17202c;color:#fff;border-radius:99px;padding:6px 12px;font:600 12px/1.2 system-ui,'Segoe UI',sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.3);white-space:nowrap}
.rd-5s:hover{background:#d22c4d}
.rd-logo{height:30px;width:auto;border-radius:6px;background:#fff;padding:2px;flex:none;align-self:center}
`;
let tray = null;
function ensure() { if (tray) return; const s = document.createElement('style'); s.id = 'rdWinCss'; s.textContent = CSS; document.head.appendChild(s);
  tray = document.createElement('div'); tray.id = 'rdTray'; tray.setAttribute('aria-label', 'Ventanas minimizadas'); document.body.appendChild(tray); }
function pill(text, title, fn) { ensure(); const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.title = title; b.onclick = fn; tray.appendChild(b); return b; }
const load = k => { try { return JSON.parse(localStorage.getItem('rd_win_' + k) || 'null') || {}; } catch (_) { return {}; } };
const store = (k, v) => { try { localStorage.setItem('rd_win_' + k, JSON.stringify(v)); } catch (_) {} };

export function win(el, { title, key }) {
  ensure(); const st = load(key); let chip = null;
  const bar = document.createElement('div'); bar.className = 'rd-wbar'; bar.title = 'Arrastra para mover';
  bar.innerHTML = `<span class="rd-wt">⠿ ${title}</span><button type="button" title="Minimizar" aria-label="Minimizar ${title}">–</button>`; el.prepend(bar);
  const place = (x, y) => { const r = el.getBoundingClientRect(); x = Math.max(4, Math.min(x, innerWidth - Math.min(r.width, innerWidth - 8) - 4)); y = Math.max(4, Math.min(y, innerHeight - 44));
    Object.assign(el.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto', transform: 'none' }); return [x, y]; };
  if (typeof st.x === 'number') requestAnimationFrame(() => place(st.x, st.y));
  let d = null;
  bar.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; const r = el.getBoundingClientRect(); d = { ox: e.clientX - r.left, oy: e.clientY - r.top }; try { bar.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
  bar.addEventListener('pointermove', e => { if (!d) return; const p = place(e.clientX - d.ox, e.clientY - d.oy); st.x = p[0]; st.y = p[1]; });
  const end = () => { if (d) { d = null; store(key, st); } }; bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
  const restore = () => { el.style.display = ''; chip?.remove(); chip = null; st.min = false; store(key, st); };
  const minimize = () => { if (chip) return; el.style.display = 'none'; chip = pill('▣ ' + title, 'Mostrar ' + title, restore); st.min = true; store(key, st); };
  bar.querySelector('button').onclick = minimize; if (st.min) minimize();
  return { minimize, restore, remove() { chip?.remove(); chip = null; bar.remove(); } };
}

export function init({ scene }) {
  ensure();
  // logo en el encabezado del gemelo
  const brand = document.querySelector('.brand'); if (brand && !brand.querySelector('.rd-logo')) { const im = document.createElement('img'); im.className = 'rd-logo'; im.alt = 'DAIMAY'; im.src = 'estilo/logo_daimay.png'; im.onerror = () => im.remove(); brand.prepend(im); }
  // mapa de calor 5S: botón para ocultarlo y pastilla para regresarlo
  let btn = null, chip = null;
  setInterval(() => { const leg = document.getElementById('net5sLeg'), g = scene && scene.getObjectByName('net5s'), on = !!(leg && !leg.hidden && g && g.visible);
    if (on) { if (chip) { chip.remove(); chip = null; }
      if (!btn) { btn = document.createElement('button'); btn.type = 'button'; btn.className = 'rd-5s'; btn.textContent = 'Ocultar 5S ×'; btn.title = 'Quitar el mapa de calor 5S de la vista'; document.body.appendChild(btn);
        btn.onclick = () => { const G = scene.getObjectByName('net5s'), L = document.getElementById('net5sLeg'); if (G) G.visible = false; if (L) L.hidden = true; btn.hidden = true;
          chip = pill('▣ 5S', 'Mostrar el mapa de calor 5S', () => { const G2 = scene.getObjectByName('net5s'), L2 = document.getElementById('net5sLeg'); if (G2) G2.visible = true; if (L2) L2.hidden = false; chip?.remove(); chip = null; }); }; }
      const r = leg.getBoundingClientRect(); btn.hidden = false; btn.style.left = Math.max(8, Math.min(innerWidth - 120, r.left + r.width / 2 - 52)) + 'px'; btn.style.top = Math.max(8, r.top - 36) + 'px'; }
    else if (btn) btn.hidden = true; }, 400);
  return { win };
}
