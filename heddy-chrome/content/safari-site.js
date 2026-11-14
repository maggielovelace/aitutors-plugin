// Runs only when Heddy's Safari background injects it into a first-party tab.
(function (root) {
  // A tab left open across an update keeps the old build's marker while the old listener is dead with it
  // (2026-11-14: Heddy showed "Sign in" on a signed-in aitutors.me tab). So each injection replaces the
  // listener it finds rather than stopping at it; within one build the second injection is a no-op swap.
  const old = root.__heddySafariFetch;

  const sites = new Set(['https://aitutors.me', 'http://localhost:3000']);
  const routes = {
    GET: new Set(['me', 'jotters', 'desk/video', 'desk/transcript', 'recent-jots', 'cards-due']),
    POST: new Set(['save', 'undo', 'clip', 'ask', 'card', 'jot', 'desk/jots', 'desk/keypoints', 'desk/quiz']),
  };
  const base = '/api/learn/heddy/';
  if (!sites.has(location.origin)) return;

  if (typeof old === 'function') { try { chrome.runtime.onConnect.removeListener(old); } catch {} }

  /** One request in one piece, for lib/safari-site.js's one-shot scripts: needs no listener to stay alive. */
  root.__heddySiteRequest = async (request) => {
    try {
      const url = new URL(request.href);
      const allowed = request.method === 'GET' || request.method === 'POST' ? routes[request.method] : null;
      if (url.origin !== location.origin || !url.pathname.startsWith(base) || !allowed?.has(url.pathname.slice(base.length))) return { error: true };
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
      });
      return { status: response.status, headers: [...response.headers], text: await response.text() };
    } catch (error) {
      return { error: true };
    }
  };
  const onConnect = (port) => {
    if (port.name !== 'heddy-safari-request' || port.sender?.id !== chrome.runtime.id || port.sender.tab) return;
    const controller = new AbortController();
    let started = false;
    port.onDisconnect.addListener(() => controller.abort());
    port.onMessage.addListener(async (request) => {
      if (started) return;
      started = true;
      // Received: from here a disconnect is never a reason to send it again (lib/safari-site.js).
      port.postMessage({ type: 'got' });
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
  };
  root.__heddySafariFetch = onConnect;
  chrome.runtime.onConnect.addListener(onConnect);
})(globalThis);
