/* Red DAIMAY · Fase 5 · análisis de turno de los yamazumis de operaciones (lo usan motor/flujo.js y motor/yamaops.js).
   Corre la misma lógica de la simulación 3D, pero sin animación y por todo el horizonte que se elija (base 12 h, editable),
   con los paros planeados (comida, descansos, juntas) que capture el usuario.
   - Los ciclos son los medidos: cada persona los repite en orden aleatorio; se hacen varias repeticiones y se da el rango.
   - La entrada de material es la demanda capturada a mano para la línea (piezas por horizonte), repartida en el tiempo neto.
   - Costo por minuto: lo captura el usuario por planta. Se cuesta el tiempo perdido (espera de material y retrabajo).
     Las piezas faltantes solo se cuentan.
   - Resultado: gráfica por operador (trabajo, espera de material, retrabajo, paros), dónde y cuándo esperan más, cola por hora,
     y un reporte descargable (página para imprimir o guardar como PDF, y archivo CSV para Excel). */
import { win } from './ventanas.js';
const CSS = `
#anaWin{position:fixed;box-sizing:border-box;left:50%;top:60px;transform:translateX(-50%);z-index:62;width:min(1120px,calc(100vw - 24px));max-height:calc(100vh - 80px);overflow:auto;background:rgba(13,18,24,.97);border:1px solid var(--line,#27323e);border-radius:12px;padding:12px 16px 16px;color:#e7ebef;font:13px/1.45 system-ui,'Segoe UI',sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.55)}
#anaWin h3{margin:0 0 6px;font-size:16px} #anaWin h4{margin:16px 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#a9b3bd}
#anaWin .an-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 12px}
#anaWin label{display:grid;gap:3px;font-size:12px;color:#a9b3bd}
#anaWin input,#anaWin select{background:#1b232c;border:1px solid #2a3542;border-radius:6px;color:#e7ebef;font:inherit;padding:6px 8px;min-width:0}
#anaWin button{background:#1b232c;border:1px solid #2a3542;border-radius:6px;color:#e7ebef;font:inherit;padding:6px 11px;cursor:pointer;min-height:32px}
#anaWin button.prim{background:#FFB020;border-color:#FFB020;color:#12181F;font-weight:700}
#anaWin button:focus-visible,#anaWin input:focus-visible,#anaWin select:focus-visible{outline:2px solid #FFB020;outline-offset:2px}
#anaWin .an-paros{display:grid;gap:6px;margin-top:6px} #anaWin .an-paro{display:grid;grid-template-columns:1.4fr .8fr .8fr 32px;gap:6px;align-items:center}
#anaWin .an-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
#anaWin .an-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px}
#anaWin .an-kpi{background:#111921;border:1px solid #232d38;border-radius:9px;padding:9px 11px} #anaWin .an-kpi b{display:block;font-size:20px;font-variant-numeric:tabular-nums} #anaWin .an-kpi span{font-size:11.5px;color:#a9b3bd}
#anaWin .an-kpi.bad b{color:#ff6b62} #anaWin .an-kpi.ok b{color:#3ddc97}
#anaWin svg{display:block;width:100%;height:auto;background:#111921;border:1px solid #232d38;border-radius:9px}
#anaWin table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:12.5px} #anaWin th,#anaWin td{padding:5px 6px;border-bottom:1px solid #1f2933;text-align:right;white-space:nowrap} #anaWin th:first-child,#anaWin td:first-child{text-align:left}
#anaWin th{color:#a9b3bd;font-weight:600} #anaWin .an-note{font-size:12px;color:#a9b3bd;margin:6px 0 0}
#anaWin .an-warn{color:#FFB020}
`;
export const parosEn = (paros, H) => (paros || []).reduce((s, p) => s + Math.max(0, Math.min((+p.ini || 0) + (+p.dur || 0), H * 60) - Math.max(0, +p.ini || 0)), 0);
export const PAROS12 = [{ n: 'Arranque / junta', ini: 0, dur: 15 }, { n: 'Descanso', ini: 180, dur: 15 }, { n: 'Comida', ini: 360, dur: 30 }, { n: 'Descanso', ini: 540, dur: 15 }];
const CATN = { va: 'Proceso (VA)', insp: 'Inspección', mov: 'Movimiento', esp: 'Espera', rew: 'Retrabajo', aju: 'Ajuste / setup', cd: 'Carga / descarga', otro: 'Sin categoría' };
const COLS = { down: '#8e44ad', va: '#199e70', insp: '#3987e5', mov: '#d95926', esp: '#d55181', rew: '#e5484d', aju: '#9085e9', cd: '#c98500', otro: '#7c8a97', starve: '#FFB020', paro: '#4a5562' };

/* ---------- motor ---------- */
export function simulate(nodes, cfg) {
  const H = Math.round(cfg.H * 3600), P = (cfg.paros || []).map(p => [Math.max(0, p.ini * 60), Math.max(0, (p.ini + p.dur) * 60)]).filter(p => p[1] > p[0]);
  const PA = new Uint8Array(H); P.forEach(p => PA.fill(1, Math.min(H, p[0]), Math.min(H, p[1]))); const inParo = t => PA[t] === 1;
  let net = 0; for (let t = 0; t < H; t++) if (!PA[t]) net++;
  const D = cfg.dem > 0 ? cfg.dem : 0, gap = D ? net / D : 0, reps = Math.max(1, Math.min(50, cfg.reps | 0)), nh = Math.ceil(H / 3600);
  const idx = new Map(nodes.map((n, i) => [n.id, i])), nx = nodes.map(n => idx.has(n.next) && n.next !== n.id ? idx.get(n.next) : -1), preds = nodes.map((_, i) => nx.filter(j => j === i).length);
  const expo = m => -Math.log(1 - Math.random()) * m;
  const agg = nodes.map(() => ({ cat: {}, starve: 0, paro: 0, down: 0, nfail: 0, scrap: 0, done: 0, qsum: 0, qmax: 0, sh: new Array(nh).fill(0), qh: new Array(nh).fill(0) })), outs = [];
  for (let r = 0; r < reps; r++) {
    const S = nodes.map(n => { const f = n.fail || {}; return { q: 0, busy: false, rem: 0, cat: 'va', bag: [], arr: 0, mtbf: +f.mtbf > 0 ? f.mtbf * 60 : 0, mttr: +f.mttr > 0 ? f.mttr * 60 : 0, sc: +f.scrap > 0 ? f.scrap / 100 : 0, nf: 0, dn: 0 }; });
    S.forEach(s => { if (s.mtbf && s.mttr) s.nf = expo(s.mtbf); }); let out = 0;
    const draw = (i) => { const s = S[i]; if (!s.bag.length) { const c = nodes[i].cycles.filter(x => +x.t > 0).map(x => ({ t: +x.t, cat: x.cat || 'va' })); if (!c.length) c.push({ t: 60, cat: 'va' });
        for (let k = c.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [c[k], c[j]] = [c[j], c[k]]; } s.bag = c; } return s.bag.pop(); };
    for (let t = 0; t < H; t++) { const paro = inParo(t), hr = Math.floor(t / 3600);
      for (let i = 0; i < nodes.length; i++) { const s = S[i], A = agg[i];
        if (paro) { A.paro++; continue; }
        if (!preds[i]) { if (gap) { s.arr += 1; while (s.arr >= gap) { s.arr -= gap; s.q++; } } else if (s.q < 1) s.q = 1; }
        if (s.dn > 0) { s.dn -= 1; A.down++; A.qsum += s.q; if (s.q > A.qmax) A.qmax = s.q; A.qh[hr] = Math.max(A.qh[hr], s.q); continue; }
        if (s.mtbf && s.mttr) { s.nf -= 1; if (s.nf <= 0) { s.dn = Math.max(1, Math.round(expo(s.mttr))); s.nf = expo(s.mtbf); A.nfail++; A.down++; s.dn -= 1; continue; } }
        if (!s.busy && s.q > 0) { s.q--; const c = draw(i); s.rem = c.t; s.cat = c.cat; s.busy = true; }
        if (s.busy) { A.cat[s.cat] = (A.cat[s.cat] || 0) + 1; s.rem -= 1; if (s.rem <= 0) { s.busy = false; A.done++; if (s.sc && Math.random() < s.sc) A.scrap++; else if (nx[i] >= 0) S[nx[i]].q++; else out++; } }
        else { A.starve++; A.sh[hr]++; }
        A.qsum += s.q; if (s.q > A.qmax) A.qmax = s.q; A.qh[hr] = Math.max(A.qh[hr], s.q); } }
    outs.push(out);
  }
  const k = 1 / reps, per = nodes.map((n, i) => { const A = agg[i], cat = {}; Object.keys(A.cat).forEach(c => cat[c] = A.cat[c] * k / 60);
    const work = Object.values(cat).reduce((a, b) => a + b, 0), starve = A.starve * k / 60, paro = A.paro * k / 60, rew = cat.rew || 0, down = A.down * k / 60, done = A.done * k, scrap = A.scrap * k;
    const ts = n.cycles.map(x => +x.t).filter(t => t > 0), ideal = ts.length ? Math.min(...ts) : 0, mean = ts.length ? ts.reduce((a, b) => a + b, 0) / ts.length : 0, avail = H / 60 - paro, run = avail - down;
    const oA = avail > 0 ? run / avail : null, oR = run > 0 && ideal ? Math.min(1, ideal * done / 60 / run) : null, oQ = done > 0 ? (done - scrap) / done : null;
    return { id: n.id, name: n.name, oper: n.oper, short: n.short, cat, work, starve, paro, rew, down, nfail: A.nfail * k, scrap, ideal, mean, oA, oR, oQ, oee: oA != null && oR != null && oQ != null ? oA * oR * oQ : null, lost: starve + rew + down, done: A.done * k, qavg: A.qsum / Math.max(1, (H - (A.paro / reps))) * k, qmax: A.qmax,
      sh: A.sh.map((v, h) => { const len = Math.min(3600, H - h * 3600), pz = P.reduce((a, p) => a + Math.max(0, Math.min(p[1], (h + 1) * 3600) - Math.max(p[0], h * 3600)), 0); return len - pz > 0 ? v * k / (len - pz) : 0; }), qh: A.qh, next: nx[i] >= 0 ? nodes[nx[i]].oper || nodes[nx[i]].short : null }; });
  const mean = outs.reduce((a, b) => a + b, 0) / outs.length, tail = per.filter((_, i) => nx[i] < 0);
  const neckIdeal = Math.max(0, ...per.map(p => p.ideal)), lineOee = neckIdeal && net ? Math.min(1, mean * neckIdeal / net) : null;
  return { lineOee, neckIdeal, H: cfg.H, net: net / 60, paroMin: (H - net) / 60, dem: D, reps, out: { mean, min: Math.min(...outs), max: Math.max(...outs) }, per, nh, paros: cfg.paros || [], sinks: tail.length };
}

/* ---------- vista ---------- */
export function create(api) {
  const { esc, fmtN } = api; let el = null, w = null, last = null, cmpOn = false, failOn = false, balOn = false;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const f0 = v => fmtN(v, 0), f1 = v => fmtN(v, 1), money = v => '$' + fmtN(v, 0);
  const hhmm = m => { m = Math.round(m); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };
  const cfgOf = () => { const S = api.S() || {}; S.ana = S.ana || {}; const a = S.ana; if (!a.H) a.H = 12; if (!Array.isArray(a.paros)) a.paros = PAROS12.map(p => ({ ...p })); if (!a.reps) a.reps = 10; return a; };

  function open(scope) {
    close(); el = document.createElement('div'); el.id = 'anaWin'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Análisis de turno'); document.body.appendChild(el);
    w = win(el, { title: 'Análisis de turno', key: 'analisis' }); el.dataset.scope = scope || ''; form(); }
  function close() { w?.remove(); w = null; el?.remove(); el = null; }
  function people() { const sc = el?.dataset.scope || 'anim', A = api.flow.anim(), Y = api.yz();
    if (sc === 'yz' || !A.length) return { label: Y ? `Operaciones marcadas de «${Y.name}»` : 'Sin yamazumi', Y, list: Y ? Y.ops.filter(o => o.on !== false).map(o => ({ Y, o })) : [] };
    return { label: `Personas elegidas con ▶ (${A.length})`, Y: A[0].Y, list: A }; }
  function form() {
    const a = cfgOf(), P = people(), Y = P.Y, A = api.flow.anim(), y = api.yz(), dem = Y ? (Y.dem ?? '') : '', ro = !!window.RD_RO;
    const parosMin = parosEn(a.paros, a.H);
    el.querySelector('.an-body')?.remove(); const b = document.createElement('div'); b.className = 'an-body'; el.appendChild(b);
    b.innerHTML = `<div style="display:flex;gap:10px;align-items:center"><h3 style="flex:1">Análisis de turno${Y ? ' · ' + esc(Y.name) : ''}</h3><button data-k="close">Cerrar</button></div>
      <div class="an-grid">
        <label>Personas<select data-a="scope">${A.length ? `<option value="anim"${el.dataset.scope !== 'yz' ? ' selected' : ''}>Elegidas con ▶ (${A.length})</option>` : ''}${y ? `<option value="yz"${el.dataset.scope === 'yz' || !A.length ? ' selected' : ''}>Todo «${esc(y.name)}» (${y.ops.filter(o => o.on !== false).length})</option>` : ''}</select></label>
        ${api.turnos?.()?.list().length ? `<label>Turno<select data-a="turno"><option value="">Personalizado</option>${api.turnos().list().map(t => `<option value="${esc(t.id)}"${a.turno === t.id ? ' selected' : ''}>${esc(t.n)}${t.trip ? ' · trip. ' + esc(t.trip) : ''} · ${t.H} h</option>`).join('')}</select></label>` : ''}
        <label>Horizonte (horas)<input data-a="H" type="number" min="1" max="72" step="0.5" value="${a.H}"></label>
        <label>Demanda de la línea (piezas en el horizonte)<input data-a="dem" type="number" min="0" step="1" value="${esc(dem)}" placeholder="captúrala"></label>
        <label>Costo por minuto (MXN)<input data-a="costo" type="number" min="0" step="0.01" value="${esc(a.costo ?? '')}" placeholder="captúralo"></label>
        <label>Repeticiones<input data-a="reps" type="number" min="1" max="50" step="1" value="${a.reps}"></label>
      </div>
      <h4>Paros planeados · ${f0(parosMin)} min · tiempo neto ${hhmm(a.H * 60 - parosMin)} h</h4>
      <div class="an-paros">${a.paros.map((p, i) => `<div class="an-paro"><input data-p="n" data-i="${i}" value="${esc(p.n)}" aria-label="Nombre del paro ${i + 1}"><label style="display:flex;gap:4px;align-items:center">inicia<input data-p="ini" data-i="${i}" value="${hhmm(p.ini)}" aria-label="Hora de inicio del paro ${i + 1} (h:mm desde el arranque)" style="width:64px"></label><label style="display:flex;gap:4px;align-items:center">min<input data-p="dur" data-i="${i}" type="number" min="0" value="${p.dur}" aria-label="Duración en minutos del paro ${i + 1}" style="width:64px"></label><button data-x="${i}" aria-label="Quitar paro ${i + 1}">×</button></div>`).join('')}</div>
      <div class="an-row"><button data-k="addp">Agregar paro</button><button data-k="base">Regresar a base 12 h</button><span class="an-note">La hora de inicio cuenta desde el arranque del turno (0:00).</span></div>
      <div class="an-row"><button data-k="fail" aria-pressed="${failOn}">${failOn ? 'Ocultar paros no planeados y scrap' : 'Paros no planeados y scrap'}</button><span class="an-note">Fallas de máquina o de proceso que ocurren al azar, y el % de piezas que salen mal en cada estación.</span></div>
      ${failOn ? failForm(P) : ''}
      <div class="an-row"><button data-k="bal" aria-pressed="${balOn}">${balOn ? 'Ocultar balanceo' : 'Balanceo automático'}</button><span class="an-note">Propone cómo agrupar las operaciones en estaciones contra el takt, con menos personas.</span>${balOn ? `<label style="display:flex;gap:6px;align-items:center">Llenar hasta<input data-a="balPct" type="number" min="60" max="100" step="1" value="${cfgOf().balPct || 95}" style="width:70px">% del takt</label>` : ''}</div>
      ${balOn ? `<div class="an-bal">${balPane()}</div>` : ''}
      <div class="an-row"><button data-k="cmp" aria-pressed="${cmpOn}">${cmpOn ? 'Quitar comparación' : 'Comparar con un cambio'}</button><span class="an-note">Prueba qué pasa si quitas a alguien, bajas un ciclo, eliminas el retrabajo o cambias a quién entrega.</span></div>
      ${cmpOn ? cmpForm(P) : ''}
      <div class="an-row"><button class="prim" data-k="run">Correr análisis</button><span class="an-note">${esc(P.label)}${!Y?.takt && !dem ? ' · <span class="an-warn">sin demanda: la primera estación nunca se queda sin material</span>' : ''}</span></div>
      <div class="an-res"></div>`;
    if (last) results(last);
  }

  /* ---------- balanceo automático: agrupa operaciones en estaciones contra el takt ---------- */
  const meanOf = o => { const c = (o.cycles || []).map(x => +x.t).filter(t => t > 0); return c.length ? c.reduce((a, b) => a + b, 0) / c.length : 0; };
  function balTakt(Y) { const a = cfgOf(); if (+Y?.takt > 0) return { t: +Y.takt, src: 'takt del yamazumi' }; const D = +Y?.dem || 0; if (D) { const net = a.H * 60 - parosEn(a.paros, a.H); return { t: net * 60 / D, src: 'tiempo neto ÷ demanda' }; } return null; }
  function balance(Y, takt, pct) { const lim = takt * pct / 100, ops = Y.ops.filter(o => o.on !== false), st = []; let cur = null;
    ops.forEach(o => { const t = meanOf(o); if (!t) return;
      if (t > lim) { if (cur) { st.push(cur); cur = null; } st.push({ ops: [o], t, p: Math.ceil(t / lim) }); return; }
      if (cur && cur.t + t <= lim) { cur.ops.push(o); cur.t += t; } else { if (cur) st.push(cur); cur = { ops: [o], t, p: 1 }; } });
    if (cur) st.push(cur); return st; }
  function balCycles(s) { const n = Math.max(1, ...s.ops.map(o => (o.cycles || []).length)), out = [];
    for (let k = 0; k < n; k++) { let t = 0, best = null; s.ops.forEach(o => { const c = (o.cycles || []).filter(x => +x.t > 0); if (!c.length) return; const x = c[k % c.length]; t += +x.t; if (!best || +x.t > +best.t) best = x; }); if (t > 0) out.push({ t: +(t / s.p).toFixed(1), cat: best?.cat || 'va' }); }
    return out; }
  function balPane() { const Y = api.yz(), a = cfgOf(), T = balTakt(Y), pct = a.balPct || 95;
    if (!Y) return '<p class="an-note">Importa un yamazumi para proponer un balanceo.</p>';
    if (!T) return '<p class="an-warn">Para balancear hace falta el takt del yamazumi o la demanda de la línea.</p>';
    const st = balance(Y, T.t, pct), ops = Y.ops.filter(o => o.on !== false), sum = ops.reduce((s, o) => s + meanOf(o), 0), pers = st.reduce((s, x) => s + x.p, 0), teo = sum / T.t, bal = pers ? sum / (pers * T.t) : 0;
    const W = 980, H = 260, px = 50, pw = W - px - 20, ph = H - 70, top = Math.max(T.t * 1.25, ...st.map(s => s.t / s.p * 1.1)), Yv = v => 20 + ph - v / top * ph, bw = Math.min(70, pw / Math.max(1, st.length) * .7);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Estaciones propuestas contra takt"><rect width="${W}" height="${H}" fill="#111921" rx="8"/>`;
    st.forEach((s, i) => { const cx = px + pw / st.length * (i + .5), v = s.t / s.p, c = v > T.t ? '#e5484d' : v > T.t * pct / 100 ? '#FFB020' : '#199e70';
      svg += `<rect x="${cx - bw / 2}" y="${Yv(v)}" width="${bw}" height="${Yv(0) - Yv(v)}" fill="${c}"><title>Estación ${i + 1}: ${s.ops.map(o => o.oper || o.name).join(' + ')} · ${f1(s.t)} s${s.p > 1 ? ' ÷ ' + s.p + ' personas' : ''}</title></rect><text x="${cx}" y="${Yv(v) - 6}" text-anchor="middle" font-size="12" fill="#e7ebef">${f0(v / T.t * 100)}%</text><text x="${cx}" y="${H - 30}" text-anchor="middle" font-size="12" fill="#a9b3bd">E${i + 1}${s.p > 1 ? ' ×' + s.p : ''}</text>`; });
    svg += `<line x1="${px}" x2="${W - 20}" y1="${Yv(T.t)}" y2="${Yv(T.t)}" stroke="#ff5a4f" stroke-width="2" stroke-dasharray="7 4"/><text x="${W - 24}" y="${Yv(T.t) - 6}" text-anchor="end" font-size="12" fill="#e7ebef">Takt ${f1(T.t)} s</text></svg>`;
    BALST = { st, T, pct, Y };
    return `<div class="an-kpis"><div class="an-kpi"><b>${ops.length} → ${pers}</b><span>personas: hoy (una por operación) → propuesta</span></div><div class="an-kpi"><b>${f1(teo)}</b><span>operadores teóricos (suma ÷ takt)</span></div><div class="an-kpi ${bal >= .85 ? 'ok' : ''}"><b>${f0(bal * 100)}%</b><span>balance de la propuesta</span></div><div class="an-kpi"><b>${f1(T.t)} s</b><span>takt (${esc(T.src)}) · llenado a ${pct}%</span></div></div>
      ${svg}<div style="overflow-x:auto"><table><thead><tr><th>Estación</th><th>Operaciones (en orden)</th><th>Tiempo</th><th>Personas</th><th>% del takt</th></tr></thead><tbody>${st.map((s, i) => `<tr><td>E${i + 1}</td><td style="text-align:left;white-space:normal">${s.ops.map(o => esc(o.oper ? `${api.flow.short(o)} (${o.oper})` : o.name)).join(' + ')}</td><td>${f1(s.t)} s</td><td>${s.p}</td><td>${f0(s.t / s.p / T.t * 100)}%</td></tr>`).join('')}</tbody></table></div>
      <p class="an-note">Regla: respeta el orden de las operaciones y junta las que caben juntas sin pasar del ${pct}% del takt; una operación que sola pasa del takt se reparte entre varias personas en paralelo. Es una propuesta para revisar en piso (ergonomía, herramienta, habilidades), no una orden.</p>
      <div class="an-row"><button class="prim" data-k="balsim">Simular propuesta contra la actual</button><button data-k="balyz"${window.RD_RO ? ' hidden' : ''}>Crear yamazumi con la propuesta</button></div>`; }
  let BALST = null;
  function balSim() { if (!BALST) return; const a = cfgOf(), { st, T, Y } = BALST, ops = Y.ops.filter(o => o.on !== false);
    const nA = ops.map((o, i) => ({ id: o.id, name: o.name, oper: o.oper, short: api.flow.short(o), next: ops[i + 1]?.id || null, cycles: o.cycles || [], fail: (a.fail || {})[o.id] || null }));
    const nB = st.map((s, i) => ({ id: 'E' + (i + 1), name: 'Estación ' + (i + 1), oper: `E${i + 1}${s.p > 1 ? ' ×' + s.p : ''}`, short: s.ops.map(o => o.oper || api.flow.short(o)).join(' + ').slice(0, 40), next: i < st.length - 1 ? 'E' + (i + 2) : null, cycles: balCycles(s) }));
    let D = +Y.dem || 0, src = 'capturada'; if (!D && +Y.takt > 0) { D = Math.floor((a.H * 60 - parosEn(a.paros, a.H)) * 60 / Y.takt); src = 'calculada con el takt'; }
    const R = simulate(nA, { H: a.H, paros: a.paros, dem: D, reps: a.reps }); R.demSrc = D ? src : 'sin demanda'; R.costo = a.costo; R.yz = Y.name; R.scope = 'Línea actual en orden (una persona por operación)'; R.at = new Date(); R.used = nA.length;
    const RB = simulate(nB, { H: a.H, paros: a.paros, dem: D, reps: a.reps }); RB.costo = a.costo; RB.dem = D; RB.nPer = st.reduce((x, s) => x + s.p, 0); R.B = RB;
    R.chg = `propuesta de balanceo: ${st.length} estaciones y ${st.reduce((x, s) => x + s.p, 0)} personas en lugar de ${nA.length}`; last = R; results(R); el.querySelector('.an-res')?.scrollIntoView({ block: 'start' }); }
  function balYz() { if (!BALST) return; const { st, Y } = BALST, S = api.S(); if (!S) return; const ids = st.map(() => 'y' + Math.random().toString(36).slice(2, 9));
    const Y2 = { id: 'y' + Math.random().toString(36).slice(2, 9), name: Y.name + ' · balanceo', planta: Y.planta, linea: Y.linea, programa: Y.programa, trip: Y.trip, turno: Y.turno, fecha: new Date().toISOString().slice(0, 10), analista: 'Propuesta de balanceo', takt: Y.takt, dem: Y.dem, src: 'Balanceo automático de «' + Y.name + '»',
      ops: st.map((s, i) => ({ id: ids[i], name: `Estación ${i + 1}${s.p > 1 ? ' (×' + s.p + ')' : ''}`, est: '', pos: '', lado: '', oper: s.ops.map(o => o.oper || o.name).join(' + '), on: true, next: ids[i + 1] || '', cycles: balCycles(s) })) };
    S.yz = (S.yz || []).concat([Y2]); api.save(); alert(`Listo: yamazumi «${Y2.name}» con ${st.length} estaciones. Elígelo en la pestaña Operaciones para animarlo o analizarlo.`); }
  function failOf(id) { const a = cfgOf(); a.fail = a.fail || {}; return a.fail[id] || {}; }
  function failForm(P) { const nm = o => o.oper || api.flow.short(o);
    return `<h4>Paros no planeados y scrap por persona</h4><div style="overflow-x:auto"><table><thead><tr><th>Persona</th><th>Falla cada (min de operación)</th><th>Dura en promedio (min)</th><th>Scrap (%)</th></tr></thead><tbody>${P.list.map(({ o }) => { const f = failOf(o.id);
      return `<tr><td>${esc(nm(o))}<br><small style="color:#a9b3bd">${esc(api.flow.short(o))}</small></td><td><input type="number" min="0" step="1" data-f="mtbf" data-id="${esc(o.id)}" value="${f.mtbf ?? ''}" placeholder="ej. 240" style="width:110px" aria-label="Cada cuántos minutos falla ${esc(nm(o))}"></td>
        <td><input type="number" min="0" step="0.5" data-f="mttr" data-id="${esc(o.id)}" value="${f.mttr ?? ''}" placeholder="ej. 12" style="width:100px" aria-label="Cuánto dura cada falla de ${esc(nm(o))}"></td>
        <td><input type="number" min="0" max="100" step="0.1" data-f="scrap" data-id="${esc(o.id)}" value="${f.scrap ?? ''}" placeholder="ej. 2.5" style="width:90px" aria-label="Porcentaje de scrap de ${esc(nm(o))}"></td></tr>`; }).join('')}</tbody></table></div>
      <p class="an-note">Las fallas llegan al azar con ese promedio; mientras dura una, la persona no trabaja y el material se le acumula. El scrap sale de la línea y no llega a la siguiente estación. Puedes tomar los datos del Centro OEE (paros capturados y scrap de Plex).</p>`; }
  function chgOf(id) { const a = cfgOf(); a.chg = a.chg || {}; return a.chg[id] || { on: true, pct: 100, norew: false, next: null }; }
  function cmpForm(P) { const ids = P.list.map(x => x.o.id), nm = o => o.oper || api.flow.short(o);
    return `<h4>Escenario con cambio</h4><div style="overflow-x:auto"><table><thead><tr><th>Persona</th><th>Se queda</th><th>Ciclo (% del medido)</th><th>Sin retrabajo</th><th>Entrega a</th></tr></thead><tbody>${P.list.map(({ o }) => { const c = chgOf(o.id);
      return `<tr><td>${esc(nm(o))}<br><small style="color:#a9b3bd">${esc(api.flow.short(o))}</small></td><td><input type="checkbox" data-c="on" data-id="${esc(o.id)}"${c.on !== false ? ' checked' : ''} aria-label="${esc(nm(o))} se queda en el escenario"></td>
        <td><input type="number" min="10" max="300" step="5" data-c="pct" data-id="${esc(o.id)}" value="${c.pct ?? 100}" style="width:80px" aria-label="Ciclo de ${esc(nm(o))} en porcentaje del medido"></td>
        <td><input type="checkbox" data-c="norew" data-id="${esc(o.id)}"${c.norew ? ' checked' : ''} aria-label="Quitar el retrabajo de ${esc(nm(o))}"></td>
        <td><select data-c="next" data-id="${esc(o.id)}" aria-label="A quién entrega ${esc(nm(o))} en el escenario"><option value="">Como está (${esc((P.list.find(x => x.o.id === o.next)?.o && nm(P.list.find(x => x.o.id === o.next).o)) || 'salida')})</option><option value="__out"${c.next === '__out' ? ' selected' : ''}>Salida de la línea</option>${P.list.filter(x => x.o.id !== o.id).map(x => `<option value="${esc(x.o.id)}"${c.next === x.o.id ? ' selected' : ''}>${esc(nm(x.o))}</option>`).join('')}</select></td></tr>`; }).join('')}</tbody></table></div>
      <div class="an-row"><button data-k="cmpreset">Quitar todos los cambios</button><span class="an-note">Si quitas a una persona, quien le entregaba ahora entrega a quien seguía después de ella.</span></div>`; }
  function nodesB(nodes) { const a = cfgOf(), ch = a.chg || {}, C = id => ch[id] || {}, keep = new Set(nodes.filter(n => C(n.id).on !== false).map(n => n.id)), byId = new Map(nodes.map(n => [n.id, n]));
    const nextOf = n => { const c = C(n.id); return c.next === '__out' ? null : c.next ? c.next : n.next; };
    const follow = id => { const seen = new Set(); while (id && !keep.has(id) && byId.has(id) && !seen.has(id)) { seen.add(id); id = nextOf(byId.get(id)); } return id && keep.has(id) ? id : null; };
    return nodes.filter(n => keep.has(n.id)).map(n => { const c = C(n.id), k = (+c.pct > 0 ? +c.pct : 100) / 100; let cy = n.cycles.map(x => ({ t: +x.t * k, cat: x.cat }));
      if (c.norew) { const ok = cy.filter(x => x.cat !== 'rew'), m = ok.length ? ok.reduce((s, x) => s + x.t, 0) / ok.length : null; if (m) cy = cy.map(x => x.cat === 'rew' ? { t: m, cat: 'va' } : x); }
      return { ...n, cycles: cy, next: follow(nextOf(n)) }; }); }
  function readTime(v) { const m = String(v).trim().match(/^(\d+)(?::(\d{1,2}))?$/); return m ? (+m[1]) * 60 + (+(m[2] || 0)) : null; }
  function onChange(e) { const t = e.target, a = cfgOf(), P = people();
    if (t.dataset.a === 'scope') { el.dataset.scope = t.value; last = null; form(); return; }
    if (t.dataset.f && t.dataset.id) { a.fail = a.fail || {}; const f = a.fail[t.dataset.id] = { ...failOf(t.dataset.id) }, v = t.value === '' ? undefined : Math.max(0, +t.value); if (v === undefined) delete f[t.dataset.f]; else f[t.dataset.f] = t.dataset.f === 'scrap' ? Math.min(100, v) : v; api.save(); return; }
    if (t.dataset.vb) { a.vbox = a.vbox || {}; if (t.value) a.vbox[t.dataset.vb] = t.value; else delete a.vbox[t.dataset.vb]; api.save(); return; }
    if (t.dataset.c) { a.chg = a.chg || {}; const id = t.dataset.id, c = a.chg[id] = { ...chgOf(id) }; if (t.dataset.c === 'on' || t.dataset.c === 'norew') c[t.dataset.c] = t.checked; else if (t.dataset.c === 'pct') c.pct = Math.max(10, Math.min(300, +t.value || 100)); else c.next = t.value || null; api.save(); return; }
    if (t.dataset.a === 'balPct') { const v = Math.max(60, Math.min(100, +t.value || 95)); a.balPct = v; api.save(); const box = el.querySelector('.an-bal'); if (box) box.innerHTML = balPane(); return; }
    if (t.dataset.a === 'turno') { a.turno = t.value || undefined; const tu = api.turnos?.()?.list().find(x => x.id === t.value);
      if (tu) { a.H = tu.H; a.paros = tu.paros.map(p => ({ ...p })); if (P.Y && tu.dem?.[P.Y.id] > 0) P.Y.dem = tu.dem[P.Y.id]; } api.save(); last = null; form(); return; }
    if (t.dataset.a === 'dem') { if (P.Y) { const v = +t.value; P.Y.dem = v > 0 ? Math.round(v) : undefined; api.save(); } return; }
    if (t.dataset.a === 'H' || (t.dataset.p)) a.turno = undefined;
    if (t.dataset.a) { const v = +t.value; if (t.dataset.a === 'costo') a.costo = v >= 0 && t.value !== '' ? v : undefined; else if (v > 0) a[t.dataset.a] = v; api.save(); if (t.dataset.a === 'H') form(); return; }
    if (t.dataset.p) { const p = a.paros[+t.dataset.i]; if (!p) return; if (t.dataset.p === 'n') p.n = t.value.trim() || 'Paro'; else if (t.dataset.p === 'ini') { const m = readTime(t.value); if (m !== null) p.ini = m; } else p.dur = Math.max(0, +t.value || 0); api.save(); form(); } }
  function onClick(e) { const b = e.target.closest('button'); if (!b) return; const a = cfgOf();
    if (b.dataset.x !== undefined) { a.paros.splice(+b.dataset.x, 1); api.save(); form(); }
    else if (b.dataset.k === 'addp') { a.paros.push({ n: 'Paro', ini: Math.min(a.H * 60 - 15, 120), dur: 10 }); api.save(); form(); }
    else if (b.dataset.k === 'base') { a.H = 12; a.paros = PAROS12.map(p => ({ ...p })); api.save(); form(); }
    else if (b.dataset.k === 'run') { const r = el.querySelector('.an-res'); if (r) r.innerHTML = '<p class="an-note">Calculando…</p>'; b.disabled = true; setTimeout(() => { try { run(); } finally { b.disabled = false; } }, 30); }
    else if (b.dataset.k === 'close') close();
    else if (b.dataset.k === 'cmp') { cmpOn = !cmpOn; form(); }
    else if (b.dataset.k === 'fail') { failOn = !failOn; form(); }
    else if (b.dataset.k === 'bal') { balOn = !balOn; form(); }
    else if (b.dataset.k === 'balsim') balSim();
    else if (b.dataset.k === 'balyz') balYz();
    else if (b.dataset.k === 'tovsm') toVsm();
    else if (b.dataset.k === 'cmpreset') { a.chg = {}; api.save(); form(); }
    else if (b.dataset.k === 'pdf') printReport();
    else if (b.dataset.k === 'csv') csv(); }
  function run() { const a = cfgOf(), P = people(); if (!P.list.length) { toastIn('No hay personas para analizar.'); return; }
    const Y = P.Y, dem = Y?.dem > 0 ? Y.dem : (Y?.takt > 0 ? null : 0);
    const nodes = P.list.map(({ o }) => ({ id: o.id, name: o.name, oper: o.oper, short: api.flow.short(o), next: o.next, cycles: o.cycles || [], fail: (a.fail || {})[o.id] || null }));
    let D = Y?.dem > 0 ? Y.dem : 0, src = 'capturada'; if (!D && Y?.takt > 0) { const net = a.H * 60 - parosEn(a.paros, a.H); D = Math.floor(net * 60 / Y.takt); src = 'calculada con el takt de ' + f1(Y.takt) + ' s'; }
    const t0 = performance.now(); const R = simulate(nodes, { H: a.H, paros: a.paros, dem: D, reps: a.reps }); R.ms = performance.now() - t0; R.demSrc = D ? src : 'sin demanda'; R.costo = a.costo; R.yz = Y?.name || ''; R.scope = P.label; R.at = new Date();
    const tu = a.turno && api.turnos?.()?.list().find(x => x.id === a.turno); R.turno = tu ? `${tu.n}${tu.trip ? ' · tripulación ' + tu.trip : ''} · inicio ${tu.ini}` : ''; R.plant = tu && Y ? tu.plant?.[Y.id] : null; R.used = nodes.length;
    if (cmpOn) { const NB = nodesB(nodes); if (NB.length) { const RB = simulate(NB, { H: a.H, paros: a.paros, dem: D, reps: a.reps }); RB.costo = a.costo; RB.dem = D; R.B = RB; R.chg = describe(nodes); } }
    last = R; results(R); }
  function describe(nodes) { const a = cfgOf(), ch = a.chg || {}, nm = id => { const n = nodes.find(x => x.id === id); return n ? (n.oper || n.short) : id; }, out = [];
    nodes.forEach(n => { const c = ch[n.id]; if (!c) return; if (c.on === false) out.push('sin ' + nm(n.id)); if (+c.pct && +c.pct !== 100) out.push(nm(n.id) + ' al ' + c.pct + '% del ciclo'); if (c.norew) out.push(nm(n.id) + ' sin retrabajo'); if (c.next) out.push(nm(n.id) + ' entrega a ' + (c.next === '__out' ? 'la salida' : nm(c.next))); });
    return out.length ? out.join(' · ') : 'sin cambios (misma configuración)'; }
  function toastIn(m) { const r = el.querySelector('.an-res'); if (r) r.innerHTML = `<p class="an-warn">${esc(m)}</p>`; }

  /* ---------- gráficas (SVG) ---------- */
  function barsSvg(R, light) { const per = R.per, H = R.H * 60, rowH = 30, lw = 190, W = 980, pw = W - lw - 90, Hh = 40 + per.length * rowH + 40, tx = light ? '#16202c' : '#e7ebef', mu = light ? '#4a5a6b' : '#a9b3bd', gr = light ? '#d3dce6' : '#26303b';
    const keys = ['va', 'insp', 'cd', 'mov', 'aju', 'otro', 'esp', 'rew'], o = [`<svg viewBox="0 0 ${W} ${Hh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Minutos por operador">`];
    const stp = H > 600 ? 120 : 60; for (let m = 0; m <= H; m += stp) { const x = lw + m / H * pw; o.push(`<line x1="${x}" x2="${x}" y1="28" y2="${Hh - 30}" stroke="${gr}"/><text x="${x}" y="${Hh - 14}" fill="${mu}" font-size="11" text-anchor="middle">${m} min</text>`); }
    per.forEach((p, i) => { const y = 34 + i * rowH; let x = lw;
      o.push(`<text x="${lw - 8}" y="${y + 13}" fill="${tx}" font-size="12.5" font-weight="600" text-anchor="end">${esc((p.oper || p.short || p.name).slice(0, 24))}</text><text x="${lw - 8}" y="${y + 25}" fill="${mu}" font-size="10.5" text-anchor="end">${esc((p.short || '').slice(0, 28))}</text>`);
      const seg = (v, c, t) => { if (v <= 0) return; const w = v / H * pw; o.push(`<rect x="${x}" y="${y + 3}" width="${Math.max(.5, w)}" height="${rowH - 9}" fill="${c}"><title>${esc(t)}: ${f1(v)} min</title></rect>`); x += w; };
      keys.forEach(k => seg(p.cat[k] || 0, COLS[k], CATN[k])); seg(p.starve, COLS.starve, 'Esperando material'); seg(p.down || 0, COLS.down, 'Paros no planeados'); seg(p.paro, COLS.paro, 'Paros planeados');
      o.push(`<text x="${lw + pw + 8}" y="${y + 17}" fill="${p.starve > H * .2 ? '#e5484d' : tx}" font-size="12" font-weight="600">${f0(p.lost)} min</text>`); });
    o.push(`<text x="${lw}" y="18" fill="${mu}" font-size="11.5">Cómo se reparten los minutos del horizonte de cada operador (no es línea de tiempo) · a la derecha, minutos perdidos (espera de material + retrabajo)</text></svg>`); return o.join(''); }
  function heatSvg(R, light) { const per = R.per, nh = R.nh, cw = Math.min(64, 760 / nh), lw = 190, W = lw + nh * cw + 20, rowH = 26, Hh = 34 + per.length * rowH + 30, tx = light ? '#16202c' : '#e7ebef', mu = light ? '#4a5a6b' : '#a9b3bd';
    const col = v => v <= .02 ? (light ? '#eef2f6' : '#16202a') : `rgba(255,176,32,${(.18 + .82 * Math.min(1, v)).toFixed(2)})`, o = [`<svg viewBox="0 0 ${W} ${Hh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Espera de material por hora">`];
    for (let h = 0; h < nh; h++) o.push(`<text x="${lw + h * cw + cw / 2}" y="22" fill="${mu}" font-size="11" text-anchor="middle">${h}–${h + 1} h</text>`);
    per.forEach((p, i) => { const y = 30 + i * rowH; o.push(`<text x="${lw - 8}" y="${y + 16}" fill="${tx}" font-size="12" text-anchor="end">${esc((p.oper || p.short || p.name).slice(0, 24))}</text>`);
      p.sh.forEach((v, h) => o.push(`<rect x="${lw + h * cw + 1}" y="${y + 2}" width="${cw - 2}" height="${rowH - 4}" rx="3" fill="${col(v)}"><title>${esc(p.oper || p.name)} · hora ${h}–${h + 1}: ${f0(v * 100)}% esperando material</title></rect>${v > .1 ? `<text x="${lw + h * cw + cw / 2}" y="${y + 17}" fill="#12181F" font-size="10.5" font-weight="700" text-anchor="middle">${f0(v * 100)}</text>` : ''}`)); });
    o.push(`<text x="${lw}" y="${Hh - 8}" fill="${mu}" font-size="11">% del tiempo trabajable de cada hora en que la persona estuvo esperando material (más oscuro = más espera)</text></svg>`); return o.join(''); }
  function legend() { return `<div class="an-row" style="font-size:12px;color:#a9b3bd">${['va', 'insp', 'rew', 'cd', 'mov', 'aju', 'otro'].map(k => `<span><i style="display:inline-block;width:11px;height:11px;border-radius:2px;background:${COLS[k]};margin-right:5px;vertical-align:-1px"></i>${CATN[k]}</span>`).join('')}<span><i style="display:inline-block;width:11px;height:11px;border-radius:2px;background:${COLS.starve};margin-right:5px;vertical-align:-1px"></i>Esperando material</span><span><i style="display:inline-block;width:11px;height:11px;border-radius:2px;background:${COLS.down};margin-right:5px;vertical-align:-1px"></i>Paros no planeados</span><span><i style="display:inline-block;width:11px;height:11px;border-radius:2px;background:${COLS.paro};margin-right:5px;vertical-align:-1px"></i>Paros planeados</span></div>`; }

  function summary(R) { const lost = R.per.reduce((a, p) => a + p.lost, 0), starve = R.per.reduce((a, p) => a + p.starve, 0), rew = R.per.reduce((a, p) => a + p.rew, 0), falt = R.dem ? Math.max(0, R.dem - R.out.mean) : null;
    const neck = R.per.slice().sort((a, b) => b.qmax - a.qmax || (b.work - a.work))[0], waitTop = R.per.slice().sort((a, b) => b.starve - a.starve);
    return { lost, starve, rew, falt, neck, waitTop, cost: R.costo > 0 ? lost * R.costo : null, costStarve: R.costo > 0 ? starve * R.costo : null, costRew: R.costo > 0 ? rew * R.costo : null }; }
  function results(R) { const r = el.querySelector('.an-res'); if (!r) return; const s = summary(R);
    r.innerHTML = `<h4>Resultado · ${R.turno ? esc(R.turno) + ' · ' : ''}${f1(R.H)} h · tiempo neto ${hhmm(R.net)} h · ${R.reps} repeticiones</h4>
      ${R.plant != null ? `<p class="an-note">Plantilla del turno: <b>${R.plant}</b> personas · el análisis usa ${R.used}${R.plant < R.used ? ' · <span class="an-warn">faltan ' + (R.used - R.plant) + ' personas en la plantilla para cubrir estas operaciones</span>' : ''}</p>` : ''}
      <div class="an-kpis">
        <div class="an-kpi ${R.dem && R.out.mean < R.dem ? 'bad' : 'ok'}"><b>${f0(R.out.mean)} pzs</b><span>producidas (rango ${f0(R.out.min)}–${f0(R.out.max)})${R.sinks > 1 ? ' · suma de ' + R.sinks + ' salidas' : ''}</span></div>
        <div class="an-kpi"><b>${R.dem ? f0(R.dem) + ' pzs' : '—'}</b><span>demanda (${esc(R.demSrc)})</span></div>
        <div class="an-kpi ${s.falt ? 'bad' : 'ok'}"><b>${s.falt === null ? '—' : f0(s.falt) + ' pzs'}</b><span>faltante${R.dem ? ' · cumplimiento ' + f0(Math.min(999, R.out.mean / R.dem * 100)) + '%' : ''}</span></div>
        <div class="an-kpi bad"><b>${f0(s.starve)} min</b><span>esperando material (todas las personas)${s.costStarve !== null ? ' · ' + money(s.costStarve) : ''}</span></div>
        <div class="an-kpi bad"><b>${f0(s.rew)} min</b><span>en retrabajo${s.costRew !== null ? ' · ' + money(s.costRew) : ''}</span></div>
        <div class="an-kpi bad"><b>${s.cost !== null ? money(s.cost) : f0(s.lost) + ' min'}</b><span>${s.cost !== null ? 'costo de ' + f0(s.lost) + ' min perdidos a $' + fmtN(R.costo, 2) + '/min' : 'captura el costo por minuto para verlo en pesos'}</span></div>
      </div>
      ${R.per.some(p => p.down > 0 || p.scrap > 0) || R.lineOee != null ? `<div class="an-kpis"><div class="an-kpi ${R.lineOee != null && R.lineOee < .65 ? 'bad' : 'ok'}"><b>${R.lineOee == null ? '—' : f1(R.lineOee * 100) + '%'}</b><span>OEE teórico de la línea (salida × ciclo ideal del cuello ÷ tiempo neto)</span></div>
        <div class="an-kpi bad"><b>${f0(R.per.reduce((a, p) => a + p.down, 0))} min</b><span>en paros no planeados · ${f1(R.per.reduce((a, p) => a + p.nfail, 0))} fallas</span></div><div class="an-kpi bad"><b>${f0(R.per.reduce((a, p) => a + p.scrap, 0))} pzs</b><span>scrap en las estaciones</span></div></div>` : ''}
      <p class="an-note">Cuello de botella: <b>${esc(s.neck.oper || s.neck.short || s.neck.name)}</b> (cola máxima ${f0(s.neck.qmax)} piezas). Quien más espera material: <b>${esc(s.waitTop[0].oper || s.waitTop[0].short)}</b> con ${f0(s.waitTop[0].starve)} min.</p>
      ${R.B ? cmpBlock(R) : ''}
      <h4>Minutos por operador${R.B ? ' · como está' : ''}</h4>${barsSvg(R)}${R.B ? `<h4>Minutos por operador · con el cambio</h4>${barsSvg(R.B)}` : ''}${legend()}
      <h4>¿Cuándo esperan más? · espera de material por hora</h4>${heatSvg(R)}
      <h4>Detalle por operador</h4>${table(R)}
      ${vsmBlock(R)}
      <div class="an-row"><button class="prim" data-k="pdf">Descargar reporte (PDF)</button><button data-k="csv">Descargar para Excel (CSV)</button><span class="an-note">El PDF se guarda desde la ventana de impresión: elige «Guardar como PDF».</span></div>`; }
  function cmpRows(R) { const A = summary(R), B = summary(R.B), c = R.costo > 0, d = (x, y, better) => { const v = y - x; if (Math.abs(v) < .5) return '<span style="color:#a9b3bd">igual</span>'; const good = better === 'up' ? v > 0 : v < 0; return `<b style="color:${good ? '#3ddc97' : '#ff6b62'}">${v > 0 ? '+' : ''}${f0(v)}</b>`; };
    return [['Personas', R.nPer ?? R.per.length, R.B.nPer ?? R.B.per.length, null], ['Piezas producidas', R.out.mean, R.B.out.mean, 'up'], ['Faltante (pzs)', A.falt ?? 0, B.falt ?? 0, 'down'], ['Min esperando material', A.starve, B.starve, 'down'], ['Min en retrabajo', A.rew, B.rew, 'down'], ['Min perdidos', A.lost, B.lost, 'down']]
      .concat(c ? [['Costo de minutos perdidos ($)', A.cost, B.cost, 'down']] : [])
      .map(([n, x, y, b]) => ({ n, x, y, d: b ? d(x, y, b) : (y - x ? (y - x > 0 ? '+' : '') + f0(y - x) : 'igual'), money: /\$/.test(n) })).concat([{ n: 'Cuello de botella', x: A.neck.oper || A.neck.short, y: B.neck.oper || B.neck.short, d: '', txt: true }]); }
  function cmpBlock(R) { return `<h4>Comparación · como está contra el cambio</h4><p class="an-note">Cambio: <b>${esc(R.chg)}</b></p><div style="overflow-x:auto"><table><thead><tr><th>Indicador</th><th>Como está</th><th>Con el cambio</th><th>Diferencia</th></tr></thead><tbody>${cmpRows(R).map(r => `<tr><td>${esc(r.n)}</td><td>${r.txt ? esc(r.x) : (r.money ? money(r.x) : f0(r.x))}</td><td>${r.txt ? esc(r.y) : (r.money ? money(r.y) : f0(r.y))}</td><td>${r.d}</td></tr>`).join('')}</tbody></table></div>`; }
  let VB = null;
  function grab(src, name) { const i = src.indexOf('const ' + name + '='); if (i < 0) return null; let j = i + name.length + 7, d = 0, q = null; const s = j; for (; j < src.length; j++) { const c = src[j]; if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; } if (c === '"' || c === "'" || c === '`') { q = c; continue; } if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (!d) { j++; break; } } } return src.slice(s, j); }
  async function vsmBoxes() { if (VB) return VB; const out = [];
    try { const src = await (await fetch('vsm/consola.json')).json(), S = new Function('C', 'HEAD', 'return ' + grab(src, 'STREAMS'))(new Proxy({}, { get: () => '' }), '');
      Object.entries(S).forEach(([k, st]) => (st.procs || []).forEach(p => out.push({ key: `vx|${k}|${p.id}`, path: `vx/r2/${st.col}/${p.id}`, g: `P4 · ${st.name} ${st.prod || ''}`.trim(), n: (p.n || []).join(' ') }))); } catch (e) { console.warn('cajas P4', e); }
    try { const src = await (await fetch('vsm/parras.json')).json(), A = JSON.parse(grab(src, 'ALLP')); Object.entries(A).forEach(([id, p]) => { if (p.k !== 'jct') out.push({ key: `vp|*|${id}`, path: `vp/r1/procParras/${id}`, g: 'Parras', n: (p.n || []).join(' ') }); }); } catch (e) { console.warn('cajas Parras', e); }
    VB = out; return out; }
  function vsmBlock(R) { const a = cfgOf(), vb = a.vbox || {};
    setTimeout(() => vsmBoxes().then(L => { el?.querySelectorAll('[data-vb]').forEach(sel => { const g = {}; L.forEach(x => (g[x.g] = g[x.g] || []).push(x)); sel.innerHTML = '<option value="">Sin caja</option>' + Object.entries(g).map(([k, xs]) => `<optgroup label="${esc(k)}">${xs.map(x => `<option value="${esc(x.key)}"${vb[sel.dataset.vb] === x.key ? ' selected' : ''}>${esc(x.n)}</option>`).join('')}</optgroup>`).join(''); }); }), 0);
    return `<h4>Mandar al VSM</h4><p class="an-note">Elige la caja del VSM de cada persona. Si varias van a la misma caja, la caja recibe el ciclo del cuello, el número de personas, la cola total, la disponibilidad y el scrap del grupo.</p>
      <div style="overflow-x:auto"><table><thead><tr><th>Persona</th><th>Caja del VSM</th></tr></thead><tbody>${R.per.map(p => `<tr><td>${esc(p.oper || p.short || p.name)}</td><td><select data-vb="${esc(p.id)}" aria-label="Caja del VSM de ${esc(p.oper || p.name)}"><option value="">${vb[p.id] ? esc(vb[p.id]) : 'Sin caja'}</option></select></td></tr>`).join('')}</tbody></table></div>
      <div class="an-row"${window.RD_RO ? ' hidden' : ''}><button data-k="tovsm">Mandar al VSM</button><span class="an-note">Escribe C/T, operadores, WIP, disponibilidad y defecto en la «Captura en gemba» de cada caja (fuente: cronometrado, por el análisis de turno).</span></div>`; }
  async function toVsm() { if (!last) return; const a = cfgOf(), vb = a.vbox || {}, L = await vsmBoxes(), groups = {};
    last.per.forEach(p => { const k = vb[p.id]; if (!k) return; (groups[k] = groups[k] || []).push(p); });
    const keys = Object.keys(groups); if (!keys.length) { alert('Elige primero la caja del VSM de al menos una persona.'); return; }
    let db = null; try { db = await window.claude?.use?.('db'); } catch (_) {} if (!db) { alert('Para escribir en el VSM abre esta planta desde la Red DAIMAY (no el archivo suelto).'); return; }
    let ok = 0; for (const k of keys) { const box = L.find(x => x.key === k); if (!box) continue; const ps = groups[k], done = ps.reduce((s, p) => s + p.done, 0), scrap = ps.reduce((s, p) => s + p.scrap, 0), avail = ps.reduce((s, p) => s + (last.H * 60 - p.paro), 0), down = ps.reduce((s, p) => s + p.down, 0);
      const body = { ct: +Math.max(...ps.map(p => p.mean)).toFixed(1), src: 'Cronometrado', ops: ps.length, wip: Math.round(ps.reduce((s, p) => s + p.qavg, 0)), up: avail > 0 ? +((avail - down) / avail * 100).toFixed(1) : undefined, def: done > 0 ? +(scrap / done * 100).toFixed(2) : undefined, by: 'txt:Análisis de turno', at: Date.now() };
      Object.keys(body).forEach(x => body[x] === undefined && delete body[x]);
      try { const ref = db.doc('~/' + box.path), cur = await ref.get(); await ref.set(Object.assign({}, cur.exists ? cur.data() : {}, body)); ok++; } catch (e) { console.warn('VSM', e); } }
    alert(`${ok} caja(s) del VSM actualizadas con el análisis. Ábrelas en la Consola VSM para verlas.`); }
  function table(R) { const c = R.costo > 0;
    return `<div style="overflow-x:auto"><table><thead><tr><th>Operador</th><th>Piezas</th><th>Trabajando</th><th>Esperando material</th><th>Retrabajo</th><th>Paros</th><th>Fallas</th><th>Scrap</th><th>Perdido</th>${c ? '<th>Costo perdido</th>' : ''}<th>Cola prom.</th><th>Cola máx.</th><th>OEE</th><th>Entrega a</th></tr></thead><tbody>${R.per.map(p => {
      const avail = R.H * 60 - p.paro; return `<tr><td>${esc(p.oper || p.short || p.name)}<br><small style="color:#a9b3bd">${esc(p.short || '')}</small></td><td>${f0(p.done)}</td><td>${f0(p.work)} min · ${f0(p.work / Math.max(1, avail) * 100)}%</td><td>${f0(p.starve)} min · ${f0(p.starve / Math.max(1, avail) * 100)}%</td><td>${f0(p.rew)} min</td><td>${f0(p.paro)} min</td><td>${p.down ? f0(p.down) + ' min' : '—'}</td><td>${p.scrap ? f1(p.scrap) + ' pz' : '—'}</td><td><b>${f0(p.lost)} min</b></td>${c ? `<td>${money(p.lost * R.costo)}</td>` : ''}<td>${f1(p.qavg)}</td><td>${f0(p.qmax)}</td><td title="Disp. ${p.oA == null ? '—' : f0(p.oA * 100)}% · Rend. ${p.oR == null ? '—' : f0(p.oR * 100)}% · Cal. ${p.oQ == null ? '—' : f0(p.oQ * 100)}% · ciclo ideal ${f1(p.ideal)} s (el mejor medido)">${p.oee == null ? '—' : f0(p.oee * 100) + '%'}</td><td>${esc(p.next || 'salida')}</td></tr>`; }).join('')}</tbody></table></div>`; }

  /* ---------- descargas ---------- */
  function printReport() { if (!last) return; const R = last, s = summary(R), tbl = table(R).replace(/<small style="color:#a9b3bd">/g, '<small style="color:#4a5a6b">');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf8"><title>Análisis de turno · ${esc(R.yz)}</title><style>body{font:13px/1.45 'Segoe UI',system-ui,sans-serif;color:#16202c;margin:24px} h1{font-size:20px;margin:0} h2{font-size:14px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.05em;color:#4a5a6b}
      .k{display:grid;grid-template-columns:repeat(3,1fr);gap:8px} .k div{border:1px solid #d3dce6;border-radius:8px;padding:8px 10px} .k b{display:block;font-size:18px} table{width:100%;border-collapse:collapse;font-size:12px} th,td{padding:4px 6px;border-bottom:1px solid #e3e8ee;text-align:right} th:first-child,td:first-child{text-align:left} svg{width:100%;height:auto;border:1px solid #d3dce6;border-radius:8px}
      .head{display:flex;gap:14px;align-items:center;margin-bottom:10px} .head img{height:46px} @media print{body{margin:10mm} h2{break-after:avoid} svg,table{break-inside:avoid}}</style></head><body>
      <div class="head"><img src="${location.href.replace(/[^/]*$/, '')}estilo/logo_daimay.png" alt="DAIMAY"><div><h1>Análisis de turno · ${esc(R.yz)}</h1><div>${R.turno ? esc(R.turno) + ' · ' : ''}${esc(R.scope)} · horizonte ${f1(R.H)} h · tiempo neto ${hhmm(R.net)} h · ${R.reps} repeticiones · ${R.at.toLocaleString('es-MX')}</div></div></div>
      <h2>Paros planeados</h2><div>${R.paros.map(p => `${esc(p.n)} ${hhmm(p.ini)} (${f0(p.dur)} min)`).join(' · ') || 'Sin paros'}</div>
      <h2>Resultados</h2><div class="k"><div><b>${f0(R.out.mean)} pzs</b>producidas (rango ${f0(R.out.min)}–${f0(R.out.max)})</div><div><b>${R.dem ? f0(R.dem) + ' pzs' : '—'}</b>demanda (${esc(R.demSrc)})</div><div><b>${s.falt === null ? '—' : f0(s.falt) + ' pzs'}</b>faltante</div>
      <div><b>${f0(s.starve)} min</b>esperando material${s.costStarve !== null ? ' · ' + money(s.costStarve) : ''}</div><div><b>${f0(s.rew)} min</b>retrabajo${s.costRew !== null ? ' · ' + money(s.costRew) : ''}</div><div><b>${s.cost !== null ? money(s.cost) : f0(s.lost) + ' min'}</b>${s.cost !== null ? 'costo de minutos perdidos a $' + fmtN(R.costo, 2) + '/min' : 'minutos perdidos'}</div></div>
      <p>Cuello de botella: <b>${esc(s.neck.oper || s.neck.short)}</b> (cola máxima ${f0(s.neck.qmax)} pzs). Quien más espera material: <b>${esc(s.waitTop[0].oper || s.waitTop[0].short)}</b> (${f0(s.waitTop[0].starve)} min).</p>
      ${R.B ? `<h2>Comparación · como está contra el cambio</h2><p>Cambio: <b>${esc(R.chg)}</b></p><table><thead><tr><th>Indicador</th><th>Como está</th><th>Con el cambio</th><th>Diferencia</th></tr></thead><tbody>${cmpRows(R).map(r => `<tr><td>${esc(r.n)}</td><td>${r.txt ? esc(r.x) : (r.money ? money(r.x) : f0(r.x))}</td><td>${r.txt ? esc(r.y) : (r.money ? money(r.y) : f0(r.y))}</td><td>${r.d}</td></tr>`).join('')}</tbody></table>` : ''}
      <h2>Minutos por operador${R.B ? ' · como está' : ''}</h2>${barsSvg(R, true)}${R.B ? `<h2>Minutos por operador · con el cambio</h2>${barsSvg(R.B, true)}` : ''}<p style="font-size:11.5px;color:#4a5a6b">Verde VA · azul inspección · rojo retrabajo · ámbar esperando material · gris paros planeados.</p>
      <h2>Espera de material por hora</h2>${heatSvg(R, true)}<h2>Detalle por operador</h2>${tbl}
      <p style="font-size:11px;color:#7b8a99">Simulación con los ciclos medidos en la plantilla Yamazumi v5, repetidos en orden aleatorio. Red DAIMAY.</p><script>setTimeout(()=>print(),400)<\/script></body></html>`;
    const wn = window.open('', '_blank'); if (!wn) { toastIn('El navegador bloqueó la ventana del reporte. Permite ventanas emergentes para este sitio.'); results(last); return; } wn.document.open(); wn.document.write(html); wn.document.close(); }
  function csv() { if (!last) return; const R = last, q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"', n = v => (Math.round(v * 10) / 10).toString(), rows = [['Operador', 'Operación', 'Piezas', 'Min trabajando', 'Min esperando material', 'Min retrabajo', 'Min paros', 'Min perdidos', 'Costo perdido', 'Cola promedio', 'Cola máxima', 'Entrega a']];
    R.per.forEach(p => rows.push([p.oper || '', p.short || p.name, n(p.done), n(p.work), n(p.starve), n(p.rew), n(p.paro), n(p.lost), R.costo > 0 ? n(p.lost * R.costo) : '', n(p.qavg), n(p.qmax), p.next || 'salida']));
    if (R.B) { rows.push([]); rows.push(['Comparación', 'Como está', 'Con el cambio']); rows.push(['Cambio', R.chg]); cmpRows(R).forEach(r => rows.push([r.n, r.txt ? r.x : n(r.x ?? 0), r.txt ? r.y : n(r.y ?? 0)])); }
    rows.push([]); rows.push(['Horizonte (h)', n(R.H)], ['Tiempo neto (min)', n(R.net)], ['Demanda', R.dem || ''], ['Producidas (promedio)', n(R.out.mean)], ['Rango', R.out.min + '–' + R.out.max], ['Costo por minuto', R.costo ?? '']);
    const blob = new Blob(['﻿' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `analisis_turno_${(R.yz || 'linea').replace(/[^\w\-]+/g, '_')}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

  document.addEventListener('change', e => { if (el && el.contains(e.target)) onChange(e); });
  document.addEventListener('click', e => { if (el && el.contains(e.target)) onClick(e); });
  return { open, close, simulate: (nodes, cfg) => simulate(nodes, cfg), last: () => last, run: () => { run(); return last; } };
}
