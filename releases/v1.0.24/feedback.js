// Feedback button and form. Loaded by the tracker only on sites that turned
// feedback on. Renders inside a shadow root, so the site's CSS can't change it
// and its CSS can't leak into the site. "Point at it" lets the visitor click
// the part of the page they mean; the report gets that element's heatmap
// selector and position (never what was typed in it).
// api: selector(element) → string, submit(report) → Promise<{ ok, message }>.
// Returns { open() }.

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

const css = (color, dark, left) => `
  :host { all: initial; }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  .root { font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: ${dark ? "#f9fafb" : "#111827"}; }
  .launch {
    position: fixed; z-index: 2147482999; bottom: 96px; ${left ? "left: 0; border-radius: 0 8px 8px 0;" : "right: 0; border-radius: 8px 0 0 8px;"}
    writing-mode: vertical-rl; ${left ? "transform: rotate(180deg);" : ""}
    border: 0; padding: 12px 8px; cursor: pointer; font: 600 13px/1 system-ui, sans-serif; letter-spacing: .02em;
    background: ${color}; color: #fff; box-shadow: 0 4px 14px rgba(0,0,0,.18);
  }
  .launch:focus-visible { outline: 3px solid ${color}55; outline-offset: 2px; }
  .panel {
    position: fixed; z-index: 2147483000; bottom: 16px; ${left ? "left: 16px;" : "right: 16px;"}
    width: calc(100vw - 32px); max-width: 360px; padding: 16px; border-radius: 12px;
    background: ${dark ? "#111827" : "#ffffff"}; border: 1px solid ${dark ? "#374151" : "#e5e7eb"};
    box-shadow: 0 10px 30px rgba(0,0,0,.2); display: flex; flex-direction: column; gap: 12px;
  }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  h2 { margin: 0; font-size: 16px; font-weight: 600; }
  .x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; font-size: 18px; line-height: 1; padding: 2px; }
  .x:hover, .x:focus-visible { opacity: 1; }
  .cats { display: flex; flex-wrap: wrap; gap: 6px; }
  .cat {
    flex: 1 1 auto; padding: 7px 10px; border-radius: 8px; cursor: pointer; font: inherit; color: inherit; background: none;
    border: 1px solid ${dark ? "#4b5563" : "#d1d5db"};
  }
  .cat[aria-pressed="true"] { border-color: ${color}; background: ${color}22; }
  textarea, input {
    width: 100%; padding: 9px 12px; border-radius: 8px; font: inherit; color: inherit; background: none;
    border: 1px solid ${dark ? "#4b5563" : "#d1d5db"};
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
  const color = /^#[0-9a-f]{3,8}$/i.test(settings.color || "") ? settings.color : "#2563eb";
  const categories = (settings.categories || ["bug", "idea", "other"]).filter((c) => ["bug", "idea", "other"].includes(c));

  const host = document.createElement("div");
  host.setAttribute("data-noanalytics", "");
  const root = host.attachShadow({ mode: "open" });
  root.append(el("style", { text: css(color, settings.theme === "dark", settings.position === "left") }));
  const wrap = el("div", { class: "root" });
  root.append(wrap);
  document.body.append(host);

  let panel = null;
  let launch = null;
  let picking = false;
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
  }

  function render(error = "") {
    const message = el("textarea", { "aria-label": texts.placeholder, placeholder: texts.placeholder, maxlength: "2000" });
    message.value = state.message;
    const send = el("button", { class: "btn", type: "submit", text: texts.send });
    const sync = () => {
      state.message = message.value;
      send.disabled = !message.value.trim();
    };
    message.addEventListener("input", sync);
    sync();

    const cats = el("div", { class: "cats", role: "group", "aria-label": texts.title });
    for (const category of categories) {
      cats.append(el("button", {
        class: "cat", type: "button", "aria-pressed": String(state.category === category), text: texts[category],
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

    const email = settings.ask_email ? el("input", { type: "email", placeholder: texts.email, "aria-label": texts.email, maxlength: "200" }) : null;
    if (email) {
      email.value = state.email;
      email.addEventListener("input", () => { state.email = email.value; });
    }

    const form = el("form", { class: "panel", role: "dialog", "aria-modal": "false", "aria-labelledby": "fb-title" }, [
      el("div", { class: "head" }, [
        el("h2", { id: "fb-title", text: texts.title }),
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
      const done = el("div", { class: "panel", role: "status" }, [el("p", { class: "thanks", text: texts.thanks })]);
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
    if (launch) launch.hidden = true;
    document.addEventListener("keydown", onKey, true);
    render();
  }

  return { open };
}
