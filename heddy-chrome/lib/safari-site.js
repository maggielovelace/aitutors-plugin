// A top-level aitutors.me tab supplies Safari's first-party session cookies.
(function (root) {
  function createSafariFetch(chrome) {
    const opening = new Map();

    function waitForTab(tabId, origin) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(reject, new Error('Heddy site tab did not load')), 8000);
        function finish(done, value) {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(updated);
          chrome.tabs.onRemoved.removeListener(removed);
          done(value);
        }
        function updated(id, change, tab) {
          if (id === tabId && tab.status === 'complete') {
            if (!tab.url || new URL(tab.url).origin !== origin) {
              finish(reject, new Error('Heddy site tab changed origin'));
            } else {
              finish(resolve, tabId);
            }
          }
        }
        function removed(id) {
          if (id === tabId) finish(reject, new Error('Heddy site tab was closed'));
        }
        chrome.tabs.onUpdated.addListener(updated);
        chrome.tabs.onRemoved.addListener(removed);
        chrome.tabs.get(tabId).then((tab) => updated(tabId, {}, tab), (error) => finish(reject, error));
      });
    }

    async function siteTab(origin) {
      const tabs = await chrome.tabs.query({ url: origin + '/*' });
      const ready = tabs.find((tab) => tab.id != null && tab.status === 'complete');
      if (ready) return ready.id;
      if (!opening.has(origin)) {
        const pending = (async () => {
          const loading = tabs.find((tab) => tab.id != null);
          const tab = loading || await chrome.tabs.create({ url: origin + '/heddy-chrome/welcome', active: false });
          if (tab.id == null) throw new Error('Heddy site tab unavailable');
          return waitForTab(tab.id, origin);
        })();
        opening.set(origin, pending);
      }
      const pending = opening.get(origin);
      try {
        return await pending;
      } finally {
        if (opening.get(origin) === pending) opening.delete(origin);
      }
    }

    // One request, answered whole by content/safari-site.js's __heddySiteRequest (the page's own first-party
    // fetch) as the script's result, so nothing has to stay listening in the tab. Safari dropped that file's
    // onConnect listener in a background tab while still accepting the injection ("Invalid call to
    // tabs.connect(). No runtime.onConnect listeners found", 2026-11-14): every /me and Jotters list failed,
    // so Heddy said "Sign in" and showed no Into line. A Response the callers read as they read fetch's.
    async function oneShot(tabId, href, init) {
      const headers = init.headers instanceof Headers ? [...init.headers] : init.headers;
      const ran = await chrome.scripting.executeScript({
        target: { tabId }, func: (req) => globalThis.__heddySiteRequest(req),
        args: [{ href, method: init.method || 'GET', headers: headers || {}, body: init.body == null ? undefined : init.body }],
      });
      const r = ran && ran[0] && ran[0].result;
      if (!r || r.error || typeof r.status !== 'number') throw new Error('Heddy site request failed');
      const empty = r.status === 204 || r.status === 205 || r.status === 304;
      return new Response(empty ? null : r.text, { status: r.status, headers: r.headers });
    }

    return async function safariFetch(href, init) {
      const url = new URL(href);
      if (!['https://aitutors.me', 'http://localhost:3000'].includes(url.origin)) {
        throw new Error('Heddy site origin is not allowed');
      }
      const tabId = await siteTab(url.origin);
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content/safari-site.js'] });
      init = init || {};
      if (init.signal && init.signal.aborted) throw new Error('Heddy request cancelled');
      // Everything but the Ask view's stream goes in one piece (a string body or none is all Heddy sends).
      if (!/\/ask$/.test(url.pathname) && (init.body == null || typeof init.body === 'string')) return oneShot(tabId, href, init);
      const signal = init.signal;
      if (signal && signal.aborted) throw new Error('Heddy request cancelled');
      const port = chrome.tabs.connect(tabId, { name: 'heddy-safari-request', frameId: 0 });

      return new Promise((resolve, reject) => {
        let stream;
        let closed = false;
        function close(error) {
          if (closed) return;
          closed = true;
          if (signal) signal.removeEventListener('abort', abort);
          if (stream) {
            if (error) stream.error(error);
            else stream.close();
          } else if (error) reject(error);
          try { port.disconnect(); } catch {}
        }
        function abort() { close(new Error('Heddy request cancelled')); }

        // Refused before the tab said anything (Safari: "No runtime.onConnect listeners found"): the tab never
        // had the request, so it goes once by the one-piece script instead, never twice.
        let heard = false;
        port.onDisconnect.addListener(() => {
          if (!heard && !closed && typeof init.body === 'string') {
            closed = true;
            if (signal) signal.removeEventListener('abort', abort);
            oneShot(tabId, href, init).then(resolve, reject);
            return;
          }
          close(new Error('Heddy site tab disconnected'));
        });
        port.onMessage.addListener((message) => {
          heard = true;
          try {
            if (message.type === 'response') {
              const body = message.hasBody ? new ReadableStream({
                start(controller) { stream = controller; },
                cancel() { stream = null; close(); },
              }) : null;
              resolve(new Response(body, { status: message.status, headers: message.headers }));
            } else if (message.type === 'chunk' && stream) {
              stream.enqueue(Uint8Array.from(message.bytes));
            } else if (message.type === 'end') {
              close();
            } else if (message.type === 'error') {
              close(new Error('Heddy site request failed'));
            }
          } catch (error) {
            close(error);
            reject(error);
          }
        });

        if (signal) signal.addEventListener('abort', abort, { once: true });
        try {
          port.postMessage({ href, method: init.method, headers: init.headers, body: init.body });
        } catch (error) {
          close(error);
        }
      });
    };
  }

  root.HeddySafariFetch = { createSafariFetch };
})(globalThis);
