/**
 * Service Worker for caching ashreinu.app audio files
 */

const CACHE_NAME = 'ashreinu-audio-v1';

// Files to cache on install
const urlsToCache = [
  '/',
  '/index.html'
];

// Install event - cache basic files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache if available, otherwise fetch and cache
self.addEventListener('fetch', event => {
  // Check if request is for audio file
  if (event.request.url.endsWith('.opus')) {
    console.log('Service Worker: Fetching audio file', event.request.url);
    
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(response => {
          // Return cached version if available
          if (response) {
            console.log('Service Worker: Using cached audio');
            return response;
          }
          
          // Otherwise fetch from network and cache
          return fetch(event.request).then(networkResponse => {
            // Cache a copy of the response
            cache.put(event.request, networkResponse.clone());
            console.log('Service Worker: Caching new audio file');
            return networkResponse;
          });
        });
      })
    );
  } else {
    // For all other requests
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // Return cached response if available
          if (response) {
            return response;
          }
          
          // Otherwise fetch from network
          return fetch(event.request);
        })
    );
  }
});
