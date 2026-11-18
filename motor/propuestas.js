/* Red DAIMAY · propuestas de flujo (18-nov-2026). Con los datos del yamazumi (ciclos medidos, «Le entrega a» y el lugar de cada
   persona en 3D) arma tres alternativas de estaciones y las compara. Lo usa motor/analisis.js.
   - A · Mismo piso: junta operaciones contra el takt solo si sus mesas ya están cerca (≤ 3.5 m) o son consecutivas; nadie mueve mesas.
   - B · Mínimas personas: balanceo por peso posicional (Helgeson-Birnie) contra el takt, sin importar dónde están hoy; dice qué mesas acercar.
   - C · Máximo ritmo con la misma gente: busca el ciclo más corto posible sin agregar personas (reparte y duplica el cuello de botella).
   Respeta el orden de «Le entrega a»; si el yamazumi no tiene enlaces, usa el orden de la lista. */
export function grafo(ops) {
  const ix = new Map(ops.map((o, i) => [o.id, i])); let succ = ops.map(o => (ix.has(o.next) && o.next !== o.id ? ix.get(o.next) : -1));
  let linked = succ.some(s => s >= 0);
  if (!linked) succ = ops.map((_, i) => (i < ops.length - 1 ? i + 1 : -1));
  const preds = ops.map(() => []); succ.forEach((s, i) => { if (s >= 0) preds[s].push(i); });
  // orden topológico (Kahn, desempate por orden de la lista); si hay un ciclo se usa el orden de la lista
  const indeg = preds.map(p => p.length), q = [], ord = []; indeg.forEach((d, i) => { if (!d) q.push(i); });
  while (q.length) { q.sort((a, b) => a - b); const i = q.shift(); ord.push(i); const s = succ[i]; if (s >= 0 && --indeg[s] === 0) q.push(s); }
  let ciclo = false; if (ord.length < ops.length) { ciclo = true; succ = ops.map((_, i) => (i < ops.length - 1 ? i + 1 : -1)); preds.forEach(p => (p.length = 0)); succ.forEach((s, i) => { if (s >= 0) preds[s].push(i); }); ord.length = 0; ops.forEach((_, i) => ord.push(i)); linked = false; }
  return { succ, preds, ord, linked, ciclo };
}
const dist = (a, b) => (a?.link && b?.link ? Math.hypot(a.link.x - b.link.x, a.link.z - b.link.z) : null);

/* estaciones por peso posicional contra un ciclo C. ok(est, i) decide si la operación i puede entrar a la estación abierta */
function rpw(ops, t, G, C, ok) {
  const w = new Array(ops.length).fill(0); for (let k = G.ord.length - 1; k >= 0; k--) { const i = G.ord[k]; w[i] = t[i] + (G.succ[i] >= 0 ? w[G.succ[i]] : 0); }
  const done = new Array(ops.length).fill(false), st = []; let left = ops.length, cur = null;
  const ready = i => !done[i] && G.preds[i].every(p => done[p]);
  while (left) {
    const cand = ops.map((_, i) => i).filter(ready).sort((a, b) => w[b] - w[a] || a - b); let pick = -1;
    for (const i of cand) { if (t[i] > C) { if (!cur) { pick = i; break; } continue; } if (!cur || (cur.t + t[i] <= C + 1e-9 && ok(cur, i))) { pick = i; break; } }
    if (pick < 0) { if (cur) { st.push(cur); cur = null; continue; } pick = cand[0]; }
    done[pick] = true; left--;
    if (t[pick] > C) { if (cur) { st.push(cur); cur = null; } st.push({ ix: [pick], t: t[pick], p: Math.ceil(t[pick] / C - 1e-9) }); continue; }
    if (!cur) cur = { ix: [], t: 0, p: 1 }; cur.ix.push(pick); cur.t += t[pick];
  }
  if (cur) st.push(cur); return st;
}
const libera = n => (n === 1 ? 'Se libera 1 persona' : `Se liberan ${n} personas`);
const gente = st => st.reduce((s, x) => s + x.p, 0), cmaxOf = st => Math.max(0, ...st.map(s => s.t / s.p));

export function proponer(Y, { takt, pct = 95, net, meanOf, near = 3.5 }) {
  const ops = (Y?.ops || []).filter(o => o.on !== false && meanOf(o) > 0); if (!ops.length) return null;
  const t = ops.map(meanOf), G = grafo(ops), sum = t.reduce((a, b) => a + b, 0), N = ops.length, out = [];
  const hoy = { cmax: Math.max(...t), pers: N }, lim = takt ? takt * pct / 100 : 0;
  const pack = (key, nombre, idea, st, C, extra) => { const pers = gente(st), cmax = cmaxOf(st), pzT = cmax ? net * 60 / cmax : 0;
    const est = st.map((s, k) => ({ n: k + 1, ops: s.ix.map(i => ops[i]), t: s.t, p: s.p, c: s.t / s.p }));
    const r = { key, nombre, idea, C, est, pers, cmax, bal: pers && cmax ? sum / (pers * cmax) : 0, pzT, pzPH: pers && net ? pzT / pers / (net / 60) : 0, ...extra(est) };
    out.push(r); return r; };
  const piso = est => { const mov = []; est.forEach(e => { if (e.ops.length < 2) return; const a = e.ops[0]; e.ops.slice(1).forEach(o => { const d = dist(a, o); if (d == null || d > near) mov.push({ o, a, d, e: e.n }); }); }); return mov; };
  if (lim) {
    // A · mismo piso: solo junta mesas cercanas (o consecutivas si no hay lugar en 3D)
    const okA = (cur, i) => cur.ix.every(j => { const d = dist(ops[j], ops[i]); return d != null ? d <= near : (G.succ[j] === i || G.succ[i] === j); });
    const stA = rpw(ops, t, G, lim, okA);
    pack('A', 'Mismo piso', 'Junta operaciones cuyas mesas ya están cerca; nadie mueve mesas ni máquinas.', stA, lim, est => ({ mov: [], cambios: [
      `${N - gente(stA) > 0 ? libera(N - gente(stA)) : 'Mismo número de personas'}; ${est.filter(e => e.ops.length > 1).length} estaciones combinadas sin mover mesas.`] }));
    // B · mínimas personas: sin restricción de lugar; dice qué mesas acercar
    const stB = rpw(ops, t, G, lim, () => true);
    pack('B', 'Mínimas personas', 'Balanceo óptimo contra el takt; para lograrlo hay que acercar algunas mesas (celda).', stB, lim, est => { const mov = piso(est);
      return { mov, cambios: [`${N - gente(stB) > 0 ? libera(N - gente(stB)) : 'Mismo número de personas'}.`, mov.length ? `Acercar ${mov.length} mesa${mov.length === 1 ? '' : 's'} a su estación nueva (celda en U o en línea recta).` : 'Las mesas ya están cerca: no hay que mover nada.'] }; });
  }
  // C · máximo ritmo con la misma gente: búsqueda binaria del ciclo
  let lo = Math.max(sum / N, 0.1), hi = Math.max(...t), best = rpw(ops, t, G, hi, () => true), bestC = hi;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2, s = rpw(ops, t, G, mid, () => true); if (gente(s) <= N) { best = s; bestC = mid; hi = mid; } else lo = mid; }
  pack('C', 'Máximo ritmo, misma gente', 'Con las mismas personas, reparte el trabajo para bajar el cuello de botella y sacar más piezas.', best, bestC, est => { const mov = piso(est), dup = est.filter(e => e.p > 1);
    const neckHoy = ops[t.indexOf(Math.max(...t))];
    return { mov, cambios: [`Cuello de botella hoy: ${neckHoy.oper || neckHoy.name} (${Math.max(...t).toFixed(1)} s); propuesto: ${cmaxOf(best).toFixed(1)} s por pieza.`,
      dup.length ? `Duplicar ${dup.length} ${dup.length === 1 ? 'estación' : 'estaciones'} (${dup.map(e => `E${e.n} ×${e.p}`).join(', ')}): hace falta una máquina igual por persona extra.` : 'No hace falta duplicar máquinas.',
      mov.length ? `Acercar ${mov.length} mesa${mov.length === 1 ? '' : 's'}.` : 'Sin mover mesas.'] }; });
  return { ops, t, sum, N, hoy, lim, takt, pct, G, props: out, pzHoy: net * 60 / hoy.cmax };
}
