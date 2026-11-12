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

    return async function safariFetch(href, init) {
      const url = new URL(href);
      if (!['https://aitutors.me', 'http://localhost:3000'].includes(url.origin)) {
        throw new Error('Heddy site origin is not allowed');
      }
      const tabId = await siteTab(url.origin);
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content/safari-site.js'] });
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

        port.onDisconnect.addListener(() => close(new Error('Heddy site tab disconnected')));
        port.onMessage.addListener((message) => {
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
