/* Red DAIMAY · acceso por número de empleado y contraseña, con niveles y plantas (19-nov-2026).
   Es un candado de uso interno: evita entradas casuales y ordena quién ve y cambia qué; no es seguridad de servidor.
   Niveles: 1 Administrador total · 2 Administrador de planta · 3 Editor de planta · 4 Solo ver.
   Plantas: ['*'] = toda la red; si no, solo esas plantas (sin Centro OEE, acciones ni mejora continua de la red).
   Llave del equipo: el administrador total pega una vez una clave de GitHub; se guarda cifrada (RD_TEAM) con una llave del equipo K,
   y K se guarda cifrada con la contraseña de cada usuario que edita. Al entrar, la contraseña abre K y K abre la clave: nadie más
   necesita cuenta ni permisos de GitHub. Los usuarios se guardan directo en usuarios.js del repositorio desde el panel «Usuarios». */
(function(){
  'use strict';
  var SKEY='rd_user', DKEY='rd_users_borrador', TKEY='rd_team_borrador', KK='rd_k', TOK='rd_tok';
  var PLANTAS=[['p1','P1'],['p2','P2'],['p4','P3·P4'],['p67','P6-7'],['p8','P8'],['parras','Parras']];
  var NIV={1:'Administrador total',2:'Administrador de planta',3:'Editor de planta',4:'Solo ver'};
  var NIVD={1:'Ve y cambia todo, da de alta usuarios y ve la actividad de todos.',2:'Cambia todo lo de sus plantas y ve la actividad de sus plantas.',3:'Cambia el gemelo, yamazumis y VSM de sus plantas.',4:'Solo ve sus plantas, no cambia nada.'};
  var nivelOf=function(u){ if(!u) return 4; if(u.nivel) return +u.nivel; return u.rol==='admin'?1:u.rol==='lector'?4:3; };
  var plantasOf=function(u){ if(!u) return []; if(Array.isArray(u.plantas)&&u.plantas.length) return u.plantas; return ['*']; };
  function perm(s){
    var nv=nivelOf(s), pl=plantasOf(s), all=nv===1||pl.indexOf('*')>=0;
    var has=function(p){ return all||pl.indexOf(p)>=0; };
    return { nivel:nv, plantas:pl, all:all, solo:!all, edit:nv<=3, log:nv<=2, admin:nv===1, plant:has,
      list:function(){ return PLANTAS.filter(function(x){return has(x[0]);}).map(function(x){return x[0];}); },
      // qué registros de la base puede guardar para todos
      key:function(k){ if(nv>3) return false; if(nv===1) return true; if(/^config\//.test(k)) return false; if(all) return true;
        var m=/^pl\/([^/]+)\//.exec(k); if(m) return has(m[1]); m=/^rep\/r1\/ana\/([^/]+)/.exec(k); if(m) return has(m[1]);
        if(/^vx\//.test(k)) return has('p4'); if(/^vp\//.test(k)) return has('parras'); return false; } };
  }
  // ---------- se aplica en la red, en cada gemelo y en las consolas (aunque estén dentro del hub)
  var _s=null; try{ _s=JSON.parse(sessionStorage.getItem(SKEY)||'null'); }catch(_){}
  if(_s){ window.RD_PERM=perm(_s); var P0=window.RD_PERM, css0='';
    if(!P0.edit){ window.RD_RO=true; css0+='[data-tool="move"],[data-tool="edit"],#oEdit,#edp,#edSave,#edReset,#edDel,#adAdd,#drEd,#drAd{display:none!important}'; }
    if(P0.solo) css0+='[data-k="acc"],[data-k="accres"],[data-k="propacc"],[data-k="tovsm"],[data-bk="pub"]{display:none!important}';
    if(css0){ var st0=document.createElement('style'); st0.textContent=css0; (document.head||document.documentElement).appendChild(st0); } }
  if(window.parent!==window) return;                       // dentro del hub: ya pasó por el acceso
  var hex=function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return ('0'+x.toString(16)).slice(-2);}).join('');};
  var unhex=function(h){var a=new Uint8Array(h.length/2);for(var i=0;i<a.length;i++)a[i]=parseInt(h.substr(i*2,2),16);return a;};
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
  function users(){ var u=Array.isArray(window.RD_USERS)?window.RD_USERS.slice():[];
    try{var d=JSON.parse(localStorage.getItem(DKEY)||'null'); if(d&&Array.isArray(d.u)&&d.u.length&&(d.t||0)>(window.RD_USERS_AT||0)) u=d.u; else if(Array.isArray(d)&&d.length&&!window.RD_USERS_AT) u=d;}catch(_){}
    return u; }
  function team(){ var t=window.RD_TEAM||null; try{var d=JSON.parse(localStorage.getItem(TKEY)||'null'); if(d&&d.ct&&(!t||(d.at||'')>(t.at||''))) t=d;}catch(_){} return t; }
  function setDraft(u,t){ try{ localStorage.setItem(DKEY,JSON.stringify({u:u,t:Date.now()})); if(t) localStorage.setItem(TKEY,JSON.stringify(t)); }catch(_){} }
  async function bits(pass,saltHex){ var k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveBits']);
    return await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unhex(saltHex),iterations:120000},k,256); }
  async function derive(pass,saltHex){ return hex(await bits(pass,saltHex)); }
  async function kek(pass,saltHex){ return crypto.subtle.importKey('raw',await bits(pass,saltHex+'6b6579'),'AES-GCM',false,['encrypt','decrypt']); }
  async function enc(key,bytes){ var iv=crypto.getRandomValues(new Uint8Array(12)); return {iv:hex(iv),ct:hex(await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,bytes))}; }
  async function dec(key,o){ return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unhex(o.iv)},key,unhex(o.ct))); }
  var aesK=function(raw){ return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']); };
  var getK=function(){ try{ var h=sessionStorage.getItem(KK); return h?unhex(h):null; }catch(_){ return null; } };
  async function mkUser(n,nombre,nivel,plantas,pass,K){
    var salt=hex(crypto.getRandomValues(new Uint8Array(16)));
    var u={n:String(n).trim(),nombre:String(nombre).trim(),nivel:+nivel,plantas:plantas,rol:+nivel===1?'admin':+nivel===4?'lector':'usuario',salt:salt,hash:await derive(pass,salt)};
    if(K && +nivel<=3) u.k=await enc(await kek(pass,salt),K);
    return u; }
  // abre la llave del equipo con la contraseña y deja la clave de GitHub solo en esta sesión
  async function openTeam(u,pass){ try{ sessionStorage.removeItem(KK); sessionStorage.removeItem(TOK); }catch(_){}
    if(!u.k) return false; try{ var K=await dec(await kek(pass,u.salt),u.k); sessionStorage.setItem(KK,hex(K)); var t=team();
      if(t&&t.ct){ var tk=new TextDecoder().decode(await dec(await aesK(K),t)); sessionStorage.setItem(TOK,tk); } return true; }catch(_){ return false; } }
  function session(){try{return JSON.parse(sessionStorage.getItem(SKEY)||'null');}catch(_){return null;}}
  function fileText(u,t){ return '/* Red DAIMAY · usuarios con acceso. Guardado desde el panel «Usuarios» el '+new Date().toISOString().slice(0,16).replace('T',' ')+'.\n   Contraseñas y llave del equipo van cifradas; no edites este archivo a mano. */\nwindow.RD_USERS_AT = '+Date.now()+';\nwindow.RD_USERS = '+JSON.stringify(u,null,1)+';\nwindow.RD_TEAM = '+JSON.stringify(t||null)+';\n'; }
  function download(u,t){var b=new Blob([fileText(u,t)],{type:'text/javascript'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='usuarios.js';document.body.appendChild(a);a.click();a.remove();}
  var REPO='GenetCamps/Red';
  var ghTok=function(){ try{ return localStorage.getItem('rd_gh_token')||sessionStorage.getItem(TOK)||''; }catch(_){ return ''; } };
  var b64=function(s){ var b=new TextEncoder().encode(s), o=''; for(var i=0;i<b.length;i+=0x8000) o+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000)); return btoa(o); };
  async function ghSave(u,t,who){ var tok=ghTok(); if(!tok) throw new Error('falta la llave del equipo o tu clave de GitHub');
    var url='https://api.github.com/repos/'+REPO+'/contents/usuarios.js', H={Authorization:'Bearer '+tok,Accept:'application/vnd.github+json'};
    for(var i=0;i<3;i++){ var g=await fetch(url+'?ref=main',{headers:H,cache:'no-store'}), sha=g.ok?(await g.json()).sha:null;
      var r=await fetch(url,{method:'PUT',headers:H,body:JSON.stringify({message:'Usuarios · '+who,content:b64(fileText(u,t)),branch:'main',sha:sha||undefined})});
      if(r.ok) return; if(r.status===409||r.status===422) continue; if(r.status===401) throw new Error('la clave ya venció o no es válida'); throw new Error('GitHub respondió '+r.status); }
    throw new Error('GitHub está ocupado; intenta de nuevo'); }

  var CSS='#rdGate,#rdAdm{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:#0C0F13;color:#E8ECEF;font:14px "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px;box-sizing:border-box;overflow:auto}'
   +'#rdAdm{background:rgba(8,10,13,.86);place-items:start center}'
   +'.rdBox{width:min(400px,100%);background:#13171D;border:1px solid #29313B;border-radius:12px;padding:24px;box-sizing:border-box;box-shadow:0 20px 60px rgba(0,0,0,.5)}'
   +'#rdAdm .rdBox{width:min(980px,100%);margin:10px 0}'
   +'#rdGate{background:#E2E5E7;color:#1C2126;font-size:15px}#rdGate .rdBox{background:#F3F4F5;border:0;border-radius:10px;box-shadow:0 1px 0 rgba(255,255,255,.6) inset,0 10px 30px rgba(35,40,46,.14);position:relative;padding:26px 24px}'
   +'#rdGate .rdBox::before{content:"";position:absolute;left:14px;right:14px;top:8px;height:2px;background:repeating-linear-gradient(90deg,#E1262D 0 9px,transparent 9px 15px)}'
   +'#rdGate .rdBox h1{color:#1C2126;font-weight:600;letter-spacing:.02em;text-transform:none;font-size:34px}#rdGate .rdBox h1 i{color:#E1262D}#rdGate .rdBox p,#rdGate .rdBox label{color:#5E6873}#rdGate .rdBox label{font-size:14px;font-weight:600}'
   +'#rdGate .rdBox input{background:#fff;border:2px solid #C9CED3;border-radius:10px;color:#1C2126;padding:12px;font-size:17px}#rdGate .rdBox input:focus{outline:none;border-color:#23282E}#rdGate .rdBtn{background:#E1262D;border-color:#E1262D;border-radius:10px;padding:14px;font-size:16px;min-height:52px}#rdGate .rdErr{color:#b42318}'
   +'.rdBox h1{margin:0 0 4px;font:700 26px "Barlow Condensed","Arial Narrow",Arial,sans-serif;letter-spacing:.05em;text-transform:uppercase}.rdBox h1 i{font-style:normal;color:#ED3037}'
   +'.rdBox h2{margin:18px 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#9AA3AD}'
   +'.rdBox p{margin:0 0 12px;color:#9AA3AD;font-size:13px;line-height:1.5}'
   +'.rdBox label{display:block;font-size:12px;color:#9AA3AD;margin:10px 0 4px}'
   +'.rdBox input,.rdBox select{width:100%;box-sizing:border-box;background:#1B2129;border:1px solid #29313B;border-radius:8px;padding:10px;color:#E8ECEF;font:inherit}'
   +'.rdBox input:focus-visible,.rdBox select:focus-visible,.rdBox button:focus-visible{outline:2px solid #ED3037;outline-offset:2px}'
   +'.rdBtn{margin-top:16px;width:100%;background:#ED3037;border:1px solid #ED3037;color:#fff;border-radius:8px;padding:11px;font:600 14px inherit;cursor:pointer}'
   +'.rdBtn.sec{background:#1B2129;border-color:#29313B;width:auto;margin:0;padding:7px 12px;font-size:12.5px}.rdBtn.pri{width:auto;margin:0;padding:8px 14px}'
   +'.rdErr{color:#FF8A84;font-size:12.5px;min-height:18px;margin-top:10px}.rdOk{color:#3ddc97}'
   +'.rdU{display:grid;grid-template-columns:minmax(150px,1.3fr) minmax(170px,1fr) minmax(220px,1.6fr) auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #29313B}'
   +'.rdU b{display:block}.rdU small{color:#9AA3AD;font-size:11.5px}.rdU select{padding:7px}'
   +'.rdChips{display:flex;gap:5px;flex-wrap:wrap}.rdChip{background:#1B2129;border:1px solid #29313B;color:#C9D1D9;border-radius:999px;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer;min-height:30px}'
   +'.rdChip[aria-pressed="true"]{background:#ED3037;border-color:#ED3037;color:#fff}.rdChip:disabled{opacity:.5;cursor:default}'
   +'.rdLv{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:6px;font-weight:700;font-size:12px;margin-right:6px;color:#0C0F13}'
   +'.rdRow{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;align-items:end}'
   +'.rdBar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px}'
   +'.rdKey{background:#0f1318;border:1px solid #29313B;border-radius:10px;padding:10px 12px;margin-top:8px}'
   +'#rdChip{position:relative}#rdMenu{position:absolute;right:0;top:calc(100% + 6px);min-width:210px;background:#13171D;border:1px solid #29313B;border-radius:8px;padding:6px;z-index:50;box-shadow:0 14px 34px rgba(0,0,0,.5)}'
   +'#rdMenu button{display:block;width:100%;text-align:left;background:none;border:0;color:#E8ECEF;padding:8px 10px;border-radius:6px;font:inherit;cursor:pointer}#rdMenu button:hover{background:#1B2129}#rdMenu small{display:block;color:#9AA3AD;padding:4px 10px 8px;font-size:11.5px}'
   +'@media (max-width:720px){.rdU{grid-template-columns:1fr}}';
  var LVC={1:'#ED3037',2:'#FFB020',3:'#48c2ff',4:'#9AA3AD'};
  function css(){if(document.getElementById('rdCss'))return;var s=document.createElement('style');s.id='rdCss';s.textContent=CSS;document.head.appendChild(s);}

  var me=session(), list=users();
  if(me && !list.some(function(u){return u.n===me.n;})) me=null;       // lo dieron de baja
  if(me){ var cur=list.find(function(u){return u.n===me.n;}); me.nivel=nivelOf(cur); me.plantas=plantasOf(cur); try{ sessionStorage.setItem(SKEY,JSON.stringify(me)); }catch(_){}
    window.RD_PERM=perm(me); window.RD_ME={id:'emp_'+me.n,n:me.n,nombre:me.nombre,rol:me.rol,nivel:me.nivel,plantas:me.plantas}; }
  // gemelo abierto solo, de una planta que no es suya
  var PAGE=(/\/([a-z0-9]+)\.html$/i.exec(location.pathname)||[])[1];
  if(me && PAGE && PAGE!=='index' && PLANTAS.some(function(x){return x[0]===PAGE;}) && !window.RD_PERM.plant(PAGE)){
    document.addEventListener('DOMContentLoaded',function(){ css(); var g=document.createElement('div'); g.id='rdGate'; g.innerHTML='<div class="rdBox"><h1>Sin <i>acceso</i></h1><p>Tu usuario no tiene permiso para esta planta.</p><a class="rdBtn" style="display:block;text-align:center;text-decoration:none" href="index.html">Ir a mis plantas</a></div>'; document.body.appendChild(g); }); }

  function gate(){
    css();
    var first=!list.length, g=document.createElement('div'); g.id='rdGate';
    g.innerHTML='<form class="rdBox" autocomplete="on"><img src="estilo/logo_daimay.png" alt="DAIMAY" style="height:64px;width:auto;border-radius:8px;background:#fff;padding:4px;display:block;margin:0 0 10px" onerror="this.remove()"><h1>Red <i>DAIMAY</i></h1>'
      +(first?'<p>Primer uso: crea la cuenta del administrador. Al terminar se descarga <b>usuarios.js</b>; súbelo al repositorio para que el acceso quede activo para todos.</p>'
            +'<label for="rdNom">Nombre</label><input id="rdNom" required maxlength="60">'
          :'<p>Entra con tu número de empleado y tu contraseña.</p>')
      +'<label for="rdNum">Número de empleado</label><input id="rdNum" required inputmode="numeric" autocomplete="username" maxlength="20">'
      +'<label for="rdPas">Contraseña</label><input id="rdPas" type="password" required minlength="'+(first?8:1)+'" autocomplete="'+(first?'new-password':'current-password')+'">'
      +'<div class="rdErr" id="rdErr" role="alert"></div><button class="rdBtn">'+(first?'Crear administrador y entrar':'Entrar')+'</button></form>';
    var mount=function(){document.body.appendChild(g);g.querySelector(first?'#rdNom':'#rdNum').focus();};
    document.body?mount():document.addEventListener('DOMContentLoaded',mount);
    g.querySelector('form').addEventListener('submit',async function(e){
      e.preventDefault(); var err=g.querySelector('#rdErr'), n=g.querySelector('#rdNum').value.trim(), p=g.querySelector('#rdPas').value;
      if(!window.crypto||!crypto.subtle){err.textContent='Este navegador no permite verificar contraseñas aquí. Abre el sitio por https o desde un servidor local.';return;}
      try{
        var u;
        if(first){ u=await mkUser(n,g.querySelector('#rdNom').value,1,['*'],p,null); list=[u]; setDraft(list); download(list,null); }
        else{ u=list.find(function(x){return x.n===n;}); if(!u||(await derive(p,u.salt))!==u.hash){err.textContent='Número de empleado o contraseña incorrectos.';return;} }
        await openTeam(u,p);
        sessionStorage.setItem(SKEY,JSON.stringify({n:u.n,nombre:u.nombre,rol:u.rol,nivel:nivelOf(u),plantas:plantasOf(u)}));
        location.reload();
      }catch(x){err.textContent='No se pudo verificar ('+(x&&x.message||x)+').';}
    });
  }

  /* ---------- panel de usuarios (solo administrador total) ---------- */
  function admin(){
    css(); var work=users().map(function(u){return Object.assign({},u);}), tm=team(), dirty=false, msg='', a=document.createElement('div'); a.id='rdAdm';
    var gen=function(){ var c='abcdefghjkmnpqrstuvwxyz23456789', o=''; var r=crypto.getRandomValues(new Uint8Array(10)); for(var i=0;i<10;i++) o+=c[r[i]%c.length]; return o; };
    var chips=function(sel,attr){ var all=sel.indexOf('*')>=0; return '<div class="rdChips">'+'<button type="button" class="rdChip" '+attr+' data-pl="*" aria-pressed="'+all+'">Todas</button>'+PLANTAS.map(function(x){ return '<button type="button" class="rdChip" '+attr+' data-pl="'+x[0]+'" aria-pressed="'+(!all&&sel.indexOf(x[0])>=0)+'">'+x[1]+'</button>'; }).join('')+'</div>'; };
    var lvSel=function(v,attr){ return '<select '+attr+'>'+[1,2,3,4].map(function(k){return '<option value="'+k+'"'+(+v===k?' selected':'')+'>'+k+' · '+NIV[k]+'</option>';}).join('')+'</select>'; };
    var NEW={nivel:3,plantas:[]};
    function paint(){ var hasK=!!getK(), canSave=!!ghTok();
      a.innerHTML='<div class="rdBox"><div style="display:flex;gap:10px;align-items:center"><h1 style="flex:1">Usuarios</h1><button type="button" class="rdBtn pri" id="rdSave"'+(dirty?'':' disabled style="opacity:.5"')+'>Guardar para todos</button><button type="button" class="rdBtn sec" id="rdCl">Cerrar</button></div>'
        +'<p>Elige el nivel y las plantas de cada persona. «Guardar para todos» lo sube al sitio; en uno o dos minutos ya aplica en cualquier computadora.'+(msg?'<br><b class="'+(/^✓/.test(msg)?'rdOk':'rdErr')+'">'+esc(msg)+'</b>':'')+'</p>'
        +'<div class="rdChips" style="margin:4px 0 6px">'+[1,2,3,4].map(function(k){return '<span style="font-size:12px;color:#9AA3AD;margin-right:10px"><span class="rdLv" style="background:'+LVC[k]+'">'+k+'</span>'+NIV[k]+' — '+NIVD[k]+'</span>';}).join('')+'</div>'
        +work.map(function(u,i){ var nv=nivelOf(u), self=u.n===me.n; return '<div class="rdU"><span><b><span class="rdLv" style="background:'+LVC[nv]+'">'+nv+'</span>'+esc(u.nombre)+'</b><small>No. '+esc(u.n)+(nv<=3?(u.k?' · <span class="rdOk">guarda para todos</span>':' · <span style="color:#FFB020">sin llave del equipo</span>'):'')+'</small></span>'
          +lvSel(nv,'data-lv="'+i+'"'+(self?' disabled title="No puedes cambiar tu propio nivel"':''))+chips(plantasOf(u),'data-ui="'+i+'"'+(self?' disabled':''))
          +'<span style="display:flex;gap:6px;justify-content:flex-end"><button type="button" class="rdBtn sec" data-pw="'+i+'">Nueva contraseña</button>'+(self?'':'<button type="button" class="rdBtn sec" data-del="'+i+'">Dar de baja</button>')+'</span></div>'; }).join('')
        +'<h2>Agregar usuario</h2><form id="rdNew"><div class="rdRow"><div><label for="rdN">No. empleado</label><input id="rdN" required maxlength="20" inputmode="numeric"></div><div><label for="rdM">Nombre</label><input id="rdM" required maxlength="60"></div>'
        +'<div><label for="rdLvN">Nivel</label>'+lvSel(NEW.nivel,'id="rdLvN"')+'</div><div><label for="rdP">Contraseña inicial</label><div style="display:flex;gap:6px"><input id="rdP" required minlength="8"><button type="button" class="rdBtn sec" id="rdGen">Generar</button></div></div></div>'
        +'<label>Plantas</label>'+chips(NEW.plantas,'data-nu="1"')
        +'<div class="rdErr" id="rdE2" role="alert"></div><div class="rdBar"><button class="rdBtn pri">Agregar</button><span style="color:#9AA3AD;font-size:12px">Anota la contraseña y dásela a la persona; la puede cambiar después desde su nombre → «Cambiar mi contraseña».</span></div></form>'
        +'<h2>Llave del equipo (para guardar sin GitHub)</h2><div class="rdKey">'
        +(tm&&tm.ct?'<p style="margin:0 0 6px"><b class="rdOk">✓ Activa</b> desde '+esc((tm.at||'').slice(0,10))+(tm.by?' por '+esc(tm.by):'')+'. '+(hasK?'Los usuarios que des de alta o les cambies contraseña ya guardan para todos.':'<span class="rdErr">Para dar la llave a otros, tu usuario debe tenerla: escribe aquí tu contraseña y pega la clave otra vez.</span>')+'</p>':'<p style="margin:0 0 6px">Pega una sola vez una clave de GitHub de <b>'+REPO+'</b> (fine-grained, «Contents: Read and write», con fecha de vencimiento). Se guarda cifrada; cada usuario la abre con su propia contraseña, así nadie más necesita cuenta de GitHub.</p>')
        +'<div class="rdRow"><div><label for="rdTk">Clave de GitHub'+(tm&&tm.ct?' (para cambiarla)':'')+'</label><input id="rdTk" type="password" autocomplete="off" placeholder="github_pat_…"></div><div><label for="rdMy">Tu contraseña</label><input id="rdMy" type="password" autocomplete="current-password"></div><div><button type="button" class="rdBtn sec" id="rdTkSet" style="width:100%">'+(tm&&tm.ct?'Cambiar llave':'Activar llave')+'</button></div></div>'
        +'<p style="margin:8px 0 0;font-size:12px">Cualquier persona con la llave podría usarla fuera del sitio: dala solo a gente de confianza (niveles 1 a 3) y renueva la clave cuando alguien salga. '+(canSave?'':'<b class="rdErr">Para guardar los usuarios hace falta la llave del equipo o tu clave de GitHub en este navegador.</b>')+'</p></div>'
        +'<div class="rdBar"><button type="button" class="rdBtn sec" id="rdDl">Descargar copia de usuarios.js</button></div></div>';
    }
    paint(); document.body.appendChild(a);
    function togglePl(arr,p){ if(p==='*') return arr.indexOf('*')>=0?[]:['*']; var x=arr.filter(function(v){return v!=='*';}), i=x.indexOf(p); if(i>=0) x.splice(i,1); else x.push(p); return x; }
    a.addEventListener('change',function(e){ var t=e.target;
      if(t.dataset.lv){ var u=work[+t.dataset.lv]; u.nivel=+t.value; u.rol=u.nivel===1?'admin':u.nivel===4?'lector':'usuario'; if(u.nivel===1) u.plantas=['*']; dirty=true; paint(); }
      if(t.id==='rdLvN'){ NEW.nivel=+t.value; if(NEW.nivel===1) NEW.plantas=['*']; paint(); } });
    a.addEventListener('click',async function(e){ var b=e.target.closest('button'); if(!b) return;
      if(b.dataset.ui){ var u=work[+b.dataset.ui]; if(nivelOf(u)===1) return; u.plantas=togglePl(plantasOf(u),b.dataset.pl); dirty=true; paint(); return; }
      if(b.dataset.nu){ NEW.plantas=togglePl(NEW.plantas,b.dataset.pl); var keep=[a.querySelector('#rdN').value,a.querySelector('#rdM').value,a.querySelector('#rdP').value]; paint(); a.querySelector('#rdN').value=keep[0]; a.querySelector('#rdM').value=keep[1]; a.querySelector('#rdP').value=keep[2]; return; }
      if(b.dataset.del){ var d=work[+b.dataset.del]; if(confirm('¿Dar de baja a '+d.nombre+'? Ya no podrá entrar.')){ work.splice(+b.dataset.del,1); dirty=true; paint(); } return; }
      if(b.dataset.pw){ var w=work[+b.dataset.pw], np=prompt('Nueva contraseña para '+w.nombre+' (mínimo 8). Anótala y dásela:',gen()); if(!np) return; if(np.length<8){ alert('Mínimo 8 caracteres.'); return; }
        var nu=await mkUser(w.n,w.nombre,nivelOf(w),plantasOf(w),np,getK()); work[+b.dataset.pw]=nu; dirty=true; msg=nivelOf(nu)<=3&&!nu.k?'Contraseña cambiada; aún no guarda para todos: activa la llave del equipo.':''; paint(); return; }
      if(b.id==='rdGen'){ a.querySelector('#rdP').value=gen(); return; }
      if(b.id==='rdCl'){ if(dirty&&!confirm('Hay cambios sin guardar para todos. ¿Cerrar de todos modos?')) return; a.remove(); return; }
      if(b.id==='rdDl'){ download(work,tm); return; }
      if(b.id==='rdTkSet'){ var tk=a.querySelector('#rdTk').value.trim(), my=a.querySelector('#rdMy').value; var mu=work.find(function(x){return x.n===me.n;});
        if(!tk||!my){ msg='Pega la clave y escribe tu contraseña.'; paint(); return; }
        if((await derive(my,mu.salt))!==mu.hash){ msg='Tu contraseña no coincide.'; paint(); return; }
        b.disabled=true; b.textContent='Revisando…';
        try{ var r=await fetch('https://api.github.com/repos/'+REPO,{headers:{Authorization:'Bearer '+tk,Accept:'application/vnd.github+json'},cache:'no-store'}), j=r.ok?await r.json():null;
          if(!r.ok) throw new Error(r.status===401?'GitHub no reconoce esa clave':'esa clave no tiene acceso a '+REPO); if(!(j.permissions&&j.permissions.push)) throw new Error('la clave solo puede leer; necesita «Contents: Read and write»');
          var K=getK()||crypto.getRandomValues(new Uint8Array(32)); tm=Object.assign(await enc(await aesK(K),new TextEncoder().encode(tk)),{at:new Date().toISOString(),by:me.nombre});
          var mi=work.findIndex(function(x){return x.n===me.n;}); work[mi]=Object.assign({},work[mi],{k:await enc(await kek(my,work[mi].salt),K)});
          sessionStorage.setItem(KK,hex(K)); sessionStorage.setItem(TOK,tk); dirty=true; msg='✓ Llave activa. Ahora da «Nueva contraseña» a quien deba guardar (o que ya la tenga) y luego «Guardar para todos».'; }
        catch(x){ msg='No se activó: '+(x.message||x); } paint(); return; }
      if(b.id==='rdSave'){ b.disabled=true; b.textContent='Guardando…';
        try{ await ghSave(work,tm,me.nombre); setDraft(work,tm); dirty=false; msg='✓ Guardado. En uno o dos minutos aplica en todas las computadoras.'; }
        catch(x){ msg='No se guardó: '+(x.message||x)+'. Puedes descargar la copia y subirla a mano.'; } paint(); return; } });
    a.addEventListener('submit',async function(e){
      e.preventDefault(); var n=a.querySelector('#rdN').value.trim(), er=a.querySelector('#rdE2');
      if(NEW.nivel>1&&!NEW.plantas.length){ er.textContent='Elige al menos una planta (o «Todas»).'; return; }
      try{ var u=await mkUser(n,a.querySelector('#rdM').value,NEW.nivel,NEW.nivel===1?['*']:NEW.plantas,a.querySelector('#rdP').value,getK());
        var i=work.findIndex(function(x){return x.n===n;}); if(i>=0) work[i]=u; else work.push(u); dirty=true; msg=u.nivel<=3&&!u.k?'Agregado; aún no guarda para todos: activa la llave del equipo.':'Agregado. Falta «Guardar para todos».'; NEW={nivel:3,plantas:[]}; paint();
      }catch(x){er.textContent='No se pudo crear ('+(x&&x.message||x)+').';}
    });
  }
  async function myPass(){ var u=users().find(function(x){return x.n===me.n;}); if(!u) return; var old=prompt('Tu contraseña actual:'); if(!old) return;
    if((await derive(old,u.salt))!==u.hash){ alert('La contraseña actual no coincide.'); return; } var np=prompt('Nueva contraseña (mínimo 8):'); if(!np||np.length<8){ alert('Mínimo 8 caracteres.'); return; }
    var K=getK(), all=users(), i=all.findIndex(function(x){return x.n===me.n;}); all[i]=await mkUser(u.n,u.nombre,nivelOf(u),plantasOf(u),np,K);
    try{ await ghSave(all,team(),me.nombre); setDraft(all); alert('Listo: contraseña cambiada.'); }catch(x){ alert('No se pudo guardar: '+(x.message||x)); } }

  function chip(){
    css(); var host=document.querySelector('#bar .acts'), w=document.createElement('div'); w.id='rdChip';
    if(!host) return;                                        // gemelo abierto solo: la sesión se maneja desde la página de la red
    var P=window.RD_PERM, nv=P.nivel;
    w.innerHTML='<button class="btn rdBtn sec" id="rdWho" aria-haspopup="true" aria-expanded="false" title="Sesión · nivel '+nv+' · '+NIV[nv]+'"><span class="rdLv" style="background:'+LVC[nv]+';width:18px;height:18px;font-size:11px">'+nv+'</span>'+esc(me.nombre.split(' ')[0])+'</button><div id="rdMenu" hidden><small>'+esc(me.nombre)+' · No. '+esc(me.n)+'<br>Nivel '+nv+' · '+NIV[nv]+'<br>'+(P.all?'Toda la red':esc(P.plantas.map(function(p){var x=PLANTAS.find(function(y){return y[0]===p;});return x?x[1]:p;}).join(', ')))+'</small>'
      +(P.admin?'<button data-a="adm">Usuarios</button>':'')+(P.log?'<button data-a="log">Actividad</button>':'')+(P.edit&&!P.solo?'<button data-bk="pub" title="Descarga un archivo solo con lo que cambiaste, para publicarlo para todos">Publicar mis datos</button>':'')+'<button data-a="pw">Cambiar mi contraseña</button><button data-a="out">Cerrar sesión</button></div>';
    host.appendChild(w);
    var m=w.querySelector('#rdMenu'), b=w.querySelector('#rdWho');
    b.addEventListener('click',function(){m.hidden=!m.hidden;b.setAttribute('aria-expanded',String(!m.hidden));});
    document.addEventListener('click',function(e){if(!w.contains(e.target))m.hidden=true;});
    m.addEventListener('click',function(e){var x=e.target.closest('[data-a]');if(!x)return;m.hidden=true;
      if(x.dataset.a==='out'){try{sessionStorage.removeItem(SKEY);sessionStorage.removeItem(KK);sessionStorage.removeItem(TOK);}catch(_){}location.reload();}
      if(x.dataset.a==='adm')admin(); if(x.dataset.a==='pw')myPass(); if(x.dataset.a==='log'&&window.rdActividad)window.rdActividad();});
  }
  window.RD_ACC={ NIV:NIV, PLANTAS:PLANTAS, admin:function(){ if(window.RD_PERM&&window.RD_PERM.admin) admin(); } };

  if(!me) gate();
  else if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',chip); else chip();
})();
