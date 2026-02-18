self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Let all requests pass through normally
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      // Network error - return a basic response
      return new Response("Network error", {
        status: 503,
        statusText: "Service Unavailable",
      });
    }),
  );
});
