/* Red DAIMAY · Fase 5 · turnos y tripulaciones (lo usan motor/yamaops.js y motor/analisis.js).
   Cada turno guarda: nombre, tripulación, hora de inicio, horas (base 12, editable), paros planeados,
   runners que trabajan ese turno, y por cada yamazumi la plantilla (personas disponibles) y la demanda del turno.
   - Se guarda con el escenario de la planta (SCN.turnos = { list, act }).
   - El turno activo: en el 3D solo corren los runners de ese turno; el análisis de turno puede tomar sus horas, paros y demanda;
     el yamazumi muestra la plantilla disponible contra las personas que usa y las teóricas. */
import { win } from './ventanas.js';
import { PAROS12, parosEn } from './analisis.js';
const CSS = `
#tuWin{position:fixed;box-sizing:border-box;left:50%;top:60px;transform:translateX(-50%);z-index:63;width:min(980px,calc(100vw - 24px));max-height:calc(100vh - 80px);overflow:auto;background:rgba(13,18,24,.97);border:1px solid var(--line,#27323e);border-radius:12px;padding:12px 16px 16px;color:#e7ebef;font:13px/1.45 system-ui,'Segoe UI',sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.55)}
#tuWin h3{margin:0;font-size:16px;flex:1} #tuWin h4{margin:14px 0 6px;font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:#a9b3bd}
#tuWin label{display:grid;gap:3px;font-size:12px;color:#a9b3bd} #tuWin .tu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px 12px}
#tuWin input,#tuWin select{background:#1b232c;border:1px solid #2a3542;border-radius:6px;color:#e7ebef;font:inherit;padding:6px 8px;min-width:0}
#tuWin button{background:#1b232c;border:1px solid #2a3542;border-radius:6px;color:#e7ebef;font:inherit;padding:6px 11px;cursor:pointer;min-height:32px} #tuWin button.on,#tuWin button.prim{background:#FFB020;border-color:#FFB020;color:#12181F;font-weight:700}
#tuWin button:focus-visible,#tuWin input:focus-visible,#tuWin select:focus-visible{outline:2px solid #FFB020;outline-offset:2px}
#tuWin .tu-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px} #tuWin .tu-note{font-size:12px;color:#a9b3bd}
#tuWin .tu-paro{display:grid;grid-template-columns:1.4fr .8fr .8fr 32px;gap:6px;align-items:center;margin-top:6px}
#tuWin table{width:100%;border-collapse:collapse} #tuWin th,#tuWin td{padding:5px 6px;border-bottom:1px solid #1f2933;text-align:left} #tuWin th{color:#a9b3bd;font-weight:600;font-size:12px}
#tuWin .tu-chk{display:flex;gap:6px;align-items:center;color:#e7ebef;font-size:13px}
`;
const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const hhmm = m => { m = Math.round(+m || 0); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };
const readTime = v => { const m = String(v).trim().match(/^(\d+)(?::(\d{1,2}))?$/); return m ? (+m[1]) * 60 + (+(m[2] || 0)) : null; };
export function blank(n) { return { id: uid(), n: n || 'Turno 1', trip: '', ini: '07:00', H: 12, paros: PAROS12.map(p => ({ ...p })), runners: null, dem: {}, plant: {} }; }

export function create(api) {
  const { esc } = api; let el = null, w = null, sel = null;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const T = () => { const S = api.S(); if (!S) return { list: [], act: null }; if (!S.turnos || !Array.isArray(S.turnos.list)) S.turnos = { list: [], act: null }; return S.turnos; };
  const active = () => { const t = T(); return t.list.find(x => x.id === t.act) || null; };
  const yzs = () => { const S = api.S(); return Array.isArray(S?.yz) ? S.yz : []; };
  const runners = () => api.S()?.runners || [];
  const save = () => { api.save(); applyRunners(); };

  /* runners del turno activo: los demás no corren en el 3D */
  function applyRunners() { const a = active(); window.RD_TURNO_OFF = a && Array.isArray(a.runners) ? new Set(runners().filter(r => !a.runners.includes(r.id)).map(r => r.id)) : null; }

  /* tarjeta en el panel del yamazumi */
  function card(Y, teor) { const t = T(), a = active(), ro = !!window.RD_RO;
    const pl = a && Y ? a.plant?.[Y.id] : null, dem = a && Y ? a.dem?.[Y.id] : null, used = Y ? Y.ops.filter(o => o.on !== false).length : 0;
    const tripOk = !a || !a.trip || !Y || !Y.trip || a.trip.toUpperCase() === String(Y.trip).toUpperCase();
    return `<div class="vz-card" style="border-color:var(--line,#27323e)"><div class="hd"><b>Turno y tripulación</b></div>
      <select data-tu="act" aria-label="Turno activo" style="width:100%;background:var(--raise,#1b232c);border:1px solid var(--line,#27323e);border-radius:6px;color:inherit;padding:6px;font:inherit"><option value="">Sin turno (todo corre)</option>${t.list.map(x => `<option value="${esc(x.id)}"${x.id === t.act ? ' selected' : ''}>${esc(x.n)}${x.trip ? ' · trip. ' + esc(x.trip) : ''} · ${esc(x.ini)} · ${x.H} h</option>`).join('')}</select>
      ${a ? `<p>${a.H} h desde ${esc(a.ini)} · paros ${parosEn(a.paros, a.H)} min · ${Array.isArray(a.runners) ? a.runners.length + ' de ' + runners().length + ' runners' : 'todos los runners'}</p>
        ${Y ? `<p>Plantilla para «${esc(Y.name)}»: <b>${pl ?? '—'}</b> personas · el yamazumi usa ${used}${teor ? ' · teóricas ' + api.fmtN(teor, 1) : ''}${pl != null && pl < used ? ' · <span style="color:#ff5a4f">faltan ' + (used - pl) + '</span>' : ''}<br>Demanda del turno: <b>${dem ?? '—'}</b> piezas${!tripOk ? `<br><span style="color:#FFB020">El yamazumi es de la tripulación ${esc(Y.trip)}; el turno es de la ${esc(a.trip)}.</span>` : ''}</p>` : ''}` : '<p>Sin turno activo: corren todos los runners y el análisis usa sus propios valores.</p>'}
      ${ro ? '' : '<div class="vz-btns"><button data-tu="open">Administrar turnos</button></div>'}</div>`; }
  function cardChange(t) { if (t.dataset.tu === 'act') { T().act = t.value || null; save(); return true; } return false; }
  function cardClick(b) { if (b?.dataset.tu === 'open') { open(); return true; } return false; }

  /* ventana de administración */
  function open() { close(); el = document.createElement('div'); el.id = 'tuWin'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Turnos y tripulaciones'); document.body.appendChild(el);
    w = win(el, { title: 'Turnos y tripulaciones', key: 'turnos' }); sel = T().act || T().list[0]?.id || null; draw(); }
  function close() { w?.remove(); w = null; el?.remove(); el = null; api.redraw?.(); }
  function draw() { if (!el) return; const t = T(), x = t.list.find(q => q.id === sel) || null, R = runners(), Ys = yzs();
    el.querySelector('.tu-body')?.remove(); const b = document.createElement('div'); b.className = 'tu-body'; el.appendChild(b);
    b.innerHTML = `<div class="tu-row" style="margin-top:0"><h3>Turnos y tripulaciones</h3><button data-k="close">Cerrar</button></div>
      <div class="tu-row">${t.list.map(q => `<button data-sel="${esc(q.id)}" class="${q.id === sel ? 'on' : ''}">${esc(q.n)}${q.trip ? ' · ' + esc(q.trip) : ''}${q.id === t.act ? ' ●' : ''}</button>`).join('')}<button data-k="add">+ Nuevo turno</button></div>
      ${!x ? '<p class="tu-note">Crea un turno para capturar su plantilla, demanda, paros y runners.</p>' : `
      <h4>Datos del turno</h4><div class="tu-grid">
        <label>Nombre<input data-f="n" value="${esc(x.n)}"></label><label>Tripulación<input data-f="trip" value="${esc(x.trip)}" placeholder="A, B, C…"></label>
        <label>Hora de inicio<input data-f="ini" value="${esc(x.ini)}" placeholder="07:00"></label><label>Horas del turno<input data-f="H" type="number" min="1" max="24" step="0.5" value="${x.H}"></label></div>
      <h4>Paros planeados · ${parosEn(x.paros, x.H)} min dentro del turno · tiempo disponible ${hhmm(x.H * 60 - parosEn(x.paros, x.H))} h${x.paros.some(p => p.ini >= x.H * 60) ? ' · <span style="color:#FFB020">hay paros después del fin del turno; no cuentan</span>' : ''}</h4>
      ${x.paros.map((p, i) => `<div class="tu-paro"><input data-p="n" data-i="${i}" value="${esc(p.n)}" aria-label="Nombre del paro ${i + 1}"><label style="display:flex;gap:4px;align-items:center">inicia<input data-p="ini" data-i="${i}" value="${hhmm(p.ini)}" style="width:64px" aria-label="Inicio del paro ${i + 1} desde el arranque"></label><label style="display:flex;gap:4px;align-items:center">min<input data-p="dur" data-i="${i}" type="number" min="0" value="${p.dur}" style="width:64px" aria-label="Minutos del paro ${i + 1}"></label><button data-px="${i}" aria-label="Quitar paro ${i + 1}">×</button></div>`).join('')}
      <div class="tu-row"><button data-k="addp">Agregar paro</button><button data-k="base">Paros base de 12 h</button><span class="tu-note">La hora de cada paro cuenta desde el arranque del turno.</span></div>
      <h4>Plantilla y demanda por yamazumi</h4>${Ys.length ? `<table><thead><tr><th>Yamazumi</th><th>Tripulación</th><th>Personas en el yamazumi</th><th>Plantilla del turno</th><th>Demanda del turno (pzs)</th></tr></thead><tbody>${Ys.map(Y => `<tr><td>${esc(Y.name)}</td><td>${esc(Y.trip || '—')}</td><td>${Y.ops.filter(o => o.on !== false).length}</td>
        <td><input data-pl="${esc(Y.id)}" type="number" min="0" step="1" value="${x.plant?.[Y.id] ?? ''}" style="width:90px" aria-label="Plantilla de ${esc(Y.name)}"></td><td><input data-dm="${esc(Y.id)}" type="number" min="0" step="1" value="${x.dem?.[Y.id] ?? ''}" style="width:110px" aria-label="Demanda de ${esc(Y.name)}"></td></tr>`).join('')}</tbody></table>` : '<p class="tu-note">Todavía no hay yamazumis de operaciones en este escenario.</p>'}
      <h4>Runners de este turno</h4><label class="tu-chk"><input type="checkbox" data-k="allr"${x.runners === null ? ' checked' : ''}> Todos los runners del escenario</label>
      ${x.runners !== null ? `<div class="tu-grid" style="margin-top:6px">${R.map(r => `<label class="tu-chk"><input type="checkbox" data-r="${esc(r.id)}"${x.runners.includes(r.id) ? ' checked' : ''}><i style="width:10px;height:10px;border-radius:2px;background:${esc(r.color)}"></i>${esc(r.name)}</label>`).join('') || '<span class="tu-note">Este escenario no tiene runners.</span>'}</div>` : ''}
      <div class="tu-row"><button class="prim" data-k="act">${t.act === x.id ? 'Turno activo' : 'Usar este turno'}</button><button data-k="dup">Duplicar</button><button data-k="del">Eliminar</button></div>`}`; }
  function onChange(e) { const t = e.target, L = T(), x = L.list.find(q => q.id === sel); if (!x) return;
    if (t.dataset.f) { const k = t.dataset.f; if (k === 'H') { const v = +t.value; if (v > 0) x.H = Math.min(24, v); } else x[k] = t.value.trim(); save(); draw(); return; }
    if (t.dataset.p) { const p = x.paros[+t.dataset.i]; if (!p) return; if (t.dataset.p === 'n') p.n = t.value.trim() || 'Paro'; else if (t.dataset.p === 'ini') { const m = readTime(t.value); if (m !== null) p.ini = m; } else p.dur = Math.max(0, +t.value || 0); save(); draw(); return; }
    if (t.dataset.pl) { const v = t.value === '' ? null : Math.max(0, Math.round(+t.value)); x.plant = x.plant || {}; if (v === null) delete x.plant[t.dataset.pl]; else x.plant[t.dataset.pl] = v; save(); return; }
    if (t.dataset.dm) { const v = t.value === '' ? null : Math.max(0, Math.round(+t.value)); x.dem = x.dem || {}; if (v === null) delete x.dem[t.dataset.dm]; else x.dem[t.dataset.dm] = v; save(); return; }
    if (t.dataset.k === 'allr') { x.runners = t.checked ? null : runners().map(r => r.id); save(); draw(); return; }
    if (t.dataset.r) { x.runners = x.runners || []; const i = x.runners.indexOf(t.dataset.r); if (t.checked && i < 0) x.runners.push(t.dataset.r); else if (!t.checked && i >= 0) x.runners.splice(i, 1); save(); return; } }
  function onClick(e) { const b = e.target.closest('button'); if (!b) return; const L = T(), x = L.list.find(q => q.id === sel);
    if (b.dataset.k === 'close') return close();
    if (b.dataset.sel) { sel = b.dataset.sel; return draw(); }
    if (b.dataset.k === 'add') { const n = blank('Turno ' + (L.list.length + 1)); L.list.push(n); sel = n.id; save(); return draw(); }
    if (!x) return;
    if (b.dataset.px !== undefined) { x.paros.splice(+b.dataset.px, 1); save(); return draw(); }
    if (b.dataset.k === 'addp') { x.paros.push({ n: 'Paro', ini: Math.min(x.H * 60 - 15, 120), dur: 10 }); save(); return draw(); }
    if (b.dataset.k === 'base') { x.paros = PAROS12.map(p => ({ ...p })); save(); return draw(); }
    if (b.dataset.k === 'act') { L.act = L.act === x.id ? null : x.id; save(); return draw(); }
    if (b.dataset.k === 'dup') { const c = JSON.parse(JSON.stringify(x)); c.id = uid(); c.n = x.n + ' (copia)'; L.list.push(c); sel = c.id; save(); return draw(); }
    if (b.dataset.k === 'del') { if (!confirm(`¿Eliminar el turno «${x.n}»?`)) return; L.list.splice(L.list.indexOf(x), 1); if (L.act === x.id) L.act = null; sel = L.list[0]?.id || null; save(); return draw(); } }
  document.addEventListener('change', e => { if (el && el.contains(e.target)) onChange(e); });
  document.addEventListener('click', e => { if (el && el.contains(e.target)) onClick(e); });
  applyRunners();
  return { card, cardChange, cardClick, open, close, active, list: () => T().list, applyRunners };
}
