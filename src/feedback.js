// Feedback button and form. Loaded by the tracker only on sites that turned
// feedback on. Renders inside a shadow root, so the site's CSS reaches it only
// through the hooks followLook describes, and its CSS can't leak into the site. "Point at it" lets the visitor click
// the part of the page they mean; the report gets that element's heatmap
// selector and position (never what was typed in it).
// api: selector(element) → string, submit(report) → Promise<{ ok, message }>,
// capture() → called as the form opens, before the visitor clicks anything
// else, so the page snapshot shows what they were looking at.
// Returns { open(), isOpen(), remove() }.

const DEFAULT_TEXTS = {
  button: "Feedback",
  title: "Send us feedback",
  bug: "Something's wrong",
  idea: "Idea",
  other: "Other",
  placeholder: "What happened, or what would you like?",
  point: "Point at it on the page",
  pointing: "Click the part of the page you mean · Esc to cancel",
  email: "Your email (optional, if you'd like a reply)",
  send: "Send",
  thanks: "Thanks! We've got it.",
  close: "Close",
};

// The colours the box is drawn in. The owner can pick its background; the
// text, lines and field fills are worked out from that one colour, so a dark
// brand colour gets light text without anyone choosing it and no background
// can leave the widget unreadable. With no background it is the theme's own
// pair, exactly as before. The lines and fills are translucent black or white
// because the box behind them is always solid, so one pair of tints suits
// every hue. Identical in leadform.js, survey.js, notice.js and
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
const followLook = (kind, host, root, look, draw) => {
  host.setAttribute("data-sg-widget", kind);
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

const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const css = (color, s, left, font) => `
  :host { all: initial; }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  .root { font: 14px/1.4 ${font || SYSTEM_FONT}; color: ${s.fg}; }
  .launch {
    position: fixed; z-index: 2147482999; bottom: 96px; ${left ? "left: 0; border-radius: 0 8px 8px 0;" : "right: 0; border-radius: 8px 0 0 8px;"}
    writing-mode: vertical-rl; ${left ? "transform: rotate(180deg);" : ""}
    border: 0; padding: 12px 8px; cursor: pointer; font: 600 13px/1 ${font || "system-ui, sans-serif"}; letter-spacing: .02em;
    background: ${color}; color: #fff; box-shadow: 0 4px 14px rgba(0,0,0,.18);
  }
  .launch:focus-visible { outline: 3px solid ${color}55; outline-offset: 2px; }
  .panel {
    position: fixed; z-index: 2147483000; bottom: 16px; ${left ? "left: 16px;" : "right: 16px;"}
    width: calc(100vw - 32px); max-width: 360px; padding: 16px; border-radius: 12px;
    background: ${s.bg}; border: 1px solid ${s.line};
    box-shadow: 0 10px 30px rgba(0,0,0,.2); display: flex; flex-direction: column; gap: 12px;
  }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  h2 { margin: 0; font-size: 16px; font-weight: 600; }
  .x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; font-size: 18px; line-height: 1; padding: 2px; }
  .x:hover, .x:focus-visible { opacity: 1; }
  .cats { display: flex; flex-wrap: wrap; gap: 6px; }
  .cat {
    flex: 1 1 auto; padding: 7px 10px; border-radius: 8px; cursor: pointer; font: inherit; color: inherit; background: none;
    border: 1px solid ${s.fieldLine};
  }
  .cat[aria-pressed="true"] { border-color: ${color}; background: ${color}22; }
  textarea, input {
    width: 100%; padding: 9px 12px; border-radius: 8px; font: inherit; color: inherit; background: none;
    border: 1px solid ${s.fieldLine};
  }
  textarea { min-height: 90px; resize: vertical; }
  textarea:focus, input:focus { outline: none; border-color: ${color}; }
  .link { border: 0; background: none; color: ${color}; cursor: pointer; font: inherit; padding: 0; text-align: left; }
  .picked { display: flex; align-items: center; gap: 8px; font-size: 13px; opacity: .85; }
  .picked span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .err { color: #dc2626; font-size: 13px; margin: 0; }
  .btn { margin-left: auto; border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; font: inherit; font-weight: 600; background: ${color}; color: #fff; }
  .btn[disabled] { opacity: .45; cursor: default; }
  .thanks { margin: 4px 0; font-weight: 600; }
  .credit { margin: 10px 0 0; font-size: 12px; font-weight: 400; opacity: 0.7; }
  .credit a { color: inherit; text-decoration: none; }
  .credit a:hover { text-decoration: underline; }
  .hint {
    position: fixed; z-index: 2147483001; top: 12px; left: 50%; transform: translateX(-50%); max-width: calc(100vw - 24px);
    padding: 8px 14px; border-radius: 99px; background: #111827; color: #fff; font-size: 13px; box-shadow: 0 4px 14px rgba(0,0,0,.25);
  }
  .box { position: fixed; z-index: 2147483000; pointer-events: none; border: 2px solid ${color}; background: ${color}1a; border-radius: 4px; }
`;

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
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

// A short, safe label for the element: its tag and visible text (form fields
// only by their name, never their value).
function describe(target) {
  const tag = target.tagName.toLowerCase();
  const field = /^(input|select|textarea)$/.test(tag);
  const raw = field
    ? target.getAttribute("aria-label") || target.getAttribute("name") || target.getAttribute("placeholder") || ""
    : target.getAttribute("aria-label") || target.innerText || target.getAttribute("alt") || target.getAttribute("title") || "";
  return { tag, text: String(raw).replace(/\s+/g, " ").trim().slice(0, 100) };
}

export function renderFeedback(settings, api) {
  const texts = { ...DEFAULT_TEXTS, ...(settings.texts || {}) };
  const categories = (settings.categories || ["bug", "idea", "other"]).filter((c) => ["bug", "idea", "other"].includes(c));

  const host = document.createElement("div");
  host.setAttribute("data-noanalytics", "");
  const root = host.attachShadow({ mode: "open" });
  const style = el("style");
  root.append(style);
  const site = followLook("feedback", host, root, settings, (seen, font) => {
    // Six digits only: the CSS appends a two-digit alpha to it.
    const color = /^#[0-9a-f]{6}$/i.test(seen.color || "") ? seen.color : "#2563eb";
    style.textContent = css(color, surface(seen), settings.position === "left", font);
  });
  const wrap = el("div", { class: "root" });
  root.append(wrap);
  document.body.append(host);
  site.update();

  let panel = null;
  let launch = null;
  let picking = false;
  let stopPicking = null; // ends "point at it", whose listeners are on the page
  let state = { category: categories[0] || "other", message: "", email: "", element: null };

  if (settings.button !== false) {
    launch = el("button", { class: "launch", type: "button", text: texts.button, onclick: () => open() });
    wrap.append(launch);
  }

  const onKey = (e) => {
    if (e.key === "Escape" && panel && !picking) close();
  };

  function close() {
    panel?.remove();
    panel = null;
    document.removeEventListener("keydown", onKey, true);
    if (launch) {
      launch.hidden = false;
      launch.focus({ preventScroll: true });
    }
  }

  // The visitor clicks the element they mean; the form comes back after.
  function pick() {
    panel.hidden = true;
    picking = true;
    const hint = el("div", { class: "hint", role: "status", text: texts.pointing });
    const box = el("div", { class: "box", hidden: "" });
    wrap.append(hint, box);
    const isOurs = (node) => node === host || host.contains(node);
    const onMove = (e) => {
      const target = e.target;
      if (!target?.getBoundingClientRect || isOurs(target)) return;
      const r = target.getBoundingClientRect();
      box.hidden = false;
      Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    };
    const stop = () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onEsc, true);
      hint.remove();
      box.remove();
      picking = false;
      stopPicking = null;
      if (panel) {
        panel.hidden = false;
        render();
      }
    };
    function onClick(e) {
      const target = e.target;
      if (!target?.tagName || isOurs(target)) return;
      e.preventDefault();
      e.stopPropagation();
      const r = target.getBoundingClientRect();
      const selector = api.selector(target);
      if (selector) {
        state.element = {
          selector, ...describe(target),
          x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY),
          w: Math.round(r.width), h: Math.round(r.height),
        };
      }
      stop();
    }
    function onEsc(e) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      stop();
    }
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onEsc, true);
    stopPicking = stop;
  }

  function render(error = "") {
    const message = el("textarea", { part: "field", "aria-label": texts.placeholder, placeholder: texts.placeholder, maxlength: "2000" });
    message.value = state.message;
    const send = el("button", { class: "btn", part: "button", type: "submit", text: texts.send });
    const sync = () => {
      state.message = message.value;
      send.disabled = !message.value.trim();
    };
    message.addEventListener("input", sync);
    sync();

    const cats = el("div", { class: "cats", role: "group", "aria-label": texts.title });
    for (const category of categories) {
      cats.append(el("button", {
        class: "cat", part: "field", type: "button", "aria-pressed": String(state.category === category), text: texts[category],
        onclick: () => {
          state.category = category;
          for (const b of cats.children) b.setAttribute("aria-pressed", String(b === cats.children[categories.indexOf(category)]));
        },
      }));
    }

    const pointRow = state.element
      ? el("div", { class: "picked" }, [
        el("span", { text: `✓ ${state.element.text ? `“${state.element.text}”` : `<${state.element.tag}>`}` }),
        el("button", { class: "link", type: "button", text: "✕", "aria-label": "Remove", onclick: () => { state.element = null; render(); } }),
      ])
      : el("button", { class: "link", type: "button", text: `⌖ ${texts.point}`, onclick: pick });

    const email = settings.ask_email ? el("input", { type: "email", part: "field", placeholder: texts.email, "aria-label": texts.email, maxlength: "200" }) : null;
    if (email) {
      email.value = state.email;
      email.addEventListener("input", () => { state.email = email.value; });
    }

    const form = el("form", { class: "panel", part: "box", role: "dialog", "aria-modal": "false", "aria-labelledby": "fb-title" }, [
      el("div", { class: "head" }, [
        el("h2", { part: "title", id: "fb-title", text: texts.title }),
        el("button", { class: "x", type: "button", "aria-label": texts.close, title: texts.close, text: "✕", onclick: close }),
      ]),
      ...(categories.length > 1 ? [cats] : []),
      message,
      pointRow,
      ...(email ? [email] : []),
      ...(error ? [el("p", { class: "err", role: "alert", text: error })] : []),
      el("div", { class: "foot" }, [send]),
    ]);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (send.disabled) return;
      send.disabled = true;
      const result = await api.submit({
        category: state.category, message: state.message.trim(), email: state.email.trim(), element: state.element,
      });
      if (!panel) return;
      if (!result.ok) {
        render(result.message || "Couldn't send it. Please try again.");
        return;
      }
      state = { category: categories[0] || "other", message: "", email: "", element: null };
      // The status is the thank-you alone, so a screen reader isn't read the line under it.
      const done = el("div", { class: "panel", part: "box" }, [el("p", { class: "thanks", role: "status", text: texts.thanks }), ...(api.branded ? [credit()] : [])]);
      panel.replaceWith(done);
      panel = done;
      setTimeout(() => { if (panel === done) close(); }, 2500);
    });

    if (panel) panel.replaceWith(form);
    else wrap.append(form);
    panel = form;
    if (!error) message.focus({ preventScroll: true });
  }

  function open() {
    if (panel) return;
    try {
      api.capture?.();
    } catch { /* the report goes without a snapshot */ }
    if (launch) launch.hidden = true;
    document.addEventListener("keydown", onKey, true);
    render();
  }

  // Another page's button takes over (the tracker never does this while it's open).
  function remove() {
    document.removeEventListener("keydown", onKey, true);
    panel = null;
    stopPicking?.();
    site.stop();
    host.remove();
  }

  return { open, isOpen: () => Boolean(panel), remove };
}
