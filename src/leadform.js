// Lead form widget (newsletter, contact, download, callback). Loaded by the tracker
// only when a form is shown: as a popup, or inline inside the site's
// <div data-analytics-leadform="id">. Renders inside a shadow root, so the
// site's CSS reaches it only through the hooks followLook describes.
// `step_groups` splits the fields over steps.
// Callbacks: submit(values, extra) -> Promise<{ status, field, message }>,
// submitted(), close() (closed without sending), done(); shield, the
// page's spam protection (shield.js) when the site uses it; and image, the
// URL of a popup's image (above the form, or beside it in centred popups);
// and branded, whether the thank-you says "Powered by SiteGoose". renderLauncher
// draws the floating button that opens a "button" popup.

const DEFAULTS = { button: "Subscribe", thanks: "Thanks! You're on the list.", next: "Next", back: "Back", close: "Close", download: "Download", copy: "Copy", copied: "Copied ✓" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The colours the box is drawn in. The owner can pick its background; the
// text, lines and field fills are worked out from that one colour, so a dark
// brand colour gets light text without anyone choosing it and no background
// can leave the widget unreadable. With no background it is the theme's own
// pair, exactly as before. The lines and fills are translucent black or white
// because the box behind them is always solid, so one pair of tints suits
// every hue. Identical in survey.js, notice.js, feedback.js and
// frontend/src/features/widgets/widgetSurface.js — change all five together.
const SURFACE_HEX = /^#[0-9a-f]{6}$/i;
const INK = "#111827";
const PAPER = "#f9fafb";
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// Decided by contrast rather than a luminance cut, so mid-tones go the right
// way round.
const textOn = (bg) => (contrast(bg, INK) >= contrast(bg, PAPER) ? INK : PAPER);
const surface = (look) => {
  const bg = SURFACE_HEX.test(look.background || "") ? look.background : "";
  if (!bg) {
    return look.theme === "dark"
      ? { deep: true, bg: INK, fg: PAPER, line: "#374151", faint: "#1f2937", fieldLine: "#4b5563", field: "#1f2937", mute: "#1f2937", chip: "#00000066" }
      : { deep: false, bg: "#ffffff", fg: INK, line: "#e5e7eb", faint: "#f3f4f6", fieldLine: "#d1d5db", field: "#ffffff", mute: "#f3f4f6", chip: "#ffffffcc" };
  }
  const fg = textOn(bg);
  const deep = fg === PAPER;
  return {
    deep,
    bg,
    fg,
    line: deep ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)",
    faint: deep ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.06)",
    fieldLine: deep ? "rgba(255,255,255,.34)" : "rgba(0,0,0,.24)",
    // A field on a light background reads as paper, not a hole in it.
    field: deep ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.72)",
    mute: deep ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.07)",
    // A chip that floats over whatever is behind it (a close button on an image).
    chip: deep ? "rgba(0,0,0,.4)" : "rgba(255,255,255,.85)",
  };
};

// What the site asks of the widget from its own pages. A theme of "auto" is
// dark when the site marks itself dark on <html> or <body> (a dark or light
// class, or data-theme / data-bs-theme), and otherwise when the visitor's
// system is. The site's own CSS can set three properties on [data-sg-widget],
// or anywhere above it: --sg-bg, which goes through surface() exactly as a
// background picked in the dashboard does, so the text and lines follow it and
// no colour can leave the widget unreadable; --sg-accent; and --sg-font. Those
// names, data-sg-widget and the ::part() names (box, title, label, field,
// button) are a promise to every site that uses them: never rename one. A
// colour is read through a probe element, so any solid CSS colour works; a
// see-through one is ignored, because the derived tints need a solid box
// behind them. draw(look, font) runs now and again whenever the answer
// changes; call update() once the host is on the page and stop() when it
// goes. Identical in leadform.js, survey.js, notice.js and feedback.js —
// siteLook.test.js holds the four together.
const SITE_MARKS = ["class", "data-theme", "data-bs-theme"];
const siteDark = () => {
  for (const node of [document.documentElement, document.body]) {
    if (!node) continue;
    const marks = SITE_MARKS.flatMap((name) => (name === "class" ? [...node.classList] : [node.getAttribute(name)]));
    if (marks.includes("dark")) return true;
    if (marks.includes("light")) return false;
  }
  return Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
};
// Some browsers keep decimals in the channels of a converted colour.
const RGB = /^rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)$/;
const siteColor = (raw, probe) => {
  if (!raw) return "";
  probe.style.color = "";
  probe.style.color = raw;
  const m = probe.style.color && RGB.exec(getComputedStyle(probe).color);
  if (!m || (m[4] !== undefined && Number(m[4]) < 1)) return "";
  return `#${m.slice(1, 4).map((n) => Math.min(255, Math.round(Number(n))).toString(16).padStart(2, "0")).join("")}`;
};
// A font list can't carry anything that would end the declaration it goes
// into, or open a comment or a string that would swallow what comes after it,
// so one with an unclosed quote (or one the length cap cut through) is dropped.
const cleanFont = (raw) => {
  const font = raw.replace(/[{};<>\\/\n\r]/g, "").slice(0, 300).trim();
  return font.split('"').length % 2 && font.split("'").length % 2 ? font : "";
};
// The owner's own class names for this widget (look.css_class), put on the
// host beside data-sg-widget so the site's CSS can single one widget out. Only
// plain class names, at most five (shared/cssClass.js in the backend); anything
// else is skipped rather than reaching the page.
const CLASS_NAME = /^-?[A-Za-z_][A-Za-z0-9_-]{0,39}$/;
const siteClasses = (value) => (typeof value === "string" ? value.trim().split(/\s+/).filter((name) => CLASS_NAME.test(name)).slice(0, 5) : []);
const followLook = (kind, host, root, look, draw) => {
  host.setAttribute("data-sg-widget", kind);
  for (const name of siteClasses(look.css_class)) host.classList.add(name);
  const probe = document.createElement("i");
  probe.hidden = true;
  root.append(probe);
  let drawn = "";
  let placed = false;
  const update = () => {
    // A widget the page took away itself (a single-page site moving on) stops
    // listening the next time anything changes.
    if (host.isConnected) placed = true;
    else if (placed) return stop();
    const props = host.isConnected ? getComputedStyle(host) : null;
    const read = (name) => (props ? props.getPropertyValue(name).trim() : "");
    const background = siteColor(read("--sg-bg"), probe);
    const accent = siteColor(read("--sg-accent"), probe);
    const font = cleanFont(read("--sg-font"));
    const seen = {
      ...look,
      theme: look.theme === "auto" ? (siteDark() ? "dark" : "light") : look.theme,
      ...(background && { background }),
      ...(accent && { color: accent }),
    };
    const key = JSON.stringify([seen, font]);
    if (key === drawn) return;
    drawn = key;
    draw(seen, font);
  };
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", update);
  const marks = typeof MutationObserver === "function" ? new MutationObserver(update) : null;
  // The page's own style attribute too: some sites set their colours there.
  if (document.documentElement) marks?.observe(document.documentElement, { attributes: true, attributeFilter: [...SITE_MARKS, "style"] });
  if (document.body) marks?.observe(document.body, { attributes: true, attributeFilter: SITE_MARKS });
  // A stylesheet that arrives after the widget can still set the properties.
  if (document.readyState !== "complete") window.addEventListener("load", update);
  function stop() {
    media?.removeEventListener?.("change", update);
    marks?.disconnect();
    window.removeEventListener("load", update);
  }
  update();
  return { update, stop };
};

// `l` is the look as lookOf settled it, so every value here comes out of LOOKS;
// `font` is the system stack or the site's own, already cleaned.
const css = (color, s, mode, l, font) => {
  const [boxRadius, fieldRadius, buttonRadius] = LOOKS.radius[l.radius];
  const [pad, gap] = LOOKS.density[l.density];
  // Not the tick boxes, radios or a slider's track: only boxes you type in.
  const typed = "input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea";
  return `
  :host { all: initial; }
  [hidden] { display: none !important; }
  .wrap {
    box-sizing: border-box; font: 15px/1.4 ${font};
    ${mode === "center" ? "position: fixed; z-index: 2147483000; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,.35);" : ""}
    ${mode === "corner" ? "position: fixed; z-index: 2147483000; right: 16px; bottom: 16px; left: 16px; display: flex; justify-content: flex-end; pointer-events: none;" : ""}
    ${mode === "full" ? `position: fixed; z-index: 2147483000; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px 16px; overflow: auto; background: ${s.bg};` : ""}
  }
  .box {
    pointer-events: auto; box-sizing: border-box; width: 100%; max-width: ${mode === "inline" ? "480px" : mode === "full" ? "640px" : "380px"}; padding: ${pad}px;
    border-radius: ${boxRadius}px; ${mode === "inline" || mode === "full" ? "" : "box-shadow: 0 10px 30px rgba(0,0,0,.2);"}
    background: ${s.bg}; color: ${s.fg};
    border: ${mode === "full" ? "0" : `1px solid ${s.line}`};
    ${mode === "full" ? "margin: auto;" : ""}
  }
  .head { display: flex; align-items: flex-start; gap: 12px; }
  .title { flex: 1; margin: 0 0 6px; font-size: ${mode === "full" ? "26px" : "18px"}; font-weight: 700; }
  .desc { margin: 0 0 14px; opacity: .8; }
  .x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; font-size: 18px; line-height: 1; padding: 2px; }
  .x:hover, .x:focus-visible { opacity: 1; }
  form, .qs { display: flex; flex-direction: column; gap: ${gap}px; margin: 0; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 14px; font-weight: 600; }
  input, select, textarea {
    box-sizing: border-box; width: 100%; padding: 9px 12px; border-radius: ${fieldRadius}px; font: inherit; font-weight: 400;
    border: 1px solid ${s.fieldLine}; background: ${s.field}; color: inherit;
  }
  ${l.inputs === "filled" ? `${typed} { border-color: transparent; background: ${s.mute}; }` : ""}
  ${l.inputs === "line" ? `${typed} { border-width: 0 0 1px; border-radius: 0; padding-left: 2px; padding-right: 2px; background: transparent; }` : ""}
  textarea { min-height: 80px; resize: vertical; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: ${color}; box-shadow: 0 0 0 3px ${color}33; }
  [aria-invalid=true] { border-color: #dc2626; }
  .check { flex-direction: row; align-items: flex-start; gap: 8px; font-weight: 400; font-size: 13px; }
  .check input { width: auto; margin: 2px 0 0; }
  .field { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .cap { font-weight: 600; }
  .group { display: flex; flex-direction: column; gap: 6px; }
  .group[aria-invalid=true] { border: 0; }
  .group[aria-invalid=true] .check span { color: #dc2626; }
  .range { display: flex; align-items: center; gap: 10px; }
  .range input { padding: 0; }
  .out { flex: none; min-width: 3.5em; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  .step { display: flex; align-items: center; gap: 6px; }
  .step input { text-align: center; }
  .step button { flex: none; width: 38px; height: 38px; padding: 0; border-radius: ${fieldRadius}px; cursor: pointer; font: inherit; font-size: 18px; font-weight: 600;
    border: 1px solid ${s.fieldLine}; background: ${s.field}; color: inherit; }
  .step button:hover { border-color: ${color}; }
  .seg { flex-direction: row; flex-wrap: wrap; }
  .seg .check, .cards .check { padding: 8px 12px; border-radius: ${fieldRadius}px; font-size: 14px; font-weight: 500; cursor: pointer;
    border: 1px solid ${s.fieldLine}; }
  .seg .check input, .cards .check input { position: absolute; width: 1px; height: 1px; opacity: 0; }
  .seg .check.on { border-color: ${color}; box-shadow: 0 0 0 2px ${color}33; }
  .seg .check:focus-within, .cards .check:focus-within { outline: 2px solid ${color}; outline-offset: 2px; }
  /* Choices as cards: a whole row to tap, its letter key on it. */
  .cards .check { position: relative; align-items: center; gap: 10px; padding: 10px 12px; background: ${s.field}; }
  .cards .check:hover { border-color: ${color}; }
  .cards .check.on { border-color: ${color}; background: ${color}1f; }
  .key { flex: none; display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 4px;
    border: 1px solid ${s.fieldLine}; font-size: 12px; font-weight: 700; }
  .on .key { border-color: ${color}; background: ${color}; color: #fff; }
  .sum { font-size: 20px; font-weight: 700; }
  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .err { margin: 0; color: #dc2626; font-size: 13px; }
  .foot { display: flex; align-items: center; gap: 8px; }
  .prog { height: 4px; border-radius: 2px; background: ${s.mute}; overflow: hidden; }
  .prog i { display: block; height: 100%; width: 0; background: ${color}; transition: width .25s; }
  .btn { margin-left: auto; border: 0; border-radius: ${buttonRadius}px; padding: 10px 16px; cursor: pointer; font: inherit; font-weight: 600; background: ${color}; color: #fff; text-decoration: none; display: inline-block; }
  ${l.button === "full" ? ".foot .btn { flex: 1; margin-left: 0; text-align: center; }" : ""}
  /* The button beside a lone box to type in: the box and the button share a
     row, the rest (consent, errors) go full width under them. */
  form.beside { flex-direction: row; flex-wrap: wrap; align-items: flex-end; }
  form.beside > * { flex: 1 1 100%; order: 3; }
  form.beside > .prog { order: 0; }
  form.beside > .qs { flex: 1 1 12em; order: 1; min-width: 0; }
  form.beside > .foot { flex: 0 0 auto; order: 2; }
  /* The question kept for screen readers, its box showing it instead. */
  .in > .q { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  ${l.box === "none" && mode === "inline" ? ".box { padding: 0; border: 0; border-radius: 0; background: transparent; }" : ""}
  .btn[disabled] { opacity: .5; cursor: default; }
  /* One question at a time: the question is the page. */
  .single .q { font-size: 19px; font-weight: 700; line-height: 1.3; }
  .single .cards .check, .single .seg .check { font-size: 15px; }
  /* A new step slides in from the side it comes from. Only the box's insides
     move, never its height, so the page under an inline form doesn't jump. */
  .go { animation: lf-in .22s ease-out; }
  .go.back { animation-name: lf-back; }
  @keyframes lf-in { from { opacity: 0; transform: translateX(14px); } }
  @keyframes lf-back { from { opacity: 0; transform: translateX(-14px); } }
  @media (prefers-reduced-motion: reduce) { .go { animation: none; } .prog i { transition: none; } }
  .link { border: 0; background: none; color: inherit; opacity: .7; cursor: pointer; font: inherit; }
  .thanks { margin: 0 0 12px; font-weight: 600; }
  .credit { margin: 10px 0 0; font-size: 12px; font-weight: 400; opacity: 0.7; }
  .credit a { color: inherit; text-decoration: none; }
  .credit a:hover { text-decoration: underline; }
  .code {
    display: inline-flex; align-items: center; gap: 8px; margin: 0 0 12px; padding: 4px 4px 4px 12px;
    border: 1.5px dashed currentColor; border-radius: 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; letter-spacing: .06em;
  }
  .copy {
    border: 0; border-radius: 6px; padding: 4px 10px; background: ${color}; color: #fff;
    font: 600 12px/1.5 inherit; letter-spacing: 0; cursor: pointer;
  }
  .copy:focus-visible { outline: 2px solid ${color}; outline-offset: 2px; }
  .box.pic { padding: 0; overflow: hidden auto; max-height: calc(100vh - 32px); }
  .box.pic .main { padding: 20px; }
  .media { background: ${s.mute}; }
  .media img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .top .media { aspect-ratio: var(--ratio, 16 / 9); max-height: ${mode === "center" ? "240px" : "160px"}; }
  .side { display: flex; max-width: ${mode === "full" ? "960px" : "720px"}; }
  .side .media { width: 44%; flex: none; }
  .side .main { flex: 1; align-self: center; }
  @media (max-width: 600px) {
    .side { flex-direction: column; }
    .side .media { width: 100%; aspect-ratio: 16 / 9; max-height: 160px; }
  }
`;
};

// The page's own font, for a form set to use it: read off the element the form
// sits in, or the page.
const siteFont = (node) => {
  try {
    return cleanFont(getComputedStyle(node).fontFamily);
  } catch {
    return "";
  }
};

// Six digits only: the CSS appends a two-digit alpha to it.
const accentOf = (look) => (/^#[0-9a-f]{6}$/i.test(look.color || "") ? look.color : "#2563eb");

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children) node.append(child);
  return node;
};

// "Powered by SiteGoose" under the thank-you, on the plans that carry it (the
// collector's `branded`). The words and the address are fixed here, so nothing
// in a site's settings can change them, and it has no part name, so the
// site's CSS doesn't reach it. The same in leadform.js, survey.js and feedback.js.
const credit = () => el("p", { class: "credit" }, [
  el("a", { href: "https://sitegoose.com/?utm_source=powered-by&utm_medium=widget", target: "_blank", rel: "noopener", text: "Powered by SiteGoose" }),
]);

const INPUT_TYPES = { email: "email", phone: "tel", name: "text", text: "text", number: "number", date: "date", url: "url" };
const AUTOCOMPLETE = { email: "email", phone: "tel", name: "name", url: "url" };
// A field drawn as one box to type in: what a button can sit beside. Keep in
// step with oneLine in the builder's leadsShared.js.
const oneLine = (f) => Boolean(INPUT_TYPES[f.type]) && !f.compute && !["slider", "stepper"].includes(f.control);
// Radio buttons and tick boxes: one control per option, not one per field.
const GROUP_TYPES = ["radio", "multi"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER = /^-?\d+(\.\d+)?$/;
// The formats a text field can ask for. Each is one bounded character class,
// so none of them can backtrack; keep them in step with Analytics/leads.js.
const FORMATS = {
  letters: [/^[\p{L}\s'-]+$/u, "Please use letters only."],
  digits: [/^\d+$/, "Please use digits only."],
  alnum: [/^[\p{L}\d\s'-]+$/u, "Please use letters and digits only."],
  postcode: [/^[A-Za-z\d][A-Za-z\d\s-]*$/, "Please enter a valid postcode."],
};
const httpUrl = (value) => {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};
// A date that exists: an impossible day rolls over (30 February becomes
// 2 March), so what comes back has to still read as what went in.
const realDate = (value) => {
  if (!ISO_DATE.test(value)) return false;
  const when = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(when.getTime()) && when.toISOString().slice(0, 10) === value;
};

// A slider's reading, as the visitor sees it. Keep identical to the builder's
// copy in frontend/src/features/leads/leadsShared.js.
const reading = (f, value) => {
  const shown = typeof f.decimals === "number" ? Number(value || 0).toFixed(f.decimals) : String(value);
  return `${f.prefix || ""}${shown}${f.unit ? ` ${f.unit}` : ""}`;
};

// How the form is drawn beyond its colours, read through this table and never
// written into the CSS as it arrived: a value this copy doesn't know falls back
// to the first, which is how every form looked before these existed. Keep the
// names in step with LOOK_OPTIONS in frontend/src/features/leads/leadsShared.js
// (expresscollect/test/leadFormLooks.test.js holds them together).
const LOOKS = {
  font: { own: 0, site: 1 },
  // Corners of the box, the answer boxes and the button.
  radius: { soft: [12, 8, 8], square: [2, 2, 2], round: [20, 12, 999] },
  inputs: { outline: 0, filled: 1, line: 2 },
  // Space inside the box, and between the questions.
  density: { normal: [20, 12], compact: [14, 8], roomy: [28, 18] },
  choices: { plain: 0, cards: 1 },
  // "beside": next to the answer, when the form is one box to type in.
  button: { auto: 0, full: 1, beside: 2 },
  // "none": a form on the page with no frame of its own (popups keep theirs).
  box: { card: 0, none: 1 },
  // "inside": a box you type in shows its question as its placeholder.
  labels: { above: 0, inside: 1 },
};
const lookOf = (look) => Object.fromEntries(Object.entries(LOOKS).map(([key, values]) => {
  const names = Object.keys(values);
  return [key, names.includes(look?.[key]) ? look[key] : names[0]];
}));
const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// A choice's letter key, shown on it as a card: A for the first.
const letterOf = (k) => String.fromCharCode(65 + k);
// The choice a key picks, or -1: letters only, and only as many as there are.
const pickedByKey = (key, count) => {
  if (typeof key !== "string" || !/^[a-z]$/i.test(key)) return -1;
  const k = key.toLowerCase().charCodeAt(0) - 97;
  return k < count ? k : -1;
};
// Whether picking an answer moves the visitor on by itself: only when the step
// asks that one question, it takes a single answer, and a step follows. On the
// last step a pick would send the form, which is the visitor's call to make.
const movesOn = (onStep, last) => !last && onStep.length === 1 && onStep[0].type === "radio";
// How far through the visitor is, counted over the steps still on show.
const progressOf = (shown, step) => ({ at: shown.indexOf(step) + 1, of: shown.length });
// Enter in long text moves on only in a one-question-at-a-time form, and never
// on a touch screen, whose keyboard has no Shift for a new line.
const enterMovesOn = (single, coarse, shift) => single && !coarse && !shift;

// The shadow root's styles as a constructed sheet, which a site's
// Content-Security-Policy style-src doesn't block (a <style> here would be,
// leaving everything unstyled); a <style> where that isn't supported. Either
// way, set .textContent to restyle.
function shadowStyle(root, text = "") {
  try {
    if (!(root instanceof ShadowRoot)) throw new Error("no shadow root");
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return { set textContent(value) { sheet.replaceSync(value); } };
  } catch {
    const style = document.createElement("style");
    style.textContent = text;
    root.append(style);
    return style;
  }
}

// What a field's answer counts as when a condition looks at it: the values
// chosen, empty when it wasn't answered. Only a tick-box group has several.
// This reads what was posted, not a checked value, because visibility has to
// be settled before anything is validated — see where it's called.
function chosenOf(field, raw) {
  if (field.type === "checkbox") return raw === true ? ["yes"] : [];
  if (Array.isArray(raw)) return raw.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim());
  if (typeof raw !== "string") return [];
  const value = raw.trim();
  if (!value) return [];
  // A tick-box group sent as text, by a tracker too old to render one.
  return field.type === "multi" ? value.split(", ").filter(Boolean) : [value];
}

// A condition is a list of rules and whether all of them must hold or any one.
// A single rule written straight onto the condition is the shape saved before
// a field could carry more than one, and still means what it always did.
const rulesOf = (cond) => (Array.isArray(cond?.rules) ? cond.rules : cond?.field ? [cond] : []);

// One rule against the values the field it names holds. Numbers compare as
// numbers, and a worked-out field answers with its amount in whole units —
// which is what the dashboard saves the rule's own figure as, so the two are
// always counted in the same thing. Dates compare as the text they are kept
// in, which for YYYY-MM-DD sorts the same way.
const conditionMet = (rule, picked) => {
  if (rule.op === "filled") return picked.length > 0;
  if (rule.op === "empty") return picked.length === 0;
  const wanted = String(rule.value ?? "");
  const holding = (v) => String(v).toLowerCase().includes(wanted.toLowerCase());
  if (rule.op === "contains") return picked.some(holding);
  if (rule.op === "ncontains") return !picked.some(holding);
  if (rule.op === "before" || rule.op === "after") {
    const date = picked.length ? String(picked[0]) : "";
    return Boolean(date) && (rule.op === "before" ? date < wanted : date > wanted);
  }
  if (rule.op === "gt" || rule.op === "gte" || rule.op === "lt" || rule.op === "lte") {
    const mine = picked.length ? Number(picked[0]) : NaN;
    const theirs = Number(wanted);
    if (!Number.isFinite(mine) || !Number.isFinite(theirs)) return false;
    if (rule.op === "gt") return mine > theirs;
    if (rule.op === "gte") return mine >= theirs;
    return rule.op === "lt" ? mine < theirs : mine <= theirs;
  }
  // "is", "not", and whatever a newer dashboard writes that this copy doesn't
  // know yet: an unknown op reads as "is" rather than hiding the field, so an
  // older widget shows one field too many instead of walling the visitor out
  // of a step they then can't get past.
  const has = picked.includes(rule.value);
  return rule.op === "not" ? !has : has;
};

// What the visitor is shown, what every worked-out field comes to, and which
// fields they have to fill in — all settled in one pass over the fields.
//
// One pass is enough because a condition and a worked-out rule can only ever
// name a field above, and it has to be one pass because the two lean on each
// other: a field can be shown on what a quote comes to, and that quote can
// only be worked out once the fields it adds up are known to be on show.
// Anything the visitor cannot see counts as unanswered throughout, so nothing
// posted for a hidden field can change what is shown, what is required, or
// what any figure comes to.
//
// `answerOf(id)` gives a field's answer as it was entered or posted: true or
// false for a tick box, a list for a tick-box group, text for the rest.
// `context` is what is known about the visit rather than about the answers —
// the visitor's country and device — which rules name "@country" and
// "@device". Both sides work those out from the same request, so neither can
// be claimed by whoever is filling the form in.
//
// Keep identical in all three copies: expresscollect/Analytics/leads.js (the
// one that counts), expresscollect/tracker/leadform.js (what the visitor
// watches as they fill it in) and frontend/src/features/leads/leadsShared.js
// (the builder's preview).
function settleFields(fields, answerOf, context) {
  const visible = new Set();
  const required = new Set();
  const amounts = new Map();
  const byId = new Map((fields || []).map((f) => [f.id, f]));
  // What a rule reads for the field it names: the visit's own facts for an
  // "@" name, a worked-out field's amount for one of those, and nothing at all
  // for a field the visitor can't see.
  const pickedOf = (id) => {
    if (id === "@country" || id === "@device") {
      const fact = (context && context[id.slice(1)]) || "";
      return fact ? [String(fact)] : [];
    }
    const field = byId.get(id);
    if (!field || !visible.has(id)) return [];
    if (field.compute) return amounts.has(id) ? [String(amounts.get(id))] : [];
    return chosenOf(field, answerOf(id));
  };
  const holds = (cond) => {
    const rules = rulesOf(cond);
    if (!rules.length) return false;
    // A rule naming a field the form hasn't got, or one the visitor can't
    // see, never holds — so a chain of conditions collapses together.
    const met = (rule) => (rule.field === "@country" || rule.field === "@device" || visible.has(rule.field))
      && conditionMet(rule, pickedOf(rule.field));
    return cond.match === "any" ? rules.some(met) : rules.every(met);
  };
  // An earlier field as a number: a worked-out one from what was settled above
  // it, anything else from its answer. Unanswered counts as nothing.
  const numberOf = (id) => {
    if (amounts.has(id)) return amounts.get(id);
    if (!visible.has(id)) return 0;
    const answer = answerOf(id);
    const value = Number(Array.isArray(answer) ? NaN : answer);
    return Number.isFinite(value) ? value : 0;
  };
  for (const field of fields || []) {
    if (!field.show_if || holds(field.show_if)) visible.add(field.id);
    if (!visible.has(field.id)) continue;
    // Always required, or required only on an answer — which is a field that
    // is always on show and only sometimes insisted on.
    if (field.required || (field.require_if && holds(field.require_if))) required.add(field.id);
    if (!field.compute) continue;
    const rule = field.compute;
    let amount = 0;
    if (rule.op === "sum") {
      for (const term of rule.of || []) {
        if (typeof term.const === "number") amount += term.const;
        else if (typeof term.times === "number") {
          // One answer at a rate, or two answers multiplied first: width by
          // length by a rate per square metre.
          const count = term.by ? numberOf(term.field) * numberOf(term.by) : numberOf(term.field);
          amount += Math.round(count * term.times);
        } else if (term.per_option) {
          let each = 0;
          for (const picked of pickedOf(term.field)) {
            // Read off a plain object, so an answer of "constructor" has to be
            // checked rather than trusted to come back as a number.
            const one = term.per_option[picked];
            if (typeof one === "number") each += one;
          }
          // `by` turns the option's figure into a rate: the price per square
          // metre of the material chosen, over the area asked for.
          amount += term.by ? Math.round(each * numberOf(term.by)) : each;
        } else if (term.field) amount += term.take ? -numberOf(term.field) : numberOf(term.field);
      }
    } else if (rule.op === "percent") {
      // The rate is either fixed or an answer of its own, so a "deposit %"
      // slider can be the percentage itself: 12.5 there means 12.5%.
      const bp = typeof rule.bp === "number" ? rule.bp : Math.round(numberOf(rule.rate_from) * 100);
      amount = Math.round((numberOf(rule.of) * bp) / 10000);
    } else if (rule.op === "clamp") {
      amount = numberOf(rule.of);
      if (typeof rule.min === "number") amount = Math.max(rule.min, amount);
      if (typeof rule.max === "number") amount = Math.min(rule.max, amount);
    } else if (rule.op === "tier") {
      // Bands over an answer, lowest top first, the last of them with no top
      // at all. "once" takes the band's amount as it stands, "all" takes it as
      // a rate over the whole answer, and "steps" charges each band's rate for
      // only the part of the answer inside that band.
      const count = numberOf(rule.of);
      const bands = rule.bands || [];
      if (rule.how === "steps") {
        let from = 0;
        for (const band of bands) {
          const top = typeof band.upto === "number" ? band.upto : Infinity;
          const within = Math.min(count, top) - from;
          if (within > 0 && typeof band.amount === "number") amount += Math.round(within * band.amount);
          from = top;
          if (count <= top) break;
        }
      } else {
        const band = bands.find((b) => typeof b.upto !== "number" || count <= b.upto) || bands[bands.length - 1];
        const each = typeof band?.amount === "number" ? band.amount : 0;
        amount = rule.how === "all" ? Math.round(count * each) : each;
      }
    } else if (rule.op === "ratio") {
      // An amount shared out over an answer: a total between the people it is
      // split between, a year's price over twelve months. Nothing to share it
      // over leaves it at nothing rather than at infinity.
      const per = numberOf(rule.per);
      amount = per ? Math.round(numberOf(rule.of) / per) : 0;
    } else if (rule.op === "round") {
      // To the nearest something, or always up (a part hour is an hour).
      const to = typeof rule.to === "number" && rule.to > 0 ? rule.to : 1;
      const steps = numberOf(rule.of) / to;
      amount = to * (rule.how === "up" ? Math.ceil(steps) : rule.how === "down" ? Math.floor(steps) : Math.round(steps));
    }
    // An op from a newer dashboard than this copy leaves the amount at nothing
    // rather than showing a wrong figure.
    amounts.set(field.id, amount);
  }
  // `holds` is handed back so that everything else a form decides from the
  // answers — which tags a lead gets, which thank-you it ends on, who is told
  // about it — is settled by this same function, against the fields that were
  // really on show. It is only meaningful once the loop above has finished.
  return { visible, required, amounts, holds };
}

// A worked-out amount as it is read: whole units become a figure with the
// field's decimal places, wrapped in its prefix and unit. Keep identical in the
// same three copies as settleFields.
const amountText = (field, amount) => {
  const places = typeof field.decimals === "number" ? field.decimals : 2;
  // The sign goes in front of the prefix, not between it and the figure: a
  // discount reads "-£50.00", never "£-50.00".
  const figure = (Math.abs(amount) / 10 ** places).toFixed(places);
  return `${amount < 0 ? "-" : ""}${field.prefix || ""}${figure}${field.unit ? ` ${field.unit}` : ""}`;
};

export function renderLeadForm(form, mount, callbacks) {
  const texts = { ...DEFAULTS, button: form.button || DEFAULTS.button, thanks: form.thanks || DEFAULTS.thanks };
  // A calculator rather than a form: the figures are worked out here as the
  // visitor answers and nothing is ever sent, so it has no Send button, no
  // spam protection to apply, nothing required and no ending. A form saved
  // before this existed carries no such key and sends, as it always did.
  const sends = form.submit !== false;
  const look = form.look || {};
  const mode = mount ? "inline" : look.position === "center" ? "center" : look.position === "full" ? "full" : "corner";
  // Centred and full-screen popups are in front of the page rather than beside
  // it: the page holds still under them and focus stays inside.
  const modal = mode === "center" || mode === "full";
  const l = lookOf(look);
  // Leads are told apart by email, so it is required, unless the form asks
  // for a phone number instead (callbacks): then one of the two will do.
  const all = (form.fields || []).filter((f) => f && f.id && f.label);
  const hasPhone = all.some((f) => f.type === "phone");
  const hasEmail = all.some((f) => f.type === "email");
  const fields = all.map((f) => ((f.type === "email" && !hasPhone) || (f.type === "phone" && !hasEmail) ? { ...f, required: true } : f));
  // Both asked for and neither required: checked on the last step.
  const emailField = hasPhone && fields.find((f) => f.type === "email" && !f.required);
  const phoneField = emailField && fields.find((f) => f.type === "phone" && !f.required);
  if (!fields.length) {
    callbacks.done();
    return;
  }

  const host = document.createElement("div");
  host.setAttribute("data-noanalytics", "");
  const root = host.attachShadow({ mode: "open" });
  const style = shadowStyle(root);
  // The site's --sg-font comes before the look's own choice of font.
  const pageFont = (l.font === "site" && siteFont(mount || document.body)) || SYSTEM_FONT;
  const site = followLook("leadform", host, root, look, (seen, font) => {
    style.textContent = css(accentOf(seen), surface(seen), mode, l, font || pageFont);
  });
  const box = el("div", mode === "inline" ? { class: "box", part: "box" } : { class: "box", part: "box", role: "dialog", "aria-modal": modal ? "true" : "false", "aria-labelledby": "t" });
  // With an image, the form goes in .main beside or under it. Full screen has
  // the room to put it beside on a wide screen; on a phone it goes above.
  const main = callbacks.image ? el("div", { class: "main" }) : box;
  if (callbacks.image) {
    const image = form.image || {};
    box.classList.add("pic", mode === "full" || (mode === "center" && form.image_layout === "side") ? "side" : "top");
    if (image.width && image.height) box.style.setProperty("--ratio", `${image.width} / ${image.height}`);
    const media = el("div", { class: "media" }, [el("img", {
      src: callbacks.image, alt: image.alt || "", decoding: "async", width: image.width, height: image.height,
      onerror: () => media.remove(),
    })]);
    box.append(media, main);
  }
  root.append(el("div", { class: "wrap" }, [box]));
  (mount || document.body).append(host);
  site.update();

  // The page stops scrolling under a modal popup. Whatever it was set to
  // before is what it goes back to, so a page some other popup is already
  // holding still stays held when this one closes.
  const page = document.documentElement;
  const scrollWas = modal ? page.style.overflow : null;
  if (modal) page.style.overflow = "hidden";

  let closed = false;
  // Set below by a calculator, to report what was priced before it goes.
  let onGone = null;
  const finish = () => {
    if (closed) return;
    onGone?.();
    closed = true;
    document.removeEventListener("keydown", onKey, true);
    if (modal) page.style.overflow = scrollWas;
    if (mount) return;
    site.stop();
    host.remove();
  };
  const close = () => {
    if (closed) return;
    finish();
    callbacks.close();
  };
  // What Tab can land on, in order. A radio group is one stop, so two options
  // of the same group count as the same place.
  const sameStop = (a, b) => a === b || (a?.type === "radio" && b?.type === "radio" && a.name === b.name);
  const stops = () => [...box.querySelectorAll("a[href], button, input, select, textarea")]
    .filter((n) => !n.disabled && n.tabIndex >= 0 && n.getClientRects().length);
  // A corner popup isn't modal: Esc closes it only from inside, not when the
  // visitor is closing the site's own menu. A modal one closes on Esc from
  // anywhere, and Tab goes round inside it rather than out to the page behind.
  const onKey = (e) => {
    if (e.key === "Escape" && (modal || e.composedPath().includes(host))) close();
    if (!modal || e.key !== "Tab") return;
    const list = stops();
    if (!list.length) return;
    // The page sees the whole widget as one element; inside, the shadow root
    // knows which of its own has focus.
    const now = root.activeElement;
    const [first, last] = [list[0], list[list.length - 1]];
    if (!list.includes(now)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && sameStop(now, first)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && sameStop(now, last)) {
      e.preventDefault();
      first.focus();
    }
  };
  if (!mount) document.addEventListener("keydown", onKey, true);

  // One control per field, except radio and tick-box groups, whose options
  // each get an input of their own and are read out of `picks`.
  const controls = new Map();
  const picks = new Map();
  // Worked-out fields: the element each one's figure is written into.
  const sums = new Map();
  // Each field's caption, so its star can follow what is required right now.
  const caps = new Map();
  // A form that asks one thing (a newsletter's email) shows no star: there is
  // nothing else for it to be told apart from. It is still required.
  const starred = fields.filter((f) => !f.compute).length > 1;
  const rows = fields.map((f) => {
    // `control` is what the value is read from and the error is put on; `wrap`
    // is what is drawn, when the control needs company (a reading, buttons).
    let control;
    let wrap = null;
    if (f.compute) {
      // Worked out, never answered: there is no input, so nothing is posted for
      // it and nothing the visitor can reach decides the figure. The collector
      // works the same one out again from the answers it keeps.
      control = el("span", { class: "sum", role: "status", "aria-live": "polite" });
      sums.set(f.id, control);
    } else if (f.type === "textarea") control = el("textarea", { name: f.id, part: "field", maxlength: "2000", required: f.required });
    else if (f.type === "select") {
      control = el("select", { name: f.id, part: "field", required: f.required }, [
        el("option", { value: "", text: "—" }),
        ...(f.options || []).map((o) => el("option", { value: o, text: o })),
      ]);
    } else if (f.type === "checkbox") control = el("input", { type: "checkbox", name: f.id });
    else if (GROUP_TYPES.includes(f.type)) {
      const inputs = (f.options || []).map((o) => el("input", { type: f.type === "radio" ? "radio" : "checkbox", name: f.id, value: o }));
      picks.set(f.id, inputs);
      const seg = f.control === "segmented";
      // A field drawn as buttons keeps them; every other choice follows the
      // form's look, and as cards each carries the letter that picks it.
      const cards = !seg && l.choices === "cards";
      const labels = inputs.map((input, k) => el("label", { class: "check", part: "label" }, [
        input,
        ...(cards ? [el("span", { class: "key", "aria-hidden": "true", text: letterOf(k) })] : []),
        el("span", { text: f.options[k] }),
      ]));
      // Shown as buttons or cards: the radio marks are hidden, so each option
      // paints itself. A :has() rule would do it in CSS; this works in older
      // browsers too, and the inputs underneath are still real radios.
      if (seg || cards) {
        const paint = () => labels.forEach((label, k) => { label.className = inputs[k].checked ? "check on" : "check"; });
        for (const input of inputs) input.addEventListener("change", paint);
      }
      // A click or a tap on an answer may move the visitor on. Arrow keys also
      // pick a radio and fire a click, but one with no pointer behind it
      // (detail 0): someone moving through the options with the keyboard is
      // still choosing, and must not be thrown onto the next question.
      if (f.type === "radio") {
        for (const label of labels) label.addEventListener("click", (e) => { if (e.detail > 0) pickedOne(f); });
      }
      control = el("div", { class: seg ? "group seg" : cards ? "group cards" : "group", role: f.type === "radio" ? "radiogroup" : "group", "aria-label": f.label }, labels);
    } else if (f.type === "number" && (f.control === "slider" || f.control === "stepper")) {
      // Presentation only: underneath it is the same number input, so the value
      // read, checked and posted is exactly what the plain box would send.
      const slider = f.control === "slider";
      control = el("input", {
        type: slider ? "range" : "number", name: f.id, part: slider ? undefined : "field", required: f.required, autocomplete: "off",
        placeholder: slider ? undefined : f.placeholder || undefined,
        min: f.min === undefined ? undefined : String(f.min),
        max: f.max === undefined ? undefined : String(f.max),
        step: f.step === undefined ? undefined : String(f.step),
        // A slider always has a value, so it starts at the low end rather than
        // the middle a browser would pick: an answer nobody chose should read as
        // the smallest one, not a number out of the air. Set last, because a
        // range input clamps it to min and max.
        value: slider ? String(f.min ?? 0) : undefined,
      });
      if (slider) {
        const out = el("span", { class: "out", text: reading(f, control.value) });
        control.addEventListener("input", () => { out.textContent = reading(f, control.value); });
        wrap = el("div", { class: "range" }, [control, out]);
      } else {
        const bump = (by) => () => {
          const size = f.step || 1;
          const now = Number(control.value === "" ? f.min ?? 0 : control.value);
          const next = Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, now + by * size));
          // Rounded, or a step of 0.1 walks into 0.30000000000000004.
          control.value = typeof f.decimals === "number" ? next.toFixed(f.decimals) : String(Math.round(next * 1e6) / 1e6);
          control.dispatchEvent(new Event("input", { bubbles: true }));
        };
        wrap = el("div", { class: "step" }, [
          el("button", { type: "button", text: "\u2212", "aria-label": `Less: ${f.label}`, onclick: bump(-1) }),
          control,
          el("button", { type: "button", text: "+", "aria-label": `More: ${f.label}`, onclick: bump(1) }),
        ]);
      }
    } else {
      control = el("input", {
        type: INPUT_TYPES[f.type] || "text", name: f.id, part: "field", maxlength: "300", required: f.required,
        autocomplete: AUTOCOMPLETE[f.type], placeholder: f.placeholder || undefined,
        // Lets the browser's own number and date pickers hold the same line
        // the collector does.
        min: f.min === undefined ? undefined : String(f.min),
        max: f.max === undefined ? undefined : String(f.max),
      });
    }
    controls.set(f.id, control);
    if (f.type === "checkbox") return el("label", { class: "check", part: "label" }, [control, el("span", { class: "q", text: f.label })]);
    // Kept, because a field required only on an answer gains and loses its
    // star as the visitor fills the form in. `q` is the question, drawn
    // larger when the form asks one at a time.
    // A group's caption is its label for ::part(); anywhere else the caption
    // sits inside the field's own label, which already is one.
    const grouped = GROUP_TYPES.includes(f.type) || f.compute;
    const caption = el("span", { class: grouped ? "cap q" : "q", part: grouped ? "label" : undefined }, []);
    caps.set(f.id, caption);
    // A group's options are each their own label, so the field's name can't be
    // one too: clicking it would tick the first option.
    // Inside the box: a box you type in shows the question as its
    // placeholder (its own placeholder, if it has one, says it better).
    const inside = l.labels === "inside" && !grouped
      && (control.tagName === "TEXTAREA" || (control.tagName === "INPUT" && !["range", "date"].includes(control.type)));
    if (inside) control.placeholder = f.placeholder || f.label;
    return grouped
      ? el("div", { class: "field" }, [caption, wrap || control])
      : el("label", { part: "label", class: inside ? "in" : undefined }, [caption, wrap || control]);
  });
  const consent = sends && form.consent ? el("input", { type: "checkbox", name: "consent" }) : null;
  const consentRow = consent ? el("label", { class: "check", part: "label" }, [consent, el("span", { text: form.consent })]) : null;
  // Bots fill every field; people never see this one.
  const honeypot = el("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off" });
  const error = el("p", { class: "err", role: "alert" });
  const started = Date.now();
  const shield = sends ? callbacks.shield || null : null;
  if (shield) shield.watchTrap(honeypot);
  const robotBox = shield?.mode === "checkbox" ? shield.box() : null;

  const valueOf = (f) => {
    if (f.compute) return "";
    if (f.type === "multi") return picks.get(f.id).filter((i) => i.checked).map((i) => i.value);
    if (f.type === "radio") return picks.get(f.id).find((i) => i.checked)?.value || "";
    const control = controls.get(f.id);
    return f.type === "checkbox" ? control.checked : control.value.trim();
  };
  // A group is marked as a whole but focused on its first option.
  const focusOf = (f) => (picks.has(f.id) ? picks.get(f.id)[0] : controls.get(f.id));
  // What's wrong with a value the visitor did fill in, in their own words.
  // The collector checks all of this again; this is only to say so sooner.
  const badValue = (f, value) => {
    if (f.type === "email") return EMAIL.test(value) ? "" : "Please enter a valid email address.";
    if (f.type === "url") return httpUrl(value) ? "" : "Please enter a full web address, starting with http:// or https://.";
    if (f.type === "number") {
      if (!NUMBER.test(value)) return "Please enter a number.";
      const n = Number(value);
      if (typeof f.min === "number" && n < f.min) return `Please enter ${f.min} or more.`;
      if (typeof f.max === "number" && n > f.max) return `Please enter ${f.max} or less.`;
      return "";
    }
    if (f.type === "date") {
      if (!realDate(value)) return "Please pick a date.";
      if (typeof f.min === "string" && value < f.min) return `Please pick a date no earlier than ${f.min}.`;
      if (typeof f.max === "string" && value > f.max) return `Please pick a date no later than ${f.max}.`;
      return "";
    }
    const format = (f.type === "text" || f.type === "textarea") && FORMATS[f.format];
    if (format) return format[0].test(value) ? "" : format[1];
    return "";
  };
  const conditional = fields.some((f) => f.show_if || f.require_if);
  const byId = new Map(fields.map((f) => [f.id, f]));
  // What is on show, what has to be filled in and what every figure comes to,
  // right now — by the same function the collector uses, so what the visitor
  // is quoted and asked for can't drift from what is kept. The collector
  // settles all three again from what arrives, and those are the ones that
  // count. `context` is the visit's own facts (country, device), which the
  // collector works out from the request instead of believing this copy.
  const settleNow = () => settleFields(fields, (id) => (byId.has(id) ? valueOf(byId.get(id)) : ""), callbacks.context);
  const visibleNow = () => settleNow().visible;
  const paintAmounts = (amounts) => {
    for (const [id, out] of sums) out.textContent = amounts.has(id) ? amountText(byId.get(id), amounts.get(id)) : "";
  };
  // The first problem among these fields, marked on the field. What must be
  // filled in is settled, not read off the field: a field can be required only
  // on an answer above it.
  const problemIn = (list, required) => {
    for (const f of list) {
      const value = valueOf(f);
      // A tick-box group's value is a list, and an empty list is still truthy.
      const empty = Array.isArray(value) ? value.length === 0 : !value;
      const problem = required.has(f.id) && empty ? `Please fill in ${f.label}.` : empty ? "" : badValue(f, value);
      controls.get(f.id).setAttribute("aria-invalid", String(Boolean(problem)));
      if (problem) {
        focusOf(f).focus();
        return problem;
      }
    }
    return "";
  };

  // Steps come as groups of field ids (publicLeadForm normalizes them): ids
  // this form doesn't have drop out, and whatever the groups left out joins
  // the last step, so a field is always reachable.
  const indexOf = new Map(fields.map((f, i) => [f.id, i]));
  const taken = new Set();
  const steps = [];
  for (const group of Array.isArray(form.step_groups) ? form.step_groups : []) {
    const picked = (Array.isArray(group) ? group : [])
      .map((id) => indexOf.get(id))
      .filter((i) => i !== undefined && !taken.has(i));
    for (const i of picked) taken.add(i);
    if (picked.length) steps.push(picked);
  }
  const missed = fields.map((_, i) => i).filter((i) => !taken.has(i));
  if (!steps.length) {
    // No groups, so an older payload: fall back to what its boolean meant.
    if (form.steps) steps.push(...missed.map((i) => [i]));
    else steps.push(missed);
  } else steps[steps.length - 1].push(...missed);
  let step = 0;
  // One question at a time: every step asks a single field.
  const single = steps.length > 1 && steps.every((s) => s.length === 1);
  if (single) box.classList.add("single");
  // A pick waiting to move the visitor on (see pickedOne).
  let pending = 0;
  // The step last drawn, so a new one can slide in from its side.
  let drawn = -1;
  const send = el("button", { class: "btn", part: "button", type: "submit" });
  const back = el("button", {
    class: "link", type: "button", text: DEFAULTS.back,
    onclick: () => { clearTimeout(pending); show(stepFrom(step - 1, -1)); },
  });
  const progress = el("div", { class: "prog", role: "progressbar", "aria-valuemin": "0" }, [el("i")]);
  // The questions, apart from the buttons under them, so a new step can slide
  // in without the buttons moving too.
  const questions = el("div", { class: "qs" });
  const formEl = el("form", { novalidate: true });

  const stepShows = (i, visible) => steps[i].some((k) => visible.has(fields[k].id));
  // The nearest step in that direction with anything left to show, or -1. A
  // step whose every field is hidden by a condition is stepped over, which is
  // how a whole step is made conditional.
  const stepFrom = (start, by, visible = visibleNow()) => {
    for (let i = start; i >= 0 && i < steps.length; i += by) {
      if (stepShows(i, visible)) return i;
    }
    return -1;
  };

  function show(next) {
    if (next >= 0) step = next;
    // A new step slides in from the side it comes from.
    if (drawn !== -1 && step !== drawn) {
      questions.classList.remove("go", "back");
      void questions.offsetWidth;
      questions.classList.add("go", ...(step < drawn ? ["back"] : []));
    }
    drawn = step;
    const { visible, required, amounts } = settleNow();
    const last = stepFrom(step + 1, 1, visible) === -1;
    rows.forEach((row, i) => { row.hidden = !steps[step].includes(i) || !visible.has(fields[i].id); });
    for (const f of fields) {
      const caption = caps.get(f.id);
      if (caption) caption.textContent = f.label + (sends && starred && required.has(f.id) ? " *" : "");
      // The browser's own prompt follows too, for a field required only on an
      // answer. A group's control is a div, which has no such property.
      const control = controls.get(f.id);
      if (control && "required" in control) control.required = sends && required.has(f.id);
    }
    paintAmounts(amounts);
    if (consentRow) consentRow.hidden = !last;
    if (robotBox) robotBox.hidden = !last;
    send.textContent = last ? texts.button : DEFAULTS.next;
    back.hidden = stepFrom(step - 1, -1, visible) === -1;
    // Counted over the steps still on show, so an answer that skips a step
    // shortens the bar rather than leaving a gap in it.
    const shownSteps = steps.map((_, i) => i).filter((i) => stepShows(i, visible));
    const { at, of } = progressOf(shownSteps, step);
    progress.hidden = of < 2;
    progress.firstChild.style.width = `${(at / of) * 100}%`;
    progress.setAttribute("aria-valuemax", String(of));
    progress.setAttribute("aria-valuenow", String(at));
    progress.setAttribute("aria-label", `Step ${at} of ${of}`);
    error.textContent = "";
  }

  // The fields on the step being shown that the visitor can see.
  const onStepNow = (visible) => steps[step].map((i) => fields[i]).filter((f) => visible.has(f.id));
  // As if the button were pressed: the step is checked and the visitor moved
  // on, or the form sent from the last one.
  const submitStep = () => {
    if (!sends || closed) return;
    if (formEl.requestSubmit) formEl.requestSubmit(send);
    else send.click();
  };

  // An answer picked by click, tap or letter key. When that was the step's
  // one question and a step follows, the visitor is moved on — after long
  // enough to see the pick land, and well inside the half second after a
  // click in which a browser doesn't count the page moving as a layout shift
  // against the site. Picking again restarts the wait; Back, or moving on by
  // hand in the meantime, cancels it. Whether to move is settled when the
  // wait ends, not on the click: a click on a label lands before the browser
  // ticks its radio, so the answers read then are the ones before the pick —
  // and a pick that leaves no step after this one must not send the form.
  function pickedOne(f) {
    clearTimeout(pending);
    const at = step;
    pending = setTimeout(() => {
      if (step !== at) return;
      const { visible } = settleNow();
      const onStep = onStepNow(visible);
      if (onStep.includes(f) && movesOn(onStep, stepFrom(step + 1, 1, visible) === -1)) submitStep();
    }, 350);
  }

  // Keys inside the form. Enter on a choice moves on, as it does from a box
  // you type in (a browser doesn't send a form from a radio); Enter in long
  // text does too when the form asks one question at a time, with Shift+Enter
  // for a new line. Letters pick a card. A key held with Ctrl, Cmd or Alt is a
  // shortcut and composing text (Chinese, Japanese) is typing, so neither
  // picks anything.
  const coarse = Boolean(window.matchMedia?.("(pointer: coarse)").matches);
  formEl.addEventListener("keydown", (e) => {
    const target = e.composedPath()[0];
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Enter") {
      if (target.type === "radio" || target.type === "checkbox" || (target.tagName === "TEXTAREA" && enterMovesOn(single, coarse, e.shiftKey))) {
        e.preventDefault();
        submitStep();
      }
      return;
    }
    if (l.choices !== "cards" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"
      || (target.tagName === "INPUT" && target.type !== "radio" && target.type !== "checkbox")) return;
    const onStep = onStepNow(settleNow().visible);
    const f = onStep.length === 1 && GROUP_TYPES.includes(onStep[0].type) && onStep[0].control !== "segmented" ? onStep[0] : null;
    const k = f ? pickedByKey(e.key, picks.get(f.id).length) : -1;
    if (k === -1) return;
    e.preventDefault();
    const input = picks.get(f.id)[k];
    input.checked = f.type === "radio" ? true : !input.checked;
    // What a click would have set off: the cards repaint, conditions and
    // figures are settled again.
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus();
    if (f.type === "radio") pickedOne(f);
  });

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!sends || send.disabled) return;
    // Only what the visitor can see is theirs to fill in.
    const { visible, required } = settleNow();
    const onStep = steps[step].map((i) => fields[i]).filter((f) => visible.has(f.id));
    const problem = problemIn(onStep, required);
    if (problem) {
      error.textContent = problem;
      return;
    }
    const ahead = stepFrom(step + 1, 1, visible);
    // Only a contact field on show counts, as at the collector, which drops
    // hidden answers. With both hidden there is nothing to ask for here.
    const contacts = phoneField ? [phoneField, emailField].filter((f) => visible.has(f.id)) : [];
    if (ahead === -1 && contacts.length && !contacts.some((f) => valueOf(f))) {
      error.textContent = `Please fill in ${contacts.map((f) => f.label).join(" or ")}.`;
      return;
    }
    if (ahead !== -1) {
      show(ahead);
      const shown = visibleNow();
      focusOf(steps[step].map((i) => fields[i]).find((f) => shown.has(f.id))).focus();
      return;
    }
    if (consent && !consent.checked) {
      error.textContent = "Please tick the box to continue.";
      consent.focus();
      return;
    }
    if (shield && !shield.ticked(formEl)) {
      error.textContent = "Please tick \u201cI'm not a robot\u201d.";
      shield.nudge(formEl);
      return;
    }
    const values = Object.fromEntries(fields.map((f) => [f.id, valueOf(f)]));
    if (consent) values.consent = true;
    send.disabled = true;
    error.textContent = "";
    const answer = shield ? await shield.take() : "";
    const reply = await callbacks.submit(values, { website: honeypot.value, elapsed_ms: Date.now() - started, shield: answer });
    const { status, field, message } = reply;
    send.disabled = false;
    // The collector settles what happens next from the answers it kept, so a
    // form can end differently for different people. Anything it doesn't send
    // back leaves the form's own ending in place.
    if (status >= 200 && status < 300) return thanks(reply);
    if (field && controls.has(field)) {
      const index = fields.findIndex((f) => f.id === field);
      show(steps.findIndex((s) => s.includes(index)));
      controls.get(field).setAttribute("aria-invalid", "true");
    }
    error.textContent = status === 429 ? "Too many attempts, please try again later." : message || "Something went wrong, please try again.";
  });

  questions.append(...rows);
  // The button beside the answer only where there is one line to fill in.
  if (l.button === "beside" && sends && steps.length === 1 && fields.length === 1 && oneLine(fields[0])) formEl.classList.add("beside");
  formEl.append(progress, questions, ...(consentRow ? [consentRow] : []), ...(robotBox ? [robotBox] : []), el("div", { class: "hp", "aria-hidden": "true" }, [honeypot]), error,
    ...(sends ? [el("div", { class: "foot" }, [back, send])] : []));

  // A form on the page with no title starts with its fields; a popup keeps
  // its close button (and the empty title its dialog is labelled by).
  if (form.title || !mount) {
    const head = el("div", { class: "head" }, [el("p", { class: "title", part: "title", id: "t", text: form.title || "" })]);
    if (!mount) head.append(el("button", { class: "x", type: "button", "aria-label": DEFAULTS.close, title: DEFAULTS.close, text: "✕", onclick: close }));
    main.append(head);
  }
  if (form.description) main.append(el("p", { class: "desc", text: form.description }));
  main.append(formEl);
  // An answer can decide what else is on show, so the step is redrawn as they
  // go. A group's own inputs bubble up to the element held in `controls`.
  // "input" alone: tick-boxes, radios and selects fire it too, and also
  // listening to "change" would redraw twice per click.
  if (conditional || sums.size) {
    for (const control of controls.values()) control.addEventListener("input", () => show(-1));
  }
  // A calculator is never sent, so without this there would be no trace of it
  // at all and the owner could never see what people price. One custom event
  // per form, as the page or the popup goes away, carrying the figure and the
  // answers behind it — and only if the visitor answered something, so a
  // calculator nobody touched stays silent.
  if (!sends && callbacks.used) {
    let touched = false;
    let told = false;
    for (const control of controls.values()) {
      control.addEventListener("input", () => { touched = true; }, { passive: true });
      control.addEventListener("change", () => { touched = true; }, { passive: true });
    }
    const worked = fields.filter((f) => f.compute);
    const headline = worked.find((f) => f.headline) || worked[worked.length - 1];
    function tell() {
      if (told || !touched) return;
      told = true;
      window.removeEventListener("pagehide", tell);
      document.removeEventListener("visibilitychange", onHidden);
      const { visible, amounts } = settleNow();
      const answers = {};
      for (const f of fields) {
        if (f.compute || !visible.has(f.id)) continue;
        const value = valueOf(f);
        const empty = Array.isArray(value) ? value.length === 0 : value === "" || value === false;
        if (!empty) answers[f.label] = Array.isArray(value) ? value.join(", ") : value;
      }
      // Back to the figure as it reads, from the whole units it is kept in.
      const places = typeof headline?.decimals === "number" ? headline.decimals : 2;
      const amount = headline && amounts.has(headline.id) ? amounts.get(headline.id) / 10 ** places : undefined;
      callbacks.used({ label: form.name || form.id, amount, answers });
    }
    function onHidden() {
      if (document.visibilityState === "hidden") tell();
    }
    window.addEventListener("pagehide", tell);
    document.addEventListener("visibilitychange", onHidden);
    onGone = tell;
  }
  // Conditions can leave the first step with nothing on it, so start at the
  // first step that has something.
  show(Math.max(stepFrom(0, 1), 0));
  if (modal) {
    const shown = visibleNow();
    const first = steps[step].map((i) => fields[i]).find((f) => shown.has(f.id)) || fields[0];
    focusOf(first).focus({ preventScroll: true });
  }

  function thanks(ending = {}) {
    callbacks.submitted();
    // Sent somewhere of their own: the sign-up is already counted above, so
    // the visit is credited either way.
    if (typeof ending.redirect === "string" && /^https?:\/\//i.test(ending.redirect)) {
      window.location.href = ending.redirect;
      return;
    }
    const said = typeof ending.thanks === "string" && ending.thanks ? ending.thanks : texts.thanks;
    const done = [el("p", { class: "thanks", role: "status", text: said })];
    // A discount code for signing up, if the reply carried one. It is only
    // ever in the reply, so there is nothing to show before a submission.
    const code = typeof ending.coupon === "string" ? ending.coupon.trim().slice(0, 40) : "";
    if (code) {
      const copy = el("button", { class: "copy", type: "button", text: DEFAULTS.copy, "aria-label": `Copy code ${code}` });
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(code);
          callbacks.copy?.(code);
          copy.textContent = DEFAULTS.copied;
          setTimeout(() => { copy.textContent = DEFAULTS.copy; }, 2000);
        } catch { /* clipboard blocked: the code is on screen to read */ }
      });
      done.push(el("p", { class: "code" }, [el("span", { text: code }), copy]));
    }
    if (/^https?:\/\//i.test(form.download_url || "")) {
      done.push(el("a", { class: "btn", part: "button", href: form.download_url, target: "_blank", rel: "noopener", text: DEFAULTS.download }));
    }
    if (callbacks.branded) done.push(credit());
    main.replaceChildren(...done);
    // Popups close by themselves unless there's a download to click or a code
    // to copy.
    if (!mount && !form.download_url && !code) {
      setTimeout(() => {
        if (!closed) {
          finish();
          callbacks.done();
        }
      }, 3000);
    } else if (!mount) {
      main.prepend(el("div", { class: "head" }, [el("span", { class: "title" }), el("button", { class: "x", type: "button", "aria-label": DEFAULTS.close, text: "✕", onclick: () => { finish(); callbacks.done(); } })]));
    }
  }
}

// The floating button for a "button" popup, in the corner its form opens in
// (bottom right). onOpen is called on click; returns { show(on), remove() }.
export function renderLauncher(form, onOpen) {
  const host = document.createElement("div");
  host.setAttribute("data-noanalytics", "");
  const root = host.attachShadow({ mode: "open" });
  const style = shadowStyle(root);
  // The button is the accent and the font only; the rest of the look is the form's.
  const site = followLook("leadform", host, root, form.look || {}, (seen, font) => {
    const color = accentOf(seen);
    style.textContent = `
    :host { all: initial; }
    [hidden] { display: none !important; }
    button {
      position: fixed; z-index: 2147482999; right: 16px; bottom: 16px; border: 0; border-radius: 999px;
      padding: 12px 18px; cursor: pointer; font: 600 15px/1.2 ${font || SYSTEM_FONT};
      background: ${color}; color: #fff; box-shadow: 0 6px 20px rgba(0,0,0,.2); max-width: calc(100vw - 32px);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    button:focus-visible { outline: 3px solid ${color}66; outline-offset: 2px; }
  `;
  });
  const button = el("button", { type: "button", "aria-haspopup": "dialog", text: form.targeting?.trigger?.label || "Contact us", onclick: onOpen });
  root.append(button);
  document.body.append(host);
  site.update();
  return {
    show: (on) => { button.hidden = !on; },
    remove: () => {
      site.stop();
      host.remove();
    },
  };
}
