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
function shadowHost(mount, css) {
  const host = el("div", { "data-noanalytics": "" });
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

export function renderStatusBadge(mount, widget, status) {
  const look = widget.look || {};
  const size = ["text", "pill", "bars"].includes(look.size) ? look.size : "pill";
  const state = STATES[status?.status] || STATES.unknown;
  const dot = status?.status === "up" ? color(look.accent, state.dot) : state.dot;
  const t = themeColors(look);
  const uptime = typeof status?.uptime === "number" ? status.uptime : null;
  const days = Array.isArray(status?.days) ? status.days : [];

  const { host, root } = shadowHost(mount, `
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
  const label = el("span", { class: "label", text: state.label });
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
    class: "wrap", role: "status",
    "aria-label": uptime === null ? state.label
      : days.length ? `${state.label}. ${uptime.toFixed(2)}% uptime over the last ${days.length} days.`
        : `${state.label}. ${uptime.toFixed(2)}% uptime.`,
  }, children));

  return { remove: () => host.remove() };
}
