// The desk speaks Classroom's words (PRD-v0.96.0 D70, D73; the Round 8
// contract's "Strings"): the tab names, the foot, the Jot card, the composer,
// the Digest's views and lines are Classroom's catalog, aitutors.me's
// messages/{en-GB,zh-Hans}/videos.json → classroom.*.
//
// The vendored copy is this plugin's own _locales (en ↔ en-GB, zh_CN ↔
// zh-Hans): the public repo cannot import the private site. This test reads the
// site's catalog from a checkout of aitutors.me — $HEDDY_SITE_REPO, else
// ~/AI/AI_Coding/Repositories/aitutors — and fails if a pinned string drifted;
// with no checkout there (CI, a fork) it is skipped, and says so. To resync,
// copy the site's string into both _locales files, {name} written $NAME$,
// then run node scripts/build-messages.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { load, read } from './helpers.mjs';

const SITE = process.env.HEDDY_SITE_REPO || join(homedir(), 'AI', 'AI_Coding', 'Repositories', 'aitutors');
const file = (locale) => join(SITE, 'messages', locale, 'videos.json');
const present = existsSync(file('en-GB')) && existsSync(file('zh-Hans'));
const skip = present ? false : `no aitutors.me catalog at ${file('en-GB')} (set HEDDY_SITE_REPO to a checkout of main)`;

// plugin key → the path under classroom.*; `fix` turns the site's string into
// the desk's where the desk differs on purpose (H, not J: YouTube keeps J).
// Not pinned, on purpose: digestZhFailed. Classroom's "try again tomorrow"
// is its 24 h window; the desk's stretch is retried after 10 minutes (Round
// 11, site PR #1192), so the desk says "in a few minutes" (owner's words).
const PINS = [
  ['deskTabQuiz', 'tabs.quiz'],
  ['deskTabJot', 'tabs.jot'],
  ['deskTabDigest', 'tabs.digest'],
  ['deskTabInsights', 'tabs.overview'],
  ['deskFoot', 'desk.foot'],
  ['deskTaller', 'desk.taller'],
  ['deskShorter', 'desk.shorter'],
  ['deskJkBtn', 'jot.jkBtn'],
  ['deskJkSub', 'jot.jkSub', (s) => s.replace(/\bJ\b/g, 'H')],
  ['deskJotPlaceholder', 'jot.placeholder'],
  ['deskJotButton', 'jot.button'],
  ['deskJotDelete', 'jot.delete'],
  ['deskJotReplay', 'jot.replay'],
  ['deskAsk', 'digest.actions.ask'],
  ['digestViewEn', 'digest.views.en'],
  ['digestViewBi', 'digest.views.bi'],
  ['digestViewZh', 'digest.views.zh'],
  ['digestViewsLabel', 'digest.viewsLabel'],
  ['digestSearch', 'digest.search'],
  ['digestSearchLabel', 'digest.searchLabel'],
  ['digestNoMatches', 'digest.noMatches'],
  ['digestTranscript', 'digest.transcript'],
  ['digestReading', 'digest.reading'],
  ['digestReadingZh', 'digest.readingZh'],
  ['digestFailed', 'digest.failed'],
  ['digestTryAgain', 'digest.tryAgain'],
  ['digestLockedTitle', 'digest.locked.title'],
  ['digestSeek', 'digest.seek'],
  // Pi's tray (Round 11): Classroom's DigestTray / DigestTrayMore words.
  ['digestActionsLabel', 'digest.actionsLabel'],
  ['digestActJot', 'digest.actions.jot'],
  ['digestActExplain', 'digest.actions.explain'],
  ['digestActCard', 'digest.actions.card'],
  ['digestMoreOpen', 'digest.more.open'],
  ['digestMoreLabel', 'digest.more.label'],
  ['digestMorePlay', 'digest.more.play'],
  ['digestMoreCopy', 'digest.more.copy'],
  ['digestMoreCopied', 'digest.more.copied'],
  ['digestMoreCopyFailed', 'digest.more.copyFailed'],
  // The parity audit (Round 11): the jot pop-up, search, the fine line,
  // Jump to now, the insights card and Add to my Jots.
  ['deskNoteSaved', 'jot.noteSaved'],
  ['deskJotUndo', 'jot.undo'],
  ['deskJotDeleted', 'jot.deleted'],
  ['deskOpenInJotter', 'jot.openInJotter'],
  ['digestMatchesOne', 'digest.matches.one'],
  ['digestMatchesMany', 'digest.matches.other'],
  ['digestOnlyChannel', 'digest.onlyChannel'],
  ['digestOnlyChannelHide', 'digest.onlyChannelHide'],
  ['digestJumpNow', 'digest.jumpNow'],
  ['overviewOpenLink', 'overview.openLink'],
  ['overviewUnfold', 'overview.unfold'],
  ['overviewFold', 'overview.fold'],
  ['insightsAdd', 'insights.add'],
  ['insightsAdded', 'insights.added'],
  // Round 11b: chapters, the locked block (D92), Write notes.
  ['digestMoreChapter', 'digest.more.chapter'],
  ['digestSelectChapter', 'digest.selectChapter'],
  ['digestLockedCta', 'digest.locked.cta'],
  ['digestKeepWatching', 'digest.locked.keepWatching'],
  ['insightsWritingFine', 'overview.writingFine'],
  ['insightsNoTranscript', 'insights.noTranscript'],
  ['overviewWriteNotes', 'overview.writeNotes'],
  ['insightsLocked', 'insights.locked'],
  ['askEmpty', 'room.empty'],
  ['askPhShort', 'room.placeholder'],
  ['insightsHead', 'digest.overview'],
  ['insightsBand', 'insights.band'],
  ['insightsWriting', 'insights.writing'],
  ['insightsFailed', 'insights.failed'],
];

const LOCALES = [['en', 'en-GB'], ['zh_CN', 'zh-Hans']];
const ours = Object.fromEntries(LOCALES.map(([l]) => [l, JSON.parse(read(`_locales/${l}/messages.json`))]));

/** The site's {name} placeholders, written as chrome.i18n's $NAME$. */
const asChrome = (s) => s.replace(/\{(\w+)\}/g, (_, n) => `$${n.toUpperCase()}$`);
const at = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

test('every pinned key exists in both of Heddy’s languages', () => {
  for (const [key] of PINS) for (const [l] of LOCALES) assert.ok(ours[l][key], `${l} lacks ${key}`);
});

for (const [lang, locale] of LOCALES) {
  test(`the desk’s ${lang} words equal Classroom’s ${locale} catalog`, { skip }, () => {
    const site = JSON.parse(readFileSync(file(locale), 'utf8')).classroom;
    for (const [key, path, fix] of PINS) {
      const theirs = at(site, path);
      assert.equal(typeof theirs, 'string', `classroom.${path} is gone from ${locale}`);
      assert.equal(ours[lang][key].message, asChrome(fix ? fix(theirs) : theirs), `${key} ↔ classroom.${path} (${locale})`);
    }
  });
}

test('the Digest’s starting view is Classroom’s defaultView in each language (D73)', { skip }, () => {
  const D = load('./lib/desk-model.js');
  for (const [lang, locale] of LOCALES) {
    const site = JSON.parse(readFileSync(file(locale), 'utf8')).classroom;
    assert.equal(D.defaultView(lang), site.digest.defaultView, locale);
  }
});
