/* Red DAIMAY · ventanas flotantes de los gemelos (lo cargan motor/visor.js y motor/flujo.js).
   - win(el, {title, key}): le pone a un panel una barra para arrastrarlo y un botón para minimizarlo a una pastilla.
     La posición y si está minimizado se recuerdan por navegador (localStorage 'rd_win_<key>').
   - El mapa de calor 5S (capa 'net5s' del gemelo) gana «Ocultar leyenda» (los colores se quedan) y «Apagar 5S», cada uno con pastilla para regresarlo.
   - Quita del encabezado del gemelo el subtítulo del plano (DWG, revisión, escala).
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
.rd-5sbar{position:fixed;z-index:46;display:flex;gap:6px}
#topbar .brand span{display:none}
.rd-5s{all:unset;cursor:pointer;background:#17202c;color:#fff;border-radius:99px;padding:6px 12px;font:600 12px/1.2 system-ui,'Segoe UI',sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.3);white-space:nowrap}
.rd-5s:hover{background:#d22c4d}
body.rd-clean>*:not(#stage):not(#rdClean):not(script):not(style){visibility:hidden!important}
#rdClean{all:unset;position:fixed;right:12px;bottom:12px;z-index:80;cursor:pointer;background:rgba(13,18,24,.88);color:#e7ebef;border:1px solid rgba(127,140,155,.5);border-radius:99px;padding:7px 12px;font:600 12px/1.2 system-ui,'Segoe UI',sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3)}
#rdClean:hover,body.rd-clean #rdClean{background:#FFB020;color:#12181F;border-color:#FFB020} #rdClean:focus-visible{outline:2px solid #FFB020;outline-offset:2px}
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
  // modo limpio: deja solo la planta 3D (para presentar o tomar capturas); H o el botón lo encienden y apagan
  if (!document.getElementById('rdClean')) { const b = document.createElement('button'); b.type = 'button'; b.id = 'rdClean'; document.body.appendChild(b);
    const set = on => { document.body.classList.toggle('rd-clean', on); b.textContent = on ? '◱ Mostrar paneles (H)' : '◱ Vista limpia (H)'; b.setAttribute('aria-pressed', String(on)); b.title = on ? 'Regresar los paneles' : 'Esconder todos los paneles y dejar solo la planta'; };
    b.onclick = () => set(!document.body.classList.contains('rd-clean')); set(false);
    addEventListener('keydown', e => { if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
      if (e.key === 'h' || e.key === 'H') { e.preventDefault(); set(!document.body.classList.contains('rd-clean')); } else if (e.key === 'Escape' && document.body.classList.contains('rd-clean')) set(false); }); }
  // mapa de calor 5S: «Ocultar leyenda» deja los colores en el piso y quita solo el recuadro de niveles; «Apagar 5S» quita todo.
  // Cada uno deja una pastilla a la izquierda para regresarlo.
  let bar = null, legOff = false, offByMe = false, pLeg = null, pAll = null;
  const G5 = () => scene && scene.getObjectByName('net5s'), L5 = () => document.getElementById('net5sLeg');
  const drop = p => { p?.remove(); return null; };
  setInterval(() => { const g = G5(), leg = L5(), colors = !!(g && g.visible);
    if (!bar) { bar = document.createElement('div'); bar.className = 'rd-5sbar'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Mapa de calor 5S');
      bar.innerHTML = '<button type="button" class="rd-5s" data-k="leg" title="Quitar el recuadro de niveles y dejar los colores en el piso">Ocultar leyenda</button><button type="button" class="rd-5s" data-k="off" title="Quitar el mapa de calor 5S de la vista">Apagar 5S ×</button>'; document.body.appendChild(bar);
      bar.addEventListener('click', e => { const k = e.target.closest('button')?.dataset.k, l = L5(), gg = G5();
        if (k === 'leg') { legOff = true; if (l) l.hidden = true; }
        else if (k === 'off') { if (gg) gg.visible = false; if (l) l.hidden = true; offByMe = true; legOff = false; } }); }
    if (colors) { pAll = drop(pAll); offByMe = false;
      if (legOff) { if (leg) leg.hidden = true; bar.hidden = true;
        if (!pLeg) pLeg = pill('▣ Leyenda 5S', 'Mostrar el recuadro de niveles 5S', () => { legOff = false; const l = L5(); if (l) l.hidden = false; pLeg = drop(pLeg); }); }
      else { pLeg = drop(pLeg); if (leg && !leg.hidden) { const r = leg.getBoundingClientRect(); bar.hidden = false; const w = bar.offsetWidth || 230;
          bar.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px'; bar.style.top = Math.max(8, r.top - 38) + 'px'; } else bar.hidden = true; } }
    else { bar.hidden = true; pLeg = drop(pLeg);
      if (offByMe && !pAll) pAll = pill('▣ 5S', 'Volver a mostrar el mapa de calor 5S', () => { const gg = G5(), l = L5(); if (gg) gg.visible = true; if (l) l.hidden = false; offByMe = false; pAll = drop(pAll); }); }
  }, 400);
  return { win };
}
