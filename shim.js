/* Reemplaza google.script.run: envía las llamadas al script de Google por internet.
   Si no hay señal, la llamada falla y la página guarda el reporte en la cola como siempre. */
(function(){
  'use strict';
  var API = 'https://script.google.com/macros/s/AKfycbz2zi7LsXSYiXYZPP6X4wRYtxkcRYBHJwGQ5VaaOm6X3Xnb5Zb3ur7iqA6uAHp-nICQFA/exec';
  var GUARDAR = { getInicioTareas: 1, getInicioCajas: 1, getInicio: 1, getInicioRevision: 1, getInicioFormato: 1 };   // se guardan para abrir sin señal
  function leer(k){ try{ var x = localStorage.getItem(k); return x ? JSON.parse(x) : null; }catch(e){ return null; } }
  function llamar(fn, args, ok, fail){
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function(){ if (ctl) ctl.abort(); }, 60000);
    fetch(API, { method: 'POST', body: JSON.stringify({ fn: fn, args: args }), redirect: 'follow', signal: ctl ? ctl.signal : undefined })
      .then(function(r){ return r.json(); })
      .then(function(o){
        clearTimeout(t);
        if (!o || !o.ok) throw new Error((o && o.error) || 'Respuesta inválida');
        if (GUARDAR[fn]) try{ localStorage.setItem('api_' + fn, JSON.stringify(o.r)); }catch(e){}
        if (MENU_FN[fn] && o.r && o.r.ok && o.r.modulos) guardarMenu(o.r);
        if (ok) setTimeout(function(){ ok(o.r); });
      })
      .catch(function(e){
        clearTimeout(t);
        var c = GUARDAR[fn] ? leer('api_' + fn) : null;
        if (c && ok) { setTimeout(function(){ ok(c); }); return; }
        if (fail) setTimeout(function(){ fail(e); });
      });
  }
  function runner(){
    var ok = null, fail = null, p;
    p = new Proxy({}, { get: function(_, k){
      if (k === 'withSuccessHandler') return function(h){ ok = h; return p; };
      if (k === 'withFailureHandler') return function(h){ fail = h; return p; };
      if (k === 'withUserObject') return function(){ return p; };
      return function(){ llamar(k, [].slice.call(arguments), ok, fail); };
    }});
    return p;
  }
  window.google = { script: {} };
  Object.defineProperty(window.google.script, 'run', { get: runner });
  /* menú común de la app */
  var PAGINAS = [['index.html', 'Tareas'], ['cajas.html', 'Cajas/torres'], ['inventario.html', 'Inventario'], ['consulta.html', 'Consulta'], ['revision.html', 'Revisión'], ['formato.html', 'Formato diario'], ['pm.html', 'PM palas'], ['cables.html', 'Cables'], ['enterrado.html', 'Cable enterrado'], ['reportes.html', 'Reportes'], ['rca.html', 'RCA'], ['down.html', 'Down eléctrico']];
  /* menú según el rol (hoja PERMISOS): se guarda al ingresar y se refresca al abrir con señal */
  var MENU_FN = { ingresar: 1, ingresarSupervisor: 1, misModulos: 1 }, SESIONES = ['tar_sesion', 'rev_ses', 'red_sesion'];
  /* sesión abierta en este celular: la del usuario del menú si sigue abierta, si no la primera que haya */
  function sesion(nombre){
    var hay = SESIONES.map(leer).filter(function(x){ return x && x.usuario && x.pin; });
    return hay.filter(function(x){ return nombre && x.usuario === nombre; })[0] || (nombre ? null : hay[0]) || null;
  }
  function refrescar(){
    var m = leer('menu_mod'), s = (m && sesion(m.nombre)) || sesion();
    if (s && navigator.onLine) llamar('misModulos', [s.usuario, s.pin], null, null);
  }
  function guardarMenu(r){
    try{ localStorage.setItem('menu_mod', JSON.stringify({ nombre: r.nombre, rol: r.rol, modulos: r.modulos })); }catch(e){}
    pintarMenu();
  }
  try{
    var quitar = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function(k){
      quitar.call(this, k);
      if (this === window.localStorage && SESIONES.indexOf(k) >= 0){ var m = leer('menu_mod'); if (m && !sesion(m.nombre)){ quitar.call(this, 'menu_mod'); pintarMenu(); refrescar(); } }
    };
  }catch(e){}
  function visibles(){
    var m = leer('menu_mod');
    if (m && m.modulos) return PAGINAS.filter(function(p){ return m.modulos.indexOf(p[0]) >= 0; });
    if (!sesion()) return PAGINAS.filter(function(p){ return p[0] === 'index.html' || p[0] === 'revision.html'; });
    return PAGINAS;
  }
  function pintarMenu(){
    var nav = document.querySelector('.appnav'); if (!nav) return;
    var aqui = location.pathname.split('/').pop() || 'index.html';
    nav.innerHTML = visibles().map(function(p){ return '<a href="' + p[0] + '"' + (p[0] === aqui ? ' class="on"' : '') + '>' + p[1] + '</a>'; }).join('');
    var m = leer('menu_mod'), bl = document.getElementById('appBloqueo');
    var bloquear = m && m.modulos && m.modulos.indexOf(aqui) < 0;
    if (bloquear && !bl){
      var ir = PAGINAS.filter(function(p){ return m.modulos.indexOf(p[0]) >= 0; })[0];
      bl = document.createElement('div'); bl.id = 'appBloqueo';
      bl.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(17,24,39,.92);display:flex;align-items:center;justify-content:center;padding:20px;font:15px system-ui,sans-serif';
      bl.innerHTML = '<div style="background:#fff;color:#111;border-radius:14px;padding:22px;max-width:360px;text-align:center">' +
        '<div style="font-size:34px">🔒</div><p style="margin:8px 0 4px;font-weight:700">Este módulo no está habilitado para su usuario</p>' +
        '<p style="margin:0 0 16px;color:#6b7280">' + String(m.nombre || '').replace(/[<>&]/g, '') + (m.rol ? ' · ' + String(m.rol).replace(/[<>&]/g, '') : '') + '</p>' +
        (ir ? '<a href="' + ir[0] + '" style="display:block;background:#F28401;color:#fff;text-decoration:none;padding:11px;border-radius:9px;font-weight:700;margin-bottom:8px">Ir a ' + ir[1] + '</a>' : '') +
        '<button type="button" id="appCambiar" style="width:100%;padding:10px;border-radius:9px;border:1px solid #d1d5db;background:#fff;font:600 14px system-ui">Ingresar con otro usuario</button></div>';
      document.body.appendChild(bl);
      document.getElementById('appCambiar').onclick = function(){ SESIONES.concat(['menu_mod']).forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} }); location.reload(); };
    } else if (!bloquear && bl) bl.remove();
  }
  var SOLO_SENAL = { 'consulta.html': 1, 'revision.html': 1, 'formato.html': 1, 'reportes.html': 1, 'rca.html': 1 };
  document.addEventListener('DOMContentLoaded', function(){
    var aqui = location.pathname.split('/').pop() || 'index.html';
    var st = document.createElement('style');
    st.textContent = '#lnkInv,#lnkCaj,#lnkTar,#lnkTareas{display:none!important}' +
      /* colores Insuelectri */
      ':root{--acc:#F28401!important;--acc2:#FDEBD3!important;--hd:#F28401!important}' +
      '@media (prefers-color-scheme: dark){:root{--acc:#F7A23B!important;--acc2:#3a2608!important}}' +
      'header{background:#F28401!important;color:#fff!important}' +
      'header .mut,header small,header p{color:#fff3e3!important}' +
      'button.pri,.pri{background:#F28401!important;border-color:#F28401!important;color:#fff!important}' +
      /* barra con logo y menú */
      '.appbar{background:#fff;border-bottom:3px solid #F28401;padding:8px 10px 0}' +
      '.appbar img{height:30px;display:block;margin:0 0 6px 2px}' +
      '.appnav{display:flex;gap:4px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch}' +
      '.appnav a{flex:0 0 auto;color:#374151;text-decoration:none;font:600 13px system-ui,sans-serif;padding:7px 11px;border-radius:8px;white-space:nowrap;background:#f3f4f6}' +
      '.appnav a.on{background:#F28401;color:#fff}' +
      '@media (prefers-color-scheme: dark){.appbar{background:#111827}.appnav a{background:#1f2937;color:#e5e7eb}}' +
      '.appaviso{background:#FDEBD3;color:#92400e;font:13px system-ui,sans-serif;padding:8px 12px;text-align:center}';
    document.head.appendChild(st);
    var mt = document.querySelector('meta[name="theme-color"]'); if (mt) mt.content = '#F28401';
    if (!document.querySelector('link[rel="icon"]')){ var fi = document.createElement('link'); fi.rel = 'icon'; fi.href = 'icono-192.png'; document.head.appendChild(fi); }
    var bar = document.createElement('div'); bar.className = 'appbar';
    bar.innerHTML = '<img src="logo.png" alt="Insuelectri"><nav class="appnav"></nav>';
    document.body.insertBefore(bar, document.body.firstChild);
    pintarMenu();
    refrescar();
    var n = bar;
    if (SOLO_SENAL[aqui]){
      var av = document.createElement('div'); av.className = 'appaviso'; av.hidden = navigator.onLine;
      av.textContent = 'Sin señal: esta parte necesita cobertura para cargar y guardar.';
      n.insertAdjacentElement('afterend', av);
      window.addEventListener('online', function(){ av.hidden = true; }); window.addEventListener('offline', function(){ av.hidden = false; });
    }
  });
  /* deja listos los datos de Cajas y torres para cuando la abran sin señal */
  window.addEventListener('load', function(){
    if (navigator.onLine) llamar('getInicioCajas', [], function(x){ try{ localStorage.setItem('insp_inicio', JSON.stringify(x)); }catch(e){} }, null);
  });
  if ('serviceWorker' in navigator) window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
})();
