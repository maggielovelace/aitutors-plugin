// Neutral stand-in pages for the store screenshots: no real site's logo,
// artwork or people. The video page carries only the element ids Heddy's
// selectors read (content/youtube-selectors.js), so the real content script
// draws its buttons on it; everything else is plain grey shapes.

const VIDEO = `<!doctype html><html><head><meta charset="utf-8"><title>Using scales on maps</title><style>
  body { margin: 0; background: #fff; font: 14px/1.4 Arial, sans-serif; color: #0f0f0f; }
  .top { height: 56px; display: flex; align-items: center; gap: 16px; padding: 0 24px; }
  .top .menu { width: 24px; height: 16px; border-top: 2px solid #606060; border-bottom: 2px solid #606060; position: relative; }
  .top .menu::after { content: ""; position: absolute; left: 0; right: 0; top: 5px; border-top: 2px solid #606060; }
  .top .search { margin-left: 120px; width: 460px; height: 38px; border: 1px solid #ccc; border-radius: 20px; }
  .wrap { display: flex; gap: 24px; padding: 4px 24px; }
  .main { width: 712px; flex: none; }
  #movie_player { position: relative; width: 712px; height: 400px; border-radius: 12px; overflow: hidden; background: #1d3557; }
  #movie_player video { display: none; }
  #movie_player svg { position: absolute; inset: 0; }
  .prog { position: absolute; left: 12px; right: 12px; bottom: 14px; height: 4px; background: rgba(255,255,255,.35); border-radius: 2px; }
  .prog i { display: block; width: 30%; height: 100%; background: #e9eef5; border-radius: 2px; }
  #title h1 { margin: 12px 0 10px; font: 700 20px/1.3 Arial, sans-serif; }
  .meta { display: flex; align-items: center; gap: 12px; }
  .chan { display: flex; align-items: center; gap: 10px; margin-right: 18px; }
  .chan .av { width: 36px; height: 36px; border-radius: 50%; background: #c9d6e3; }
  .chan a { font-weight: 700; color: #0f0f0f; text-decoration: none; }
  .row { display: flex; align-items: center; margin-left: auto; }
  #top-level-buttons-computed { display: inline-flex; gap: 8px; }
  .pill { height: 36px; padding: 0 16px; border-radius: 18px; background: #f2f2f2; display: inline-flex; align-items: center; font-weight: 700; }
  .side { flex: 1; display: grid; gap: 12px; align-content: start; }
  .card { display: flex; gap: 10px; }
  .card .th { width: 168px; height: 94px; border-radius: 8px; background: #e5e9ee; flex: none; }
  .card b { display: block; width: 150px; height: 12px; background: #e5e9ee; border-radius: 6px; margin: 6px 0 8px; }
  .card s { display: block; width: 90px; height: 10px; background: #eef1f4; border-radius: 5px; }
</style></head><body>
<div class="top"><span class="menu"></span><span class="search"></span></div>
<div class="wrap">
  <div class="main">
    <div id="movie_player">
      <svg viewBox="0 0 712 400" width="712" height="400" aria-hidden="true">
        <rect width="712" height="400" fill="#1d3557"/>
        <path d="M60 300 C150 220 230 330 320 250 S500 170 650 230" stroke="#a8dadc" stroke-width="5" fill="none"/>
        <path d="M90 120 C180 90 260 160 360 110 S560 70 640 120" stroke="#457b9d" stroke-width="18" fill="none" opacity=".7"/>
        <circle cx="420" cy="200" r="9" fill="#f1faee"/><circle cx="210" cy="250" r="7" fill="#f1faee"/>
        <g transform="translate(470 318)"><rect width="180" height="10" fill="#f1faee"/><rect width="45" height="10" fill="#1d3557"/><rect x="90" width="45" height="10" fill="#1d3557"/>
        <text y="32" fill="#f1faee" font-family="Arial" font-size="15">0</text><text x="82" y="32" fill="#f1faee" font-family="Arial" font-size="15">1 km</text><text x="164" y="32" fill="#f1faee" font-family="Arial" font-size="15">2 km</text></g>
      </svg>
      <video></video>
      <div class="prog"><i></i></div>
    </div>
    <ytd-watch-metadata>
      <div id="title"><h1>Using scales on maps</h1></div>
      <div class="meta">
        <span class="chan"><span class="av"></span><ytd-channel-name><a href="#">Sample Geography</a></ytd-channel-name></span>
        <span class="row"><span id="top-level-buttons-computed"><span class="pill">Like</span><span class="pill">Share</span></span></span>
      </div>
    </ytd-watch-metadata>
  </div>
  <div class="side">
    <div class="card"><span class="th"></span><span><b></b><s></s></span></div>
    <div class="card"><span class="th"></span><span><b></b><s></s></span></div>
    <div class="card"><span class="th"></span><span><b></b><s></s></span></div>
    <div class="card"><span class="th"></span><span><b></b><s></s></span></div>
  </div>
</div>
</body></html>`;

const ARTICLE = `<!doctype html><html><head><meta charset="utf-8"><title>Reading map scales</title><style>
  body { margin: 0; background: #fff; color: #1f2933; font: 17px/1.65 Georgia, "Times New Roman", serif; }
  .site { height: 56px; display: flex; align-items: center; padding: 0 48px; border-bottom: 1px solid #e4e7eb; font: 700 16px Arial, sans-serif; color: #2f4858; }
  .site span { margin-left: auto; display: flex; gap: 22px; font-weight: 400; color: #616e7c; }
  .wrap { display: flex; gap: 48px; padding: 26px 48px; }
  article { width: 610px; flex: none; }
  h1 { margin: 0 0 6px; font: 700 32px/1.2 Georgia, serif; color: #102a43; }
  .by { margin: 0 0 18px; font: 13px Arial, sans-serif; color: #7b8794; }
  p { margin: 0 0 16px; }
  figure { margin: 70px 0 0; width: 440px; }
  figure svg { display: block; border-radius: 8px; }
  figcaption { margin-top: 8px; font: 13px/1.4 Arial, sans-serif; color: #616e7c; }
</style></head><body>
<div class="site">Sample Geography Notes<span><a>Maps</a><a>Rivers</a><a>Weather</a></span></div>
<div class="wrap">
  <article>
    <h1>Reading map scales</h1>
    <p class="by">Year 8 · Map skills</p>
    <p>A map is much smaller than the land it shows, so every map has a scale. The scale tells you how a distance on the map compares with the same distance on the ground.</p>
    <p>On a 1:50 000 map, 2 cm represents 1 km on the ground. So if two villages are 6 cm apart on the map, they are 3 km apart in real life.</p>
    <p>Scales can be written as a ratio, drawn as a line, or given in words. The line scale is the easiest to use: lay a strip of paper along the route, mark the ends, then hold it against the line.</p>
  </article>
  <figure>
    <svg viewBox="0 0 440 260" width="440" height="260" aria-hidden="true">
      <rect width="440" height="260" fill="#eef4ea"/>
      <path d="M0 190 C80 150 140 210 220 170 S360 110 440 150" stroke="#7fb3d5" stroke-width="12" fill="none"/>
      <path d="M40 40 L150 90 L250 60 L400 110" stroke="#c0392b" stroke-width="3" fill="none" stroke-dasharray="8 6"/>
      <circle cx="150" cy="90" r="9" fill="#2c3e50"/><circle cx="250" cy="60" r="9" fill="#2c3e50"/>
      <text x="120" y="122" font-family="Arial" font-size="13" fill="#2c3e50">Ashby</text><text x="232" y="44" font-family="Arial" font-size="13" fill="#2c3e50">Brook End</text>
      <g transform="translate(250 216)"><rect width="160" height="9" fill="#2c3e50"/><rect x="40" width="40" height="9" fill="#fff"/><rect x="120" width="40" height="9" fill="#fff"/>
      <text y="30" font-family="Arial" font-size="12" fill="#2c3e50">0</text><text x="72" y="30" font-family="Arial" font-size="12" fill="#2c3e50">1 km</text><text x="146" y="30" font-family="Arial" font-size="12" fill="#2c3e50">2 km</text></g>
    </svg>
    <figcaption>A 1:50 000 map: the line scale at the bottom right.</figcaption>
  </figure>
</div>
</body></html>`;

const INSTALL = `<!doctype html><html><head><meta charset="utf-8"><title>Heddy</title><style>
  body { margin: 0; background: #f6f1e7; color: #002147; font: 500 16px/1.5 "Heddy Manrope", Arial, sans-serif; }
  .wrap { padding: 54px 56px; width: 760px; }
  h2 { margin: 0 0 8px; font: 800 30px/1.2 "Heddy Manrope", Arial, sans-serif; }
  .sub { margin: 0 0 30px; color: #5d6878; }
  .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .st { background: #fdfcf8; border: 1px solid #e2dccf; border-radius: 14px; padding: 18px; min-height: 190px; box-sizing: border-box; }
  .st b { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: #002147; color: #f6f1e7; font-weight: 800; margin-bottom: 12px; }
  .st h3 { margin: 0 0 6px; font: 800 18px/1.3 "Heddy Manrope", Arial, sans-serif; }
  .st p { margin: 0; color: #5d6878; font-size: 14px; }
  .kid { margin-top: 14px; display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border-radius: 999px; background: #f6f1e7; font: 700 13px "Heddy Manrope", Arial, sans-serif; }
  .kid i { width: 24px; height: 24px; border-radius: 50%; background: #2f8a57; color: #fff; display: grid; place-items: center; font-style: normal; font-size: 12px; }
  .ok { margin-top: 14px; display: inline-block; padding: 6px 12px; border-radius: 8px; background: #002147; color: #fff; font: 700 13px "Heddy Manrope", Arial, sans-serif; }
</style></head><body><div class="wrap">
  <h2>Three steps to start</h2>
  <p class="sub">It takes about a minute.</p>
  <div class="steps">
    <div class="st"><b>1</b><h3>Add to Chrome</h3><p>From the Chrome Web Store. Heddy asks only for what it uses.</p><span class="ok">Add to Chrome</span></div>
    <div class="st"><b>2</b><h3>Pin Heddy</h3><p>Puzzle-piece menu → pin, so Heddy sits in the toolbar.</p></div>
    <div class="st"><b>3</b><h3>Sign in as the child</h3><p>On aitutors.me, in the same Chrome.</p><span class="kid"><i>S</i>Shan · Year 8</span></div>
  </div>
</div></body></html>`;

export const PAGES = {
  'https://www.youtube.com/watch': VIDEO,
  'https://www.example.org/notes/reading-map-scales': ARTICLE,
  'https://www.example.org/heddy-install': INSTALL,
};
