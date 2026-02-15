/* Service Worker: Chrome向けオフライン音声安定版 */

const CACHE_NAME = "my-art-partner-v3";

// 初回インストール時にプリキャッシュする最小限のアセット（必要に応じて追加）
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/logo.jpg",
];

// 画像・音声のフォールバック（画像はロゴ、音声は空レスポンス）
const IMAGE_FALLBACK = "/logo.jpg";

// キャッシュ可能な外部ドメインの識別子
const STORAGE_HOSTS = [
  "storage.googleapis.com",
  "storage.cloud.google.com",
];

// キャッシュ上限：エントリ数で管理（合計エントリがこの数を超えたら古いものから削除）
const MAX_CACHE_ENTRIES = 120;

// インストール時にアプリシェルをプリキャッシュ
self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] install");
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.addAll(CORE_ASSETS);
      } catch (err) {
        console.warn("[ServiceWorker] core assets cache failed:", err);
      }
    })()
  );
  self.skipWaiting();
});

// アクティベート時に古いキャッシュを削除
self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] activate");
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[ServiceWorker] deleting old cache", key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// ヘルパー: リクエストがストレージホストかどうか
function isStorageRequest(url) {
  try {
    return STORAGE_HOSTS.some((host) => url.includes(host));
  } catch (e) {
    return false;
  }
}

// キャッシュを所定の上限までトリムする（CORE_ASSETS は保護）
async function trimCache(cacheName, maxEntries, preserveList = []) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    const total = requests.length;
    if (total <= maxEntries) return;

    // 保護対象に一致しないエントリのみ削除候補とする
    const deletable = requests.filter((req) => {
      const u = req.url;
      return !preserveList.some((p) => u.endsWith(p) || u.includes(p));
    });

    const toDeleteCount = Math.max(0, total - maxEntries);
    if (deletable.length === 0) return;

    // 古い順（keys の順番）に削除
    for (let i = 0; i < toDeleteCount && i < deletable.length; i++) {
      await cache.delete(deletable[i]);
      console.log("[ServiceWorker] trimCache deleted", deletable[i].url);
    }
  } catch (err) {
    console.warn("[ServiceWorker] trimCache error", err);
  }
}

function isImageUrl(url) {
  return url.match(/\.(png|jpg|jpeg|gif|webp|avif)($|\?|#)/i);
}

function isAudioUrl(url) {
  return url.match(/\.(mp3|wav|m4a|ogg|webm)($|\?|#)/i);
}

function emptyAudioResponse() {
  return new Response("", { status: 200, headers: { "Content-Type": "audio/mpeg" } });
}

// フェッチ処理: ストレージ上の画像・音声はキャッシュファースト
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;

  if (!isStorageRequest(url)) {
    return; // それ以外のリクエストはブラウザに任せる
  }

  // このページ（レコメンド一覧）からのリクエストはキャッシュしない
  // referrer にページパスが入るため '/recommend' を含む場合はネットワーク優先で処理する
  const ref = request.referrer || '';
  const isFromRecommendations = ref.includes('/recommend');
  if (isFromRecommendations) {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        // ネットワークで得られたレスポンスがエラー系ならフォールバック
        if (!networkResponse || (networkResponse.status && networkResponse.status >= 400)) {
          if (isImageUrl(url)) return (await caches.match(IMAGE_FALLBACK)) || networkResponse;
          if (isAudioUrl(url)) return emptyAudioResponse();
          return networkResponse;
        }

        // 正常応答はそのまま返す（キャッシュはしない）
        return networkResponse;
      } catch (err) {
        console.warn('[ServiceWorker] network fetch failed for recommendations route, falling back to cache', url, err);
        const fallback = await caches.match(url, { ignoreVary: true });
        if (fallback) return fallback;
        if (isImageUrl(url)) return (await caches.match(IMAGE_FALLBACK)) || new Response('Offline', { status: 503 });
        if (isAudioUrl(url)) return emptyAudioResponse();
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      }
    })());
    return;
  }

  const isRange = request.headers.has("range"); // ★重要：audioがRangeを投げることがある

  event.respondWith(
    (async () => {
      // ★URL文字列でmatchして、Request差異（mode等）によるミスマッチを減らす
      let cached = await caches.match(url, { ignoreVary: true });

      // キャッシュにエラー応答(404など)が残っていると以降も返されるため、その場合は削除してネットワークへフォールバックする
      try {
        if (cached && typeof cached.status === 'number' && cached.status >= 400) {
          console.warn('[ServiceWorker] deleting error cached response', url, cached.status);
          const cacheForTrim = await caches.open(CACHE_NAME);
          await cacheForTrim.delete(url);
          cached = null;
        }
      } catch (e) {
        console.warn('[ServiceWorker] error while validating cached response', e);
      }

      // キャッシュヒット時の処理：Range リクエストなら可能なら部分応答(206)を返す
      if (cached) {
        try {
          if (isRange) {
            const rangeHeader = request.headers.get("range") || "";
            console.log("[ServiceWorker] cache hit (range):", url, rangeHeader);

            // opaque レスポンスは body にアクセスできないのでネットワークにフォールバック
            if (cached.type === "opaque") {
              try {
                return await fetch(request);
              } catch (e) {
                // ネットワーク失敗時はフルキャッシュを返してフォールバック
                return cached;
              }
            }

            // Range ヘッダを解析してキャッシュ済みの ArrayBuffer をスライスして 206 を返す
            const m = rangeHeader.match(/bytes=(\d+)-(\d*)/);
            if (m) {
              const start = parseInt(m[1], 10);
              const end = m[2] ? parseInt(m[2], 10) : undefined;
              const fullBuf = await cached.arrayBuffer();
              const fullSize = fullBuf.byteLength;
              const sliceEnd = typeof end === "number" ? Math.min(end, fullSize - 1) : fullSize - 1;
              const sliceStart = Math.min(start, fullSize - 1);
              if (sliceStart > sliceEnd) {
                return new Response(null, { status: 416, statusText: "Requested Range Not Satisfiable" });
              }

              const sliced = fullBuf.slice(sliceStart, sliceEnd + 1);
              const headers = new Headers();
              const ct = cached.headers && cached.headers.get && cached.headers.get("Content-Type");
              if (ct) headers.set("Content-Type", ct);
              headers.set("Content-Range", `bytes ${sliceStart}-${sliceEnd}/${fullSize}`);
              headers.set("Accept-Ranges", "bytes");
              headers.set("Content-Length", String(sliced.byteLength));

              return new Response(sliced, { status: 206, statusText: "Partial Content", headers });
            }

            // Range ヘッダが不正ならネットワークへフォールバックしてみる
            try {
              return await fetch(request);
            } catch (e) {
              return cached;
            }
          }

          console.log("[ServiceWorker] cache hit:", url);
          return cached;
        } catch (err) {
          console.warn("[ServiceWorker] cache handling error", err);
          // 何か失敗したら安全にネットワークを試す
          try {
            return await fetch(request);
          } catch (e) {
            return cached;
          }
        }
      }

      // キャッシュに無い場合はネットワークへ
      try {
        const networkResponse = await fetch(request);

        // 404など失敗はフォールバック
        if (!networkResponse || (networkResponse.status && networkResponse.status >= 400)) {
          console.warn("[ServiceWorker] network error status", networkResponse && networkResponse.status, url);
          if (isImageUrl(url)) return (await caches.match(IMAGE_FALLBACK)) || networkResponse;
          if (isAudioUrl(url)) return emptyAudioResponse();
          return networkResponse;
        }

        // ★Rangeリクエスト／206はキャッシュしない（途中だけ入って壊れるのを防ぐ）
        // - requestがRange付き OR responseが206 のときは保存しない
        if (!isRange && networkResponse.status !== 206) {
          const cache = await caches.open(CACHE_NAME);
          try {
            await cache.put(url, networkResponse.clone()); // URL文字列で保存
            await trimCache(CACHE_NAME, MAX_CACHE_ENTRIES, CORE_ASSETS);
            console.log("[ServiceWorker] cached:", url);
          } catch (err) {
            console.warn("[ServiceWorker] cache.put failed", err, url);
          }
        } else {
          console.log("[ServiceWorker] skip caching (range/206):", url);
        }

        return networkResponse;
      } catch (err) {
        console.warn("[ServiceWorker] fetch failed:", url, err);

        // ネットが完全に死んだ場合：キャッシュ再確認 → フォールバック
        const fallback = await caches.match(url, { ignoreVary: true });
        if (fallback) return fallback;

        if (isImageUrl(url)) return (await caches.match(IMAGE_FALLBACK)) || new Response("Offline", { status: 503 });
        if (isAudioUrl(url)) return emptyAudioResponse();

        return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
      }
    })()
  );
});

// メッセージ経由でプリキャッシュ要求を受け取る
self.addEventListener("message", (event) => {
  try {
    const data = event.data || {};
    if (data && data.type === "PRECACHE" && Array.isArray(data.urls)) {
      const urls = data.urls.filter(Boolean);
      if (urls.length === 0) return;

      console.log("[ServiceWorker] PRECACHE request received, urls:", urls.length);

      event.waitUntil(
        (async () => {
          const cache = await caches.open(CACHE_NAME);

          for (const url of urls) {
            try {
              // ★Range無しの通常取得で「フル」を入れることが目的
              // media(クロスオリジン)はno-corsになりがちなので、ここはno-corsでOK（opaqueでも保存できる）
              // ※CORSを整備できるなら mode:'cors' の方が望ましい
              const req = new Request(url, { mode: "no-cors", cache: "reload" });
              const resp = await fetch(req);

              // ok / opaque / status 0 を許容してキャッシュ
              if (resp && (resp.ok || resp.type === "opaque" || resp.status === 0) && resp.status !== 206) {
                await cache.put(url, resp.clone()); // ★URL文字列で保存（取り出しやすい）
                console.log("[ServiceWorker] precached", url);
              } else {
                console.warn("[ServiceWorker] precache bad response", url, resp && resp.status, resp && resp.type);
              }
            } catch (err) {
              console.warn("[ServiceWorker] precache fetch failed", url, err);
            }
          }

          await trimCache(CACHE_NAME, MAX_CACHE_ENTRIES, CORE_ASSETS);

          // クライアントに完了通知（任意）
          const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
          for (const c of clientsList) {
            try {
              c.postMessage({ type: "PRECACHE_DONE", urlsCount: urls.length });
            } catch (e) {}
          }
        })()
      );
    }

    // クライアントからのキャッシュ削除要求: 指定URLをキャッシュから削除する
    if (data && data.type === 'CLEAR_CACHE' && Array.isArray(data.urls)) {
      const urls = data.urls.filter(Boolean);
      if (urls.length === 0) return;
      console.log('[ServiceWorker] CLEAR_CACHE request received, urls:', urls.length);
      event.waitUntil((async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          const deletedUrls = [];
          for (const u of urls) {
            try {
              const deleted = await cache.delete(u);
              console.log('[ServiceWorker] cache.delete', u, deleted);
              if (deleted) deletedUrls.push(u);
            } catch (e) {
              console.warn('[ServiceWorker] cache.delete failed', u, e);
            }
          }

          // クライアントに削除完了を通知（再読み込みなどを促せるように）
          try {
            const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
            for (const c of clientsList) {
              try {
                c.postMessage({ type: 'CACHE_CLEARED', urls: deletedUrls });
              } catch (e) {}
            }
          } catch (e) {
            console.warn('[ServiceWorker] notify clients after CLEAR_CACHE failed', e);
          }

        } catch (e) {
          console.warn('[ServiceWorker] CLEAR_CACHE handling error', e);
        }
      })());
    }
  } catch (e) {
    console.warn("[ServiceWorker] message handler error", e);
  }
});
