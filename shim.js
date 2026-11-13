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
      '.appnav{display:flex;gap:4px;overflow-x:auto;background:#111827;padding:6px 8px;position:sticky;top:0;z-index:50;-webkit-overflow-scrolling:touch}' +
      '.appnav a{flex:0 0 auto;color:#e5e7eb;text-decoration:none;font:600 13px system-ui,sans-serif;padding:7px 11px;border-radius:8px;white-space:nowrap}' +
      '.appnav a.on{background:#d97706;color:#fff}' +
      '.appaviso{background:#fef3c7;color:#92400e;font:13px system-ui,sans-serif;padding:8px 12px;text-align:center}';
    document.head.appendChild(st);
    var n = document.createElement('nav'); n.className = 'appnav';
    n.innerHTML = PAGINAS.map(function(p){ return '<a href="' + p[0] + '"' + (p[0] === aqui ? ' class="on"' : '') + '>' + p[1] + '</a>'; }).join('');
    document.body.insertBefore(n, document.body.firstChild);
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
