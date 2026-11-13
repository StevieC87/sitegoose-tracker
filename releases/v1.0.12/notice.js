// Announcement bar and "What's new" panel. Loaded by the tracker only when a
// notice is shown. Renders inside a shadow root, so the site's CSS can't
// change it. Text is set as text, never as HTML.
// renderBar(notice, { click(), close() }) -> remove()
// renderChangelog(notice, { unread, opened(), click() }) -> { open(), remove() }

const HEX = /^#[0-9a-f]{6}$/i;
const color = (value, fallback) => (HEX.test(value || "") ? value : fallback);
const safeUrl = (value) => (/^https?:\/\//i.test(value || "") ? value : "");
const FONT = 'font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;';

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

function shadowHost(css) {
  const host = document.createElement("div");
  host.setAttribute("data-noanalytics", "");
  const root = host.attachShadow({ mode: "open" });
  root.append(el("style", { text: `:host { all: initial; } [hidden] { display: none !important; } ${css}` }));
  return { host, root };
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
  const look = notice.look || {};
  const bg = color(look.color, "#111827");
  const fg = color(look.text_color, "#ffffff");
  const bottom = look.position === "bottom";
  const { host, root } = shadowHost(`
    .bar {
      box-sizing: border-box; ${FONT} display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
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
  const bar = el("div", { class: "bar", role: "region", "aria-label": notice.name || "Announcement" });
  bar.append(el("span", { class: "text", text: notice.text || "" }));
  // Coupon, countdown and button stay together on one row on phones.
  const extras = el("span", { class: "extras" });

  if (notice.coupon) {
    const copy = el("button", { class: "copy", type: "button", text: "Copy", "aria-label": `Copy code ${notice.coupon}` });
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(notice.coupon);
        copy.textContent = "Copied ✓";
        setTimeout(() => { copy.textContent = "Copy"; }, 2000);
      } catch { /* clipboard blocked: the code is on screen */ }
    });
    extras.append(el("span", { class: "code" }, [el("span", { text: notice.coupon }), copy]));
  }

  let timer = null;
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
    extras.append(el("a", { class: "cta", href, onclick: () => callbacks.click() }, [
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

  let room = null;
  function remove() {
    clearInterval(timer);
    room?.disconnect();
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
  const accent = color(look.color, "#2563eb");
  const dark = look.theme === "dark";
  const left = look.position === "left";
  const { host, root } = shadowHost(`
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
      background: ${dark ? "#111827" : "#ffffff"}; color: ${dark ? "#f9fafb" : "#111827"}; box-shadow: 0 0 40px rgba(0,0,0,.25);
      animation: slide .3s cubic-bezier(.2,.8,.2,1);
    }
    .head { border-top: 4px solid ${accent}; }
    .head { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid ${dark ? "#374151" : "#e5e7eb"}; }
    .title { flex: 1; margin: 0; font-size: 18px; font-weight: 700; }
    .x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; font-size: 18px; line-height: 1; padding: 4px; }
    .x:hover, .x:focus-visible { opacity: 1; }
    .list { flex: 1; overflow-y: auto; margin: 0; padding: 4px 20px 20px; list-style: none; }
    .entry { padding: 16px 0; border-bottom: 1px solid ${dark ? "#1f2937" : "#f3f4f6"}; }
    .entry:last-child { border-bottom: 0; }
    .meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; opacity: .7; }
    .label { padding: 1px 8px; border-radius: 999px; background: ${accent}22; color: ${dark ? "#fff" : accent}; font-weight: 700; opacity: 1; }
    .new { width: 8px; height: 8px; border-radius: 50%; background: ${accent}; }
    .entry h3 { margin: 0 0 4px; font-size: 15px; font-weight: 700; }
    .entry p { margin: 0 0 8px; white-space: pre-wrap; opacity: .85; }
    .more { color: ${dark ? "#93c5fd" : accent}; font-weight: 600; text-decoration: none; }
    .more:hover { text-decoration: underline; }
  `);

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
  const panel = el("div", { class: "panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "t", hidden: true }, [
    el("div", { class: "head" }, [
      el("p", { class: "title", id: "t", text: notice.title || "What's new" }),
      el("button", { class: "x", type: "button", "aria-label": "Close", title: "Close", text: "✕", onclick: () => close() }),
    ]),
    list,
  ]);
  root.append(shade, panel);

  const fill = () => {
    list.replaceChildren(...(notice.entries || []).map((entry) => {
      const href = safeUrl(entry.link_url);
      return el("li", { class: "entry" }, [
        el("div", { class: "meta" }, [
          ...(unreadIds.has(entry.id) ? [el("span", { class: "new", title: "New" })] : []),
          ...(entry.label ? [el("span", { class: "label", text: entry.label })] : []),
          el("time", { datetime: entry.date, text: formatDate(entry.date) }),
        ]),
        el("h3", { text: entry.title }),
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
  return {
    open,
    remove: () => {
      document.removeEventListener("keydown", onKey, true);
      host.remove();
    },
  };
}
