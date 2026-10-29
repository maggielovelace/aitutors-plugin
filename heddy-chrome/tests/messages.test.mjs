// Both catalogs carry the same keys, the English one carries no Chinese
// (PRD Must 9), and lib/messages.js is generated from them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, manifest } from './helpers.mjs';
import { renderMessages } from '../scripts/build-messages.mjs';

const en = JSON.parse(read('_locales/en/messages.json'));
const zh = JSON.parse(read('_locales/zh_CN/messages.json'));
const CJK = /[　-〿㐀-鿿豈-﫿＀-￯]/;

test('English and 简体中文 have the same keys and placeholders', () => {
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  for (const k of Object.keys(en)) {
    assert.deepEqual(Object.keys(zh[k].placeholders || {}), Object.keys(en[k].placeholders || {}), k);
    for (const name of Object.keys(en[k].placeholders || {})) {
      assert.match(zh[k].message, new RegExp(`\\$${name}\\$`, 'i'), `${k} in zh_CN uses $${name}$`);
    }
  }
});

test('the English strings are Chinese-free', () => {
  for (const [k, v] of Object.entries(en)) assert.doesNotMatch(v.message, CJK, k);
});

test('every __MSG_x__ in the manifest exists', () => {
  const keys = JSON.stringify(manifest()).match(/__MSG_(\w+)__/g).map((m) => m.slice(6, -2));
  for (const k of keys) {
    assert.ok(en[k], `en lacks ${k}`);
    assert.ok(zh[k], `zh_CN lacks ${k}`);
  }
  assert.ok(en.extDescription.message.length <= 132, 'the store description is at most 132 characters');
  assert.ok(zh.extDescription.message.length <= 132);
});

test('lib/messages.js is up to date (run: node scripts/build-messages.mjs)', () => {
  assert.equal(read('lib/messages.js'), renderMessages());
});

test('the lookup switches language and fills placeholders', async () => {
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  const I = req('../lib/i18n.js');
  assert.equal(I.t('en', 'fromTime', '1:52'), 'From 1:52');
  assert.equal(I.t('zh_CN', 'fromTime', '1:52'), '从 1:52 开始');
  assert.equal(I.t('zh_CN', 'noSuchKey'), 'noSuchKey');
  assert.equal(I.langForUi('zh-CN'), 'zh_CN');
  assert.equal(I.langForUi('en-GB'), 'en');
  assert.equal(await I.currentLang({ i18n: { getUILanguage: () => 'zh-CN' }, storage: { sync: { get: async () => ({}) } } }), 'zh_CN');
  assert.equal(await I.currentLang({ i18n: { getUILanguage: () => 'zh-CN' }, storage: { sync: { get: async () => ({ lang: 'en' }) } } }), 'en');
  assert.equal(await I.currentLang({ i18n: { getUILanguage: () => 'en-GB' }, storage: { sync: { get: async () => ({ lang: 'fr' }) } } }), 'en');
});
