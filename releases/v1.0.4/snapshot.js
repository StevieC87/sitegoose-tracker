// Heatmap page snapshot. Loaded by the tracker only when the collector asks
// for one (one visitor per page, device and day), so the tracker stays small.
//
// Produces static HTML of the page as the visitor sees it: scripts removed,
// URLs made absolute, readable stylesheets copied in, and form values and
// private text masked. Every element gets a data-nid so heatmap clicks (and
// later session replays) can refer to it. The dashboard renders the result
// in a sandboxed iframe with scripts disabled.

const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "source", "track", "wbr",
]);
// Dropped with their contents.
const SKIP = new Set(["script", "noscript", "template", "base"]);
// Kept as empty boxes so layout and :nth-of-type positions stay the same.
const EMPTY = new Set(["iframe", "video", "audio", "canvas", "object", "embed"]);
const URL_ATTRS = new Set(["src", "href", "poster", "action", "xlink:href", "background"]);
// Text a site may show that is not page copy: masked even in balanced mode.
const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi;
const LONG_NUMBER = /\d[\d -]{6,}\d/g;
const MAX_ELEMENTS = 50000;
const MAX_LENGTH = 15 * 1024 * 1024;

const mask = (text) => text.replace(/\S/g, "•");
const escapeText = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function absolute(value, base) {
  const trimmed = value.trim();
  // Fragment links (SVG <use href="#icon">) must stay local to the snapshot.
  if (!trimmed || trimmed.startsWith("#") || /^(data|blob|about):/i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed, base);
    return /^(https?|mailto|tel):$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

const absoluteSrcset = (value, base) =>
  value
    .split(/,\s+/)
    .map((candidate) => {
      const [url, ...descriptor] = candidate.trim().split(/\s+/);
      return [absolute(url, base), ...descriptor].join(" ");
    })
    .join(", ");

// url(...) inside CSS resolves against the stylesheet, not the page.
const absoluteCss = (css, base) =>
  css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, url) =>
    `url("${absolute(url, base).replace(/"/g, "%22")}")`);

// Rules of a stylesheet, or null when the browser does not let us read them
// (cross-origin without CORS); those stay as <link> tags.
function sheetCss(sheet, depth = 0) {
  let rules;
  try {
    rules = sheet.cssRules;
  } catch {
    return null;
  }
  if (!rules) return null;
  const base = sheet.href || document.baseURI;
  let css = "";
  for (const rule of rules) {
    // Inline @import'ed sheets too, when readable.
    if (rule.type === CSSRule.IMPORT_RULE && rule.styleSheet && depth < 5) {
      const imported = sheetCss(rule.styleSheet, depth + 1);
      if (imported !== null) {
        css += rule.media?.length ? `@media ${rule.media.mediaText}{${imported}}` : imported;
        continue;
      }
    }
    css += absoluteCss(rule.cssText, base);
  }
  return css;
}

const isMaskedElement = (el) => el.hasAttribute("data-noanalytics") || el.isContentEditable === true;

// Serializes the page, or parts of it, to the static HTML described above.
// With `ids` (a WeakMap), each live element keeps its data-nid across calls,
// so the session recorder can refer to elements it serialized earlier.
export function createSerializer({ masking = "balanced", ids = null } = {}) {
  const strict = masking === "strict";
  const base = document.baseURI;
  let nextId = 0;
  let length = 0;
  let elements = 0;
  let out = [];
  const push = (text) => {
    length += text.length;
    out.push(text);
  };

  function idOf(el) {
    if (!ids) return ++nextId;
    let id = ids.get(el);
    if (!id) {
      id = ++nextId;
      ids.set(el, id);
    }
    return id;
  }

  function maskText(text, masked) {
    if (masked || strict) return mask(text);
    return text.replace(EMAIL, mask).replace(LONG_NUMBER, mask);
  }

  // The stored value of one attribute, or null when it is left out.
  function attributeValue(el, tag, name, value, masked) {
    const lower = name.toLowerCase();
    if (lower.startsWith("on") || lower === "data-nid" || lower === "srcdoc" ||
        lower === "integrity" || lower === "nonce" || lower === "autofocus") return null;
    if (URL_ATTRS.has(lower)) {
      if (EMPTY.has(tag) && lower !== "poster") return null;
      return absolute(value, base) || null;
    }
    if (lower === "srcset" || lower === "imagesrcset") {
      if (tag === "source" && el.parentElement?.tagName !== "PICTURE") return null;
      return absoluteSrcset(value, base);
    }
    if (lower === "style") return absoluteCss(value, base);
    if (lower === "value" && tag === "input") {
      // Button labels are page copy; every other value may be visitor data.
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (!["submit", "button", "reset"].includes(type)) return null;
      return masked || strict ? mask(value) : value;
    }
    if ((lower === "selected" && tag === "option") || (lower === "loading" && tag === "img")) return null;
    if ((masked || strict) && ["alt", "title", "placeholder", "aria-label"].includes(lower)) return mask(value);
    return value;
  }

  function attributes(el, tag, masked) {
    let html = ` data-nid="${idOf(el)}"`;
    for (const { name, value } of el.attributes) {
      const next = attributeValue(el, tag, name, value, masked);
      if (next !== null) html += ` ${name}="${escapeAttr(next)}"`;
    }
    if (tag === "img") {
      // The image the browser actually picked; lazy loaders keep it in data-src.
      const src = el.currentSrc || el.getAttribute("data-src") || el.getAttribute("data-lazy-src");
      if (src && !el.getAttribute("src")?.trim()) html += ` src="${escapeAttr(absolute(src, base))}"`;
    }
    return html;
  }

  function walk(node, masked) {
    if (elements > MAX_ELEMENTS || length > MAX_LENGTH) throw new Error("page too large");
    if (node.nodeType === 3) {
      if (node.parentElement?.tagName === "STYLE") return; // written from the sheet below
      push(escapeText(maskText(node.data, masked)));
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node;
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag)) return;
    elements++;
    if (tag === "meta" && el.hasAttribute("http-equiv")) return;
    if (tag === "link") {
      const rel = (el.getAttribute("rel") || "").toLowerCase();
      if (rel.split(/\s+/).includes("stylesheet")) {
        const css = el.sheet ? sheetCss(el.sheet) : null;
        if (css !== null) {
          const media = el.getAttribute("media");
          push(`<style data-nid="${idOf(el)}"${media ? ` media="${escapeAttr(media)}"` : ""}>${css.replace(/<\/style/gi, "<\\/style")}</style>`);
          return;
        }
      } else if (!/\b(icon|manifest)\b/.test(rel)) {
        return; // preload, prefetch, modulepreload, preconnect: nothing to show
      }
    }
    const nowMasked = masked || isMaskedElement(el);
    push(`<${tag}${attributes(el, tag, nowMasked)}>`);
    if (VOID.has(tag)) return;
    if (tag === "style") {
      push(styleContent(el));
    } else if (tag === "textarea" || EMPTY.has(tag)) {
      // Textarea contents are visitor input; embeds show as empty boxes.
    } else {
      for (let child = el.firstChild; child; child = child.nextSibling) walk(child, nowMasked);
    }
    if (tag === "head") {
      // Styles added from script (constructable stylesheets).
      for (const sheet of document.adoptedStyleSheets || []) {
        const css = sheetCss(sheet);
        if (css) push(`<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`);
      }
    }
    push(`</${tag}>`);
  }

  // CSS-in-JS libraries add rules with insertRule, leaving the tag empty.
  function styleContent(el) {
    const css = el.sheet ? sheetCss(el.sheet) : null;
    return (css ?? el.textContent).replace(/<\/style/gi, "<\\/style");
  }

  // Masked when any ancestor is (data-noanalytics, contenteditable).
  function maskedContext(el) {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      if (isMaskedElement(node)) return true;
    }
    return false;
  }

  function run(fn) {
    out = [];
    length = 0;
    elements = 0;
    try {
      fn();
    } catch {
      return null;
    }
    return out.join("");
  }

  return {
    idOf,
    maskedContext,
    styleContent,
    // The whole page as a document.
    document() {
      const html = run(() => {
        push("<!DOCTYPE html>");
        walk(document.documentElement, false);
      });
      if (html === null) return null;
      return {
        html,
        viewport_width: window.innerWidth || document.documentElement.clientWidth,
        page_height: document.documentElement.scrollHeight,
      };
    },
    // One node (element or text) and everything inside it.
    node(node) {
      return run(() => walk(node, maskedContext(node.parentElement)));
    },
    // An element's children, to replace its contents.
    children(el) {
      return run(() => {
        const masked = maskedContext(el);
        for (let child = el.firstChild; child; child = child.nextSibling) walk(child, masked);
      });
    },
    // One attribute's stored value after an attribute change, or null.
    attribute(el, name) {
      const value = el.getAttribute(name);
      if (value === null) return null;
      return attributeValue(el, el.tagName.toLowerCase(), name, value, maskedContext(el));
    },
  };
}

export function captureSnapshot({ masking = "balanced" } = {}) {
  return createSerializer({ masking }).document();
}
