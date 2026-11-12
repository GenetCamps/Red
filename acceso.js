/* Red DAIMAY · acceso por número de empleado y contraseña.
   Es un candado de uso interno: evita entradas casuales, no cifra el contenido.
   Los usuarios viven en usuarios.js; solo quien puede subir archivos al repositorio puede cambiarlos. */
(function(){
  'use strict';
  // solo lectura: aplica en la red, en los gemelos (solos o dentro de la red) y en la consola VSM
  try{ var _s=JSON.parse(sessionStorage.getItem('rd_user')||'null'); if(_s&&_s.rol==='lector'){ window.RD_RO=true;
    var st=document.createElement('style'); st.textContent='[data-tool="move"],[data-tool="edit"],#oEdit,#edp,#edSave,#edReset,#edDel,#adAdd,#drEd,#drAd{display:none!important}';
    (document.head||document.documentElement).appendChild(st); } }catch(_){}
  if(window.parent!==window) return;                       // gemelo dentro del hub: ya pasó por el acceso
  var SKEY='rd_user', DKEY='rd_users_borrador';
  var hex=function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return ('0'+x.toString(16)).slice(-2);}).join('');};
  var unhex=function(h){var a=new Uint8Array(h.length/2);for(var i=0;i<a.length;i++)a[i]=parseInt(h.substr(i*2,2),16);return a;};
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
  function users(){
    var u=Array.isArray(window.RD_USERS)?window.RD_USERS.slice():[];
    try{var d=JSON.parse(localStorage.getItem(DKEY)||'null'); if(Array.isArray(d)&&d.length) u=d;}catch(_){}
    return u;
  }
  function setDraft(u){try{localStorage.setItem(DKEY,JSON.stringify(u));}catch(_){}}
  async function derive(pass,saltHex){
    var k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveBits']);
    return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unhex(saltHex),iterations:120000},k,256));
  }
  async function mkUser(n,nombre,rol,pass){
    var salt=hex(crypto.getRandomValues(new Uint8Array(16)));
    return {n:String(n).trim(),nombre:String(nombre).trim(),rol:rol,salt:salt,hash:await derive(pass,salt)};
  }
  function session(){try{return JSON.parse(sessionStorage.getItem(SKEY)||'null');}catch(_){return null;}}
  function fileText(u){return '/* Red DAIMAY · usuarios con acceso. Generado desde el panel "Usuarios" el '+new Date().toISOString().slice(0,10)+'.\n   Para dar de alta o baja: entra como administrador, botón con tu nombre → Usuarios, descarga este archivo y súbelo al repositorio reemplazando usuarios.js. */\nwindow.RD_USERS = '+JSON.stringify(u,null,1)+';\n';}
  function download(u){var b=new Blob([fileText(u)],{type:'text/javascript'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='usuarios.js';document.body.appendChild(a);a.click();a.remove();}

  var CSS='#rdGate,#rdAdm{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:#0C0F13;color:#E8ECEF;font:14px "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px;box-sizing:border-box;overflow:auto}'
   +'#rdAdm{background:rgba(8,10,13,.86)}'
   +'.rdBox{width:min(400px,100%);background:#13171D;border:1px solid #29313B;border-radius:12px;padding:24px;box-sizing:border-box;box-shadow:0 20px 60px rgba(0,0,0,.5)}'
   +'#rdAdm .rdBox{width:min(680px,100%)}'
   +'.rdBox h1{margin:0 0 4px;font:700 26px "Barlow Condensed","Arial Narrow",Arial,sans-serif;letter-spacing:.05em;text-transform:uppercase}.rdBox h1 i{font-style:normal;color:#ED3037}'
   +'.rdBox p{margin:0 0 16px;color:#9AA3AD;font-size:13px;line-height:1.5}'
   +'.rdBox label{display:block;font-size:12px;color:#9AA3AD;margin:10px 0 4px}'
   +'.rdBox input,.rdBox select{width:100%;box-sizing:border-box;background:#1B2129;border:1px solid #29313B;border-radius:8px;padding:10px;color:#E8ECEF;font:inherit}'
   +'.rdBox input:focus-visible,.rdBox select:focus-visible,.rdBox button:focus-visible{outline:2px solid #ED3037;outline-offset:2px}'
   +'.rdBtn{margin-top:16px;width:100%;background:#ED3037;border:1px solid #ED3037;color:#fff;border-radius:8px;padding:11px;font:600 14px inherit;cursor:pointer}'
   +'.rdBtn.sec{background:#1B2129;border-color:#29313B;width:auto;margin:0;padding:7px 12px;font-size:12.5px}'
   +'.rdErr{color:#FF8A84;font-size:12.5px;min-height:18px;margin-top:10px}'
   +'.rdT{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0 14px}.rdT th,.rdT td{text-align:left;padding:7px 6px;border-bottom:1px solid #29313B}.rdT th{color:#9AA3AD;font-weight:500;font-size:11.5px}'
   +'.rdRow{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;align-items:end}'
   +'.rdBar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px}'
   +'#rdChip{position:relative}#rdMenu{position:absolute;right:0;top:calc(100% + 6px);min-width:190px;background:#13171D;border:1px solid #29313B;border-radius:8px;padding:6px;z-index:50;box-shadow:0 14px 34px rgba(0,0,0,.5)}'
   +'#rdMenu button{display:block;width:100%;text-align:left;background:none;border:0;color:#E8ECEF;padding:8px 10px;border-radius:6px;font:inherit;cursor:pointer}#rdMenu button:hover{background:#1B2129}#rdMenu small{display:block;color:#9AA3AD;padding:4px 10px 8px;font-size:11.5px}'
   +'#rdFloat{position:fixed;right:12px;bottom:12px;z-index:2147482000}';
  function css(){if(document.getElementById('rdCss'))return;var s=document.createElement('style');s.id='rdCss';s.textContent=CSS;document.head.appendChild(s);}

  var me=session(), list=users();
  if(me && !list.some(function(u){return u.n===me.n;})) me=null;       // lo dieron de baja
  if(me) window.RD_ME={id:'emp_'+me.n,n:me.n,nombre:me.nombre,rol:me.rol};

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
        if(first){ u=await mkUser(n,g.querySelector('#rdNom').value,'admin',p); list=[u]; setDraft(list); download(list); }
        else{ u=list.find(function(x){return x.n===n;}); if(!u||(await derive(p,u.salt))!==u.hash){err.textContent='Número de empleado o contraseña incorrectos.';return;} }
        sessionStorage.setItem(SKEY,JSON.stringify({n:u.n,nombre:u.nombre,rol:u.rol}));
        location.reload();
      }catch(x){err.textContent='No se pudo verificar ('+(x&&x.message||x)+').';}
    });
  }

  function admin(){
    css(); var work=users(), dirty=false, a=document.createElement('div'); a.id='rdAdm';
    function paint(){
      a.innerHTML='<div class="rdBox"><h1>Usuarios</h1><p>'+work.length+' con acceso. Los cambios se aplican para todos cuando subes el archivo <b>usuarios.js</b> al repositorio (reemplaza el que ya está).</p>'
        +'<table class="rdT"><thead><tr><th>No. empleado</th><th>Nombre</th><th>Rol</th><th></th></tr></thead><tbody>'
        +work.map(function(u,i){return '<tr><td>'+esc(u.n)+'</td><td>'+esc(u.nombre)+'</td><td>'+(u.rol==='admin'?'Administrador':u.rol==='lector'?'Solo lectura':'Usuario')+'</td><td style="text-align:right">'+(u.n===me.n?'':'<button class="rdBtn sec" data-del="'+i+'">Dar de baja</button>')+'</td></tr>';}).join('')
        +'</tbody></table><form id="rdNew"><div class="rdRow"><div><label for="rdN">No. empleado</label><input id="rdN" required maxlength="20" inputmode="numeric"></div><div><label for="rdM">Nombre</label><input id="rdM" required maxlength="60"></div>'
        +'<div><label for="rdR">Rol</label><select id="rdR"><option value="usuario">Usuario (edita en su navegador)</option><option value="lector">Solo lectura</option><option value="admin">Administrador</option></select></div><div><label for="rdP">Contraseña inicial</label><input id="rdP" required minlength="8"></div></div>'
        +'<div class="rdErr" id="rdE2" role="alert"></div><div class="rdBar"><button class="rdBtn sec">Agregar o cambiar contraseña</button><span style="flex:1"></span>'
        +'<button type="button" class="rdBtn sec" id="rdDl" style="'+(dirty?'background:#ED3037;border-color:#ED3037':'')+'">Descargar usuarios.js</button><button type="button" class="rdBtn sec" id="rdCl">Cerrar</button></div></form></div>';
    }
    paint(); document.body.appendChild(a);
    a.addEventListener('click',function(e){
      var d=e.target.closest('[data-del]'); if(d){work.splice(+d.dataset.del,1);dirty=true;setDraft(work);paint();return;}
      if(e.target.id==='rdDl'){download(work);dirty=false;paint();}
      if(e.target.id==='rdCl'){a.remove();}
    });
    a.addEventListener('submit',async function(e){
      e.preventDefault(); var n=a.querySelector('#rdN').value.trim(), er=a.querySelector('#rdE2');
      try{var u=await mkUser(n,a.querySelector('#rdM').value,a.querySelector('#rdR').value,a.querySelector('#rdP').value);
        var i=work.findIndex(function(x){return x.n===n;}); if(i>=0) work[i]=u; else work.push(u); dirty=true; setDraft(work); paint();
      }catch(x){er.textContent='No se pudo crear ('+(x&&x.message||x)+').';}
    });
  }

  function chip(){
    css(); var host=document.querySelector('#bar .acts'), w=document.createElement('div'); w.id='rdChip';
    if(!host) return;                                        // gemelo abierto solo: la sesión se maneja desde la página de la red
    w.innerHTML='<button class="btn rdBtn sec" id="rdWho" aria-haspopup="true" aria-expanded="false" title="Sesión">'+esc(me.nombre.split(' ')[0])+'</button><div id="rdMenu" hidden><small>'+esc(me.nombre)+' · No. '+esc(me.n)+'</small>'
      +(me.rol==='admin'?'<button data-a="adm">Usuarios</button>':'')+'<button data-a="out">Cerrar sesión</button></div>';
    host.appendChild(w);
    var m=w.querySelector('#rdMenu'), b=w.querySelector('#rdWho');
    b.addEventListener('click',function(){m.hidden=!m.hidden;b.setAttribute('aria-expanded',String(!m.hidden));});
    document.addEventListener('click',function(e){if(!w.contains(e.target))m.hidden=true;});
    m.addEventListener('click',function(e){var x=e.target.closest('[data-a]');if(!x)return;m.hidden=true;
      if(x.dataset.a==='out'){try{sessionStorage.removeItem(SKEY);}catch(_){}location.reload();}
      if(x.dataset.a==='adm')admin();});
  }

  if(!me) gate();
  else if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',chip); else chip();
})();
