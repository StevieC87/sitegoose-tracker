// Announcement bar, "What's new" panel and popup. Loaded by the tracker only when a
// notice is shown. Renders inside a shadow root, so the site's CSS reaches it
// only through the hooks followLook describes. Text is set as text, never as HTML.
// renderBar(notice, { click(), copy(), close() }) -> remove(), or null when its countdown has ended
// renderChangelog(notice, { unread, opened(), click(), imageUrl(image) }) -> { open(), remove() }
// renderPopup(notice, { image, shown(), click(), copy(), close(), failed() }) -> remove()
//   (image: the image's full URL)

const HEX = /^#[0-9a-f]{6}$/i;
const color = (value, fallback) => (HEX.test(value || "") ? value : fallback);
// The colours the box is drawn in. The owner can pick its background; the
// text, lines and field fills are worked out from that one colour, so a dark
// brand colour gets light text without anyone choosing it and no background
// can leave the widget unreadable. With no background it is the theme's own
// pair, exactly as before. The lines and fills are translucent black or white
// because the box behind them is always solid, so one pair of tints suits
// every hue. Identical in leadform.js, survey.js, feedback.js and
// frontend/src/features/widgets/widgetSurface.js, bar the hex test it reuses
// from this file — change all five together.
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
  const bg = HEX.test(look.background || "") ? look.background : "";
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

const safeUrl = (value) => (/^https?:\/\//i.test(value || "") ? value : "");
const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const fontRule = (font) => `font: 14px/1.45 ${font || SYSTEM_FONT};`;

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

// css(look, font) is drawn again whenever the site's mode or its own CSS
// properties change (followLook); site.update() once the host is on the page.
function shadowHost(look, css) {
  const host = document.createElement("div");
  host.setAttribute("data-noanalytics", "");
  const root = host.attachShadow({ mode: "open" });
  const style = el("style");
  root.append(style);
  const site = followLook("notice", host, root, look, (seen, font) => {
    style.textContent = `:host { all: initial; } [hidden] { display: none !important; } ${css(seen, font)}`;
  });
  return { host, root, site };
}

// Days, hours, minutes and seconds until the end; null once it passed.
function timeLeft(end) {
  const ms = new Date(end).getTime() - Date.now();
  if (!(ms > 0)) return null;
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

// Other widgets (the "What's new" button) read this to stay above a bottom bar.
const BOTTOM_VAR = "--analytics-notice-bottom";

//. BAR -----------------------------------------------------------
// At the top it sits above the page and pushes it down (and scrolls away);
// at the bottom it stays fixed, and the page gets room below so the bar
// never hides the end of it.
export function renderBar(notice, callbacks) {
  // A countdown that already ended (or a visitor clock running ahead) shows nothing.
  if (notice.countdown && notice.ends_at && !timeLeft(notice.ends_at)) return null;
  const look = notice.look || {};
  const bg = color(look.color, "#111827");
  const fg = color(look.text_color, "#ffffff");
  const bottom = look.position === "bottom";
  // A bar has no theme and its two colours are the owner's pair, so of the
  // site's properties only the font applies.
  const { host, root, site } = shadowHost(look, (_, font) => `
    .bar {
      box-sizing: border-box; ${fontRule(font)} display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
      gap: 8px 16px; width: 100%; padding: 10px 48px; background: ${bg}; color: ${fg}; text-align: center; position: relative;
      ${bottom
    ? "position: fixed; z-index: 2147482000; left: 0; right: 0; bottom: 0; box-shadow: 0 -6px 24px rgba(0,0,0,.14); animation: up .35s ease-out;"
    : "animation: down .35s ease-out;"}
    }
    @keyframes down { from { transform: translateY(-100%); opacity: 0; } }
    @keyframes up { from { transform: translateY(100%); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
    .text { font-weight: 600; letter-spacing: .01em; }
    .extras { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 12px; }
    .code {
      display: inline-flex; align-items: center; gap: 6px; padding: 3px 3px 3px 10px; border: 1.5px dashed ${fg}aa; border-radius: 7px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; letter-spacing: .06em;
    }
    .copy {
      border: 0; border-radius: 5px; padding: 3px 9px; background: ${fg}2e; color: inherit;
      font: 600 12px/1.5 system-ui, -apple-system, sans-serif; letter-spacing: 0; cursor: pointer; transition: background .15s;
    }
    .copy:hover { background: ${fg}47; }
    .time { display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
    .time-label { margin-right: 2px; font-size: 12px; opacity: .85; }
    .seg {
      display: inline-flex; align-items: baseline; gap: 1px; min-width: 30px; justify-content: center; padding: 3px 5px;
      border-radius: 5px; background: ${fg}24; font-weight: 700;
    }
    .seg small { font-size: 10px; font-weight: 600; opacity: .8; }
    .cta {
      display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 7px; background: ${fg}; color: ${bg};
      font-weight: 700; text-decoration: none; white-space: nowrap; transition: transform .15s, box-shadow .15s;
    }
    .cta:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.18); }
    .cta:focus-visible, .copy:focus-visible, .x:focus-visible { outline: 2px solid ${fg}; outline-offset: 2px; }
    .x {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; border: 0; border-radius: 50%;
      background: none; color: inherit; opacity: .7; cursor: pointer; font-size: 16px; line-height: 1;
    }
    .x:hover { opacity: 1; background: ${fg}1f; }
    @media (max-width: 600px) {
      .bar { gap: 8px; padding: 9px 40px 9px 14px; font-size: 13px; }
      .x { right: 4px; top: 6px; transform: none; }
      .time-label { display: none; }
      .seg { min-width: 26px; padding: 2px 4px; }
      .cta { padding: 6px 12px; }
    }
  `);
  const bar = el("div", { class: "bar", part: "box", role: "region", "aria-label": notice.name || "Announcement" });
  bar.append(el("span", { class: "text", part: "title", text: notice.text || "" }));
  // Coupon, countdown and button stay together on one row on phones.
  const extras = el("span", { class: "extras" });

  if (notice.coupon) {
    const copy = el("button", { class: "copy", type: "button", text: "Copy", "aria-label": `Copy code ${notice.coupon}` });
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(notice.coupon);
        callbacks.copy?.();
        copy.textContent = "Copied ✓";
        setTimeout(() => { copy.textContent = "Copy"; }, 2000);
      } catch { /* clipboard blocked: the code is on screen */ }
    });
    extras.append(el("span", { class: "code" }, [el("span", { text: notice.coupon }), copy]));
  }

  let timer = null;
  // Declared before the first tick, which can call remove().
  let room = null;
  if (notice.countdown && notice.ends_at) {
    const time = el("span", { class: "time", role: "timer", "aria-live": "off" });
    const pad = (n) => String(n).padStart(2, "0");
    const seg = (value, unit) => el("span", { class: "seg" }, [document.createTextNode(value), el("small", { text: unit })]);
    const tick = () => {
      const left = timeLeft(notice.ends_at);
      if (!left) return remove();
      time.replaceChildren(
        el("span", { class: "time-label", text: "Ends in" }),
        ...(left.d ? [seg(left.d, "d")] : []),
        seg(pad(left.h), "h"), seg(pad(left.m), "m"), seg(pad(left.s), "s"),
      );
    };
    tick();
    timer = setInterval(tick, 1000);
    extras.append(time);
  }

  const href = safeUrl(notice.link_url);
  if (href && notice.link_label) {
    extras.append(el("a", { class: "cta", part: "button", href, onclick: () => callbacks.click() }, [
      el("span", { text: notice.link_label }), el("span", { "aria-hidden": "true", text: "→" }),
    ]));
  }
  if (extras.childNodes.length) bar.append(extras);
  if (notice.dismissible !== false) {
    bar.append(el("button", {
      class: "x", type: "button", "aria-label": "Close", title: "Close", text: "✕",
      onclick: () => { remove(); callbacks.close(); },
    }));
  }
  root.append(bar);

  function remove() {
    clearInterval(timer);
    room?.disconnect();
    site.stop();
    host.remove();
    if (bottom) {
      document.body.style.removeProperty("padding-bottom");
      document.documentElement.style.removeProperty(BOTTOM_VAR);
    }
  }
  if (bottom) {
    document.body.append(host);
    // The bar's height changes as it wraps on resize.
    const pageBottom = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
    room = new ResizeObserver(() => {
      const height = bar.offsetHeight;
      document.body.style.paddingBottom = `${pageBottom + height}px`;
      document.documentElement.style.setProperty(BOTTOM_VAR, `${height}px`);
    });
    room.observe(bar);
  } else {
    document.body.prepend(host);
  }
  site.update();
  return remove;
}

const sparkle = () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M7.66 1.3a.36.36 0 0 1 .68 0l1.1 3.2a2 2 0 0 0 1.24 1.25l3.2 1.1a.36.36 0 0 1 0 .68l-3.2 1.1a2 2 0 0 0-1.24 1.24l-1.1 3.2a.36.36 0 0 1-.68 0l-1.1-3.2a2 2 0 0 0-1.25-1.24l-3.2-1.1a.36.36 0 0 1 0-.68l3.2-1.1A2 2 0 0 0 6.56 4.5z");
  svg.append(path);
  return svg;
};

//. CHANGELOG -----------------------------------------------------
// A side panel of entries, newest first. Opened by its own floating button
// (launcher "button") or by the tracker when a site element is clicked.
export function renderChangelog(notice, callbacks) {
  const look = notice.look || {};
  const left = look.position === "left";
  const { host, root, site } = shadowHost(look, (seen, font) => {
    const accent = color(seen.color, "#2563eb");
    const s = surface(seen);
    const FONT = fontRule(font);
    return `
    .launch {
      position: fixed; z-index: 2147482000; bottom: calc(16px + var(${BOTTOM_VAR}, 0px)); ${left ? "left" : "right"}: 16px;
      box-sizing: border-box; ${FONT} display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px 10px 16px;
      border: 0; border-radius: 999px; cursor: pointer; background: ${accent}; color: #fff; font-weight: 600;
      box-shadow: 0 6px 20px rgba(0,0,0,.2); transition: transform .15s, box-shadow .15s, bottom .2s;
    }
    .launch:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(0,0,0,.24); }
    .launch:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
    .launch svg { width: 16px; height: 16px; }
    .badge {
      min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; background: #fff; color: ${accent};
      font-size: 12px; font-weight: 700; line-height: 20px; text-align: center;
    }
    .shade { position: fixed; z-index: 2147483000; inset: 0; background: rgba(0,0,0,.35); animation: fade .25s ease-out; }
    @keyframes fade { from { opacity: 0; } }
    @keyframes slide { from { transform: translateX(${left ? "-" : ""}100%); } }
    @media (prefers-reduced-motion: reduce) { .shade, .panel { animation: none !important; } }
    .panel {
      position: fixed; z-index: 2147483001; top: 0; bottom: 0; ${left ? "left" : "right"}: 0; width: 400px; max-width: 100%;
      box-sizing: border-box; display: flex; flex-direction: column; ${FONT}
      background: ${s.bg}; color: ${s.fg}; box-shadow: 0 0 40px rgba(0,0,0,.25);
      animation: slide .3s cubic-bezier(.2,.8,.2,1);
    }
    .head { border-top: 4px solid ${accent}; }
    .head { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid ${s.line}; }
    .title { flex: 1; margin: 0; font-size: 18px; font-weight: 700; }
    .x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; font-size: 18px; line-height: 1; padding: 4px; }
    .x:hover, .x:focus-visible { opacity: 1; }
    .list { flex: 1; overflow-y: auto; margin: 0; padding: 4px 20px 20px; list-style: none; }
    .entry { padding: 16px 0; border-bottom: 1px solid ${s.faint}; }
    .entry:last-child { border-bottom: 0; }
    .meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; opacity: .7; }
    .label { padding: 1px 8px; border-radius: 999px; background: ${accent}22; color: ${s.deep ? "#fff" : accent}; font-weight: 700; opacity: 1; }
    .new { width: 8px; height: 8px; border-radius: 50%; background: ${accent}; }
    .entry h3 { margin: 0 0 4px; font-size: 15px; font-weight: 700; }
    .shot {
      display: block; width: 100%; height: auto; margin: 4px 0 10px; border-radius: 8px;
      border: 1px solid ${s.line}; background: ${s.mute};
    }
    .entry p { margin: 0 0 8px; white-space: pre-wrap; opacity: .85; }
    .more { color: ${s.deep ? "#93c5fd" : accent}; font-weight: 600; text-decoration: none; }
    .more:hover { text-decoration: underline; }
  `;
  });

  const unreadIds = new Set(callbacks.unread);
  const buttonText = notice.button_text || "What's new";
  const badge = el("span", { class: "badge", "aria-hidden": "true", hidden: !unreadIds.size, text: String(unreadIds.size) });
  const launch = notice.launcher === "custom" ? null : el("button", {
    class: "launch", type: "button", "aria-label": unreadIds.size ? `${buttonText}, ${unreadIds.size} new` : buttonText,
    onclick: () => open(),
  }, [sparkle(), el("span", { text: buttonText }), badge]);
  if (launch) root.append(launch);

  const formatDate = (value) => {
    try {
      return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return "";
    }
  };
  const shade = el("div", { class: "shade", hidden: true, onclick: () => close() });
  const list = el("ul", { class: "list" });
  const panel = el("div", { class: "panel", part: "box", role: "dialog", "aria-modal": "true", "aria-labelledby": "t", hidden: true }, [
    el("div", { class: "head" }, [
      el("p", { class: "title", part: "title", id: "t", text: notice.title || "What's new" }),
      el("button", { class: "x", type: "button", "aria-label": "Close", title: "Close", text: "✕", onclick: () => close() }),
    ]),
    list,
  ]);
  root.append(shade, panel);

  const fill = () => {
    list.replaceChildren(...(notice.entries || []).map((entry) => {
      const href = safeUrl(entry.link_url);
      const src = entry.image ? callbacks.imageUrl?.(entry.image) : "";
      // The size keeps the list from jumping as images load; a broken one goes.
      const shot = src ? el("img", {
        class: "shot", src, alt: entry.image.alt || "", loading: "lazy", decoding: "async",
        width: entry.image.width, height: entry.image.height, onerror: () => shot.remove(),
      }) : null;
      return el("li", { class: "entry" }, [
        el("div", { class: "meta" }, [
          ...(unreadIds.has(entry.id) ? [el("span", { class: "new", title: "New" })] : []),
          ...(entry.label ? [el("span", { class: "label", text: entry.label })] : []),
          el("time", { datetime: entry.date, text: formatDate(entry.date) }),
        ]),
        el("h3", { text: entry.title }),
        ...(shot ? [shot] : []),
        ...(entry.body ? [el("p", { text: entry.body })] : []),
        ...(href ? [el("a", { class: "more", href, target: "_blank", rel: "noopener", text: "Read more →", onclick: () => callbacks.click() })] : []),
      ]);
    }));
  };

  // Esc closes; Tab stays inside the panel while it's open.
  const onKey = (e) => {
    if (e.key === "Escape") close();
    if (e.key !== "Tab") return;
    const stops = [...panel.querySelectorAll("button, a[href]")];
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = root.activeElement;
    if (e.shiftKey ? active === first || !panel.contains(active) : active === last || !panel.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  };
  let opener = null;
  function open() {
    if (!panel.hidden) return;
    opener = document.activeElement;
    fill();
    shade.hidden = false;
    panel.hidden = false;
    panel.querySelector(".x").focus({ preventScroll: true });
    document.addEventListener("keydown", onKey, true);
    // Seen now; the dots stay until it's closed.
    callbacks.opened();
  }
  function close() {
    shade.hidden = true;
    panel.hidden = true;
    document.removeEventListener("keydown", onKey, true);
    unreadIds.clear();
    badge.hidden = true;
    launch?.setAttribute("aria-label", buttonText);
    // Back to where the visitor was (the launcher, or the site's own link).
    (opener === host ? launch : opener)?.focus?.({ preventScroll: true });
  }
  document.body.append(host);
  site.update();
  return {
    open,
    remove: () => {
      document.removeEventListener("keydown", onKey, true);
      site.stop();
      host.remove();
    },
  };
}

//. POPUP ---------------------------------------------------------
// A promotion over the page: centred (modal), covering the screen (full) or
// a small card in a corner. It waits for its image (up to 3 seconds) so it
// comes in whole, and plays its animation out again when it closes. On
// phones a modal becomes a sheet at the bottom, which Google doesn't count
// as an intrusive interstitial.
const FROM = {
  fade: "opacity: 0;",
  zoom: "opacity: 0; transform: scale(.92);",
  up: "opacity: 0; transform: translateY(48px);",
  none: "",
};

export function renderPopup(notice, callbacks) {
  const look = notice.look || {};
  const onAccent = color(look.text_color, "#ffffff");
  const size = ["full", "corner"].includes(notice.size) ? notice.size : "modal";
  const left = look.position === "left";
  const image = notice.image && callbacks.image ? callbacks.image : "";
  let layout = image ? notice.layout || "top" : "text";
  const from = notice.animation === "side"
    ? `opacity: 0; transform: translateX(${left ? "-" : ""}64px);`
    : FROM[notice.animation] ?? FROM.zoom;
  const { host, root, site } = shadowHost(look, (seen, font) => {
    const accent = color(seen.color, "#111827");
    const s = surface(seen);
    const { bg, fg } = s;
    const FONT = fontRule(font);
    return `
    .shade {
      position: fixed; z-index: 2147483000; inset: 0; background: rgba(0,0,0,.55);
      animation: shade-in .3s ease-out both;
    }
    .shade.out { animation: shade-out .22s ease-in both; }
    @keyframes shade-in { from { opacity: 0; } }
    @keyframes shade-out { to { opacity: 0; } }
    .wrap {
      position: fixed; z-index: 2147483001; inset: 0; display: flex; align-items: center; justify-content: center;
      padding: 16px; box-sizing: border-box; pointer-events: none;
    }
    .pop {
      position: relative; box-sizing: border-box; ${FONT} pointer-events: auto; display: flex; flex-direction: column;
      width: 520px; max-width: 100%; max-height: 100%; overflow: hidden auto; border-radius: 16px;
      background: ${bg}; color: ${fg}; box-shadow: 0 24px 64px rgba(0,0,0,.32);
      animation: pop-in .4s cubic-bezier(.2,.8,.2,1) both;
    }
    .pop.out { animation: pop-out .22s ease-in both; }
    @keyframes pop-in { from { ${from} } }
    @keyframes pop-out { to { ${from} } }
    @media (prefers-reduced-motion: reduce) { .shade, .pop { animation: none !important; } }

    .media { display: block; flex: none; background: ${s.mute}; }
    .media img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .content { display: flex; flex-direction: column; gap: 12px; padding: 28px; }
    h2 { margin: 0; font-size: 24px; line-height: 1.2; font-weight: 800; letter-spacing: -.01em; }
    .body { margin: 0; white-space: pre-wrap; opacity: .85; font-size: 15px; }
    .extras { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; margin-top: 4px; }
    .code {
      display: inline-flex; align-items: center; gap: 8px; padding: 4px 4px 4px 12px; border: 1.5px dashed currentColor; border-radius: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; letter-spacing: .06em;
    }
    .copy {
      border: 0; border-radius: 6px; padding: 4px 10px; background: ${accent}; color: ${onAccent};
      font: 600 12px/1.5 system-ui, -apple-system, sans-serif; letter-spacing: 0; cursor: pointer;
    }
    .time { display: inline-flex; gap: 4px; font-variant-numeric: tabular-nums; }
    .seg {
      display: inline-flex; align-items: baseline; gap: 1px; min-width: 34px; justify-content: center; padding: 4px 6px;
      border-radius: 6px; background: ${s.faint}; font-weight: 700;
    }
    .seg small { font-size: 10px; font-weight: 600; opacity: .7; }
    .cta {
      display: flex; align-items: center; justify-content: center; gap: 6px; padding: 13px 22px; border-radius: 10px;
      background: ${accent}; color: ${onAccent}; font-weight: 700; font-size: 15px; text-decoration: none;
      transition: transform .15s, box-shadow .15s;
    }
    .cta:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,.2); }
    .cta:focus-visible, .copy:focus-visible, .x:focus-visible, .whole:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }
    .x {
      position: absolute; z-index: 2; top: 10px; right: 10px; width: 34px; height: 34px; border: 0; border-radius: 50%;
      background: ${s.chip}; color: ${fg}; cursor: pointer; font-size: 16px; line-height: 1;
      box-shadow: 0 1px 4px rgba(0,0,0,.15);
    }
    .x:hover { background: ${s.deep ? "#000000aa" : "#ffffff"}; }

    /* Layouts */
    .top .media { aspect-ratio: var(--ratio, 16 / 9); max-height: 50vh; }
    .side { width: 760px; flex-direction: row; }
    .side .media { width: 44%; }
    .side .content { flex: 1; justify-content: center; }
    .cover { color: #fff; background: #111827; }
    .cover .media { position: absolute; inset: 0; }
    .cover .media::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.1) 20%, rgba(0,0,0,.72)); }
    .cover .content { position: relative; justify-content: flex-end; min-height: 360px; padding-top: 80px; }
    .cover .x { background: #00000066; color: #fff; }
    .image { width: auto; max-width: min(720px, 100%); background: transparent; }
    .image .media { background: transparent; }
    .image .media img { width: auto; max-width: 100%; max-height: calc(100vh - 32px); object-fit: contain; }
    .whole { display: block; }

    /* Sizes */
    :host(.full) .wrap { padding: 0; }
    :host(.full) .pop { width: 100%; height: 100%; max-width: none; border-radius: 0; }
    :host(.full) .top .media { flex: 1; max-height: none; aspect-ratio: auto; }
    :host(.full) .top .content, :host(.full) .text .content { max-width: 640px; margin: 0 auto; width: 100%; box-sizing: border-box; }
    :host(.full) .text { justify-content: center; }
    :host(.full) .side .media { width: 50%; }
    :host(.full) .side .content { padding: 48px; }
    :host(.full) .cover .content { min-height: 0; flex: 1; padding: 48px; max-width: 760px; }
    :host(.full) .image { background: #000; align-items: center; justify-content: center; }
    :host(.full) h2 { font-size: 34px; }
    :host(.corner) .wrap { inset: auto 0 0 0; justify-content: ${left ? "flex-start" : "flex-end"}; align-items: flex-end; }
    :host(.corner) .pop { width: 360px; border-radius: 14px; max-height: calc(100vh - 32px); }
    :host(.corner) .side { width: 360px; flex-direction: column; }
    :host(.corner) .side .media { width: 100%; aspect-ratio: 16 / 9; }
    :host(.corner) .content { padding: 20px; gap: 10px; }
    :host(.corner) .cover .content { min-height: 240px; }
    :host(.corner) h2 { font-size: 18px; }
    :host(.corner) .body { font-size: 14px; }

    @media (max-width: 600px) {
      :host(.modal) .wrap, :host(.corner) .wrap { padding: 0; align-items: flex-end; }
      :host(.modal) .pop, :host(.corner) .pop { width: 100%; max-height: 88vh; border-radius: 16px 16px 0 0; }
      :host(.modal) .image { width: auto; border-radius: 16px; margin: 0 12px 12px; }
      .side, :host(.full) .side { flex-direction: column; }
      .side .media, :host(.full) .side .media { width: 100%; aspect-ratio: 16 / 9; flex: none; }
      .content, :host(.full) .side .content, :host(.full) .cover .content { padding: 22px; }
      .cover .content { min-height: 300px; }
      h2, :host(.full) h2 { font-size: 21px; }
    }
  `;
  });
  host.className = size;

  const pop = el("div", {
    class: `pop ${layout}`, part: "box", role: "dialog", "aria-modal": size === "corner" ? "false" : "true",
    "aria-label": notice.title || notice.image?.alt || notice.name || "Offer",
  });
  if (notice.image?.width && notice.image?.height) pop.style.setProperty("--ratio", `${notice.image.width} / ${notice.image.height}`);
  const href = safeUrl(notice.link_url);
  const onLink = () => {
    callbacks.click();
    close();
  };

  const img = image ? el("img", {
    src: image, alt: notice.image.alt || "", decoding: "async",
    width: notice.image.width, height: notice.image.height,
  }) : null;
  if (img) {
    pop.append(el("div", { class: "media" }, [layout === "image" && href
      ? el("a", { class: "whole", href, onclick: onLink, "aria-label": notice.image.alt || notice.link_label || "Open offer" }, [img])
      : img]));
  }

  let timer = null;
  if (layout !== "image") {
    const content = el("div", { class: "content" });
    if (notice.title) content.append(el("h2", { part: "title", text: notice.title }));
    if (notice.body) content.append(el("p", { class: "body", text: notice.body }));
    const extras = el("div", { class: "extras" });
    if (notice.coupon) {
      const copy = el("button", { class: "copy", type: "button", text: "Copy", "aria-label": `Copy code ${notice.coupon}` });
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(notice.coupon);
          callbacks.copy?.();
          copy.textContent = "Copied ✓";
          setTimeout(() => { copy.textContent = "Copy"; }, 2000);
        } catch { /* clipboard blocked: the code is on screen */ }
      });
      extras.append(el("span", { class: "code" }, [el("span", { text: notice.coupon }), copy]));
    }
    if (notice.countdown && notice.ends_at && timeLeft(notice.ends_at)) {
      const time = el("span", { class: "time", role: "timer", "aria-live": "off" });
      const pad = (n) => String(n).padStart(2, "0");
      const seg = (value, unit) => el("span", { class: "seg" }, [document.createTextNode(value), el("small", { text: unit })]);
      const tick = () => {
        const left = timeLeft(notice.ends_at);
        if (!left) {
          clearInterval(timer);
          return time.remove();
        }
        time.replaceChildren(...(left.d ? [seg(left.d, "d")] : []), seg(pad(left.h), "h"), seg(pad(left.m), "m"), seg(pad(left.s), "s"));
      };
      tick();
      timer = setInterval(tick, 1000);
      extras.append(time);
    }
    if (extras.childNodes.length) content.append(extras);
    if (href && notice.link_label) {
      content.append(el("a", { class: "cta", part: "button", href, onclick: onLink }, [
        el("span", { text: notice.link_label }), el("span", { "aria-hidden": "true", text: "→" }),
      ]));
    }
    pop.append(content);
  }
  pop.append(el("button", { class: "x", type: "button", "aria-label": "Close", title: "Close", text: "✕", onclick: () => close() }));

  const shade = size === "corner" ? null : el("div", { class: "shade", onclick: () => close() });
  const wrap = el("div", { class: "wrap" }, [pop]);
  // A click beside the popup is a click on the shade.
  if (shade) wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  wrap.style.pointerEvents = shade ? "auto" : "";

  const onKey = (e) => {
    // A corner popup isn't modal: Esc closes it only from inside, not when the
    // visitor is closing the site's own menu.
    if (e.key === "Escape" && (size !== "corner" || e.composedPath().includes(host))) close();
    if (e.key !== "Tab" || size === "corner") return;
    const stops = [...pop.querySelectorAll("button, a[href]")];
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = root.activeElement;
    if (e.shiftKey ? active === first || !pop.contains(active) : active === last || !pop.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  };

  let opener = null;
  let overflow = null;
  let state = "waiting";
  function show() {
    if (state !== "waiting") return;
    state = "open";
    opener = document.activeElement;
    if (shade) root.append(shade);
    root.append(wrap);
    document.body.append(host);
    site.update();
    if (size !== "corner") {
      // The page behind stays put.
      overflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      pop.querySelector(".x").focus({ preventScroll: true });
    }
    document.addEventListener("keydown", onKey, true);
    callbacks.shown?.();
  }
  function remove() {
    state = "gone";
    clearInterval(timer);
    document.removeEventListener("keydown", onKey, true);
    if (overflow !== null) document.documentElement.style.overflow = overflow;
    overflow = null;
    site.stop();
    host.remove();
  }
  // The ✕, Esc, the shade or a link: the visitor is done with it.
  function close() {
    if (state !== "open") return remove();
    state = "closing";
    callbacks.close();
    pop.classList.add("out");
    shade?.classList.add("out");
    if (size !== "corner") opener?.focus?.({ preventScroll: true });
    // A timer rather than animationend, which never comes without motion.
    setTimeout(remove, matchMedia("(prefers-reduced-motion: reduce)").matches || notice.animation === "none" ? 0 : 230);
  }

  if (img) {
    // No image, no popup for "image only"; the others go on without it.
    const ready = img.decode ? img.decode() : new Promise((ok, no) => { img.onload = ok; img.onerror = no; });
    const wait = setTimeout(show, 3000);
    ready.then(() => {
      clearTimeout(wait);
      show();
    }, () => {
      clearTimeout(wait);
      if (layout === "image") {
        remove();
        return callbacks.failed?.();
      }
      img.parentElement?.remove();
      layout = "text";
      pop.className = "pop text";
      show();
    });
  } else {
    show();
  }
  return remove;
}
