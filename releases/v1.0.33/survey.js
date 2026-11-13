// Survey and poll widget. Loaded by the tracker only when a survey is shown.
// Renders inside a shadow root, so the site's CSS can't change it and its CSS
// can't leak into the site. One question at a time; Esc or ✕ closes it.
// A page vote (look.position "inline") goes inside `mount` instead: a Yes / No
// answer is sent on click, it can't be closed and its thank-you stays.
// Callbacks: shown() (inline, once in view), answer(questionId, value),
// complete(), close(answeredAny), done(). Returns a function that removes it.

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

const css = (color, dark, position) => `
  :host { all: initial; ${position === "inline" ? "display: block;" : ""} }
  .wrap {
    box-sizing: border-box;
    ${position === "inline" ? "margin: 24px 0;"
    : position === "center" ? "position: fixed; z-index: 2147483000; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.35);"
      : "position: fixed; z-index: 2147483000; right: 16px; bottom: 16px; left: 16px; display: flex; justify-content: flex-end; pointer-events: none;"}
    font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .box {
    pointer-events: auto; box-sizing: border-box; width: 100%; max-width: ${position === "inline" ? "520px" : "360px"}; padding: 18px;
    border-radius: 12px; ${position === "inline" ? "" : "box-shadow: 0 10px 30px rgba(0,0,0,.2);"}
    background: ${dark ? "#111827" : "#ffffff"}; color: ${dark ? "#f9fafb" : "#111827"};
    border: 1px solid ${dark ? "#374151" : "#e5e7eb"};
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
    border: 1px solid ${dark ? "#4b5563" : "#d1d5db"}; background: none; color: inherit; font: inherit; text-align: left;
  }
  .opt:hover, .opt:focus-visible, .opt.on { border-color: ${color}; outline: none; }
  .opt.on { background: ${color}22; }
  .scale { display: flex; flex-wrap: wrap; gap: 6px; }
  .scale .opt { justify-content: center; min-width: 32px; padding: 8px 0; flex: 1 0 32px; }
  .ends { display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; opacity: .7; }
  textarea {
    box-sizing: border-box; width: 100%; min-height: 80px; padding: 9px 12px; border-radius: 8px; resize: vertical;
    border: 1px solid ${dark ? "#4b5563" : "#d1d5db"}; background: none; color: inherit; font: inherit;
  }
  textarea:focus { outline: none; border-color: ${color}; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 14px; }
  .dots { display: flex; gap: 4px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: ${dark ? "#4b5563" : "#d1d5db"}; }
  .dot.on { background: ${color}; }
  .actions { display: flex; gap: 8px; margin-left: auto; }
  .btn { border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; font: inherit; font-weight: 600; background: ${color}; color: #fff; }
  .btn[disabled] { opacity: .45; cursor: default; }
  .link { border: 0; background: none; color: inherit; opacity: .7; cursor: pointer; font: inherit; }
  .thanks { margin: 4px 0; font-weight: 600; }
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
  const color = /^#[0-9a-f]{3,8}$/i.test(look.color || "") ? look.color : "#2563eb";
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
  root.append(el("style", { text: css(color, look.theme === "dark", position) }));
  const box = inline
    ? el("section", { class: "box", "aria-labelledby": "q" })
    : el("div", { class: "box", role: "dialog", "aria-modal": position === "center" ? "true" : "false", "aria-labelledby": "q" });
  root.append(el("div", { class: "wrap" }, [box]));
  (mount || document.body).append(host);

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
    document.removeEventListener("keydown", onKey, true);
    host.remove();
  };
  const close = () => {
    if (closed) return;
    finish();
    callbacks.close(answeredAny);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  if (!inline) document.addEventListener("keydown", onKey, true);

  const thanks = () => {
    callbacks.complete();
    box.replaceChildren(el("p", { class: "thanks", role: "status", text: texts.thanks }));
    if (inline) return;
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
    const send = el("button", { class: "btn", type: "button", text: last ? texts.submit : texts.next });
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
        const option = el("button", { class: "opt", type: "button", "aria-pressed": "false", text: label });
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
        const option = el("button", { class: "opt", type: "button", "aria-pressed": "false", text: String(n) });
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
      const area = el("textarea", { "aria-labelledby": "q", placeholder: texts.placeholder, maxlength: "1000" });
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
        el("p", { class: "q", id: "q", text: q.text }),
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
