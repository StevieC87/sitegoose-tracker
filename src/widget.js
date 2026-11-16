// Widgets the site owner mounts inside their own pages, in an empty element
// carrying data-analytics-widget="<kind>". Loaded by the tracker only when a
// page has one. Renders inside a shadow root, so the site's CSS can't break
// the layout.
//
// Unlike the overlay widgets (notice.js, survey.js, feedback.js) these open
// with `font: inherit` instead of `all: initial`: a bar floating over the page
// should look like ours, but a badge sitting in the page's own footer should
// look like the page it is in. Everything else comes from the look the owner
// chose in the dashboard.
//
// renderStatusBadge(mount, widget, status) -> { remove() }
// renderTestimonials(mount, widget, feed) -> { remove() }

const HEX = /^#[0-9a-f]{6}$/i;
const color = (value, fallback) => (HEX.test(value || "") ? value : fallback);
const safeUrl = (value) => (/^https?:\/\//i.test(value || "") ? value : "");

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

// Inherits the page's type and colour; only what the widget draws itself is set.
// `kind` is its data-sg-widget value, a name the site's CSS can rely on.
function shadowHost(mount, kind, css) {
  const host = el("div", { "data-noanalytics": "", "data-sg-widget": kind });
  const root = host.attachShadow({ mode: "open" });
  root.append(el("style", {
    text: `:host { display: block; font: inherit; color: inherit; line-height: inherit; }
      [hidden] { display: none !important; } ${css}`,
  }));
  mount.append(host);
  return { host, root };
}

// "dark" and "light" are the owner's choice; "auto" follows the visitor's
// system, which is the closest we can get to following the site's own theme
// from inside a shadow root.
function themeColors(look) {
  const dark = look.theme === "dark" || (look.theme !== "light"
    && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  return dark
    ? { border: "rgba(255,255,255,.18)", surface: "rgba(255,255,255,.04)", muted: "rgba(255,255,255,.55)", blank: "rgba(255,255,255,.14)" }
    : { border: "rgba(0,0,0,.12)", surface: "rgba(0,0,0,.02)", muted: "rgba(0,0,0,.5)", blank: "rgba(0,0,0,.1)" };
}

const STATES = {
  up: { label: "All systems operational", dot: "#16a34a" },
  down: { label: "Service disruption", dot: "#dc2626" },
  unknown: { label: "Status unavailable", dot: "#9ca3af" },
};

// A day with no check is blank, not green: we don't claim a day we never watched.
const barColor = (uptime, ok, bad, blank) => (uptime === null || uptime === undefined ? blank
  : uptime >= 99.9 ? ok : uptime >= 95 ? "#f59e0b" : bad);

// The ::part() names box and label are a promise to every site that styles
// them: never rename one.
export function renderStatusBadge(mount, widget, status) {
  const look = widget.look || {};
  const size = ["text", "pill", "bars"].includes(look.size) ? look.size : "pill";
  const state = STATES[status?.status] || STATES.unknown;
  const dot = status?.status === "up" ? color(look.accent, state.dot) : state.dot;
  const t = themeColors(look);
  const uptime = typeof status?.uptime === "number" ? status.uptime : null;
  const days = Array.isArray(status?.days) ? status.days : [];

  const { host, root } = shadowHost(mount, "status", `
    .wrap { display: inline-flex; flex-direction: column; gap: 8px; max-width: 100%; }
    .row { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: inherit; }
    .pill { box-sizing: border-box; padding: 7px 12px; border: 1px solid ${t.border}; border-radius: 999px; background: ${t.surface}; }
    a.row:hover { border-color: ${dot}; }
    .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: ${dot}; }
    .dot.live { animation: pulse 2s ease-in-out infinite; }
    .label { font-size: .9em; }
    .pct { font-size: .9em; color: ${t.muted}; }
    .bars { display: flex; align-items: flex-end; gap: 2px; height: 26px; }
    .bar { flex: 1 1 0; min-width: 2px; height: 100%; border-radius: 2px; }
    .foot { display: flex; justify-content: space-between; gap: 12px; font-size: .78em; color: ${t.muted}; }
    @media (prefers-reduced-motion: reduce) { .dot.live { animation: none; } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  `);

  const link = safeUrl(status?.status_url);
  const label = el("span", { class: "label", part: "label", text: state.label });
  const parts = [el("span", { class: `dot${status?.status === "up" ? " live" : ""}`, "aria-hidden": "true" }), label];
  if (size !== "text" && uptime !== null) parts.push(el("span", { class: "pct", text: `${uptime.toFixed(2)}%` }));

  // A link when the owner has a public status page, plain text when not.
  const row = link
    ? el("a", { class: `row${size === "text" ? "" : " pill"}`, href: link, target: "_blank", rel: "noopener" }, parts)
    : el("span", { class: `row${size === "text" ? "" : " pill"}` }, parts);

  const children = [row];
  if (size === "bars" && days.length) {
    children.push(el("div", { class: "bars", "aria-hidden": "true" }, days.map((d) => el("span", {
      class: "bar",
      style: `background: ${barColor(d.uptime, color(look.accent, "#16a34a"), "#dc2626", t.blank)}`,
      title: d.uptime === null ? `${d.date}: not checked` : `${d.date}: ${d.uptime.toFixed(2)}%`,
    }))));
    children.push(el("div", { class: "foot" }, [
      el("span", { text: `${days.length} days ago` }),
      el("span", { text: "Today" }),
    ]));
  }

  // One announcement for screen readers, rather than each piece being read.
  root.append(el("div", {
    class: "wrap", part: "box", role: "status",
    "aria-label": uptime === null ? state.label
      : days.length ? `${state.label}. ${uptime.toFixed(2)}% uptime over the last ${days.length} days.`
        : `${state.label}. ${uptime.toFixed(2)}% uptime.`,
  }, children));

  return { remove: () => host.remove() };
}

//. TESTIMONIALS -------------------------------------------------
// The site's approved testimonials, where the owner put the element. It has no
// theme of its own: the words take the page's font and text colour, and the
// lines around them are that same colour, faint, so the block follows a dark
// page without being told. Everything a visitor wrote is set as text, never as
// markup. The ::part() names (quote, text, name, role, stars) are a promise to
// every site that styles them: never rename one.
//
// feed: { items: [{ id, text, name, role, rating }], branded }. branded puts
// "Powered by SiteGoose" under the block (Free); it has no part name, so the
// site's CSS doesn't reach it.
const starsOf = (rating) => el("span", { class: "stars", part: "stars", role: "img", "aria-label": `${rating} / 5` }, [
  el("span", { "aria-hidden": "true", text: "★".repeat(rating) }),
  el("span", { class: "off", "aria-hidden": "true", text: "★".repeat(5 - rating) }),
]);

const quoteOf = (item, stars) => el("figure", { class: "quote", part: "quote" }, [
  ...(stars && item.rating ? [starsOf(item.rating)] : []),
  el("blockquote", { class: "text", part: "text", text: item.text }),
  el("figcaption", {}, [
    el("span", { class: "name", part: "name", text: item.name }),
    ...(item.role ? [el("span", { class: "role", part: "role", text: item.role })] : []),
  ]),
]);

export function renderTestimonials(mount, widget, feed) {
  const look = widget.look || {};
  const layout = ["wall", "list", "single"].includes(look.layout) ? look.layout : "wall";
  const count = Math.min(Math.max(Number(look.count) || 9, 1), 50);
  const items = (Array.isArray(feed?.items) ? feed.items : []).filter((item) => item?.text && item?.name).slice(0, count);
  if (!items.length) return null;
  const accent = color(look.accent, "currentColor");

  const { host, root } = shadowHost(mount, "testimonials", `
    .wall { columns: 280px; column-gap: 16px; }
    .wall .quote { break-inside: avoid; margin: 0 0 16px; }
    .list { display: flex; flex-direction: column; gap: 16px; }
    .quote { position: relative; margin: 0; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; }
    /* The card's line, in the page's own text colour: a border can't be made
       faint without also fading what is inside it. */
    .quote::before { content: ""; position: absolute; inset: 0; border: 1px solid currentColor; border-radius: 12px; opacity: .16; pointer-events: none; }
    .text { margin: 0; white-space: pre-line; overflow-wrap: anywhere; }
    figcaption { display: flex; flex-direction: column; font-size: .9em; }
    .name { font-weight: 600; }
    .role { opacity: .65; }
    .stars { color: ${accent}; letter-spacing: 1px; line-height: 1; }
    .stars .off { opacity: .22; }
    .nav { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 10px; font-size: .9em; }
    .nav button { font: inherit; color: inherit; background: none; border: 0; padding: 4px 10px; cursor: pointer; opacity: .7; }
    .nav button:hover, .nav button:focus-visible { opacity: 1; }
    .credit { margin: 10px 0 0; font-size: 12px; opacity: .6; }
    .credit a { color: inherit; text-decoration: none; }
    .credit a:hover { text-decoration: underline; }
  `);

  const children = [];
  if (layout === "single") {
    // One at a time, moved by the visitor: nothing changes by itself.
    let at = 0;
    const slot = el("div", { "aria-live": "polite" });
    const place = el("span");
    const show = (step) => {
      at = (at + step + items.length) % items.length;
      slot.replaceChildren(quoteOf(items[at], look.stars !== false));
      place.textContent = `${at + 1} / ${items.length}`;
    };
    show(0);
    children.push(slot);
    if (items.length > 1) {
      children.push(el("div", { class: "nav" }, [
        el("button", { type: "button", "aria-label": "Previous", text: "‹", onclick: () => show(-1) }),
        place,
        el("button", { type: "button", "aria-label": "Next", text: "›", onclick: () => show(1) }),
      ]));
    }
  } else {
    children.push(el("div", { class: layout }, items.map((item) => quoteOf(item, look.stars !== false))));
  }
  if (feed.branded) {
    children.push(el("p", { class: "credit" }, [
      el("a", { href: "https://sitegoose.com/?utm_source=powered-by&utm_medium=widget", target: "_blank", rel: "noopener", text: "Powered by SiteGoose" }),
    ]));
  }
  root.append(...children);

  return { remove: () => host.remove() };
}
