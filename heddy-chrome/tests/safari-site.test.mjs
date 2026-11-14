import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { read } from './helpers.mjs';

function event() {
  const listeners = new Set();
  return {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    emit: (...args) => Promise.all([...listeners].map((listener) => listener(...args))),
  };
}

const origin = 'https://aitutors.me';
const id = 'heddy';
const name = 'heddy-safari-request';

test('Safari relays a streaming request through the existing first-party tab', async () => {
  const calls = [];
  const onConnect = event();
  const tabs = {
    query: async () => [{ id: 7, status: 'complete' }],
    connect(tabId, options) {
      assert.equal(tabId, 7);
      assert.equal(options.frameId, 0);
      const background = { onMessage: event(), onDisconnect: event() };
      const page = { onMessage: event(), onDisconnect: event(), name: options.name, sender: { id } };
      background.postMessage = (data) => { void page.onMessage.emit(data); };
      page.postMessage = (data) => { void background.onMessage.emit(data); };
      background.disconnect = () => { void page.onDisconnect.emit(); };
      void onConnect.emit(page);
      return background;
    },
  };
  const content = read('content/safari-site.js');
  const context = {
    URL, Headers, AbortController, location: { origin },
    chrome: { runtime: { id, onConnect } },
    async fetch(path, init) {
      calls.push({ path, init });
      return new Response('{"type":"delta"}\n', { headers: { 'Content-Type': 'application/x-ndjson' } });
    },
  };
  const worker = { URL, ReadableStream, Response, Uint8Array };
  runInNewContext(read('lib/safari-site.js'), worker);
  const relay = worker.HeddySafariFetch.createSafariFetch({
    tabs,
    scripting: { executeScript: async () => runInNewContext(content, context) },
  });
  const reply = await relay(origin + '/api/learn/heddy/ask', {
    method: 'POST', headers: { 'X-Heddy-Id': id }, body: '{}',
  });
  assert.equal(await reply.text(), '{"type":"delta"}\n');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/learn/heddy/ask');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.headers.get('X-Heddy-Transport'), 'safari-site');
  assert.equal(calls[0].init.headers.has('X-Heddy-Id'), false);
});

test('the Safari relay refuses messages from content tabs and URLs outside its API list', async () => {
  const onConnect = event();
  const context = {
    URL, Headers, AbortController, location: { origin },
    chrome: { runtime: { id, onConnect } },
    fetch: () => assert.fail('The relay must not issue this request'),
  };
  runInNewContext(read('content/safari-site.js'), context);
  const replies = [];
  const port = (sender) => ({
    name, sender, onMessage: event(), onDisconnect: event(), postMessage: (reply) => replies.push(reply.type),
  });
  const contentTab = port({ id, tab: { id: 7 } });
  await onConnect.emit(contentTab);
  await contentTab.onMessage.emit({ href: origin + '/api/learn/heddy/save', method: 'POST' });
  assert.deepEqual(replies, []);

  for (const href of ['https://example.com/api/learn/heddy/save', origin + '/api/learn/heddy/other']) {
    const background = port({ id });
    await onConnect.emit(background);
    await background.onMessage.emit({ href, method: 'POST' });
  }
  assert.deepEqual(replies, ['got', 'error', 'got', 'error'], 'each is received, then refused');
});

test('a tab left open across an update still answers: a stale marker never stops the new listener, and a second injection keeps one', () => {
  const listeners = [];
  const onConnect = {
    addListener: (fn) => listeners.push(fn),
    removeListener: (fn) => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); },
  };
  // The old build's marker (0.9.x set `true`), its listener gone with it.
  const context = { URL, Headers, AbortController, location: { origin: 'https://aitutors.me' }, chrome: { runtime: { id: 'heddy', onConnect } }, __heddySafariFetch: true };
  context.globalThis = context;
  const content = read('content/safari-site.js');
  runInNewContext(content, context);
  assert.equal(listeners.length, 1, 'the new build listens despite the old marker');
  runInNewContext(content, context);
  assert.equal(listeners.length, 1, 'injected twice by one build: still one listener');
  assert.equal(typeof context.__heddySafariFetch, 'function');
});

test('a GET (who is signed in, the Jotters list) needs no listener in the tab: one script, one answer, no tabs.connect', async () => {
  const calls = [];
  const context = {
    URL, Headers, AbortController, location: { origin: 'https://aitutors.me' },
    chrome: { runtime: { id: 'heddy', onConnect: { addListener() {}, removeListener() {} } } },
    async fetch(path, init) {
      calls.push({ path, init });
      return new Response('{"signedIn":true,"role":"child"}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  };
  context.globalThis = context;
  const content = read('content/safari-site.js');
  const worker = { URL, ReadableStream, Response, Uint8Array, Headers };
  runInNewContext(read('lib/safari-site.js'), worker);
  const relay = worker.HeddySafariFetch.createSafariFetch({
    tabs: {
      query: async () => [{ id: 7, status: 'complete' }],
      connect() { throw new Error('tabs.connect must not be used for a one-piece request'); },
    },
    scripting: {
      executeScript: async (o) => {
        if (o.files) { runInNewContext(content, context); return [{}]; }
        context.__arg = o.args[0];
        return [{ result: await runInNewContext('(' + o.func.toString() + ')(__arg)', context) }];
      },
    },
  });
  const reply = await relay('https://aitutors.me/api/learn/heddy/me', { method: 'GET', headers: { 'X-Heddy-Id': 'heddy' } });
  assert.equal(reply.status, 200);
  assert.deepEqual(await reply.json(), { signedIn: true, role: 'child' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/learn/heddy/me');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.headers.has('X-Heddy-Id'), false);
  await assert.rejects(relay('https://aitutors.me/api/learn/heddy/nope', { method: 'GET' }), 'a path off the allowlist is refused');
});

test('Ask: a stream the tab refuses before receiving it goes once by the one-piece script; one it received is never sent again', async () => {
  const sent = [];
  const context = {
    URL, Headers, AbortController, location: { origin: 'https://aitutors.me' },
    chrome: { runtime: { id: 'heddy', onConnect: { addListener() {}, removeListener() {} } } },
    async fetch(path, init) { sent.push(path); return new Response('{"type":"done"}\n', { status: 200 }); },
  };
  context.globalThis = context;
  const content = read('content/safari-site.js');
  const worker = { URL, ReadableStream, Response, Uint8Array, Headers };
  runInNewContext(read('lib/safari-site.js'), worker);
  function relayWith(behaviour) {
    return worker.HeddySafariFetch.createSafariFetch({
      tabs: {
        query: async () => [{ id: 7, status: 'complete' }],
        connect() {
          const port = { onMessage: event(), onDisconnect: event(), postMessage() {}, disconnect() {} };
          port.postMessage = () => behaviour(port);
          return port;
        },
      },
      scripting: {
        executeScript: async (o) => {
          if (o.files) { runInNewContext(content, context); return [{}]; }
          context.__arg = o.args[0];
          return [{ result: await runInNewContext('(' + o.func.toString() + ')(__arg)', context) }];
        },
      },
    });
  }
  // Refused: no listener, the port drops at once.
  const refused = await relayWith((port) => { void port.onDisconnect.emit(); })('https://aitutors.me/api/learn/heddy/ask', { method: 'POST', body: '{}' });
  assert.equal(await refused.text(), '{"type":"done"}\n');
  assert.deepEqual(sent, ['/api/learn/heddy/ask'], 'sent once, by the script');
  // Received, then the tab went away: an error, never a second send.
  sent.length = 0;
  await assert.rejects(relayWith((port) => { void port.onMessage.emit({ type: 'got' }).then(() => port.onDisconnect.emit()); })('https://aitutors.me/api/learn/heddy/ask', { method: 'POST', body: '{}' }));
  assert.deepEqual(sent, [], 'not sent again');
});
