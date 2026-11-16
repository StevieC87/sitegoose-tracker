// Survey and poll widget. Loaded by the tracker only when a survey is shown.
// Renders inside a shadow root, so the site's CSS reaches it only through the
// hooks followLook describes, and its CSS can't leak into the site. One question at a time; Esc or ✕ closes it.
// A page vote (look.position "inline") goes inside `mount` instead: a Yes / No
// answer is sent on click, it can't be closed and its thank-you stays.
// Callbacks: shown() (inline, once in view), answer(questionId, value),
// complete(), close(answeredAny), done(); and branded, whether the thank-you
// says "Powered by SiteGoose". Returns a function that removes it.

const DEFAULT_TEXTS = {
  next: "Next",
  submit: "Send",
  skip: "Skip",
  close: "Close",
  thanks: "Thanks for your feedback!",
  placeholder: "Type your answer…",
  yes: "Yes",
  no: "No",
  npsLow: "Not likely",
  npsHigh: "Very likely",
};

// The colours the box is drawn in. The owner can pick its background; the
// text, lines and field fills are worked out from that one colour, so a dark
// brand colour gets light text without anyone choosing it and no background
// can leave the widget unreadable. With no background it is the theme's own
// pair, exactly as before. The lines and fills are translucent black or white
// because the box behind them is always solid, so one pair of tints suits
// every hue. Identical in leadform.js, notice.js, feedback.js and
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

const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const css = (color, s, position, font) => `
  :host { all: initial; ${position === "inline" ? "display: block;" : ""} }
  .wrap {
    box-sizing: border-box;
    ${position === "inline" ? "margin: 24px 0;"
    : position === "center" ? "position: fixed; z-index: 2147483000; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.35);"
      : "position: fixed; z-index: 2147483000; right: 16px; bottom: 16px; left: 16px; display: flex; justify-content: flex-end; pointer-events: none;"}
    font: 15px/1.4 ${font || SYSTEM_FONT};
  }
  .box {
    pointer-events: auto; box-sizing: border-box; width: 100%; max-width: ${position === "inline" ? "520px" : "360px"}; padding: 18px;
    border-radius: 12px; ${position === "inline" ? "" : "box-shadow: 0 10px 30px rgba(0,0,0,.2);"}
    background: ${s.bg}; color: ${s.fg};
    border: 1px solid ${s.line};
  }
  .head { display: flex; align-items: flex-start; gap: 12px; }
  .q { flex: 1; margin: 0 0 14px; font-size: 16px; font-weight: 600; }
  .x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; font-size: 18px; line-height: 1; padding: 2px; }
  .x:hover, .x:focus-visible { opacity: 1; }
  .opts { display: flex; flex-direction: column; gap: 8px; }
  .opts.row { flex-direction: row; }
  .opts.row .opt { flex: 0 1 120px; justify-content: center; }
  .opt {
    display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 8px; cursor: pointer;
    border: 1px solid ${s.fieldLine}; background: none; color: inherit; font: inherit; text-align: left;
  }
  .opt:hover, .opt:focus-visible, .opt.on { border-color: ${color}; outline: none; }
  .opt.on { background: ${color}22; }
  .scale { display: flex; flex-wrap: wrap; gap: 6px; }
  .scale .opt { justify-content: center; min-width: 32px; padding: 8px 0; flex: 1 0 32px; }
  .ends { display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; opacity: .7; }
  textarea {
    box-sizing: border-box; width: 100%; min-height: 80px; padding: 9px 12px; border-radius: 8px; resize: vertical;
    border: 1px solid ${s.fieldLine}; background: none; color: inherit; font: inherit;
  }
  textarea:focus { outline: none; border-color: ${color}; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 14px; }
  .dots { display: flex; gap: 4px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: ${s.fieldLine}; }
  .dot.on { background: ${color}; }
  .actions { display: flex; gap: 8px; margin-left: auto; }
  .btn { border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; font: inherit; font-weight: 600; background: ${color}; color: #fff; }
  .btn[disabled] { opacity: .45; cursor: default; }
  .link { border: 0; background: none; color: inherit; opacity: .7; cursor: pointer; font: inherit; }
  .thanks { margin: 4px 0; font-weight: 600; }
  .credit { margin: 10px 0 0; font-size: 12px; font-weight: 400; opacity: 0.7; }
  .credit a { color: inherit; text-decoration: none; }
  .credit a:hover { text-decoration: underline; }
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

// The question a rule sends this answer to ("end" finishes), or null for the
// next one. Rules only point ahead, so a survey can't loop.
function branchOf(q, value) {
  for (const rule of q.logic || []) {
    const hit = Array.isArray(value)
      ? rule.op === "is" && value.includes(rule.value)
      : rule.op === "is"
        ? String(value) === rule.value
        : typeof value === "number" && (rule.op === "lte" ? value <= Number(rule.value) : value >= Number(rule.value));
    if (hit) return rule.to;
  }
  return null;
}

export function renderSurvey(survey, callbacks, mount = null) {
  const texts = { ...DEFAULT_TEXTS, ...(survey.texts || {}) };
  const look = survey.look || {};
  const questions = (survey.questions || []).filter((q) => q && q.id && q.text);
  if (!questions.length) {
    callbacks.done();
    return () => {};
  }
  const inline = Boolean(mount);
  const position = inline ? "inline" : look.position;

  const host = document.createElement("div");
  host.setAttribute("data-noanalytics", "");
  const root = host.attachShadow({ mode: "open" });
  const style = el("style");
  root.append(style);
  const site = followLook("survey", host, root, look, (seen, font) => {
    // Six digits only: the CSS appends a two-digit alpha to it.
    const color = /^#[0-9a-f]{6}$/i.test(seen.color || "") ? seen.color : "#2563eb";
    style.textContent = css(color, surface(seen), position, font);
  });
  const box = inline
    ? el("section", { class: "box", part: "box", "aria-labelledby": "q" })
    : el("div", { class: "box", part: "box", role: "dialog", "aria-modal": position === "center" ? "true" : "false", "aria-labelledby": "q" });
  root.append(el("div", { class: "wrap" }, [box]));
  (mount || document.body).append(host);
  site.update();

  let index = 0;
  let answeredAny = false;
  let closed = false;
  let seen = null;
  if (inline) {
    const onSeen = () => {
      seen?.disconnect();
      callbacks.shown?.();
    };
    if (typeof IntersectionObserver === "function") {
      seen = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onSeen());
      seen.observe(host);
    } else onSeen();
  }

  const finish = () => {
    closed = true;
    seen?.disconnect();
    site.stop();
    document.removeEventListener("keydown", onKey, true);
    host.remove();
  };
  const close = () => {
    if (closed) return;
    finish();
    callbacks.close(answeredAny);
  };
  // A corner survey isn't modal: Esc closes it only from inside, not when the
  // visitor is closing the site's own menu.
  const onKey = (e) => {
    if (e.key === "Escape" && (position === "center" || e.composedPath().includes(host))) close();
  };
  if (!inline) document.addEventListener("keydown", onKey, true);

  const thanks = () => {
    // Every question skipped: nothing was answered, so it closes as ✕ would.
    if (!answeredAny) return close();
    callbacks.complete();
    const said = el("p", { class: "thanks", role: "status", text: texts.thanks });
    // A page vote's thank-you stays in the page for good, so it never carries the line.
    if (inline) return box.replaceChildren(said);
    box.replaceChildren(said, ...(callbacks.branded ? [credit()] : []));
    setTimeout(() => {
      if (!closed) {
        finish();
        callbacks.done();
      }
    }, 2500);
  };

  const advance = (to = null) => {
    const target = to && to !== "end" ? questions.findIndex((q) => q.id === to) : -1;
    index = to === "end" ? questions.length : target > index ? target : index + 1;
    if (index >= questions.length) thanks();
    else render();
  };

  function render() {
    const q = questions[index];
    let value = q.type === "multi" ? [] : null;
    const last = index === questions.length - 1;
    const send = el("button", { class: "btn", part: "button", type: "button", text: last ? texts.submit : texts.next });
    const setValue = (next) => {
      value = next;
      send.disabled = value === null || value === "" || (Array.isArray(value) && !value.length);
    };
    setValue(value);

    let body;
    if (q.type === "choice" || q.type === "multi" || q.type === "yesno") {
      const options = q.type === "yesno" ? [["yes", texts.yes], ["no", texts.no]] : (q.options || []).map((o) => [o, o]);
      body = el("div", { class: "opts", role: q.type === "multi" ? "group" : "radiogroup", "aria-labelledby": "q" });
      for (const [optionValue, label] of options) {
        const option = el("button", { class: "opt", part: "field", type: "button", "aria-pressed": "false", text: label });
        option.addEventListener("click", () => {
          if (q.type === "multi") {
            const next = value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue];
            option.classList.toggle("on", next.includes(optionValue));
            option.setAttribute("aria-pressed", String(next.includes(optionValue)));
            setValue(next);
          } else {
            for (const other of body.children) {
              other.classList.remove("on");
              other.setAttribute("aria-pressed", "false");
            }
            option.classList.add("on");
            option.setAttribute("aria-pressed", "true");
            setValue(optionValue);
          }
        });
        body.append(option);
      }
    } else if (q.type === "rating" || q.type === "nps") {
      const from = q.type === "nps" ? 0 : 1;
      const to = q.type === "nps" ? 10 : q.scale === 10 ? 10 : 5;
      const scale = el("div", { class: "scale", role: "radiogroup", "aria-labelledby": "q" });
      for (let n = from; n <= to; n++) {
        const option = el("button", { class: "opt", part: "field", type: "button", "aria-pressed": "false", text: String(n) });
        option.addEventListener("click", () => {
          for (const other of scale.children) {
            other.classList.remove("on");
            other.setAttribute("aria-pressed", "false");
          }
          option.classList.add("on");
          option.setAttribute("aria-pressed", "true");
          setValue(n);
        });
        scale.append(option);
      }
      body = el("div", {}, [scale]);
      if (q.type === "nps") body.append(el("div", { class: "ends" }, [el("span", { text: texts.npsLow }), el("span", { text: texts.npsHigh })]));
    } else {
      const area = el("textarea", { part: "field", "aria-labelledby": "q", placeholder: texts.placeholder, maxlength: "1000" });
      area.addEventListener("input", () => setValue(area.value.trim()));
      body = area;
    }

    // A page vote's Yes / No goes on click.
    const oneClick = inline && q.type === "yesno";
    if (oneClick) {
      body.classList.add("row");
      for (const option of body.children) option.addEventListener("click", () => send.click());
    }

    send.addEventListener("click", () => {
      if (send.disabled) return;
      answeredAny = true;
      callbacks.answer(q.id, value).then((status) => {
        // Monthly response limit reached: stop quietly.
        if (status === 403) close();
      });
      advance(branchOf(q, value));
    });

    const dots = el("div", { class: "dots", "aria-hidden": "true" },
      questions.length > 1 ? questions.map((_, i) => el("span", { class: `dot${i <= index ? " on" : ""}` })) : []);
    const actions = el("div", { class: "actions" });
    if (!q.required && !oneClick) actions.append(el("button", { class: "link", type: "button", text: texts.skip, onclick: () => advance() }));
    if (!oneClick) actions.append(send);

    box.replaceChildren(
      el("div", { class: "head" }, [
        el("p", { class: "q", part: "title", id: "q", text: q.text }),
        ...(inline ? [] : [el("button", { class: "x", type: "button", "aria-label": texts.close, title: texts.close, text: "✕", onclick: close })]),
      ]),
      body,
      ...(oneClick ? [] : [el("div", { class: "foot" }, [inline ? el("span") : dots, actions])]),
    );
    // A centered survey is modal and takes focus; a corner one leaves the page alone.
    if (look.position === "center") (body.querySelector?.("button, textarea") || body).focus?.({ preventScroll: true });
  }

  render();
  return () => {
    if (!closed) finish();
  };
}
