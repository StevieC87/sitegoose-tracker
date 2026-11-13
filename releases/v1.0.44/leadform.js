// Lead form widget (newsletter, contact, download, callback). Loaded by the tracker
// only when a form is shown: as a popup, or inline inside the site's
// <div data-analytics-leadform="id">. Renders inside a shadow root, so the
// site's CSS can't change it. `step_groups` splits the fields over steps.
// Callbacks: submit(values, extra) -> Promise<{ status, field, message }>,
// submitted(), close() (closed without sending), done(); shield, the
// page's spam protection (shield.js) when the site uses it; and image, the
// URL of a popup's image (above the form, or beside it in centred popups). renderLauncher
// draws the floating button that opens a "button" popup.

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
  .field { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .cap { font-weight: 600; }
  .group { display: flex; flex-direction: column; gap: 6px; }
  .group[aria-invalid=true] { border: 0; }
  .group[aria-invalid=true] .check span { color: #dc2626; }
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
  .box.pic { padding: 0; overflow: hidden auto; max-height: calc(100vh - 32px); }
  .box.pic .main { padding: 20px; }
  .media { background: ${dark ? "#1f2937" : "#f3f4f6"}; }
  .media img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .top .media { aspect-ratio: var(--ratio, 16 / 9); max-height: ${mode === "center" ? "240px" : "160px"}; }
  .side { display: flex; max-width: 720px; }
  .side .media { width: 44%; flex: none; }
  .side .main { flex: 1; align-self: center; }
  @media (max-width: 600px) {
    .side { flex-direction: column; }
    .side .media { width: 100%; aspect-ratio: 16 / 9; max-height: 160px; }
  }
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

const INPUT_TYPES = { email: "email", phone: "tel", name: "text", text: "text", number: "number", date: "date", url: "url" };
const AUTOCOMPLETE = { email: "email", phone: "tel", name: "name", url: "url" };
// Radio buttons and tick boxes: one control per option, not one per field.
const GROUP_TYPES = ["radio", "multi"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER = /^-?\d+(\.\d+)?$/;
// The formats a text field can ask for. Each is one bounded character class,
// so none of them can backtrack; keep them in step with Analytics/leads.js.
const FORMATS = {
  letters: [/^[\p{L}\s'-]+$/u, "Please use letters only."],
  digits: [/^\d+$/, "Please use digits only."],
  alnum: [/^[\p{L}\d\s'-]+$/u, "Please use letters and digits only."],
  postcode: [/^[A-Za-z\d][A-Za-z\d\s-]*$/, "Please enter a valid postcode."],
};
const httpUrl = (value) => {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};
// A date that exists: an impossible day rolls over (30 February becomes
// 2 March), so what comes back has to still read as what went in.
const realDate = (value) => {
  if (!ISO_DATE.test(value)) return false;
  const when = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(when.getTime()) && when.toISOString().slice(0, 10) === value;
};

export function renderLeadForm(form, mount, callbacks) {
  const texts = { ...DEFAULTS, button: form.button || DEFAULTS.button, thanks: form.thanks || DEFAULTS.thanks };
  const look = form.look || {};
  const color = /^#[0-9a-f]{6}$/i.test(look.color || "") ? look.color : "#2563eb";
  const mode = mount ? "inline" : look.position === "center" ? "center" : "corner";
  // Leads are told apart by email, so it is required, unless the form asks
  // for a phone number instead (callbacks): then one of the two will do.
  const all = (form.fields || []).filter((f) => f && f.id && f.label);
  const hasPhone = all.some((f) => f.type === "phone");
  const hasEmail = all.some((f) => f.type === "email");
  const fields = all.map((f) => ((f.type === "email" && !hasPhone) || (f.type === "phone" && !hasEmail) ? { ...f, required: true } : f));
  // Both asked for and neither required: checked on the last step.
  const emailField = hasPhone && fields.find((f) => f.type === "email" && !f.required);
  const phoneField = emailField && fields.find((f) => f.type === "phone" && !f.required);
  if (!fields.length) {
    callbacks.done();
    return;
  }

  const host = document.createElement("div");
  host.setAttribute("data-noanalytics", "");
  const root = host.attachShadow({ mode: "open" });
  root.append(el("style", { text: css(color, look.theme === "dark", mode) }));
  const box = el("div", mode === "inline" ? { class: "box" } : { class: "box", role: "dialog", "aria-modal": mode === "center" ? "true" : "false", "aria-labelledby": "t" });
  // With an image, the form goes in .main beside or under it.
  const main = callbacks.image ? el("div", { class: "main" }) : box;
  if (callbacks.image) {
    const image = form.image || {};
    box.classList.add("pic", mode === "center" && form.image_layout === "side" ? "side" : "top");
    if (image.width && image.height) box.style.setProperty("--ratio", `${image.width} / ${image.height}`);
    const media = el("div", { class: "media" }, [el("img", {
      src: callbacks.image, alt: image.alt || "", decoding: "async", width: image.width, height: image.height,
      onerror: () => media.remove(),
    })]);
    box.append(media, main);
  }
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

  // One control per field, except radio and tick-box groups, whose options
  // each get an input of their own and are read out of `picks`.
  const controls = new Map();
  const picks = new Map();
  const rows = fields.map((f) => {
    let control;
    if (f.type === "textarea") control = el("textarea", { name: f.id, maxlength: "2000", required: f.required });
    else if (f.type === "select") {
      control = el("select", { name: f.id, required: f.required }, [
        el("option", { value: "", text: "—" }),
        ...(f.options || []).map((o) => el("option", { value: o, text: o })),
      ]);
    } else if (f.type === "checkbox") control = el("input", { type: "checkbox", name: f.id });
    else if (GROUP_TYPES.includes(f.type)) {
      const inputs = (f.options || []).map((o) => el("input", { type: f.type === "radio" ? "radio" : "checkbox", name: f.id, value: o }));
      picks.set(f.id, inputs);
      control = el("div", { class: "group", role: f.type === "radio" ? "radiogroup" : "group", "aria-label": f.label },
        inputs.map((input, k) => el("label", { class: "check" }, [input, el("span", { text: f.options[k] })])));
    } else {
      control = el("input", {
        type: INPUT_TYPES[f.type] || "text", name: f.id, maxlength: "300", required: f.required,
        autocomplete: AUTOCOMPLETE[f.type], placeholder: f.placeholder || undefined,
        // Lets the browser's own number and date pickers hold the same line
        // the collector does.
        min: f.min === undefined ? undefined : String(f.min),
        max: f.max === undefined ? undefined : String(f.max),
      });
    }
    controls.set(f.id, control);
    if (f.type === "checkbox") return el("label", { class: "check" }, [control, el("span", { text: f.label })]);
    const caption = f.label + (f.required ? " *" : "");
    // A group's options are each their own label, so the field's name can't be
    // one too: clicking it would tick the first option.
    return GROUP_TYPES.includes(f.type)
      ? el("div", { class: "field" }, [el("span", { class: "cap", text: caption }), control])
      : el("label", {}, [el("span", { text: caption }), control]);
  });
  const consent = form.consent ? el("input", { type: "checkbox", name: "consent" }) : null;
  const consentRow = consent ? el("label", { class: "check" }, [consent, el("span", { text: form.consent })]) : null;
  // Bots fill every field; people never see this one.
  const honeypot = el("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off" });
  const error = el("p", { class: "err", role: "alert" });
  const started = Date.now();
  const shield = callbacks.shield || null;
  if (shield) shield.watchTrap(honeypot);
  const robotBox = shield?.mode === "checkbox" ? shield.box() : null;

  const valueOf = (f) => {
    if (f.type === "multi") return picks.get(f.id).filter((i) => i.checked).map((i) => i.value);
    if (f.type === "radio") return picks.get(f.id).find((i) => i.checked)?.value || "";
    const control = controls.get(f.id);
    return f.type === "checkbox" ? control.checked : control.value.trim();
  };
  // A group is marked as a whole but focused on its first option.
  const focusOf = (f) => (picks.has(f.id) ? picks.get(f.id)[0] : controls.get(f.id));
  // What's wrong with a value the visitor did fill in, in their own words.
  // The collector checks all of this again; this is only to say so sooner.
  const badValue = (f, value) => {
    if (f.type === "email") return EMAIL.test(value) ? "" : "Please enter a valid email address.";
    if (f.type === "url") return httpUrl(value) ? "" : "Please enter a full web address, starting with http:// or https://.";
    if (f.type === "number") {
      if (!NUMBER.test(value)) return "Please enter a number.";
      const n = Number(value);
      if (typeof f.min === "number" && n < f.min) return `Please enter ${f.min} or more.`;
      if (typeof f.max === "number" && n > f.max) return `Please enter ${f.max} or less.`;
      return "";
    }
    if (f.type === "date") {
      if (!realDate(value)) return "Please pick a date.";
      if (typeof f.min === "string" && value < f.min) return `Please pick a date no earlier than ${f.min}.`;
      if (typeof f.max === "string" && value > f.max) return `Please pick a date no later than ${f.max}.`;
      return "";
    }
    const format = (f.type === "text" || f.type === "textarea") && FORMATS[f.format];
    if (format) return format[0].test(value) ? "" : format[1];
    return "";
  };
  // What a field's answer counts as when a condition looks at it, matching
  // chosenOf in Analytics/leads.js.
  const chosenOf = (f) => {
    const value = valueOf(f);
    if (f.type === "checkbox") return value === true ? ["yes"] : [];
    if (Array.isArray(value)) return value;
    return value === "" ? [] : [String(value)];
  };
  const conditionMet = (rule, picked) => {
    if (rule.op === "filled") return picked.length > 0;
    if (rule.op === "empty") return picked.length === 0;
    const has = picked.includes(rule.value);
    return rule.op === "not" ? !has : has;
  };
  const conditional = fields.some((f) => f.show_if);
  const byId = new Map(fields.map((f) => [f.id, f]));
  // Which fields are on show right now. A condition can only name a field
  // above, so one pass settles it; the collector works the same set out again
  // from what arrives, and that is the one that counts.
  const visibleNow = () => {
    const visible = new Set();
    for (const f of fields) {
      if (!f.show_if) visible.add(f.id);
      else if (visible.has(f.show_if.field) && conditionMet(f.show_if, chosenOf(byId.get(f.show_if.field)))) visible.add(f.id);
    }
    return visible;
  };
  // The first problem among these fields, marked on the field.
  const problemIn = (list) => {
    for (const f of list) {
      const value = valueOf(f);
      // A tick-box group's value is a list, and an empty list is still truthy.
      const empty = Array.isArray(value) ? value.length === 0 : !value;
      const problem = f.required && empty ? `Please fill in ${f.label}.` : empty ? "" : badValue(f, value);
      controls.get(f.id).setAttribute("aria-invalid", String(Boolean(problem)));
      if (problem) {
        focusOf(f).focus();
        return problem;
      }
    }
    return "";
  };

  // Steps come as groups of field ids (publicLeadForm normalizes them): ids
  // this form doesn't have drop out, and whatever the groups left out joins
  // the last step, so a field is always reachable.
  const indexOf = new Map(fields.map((f, i) => [f.id, i]));
  const taken = new Set();
  const steps = [];
  for (const group of Array.isArray(form.step_groups) ? form.step_groups : []) {
    const picked = (Array.isArray(group) ? group : [])
      .map((id) => indexOf.get(id))
      .filter((i) => i !== undefined && !taken.has(i));
    for (const i of picked) taken.add(i);
    if (picked.length) steps.push(picked);
  }
  const missed = fields.map((_, i) => i).filter((i) => !taken.has(i));
  if (!steps.length) {
    // No groups, so an older payload: fall back to what its boolean meant.
    if (form.steps) steps.push(...missed.map((i) => [i]));
    else steps.push(missed);
  } else steps[steps.length - 1].push(...missed);
  let step = 0;
  const send = el("button", { class: "btn", type: "submit" });
  const back = el("button", { class: "link", type: "button", text: DEFAULTS.back, onclick: () => show(stepFrom(step - 1, -1)) });
  const dots = el("div", { class: "dots", "aria-hidden": "true" });
  const formEl = el("form", { novalidate: true });

  const stepShows = (i, visible) => steps[i].some((k) => visible.has(fields[k].id));
  // The nearest step in that direction with anything left to show, or -1. A
  // step whose every field is hidden by a condition is stepped over, which is
  // how a whole step is made conditional.
  const stepFrom = (start, by) => {
    const visible = visibleNow();
    for (let i = start; i >= 0 && i < steps.length; i += by) {
      if (stepShows(i, visible)) return i;
    }
    return -1;
  };

  function show(next) {
    if (next >= 0) step = next;
    const visible = visibleNow();
    const last = stepFrom(step + 1, 1) === -1;
    rows.forEach((row, i) => { row.hidden = !steps[step].includes(i) || !visible.has(fields[i].id); });
    if (consentRow) consentRow.hidden = !last;
    if (robotBox) robotBox.hidden = !last;
    send.textContent = last ? texts.button : DEFAULTS.next;
    back.hidden = stepFrom(step - 1, -1) === -1;
    const shownSteps = steps.map((_, i) => i).filter((i) => stepShows(i, visible));
    dots.replaceChildren(...(shownSteps.length > 1
      ? shownSteps.map((i) => el("span", { class: `dot${i <= step ? " on" : ""}` }))
      : []));
    error.textContent = "";
  }

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (send.disabled) return;
    // Only what the visitor can see is theirs to fill in.
    const visible = visibleNow();
    const onStep = steps[step].map((i) => fields[i]).filter((f) => visible.has(f.id));
    const problem = problemIn(onStep);
    if (problem) {
      error.textContent = problem;
      return;
    }
    const ahead = stepFrom(step + 1, 1);
    if (ahead === -1 && phoneField && !valueOf(emailField) && !valueOf(phoneField)) {
      error.textContent = `Please fill in ${phoneField.label} or ${emailField.label}.`;
      return;
    }
    if (ahead !== -1) {
      show(ahead);
      focusOf(steps[step].map((i) => fields[i]).find((f) => visibleNow().has(f.id))).focus();
      return;
    }
    if (consent && !consent.checked) {
      error.textContent = "Please tick the box to continue.";
      consent.focus();
      return;
    }
    if (shield && !shield.ticked(formEl)) {
      error.textContent = "Please tick \u201cI'm not a robot\u201d.";
      shield.nudge(formEl);
      return;
    }
    const values = Object.fromEntries(fields.map((f) => [f.id, valueOf(f)]));
    if (consent) values.consent = true;
    send.disabled = true;
    error.textContent = "";
    const answer = shield ? await shield.take() : "";
    const { status, field, message } = await callbacks.submit(values, { website: honeypot.value, elapsed_ms: Date.now() - started, shield: answer });
    send.disabled = false;
    if (status >= 200 && status < 300) return thanks();
    if (field && controls.has(field)) {
      const index = fields.findIndex((f) => f.id === field);
      show(steps.findIndex((s) => s.includes(index)));
      controls.get(field).setAttribute("aria-invalid", "true");
    }
    error.textContent = status === 429 ? "Too many attempts, please try again later." : message || "Something went wrong, please try again.";
  });

  formEl.append(...rows, ...(consentRow ? [consentRow] : []), ...(robotBox ? [robotBox] : []), el("div", { class: "hp", "aria-hidden": "true" }, [honeypot]), error,
    el("div", { class: "foot" }, [dots, back, send]));

  const head = el("div", { class: "head" }, [el("p", { class: "title", id: "t", text: form.title || "" })]);
  if (!mount) head.append(el("button", { class: "x", type: "button", "aria-label": DEFAULTS.close, title: DEFAULTS.close, text: "✕", onclick: close }));
  main.append(head);
  if (form.description) main.append(el("p", { class: "desc", text: form.description }));
  main.append(formEl);
  // An answer can decide what else is on show, so the step is redrawn as they
  // go. A group's own inputs bubble up to the element held in `controls`.
  if (conditional) {
    for (const control of controls.values()) {
      control.addEventListener("input", () => show(-1));
      control.addEventListener("change", () => show(-1));
    }
  }
  // Conditions can leave the first step with nothing on it, so start at the
  // first step that has something.
  show(Math.max(stepFrom(0, 1), 0));
  if (mode === "center") {
    const first = steps[step].map((i) => fields[i]).find((f) => visibleNow().has(f.id)) || fields[0];
    focusOf(first).focus({ preventScroll: true });
  }

  function thanks() {
    const done = [el("p", { class: "thanks", role: "status", text: texts.thanks })];
    if (/^https?:\/\//i.test(form.download_url || "")) {
      done.push(el("a", { class: "btn", href: form.download_url, target: "_blank", rel: "noopener", text: DEFAULTS.download }));
    }
    main.replaceChildren(...done);
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
      main.prepend(el("div", { class: "head" }, [el("span", { class: "title" }), el("button", { class: "x", type: "button", "aria-label": DEFAULTS.close, text: "✕", onclick: () => { finish(); callbacks.done(); } })]));
    }
  }
}

// The floating button for a "button" popup, in the corner its form opens in
// (bottom right). onOpen is called on click; returns { show(on), remove() }.
export function renderLauncher(form, onOpen) {
  const look = form.look || {};
  const color = /^#[0-9a-f]{6}$/i.test(look.color || "") ? look.color : "#2563eb";
  const host = document.createElement("div");
  host.setAttribute("data-noanalytics", "");
  const root = host.attachShadow({ mode: "open" });
  root.append(el("style", { text: `
    :host { all: initial; }
    [hidden] { display: none !important; }
    button {
      position: fixed; z-index: 2147482999; right: 16px; bottom: 16px; border: 0; border-radius: 999px;
      padding: 12px 18px; cursor: pointer; font: 600 15px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: ${color}; color: #fff; box-shadow: 0 6px 20px rgba(0,0,0,.2); max-width: calc(100vw - 32px);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    button:focus-visible { outline: 3px solid ${color}66; outline-offset: 2px; }
  ` }));
  const button = el("button", { type: "button", "aria-haspopup": "dialog", text: form.targeting?.trigger?.label || "Contact us", onclick: onOpen });
  root.append(button);
  document.body.append(host);
  return {
    show: (on) => { button.hidden = !on; },
    remove: () => host.remove(),
  };
}
