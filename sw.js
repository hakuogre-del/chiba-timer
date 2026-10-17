/* 千葉 サーキットタイマー — オフライン用（10/17）
   CACHE の値はビルドのたびに中身から自動生成される。手で上げる必要はない。
   ページ（index・entry・callback）はネットを先に見て、つながらないときだけ保存した版を出す。 */
const CACHE  = 'chiba-timer-4fe1878eef';
const PAGES  = ['index.html', 'entry.html', 'callback.html'];
const ASSETS = [...PAGES, 'manifest.json', 'entry-manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const a of ASSETS) {
      const res = await fetch(a, { cache: 'reload' });
      if (!res || !res.ok) throw new Error('取得失敗: ' + a);   // 1つでも失敗したら古い版を残す
      await c.put(a, res);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    if (await c.match('index.html')) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    }
    await self.clients.claim();
  })());
});

/* URL → 保存名。フォルダの直下（…/chiba-timer/）は index.html */
function keyOf(url) {
  const base = new URL('./', self.registration.scope).pathname;
  let p = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
  if (p === '' || p.endsWith('/')) p = 'index.html';
  return p;
}
const offline = () => new Response(
  '<meta charset="utf-8"><body style="font:16px sans-serif;padding:2em;background:#080c10;color:#fff">' +
  'オフラインです。一度Wi-Fiにつないでから開き直してください。</body>',
  { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url; try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;          // Supabase・Spotify などは素通し
  const key = keyOf(url);
  if (key === 'sw.js') return;

  if (PAGES.includes(key) || req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 6000);
        const res = await fetch(req, { cache: 'no-cache', signal: ctl.signal });
        clearTimeout(t);
        if (res && res.ok && res.type === 'basic') {
          if (PAGES.includes(key)) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)).catch(() => {}); }
          return res;
        }
        throw new Error('bad response');
      } catch (err) {
        return (await caches.match(key, { ignoreSearch: true })) || offline();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const hit = await caches.match(key, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); } catch (err) { return offline(); }
  })());
});
