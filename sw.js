/* ─────────────────────────────────────────
   定期巡回計算 Service Worker
   Cache First + Stale-While-Revalidate
   GitHub Pages: https://tamamasa2916-sudo.github.io/teijyun.v2/
   ───────────────────────────────────────── */

var CACHE_NAME = 'teiki-v4';
var BASE = '/teijyun.v2';

/* ── インストール：必須リソースを事前キャッシュ ── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      var essential = [
        BASE + '/',
        BASE + '/index.html',
        BASE + '/manifest.json',
        BASE + '/icons/icon-192.png',
        BASE + '/icons/icon-512.png',
        BASE + '/icons/splash/splash-iphone14pro.png',
        BASE + '/icons/splash/splash-iphone14pm.png',
        BASE + '/icons/splash/splash-iphone14.png',
        BASE + '/icons/splash/splash-iphone13pm.png',
        BASE + '/icons/splash/splash-iphone12m.png',
        BASE + '/icons/splash/splash-iphonex.png',
        BASE + '/icons/splash/splash-iphonexr.png',
        BASE + '/icons/splash/splash-iphone8.png',
        BASE + '/icons/splash/splash-ipadpro13.png',
        BASE + '/icons/splash/splash-ipadpro11.png',
        BASE + '/icons/splash/splash-ipad.png'
      ];
      var optional = [
        'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap',
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      ];
      return cache.addAll(essential).then(function() {
        return Promise.all(optional.map(function(url) {
          return cache.add(url).catch(function() {
            console.warn('[SW] optional cache miss:', url);
          });
        }));
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── アクティベート：古いキャッシュを削除 ── */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── フェッチ：Cache First / Stale-While-Revalidate ── */
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  /* /teijyun.v2/ へのアクセスは index.html として処理（iOS ホーム画面起動対応） */
  var url = new URL(e.request.url);
  if (url.pathname === '/teijyun.v2/' || url.pathname === '/teijyun.v2') {
    e.respondWith(caches.match(BASE + '/index.html').then(function(cached) {
      return cached || fetch(BASE + '/index.html');
    }));
    return;
  }

  if (e.request.url.includes('fonts.googleapis.com') ||
      e.request.url.includes('fonts.gstatic.com')) {
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }

  if (e.request.url.includes('cdnjs.cloudflare.com')) {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  e.respondWith(staleWhileRevalidate(e.request));
});

/* ── キャッシュ優先 ── */
function cacheFirst(request) {
  return caches.match(request).then(function(cached) {
    if (cached) return cached;
    return fetch(request).then(function(response) {
      if (response && response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
      }
      return response;
    }).catch(function() {
      return new Response('', { status: 503, statusText: 'Service Unavailable' });
    });
  });
}

/* ── Stale-While-Revalidate ── */
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then(function(cache) {
    return cache.match(request).then(function(cached) {
      var fetchPromise = fetch(request).then(function(response) {
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(function() { return null; });
      return cached || fetchPromise;
    });
  });
}

/* ── skipWaiting メッセージ受信 ── */
self.addEventListener('message', function(e) {
  if (e.data && e.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
