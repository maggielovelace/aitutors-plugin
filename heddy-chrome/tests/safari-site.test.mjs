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
  assert.deepEqual(replies, ['error', 'error']);
});
