/* 성민의 작업일지 — 서비스 워커
   - 앱 셸(HTML·SDK·폰트·아이콘)을 캐시해 오프라인에서도 앱이 켜지게 함
   - Supabase API/스토리지 요청은 캐시하지 않고 항상 네트워크 사용
   캐시 버전을 올리면(예: v2) 이전 캐시는 자동 정리됨 */
const CACHE = "worklog-v9";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./logo.png",
  "./logo-dark.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // 쓰기 요청은 그대로 통과
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Supabase(데이터·인증·이미지)는 항상 네트워크 — 캐시하지 않음
  if (url.hostname.endsWith("supabase.co")) return;

  // 문서 요청(앱 진입): 네트워크 우선, 실패 시 캐시된 앱 셸
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // 정적 자원(스크립트·폰트·아이콘): 캐시 우선 + 백그라운드 갱신
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
