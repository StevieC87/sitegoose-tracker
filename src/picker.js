// Element picker on the live site. Loaded by the tracker only when the
// dashboard's Events page opens the site with a picking link
// (?ev_pick=<token>, checked with the collector). Click an element, say when
// it counts (clicked, seen, its form submitted, hovered or its input changed),
// which elements (this one, every one like it, or any with its text) and on
// which pages, name it, and the dashboard window that opened this tab (only
// its origin) creates the event. From then on the tracker sends it whenever
// that happens on a matching element, with no code on the site.
// Lives in a shadow root, like editor.js, so the site's CSS can't change it.
// startPicker({ token, dashboardOrigin, onExit }) -> { pageChanged() }
import { isStableClass, selectorFor } from "./editor.js";

const FONT = 'font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;';
const MAX_MARKS = 50;

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false || value === null) continue;
    if (key === "text") node.textContent = value;
    else if (key === "value") node.value = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children) if (child) node.append(child);
  return node;
};

const textOf = (node) => (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
// When the event is sent, and the verb its suggested name starts with.
const TRIGGERS = [
  ["click", "Clicked", "It's clicked"],
  ["seen", "Saw", "It's seen (scrolled into view, once per page view)"],
  ["submit", "Submitted", "Its form is submitted"],
  ["hover", "Hovered", "The mouse goes over it (once per page view)"],
  ["change", "Changed", "Its value is changed (a field, dropdown or checkbox)"],
];
const isField = (node) => ["INPUT", "SELECT", "TEXTAREA"].includes(node.tagName);
// What an element is called: its text, or for forms and fields their name.
const nameOf = (node) => (["FORM", ...["INPUT", "SELECT", "TEXTAREA"]].includes(node.tagName)
  ? node.getAttribute("aria-label") || node.getAttribute("name") || node.id || node.getAttribute("placeholder") || ""
  : textOf(node));
// Event names allow letters, numbers, spaces, _ - . and : (backend siteEvents.js).
const suggestName = (trigger, node) => {
  const verb = TRIGGERS.find(([t]) => t === trigger)?.[1] || "Clicked";
  return `${verb} ${nameOf(node).replace(/[^\w.\-: ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || node.tagName.toLowerCase()}`.trim();
};

const CSS_TEXT = `
:host { all: initial; }
* { box-sizing: border-box; }
.box { position: fixed; pointer-events: none; z-index: 2147483646; border-radius: 2px; }
.hover { outline: 2px dashed #16a34a; background: rgba(22, 163, 74, .08); }
.selected { outline: 3px solid #16a34a; background: rgba(22, 163, 74, .12); }
.mark { outline: 2px solid #f59e0b; background: rgba(245, 158, 11, .1); }
.tag { position: absolute; top: -22px; left: -3px; padding: 2px 6px; border-radius: 4px; background: #16a34a; color: #fff; ${FONT} font-size: 11px; white-space: nowrap; }
.panel {
  position: fixed; top: 12px; right: 12px; z-index: 2147483647; width: 340px; max-height: calc(100vh - 24px); display: flex; flex-direction: column;
  border-radius: 12px; background: #fff; color: #0f172a; box-shadow: 0 10px 40px rgba(0, 0, 0, .25); ${FONT} overflow: hidden;
}
.panel.left { right: auto; left: 12px; }
.head { padding: 12px 14px; background: #0f172a; color: #fff; display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.title { font-weight: 700; flex: 1; min-width: 0; }
.body { flex: 1; overflow: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.seg { display: inline-flex; padding: 2px; border-radius: 7px; background: rgba(255, 255, 255, .12); }
.seg button { padding: 4px 10px; border: 0; border-radius: 5px; background: none; color: #cbd5e1; font: inherit; font-weight: 600; cursor: pointer; }
.seg button.on { background: #fff; color: #0f172a; }
button.btn { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 7px; background: #fff; color: #0f172a; font: inherit; font-weight: 600; cursor: pointer; }
button.primary { border-color: #16a34a; background: #16a34a; color: #fff; }
button.primary:hover { background: #15803d; }
button.primary:disabled { opacity: .6; cursor: default; }
button.link { padding: 0; border: 0; background: none; color: #2563eb; font: inherit; font-weight: 600; cursor: pointer; }
.icon { padding: 2px 6px; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; opacity: .8; }
select, input { width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 7px; background: #fff; color: #0f172a; font: inherit; }
input.invalid { border-color: #dc2626; }
label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 12px; color: #334155; }
.h { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
.muted { color: #64748b; font-size: 12px; }
.warn { padding: 8px 10px; border-radius: 7px; background: #fef3c7; color: #78350f; font-size: 12px; }
.err { padding: 8px 10px; border-radius: 7px; background: #fef2f2; color: #991b1b; font-size: 12px; }
.done { padding: 8px 10px; border-radius: 7px; background: #dcfce7; color: #14532d; font-size: 12px; }
.ok { color: #86efac; font-size: 12px; }
.bad { color: #fca5a5; font-size: 12px; }
.quote { padding: 6px 8px; border-radius: 6px; background: #f1f5f9; overflow-wrap: anywhere; }
details summary { cursor: pointer; font-weight: 600; font-size: 12px; color: #334155; }
details[open] summary { margin-bottom: 8px; }
details > label + label { margin-top: 8px; }
ul { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
li { padding: 6px 8px; border-radius: 7px; background: #f8fafc; }
`;

export function startPicker({ token, dashboardOrigin, onExit }) {
  const host = el("div", { "data-noanalytics": "", "data-analytics-editor": "" });
  const root = host.attachShadow({ mode: "open" });
  // A constructed sheet, which a site's Content-Security-Policy style-src doesn't
  // block; a <style> here would be, leaving the panel unstyled at the page's foot.
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS_TEXT);
    root.adoptedStyleSheets = [sheet];
  } catch {
    root.append(el("style", { text: CSS_TEXT }));
  }
  document.documentElement.append(host);

  const state = {
    mode: "pick", // pick | browse
    selected: null, // the element
    form: null, // { trigger, match, selector, text, page, name } for the selected element
    sending: false,
    result: null, // { ok, message }
    created: [],
    left: false,
  };

  const hoverBox = el("div", { class: "box hover", hidden: true });
  const selectedBox = el("div", { class: "box selected", hidden: true }, [el("span", { class: "tag" })]);
  const marks = el("div");
  const panel = el("div", { class: "panel" });
  root.append(marks, hoverBox, selectedBox, panel);

  //. Talking to the dashboard
  const opener = window.opener;
  const send = (event, extra = {}) => {
    try {
      opener?.postMessage({ source: "analytics-event-picker", event, token, ...extra }, dashboardOrigin);
    } catch { /* the dashboard tab was closed */ }
  };
  const onMessage = (e) => {
    if (e.origin !== dashboardOrigin || e.source !== opener || e.data?.source !== "analytics-event-dashboard" || e.data.token !== token) return;
    if (e.data.event !== "created" && e.data.event !== "failed") return;
    state.sending = false;
    if (e.data.event === "created") {
      state.created.push(e.data.name);
      state.result = { ok: true, message: `"${e.data.name}" is set up. Clicks on it count from now on.` };
      state.selected = null;
      state.form = null;
    } else {
      state.result = { ok: false, message: e.data.message || "The dashboard couldn't create it." };
    }
    draw();
    place();
  };
  window.addEventListener("message", onMessage);
  send("ready");

  //. Which elements count
  const query = (selector) => {
    try {
      return [...document.querySelectorAll(selector)].filter((node) => node !== host && !host.contains(node));
    } catch {
      return null;
    }
  };
  const matches = (form) => {
    const found = query(form.selector);
    if (!found) return null;
    const text = form.text.toLowerCase();
    return text ? found.filter((node) => textOf(node).toLowerCase() === text) : found;
  };
  // This element, every one with its tag and classes, or any of its tag with its
  // text (not for forms and fields, whose text is what visitors type).
  function choices(node) {
    const tag = node.tagName.toLowerCase();
    const text = node.tagName === "FORM" || isField(node) ? "" : textOf(node).slice(0, 101);
    const list = [{ match: "this", label: "Only this element", selector: selectorFor(node), text: "" }];
    const classes = [...node.classList].filter(isStableClass).slice(0, 3).map((c) => `.${CSS.escape(c)}`).join("");
    if (classes && (query(`${tag}${classes}`) || []).length > 1) {
      list.push({ match: "like", label: `Every ${tag}${classes.replace(/\\/g, "")} (${query(`${tag}${classes}`).length} here)`, selector: `${tag}${classes}`, text: "" });
    }
    if (text && text.length <= 100) list.push({ match: "text", label: `Any ${tag} saying "${text}"`, selector: tag, text });
    return list;
  }
  // A form is submitted, a field changed: those pick the form or field itself.
  const triggerNode = (node, trigger) => (trigger === "submit" ? node.closest("form")
    : trigger === "change" ? (isField(node) ? node : null) : node);
  function select(node, trigger = "click") {
    const first = choices(node)[0];
    state.selected = node;
    state.result = null;
    state.form = { ...first, trigger, page: "", name: suggestName(trigger, node) };
    draw();
    place();
  }

  //. Showing where things are
  const at = (box, node) => {
    if (!node || !node.isConnected) {
      box.hidden = true;
      return;
    }
    const r = node.getBoundingClientRect();
    Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    box.hidden = false;
  };
  function place() {
    if (state.selected && !state.selected.isConnected) state.selected = null;
    at(selectedBox, state.selected);
    selectedBox.firstChild.textContent = state.selected ? state.selected.tagName.toLowerCase() : "";
    const found = state.form ? matches(state.form) || [] : [];
    marks.replaceChildren(...found.filter((node) => node !== state.selected).slice(0, MAX_MARKS).map((node) => {
      const box = el("div", { class: "box mark" });
      at(box, node);
      return box;
    }));
  }

  //. Picking elements on the page
  const ours = (node) => node === host || host.contains(node);
  const pickable = (node) => node && node.nodeType === 1 && !ours(node) && !["HTML", "BODY"].includes(node.tagName);
  const onMove = (e) => {
    if (state.mode !== "pick" || !pickable(e.target)) {
      hoverBox.hidden = true;
      return;
    }
    at(hoverBox, e.target);
  };
  const block = (e) => {
    if (state.mode !== "pick" || ours(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === "click" && pickable(e.target)) select(e.target);
  };
  const BLOCKED = ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "submit", "dblclick", "auxclick"];
  window.addEventListener("mousemove", onMove, true);
  for (const type of BLOCKED) window.addEventListener(type, block, true);
  let frame = 0;
  const follow = () => {
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      place();
    });
  };
  window.addEventListener("scroll", follow, true);
  window.addEventListener("resize", follow);

  //. The panel
  function selectedSection(node) {
    const form = state.form;
    const tag = node.tagName.toLowerCase();
    const text = textOf(node);
    const options = choices(node);
    const found = matches(form);
    const path = location.pathname;
    const section = path.split("/").filter(Boolean).length > 1 ? `${path.slice(0, path.lastIndexOf("/") + 1)}*` : "";
    const set = (patch) => {
      Object.assign(state.form, patch);
      state.result = null;
      draw();
      place();
    };

    const changeTrigger = (trigger) => {
      const target = triggerNode(node, trigger);
      if (target) select(target, trigger);
    };

    const selectorInput = el("input", { value: form.selector, onchange: (e) => set({ selector: e.target.value.trim(), match: "custom" }) });
    if (!found) selectorInput.classList.add("invalid");
    const nameInput = el("input", { value: form.name, maxlength: 100, oninput: (e) => { form.name = e.target.value; } });

    return el("div", { class: "body" }, [
      el("div", { class: "row" }, [
        el("span", { class: "h", text: `Selected: <${tag}>` }),
        el("button", { class: "link", text: "Select parent", onclick: () => {
          const parent = node.parentElement;
          if (pickable(parent)) select(parent, triggerNode(parent, form.trigger) === parent ? form.trigger : "click");
        } }),
        el("button", { class: "icon", text: "✕", title: "Clear selection", onclick: () => { state.selected = null; state.form = null; draw(); place(); } }),
      ]),
      text ? el("div", { class: "quote", text: text.length > 120 ? `${text.slice(0, 120)}…` : text }) : null,
      form.trigger !== "click" || node.closest("a, button, [role=button], input, select, textarea, summary, label") ? null
        : el("div", { class: "warn", text: "This doesn't look like a button or link. If you meant one, click it directly or use Select parent." }),

      el("label", {}, [
        "Count when",
        el("select", { onchange: (e) => changeTrigger(e.target.value) },
          TRIGGERS.filter(([t]) => triggerNode(node, t)).map(([t, , label]) => el("option", { value: t, selected: t === form.trigger || undefined, text: label }))),
      ]),

      el("label", {}, [
        "On which elements",
        el("select", { onchange: (e) => { const choice = options.find((o) => o.match === e.target.value); if (choice) set({ match: choice.match, selector: choice.selector, text: choice.text }); } }, [
          ...options.map((o) => el("option", { value: o.match, selected: o.match === form.match || undefined, text: o.label })),
          form.match === "custom" ? el("option", { value: "custom", selected: true, text: "My own selector (below)" }) : null,
        ]),
      ]),
      el("label", {}, [
        "On",
        el("select", { onchange: (e) => set({ page: e.target.value }) }, [
          el("option", { value: "", text: "Any page" }),
          el("option", { value: path, selected: form.page === path || undefined, text: `Only this page (${path})` }),
          section ? el("option", { value: section, selected: form.page === section || undefined, text: `Pages under ${section.slice(0, -1)}` }) : null,
        ]),
      ]),
      el("div", { class: "muted", text: found ? `Matches ${found.length} element${found.length === 1 ? "" : "s"} on this page (outlined).` : "That selector isn't valid." }),

      el("details", {}, [
        el("summary", { text: "Advanced: selector and text" }),
        el("label", {}, ["CSS selector", selectorInput]),
        el("label", {}, ["Only when its text is (optional)", el("input", { value: form.text, maxlength: 100, onchange: (e) => set({ text: e.target.value.trim() }) })]),
      ]),

      el("label", {}, ["Event name", nameInput]),
      state.result ? el("div", { class: state.result.ok ? "done" : "err", text: state.result.message }) : null,
      el("button", {
        class: "btn primary",
        text: state.sending ? "Creating…" : "Create event",
        disabled: state.sending || !opener || !found || undefined,
        onclick: () => {
          const name = nameInput.value.trim();
          if (!/^[\w.\-: ]{1,100}$/.test(name)) {
            nameInput.classList.add("invalid");
            state.result = { ok: false, message: "Use letters, numbers, spaces, _ - . or : in the name." };
            draw();
            return;
          }
          state.sending = true;
          state.result = null;
          send("picked", { name, selector: form.selector, text: form.text, page: form.page, trigger: form.trigger });
          draw();
        },
      }),
    ]);
  }

  function draw() {
    const head = el("div", { class: "head" }, [
      el("div", { class: "row" }, [
        el("span", { class: "title", text: "Track an element" }),
        el("button", { class: "icon", text: state.left ? "⇥" : "⇤", title: "Move this panel to the other side", onclick: () => { state.left = !state.left; panel.classList.toggle("left", state.left); } }),
      ]),
      el("div", { class: "row" }, [
        el("div", { class: "seg" }, [
          el("button", { class: state.mode === "pick" ? "on" : "", text: "Pick", onclick: () => { state.mode = "pick"; draw(); } }),
          el("button", { class: state.mode === "browse" ? "on" : "", text: "Browse", onclick: () => { state.mode = "browse"; hoverBox.hidden = true; draw(); } }),
        ]),
        el("span", { class: opener ? "ok" : "bad", text: opener ? "Linked to the dashboard" : "Not linked to the dashboard" }),
      ]),
    ]);

    let body;
    if (state.selected && state.form) {
      body = selectedSection(state.selected);
    } else {
      body = el("div", { class: "body" }, [
        !opener ? el("div", { class: "warn", text: "This tab wasn't opened from your dashboard, so nothing can be saved. Open the picker again from the Events page." }) : null,
        state.result ? el("div", { class: state.result.ok ? "done" : "err", text: state.result.message }) : null,
        el("div", { class: "muted", text: state.mode === "browse"
          ? "Browse mode: links and buttons work as normal, so you can go to another page. Switch back to Pick to choose an element."
          : "Click the element to track: a button, link, form, field or section. Then choose when it counts." }),
      ]);
    }
    if (state.created.length) {
      body.append(el("div", { class: "h", text: `Created here (${state.created.length})` }), el("ul", {}, state.created.map((name) => el("li", { text: name }))));
    }

    const foot = el("div", { class: "head" }, [
      el("div", { class: "row" }, [
        el("span", { class: "muted", text: "Events are saved in your dashboard." }),
        el("button", { class: "btn primary", text: "Done", onclick: () => { send("done"); finish(); } }),
      ]),
    ]);
    panel.replaceChildren(head, body, foot);
  }

  function finish() {
    window.removeEventListener("message", onMessage);
    window.removeEventListener("mousemove", onMove, true);
    for (const type of BLOCKED) window.removeEventListener(type, block, true);
    window.removeEventListener("scroll", follow, true);
    window.removeEventListener("resize", follow);
    host.remove();
    onExit?.();
  }

  draw();
  return {
    // A single-page app moved to another page.
    pageChanged() {
      state.selected = null;
      state.form = null;
      draw();
      place();
    },
  };
}
