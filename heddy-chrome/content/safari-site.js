// Runs only when Heddy's Safari background injects it into a first-party tab.
(function (root) {
  if (root.__heddySafariFetch) return;
  root.__heddySafariFetch = true;

  const sites = new Set(['https://aitutors.me', 'http://localhost:3000']);
  const routes = {
    GET: new Set(['me', 'jotters', 'desk/video', 'desk/transcript']),
    POST: new Set(['save', 'undo', 'clip', 'ask', 'card', 'jot', 'desk/jots', 'desk/keypoints', 'desk/quiz']),
  };
  const base = '/api/learn/heddy/';
  if (!sites.has(location.origin)) return;

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'heddy-safari-request' || port.sender?.id !== chrome.runtime.id || port.sender.tab) return;
    const controller = new AbortController();
    let started = false;
    port.onDisconnect.addListener(() => controller.abort());
    port.onMessage.addListener(async (request) => {
      if (started) return;
      started = true;
      try {
        const url = new URL(request.href);
        const allowed = request.method === 'GET' || request.method === 'POST' ? routes[request.method] : null;
        if (url.origin !== location.origin || !url.pathname.startsWith(base) || !allowed?.has(url.pathname.slice(base.length))) {
          port.postMessage({ type: 'error' });
          return;
        }
        const headers = new Headers(request.headers);
        headers.delete('X-Heddy-Id');
        headers.set('X-Heddy-Transport', 'safari-site');
        const response = await fetch(url.pathname + url.search, {
          method: request.method,
          body: request.body,
          headers,
          credentials: 'same-origin',
          cache: 'no-store',
          redirect: 'error',
          signal: controller.signal,
        });
        port.postMessage({
          type: 'response',
          status: response.status,
          headers: [...response.headers],
          hasBody: !!response.body,
        });
        if (response.body) {
          const reader = response.body.getReader();
          try {
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              for (let offset = 0; offset < value.length; offset += 16384) {
                port.postMessage({ type: 'chunk', bytes: Array.from(value.subarray(offset, offset + 16384)) });
              }
            }
          } finally {
            reader.releaseLock();
          }
        }
        port.postMessage({ type: 'end' });
      } catch (error) {
        controller.abort();
        try { port.postMessage({ type: 'error' }); } catch (disconnected) { /* tab closed */ }
      }
    });
  });
})(globalThis);
