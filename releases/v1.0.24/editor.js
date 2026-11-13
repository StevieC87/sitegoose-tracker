// A/B test editor on the live site. Loaded by the tracker only when the
// dashboard opens the site with an editing link (?ab_edit=<token>.<variant>,
// checked with the collector). Click any element to change its text, link,
// image or style, hide it or move it; the page shows the variant as you go.
// Every change is sent to the dashboard window that opened this tab (only to
// its origin), which keeps and saves the test; nothing is saved from here.
// Site edits use it too (experiment.kind "edit"): one version to change, the
// edit, shown next to the original, with the words changed to match.
// The editor lives in a shadow root, so the site's CSS can't change it, and
// sets everything as text; "html" changes go through safeHtmlFragment.
// startEditor({ token, variant, dashboardOrigin, experiment, focus, onExit }) -> { pageChanged() }
// focus: a selector to start with selected (from a heatmap's "Fix" link).

const FONT = 'font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;';
const ATTRS = [["href", "Link"], ["src", "Image"], ["alt", "Image description"], ["class", "CSS classes"], ["title", "Tooltip"], ["placeholder", "Placeholder"]];
// The style list: [property, label, input, value that cancels the site's own].
// CSS can't delete a property the site's stylesheet sets, only override it,
// so "remove" sets the value that undoes it.
const STYLE_ROWS = [
  ["color", "Text colour", "color", "unset"],
  ["background-color", "Background", "color", "transparent"],
  ["font-size", "Text size", "text", "unset"],
  ["font-weight", "Boldness", "text", "unset"],
  ["padding", "Space inside", "text", "0"],
  ["margin", "Space outside", "text", "0"],
  ["border", "Border", "text", "none"],
  ["border-radius", "Rounded corners", "text", "0"],
  ["box-shadow", "Shadow", "text", "none"],
  ["width", "Width", "text", "auto"],
];
const REMOVE_VALUE = {
  ...Object.fromEntries(STYLE_ROWS.map(([prop, , , off]) => [prop, off])),
  "background-image": "none", background: "none", "text-decoration": "none", outline: "none", "text-shadow": "none",
  height: "auto", "max-width": "none", "min-width": "0", "max-height": "none", "min-height": "0", opacity: "1", gap: "0", transform: "none",
};
const STYLE_LABELS = Object.fromEntries(STYLE_ROWS.map(([prop, label]) => [prop, label]));
const parseDeclarations = (value) => new Map(String(value || "").split(";").map((d) => {
  const at = d.indexOf(":");
  return at > 0 ? [d.slice(0, at).trim().toLowerCase(), d.slice(at + 1).replace(/!important/i, "").trim()] : null;
}).filter((d) => d && d[1]));
const validStyle = (prop, value) => {
  try {
    return CSS.supports(prop, value);
  } catch {
    return false;
  }
};

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

// "html" changes: only these tags and attributes reach the page, rebuilt from
// an inert <template>. Keep in sync with track.js and visualEditorDom.js.
const SAFE_HTML_TAGS = new Set(["b", "strong", "i", "em", "u", "s", "small", "mark", "sup", "sub", "br", "span", "a", "code", "p", "ul", "ol", "li"]);
const DROPPED_HTML_TAGS = /^(script|style|template|iframe|object|embed|svg|math|noscript|textarea|select|title)$/;
const SAFE_HREF = /^(https?:\/\/|\/|#|mailto:|tel:|\?)/i;
function safeHtmlFragment(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  const out = document.createDocumentFragment();
  const copy = (from, to) => {
    for (const node of from.childNodes) {
      if (node.nodeType === 3) to.append(node.data);
      if (node.nodeType !== 1) continue;
      const tag = node.localName;
      if (!SAFE_HTML_TAGS.has(tag)) {
        if (!DROPPED_HTML_TAGS.test(tag)) copy(node, to);
        continue;
      }
      const clean = document.createElement(tag);
      for (const name of ["class", "title"]) if (node.hasAttribute(name)) clean.setAttribute(name, node.getAttribute(name));
      if (tag === "a") {
        const href = (node.getAttribute("href") || "").trim();
        if (SAFE_HREF.test(href)) clean.setAttribute("href", href);
        if (node.getAttribute("target") === "_blank") {
          clean.setAttribute("target", "_blank");
          clean.setAttribute("rel", "noopener noreferrer");
        }
      }
      copy(node, clean);
      to.append(clean);
    }
  };
  copy(template.content, out);
  return out;
}

// rgb()/rgba() as #rrggbb for <input type="color">; null when transparent.
function toHex(value) {
  const m = String(value).match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?/i);
  if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) return null;
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
}
// The colour the visitor sees: a transparent background shows its parent's.
function seenColor(node, prop) {
  if (prop === "color") return toHex(getComputedStyle(node).color) || "#000000";
  for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
    const hex = toHex(getComputedStyle(n).backgroundColor);
    if (hex) return hex;
  }
  return "#ffffff";
}

//. Selectors (as the dashboard's visual editor makes them) -------

const isStableId = (id) => /^[A-Za-z][\w-]{0,63}$/.test(id) && !/\d{4,}/.test(id);
export const isStableClass = (c) => /^[A-Za-z_-][\w-]{0,40}$/.test(c)
  && !/^(css|sc|jsx|emotion|styled|svelte)-/.test(c)
  && !/__[\w-]{5,}$/.test(c)
  && !(/\d/.test(c) && /[0-9a-f]{5,}/i.test(c) && !/-/.test(c));
const TEST_ATTRS = ["data-testid", "data-test", "data-cy", "data-qa", "data-analytics-event", "name", "aria-label"];

const stableClasses = (node, max) => [...node.classList].filter(isStableClass).slice(0, max).map((c) => `.${CSS.escape(c)}`).join("");

function nthOfType(node) {
  let index = 1;
  let same = false;
  for (let sib = node.parentElement?.firstElementChild; sib; sib = sib.nextElementSibling) {
    if (sib === node) continue;
    if (sib.tagName === node.tagName) {
      same = true;
      if (sib.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) index++;
    }
  }
  return same ? `:nth-of-type(${index})` : "";
}

// Also used by picker.js.
export function selectorFor(target) {
  const unique = (selector) => {
    try {
      const found = document.querySelectorAll(selector);
      return found.length === 1 && found[0] === target;
    } catch {
      return false;
    }
  };
  const tag = target.tagName.toLowerCase();
  if (target.id && isStableId(target.id) && unique(`#${CSS.escape(target.id)}`)) return `#${CSS.escape(target.id)}`;
  for (const attr of TEST_ATTRS) {
    const value = target.getAttribute(attr);
    if (!value || value.length > 80) continue;
    const selector = `${tag}[${attr}="${CSS.escape(value)}"]`;
    if (unique(selector)) return selector;
  }
  const classes = stableClasses(target, 3);
  if (classes && unique(`${tag}${classes}`)) return `${tag}${classes}`;
  const parts = [];
  for (let node = target; node && node.nodeType === 1 && parts.length < 30; node = node.parentElement) {
    const name = node.tagName.toLowerCase();
    if (name === "body" || name === "html") {
      parts.unshift("body");
      break;
    }
    if (node !== target && node.id && isStableId(node.id)) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    parts.unshift(`${name}${stableClasses(node, 2)}${nthOfType(node)}`);
    if (unique(parts.join(" > "))) break;
  }
  return parts.join(" > ");
}

//. Applying and undoing changes ---------------------------------

// What each changed element looked like before, so the page can go back to
// the original and the variant can be applied again after every edit.
function createPage(host) {
  let originals = new Map();
  let moves = [];
  let style = null;

  const remember = (node) => {
    if (!originals.has(node)) originals.set(node, { children: null, attrs: new Map(), style: node.getAttribute("style") });
    return originals.get(node);
  };
  const query = (selector) => {
    try {
      return [...document.querySelectorAll(selector)].filter((node) => node !== host && !host.contains(node));
    } catch {
      return [];
    }
  };

  function applyChange(change) {
    const nodes = query(change.selector);
    if (!nodes.length) return false;
    if (change.action === "move") {
      const target = change.target ? query(change.target)[0] : null;
      const node = nodes[0];
      if (!target) return false;
      if (target === node || node.contains(target)) return true;
      moves.push({ node, parent: node.parentNode, next: node.nextSibling });
      target.insertAdjacentElement(change.position === "before" ? "beforebegin" : "afterend", node);
      return true;
    }
    for (const node of nodes) {
      const saved = remember(node);
      if (change.action === "text" || change.action === "html") {
        if (!saved.children) saved.children = [...node.childNodes];
        if (change.action === "html") node.replaceChildren(safeHtmlFragment(change.value));
        else node.textContent = change.value || "";
      } else if (change.action === "attr" && change.attr) {
        if (!saved.attrs.has(change.attr)) saved.attrs.set(change.attr, node.getAttribute(change.attr));
        node.setAttribute(change.attr, change.value || "");
      } else if (change.action === "classes") {
        if (!saved.attrs.has("class")) saved.attrs.set("class", node.getAttribute("class"));
        for (const token of String(change.value || "").split(/\s+/)) {
          const name = token.slice(1);
          if (!name) continue;
          try {
            if (token[0] === "+") node.classList.add(name);
            else if (token[0] === "-") node.classList.remove(name);
          } catch { /* not a valid class name */ }
        }
      } else if (change.action === "hide") {
        node.style.setProperty("display", "none", "important");
      } else if (change.action === "style") {
        for (const declaration of String(change.value || "").split(";")) {
          const at = declaration.indexOf(":");
          if (at < 1) continue;
          node.style.setProperty(declaration.slice(0, at).trim().toLowerCase(), declaration.slice(at + 1).replace(/!important/i, "").trim(), "important");
        }
      }
    }
    return true;
  }

  function revert() {
    for (const { node, parent, next } of moves.reverse()) {
      if (parent) parent.insertBefore(node, next && next.parentNode === parent ? next : null);
    }
    moves = [];
    for (const [node, saved] of originals) {
      if (saved.children) node.replaceChildren(...saved.children);
      for (const [name, value] of saved.attrs) {
        if (value === null) node.removeAttribute(name);
        else node.setAttribute(name, value);
      }
      if (saved.style === null) node.removeAttribute("style");
      else node.setAttribute("style", saved.style);
    }
    originals = new Map();
    style?.remove();
    style = null;
  }

  // Shows the variant (or the original); returns the selectors that matched nothing.
  function show(variant) {
    revert();
    if (!variant) return [];
    const missing = (variant.changes || []).filter((c) => c.selector && !applyChange(c)).map((c) => c.selector);
    if (variant.css) {
      style = el("style", { "data-analytics-editor": "", text: variant.css });
      document.head.append(style);
    }
    return missing;
  }

  return { show, revert, query };
}

//. The editor ---------------------------------------------------

const CSS_TEXT = `
:host { all: initial; }
* { box-sizing: border-box; }
.box { position: fixed; pointer-events: none; z-index: 2147483646; border-radius: 2px; }
.hover { outline: 2px dashed #2563eb; background: rgba(37, 99, 235, .08); }
.selected { outline: 3px solid #2563eb; background: rgba(37, 99, 235, .1); }
.tag { position: absolute; top: -22px; left: -3px; padding: 2px 6px; border-radius: 4px; background: #2563eb; color: #fff; ${FONT} font-size: 11px; white-space: nowrap; }
.panel {
  position: fixed; top: 12px; right: 12px; bottom: 12px; z-index: 2147483647; width: 340px; display: flex; flex-direction: column;
  border-radius: 12px; background: #fff; color: #0f172a; box-shadow: 0 10px 40px rgba(0, 0, 0, .25); ${FONT} overflow: hidden;
}
.panel.left { right: auto; left: 12px; }
.head { padding: 12px 14px; background: #0f172a; color: #fff; display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.title { font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.body { flex: 1; overflow: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 12px; }
.seg { display: inline-flex; padding: 2px; border-radius: 7px; background: rgba(255, 255, 255, .12); }
.seg button { padding: 4px 10px; border: 0; border-radius: 5px; background: none; color: #cbd5e1; font: inherit; font-weight: 600; cursor: pointer; }
.seg button.on { background: #fff; color: #0f172a; }
button.btn { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 7px; background: #fff; color: #0f172a; font: inherit; font-weight: 600; cursor: pointer; }
button.btn:hover { border-color: #2563eb; color: #2563eb; }
button.primary { border-color: #2563eb; background: #2563eb; color: #fff; }
button.primary:hover { background: #1d4ed8; color: #fff; }
button.link { padding: 0; border: 0; background: none; color: #2563eb; font: inherit; font-weight: 600; cursor: pointer; }
button.danger { color: #dc2626; }
.icon { padding: 2px 6px; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; opacity: .8; }
select, input, textarea { width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 7px; background: #fff; color: #0f172a; font: inherit; }
.head select { width: auto; flex: 1; min-width: 0; }
textarea { resize: vertical; min-height: 56px; }
input[type=color] { width: 44px; height: 30px; padding: 2px; flex: none; }
label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 12px; color: #334155; }
label.check { flex-direction: row; align-items: center; gap: 8px; }
label.check input { width: auto; }
.section { display: flex; flex-direction: column; gap: 8px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
.section:first-child { padding-top: 0; border-top: 0; }
.h { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
.muted { color: #64748b; font-size: 12px; }
.warn { padding: 8px 10px; border-radius: 7px; background: #fef3c7; color: #78350f; font-size: 12px; }
.ok { color: #86efac; font-size: 12px; }
.bad { color: #fca5a5; font-size: 12px; }
.styles { display: flex; flex-direction: column; gap: 6px; }
.style-row { display: grid; grid-template-columns: 92px 1fr 22px 22px; gap: 4px; align-items: center; }
.style-row > span { font-size: 12px; font-weight: 600; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.style-row.changed > span { color: #2563eb; }
.style-row .icon { padding: 2px 4px; }
input.invalid { border-color: #dc2626; }
.add-style { display: grid; grid-template-columns: 1fr 1fr auto; gap: 4px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { display: inline-flex; align-items: center; gap: 2px; padding: 2px 2px 2px 8px; border-radius: 999px; background: #f1f5f9; font: 12px/1.4 ui-monospace, monospace; }
.chip.added { background: #dcfce7; }
.chip.removed { text-decoration: line-through; opacity: .6; }
details summary { cursor: pointer; font-weight: 600; font-size: 12px; color: #334155; }
details[open] summary { margin-bottom: 8px; }
code { display: block; padding: 6px 8px; border-radius: 6px; background: #f1f5f9; font: 12px/1.4 ui-monospace, monospace; overflow-wrap: anywhere; }
.quick { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.inline { display: flex; gap: 6px; align-items: center; }
.changes { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.changes li { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 7px; background: #f8fafc; }
.changes li.missing { background: #fef2f2; }
.changes span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.picking { padding: 8px 10px; border-radius: 7px; background: #dbeafe; color: #1e3a8a; font-weight: 600; }
`;

const ACTION_LABELS = { text: "Text", html: "Text", classes: "Classes", attr: "Attribute", style: "Style", hide: "Hidden", move: "Moved" };

export function startEditor({ token, variant: startVariant, dashboardOrigin, experiment, focus, onExit }) {
  const host = el("div", { "data-noanalytics": "", "data-analytics-editor": "" });
  const root = host.attachShadow({ mode: "open" });
  root.append(el("style", { text: CSS_TEXT }));
  document.documentElement.append(host);
  const page = createPage(host);

  const state = {
    variants: experiment.variants.map((v) => ({ ...v, changes: [...(v.changes || [])] })),
    current: experiment.variants.some((v) => v.id === startVariant) && startVariant !== experiment.variants[0]?.id
      ? startVariant : experiment.variants[1]?.id,
    mode: "edit", // edit | browse
    original: false,
    selected: null, // the element
    picking: "", // "before" | "after": waiting for the element to move next to
    missing: [],
    connected: false,
    left: false,
  };
  const variant = () => state.variants.find((v) => v.id === state.current);
  const isEdit = experiment.kind === "edit";
  const thing = isEdit ? "edit" : "test";

  const hoverBox = el("div", { class: "box hover", hidden: true });
  const selectedBox = el("div", { class: "box selected", hidden: true }, [el("span", { class: "tag" })]);
  const panel = el("div", { class: "panel" });
  root.append(hoverBox, selectedBox, panel);

  //. Talking to the dashboard
  const opener = window.opener;
  const send = (event, extra = {}) => {
    try {
      opener?.postMessage({ source: "analytics-ab-editor", event, token, experiment: experiment.id, ...extra }, dashboardOrigin);
    } catch { /* the dashboard tab was closed */ }
  };
  const sync = () => send("changes", { variant: state.current, changes: variant()?.changes || [], css: variant()?.css || "" });
  window.addEventListener("message", (e) => {
    if (e.origin !== dashboardOrigin || e.source !== opener || e.data?.source !== "analytics-ab-dashboard" || e.data.token !== token) return;
    if (e.data.event === "init" && Array.isArray(e.data.variants)) {
      // The dashboard's copy, with any changes not saved yet.
      state.variants = e.data.variants.map((v) => ({ id: v.id, name: v.name, changes: [...(v.changes || [])], css: v.css || "" }));
      if (!variant()) state.current = state.variants[1]?.id;
      state.connected = true;
      render();
    }
    if (e.data.event === "saved") {
      state.saved = Date.now();
      draw();
    }
  });
  send("ready");

  //. Showing the page
  function render() {
    state.missing = page.show(state.original ? null : variant());
    if (state.selected && !state.selected.isConnected) state.selected = null;
    draw();
    place();
  }

  function place() {
    const at = (box, node) => {
      if (!node || !node.isConnected) {
        box.hidden = true;
        return;
      }
      const r = node.getBoundingClientRect();
      Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      box.hidden = false;
    };
    at(selectedBox, state.selected);
    selectedBox.firstChild.textContent = state.selected ? state.selected.tagName.toLowerCase() : "";
  }

  //. Editing changes
  const changesOf = () => variant().changes;
  const find = (selector, action, attr) => changesOf().find((c) => c.selector === selector && c.action === action && (action !== "attr" || c.attr === attr));
  function upsert(change, remove = false) {
    const list = changesOf();
    const index = list.findIndex((c) => c.selector === change.selector && c.action === change.action && (change.action !== "attr" || c.attr === change.attr));
    if (remove) {
      if (index >= 0) list.splice(index, 1);
    } else if (index >= 0) list[index] = change;
    else if (list.length < 30) list.push(change);
    sync();
    state.original = false;
    state.missing = page.show(variant());
    place();
  }

  // "Every element with this class" styles: one rule per class in the
  // variant's CSS, which the person can also see and edit as text.
  const ruleFor = (selector) => new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}\\n?`);
  const readRule = (selector) => (variant()?.css || "").match(ruleFor(selector))?.[2] || "";
  function writeRule(selector, declarations) {
    const current = variant();
    let css = (current.css || "").replace(ruleFor(selector), "$1");
    if (declarations) css = `${css.trimEnd()}${css.trim() ? "\n" : ""}${selector} { ${declarations} }\n`;
    current.css = css;
    sync();
    state.original = false;
    state.missing = page.show(current);
    place();
  }
  let props = null;
  const propertyNames = () => (props ||= [...new Set([...getComputedStyle(document.documentElement), "background", "border", "margin", "padding", "font", "gap", "outline", "text-decoration"])].filter((p) => !p.startsWith("-")).sort());

  // Selectors are made on the original page: a moved element must still be
  // found where it really is.
  function originalSelector(node) {
    page.revert();
    const selector = selectorFor(node);
    state.missing = page.show(state.original ? null : variant());
    return selector;
  }

  //. Picking elements on the page
  const ours = (node) => node === host || host.contains(node);
  const pickable = (node) => node && node.nodeType === 1 && !ours(node) && !["HTML", "BODY"].includes(node.tagName);
  const onMove = (e) => {
    if (state.mode !== "edit") return;
    const node = e.target;
    if (!pickable(node)) {
      hoverBox.hidden = true;
      return;
    }
    const r = node.getBoundingClientRect();
    Object.assign(hoverBox.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    hoverBox.hidden = false;
  };
  const block = (e) => {
    if (state.mode !== "edit" || ours(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type !== "click") return;
    if (!pickable(e.target)) return;
    if (state.picking && state.selected) {
      const target = originalSelector(e.target);
      const selector = originalSelector(state.selected);
      if (target !== selector) upsert({ selector, action: "move", position: state.picking, target });
      state.picking = "";
      draw();
      return;
    }
    state.selected = e.target;
    draw();
    place();
  };
  window.addEventListener("mousemove", onMove, true);
  for (const type of ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "submit", "dblclick"]) window.addEventListener(type, block, true);
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
    const selector = originalSelector(node);
    const tag = node.tagName.toLowerCase();
    const text = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
    const textChange = find(selector, "text") || find(selector, "html");
    const styleChange = find(selector, "style");
    const hidden = Boolean(find(selector, "hide"));

    const section = el("div", { class: "section" }, [
      el("div", { class: "row" }, [
        el("span", { class: "h", text: `Selected: <${tag}>` }),
        el("button", { class: "link", text: "Select parent", onclick: () => {
          const parent = node.parentElement;
          if (pickable(parent)) {
            state.selected = parent;
            draw();
            place();
          }
        } }),
        el("button", { class: "icon", text: "✕", title: "Clear selection", onclick: () => { state.selected = null; draw(); place(); } }),
      ]),
      el("code", { text: selector }),
    ]);

    // Text: off by default so live text (counts, names) stays live; ticking it fixes the text.
    section.append(el("label", { class: "check" }, [
      el("input", { type: "checkbox", checked: Boolean(textChange), onchange: (e) => {
        upsert(textChange || { selector, action: "text", value: text.slice(0, 2000) }, !e.target.checked);
        draw();
      } }),
      "Change the text",
    ]));
    if (textChange) {
      section.append(el("textarea", { value: textChange.value, oninput: (e) => upsert({ ...textChange, value: e.target.value }) }));
      // Formatting: the change becomes "html" (bold, italics, links, line breaks; nothing else is kept).
      section.append(el("label", { class: "check" }, [
        el("input", { type: "checkbox", checked: textChange.action === "html", onchange: (e) => {
          upsert(textChange, true);
          upsert({ selector, action: e.target.checked ? "html" : "text", value: textChange.value });
          draw();
        } }),
        "Allow formatting: <b>, <i>, <a href>, <br>",
      ]));
      if (node.children.length) section.append(el("div", { class: "muted", text: "This element has others inside; changing its text replaces them (icons too). Select a smaller element to keep them." }));
    }

    // Link and image
    for (const [attr, label] of ATTRS) {
      const relevant = (attr === "href" && node.closest("a") === node) || (["src", "alt"].includes(attr) && tag === "img")
        || (attr === "placeholder" && "placeholder" in node) || attr === "class" || attr === "title";
      if (!relevant) continue;
      if ((attr === "class" || attr === "title") && !find(selector, "attr", attr)) continue;
      const change = find(selector, "attr", attr);
      section.append(el("label", {}, [
        label,
        el("input", {
          value: change ? change.value : node.getAttribute(attr) || "",
          placeholder: attr === "href" ? "/pricing or https://…" : "",
          onchange: (e) => {
            const value = e.target.value.trim();
            upsert({ selector, action: "attr", attr, value }, attr === "src" && !value);
            // srcset and <picture> sources win over src: empty them so the new image shows.
            if (attr === "src") {
              const sources = [...(node.parentElement?.tagName === "PICTURE" ? node.parentElement.querySelectorAll("source[srcset]") : [])];
              for (const [n, s] of [[node, selector], ...sources.map((source) => [source, originalSelector(source)])]) {
                if (n.hasAttribute("srcset")) upsert({ selector: s, action: "attr", attr: "srcset", value: "" }, !value);
              }
            }
          },
        }),
      ]));
    }
    // Images are often under a wrapper or overlay that takes the click.
    const innerImage = tag === "img" ? null : node.querySelector("img");
    if (innerImage && pickable(innerImage)) {
      section.append(el("button", { class: "link", text: "Select the image inside", onclick: () => { state.selected = innerImage; draw(); place(); } }));
    }

    // Style: this element's inline style, or a rule in the variant's CSS for
    // every element with one of its classes.
    const classOptions = [...node.classList].filter(isStableClass).map((c) => `.${CSS.escape(c)}`);
    const scope = state.scopeNode === node && classOptions.includes(state.styleScope) ? state.styleScope : "";
    const styles = scope ? parseDeclarations(readRule(scope)) : parseDeclarations(styleChange?.value);
    const saveStyles = () => {
      const value = [...styles].map(([k, v]) => (scope ? `${k}: ${v} !important` : `${k}: ${v}`)).join("; ");
      if (scope) writeRule(scope, value);
      else upsert({ selector, action: "style", value }, !value);
    };
    const seen = getComputedStyle(node);
    const styleRow = (prop, label, type) => {
      const mine = styles.get(prop);
      const off = REMOVE_VALUE[prop] || "unset";
      const input = type === "color"
        ? el("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(mine || "") ? mine : seenColor(node, prop), oninput: (e) => { styles.set(prop, e.target.value); saveStyles(); } })
        : el("input", {
          value: mine || "",
          placeholder: seen.getPropertyValue(prop).trim(),
          oninput: (e) => {
            const value = e.target.value.trim();
            const ok = !value || validStyle(prop, value);
            e.target.classList.toggle("invalid", !ok);
            if (!ok) return;
            if (value) styles.set(prop, value);
            else styles.delete(prop);
            saveStyles();
          },
        });
      return el("div", { class: `style-row${mine !== undefined ? " changed" : ""}` }, [
        el("span", { text: label, title: prop }),
        input,
        mine !== undefined ? el("button", { class: "icon", text: "↺", title: "Undo my change", onclick: () => { styles.delete(prop); saveStyles(); draw(); } }) : el("span"),
        mine !== off ? el("button", { class: "icon", text: "✕", title: "Remove this style", onclick: () => { styles.set(prop, off); saveStyles(); draw(); } }) : el("span"),
      ]);
    };
    const list = el("div", { class: "styles" }, [
      ...STYLE_ROWS.map(([prop, label, type]) => styleRow(prop, label, type)),
      ...(seen.backgroundImage !== "none" && !styles.has("background-image") ? [styleRow("background-image", "Background image", "text")] : []),
      ...[...styles.keys()].filter((prop) => !STYLE_ROWS.some(([p]) => p === prop)).map((prop) => styleRow(prop, STYLE_LABELS[prop] || prop, "text")),
    ]);
    // Any other property; the browser says whether the value works.
    const newProp = el("input", { placeholder: "property", list: "analytics-editor-props" });
    const newValue = el("input", { placeholder: "value" });
    const addStyle = () => {
      const prop = newProp.value.trim().toLowerCase();
      const value = newValue.value.trim();
      const ok = prop && value && validStyle(prop, value);
      newValue.classList.toggle("invalid", !ok);
      if (!ok) return;
      styles.set(prop, value);
      saveStyles();
      draw();
    };
    newValue.addEventListener("keydown", (e) => { if (e.key === "Enter") addStyle(); });
    section.append(
      el("div", { class: "h", text: "Style" }),
      classOptions.length ? el("label", {}, [
        "Apply to",
        el("select", { onchange: (e) => { state.scopeNode = node; state.styleScope = e.target.value; draw(); } }, [
          el("option", { value: "", text: "Only this element" }),
          ...classOptions.map((c) => el("option", { value: c, selected: c === scope || undefined, text: `Every ${c.replace(/\\/g, "")} (${page.query(c).length} on this page)` })),
        ]),
      ]) : null,
      list,
      el("div", { class: "add-style" }, [newProp, newValue, el("button", { class: "btn", text: "Add", onclick: addStyle })]),
      el("datalist", { id: "analytics-editor-props" }, propertyNames().map((name) => el("option", { value: name }))),
      scope ? el("div", { class: "muted", text: "These styles go into the extra CSS below, so other pages' elements with this class change too." }) : null,
    );

    // Advanced: add or remove the element's own classes, leaving the rest
    // (the site's open/active classes) alone.
    const classChange = find(selector, "classes");
    const tokens = new Map(String(classChange?.value || "").split(/\s+/).filter((t) => t.length > 1).map((t) => [t.slice(1), t[0]]));
    const saveClasses = () => {
      const value = [...tokens].map(([name, sign]) => `${sign}${name}`).join(" ");
      upsert({ selector, action: "classes", value }, !value);
      draw();
    };
    const chip = (name, kind) => el("span", { class: `chip ${kind}`, title: isStableClass(name) ? "" : "Looks generated by a build tool: it may change when the site is rebuilt" }, [
      `${kind === "added" ? "+" : ""}${name}${isStableClass(name) ? "" : " ⚠"}`,
      kind === "removed"
        ? el("button", { class: "icon", text: "↺", title: "Put it back", onclick: () => { tokens.delete(name); saveClasses(); } })
        : el("button", { class: "icon", text: "✕", title: "Remove this class", onclick: () => { if (kind === "added") tokens.delete(name); else tokens.set(name, "-"); saveClasses(); } }),
    ]);
    const newClass = el("input", { placeholder: "Add a class, then Enter" });
    newClass.addEventListener("keydown", (e) => {
      const name = newClass.value.trim();
      if (e.key !== "Enter" || !/^[^\s"'<>{};]{1,100}$/.test(name)) return;
      if (tokens.get(name) === "-") tokens.delete(name);
      else tokens.set(name, "+");
      saveClasses();
    });
    section.append(el("details", { open: state.advanced || undefined, ontoggle: (e) => { state.advanced = e.target.open; } }, [
      el("summary", { text: "Advanced: CSS classes" }),
      el("div", { class: "chips" }, [
        ...[...node.classList].filter((c) => tokens.get(c) !== "+").map((c) => chip(c, "")),
        ...[...tokens].filter(([, sign]) => sign === "+").map(([name]) => chip(name, "added")),
        ...[...tokens].filter(([, sign]) => sign === "-").map(([name]) => chip(name, "removed")),
      ]),
      newClass,
    ]));

    // Hide and move
    section.append(
      el("label", { class: "check" }, [
        el("input", { type: "checkbox", checked: hidden || undefined, onchange: (e) => { upsert({ selector, action: "hide", value: "" }, !e.target.checked); draw(); } }),
        "Hide this element",
      ]),
      state.picking
        ? el("div", { class: "picking" }, [`Now click the element to put it ${state.picking}. `, el("button", { class: "link", text: "Cancel", onclick: () => { state.picking = ""; draw(); } })])
        : el("div", { class: "row" }, [
          el("button", { class: "btn", text: "Move before…", onclick: () => { state.picking = "before"; draw(); } }),
          el("button", { class: "btn", text: "Move after…", onclick: () => { state.picking = "after"; draw(); } }),
        ]),
    );
    return section;
  }

  function draw() {
    const current = variant();
    const head = el("div", { class: "head" }, [
      el("div", { class: "row" }, [
        el("span", { class: "title", text: `${isEdit ? "Site edit" : "A/B editor"} · ${experiment.name}` }),
        el("button", { class: "icon", text: state.left ? "⇥" : "⇤", title: "Move this panel to the other side", onclick: () => { state.left = !state.left; panel.classList.toggle("left", state.left); } }),
      ]),
      el("div", { class: "row" }, [
        isEdit ? null : el("select", { onchange: (e) => { state.current = e.target.value; state.selected = null; render(); } },
          state.variants.slice(1).map((v) => el("option", { value: v.id, selected: v.id === state.current || undefined, text: v.name }))),
        el("div", { class: "seg" }, [
          el("button", { class: state.original ? "on" : "", text: "Original", onclick: () => { state.original = true; render(); } }),
          el("button", { class: state.original ? "" : "on", text: current?.name || "Variant", onclick: () => { state.original = false; render(); } }),
        ]),
      ]),
      el("div", { class: "row" }, [
        el("div", { class: "seg" }, [
          el("button", { class: state.mode === "edit" ? "on" : "", text: "Select", onclick: () => { state.mode = "edit"; draw(); } }),
          el("button", { class: state.mode === "browse" ? "on" : "", text: "Browse", onclick: () => { state.mode = "browse"; hoverBox.hidden = true; draw(); } }),
        ]),
        el("span", {
          class: opener ? "ok" : "bad",
          text: !opener ? "Not linked to the dashboard" : state.saved ? "Saved in the dashboard" : "Linked to the dashboard",
        }),
      ]),
    ]);

    const body = el("div", { class: "body" });
    if (!opener) body.append(el("div", { class: "warn", text: `This tab wasn't opened from your dashboard, so changes here can't be saved. Open the editor again from the ${thing} in your dashboard.` }));
    if (state.mode === "browse") body.append(el("div", { class: "muted", text: "Browse mode: links and buttons work as normal, so you can go to another page. Switch back to Select to edit." }));
    if (state.original) body.append(el("div", { class: "muted", text: isEdit ? "Showing the page without your edit. Switch back above to keep editing." : "Showing the original page. Pick the variant above to edit it." }));
    if (state.selected && !state.original) body.append(selectedSection(state.selected));
    else if (!state.original && state.mode === "edit") body.append(el("div", { class: "muted", text: "Click anything on the page to change it." }));

    const changes = current?.changes || [];
    const list = el("ul", { class: "changes" }, changes.map((c, i) => el("li", { class: state.missing.includes(c.selector) ? "missing" : "" }, [
      el("span", {
        title: c.selector,
        text: `${ACTION_LABELS[c.action] || c.action}${c.action === "attr" ? ` (${c.attr})` : ""} · ${c.selector}`,
        onclick: () => {
          const node = page.query(c.selector)[0];
          if (node) {
            state.selected = node;
            node.scrollIntoView({ block: "center", behavior: "smooth" });
            draw();
            place();
          }
        },
      }),
      el("button", { class: "icon", text: "✕", title: "Remove this change", onclick: () => { changes.splice(i, 1); sync(); render(); } }),
    ])));
    body.append(el("div", { class: "section" }, [
      el("span", { class: "h", text: `Changes in ${current?.name || "this variant"} (${changes.length})` }),
      changes.length ? list : el("div", { class: "muted", text: "None yet." }),
      state.missing.length ? el("div", { class: "muted", text: `Red ones aren't on this page (they may be on another of the ${thing}'s pages).` }) : null,
      el("label", {}, [
        isEdit ? "Extra CSS (optional)" : "Extra CSS for this variant (optional)",
        el("textarea", {
          value: current?.css || "",
          placeholder: ".btn-primary { background: #16a34a; }",
          onchange: (e) => { current.css = e.target.value; sync(); render(); },
        }),
      ]),
    ]));

    const foot = el("div", { class: "head" }, [
      el("div", { class: "muted", text: "Changes go to your dashboard tab as you make them. Save there to keep them." }),
      el("div", { class: "row" }, [
        el("button", { class: "btn primary", text: "Done", onclick: () => { send("done"); finish(); } }),
      ]),
    ]);
    panel.replaceChildren(head, body, foot);
  }

  function finish() {
    window.removeEventListener("mousemove", onMove, true);
    for (const type of ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "submit", "dblclick"]) window.removeEventListener(type, block, true);
    window.removeEventListener("scroll", follow, true);
    window.removeEventListener("resize", follow);
    page.revert();
    host.remove();
    onExit?.();
  }

  render();
  // The element the editor was opened for; frameworks may render it a little later.
  if (focus) {
    let tries = 0;
    const pick = () => {
      const node = page.query(focus)[0];
      if (node) {
        state.selected = node;
        node.scrollIntoView({ block: "center" });
        draw();
        place();
      } else if (++tries < 10) {
        setTimeout(pick, 300);
      }
    };
    pick();
  }
  return {
    // A single-page app moved to another page: show the variant there too.
    pageChanged() {
      state.selected = null;
      state.picking = "";
      render();
    },
  };
}
