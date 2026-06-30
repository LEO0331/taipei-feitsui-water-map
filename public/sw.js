const CACHE_NAME = 'feitsui-water-map-v2';
const scope = self.registration.scope;
const STATIC_ASSETS = [
  '',
  'manifest.webmanifest',
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
  'data/river-water-quality-records.json',
  'data/river-water-quality-summary.json',
  'data/water-dashboard-summary.json',
  'data/river-station-locations.json',
  'data/pumping-stations.json',
  'data/pumping-station-summary.json',
  'data/pumping-station-conversion-report.json',
  'data/taipei-water-support-twc-monthly-records.json',
  'data/taipei-water-support-twc-summary.json',
  'data/taipei-water-support-twc-annual-summary.json',
  'data/park-water-safety-equipment-records.json',
  'data/park-water-safety-equipment-summary.json',
  'data/conversion-report.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS.map((asset) => new URL(asset, scope))).catch(() => undefined))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
