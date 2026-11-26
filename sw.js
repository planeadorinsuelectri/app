/* Guarda la app en el celular para que abra sin señal. VERSION cambia en cada publicación. */
var VERSION = 'insu-229562ffcd';
var ARCHIVOS = ['./', 'index.html', 'cajas.html', 'inventario.html', 'consulta.html', 'revision.html', 'formato.html', 'pm.html', 'cables.html', 'enterrado.html', 'reportes.html', 'rca.html', 'down.html', 'preop.html', 'shim.js', 'manifest.json', 'icono-192.png', 'icono-512.png', 'logo.png'];
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(ARCHIVOS.map(function(u){ return new Request(u, { cache: 'reload' }); })); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k !== VERSION && k !== 'compartido'; }).map(function(k){ return caches.delete(k); })); })
    .then(function(){ return self.clients.claim(); }));
});
/* Abre desde el celular de una vez; si hay señal, trae la versión nueva para la próxima vez. */
self.addEventListener('fetch', function(e){
  var u = new URL(e.request.url);
  /* Excel compartido desde WhatsApp (Android): se guarda y se abre la página RCA para cargarlo */
  if (e.request.method === 'POST' && u.origin === location.origin && /\/rca\.html$/.test(u.pathname)){
    e.respondWith(e.request.formData().then(function(fd){
      var f = fd.get('archivo');
      return caches.open('compartido').then(function(c){
        return c.put('archivo-compartido', new Response(f, { headers: { 'X-Nombre': encodeURIComponent((f && f.name) || 'reporte.xlsx') } }));
      });
    }).then(function(){ return Response.redirect(new URL('rca.html?compartido=1', self.registration.scope).href, 303); }, function(){ return Response.redirect(new URL('rca.html', self.registration.scope).href, 303); }));
    return;
  }
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(function(c){
    return c.match(e.request, { ignoreSearch: true }).then(function(r){
      var red = fetch(e.request, { cache: 'no-cache' }).then(function(n){ if (n && n.ok) c.put(e.request, n.clone()); return n; }).catch(function(){ return r; });
      return r || red;
    });
  }));
});
