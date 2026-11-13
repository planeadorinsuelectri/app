/* Reemplaza google.script.run: envía las llamadas al script de Google por internet.
   Si no hay señal, la llamada falla y la página guarda el reporte en la cola como siempre. */
(function(){
  'use strict';
  var API = 'https://script.google.com/macros/s/AKfycbz2zi7LsXSYiXYZPP6X4wRYtxkcRYBHJwGQ5VaaOm6X3Xnb5Zb3ur7iqA6uAHp-nICQFA/exec';
  var GUARDAR = { getInicioTareas: 1, getInicioCajas: 1 };   // se guardan para abrir sin señal
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
  /* deja listos los datos de Cajas y torres para cuando la abran sin señal */
  window.addEventListener('load', function(){
    if (navigator.onLine) llamar('getInicioCajas', [], function(x){ try{ localStorage.setItem('insp_inicio', JSON.stringify(x)); }catch(e){} }, null);
  });
  if ('serviceWorker' in navigator) window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
})();
