// Shared theme, layouts and helpers for the P11 review decks
const pptxgen = require("pptxgenjs");
const path = require("path");
const SKILL = "C:/Users/raman/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/local-agent-mode-sessions/skills-plugin/c536f30b-c2ff-405d-8c88-e5047a561a32/1a3f3f5c-25f0-4255-8e54-420b9b9e6297/skills/pptx";
const { applyTheme } = require(path.join(SKILL, "scripts/apply_theme.js"));

const K = {
  ink: "12263A", text: "1B2430", muted: "5B6675", bg2: "EEF3F6",
  teal: "2A9D8F", tealL: "DDF1EE", amber: "E9A23B", amberL: "FCEFD9",
  coral: "D1495B", coralL: "F8DDE1", slate: "4C6A92", slateL: "E3EAF3",
  line: "C9D3DC", white: "FFFFFF", code: "0F1B2A", codeText: "E6EDF3",
};

const THEME = {
  name: "P11 Cloud Bursting",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: K.text, lt1: K.white, dk2: K.ink, lt2: K.bg2,
    accent1: K.teal, accent2: K.amber, accent3: K.coral, accent4: K.slate,
    accent5: "8AB17D", accent6: "6C757D", hlink: K.teal, folHlink: K.slate,
  },
};

function newDeck(reviewLabel, title) {
  const p = new pptxgen();
  p.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  p.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  p.author = "Team P11";
  p.title = title;

  p.defineSlideMaster({
    title: "DARK",
    background: { color: K.ink },
    objects: [
      { placeholder: { options: { name: "title", type: "title", align: "left", x: 0.8, y: 1.9, w: 11.7, h: 2.1, fontFace: "Cambria", fontSize: 40, bold: true, color: K.white, valign: "bottom", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.3, w: 11.7, h: 1.9, fontFace: "Calibri", fontSize: 18, color: "CADCE8", valign: "top", margin: 0 }, text: "" } },
    ],
  });
  p.defineSlideMaster({
    title: "CONTENT",
    background: { color: K.white },
    objects: [
      { placeholder: { options: { name: "title", type: "title", align: "left", x: 0.6, y: 0.35, w: 12.1, h: 0.8, fontFace: "Cambria", fontSize: 34, bold: true, color: K.ink, valign: "middle", margin: 0 }, text: "" } },
      { text: { text: `P11 · Policy-Driven Cloud Bursting · ${reviewLabel}`, options: { x: 0.6, y: 7.0, w: 8, h: 0.3, fontFace: "Calibri", fontSize: 10, color: K.muted, margin: 0 } } },
    ],
    slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontFace: "Calibri", fontSize: 10, color: K.muted, align: "right" },
  });
  return p;
}

// Content slide with title and an italic one-line takeaway
function ensureSection(p, sec) {
  p._secs = p._secs || new Set();
  if (!p._secs.has(sec)) { p._secs.add(sec); p.addSection({ title: sec }); }
}

function darkSlide(p, sec) {
  ensureSection(p, sec);
  return p.addSlide({ masterName: "DARK", sectionTitle: sec });
}

function content(p, sec, title, kicker) {
  ensureSection(p, sec);
  const s = p.addSlide({ masterName: "CONTENT", sectionTitle: sec });
  s.addText(title, { placeholder: "title" });
  if (kicker) s.addText(kicker, { x: 0.6, y: 1.18, w: 12.1, h: 0.45, fontSize: 16, italic: true, color: K.slate, margin: 0, isTextBox: true });
  return s;
}

function card(p, s, x, y, w, h, fill, opts = {}) {
  s.addShape(p.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, fill: { color: fill }, rectRadius: 0.08,
    line: { color: opts.line || fill, width: opts.lw || 0.75, dashType: opts.dash || "solid" },
    shadow: opts.shadow ? { type: "outer", color: "000000", opacity: 0.12, blur: 6, offset: 2, angle: 90 } : undefined,
    objectName: opts.name,
  });
}

// Circle badge with short text (the deck's motif)
function badge(p, s, x, y, d, fill, label, fs = 14) {
  s.addShape(p.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
  s.addText(label, { x, y, w: d, h: d, align: "center", valign: "middle", bold: true, color: K.white, fontSize: fs, margin: 0, isTextBox: true });
}

function txt(s, text, x, y, w, h, o = {}) {
  s.addText(text, Object.assign({ x, y, w, h, fontSize: 14, color: K.text, margin: 0, valign: "top", isTextBox: true }, o));
}

function bullets(items, o = {}) {
  return items.map((t, i) => {
    const base = { bullet: true, paraSpaceAfter: o.gap ?? 6, breakLine: i < items.length - 1 };
    if (typeof t === "string") return { text: t, options: base };
    return { text: t.text, options: Object.assign(base, t.options) };
  });
}

function code(p, s, text, x, y, w, h, fs = 12) {
  card(p, s, x, y, w, h, K.code);
  s.addText(text, { x: x + 0.2, y: y + 0.15, w: w - 0.4, h: h - 0.3, fontFace: "Courier New", fontSize: fs, color: K.codeText, valign: "top", margin: 0, isTextBox: true });
}

function arrow(p, s, x1, y1, x2, y2, color = K.muted) {
  s.addShape(p.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001,
    flipH: x2 < x1, flipV: y2 < y1, line: { color, width: 1.75, endArrowType: "triangle" } });
}

// Coral tag marking content the team must replace with their own evidence
function todoTag(p, s, x, y, label, w = 3.6) {
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.32, fill: { color: K.coral }, line: { color: K.coral }, rectRadius: 0.08 });
  s.addText(label, { x, y, w, h: 0.32, fontSize: 10, bold: true, color: K.white, align: "center", valign: "middle", margin: 0, isTextBox: true });
}

function chartOpts(extra) {
  return Object.assign({
    catAxisLabelColor: K.muted, valAxisLabelColor: K.muted, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
    catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
    valGridLine: { color: "E3E8ED", size: 0.75 }, catGridLine: { style: "none" },
    showLegend: true, legendPos: "b", legendFontSize: 11, legendFontFace: "+mn-lt", legendColor: K.text,
    showTitle: true, titleFontSize: 13, titleColor: K.ink, titleFontFace: "+mn-lt",
    dataLabelFontFace: "+mn-lt", dataLabelFontSize: 10, dataLabelColor: K.text,
    valAxisTitleFontFace: "+mn-lt", catAxisTitleFontFace: "+mn-lt", valAxisTitleColor: K.muted, catAxisTitleColor: K.muted,
    valAxisTitleFontSize: 11, catAxisTitleFontSize: 11,
  }, extra);
}

function table(s, rows, x, y, colW, o = {}) {
  s.addTable(rows, Object.assign({ x, y, w: colW.reduce((a, b) => a + b, 0), colW, fontFace: "Calibri", fontSize: 11, color: K.text,
    border: { type: "solid", pt: 0.5, color: K.line }, valign: "middle", margin: [0.04, 0.06, 0.04, 0.06] }, o));
}
const hdr = (t, fill = K.ink) => ({ text: t, options: { bold: true, color: K.white, fill: { color: fill } } });

async function save(p, file) {
  await p.writeFile({ fileName: file });
  await applyTheme(file, THEME);
  console.log("wrote", file);
}

module.exports = { K, newDeck, content, darkSlide, card, badge, txt, bullets, code, arrow, todoTag, chartOpts, table, hdr, save };
