// Lead form widget (newsletter, contact, download). Loaded by the tracker
// only when a form is shown: as a popup, or inline inside the site's
// <div data-analytics-leadform="id">. Renders inside a shadow root, so the
// site's CSS can't change it. With `steps`, one field at a time.
// Callbacks: submit(values, extra) -> Promise<{ status, field, message }>,
// submitted(), close() (closed without sending), done().

const DEFAULTS = { button: "Subscribe", thanks: "Thanks! You're on the list.", next: "Next", back: "Back", close: "Close", download: "Download" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const css = (color, dark, mode) => `
  :host { all: initial; }
  [hidden] { display: none !important; }
  .wrap {
    box-sizing: border-box; font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    ${mode === "center" ? "position: fixed; z-index: 2147483000; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,.35);" : ""}
    ${mode === "corner" ? "position: fixed; z-index: 2147483000; right: 16px; bottom: 16px; left: 16px; display: flex; justify-content: flex-end; pointer-events: none;" : ""}
  }
  .box {
    pointer-events: auto; box-sizing: border-box; width: 100%; max-width: ${mode === "inline" ? "480px" : "380px"}; padding: 20px;
    border-radius: 12px; ${mode === "inline" ? "" : "box-shadow: 0 10px 30px rgba(0,0,0,.2);"}
    background: ${dark ? "#111827" : "#ffffff"}; color: ${dark ? "#f9fafb" : "#111827"};
    border: 1px solid ${dark ? "#374151" : "#e5e7eb"};
  }
  .head { display: flex; align-items: flex-start; gap: 12px; }
  .title { flex: 1; margin: 0 0 6px; font-size: 18px; font-weight: 700; }
  .desc { margin: 0 0 14px; opacity: .8; }
  .x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; font-size: 18px; line-height: 1; padding: 2px; }
  .x:hover, .x:focus-visible { opacity: 1; }
  form { display: flex; flex-direction: column; gap: 12px; margin: 0; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 14px; font-weight: 600; }
  input, select, textarea {
    box-sizing: border-box; width: 100%; padding: 9px 12px; border-radius: 8px; font: inherit; font-weight: 400;
    border: 1px solid ${dark ? "#4b5563" : "#d1d5db"}; background: ${dark ? "#1f2937" : "#fff"}; color: inherit;
  }
  textarea { min-height: 80px; resize: vertical; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: ${color}; box-shadow: 0 0 0 3px ${color}33; }
  [aria-invalid=true] { border-color: #dc2626; }
  .check { flex-direction: row; align-items: flex-start; gap: 8px; font-weight: 400; font-size: 13px; }
  .check input { width: auto; margin: 2px 0 0; }
  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .err { margin: 0; color: #dc2626; font-size: 13px; }
  .foot { display: flex; align-items: center; gap: 8px; }
  .dots { display: flex; gap: 4px; margin-right: auto; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: ${dark ? "#4b5563" : "#d1d5db"}; }
  .dot.on { background: ${color}; }
  .btn { margin-left: auto; border: 0; border-radius: 8px; padding: 10px 16px; cursor: pointer; font: inherit; font-weight: 600; background: ${color}; color: #fff; text-decoration: none; display: inline-block; }
  .btn[disabled] { opacity: .5; cursor: default; }
  .link { border: 0; background: none; color: inherit; opacity: .7; cursor: pointer; font: inherit; }
  .thanks { margin: 0 0 12px; font-weight: 600; }
`;

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

const INPUT_TYPES = { email: "email", phone: "tel", name: "text", text: "text" };
const AUTOCOMPLETE = { email: "email", phone: "tel", name: "name" };

export function renderLeadForm(form, mount, callbacks) {
  const texts = { ...DEFAULTS, button: form.button || DEFAULTS.button, thanks: form.thanks || DEFAULTS.thanks };
  const look = form.look || {};
  const color = /^#[0-9a-f]{6}$/i.test(look.color || "") ? look.color : "#2563eb";
  const mode = mount ? "inline" : look.position === "center" ? "center" : "corner";
  // Leads are told apart by email, so it is always required.
  const fields = (form.fields || []).filter((f) => f && f.id && f.label).map((f) => (f.type === "email" ? { ...f, required: true } : f));
  if (!fields.length) {
    callbacks.done();
    return;
  }

  const host = document.createElement("div");
  host.setAttribute("data-noanalytics", "");
  const root = host.attachShadow({ mode: "open" });
  root.append(el("style", { text: css(color, look.theme === "dark", mode) }));
  const box = el("div", mode === "inline" ? { class: "box" } : { class: "box", role: "dialog", "aria-modal": mode === "center" ? "true" : "false", "aria-labelledby": "t" });
  root.append(el("div", { class: "wrap" }, [box]));
  (mount || document.body).append(host);

  let closed = false;
  const finish = () => {
    closed = true;
    document.removeEventListener("keydown", onKey, true);
    if (!mount) host.remove();
  };
  const close = () => {
    if (closed) return;
    finish();
    callbacks.close();
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  if (!mount) document.addEventListener("keydown", onKey, true);

  // One control per field; values are read from them on submit.
  const controls = new Map();
  const rows = fields.map((f) => {
    let control;
    if (f.type === "textarea") control = el("textarea", { name: f.id, maxlength: "2000", required: f.required });
    else if (f.type === "select") {
      control = el("select", { name: f.id, required: f.required }, [
        el("option", { value: "", text: "—" }),
        ...(f.options || []).map((o) => el("option", { value: o, text: o })),
      ]);
    } else if (f.type === "checkbox") control = el("input", { type: "checkbox", name: f.id });
    else {
      control = el("input", {
        type: INPUT_TYPES[f.type] || "text", name: f.id, maxlength: "300", required: f.required,
        autocomplete: AUTOCOMPLETE[f.type], placeholder: f.placeholder || undefined,
      });
    }
    controls.set(f.id, control);
    return f.type === "checkbox"
      ? el("label", { class: "check" }, [control, el("span", { text: f.label })])
      : el("label", {}, [el("span", { text: f.label + (f.required ? " *" : "") }), control]);
  });
  const consent = form.consent ? el("input", { type: "checkbox", name: "consent" }) : null;
  const consentRow = consent ? el("label", { class: "check" }, [consent, el("span", { text: form.consent })]) : null;
  // Bots fill every field; people never see this one.
  const honeypot = el("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off" });
  const error = el("p", { class: "err", role: "alert" });
  const started = Date.now();

  const valueOf = (f) => {
    const control = controls.get(f.id);
    return f.type === "checkbox" ? control.checked : control.value.trim();
  };
  // The first problem among these fields, marked on the field.
  const problemIn = (list) => {
    for (const f of list) {
      const value = valueOf(f);
      const control = controls.get(f.id);
      const bad = (f.required && !value) || (f.type === "email" && value && !EMAIL.test(value));
      control.setAttribute("aria-invalid", String(Boolean(bad)));
      if (bad) {
        control.focus();
        return f.type === "email" && value ? "Please enter a valid email address." : `Please fill in ${f.label}.`;
      }
    }
    return "";
  };

  const steps = form.steps ? fields.map((_, i) => [i]) : [fields.map((_, i) => i)];
  let step = 0;
  const send = el("button", { class: "btn", type: "submit" });
  const back = el("button", { class: "link", type: "button", text: DEFAULTS.back, onclick: () => show(step - 1) });
  const dots = el("div", { class: "dots", "aria-hidden": "true" });
  const formEl = el("form", { novalidate: true });

  function show(next) {
    step = next;
    const last = step === steps.length - 1;
    rows.forEach((row, i) => { row.hidden = !steps[step].includes(i); });
    if (consentRow) consentRow.hidden = !last;
    send.textContent = last ? texts.button : DEFAULTS.next;
    back.hidden = step === 0;
    dots.replaceChildren(...(steps.length > 1 ? steps.map((_, i) => el("span", { class: `dot${i <= step ? " on" : ""}` })) : []));
    error.textContent = "";
  }

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (send.disabled) return;
    const problem = problemIn(steps[step].map((i) => fields[i]));
    if (problem) {
      error.textContent = problem;
      return;
    }
    if (step < steps.length - 1) {
      show(step + 1);
      controls.get(fields[steps[step][0]].id).focus();
      return;
    }
    if (consent && !consent.checked) {
      error.textContent = "Please tick the box to continue.";
      consent.focus();
      return;
    }
    const values = Object.fromEntries(fields.map((f) => [f.id, valueOf(f)]));
    if (consent) values.consent = true;
    send.disabled = true;
    error.textContent = "";
    const { status, field, message } = await callbacks.submit(values, { website: honeypot.value, elapsed_ms: Date.now() - started });
    send.disabled = false;
    if (status >= 200 && status < 300) return thanks();
    if (field && controls.has(field)) {
      const index = fields.findIndex((f) => f.id === field);
      show(steps.findIndex((s) => s.includes(index)));
      controls.get(field).setAttribute("aria-invalid", "true");
    }
    error.textContent = status === 429 ? "Too many attempts, please try again later." : message || "Something went wrong, please try again.";
  });

  formEl.append(...rows, ...(consentRow ? [consentRow] : []), el("div", { class: "hp", "aria-hidden": "true" }, [honeypot]), error,
    el("div", { class: "foot" }, [dots, back, send]));

  const head = el("div", { class: "head" }, [el("p", { class: "title", id: "t", text: form.title || "" })]);
  if (!mount) head.append(el("button", { class: "x", type: "button", "aria-label": DEFAULTS.close, title: DEFAULTS.close, text: "✕", onclick: close }));
  box.append(head);
  if (form.description) box.append(el("p", { class: "desc", text: form.description }));
  box.append(formEl);
  show(0);
  if (mode === "center") controls.get(fields[0].id).focus({ preventScroll: true });

  function thanks() {
    const done = [el("p", { class: "thanks", role: "status", text: texts.thanks })];
    if (/^https?:\/\//i.test(form.download_url || "")) {
      done.push(el("a", { class: "btn", href: form.download_url, target: "_blank", rel: "noopener", text: DEFAULTS.download }));
    }
    box.replaceChildren(...done);
    callbacks.submitted();
    // Popups close by themselves unless there's a download to click.
    if (!mount && !form.download_url) {
      setTimeout(() => {
        if (!closed) {
          finish();
          callbacks.done();
        }
      }, 3000);
    } else if (!mount) {
      box.prepend(el("div", { class: "head" }, [el("span", { class: "title" }), el("button", { class: "x", type: "button", "aria-label": DEFAULTS.close, text: "✕", onclick: () => { finish(); callbacks.done(); } })]));
    }
  }
}
