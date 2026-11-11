/* Red DAIMAY · capa de vida (Fase 3) — archivo compartido por los 6 gemelos.
   Anima lo que está cerca de donde miras y deja el resto como estaba:
   · operadores articulados (trabajan, alcanzan material, dan pasos cortos; sentados solo mueven brazos)
   · montacargas: el mástil sube y baja en cada parada y la carga se toma o se deja
   · inyectoras: robot cartesiano que saca la pieza y la deja en la banda
   · prensas: platina que baja, sostiene y sube
   Nada de esto cambia datos: es solo dibujo. Modo: No / Zona / Alta (se recuerda en el navegador). */
export function init(TW){
  const T=TW.THREE, { scene, OBJS, RT, D } = TW;
  const TAU=Math.PI*2, Z0=new T.Matrix4().makeScale(0,0,0);
  const MODES={ off:{ops:0,mach:0,r:0}, zona:{ops:40,mach:8,r:48}, alta:{ops:90,mach:16,r:80} };
  // 11-nov-2026: operadores y máquinas quedan fijos (decisión del usuario). Solo se mueven runners, tuggers y montacargas.
  // La animación selectiva (una línea o hasta 10 operadores) llega con la Fase 5; por eso ya no se lee la preferencia guardada.
  let mode='off';
  const hash=n=>{ let x=Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x); };
  const sm=x=>{ x=Math.min(1,Math.max(0,x)); return x*x*(3-2*x); };
  const std=(c,o={})=>new T.MeshStandardMaterial(Object.assign({color:c,roughness:.8,metalness:.05},o));

  /* ------------------------------------------------------------------ operador articulado (frente = +x) */
  const G={}; {
    const cyl=(r1,r2,h)=>new T.CylinderGeometry(r1,r2,h,10).translate(0,-h/2,0);
    const paint=(g,c)=>{ const col=new T.Color(c), n=g.attributes.position.count, a=new Float32Array(n*3); for(let i=0;i<n;i++){ a[i*3]=col.r; a[i*3+1]=col.g; a[i*3+2]=col.b; } g.setAttribute('color',new T.BufferAttribute(a,3)); return g; };
    const merge=gs=>{ let n=0,ni=0; gs.forEach(g=>{ n+=g.attributes.position.count; ni+=g.index.count; }); const P=new Float32Array(n*3),N=new Float32Array(n*3),C=new Float32Array(n*3),I=new Uint16Array(ni); let o=0,oi=0;
      gs.forEach(g=>{ P.set(g.attributes.position.array,o*3); N.set(g.attributes.normal.array,o*3); C.set(g.attributes.color.array,o*3); for(let k=0;k<g.index.count;k++) I[oi+k]=g.index.array[k]+o; o+=g.attributes.position.count; oi+=g.index.count; });
      const m=new T.BufferGeometry(); m.setAttribute('position',new T.BufferAttribute(P,3)); m.setAttribute('normal',new T.BufferAttribute(N,3)); m.setAttribute('color',new T.BufferAttribute(C,3)); m.setIndex(new T.BufferAttribute(I,1)); return m; };
    G.thigh=cyl(.085,.07,.42);
    G.shin=merge([paint(cyl(.068,.055,.40),'#27324a'), paint(new T.BoxGeometry(.24,.08,.11).translate(.05,-.43,0),'#15181c')]);
    G.torso=new T.CylinderGeometry(.2,.165,.56,12).translate(0,.28,0).scale(.72,1,1.08);
    G.uarm=cyl(.058,.05,.28);
    G.farm=merge([paint(cyl(.046,.04,.25),'#b98563'), paint(new T.SphereGeometry(.05,8,6).translate(0,-.28,0),'#b98563')]);
    G.head=merge([paint(new T.SphereGeometry(.112,14,10).translate(.01,.2,0),'#b98563'), paint(new T.SphereGeometry(.122,14,8,0,TAU,0,Math.PI/2).translate(.01,.225,0),'#1b1f24'),
                  paint(new T.BoxGeometry(.11,.02,.16).translate(.14,.235,0),'#1b1f24'), paint(cyl(.05,.055,.09).translate(0,.1,0),'#b98563')]);
    G.hit=new T.CylinderGeometry(.32,.32,1.75,8).translate(0,.875,0);
  }
  const M_pants=std('#27324a',{roughness:.9}), M_vc=std('#ffffff',{vertexColors:true,roughness:.75}), M_hit=new T.MeshBasicMaterial({visible:false});
  function makeRig(){
    const g=new T.Group(), shirt=std('#3fa0ff'); const mk=(geo,mat,cast)=>{ const m=new T.Mesh(geo,mat); m.castShadow=!!cast; return m; };
    const body=new T.Group(); g.add(body);                                   // se baja al sentarse
    const hip=[-1,1].map(s=>{ const h=new T.Group(); h.position.set(0,.9,s*.1); h.add(mk(G.thigh,M_pants,true)); const k=new T.Group(); k.position.y=-.42; k.add(mk(G.shin,M_vc,false)); h.add(k); body.add(h); return {h,k}; });
    const up=new T.Group(); up.position.y=.9; body.add(up); up.add(mk(G.torso,shirt,true));
    const arm=[-1,1].map(s=>{ const a=new T.Group(); a.position.set(0,.5,s*.255); a.add(mk(G.uarm,shirt,false)); const e=new T.Group(); e.position.y=-.28; e.add(mk(G.farm,M_vc,false)); a.add(e); up.add(a); return {a,e}; });
    const head=new T.Group(); head.position.y=.56; head.add(mk(G.head,M_vc,true)); up.add(head);
    const hit=new T.Mesh(G.hit,M_hit); g.add(hit);
    g.visible=false; return { g, body, hip, up, arm, head, shirt, hit, o:null };
  }
  const _m=new T.Matrix4(), _p=new T.Vector3(), _q=new T.Quaternion(), _s=new T.Vector3(), _c=new T.Color();
  function opBase(o){                                                         // posición, giro, color y altura del operador estático
    const sl=o.slots[0]; if(!sl||!sl.b.ms[sl.i]) return null; const e=sl.b.ms[sl.i].elements;
    let top=0, col=null;
    for(const s of o.slots){ const geo=s.b.geo; if(!geo.boundingBox) geo.computeBoundingBox(); const me=s.b.ms[s.i].elements; top=Math.max(top, me[13]+geo.boundingBox.max.y*Math.hypot(me[4],me[5],me[6])); if(col==null && s.b.cs[s.i]!==undefined) col=s.b.cs[s.i]; }
    if(top<.9||top>2.1) return null;                                          // no es una figura humana
    const yaw0=Math.atan2(-e[2],e[0]), dx=o.off[0], dz=o.off[1], da=o.off[2]||0;
    return { x:e[12]+dx, z:e[14]+dz, y:e[13], yaw:yaw0-da, top, col:col||'#3fa0ff', seated: top<1.5 };
  }
  function pose(R,t){
    const b=R.base, seed=R.seed, tt=t+seed*40, Tc=9+seed*6, n=Math.floor(tt/Tc), u=(tt/Tc)-n, pick=hash(n*7.13+seed*91);
    let x=b.x, z=b.z, yaw=b.yaw, lean=-.07, twist=0, hl=0, hr=0, kl=0, kr=0;
    let sl=.95+.26*Math.sin(tt*2.1), sr=.95+.26*Math.sin(tt*2.1+Math.PI), el=.85+.32*Math.sin(tt*2.1+1.1), er=.85+.32*Math.sin(tt*2.1+Math.PI+1.1), nod=.12+.06*Math.sin(tt*.9);
    if(b.seated){ hl=hr=1.5; kl=kr=-1.5; lean=-.12; sl-=.25; sr-=.25; }
    else if(pick>.62 && pick<=.8){                                            // alcanzar material a un lado
      const k=Math.sin(Math.PI*sm(u)), side=hash(n+seed)>.5?1:-1; twist=k*.75*side; lean=-.07-k*.1;
      if(side>0){ sr=.95+k*.5; er=.85-k*.6; } else { sl=.95+k*.5; el=.85-k*.6; } nod=.12-k*.1; }
    else if(pick>.8){                                                         // paso corto: gira, camina, regresa
      const side=hash(n*3+seed)>.5?1:-1, d=.7+.5*hash(n+seed*5), A=side*Math.PI/2; let s=0, w=0;
      const B=A+side*Math.PI, E=side*TAU;                                    // gira al lado, media vuelta, y cierra el giro completo
      if(u<.12){ yaw+=A*sm(u/.12); }
      else if(u<.40){ s=sm((u-.12)/.28); yaw+=A; w=1; }
      else if(u<.52){ s=1; yaw+=A+(B-A)*sm((u-.40)/.12); }
      else if(u<.80){ s=1-sm((u-.52)/.28); yaw+=B; w=1; }
      else { s=0; yaw+=B+(E-B)*sm((u-.80)/.20); }
      const dirx=Math.cos(-(b.yaw+A)), dirz=Math.sin(-(b.yaw+A)); x+=dirx*d*s; z+=dirz*d*s;
      const ph=s*d*TAU/.62, sw=Math.sin(ph)*.5*w; hl=sw; hr=-sw; kl=-Math.max(0,-Math.sin(ph+.6))*.7*w; kr=-Math.max(0,Math.sin(ph+.6))*.7*w;
      const k=w?1:.35; sl=.1-sw*.8; sr=.1+sw*.8; el=er=.25*k+.15; lean=-.04; nod=0; }
    R.g.position.set(x,b.y+(b.seated?b.top-1.32:0),z); R.g.rotation.y=yaw;
    R.up.rotation.z=lean; R.up.rotation.y=twist; R.head.rotation.z=-nod;
    R.hip[0].h.rotation.z=hl; R.hip[1].h.rotation.z=hr; R.hip[0].k.rotation.z=kl; R.hip[1].k.rotation.z=kr;
    R.arm[0].a.rotation.z=sl; R.arm[1].a.rotation.z=sr; R.arm[0].e.rotation.z=el; R.arm[1].e.rotation.z=er;
  }
  const POOL=[], BUSY=new Map();                                              // o.id → rig
  const hideOp=o=>{ for(const s of o.slots){ s.b.im.setMatrixAt(s.i,Z0); s.b.im.instanceMatrix.needsUpdate=true; } };
  function releaseRig(R){ const o=R.o; if(!o) return; R.g.visible=false; const k=TW.PICK.indexOf(R.hit); if(k>=0) TW.PICK.splice(k,1); R.o=null; BUSY.delete(o.id); if(OBJS.get(o.id)===o) TW.applyObj(o); }
  function assignRig(o,base,i){
    let R=POOL.find(r=>!r.o); if(!R){ R=makeRig(); POOL.push(R); TW.G_ops.add(R.g); }
    R.o=o; R.base=base; R.seed=hash(i*1.37+base.x*.31+base.z*.17); R.shirt.color.set(base.col); R.g.visible=true; BUSY.set(o.id,R);
    const sl=o.slots[0]; R.hit.userData.info=sl.b.inf[sl.i]||null; if(R.hit.userData.info) TW.PICK.push(R.hit);
    hideOp(o);
  }

  /* ------------------------------------------------------------------ máquinas con ciclo */
  const MACH=new Map();                                                       // o.id → overlay
  const M_dark=std('#39414a',{metalness:.5,roughness:.4}), M_steel=std('#b9c0c6',{metalness:.8,roughness:.3}), M_part=std('#1d2228',{roughness:.6}), M_slab=std('#7c858d',{metalness:.65,roughness:.35});
  const BOX=new T.BoxGeometry(1,1,1).translate(0,.5,0);
  const box=(mat,sx,sy,sz)=>{ const m=new T.Mesh(BOX,mat); m.scale.set(sx,sy,sz); m.castShadow=true; return m; };
  function findSlot(o,test){ for(const s of o.slots){ const e=s.b.ms[s.i].elements; if(test(Math.hypot(e[0],e[1],e[2]),Math.hypot(e[4],e[5],e[6]),Math.hypot(e[8],e[9],e[10]),e[13])) return s; } return null; }
  function makeIMM(o,m){
    const fmax=TW.id==='p4'?1.35:1, ton=m.ton||Math.max(60,Math.round(m.l*m.l*6)); if(ton<120) return null;
    const f=Math.min(fmax,Math.sqrt(ton/900)), s=m.inj>=0?1:-1, h0=.72+.38*f, hc=1.15+1.55*f, W=m.d*.92, cL=m.l*.55, c0=-s*m.l/2, cc=c0+s*cL/2, gy=h0+hc+.9+.5*f, gx=cc+s*cL*.1;
    const g=new T.Group(); g.position.set(m.p[0]+o.off[0],0,m.p[1]+o.off[1]); g.rotation.y=-(m.a+(o.off[2]||0));
    const car=box(M_dark,.34,.2,.34); const arm=box(M_dark,.12,1,.12); const grip=box(M_steel,.3,.05,.4); const part=box(M_part,.42,.07,.5), drop=box(M_part,.42,.07,.5);
    g.add(car,arm,grip,part,drop); scene.add(g);
    const st=findSlot(o,(sx,sy,sz)=>Math.abs(sx-.12)<.01&&Math.abs(sz-.12)<.01&&Math.abs(sy-1.05)<.02); if(st){ st.b.im.setMatrixAt(st.i,Z0); st.b.im.instanceMatrix.needsUpdate=true; }
    const vB=-W/2-1.6, yUp=gy-1.0, yMold=h0+hc*.45, yBelt=.95, per=9+hash(m.p[0]+m.p[1])*5, ph=hash(m.p[0]*3.1)*per;
    return { g, kind:'imm', step(t){ const u=((t+ph)%per)/per; let v=0, y=yUp, has=false, dy=-1;
        if(u<.14){ y=yUp+(yMold-yUp)*sm(u/.14); }
        else if(u<.20){ y=yMold; has=true; }
        else if(u<.32){ y=yMold+(yUp-yMold)*sm((u-.20)/.12); has=true; }
        else if(u<.52){ v=vB*sm((u-.32)/.20); has=true; }
        else if(u<.62){ v=vB; y=yUp+(yBelt-yUp)*sm((u-.52)/.10); has=true; }
        else if(u<.72){ v=vB; y=yBelt+(yUp-yBelt)*sm((u-.62)/.10); dy=(u-.62)/.38; }
        else { v=vB*(1-sm((u-.72)/.2)); dy=(u-.62)/.38; }
        car.position.set(gx,gy-.02,v); arm.position.set(gx,y,v); arm.scale.y=Math.max(.05,gy-y); grip.position.set(gx,y-.05,v);
        part.visible=has; part.position.set(gx,y-.12,v);
        drop.visible=dy>=0&&dy<1; if(drop.visible) drop.position.set(gx+s*dy*1.1,.8,vB); } };
  }
  function makePress(o,e){
    const g=new T.Group(); g.position.set(e.p[0]+o.off[0],0,e.p[1]+o.off[1]); g.rotation.y=-((e.a||0)+(o.off[2]||0));
    const slab=box(M_slab,e.l*.8,.35,e.d*.72), rod=box(M_steel,.28,1,.28); g.add(slab,rod); scene.add(g);
    const st=findSlot(o,(sx,sy,sz,y)=>Math.abs(sy-.35)<.02&&Math.abs(y-2.3)<.05); if(st){ st.b.im.setMatrixAt(st.i,Z0); st.b.im.instanceMatrix.needsUpdate=true; }
    const per=8+hash(e.p[0]+e.p[1]*2)*6, ph=hash(e.p[1]*1.7)*per, yT=2.3, yB=1.3;
    return { g, kind:'press', step(t){ const u=((t+ph)%per)/per; let y=yT;
        if(u<.18) y=yT+(yB-yT)*sm(u/.18); else if(u<.62) y=yB; else if(u<.80) y=yB+(yT-yB)*sm((u-.62)/.18);
        slab.position.y=y; rod.position.y=y+.35; rod.scale.y=Math.max(.05,4.4-y-.35); } };
  }
  function releaseMach(id){ const X=MACH.get(id); if(!X) return; scene.remove(X.g); MACH.delete(id); const o=OBJS.get(id); if(o) TW.applyObj(o); }

  /* ------------------------------------------------------------------ selección por zona */
  let OPS=[], MC=[], scanAt=-1;
  function scan(){ OPS=[]; MC=[]; let i=0;
    for(const o of OBJS.values()){ if(o.kind==='op' && o.slots.length){ OPS.push(o); } }
    (D.mach||[]).forEach((m,i)=>{ const o=OBJS.get('m'+i); if(o&&o.kind==='mach') MC.push({o,m,k:'imm'}); });
    (D.equip||[]).forEach((e,i)=>{ if(e.k==='press'){ const o=OBJS.get('e'+i); if(o) MC.push({o,m:e,k:'press'}); } });
  }
  const _f=new T.Vector3(), _d=new T.Vector3();
  function focus(){ const st=TW.state(), cam=TW.camera; if(st.mode==='orbit' && st.target) return [st.target.x, st.target.z];
    cam.getWorldDirection(_d); const k=_d.y<-.05 ? Math.min(60, cam.position.y/-_d.y) : 10; return [cam.position.x+_d.x*k, cam.position.z+_d.z*k]; }
  function reassign(){
    const st=TW.state(), cfg=MODES[mode], on = mode!=='off' && st.tool!=='move' && TW.G_ops.visible!==false;
    if(!on){ [...BUSY.values()].forEach(releaseRig); [...MACH.keys()].forEach(releaseMach); return; }
    const [fx,fz]=focus(), r2=cfg.r*cfg.r, keep2=r2*1.3;
    for(const R of [...BUSY.values()]){ const o=R.o, dx=R.base.x-fx, dz=R.base.z-fz; if(o.del || OBJS.get(o.id)!==o || dx*dx+dz*dz>keep2) releaseRig(R); }
    if(BUSY.size<cfg.ops){ const cand=[];
      for(let i=0;i<OPS.length;i++){ const o=OPS[i]; if(o.del||BUSY.has(o.id)) continue; const dx=o.p[0]+o.off[0]-fx, dz=o.p[1]+o.off[1]-fz, d=dx*dx+dz*dz; if(d<r2) cand.push([d,o,i]); }
      cand.sort((a,b)=>a[0]-b[0]);
      for(const [,o,i] of cand){ if(BUSY.size>=cfg.ops) break; const b=opBase(o); if(b) assignRig(o,b,i); } }
    const rm=(cfg.r*1.4)**2;
    for(const id of [...MACH.keys()]){ const o=OBJS.get(id); if(!o||o.del){ releaseMach(id); continue; } const dx=o.p[0]+o.off[0]-fx, dz=o.p[1]+o.off[1]-fz; if(dx*dx+dz*dz>rm*1.3) releaseMach(id); }
    if(MACH.size<cfg.mach){ const cand=[]; for(const c of MC){ if(c.o.del||MACH.has(c.o.id)) continue; const dx=c.o.p[0]+c.o.off[0]-fx, dz=c.o.p[1]+c.o.off[1]-fz, d=dx*dx+dz*dz; if(d<rm) cand.push([d,c]); }
      cand.sort((a,b)=>a[0]-b[0]); for(const [,c] of cand){ if(MACH.size>=cfg.mach) break; const X=c.k==='imm'?makeIMM(c.o,c.m):makePress(c.o,c.m); if(X) MACH.set(c.o.id,X); } }
  }

  /* ------------------------------------------------------------------ montacargas: mástil y carga */
  function forklifts(dt,st){ const k=Math.min(6,Math.max(1,st.timeScale||1));
    for(const R of RT.values()){ const ud=R.obj&&R.obj.userData; if(!ud||!ud.carr) continue;
      if(ud._lift===undefined){ ud._lift=.15; ud._loaded=true; ud._done=false; }
      const waiting=R.wait>0, goal=waiting&&!ud._done?1.25:.15; ud._lift+=(goal-ud._lift)*Math.min(1,dt*k*1.6);
      if(waiting && !ud._done && ud._lift>1.15){ ud._loaded=!ud._loaded; ud._done=true; }
      if(!waiting) ud._done=false;
      ud.carr.position.y=ud._lift; if(ud.load) ud.load.visible=ud._loaded; } }

  /* ------------------------------------------------------------------ ciclo por cuadro, con freno si la máquina no da */
  let t=0, acc=0, slow=0, cap=1;
  function frame(dt){
    const st=TW.state(); if(mode==='off'&&!BUSY.size&&!MACH.size){ if(st.playing!==false) forklifts(dt,st); return; }   // sin animación: solo mástil y carga de montacargas
    acc+=dt; if(scanAt<0||t-scanAt>3){ scan(); scanAt=t; }
    if(acc>.4){ acc=0; reassign(); }
    if(st.playing===false) return;
    t+=dt; slow = dt>.06 ? slow+dt : Math.max(0,slow-dt*.5);                  // menos de ~16 cuadros por segundo sostenido
    if(slow>3 && mode!=='off'){ slow=0; const c=MODES[mode]; if(c.ops>10){ c.ops=Math.round(c.ops*.6); c.mach=Math.max(2,Math.round(c.mach*.6)); c.r*=.8; note('Animación reducida para mantener fluidez'); } }
    for(const R of BUSY.values()) pose(R,t);
    for(const X of MACH.values()) X.step(t);
    forklifts(dt,st);
  }

  /* ------------------------------------------------------------------ control (junto a Calidad) */
  let noteEl=null; function note(msg){ if(!noteEl) return; noteEl.title=msg; }
  function setMode(m){ if(!MODES[m]) return; mode=m; try{ localStorage.setItem('rd_vida',m); }catch(_){}
    document.querySelectorAll('#vidaSeg button').forEach(b=>b.classList.toggle('on',b.dataset.v===m)); acc=1; }
  { const q=document.getElementById('qual');
    if(q){ const d=document.createElement('div'); d.className=q.className; d.id='vidaSeg'; d.setAttribute('role','group'); d.setAttribute('aria-label','Animación');
      const lab=q.querySelector('.seglabel'); d.innerHTML=(lab?'<span class="'+lab.className+'">Animación</span>':'')+'<button data-v="off" title="Sin animación de operadores ni máquinas">No</button><button data-v="zona" title="Anima lo que está cerca de donde miras">Zona</button><button data-v="alta" title="Más operadores y máquinas animados; pide más equipo">Alta</button>';
      q.insertAdjacentElement('afterend',d); d.addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setMode(b.dataset.v); }); noteEl=d; d.hidden=true; d.style.display='none'; setMode(mode); } }
  const lookAt=(x,z,r)=>{ const o=TW.orbit; if(!o) return; o.T.target.set(x,0,z); if(r) o.T.r=r; acc=1; };   // para pruebas y para recorridos
  return { frame, setMode, lookAt, where:()=>({ops:[...BUSY.values()].slice(0,5).map(R=>[+R.base.x.toFixed(1),+R.base.z.toFixed(1),R.base.seated]),mach:[...MACH.values()].slice(0,3).map(X=>[+X.g.position.x.toFixed(1),+X.g.position.z.toFixed(1),X.kind])}), get mode(){ return mode; }, stats:()=>({ mode, ops:BUSY.size, mach:MACH.size, pool:POOL.length, total:OPS.length, kinds:[...MACH.values()].map(x=>x.kind) }) };
}
