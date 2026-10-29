// lib/fonts.js — Manrope for the shadow-root UI Heddy puts on a page (the
// YouTube bar, the toasts, the trays, box mode).
//
// The bytes come from lib/font-data.js (bundled; see scripts/build-fonts.mjs)
// and are registered with new FontFace(bytes) under a family name of our own,
// "Heddy Manrope", so a page that styles with "Manrope" is never changed by
// us. No URL is involved, so the manifest needs no web_accessible_resources.
// If FontFace is missing or a face fails, the stack falls back to the system
// fonts it used before.
//
//   SANS          the font-family stack every page surface uses
//   load(doc)     register the faces in doc.fonts, once per document
(function (root) {
  var FAMILY = 'Heddy Manrope';
  var SANS = '"Heddy Manrope",Manrope,Roboto,Arial,sans-serif';
  var DESCRIPTORS = { weight: '500 800', style: 'normal', display: 'swap' };

  function bytes(base64) {
    var bin = root.atob(base64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  // Kept on the global so that a second injection of this file into the same
  // tab (every gesture injects it again) still knows the document is done.
  var loaded = root.HeddyFontDocs || (typeof WeakSet === 'function' ? (root.HeddyFontDocs = new WeakSet()) : null);

  /** Registers each face in doc.fonts; a second call for the same document
   *  does nothing. Returns how many faces it added. */
  function load(doc, FontFaceCtor) {
    var FF = FontFaceCtor || root.FontFace;
    var data = root.HeddyFontData;
    if (!doc || !doc.fonts || typeof FF !== 'function' || !Array.isArray(data)) return 0;
    if (loaded && loaded.has(doc)) return 0;
    if (loaded) loaded.add(doc);
    var added = 0;
    data.forEach(function (face) {
      try {
        var d = { weight: DESCRIPTORS.weight, style: DESCRIPTORS.style, display: DESCRIPTORS.display, unicodeRange: face.unicodeRange };
        var ff = new FF(FAMILY, bytes(face.base64), d);
        doc.fonts.add(ff);
        added++;
      } catch (e) { /* the system-font fallback stands */ }
    });
    return added;
  }

  var api = { FAMILY: FAMILY, SANS: SANS, load: load };
  root.HeddyFonts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (typeof document !== 'undefined') load(document);
})(globalThis);
