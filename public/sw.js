const CACHE_NAME = 'feitsui-water-map-v9';
const CACHE_PREFIX = 'feitsui-water-map-';
const scope = self.registration.scope;
const MACHINERY_DATA = [
  'data/storm-rainfall-rented-machinery-sites/records.json',
  'data/storm-rainfall-rented-machinery-sites/sites.geojson',
];
const STATIC_ASSETS = [
  '',
  'manifest.webmanifest',
  'THIRD_PARTY_NOTICES.txt',
  'runtime-license-inventory.json',
  'data/water-quality-records.json',
  'data/water-quality-summary.json',
  'data/water-quality-station-series.json',
  'data/water-quality-parameter-series.json',
  'data/station-locations.json',
  'data/hydromet-daily-records.json',
  'data/hydromet-monthly-summary.json',
  'data/hydromet-parameter-series.json',
  'data/operation-daily-records.json',
  'data/operation-monthly-summary.json',
  'data/operation-parameter-series.json',
  'data/feitsui-reservoir-operation-monthly-reports/records.json',
  'data/feitsui-reservoir-operation-monthly-reports/summary.json',
  'data/feitsui-reservoir-operation-monthly-reports/monthly-summary.json',
  'data/feitsui-reservoir-operation-monthly-reports/yearly-summary.json',
  'data/river-water-quality-records.json',
  'data/river-water-quality-summary.json',
  'data/river-ecology/records.json',
  'data/river-ecology/summary.json',
  'data/river-ecology/sites.json',
  'data/river-ecology/metadata.json',
  'data/amphibian-ecology/records.json',
  'data/amphibian-ecology/summary.json',
  'data/amphibian-ecology/sites.json',
  'data/amphibian-ecology/metadata.json',
  'data/butterfly-ecology/records.json',
  'data/butterfly-ecology/summary.json',
  'data/butterfly-ecology/sites.json',
  'data/butterfly-ecology/metadata.json',
  'data/dragonfly-ecology/records.json',
  'data/dragonfly-ecology/summary.json',
  'data/dragonfly-ecology/sites.json',
  'data/dragonfly-ecology/metadata.json',
  'data/water-dashboard-summary.json',
  'data/river-station-locations.json',
  'data/pumping-stations.json',
  'data/pumping-station-summary.json',
  'data/pumping-station-conversion-report.json',
  'data/sedimentation-basin-facilities.json',
  'data/sedimentation-basin-facility-summary.json',
  'data/sedimentation-basin-facility-conversion-report.json',
  'data/storm-rainfall-rented-machinery-sites/metadata.json',
  'data/reservoir-sedimentation-surveys/records.json',
  'data/reservoir-sedimentation-surveys/summary.json',
  'data/reservoir-sedimentation-surveys/conversion-report.json',
  'data/taipei-water-support-twc-monthly-records.json',
  'data/taipei-water-support-twc-summary.json',
  'data/taipei-water-support-twc-annual-summary.json',
  'data/park-water-safety-equipment-records.json',
  'data/park-water-safety-equipment-summary.json',
  'data/tap-water-treatment-plant-clear-water-quality-records.json',
  'data/tap-water-treatment-plant-clear-water-quality-summary.json',
  'data/tap-water-treatment-plant-clear-water-quality-latest.json',
  'data/tap-water-business-key-metrics.json',
  'data/tap-water-business-key-metric-summary.json',
  'data/tap-water-business-key-metric-latest.json',
  'data/carlson-trophic-state-index.json',
  'data/carlson-trophic-state-index-summary.json',
  'data/carlson-trophic-state-index-latest.json',
  'data/feitsui-water-summary.json',
  'data/conversion-report.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all([
      cache.addAll(STATIC_ASSETS.map((asset) => new URL(asset, scope))).catch(() => undefined),
      // Replace the two legacy copies even when the browser HTTP cache is still fresh.
      cache.addAll(MACHINERY_DATA.map((asset) => new Request(new URL(asset, scope), { cache: 'reload' }))),
    ]))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // One cohesive decision snapshot: refresh before cache, retain its visible version offline.
  // Do not serve an old cache-first snapshot after a source/algorithm version changes.
  if (new URL(event.request.url).pathname.endsWith('/data/preparedness-decision/snapshot.json')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Decision snapshot unavailable');
      const snapshot = await response.clone().json();
      if (snapshot.schemaVersion !== '1.0.0' || snapshot.methodologyVersion !== 'heavy-rain-preparedness-review-v1' || !/^sha256-[a-f0-9]{16}$/.test(snapshot.snapshotVersion)) throw new Error('Unsupported decision snapshot');
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, response.clone());
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      return cached || new Response('Decision snapshot unavailable', { status: 503 });
    }));
    return;
  }
  const requestUrl = new URL(event.request.url);
  const assetBase = new URL('assets/', scope);
  // CORS module requests can carry Origin where install-time requests do not.
  // Hashed same-origin build assets are identical across Origin headers.
  const builtAsset = requestUrl.origin === assetBase.origin && requestUrl.pathname.startsWith(assetBase.pathname) && /\.(js|css)$/.test(requestUrl.pathname);
  event.respondWith(
    caches.match(event.request, builtAsset ? { ignoreVary: true } : undefined).then((cached) => cached || fetch(event.request))
  );
});
