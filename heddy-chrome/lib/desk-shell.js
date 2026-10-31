// lib/desk-shell.js — the desk's look, shared by both desks (PRD-v0.96.0
// § 1h D69–D70, § 1i D79): the YouTube desk (content/desk.js, in a closed
// shadow root in YouTube's page) and the web desk (popup/web-desk.js, in the
// panel's frame). The CSS values are the artifact's
// (round-8-youtube-desk.html), which are Classroom's clip-desk.css,
// clip-jot.css and clip-digest.css; the icons are Classroom's ClipIcons.
// Constant strings only: nothing here reads a page or the network.
(function (root) {
  var M = root.HeddyMarks;
  var SANS = (root.HeddyFonts && root.HeddyFonts.SANS) || 'Manrope,Roboto,Arial,sans-serif';

  // The professor's colours until the site names them: Mentor's, the same
  // pair the Ask view uses (lib/desk-ask.js MENTOR; Round 11, one Mentor).
  var SC = '#0d7565';
  var SC_SOFT = '#dcf1ec';

  // Classroom's ClipIcons (the artifact's IC, from components/videos/ClipIcons.tsx).
  var IC = {
    quiz: '<circle cx="12" cy="12" r="8.5" stroke-width="2.1"/><circle cx="12" cy="12" r="4.6" stroke-width="2.1"/><circle class="s" cx="12" cy="12" r="1.6"/>',
    jot: '<path class="f" d="M19.5 4.5c-6 .5-10.5 4-12.5 10l-1.5 5 5-1.5c6-2 9-7 9-13.5z"/><path d="M19.5 4.5c-6 .5-10.5 4-12.5 10l-1.5 5 5-1.5c6-2 9-7 9-13.5z"/><path d="M5.5 19.5 14 11"/><circle class="s" cx="15.4" cy="9.2" r="1.1"/>',
    digest: '<rect class="f" x="3.5" y="5" width="17" height="14" rx="3"/><rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M7 10.3h4.5M13.5 10.3h3.5"/><rect class="s" x="7" y="13.4" width="10" height="2.4" rx="1.2"/>',
    insights: '<path class="f" d="M3 15s3.4-5.5 9-5.5 9 5.5 9 5.5-3.4 5.5-9 5.5S3 15 3 15z"/><path d="M3 15s3.4-5.5 9-5.5 9 5.5 9 5.5-3.4 5.5-9 5.5S3 15 3 15z"/><circle cx="12" cy="15" r="2.4"/><path class="s" d="M12 2.2l.95 2.15 2.15.95-2.15.95L12 8.4l-.95-2.15L8.9 5.3l2.15-.95z"/>',
    desk: '<path d="M3.5 15h17M6.5 15v5M17.5 15v5"/><path class="f" d="M9.5 11.5h7l-1.6-4.5h-3.8z"/><path d="M9.5 11.5h7l-1.6-4.5h-3.8z"/><path d="M13 11.5V15"/><circle class="s" cx="13" cy="13.3" r="1.1"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    out: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    play: '<path class="f" d="M7 4.8c0-1.2 1.3-1.9 2.3-1.3l10 6.2c1 .6 1 2 0 2.6l-10 6.2c-1 .6-2.3-.1-2.3-1.3z"/><path d="M7 4.8c0-1.2 1.3-1.9 2.3-1.3l10 6.2c1 .6 1 2 0 2.6l-10 6.2c-1 .6-2.3-.1-2.3-1.3z"/>',
    arrow: '<path d="M5 12h13M13 6.5 18.5 12 13 17.5" stroke-width="1.8"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" stroke-width="2"/>',
    down: '<path d="M6.5 9.5 12 15l5.5-5.5" stroke-width="2"/>',
    tick: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.1"/>',
  };
  function ic(n) {
    return '<svg class="vi" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + IC[n] + '</svg>';
  }
  var EYES = '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' + M.SYMBOLS['h-eyes'].body + '</svg>';

  var SERIF = (root.HeddyFonts && root.HeddyFonts.SERIF) || '"Source Serif 4",Georgia,"Times New Roman",serif';
  var MONO = (root.HeddyFonts && root.HeddyFonts.MONO) || '"JetBrains Mono",ui-monospace,Menlo,monospace';
  var ZH_SANS = '"PingFang SC","Noto Sans SC",' + SANS;

  var CSS = [
    ':host{all:initial;display:block;box-sizing:border-box;margin:0 0 8px;z-index:2}',
    // The column's own width, never wider (the owner's window cut the header
    // and the tabs off): at most the artifact's 410 px. The tabs fit narrower
    // columns by the container rules below.
    ':host(.column){position:sticky;top:var(--heddy-top,68px);width:100%;max-width:410px;min-width:0}',
    ':host{container-type:inline-size}',
    ':host(.below){width:100%;margin:12px 0}',
    '*{box-sizing:border-box}',
    'button{all:unset;box-sizing:border-box;cursor:pointer}',
    'button:focus-visible,input:focus-visible{outline:2px solid var(--sc);outline-offset:2px}',
    '.cd{--surface:#fdfcf8;--sunk:#efe9dd;--ink:#14253f;--muted:#6c7888;--line:#e2ddd1;--line-strong:#cfd6df;--ink-deep:#002147;--ink-soft:#4b5b73;--bad:#b4232c;--sc:' + SC + ';--sc-soft:' + SC_SOFT + ';--bgc:#f6f2ea;',
    '  background:var(--surface);color:var(--ink);display:flex;flex-direction:column;border:1px solid var(--line);border-radius:16px;overflow:hidden;font:500 13.5px/1.45 ' + SANS + ';-webkit-font-smoothing:antialiased;color-scheme:light}',
    '.cd[lang="zh-Hans"]{font-family:' + ZH_SANS + '}',
    '.cd[lang="zh-Hans"] .tab,.cd[lang="zh-Hans"] .hd b{font-family:' + ZH_SANS + '}',
    '.vi{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none;display:block}',
    '.vi .f{fill:color-mix(in srgb,currentColor 18%,transparent);stroke:none}.vi .s{fill:var(--muted);stroke:none}',
    '.eyes{width:24px;height:24px;border-radius:7px;overflow:hidden;display:block;flex:none}.eyes svg{width:100%;height:100%;display:block}',
    // the header
    '.hd{height:46px;display:flex;align-items:center;gap:9px;padding:0 14px;border-bottom:1px solid var(--line);flex:none;min-width:0}',
    '.hd b{font:800 14px ' + SANS + ';color:var(--ink-deep);white-space:nowrap}',
    '.hd small{font:600 12px ' + SANS + ';color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
    '.lg2{display:inline-flex;padding:2px;gap:2px;border:1px solid var(--line);border-radius:999px;background:var(--sunk);margin-left:auto;flex:none}',
    '.lg2 button{padding:2px 9px;border-radius:999px;font:700 11.5px/1.4 ' + SANS + ';color:var(--muted)}',
    '.lg2 button[aria-pressed="true"]{background:var(--surface);color:var(--ink-deep);box-shadow:0 1px 0 var(--line)}',
    '.x{margin-left:10px;display:flex;gap:12px;color:var(--muted);font:600 15px ' + SANS + ';flex:none;align-items:center}',
    '.x button{line-height:1}',
    // 📌 as the artifact draws it; on (open on every video), a pressed pill.
    '.pin{border-radius:6px;padding:2px 3px;margin:-2px -3px}',
    '.pin[aria-pressed="true"]{background:var(--sunk);box-shadow:inset 0 0 0 1px var(--line)}',
    // the video row
    '.vr{display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);align-items:center;flex:none}',
    '.vr .th{width:64px;height:36px;border-radius:6px;background:linear-gradient(135deg,#27405f,#0d1b2c);flex:none;overflow:hidden;display:block}',
    '.vr .th img{width:100%;height:100%;object-fit:cover;display:block}',
    '.vr > div{min-width:0}',
    '.vr b{display:block;font:700 13px/1.3 ' + SANS + ';color:var(--ink-deep);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.vr small{display:block;font:600 11px ' + MONO + ';color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.full{margin-left:auto;flex:none;height:30px;border-radius:999px;border:1px solid var(--line-strong);background:#fff;color:var(--ink-deep);font:700 12px ' + SANS + ';display:flex;align-items:center;gap:6px;padding:0 11px;white-space:nowrap}',
    '.full .vi{width:14px;height:14px}',
    '.full[aria-busy="true"]{opacity:.6;cursor:progress}',
    // the tab row (clip-desk.css)
    '.tabs{position:relative;height:48px;display:flex;align-items:stretch;gap:2px;padding:0 12px;border-bottom:1px solid var(--line);flex:none}',
    '.tab{position:relative;display:inline-flex;align-items:center;gap:6px;padding:0 7px;font:700 14px/1 ' + SANS + ';color:var(--muted);white-space:nowrap}',
    '.tab[aria-selected="true"]{color:var(--ink-deep)}',
    // ONE pill (clip-desk.css .cp-desk__ind), placed from the selected tab's
    // box and slid 200 ms; until it is placed the selected tab draws it.
    '.ind{position:absolute;left:0;width:0;bottom:7px;height:34px;border-radius:10px;background:color-mix(in srgb,var(--sc) 12%,transparent);box-shadow:inset 0 -2px 0 var(--sc);pointer-events:none}',
    '.tabs:not([data-ind]) .tab[aria-selected="true"]::before{content:"";position:absolute;inset:auto 0 7px;height:34px;z-index:0;border-radius:10px;background:color-mix(in srgb,var(--sc) 12%,transparent);box-shadow:inset 0 -2px 0 var(--sc)}',
    '.tab > *{position:relative}',
    '.tab[aria-selected="true"] .vi .f{fill:color-mix(in srgb,var(--sc) 24%,transparent)}.tab[aria-selected="true"] .vi .s{fill:var(--sc)}',
    '.tab small{font:600 10.5px/1.4 ' + MONO + ';background:var(--sunk);border-radius:999px;padding:1px 6px;color:var(--muted)}',
    // A tab with nothing behind it yet (Quiz until 8b, D77): drawn disabled, never selected.
    '.tab[aria-disabled="true"]{cursor:default;color:color-mix(in srgb,var(--muted) 55%,transparent)}',
    '.tab[aria-disabled="true"] .vi .s{fill:color-mix(in srgb,var(--muted) 55%,transparent)}',
    // The crest (clip-desk.css .cp-desk__crest): 24 px in a 32 px hit area, a
    // 3 px --sc 30% ring and a 1 px lift on hover and focus.
    '.crest{margin-left:auto;align-self:center;width:32px;height:32px;display:grid;place-items:center;flex:none;border-radius:50%}',
    '.crest .eyes{border-radius:50%;transition:box-shadow .2s ease,transform .2s ease}',
    '.crest:hover .eyes,.crest:focus-visible .eyes{box-shadow:0 0 0 3px color-mix(in srgb,var(--sc) 30%,transparent);transform:translateY(-1px)}',
    '.crest:focus-visible{outline:none}',
    '@media (prefers-reduced-motion:reduce){.crest .eyes{transition:none}.crest:hover .eyes,.crest:focus-visible .eyes{transform:none}}',
    // the panel
    '.pn{flex:1;min-height:0;padding:16px 18px 0;display:flex;flex-direction:column;gap:14px;overflow:hidden}',
    '.sc{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:14px;margin-inline:-18px;padding-inline:18px;padding-bottom:2px}',
    '.sc > *{flex:none}',
    // the Jot tab (clip-jot.css)
    '.jk{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid var(--sc);border-radius:12px;background:color-mix(in srgb,var(--sc) 8%,var(--surface));color:var(--ink-deep);font:700 13px/1.3 ' + SANS + ';flex:none;text-align:left}',
    '.jk > .vi{width:18px;height:18px;color:var(--sc)}.jk .vi .f{fill:color-mix(in srgb,var(--sc) 24%,transparent)}.jk .vi .s{fill:var(--sc)}',
    '.jk > span:not(.kbd){flex:1;min-width:0}.jk small{display:block;font:500 12px/1.3 ' + SANS + ';color:var(--muted)}',
    '.kbd{display:inline-flex;align-items:center;justify-content:center;height:20px;min-width:20px;padding:0 5px;border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;background:var(--surface);font:600 10.5px/1 ' + MONO + ';color:var(--muted);flex:none}',
    '.say{margin:-6px 0 0;font:600 12px/1.35 ' + SANS + ';color:var(--ink-soft)}',
    '.lb{display:flex;align-items:center;gap:8px;flex:none}',
    '.lb p{margin:0;font:600 10.5px/1.3 ' + MONO + ';letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}',
    '.lb button{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font:700 12.5px ' + SANS + ';color:var(--ink-deep);text-decoration:underline;text-decoration-color:var(--sc);text-underline-offset:3px;white-space:nowrap}',
    '.lb button .vi{width:14px;height:14px;color:var(--sc)}',
    '.lb button[aria-busy="true"]{opacity:.6;cursor:progress}',
    '.ls{list-style:none;margin:0;padding:0;border-radius:12px;border:1px solid var(--line);background:var(--surface);background-image:linear-gradient(90deg,transparent 54px,color-mix(in srgb,var(--bad) 35%,transparent) 54px,color-mix(in srgb,var(--bad) 35%,transparent) 55px,transparent 55px);overflow:hidden;flex:none}',
    '.ls li{position:relative;min-width:0;border-bottom:1px solid var(--line)}',
    '.ls li:last-child{border-bottom:0}',
    // Every jot is a button that plays from its time (clip-jot.css .cp-jot__item).
    '.ls .it{position:relative;display:grid;grid-template-columns:54px minmax(0,1fr);gap:4px 10px;width:100%;padding:10px 12px 10px 0;border-radius:8px;text-align:left;cursor:pointer;min-width:0}',
    '.ls .it:hover{background:var(--sc-soft)}',
    '.ls .it:focus-visible{outline:2px solid var(--sc);outline-offset:-2px}',
    '.ls .it > .st{grid-row:1 / span 3;justify-self:center;align-self:start}',
    '.ls .it > *:not(.st):not(.vi){grid-column:2;min-width:0}',
    '.ls .it > .vi{position:absolute;right:8px;top:8px;width:16px;height:16px;color:var(--sc);opacity:0;transition:opacity .15s}',
    '.ls .it > .vi .f{fill:color-mix(in srgb,var(--sc) 24%,transparent)}',
    '.ls .it:hover > .vi,.ls .it:focus-visible > .vi{opacity:1}',
    '.st{justify-self:start;display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;background:var(--sc-soft);color:var(--ink-deep);font:600 11.5px/1 ' + MONO + ';font-variant-numeric:tabular-nums;cursor:pointer;flex:none}',
    '.ls q{display:block;quotes:none;padding-left:9px;border-left:3px solid var(--sc);font:500 13.5px/1.45 ' + SERIF + ';color:var(--ink-soft);overflow-wrap:anywhere}',
    '.ls .tx{display:block;font:500 13.5px/1.5 ' + SANS + ';color:var(--ink);overflow-wrap:anywhere;white-space:pre-wrap}',
    // The small mark on a jot made with H (Classroom's "J", .cp-jot__byj).
    '.ls .byj{font:600 10px ' + MONO + ';color:var(--sc);letter-spacing:.06em}',
    // Delete: a quiet word at the jot's bottom right, shown on hover (.cp-jot__del).
    '.ls .del{position:absolute;right:8px;bottom:8px;padding:2px 4px;border-radius:4px;background:var(--surface);font:600 11.5px/1.2 ' + SANS + ';color:var(--muted);cursor:pointer;opacity:0;transition:opacity .15s}',
    '.ls li:hover .del,.ls .del:focus-visible{opacity:1}',
    '.ls .del:hover{color:var(--bad);text-decoration:underline;text-underline-offset:2px}',
    '.ls .gone{display:block;padding:10px 12px 10px 64px;font:500 13px/1.45 ' + SANS + ';color:var(--muted)}',
    // A professor's insight added as a jot (.cp-jot__li--insight).
    '.ls li.ins2{background:color-mix(in srgb,var(--sc) 9%,var(--surface));box-shadow:inset 3px 0 0 var(--sc)}',
    '.ls li.ins2 .byj{font-weight:700}',
    '@media (prefers-reduced-motion:reduce){.ls .it > .vi,.ls .del{transition:none}}',
    '.empty{margin:0;font:500 13px/1.5 ' + SANS + ';color:var(--muted)}',
    '.cp{margin-top:auto;margin-inline:-18px;padding:12px 18px 14px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:flex-end;flex:none;background:var(--surface)}',
    // The composer's field (.cp-jot__fld): the time chip, then a textarea that
    // grows from one 20 px line to 120 px.
    '.fld{flex:1;min-width:0;display:flex;align-items:flex-start;gap:6px;min-height:40px;padding:9px 6px;border:1px solid var(--line-strong);border-radius:12px;background:var(--bgc)}',
    '.fld:focus-within{border-color:var(--sc)}',
    '.fld textarea{all:unset;box-sizing:border-box;flex:1;min-width:0;height:20px;max-height:120px;font:500 13.5px/20px ' + SANS + ';color:var(--ink);resize:none;overflow-y:auto;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.fld textarea::placeholder{color:var(--muted);opacity:1}',
    '.go{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 16px;border-radius:999px;border:1.5px solid var(--sc);background:var(--sc);color:#fff;font:700 13.5px/1 ' + SANS + ';flex:none}',
    '.go .vi .f{fill:color-mix(in srgb,currentColor 24%,transparent)}.go .vi .s{fill:currentColor}',
    // the sign-in line and quiet notes
    '.si{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;background:var(--sunk);font:600 12.5px/1.35 ' + SANS + ';color:var(--ink-deep);flex:none}',
    '.si span{flex:1}',
    '.si button{font:700 12.5px ' + SANS + ';color:var(--ink-deep);text-decoration:underline;text-decoration-color:var(--sc);text-underline-offset:3px;white-space:nowrap}',
    '.note{display:grid;gap:6px;padding:4px 2px;font:500 13px/1.5 ' + SANS + ';color:var(--muted)}',
    '.note b{font:700 14px/1.35 ' + SANS + ';color:var(--ink-deep)}',
    '.note button{justify-self:start;font:700 12.5px ' + SANS + ';color:var(--ink-deep);text-decoration:underline;text-decoration-color:var(--sc);text-underline-offset:3px}',
    // the Digest (clip-digest.css)
    '.dgt{display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:none}',
    '.seg3{display:inline-flex;padding:3px;gap:2px;border:1px solid var(--line);border-radius:999px;background:var(--sunk)}',
    '.seg3 button{padding:4px 11px;border-radius:999px;font:700 12px/1.3 ' + SANS + ';color:var(--muted);white-space:nowrap}',
    '.seg3 button[aria-pressed="true"]{background:var(--surface);color:var(--ink-deep);box-shadow:0 1px 0 var(--line)}',
    // Search (.cp-dg__srch): the magnifier, a 28 px pill, the field 64 → 128 px.
    '.srch{margin-left:auto;display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 11px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--muted);flex:0 1 auto;min-width:0;cursor:text}',
    '.srch:focus-within{border-color:var(--sc);color:var(--ink-deep)}',
    '.srch input{all:unset;width:64px;min-width:0;font:600 12px/1 ' + SANS + ';color:inherit;transition:width .18s ease}',
    '.srch input::placeholder{color:var(--muted);opacity:1}',
    '.srch input:focus,.srch input:not(:placeholder-shown){width:128px}',
    '.srch input::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none}',
    '.ics{position:relative;width:11px;height:11px;border:2px solid currentColor;border-radius:50%;flex:none;display:block;box-sizing:border-box}',
    '.ics::after{content:"";position:absolute;width:2px;height:6px;background:currentColor;right:-3px;bottom:-5px;transform:rotate(-45deg);border-radius:1px}',
    '.fine{margin:0;font:500 12px/1.45 ' + SANS + ';color:var(--muted);flex:none}',
    '.fine.close{display:flex;align-items:flex-start;gap:8px}',
    '.fine.close > span{flex:1 1 auto;min-width:0}',
    '.finex{display:grid;place-items:center;width:24px;height:24px;margin:-4px 0 0;border-radius:8px;color:var(--muted);flex:none}',
    '.finex:hover{background:var(--sunk);color:var(--ink-deep)}',
    '.finex .vi{width:14px;height:14px}',
    // Reading: the clock and the skeletons (.cp-dg__reading, __clock, __sk).
    '.reading{display:flex;gap:10px;align-items:center;font:700 14px/1.4 ' + SANS + ';color:var(--ink-deep);flex:none}',
    '.clock{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--sc);display:inline-block;flex:none;box-sizing:border-box;animation:hd-turn 1s linear infinite}',
    '.sks{display:flex;flex-direction:column;gap:14px;flex:none}',
    '.sk{display:block;height:12px;border-radius:6px;background:color-mix(in srgb,var(--line) 70%,var(--surface));position:relative;overflow:hidden}',
    '.sk::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgb(255 255 255 / .7),transparent);transform:translateX(-60%);animation:hd-shine 1.4s ease-in-out infinite}',
    '@keyframes hd-turn{to{transform:rotate(360deg)}}',
    '@keyframes hd-shine{to{transform:translateX(160%)}}',
    '@media (prefers-reduced-motion:reduce){.clock,.sk::after{animation:none}}',
    // {name}'s insights, the note card that folds (.cp-dg__note): a 44 px row at rest.
    '.dnote{position:relative;display:grid;gap:4px;padding:10px 12px 12px 14px;background:var(--sunk);border-radius:4px 14px 14px 14px;flex:none;min-width:0}',
    '.dnote.closed{padding:8px 10px 8px 12px}',
    '.notehd{display:grid;grid-template-columns:28px minmax(0,1fr) 16px;gap:10px;align-items:center;width:100%;text-align:left;cursor:pointer}',
    '.notehd:focus-visible{outline:none;box-shadow:0 0 0 2px var(--sc);border-radius:8px}',
    '.notehd .eyes{width:28px;height:28px;border-radius:50%}',
    '.nt{display:flex;align-items:baseline;gap:8px;min-width:0}',
    '.nt b{font:600 15px/1.3 ' + SERIF + ';color:var(--ins-ink);white-space:nowrap}',
    '.teaser{font:500 12.5px/1.3 ' + SANS + ';color:var(--muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.notehd > .vi{width:16px;height:16px;color:var(--muted);transition:transform .2s ease}',
    '.notehd:hover > .vi,.notehd:focus-visible > .vi{color:var(--sc)}',
    '.dnote[data-open] .notehd > .vi{transform:rotate(180deg)}',
    '.notebody{display:grid;gap:2px}',
    '.notebody[data-anim]{animation:hd-unfold .2s ease both}',
    '@keyframes hd-unfold{from{clip-path:inset(0 0 100% 0);opacity:.4}to{clip-path:inset(0);opacity:1}}',
    '.brief{margin:0;font:500 13.5px/1.55 ' + SANS + ';color:var(--ins-ink);text-align:justify;text-justify:inter-word;hyphens:auto;text-wrap:pretty;overflow-wrap:break-word}',
    '.brief[lang="zh-Hans"]{text-justify:auto;hyphens:manual}',
    '.brief.soon{color:var(--muted);text-align:left}',
    '.ovlink{justify-self:start;display:inline-flex;align-items:center;gap:4px;margin:6px 0 0;min-height:32px;font:700 13px ' + SANS + ';color:var(--ins-ink);cursor:pointer}',
    '.ovlink .vi{width:14px;height:14px}',
    '.ovlink[aria-disabled="true"]{color:var(--muted);cursor:default}',
    '@media (prefers-reduced-motion:reduce){.notebody[data-anim]{animation:none}.notehd > .vi{transition:none}}',
    // Subject ink for the insights text (clip-digest.css --cp-ins-ink).
    '.cd{--ins-ink:var(--ink)}',
    '.cd [data-subj="CHEM"]{--ins-ink:#6e46be}.cd [data-subj="BIOL"]{--ins-ink:#256c44}.cd [data-subj="PHYS"]{--ins-ink:#2a5ac1}.cd [data-subj="MATH"]{--ins-ink:#4f46e5}.cd [data-subj="ENLA"]{--ins-ink:#a5356a}.cd [data-subj="HIST"]{--ins-ink:#9b4724}.cd [data-subj="GEOG"]{--ins-ink:#0d6882}',
    // Jump to now (.cp-dg__jump).
    '.jump{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:4;display:inline-flex;align-items:center;height:32px;padding:0 14px;border-radius:999px;background:#002147;color:#fff;font:700 12.5px/1 ' + SANS + ';box-shadow:0 6px 18px rgb(0 0 0 / .22);cursor:pointer}',
    '.jump:focus-visible{outline:2px solid var(--sc);outline-offset:2px}',
    // A chapter's bookmark in the list (clip-digest.css .cp-dg__div, the button face).
    '.lns .div{display:flex;align-items:center;gap:8px;width:100%;padding:6px 9px 2px;border-radius:8px;font:600 10px/1.2 ' + MONO + ';letter-spacing:.1em;text-transform:uppercase;color:var(--muted);text-align:left;cursor:pointer}',
    '.lns .div::before,.lns .div::after{content:"";flex:1;height:1px;background:var(--line)}',
    '.lns .div::before{flex:0 0 12px}',
    '.lns .div:hover{color:var(--sc);background:color-mix(in srgb,var(--sc) 8%,transparent)}',
    '.lns .div:hover::before,.lns .div:hover::after{background:color-mix(in srgb,var(--sc) 45%,var(--line))}',
    '.lns .div:focus-visible{outline:2px solid var(--sc);outline-offset:1px;color:var(--sc)}',
    // The locked block's buttons (.cp-dg__btnrow, .cp-dg__btn), D92.
    '.note .btnrow{display:flex;gap:8px 14px;align-items:center;flex-wrap:wrap;margin-top:4px}',
    '.note .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:40px;padding:0 18px;border-radius:999px;border:1px solid var(--sc);background:var(--sc);color:#fff;font:700 14px/1 ' + SANS + ';white-space:nowrap;text-decoration:none;cursor:pointer}',
    '.note .btn .vi{width:14px;height:14px}',
    '.ins p.pzh{margin-top:2px}',
    '.lnwrap{position:relative;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}',
    '.ln[data-hit]{box-shadow:inset 0 0 0 1px var(--sc)}',
    '.dlb{margin:0;font:600 10.5px/1.3 ' + MONO + ';letter-spacing:.12em;text-transform:uppercase;color:var(--muted);flex:none}',
    '.lns{display:grid;gap:4px}',
    '.ln{display:grid;grid-template-columns:42px minmax(0,1fr);gap:8px;padding:7px 9px;border-radius:10px;font:500 14px/1.45 ' + SANS + ';color:var(--ink-soft);text-align:left}',
    '.ln .ts{font:600 11.5px/1.3 ' + MONO + ';color:var(--muted);padding-top:2px}',
    '.ln.now{background:var(--sc-soft);color:var(--ink-deep)}.ln.now .ts{color:var(--sc)}',
    '.ln .zh{display:block;font:500 13px/1.5 "PingFang SC","Noto Sans SC",' + SANS + ';color:var(--muted)}',
    '.ln.now .zh{color:var(--ink-soft)}',
    '.ln .zh.only{font-size:14px;color:inherit}',
    '.ln:focus-visible{outline:2px solid var(--sc);outline-offset:-2px}',
    // Insights
    // Insights (clip-digest.css .cp-dg__parts / __part / __parthd / __pttl / __ov):
    // each part under a 1 px rule, its time and serif title in the subject ink,
    // the paragraph justified in the ink; the part playing now has a 3 px edge.
    '.ins{display:grid;gap:12px;margin:0;padding:0;list-style:none}',
    '.ins > li{display:grid;gap:4px;min-width:0;padding-top:10px;border-top:1px solid var(--line)}',
    '.ins > li[aria-current="true"]{box-shadow:inset 3px 0 0 var(--sc);padding-left:10px}',
    '.parthd{display:flex;align-items:baseline;gap:8px;min-width:0}',
    '.parthd .ts2{flex:none;min-height:24px;padding:0 2px;font:600 11.5px/24px ' + MONO + ';color:var(--ins-ink);font-variant-numeric:tabular-nums;cursor:pointer}',
    '.parthd .ts2:hover{text-decoration:underline}',
    '.pttl{min-width:0;font:600 14px/1.35 ' + SERIF + ';color:var(--ins-ink);overflow-wrap:anywhere}',
    '.ins p{margin:0;font:500 14px/1.5 ' + SANS + ';color:var(--ins-ink);text-align:justify;text-justify:inter-word;hyphens:auto;text-wrap:pretty;overflow-wrap:break-word}',
    '.ins p.pnote{display:flex;align-items:center;gap:8px;font:500 12.5px/1.45 ' + SANS + ';color:var(--muted);text-align:left}',
    '.insadd{display:flex;flex-wrap:wrap;align-items:center;gap:8px;flex:none}',
    '.addj{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border:1px solid color-mix(in srgb,var(--ins-ink) 40%,transparent);border-radius:999px;background:var(--surface);color:var(--ins-ink);font:700 12.5px/1 ' + SANS + ';cursor:pointer}',
    '.addj:hover{background:color-mix(in srgb,var(--ins-ink) 8%,var(--surface))}',
    '.addj[data-added]{border-color:transparent;background:color-mix(in srgb,var(--ins-ink) 10%,var(--surface));cursor:default}',
    '.addj[aria-disabled="true"]:not([data-added]){color:var(--muted);border-color:var(--line);cursor:default}',
    '.addj .vi{width:15px;height:15px}',
    // the foot
    '.ft{height:32px;flex:none;position:relative;display:flex;align-items:center;justify-content:center;gap:6px;border-top:1px solid var(--line);font:500 12px/1 ' + SANS + ';color:var(--muted)}',
    '.ft .vi{width:14px;height:14px}',
    '.ft .gr{position:absolute;right:8px;top:4px;width:24px;height:24px;display:grid;place-items:center;border-radius:6px}',
    '.ft .gr .vi{width:16px;height:16px;transform:rotate(90deg)}',
    '.ft .gr[aria-pressed="true"] .vi{transform:rotate(-90deg)}',
    // the Saved card (Round 9, D83, D86; the artifact's .okc)
    '.okc{border:1.5px solid #b9dcc6;background:#eef7f1;border-radius:14px;padding:14px;display:grid;gap:8px;flex:none}',
    '.okc .h{display:flex;align-items:center;gap:9px;font:800 14.5px ' + SANS + ';color:#1f6a40}',
    '.okc .h i{width:24px;height:24px;border-radius:50%;background:#2f8a57;color:#fff;display:grid;place-items:center;font:800 13px ' + SANS + ';font-style:normal;flex:none}',
    '.okc p{margin:0;font:500 13px/1.45 ' + SANS + ';color:var(--ink-soft)}',
    '.okc .orow{display:flex;gap:8px}',
    '.okc .orow button{flex:1;height:38px;border-radius:11px;display:grid;place-items:center;font:800 13px ' + SANS + '}',
    '.okc .orow .o{background:var(--ink-deep);color:#fff}',
    '.okc .orow .n{background:#fff;border:1px solid var(--line-strong);color:var(--ink-deep)}',
    '.okc .orow [aria-busy="true"]{opacity:.6;cursor:progress}',
    '.okc .ofine{font:500 11.5px ' + SANS + ';color:var(--muted)}',
    // The jot pop-up (clip-jot.css .cp-toast, JotToast): 56 px under the
    // desk's top, 5 s (200 ms in, 350 ms out), after every jot on any tab.
    '.cd{position:relative}',
    '.jt{position:absolute;z-index:6;left:10px;right:10px;top:56px;display:grid;gap:4px;padding:10px 12px;border-radius:12px;background:var(--surface);border:1px solid var(--line);box-shadow:0 12px 30px rgb(0 33 71 / .12);font:500 13px/1.45 ' + SANS + ';color:var(--ink);text-align:left}',
    '.jt[data-anim]{animation:hd-toast 5s ease both}',
    '@keyframes hd-toast{0%{opacity:0;transform:translateY(-6px)}4%,93%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-4px)}}',
    '@media (prefers-reduced-motion:reduce){.jt[data-anim]{animation:none}}',
    '.jt .hd2{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 6px;min-width:0}',
    '.jt .ok,.jt .bad{display:inline-flex;align-items:center;gap:6px;font:700 12px ' + SANS + ';color:#1f6a40}',
    '.jt .ok::before,.jt .bad::before{content:"";width:8px;height:8px;border-radius:50%;background:#2f8a57}',
    '.jt .bad{color:var(--bad)}.jt .bad::before{background:var(--bad)}',
    '.jt .tt{font:600 11.5px ' + MONO + ';color:var(--muted);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
    '.jt .tt::before{content:"·";margin-right:6px}',
    '.jt .msg{font:600 13px/1.45 ' + SANS + ';color:var(--ink-deep)}',
    '.jt q{quotes:"\\201C" "\\201D";font:500 13.5px/1.45 ' + SERIF + ';color:var(--ink-deep);overflow-wrap:anywhere}',
    '.jt .text{font:500 13.5px/1.45 ' + SANS + ';color:var(--ink-deep);overflow-wrap:anywhere;white-space:pre-wrap}',
    '.jt .acts{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px}',
    '.jt .lk{font:700 12.5px ' + SANS + ';color:var(--sc);text-decoration:underline;text-underline-offset:2px;cursor:pointer}',
    '.jt .lk[aria-busy="true"]{opacity:.55;cursor:progress}',
    '.jt .jl{font:600 12px ' + SANS + ';color:var(--muted);text-decoration:underline;text-underline-offset:3px;cursor:pointer}',
    '.jt .jl:hover{color:var(--ink-deep)}',
    // under the desk, in YouTube's own type
    '.more{display:inline-block;margin-top:8px;font:600 12.5px Roboto,Arial,sans-serif;color:#3ea6ff;padding:2px}',
    ':host(.light) .more{color:#065fd4}',
    // A narrow column (YouTube at ~1100–1300 px windows gives 330–400 px):
    // the five tabs and the header still fit, the subtitle goes first.
    '@container (max-width:400px){.tabs{padding:0 8px;gap:0}.tab{padding:0 5px;gap:4px;font-size:13px}.tab small{padding:1px 5px}.hd{gap:7px;padding:0 10px}.x{margin-left:6px;gap:9px}.vr{padding:10px}.full{padding:0 9px}}',
    // Narrower still: the tabs keep Classroom's icons (the owner's 0.6.0
    // test: a desk with no tab icons is not Classroom's), drawn smaller.
    // Classroom's phone values (clip-desk.css ≤ 600 px), and one more step
    // under 335 px so 320 px still fits; an icon is never hidden.
    '@container (max-width:350px){.tabs{padding:0 8px;gap:2px}.tab{padding:0 6px;gap:4px;font-size:13px}.tab .vi{width:15px;height:15px}.tab small{padding:1px 4px}.hd small{display:none}}',
    '@container (max-width:335px){.tabs{padding:0 6px;gap:0}.tab{padding:0 4px}.tab .vi{width:14px;height:14px}}',
    '[hidden]{display:none !important}',
  ].join('\n');

  root.HeddyDeskShell = { SC: SC, SC_SOFT: SC_SOFT, IC: IC, ic: ic, EYES: EYES, CSS: CSS, SANS: SANS, SERIF: SERIF, MONO: MONO };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HeddyDeskShell;
})(globalThis);
