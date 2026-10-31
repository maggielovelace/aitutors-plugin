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

  // The professor's colours until the site names them (Mentor's navy).
  var SC = '#002147';
  var SC_SOFT = '#e6eaf0';

  // Classroom's ClipIcons (the artifact's IC, from components/videos/ClipIcons.tsx).
  var IC = {
    quiz: '<circle cx="12" cy="12" r="8.5" stroke-width="2.1"/><circle cx="12" cy="12" r="4.6" stroke-width="2.1"/><circle class="s" cx="12" cy="12" r="1.6"/>',
    jot: '<path class="f" d="M19.5 4.5c-6 .5-10.5 4-12.5 10l-1.5 5 5-1.5c6-2 9-7 9-13.5z"/><path d="M19.5 4.5c-6 .5-10.5 4-12.5 10l-1.5 5 5-1.5c6-2 9-7 9-13.5z"/><path d="M5.5 19.5 14 11"/><circle class="s" cx="15.4" cy="9.2" r="1.1"/>',
    digest: '<rect class="f" x="3.5" y="5" width="17" height="14" rx="3"/><rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M7 10.3h4.5M13.5 10.3h3.5"/><rect class="s" x="7" y="13.4" width="10" height="2.4" rx="1.2"/>',
    insights: '<path class="f" d="M3 15s3.4-5.5 9-5.5 9 5.5 9 5.5-3.4 5.5-9 5.5S3 15 3 15z"/><path d="M3 15s3.4-5.5 9-5.5 9 5.5 9 5.5-3.4 5.5-9 5.5S3 15 3 15z"/><circle cx="12" cy="15" r="2.4"/><path class="s" d="M12 2.2l.95 2.15 2.15.95-2.15.95L12 8.4l-.95-2.15L8.9 5.3l2.15-.95z"/>',
    desk: '<path d="M3.5 15h17M6.5 15v5M17.5 15v5"/><path class="f" d="M9.5 11.5h7l-1.6-4.5h-3.8z"/><path d="M9.5 11.5h7l-1.6-4.5h-3.8z"/><path d="M13 11.5V15"/><circle class="s" cx="13" cy="13.3" r="1.1"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    out: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  };
  function ic(n) {
    return '<svg class="vi" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + IC[n] + '</svg>';
  }
  var EYES = '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' + M.SYMBOLS['h-eyes'].body + '</svg>';

  var SERIF = '"Source Serif 4",Georgia,"Times New Roman",serif';
  var MONO = '"JetBrains Mono",ui-monospace,Menlo,monospace';
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
    '.vr small{font:600 11px ' + MONO + ';color:var(--muted);white-space:nowrap}',
    '.full{margin-left:auto;flex:none;height:30px;border-radius:999px;border:1px solid var(--line-strong);background:#fff;color:var(--ink-deep);font:700 12px ' + SANS + ';display:flex;align-items:center;gap:6px;padding:0 11px;white-space:nowrap}',
    '.full .vi{width:14px;height:14px}',
    '.full[aria-busy="true"]{opacity:.6;cursor:progress}',
    // the tab row (clip-desk.css)
    '.tabs{height:48px;display:flex;align-items:stretch;gap:2px;padding:0 12px;border-bottom:1px solid var(--line);flex:none}',
    '.tab{position:relative;display:inline-flex;align-items:center;gap:6px;padding:0 7px;font:700 14px/1 ' + SANS + ';color:var(--muted);white-space:nowrap}',
    '.tab[aria-selected="true"]{color:var(--ink-deep)}',
    '.tab[aria-selected="true"]::before{content:"";position:absolute;inset:auto 0 7px;height:34px;z-index:0;border-radius:10px;background:color-mix(in srgb,var(--sc) 12%,transparent);box-shadow:inset 0 -2px 0 var(--sc)}',
    '.tab > *{position:relative}',
    '.tab[aria-selected="true"] .vi .f{fill:color-mix(in srgb,var(--sc) 24%,transparent)}.tab[aria-selected="true"] .vi .s{fill:var(--sc)}',
    '.tab small{font:600 10.5px/1.4 ' + MONO + ';background:var(--sunk);border-radius:999px;padding:1px 6px;color:var(--muted)}',
    '.tab[aria-disabled="true"]{cursor:default}',
    '.crest{margin-left:auto;align-self:center;width:32px;height:32px;display:grid;place-items:center;flex:none;border-radius:50%}',
    '.crest .eyes{border-radius:50%;box-shadow:0 0 0 2px #fff,0 0 0 3px var(--line)}',
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
    '.ls li{position:relative;display:grid;grid-template-columns:54px minmax(0,1fr);gap:4px 10px;padding:10px 12px 10px 0;border-bottom:1px solid var(--line)}',
    '.ls li:last-child{border-bottom:0}',
    '.st{justify-self:center;align-self:start;display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;background:var(--sc-soft);color:var(--ink-deep);font:600 11.5px/1 ' + MONO + '}',
    '.ls q{display:block;quotes:none;padding-left:9px;border-left:3px solid var(--sc);font:500 13.5px/1.45 ' + SERIF + ';color:var(--ink-soft);overflow-wrap:anywhere}',
    '.ls .tx{font:500 13.5px/1.5 ' + SANS + ';color:var(--ink);overflow-wrap:anywhere;white-space:pre-wrap}',
    '.ls .del{position:absolute;right:6px;top:8px;width:22px;height:22px;border-radius:6px;display:grid;place-items:center;color:var(--muted);background:var(--surface);opacity:0;font:600 13px/1 ' + SANS + '}',
    '.ls li:hover .del,.ls .del:focus-visible{opacity:1}',
    '.empty{margin:0;font:500 13px/1.5 ' + SANS + ';color:var(--muted)}',
    '.cp{margin-top:auto;margin-inline:-18px;padding:12px 18px 14px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:flex-end;flex:none;background:var(--surface)}',
    '.fld{all:unset;flex:1;min-width:0;height:40px;box-sizing:border-box;padding:9px 12px;border:1px solid var(--line-strong);border-radius:12px;background:var(--bgc);color:var(--ink);font:500 13.5px/20px ' + SANS + '}',
    '.fld::placeholder{color:var(--muted);opacity:1}',
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
    '.srch2{all:unset;box-sizing:border-box;margin-left:auto;height:30px;width:72px;field-sizing:content;min-width:56px;max-width:150px;flex:0 1 auto;border:1px solid var(--line);border-radius:999px;padding:0 12px;font:600 12px ' + SANS + ';color:var(--ink)}',
    '.srch2::placeholder{color:var(--muted);opacity:1}',
    '.dlb{margin:0;font:600 10.5px/1.3 ' + MONO + ';letter-spacing:.12em;text-transform:uppercase;color:var(--muted);flex:none}',
    '.lns{display:grid;gap:2px}',
    '.ln{display:grid;grid-template-columns:42px minmax(0,1fr);gap:8px;padding:7px 9px;border-radius:10px;font:500 14px/1.45 ' + SANS + ';color:var(--ink-soft);text-align:left}',
    '.ln .ts{font:600 11.5px/1.3 ' + MONO + ';color:var(--muted);padding-top:2px}',
    '.ln.now{background:var(--sc-soft);color:var(--ink-deep)}.ln.now .ts{color:var(--sc)}',
    '.ln .zh{display:block;font:500 13px/1.5 "PingFang SC","Noto Sans SC",' + SANS + ';color:var(--muted)}',
    '.ln.now .zh{color:var(--ink-soft)}',
    '.ln .zh.only{font-size:14px;color:inherit}',
    '.ln:focus-visible{outline:2px solid var(--sc);outline-offset:-2px}',
    // Insights
    '.ins{display:grid;gap:10px}',
    '.ins div{display:grid;grid-template-columns:54px minmax(0,1fr);gap:4px 10px}',
    '.ins b{font:700 13px/1.3 ' + SANS + ';color:var(--ink-deep)}',
    '.ins p{grid-column:2;margin:0;font:500 13.5px/1.5 ' + SANS + ';color:var(--ink-soft)}',
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
    // under the desk, in YouTube's own type
    '.more{display:inline-block;margin-top:8px;font:600 12.5px Roboto,Arial,sans-serif;color:#3ea6ff;padding:2px}',
    ':host(.light) .more{color:#065fd4}',
    // A narrow column (YouTube at ~1100–1300 px windows gives 330–400 px):
    // the five tabs and the header still fit, the subtitle goes first.
    '@container (max-width:400px){.tabs{padding:0 8px;gap:0}.tab{padding:0 5px;gap:4px;font-size:13px}.tab small{padding:1px 5px}.hd{gap:7px;padding:0 10px}.x{margin-left:6px;gap:9px}.vr{padding:10px}.full{padding:0 9px}}',
    '@container (max-width:350px){.tab .vi{display:none}.tab{padding:0 6px}.hd small{display:none}.full .vi{display:none}}',
    '[hidden]{display:none !important}',
  ].join('\n');

  root.HeddyDeskShell = { SC: SC, SC_SOFT: SC_SOFT, IC: IC, ic: ic, EYES: EYES, CSS: CSS, SANS: SANS, SERIF: SERIF, MONO: MONO };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HeddyDeskShell;
})(globalThis);
