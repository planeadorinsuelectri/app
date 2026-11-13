/* Reemplaza google.script.run: envía las llamadas al script de Google por internet.
   Si no hay señal, la llamada falla y la página guarda el reporte en la cola como siempre. */
(function(){
  'use strict';
  var API = 'https://script.google.com/macros/s/AKfycbz2zi7LsXSYiXYZPP6X4wRYtxkcRYBHJwGQ5VaaOm6X3Xnb5Zb3ur7iqA6uAHp-nICQFA/exec';
  var GUARDAR = { getInicioTareas: 1, getInicioCajas: 1, getInicio: 1, getInicioRevision: 1 };   // se guardan para abrir sin señal
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
  var PAGINAS = [['index.html', 'Tareas'], ['cajas.html', 'Cajas/torres'], ['inventario.html', 'Inventario'], ['consulta.html', 'Consulta'], ['revision.html', 'Revisión']];
  var SOLO_SENAL = { 'consulta.html': 1, 'revision.html': 1 };
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
    bar.innerHTML = '<img src="logo.png" alt="Insuelectri"><nav class="appnav">' +
      PAGINAS.map(function(p){ return '<a href="' + p[0] + '"' + (p[0] === aqui ? ' class="on"' : '') + '>' + p[1] + '</a>'; }).join('') + '</nav>';
    document.body.insertBefore(bar, document.body.firstChild);
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
