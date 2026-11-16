// Cookie banner. Loaded by the tracker only for visitors who haven't answered
// on sites that turn it on. Renders inside a shadow root, so the site's CSS
// reaches it only through the host (#analytics-consent-banner, also
// [data-sg-widget="banner"] and the owner's own class names) and the ::part()
// names box, text and button. Those names are a promise to every site that
// uses them, as in the other widgets: never rename one. Each button can use
// its own background and text colors.
// The dashboard's "Copy code" version (cookieBannerCode.js) uses the same CSS.
// Sites that list other categories (functional, marketing) also get a
// Customize view with a switch for each.

const HEX = /^#[0-9a-f]{6}$/i;
const color = (value, fallback) => (HEX.test(value || "") ? value : fallback);
// The owner's class names (cssClass), checked as followLook checks them in the
// other widgets (and backend shared/cssClass.js): plain class names, at most five.
const CLASS_NAME = /^-?[A-Za-z_][A-Za-z0-9_-]{0,39}$/;
const siteClasses = (value) => (typeof value === "string" ? value.trim().split(/\s+/).filter((name) => CLASS_NAME.test(name)).slice(0, 5) : []);

const css = (b) => `
  :host { all: initial; }
  [hidden] { display: none !important; }
  .cb {
    position: fixed; z-index: 2147483000; box-sizing: border-box; display: flex; flex-wrap: wrap;
    align-items: center; gap: 12px 16px; padding: 14px 16px;
    background: ${color(b.background, "#ffffff")}; color: ${color(b.color, "#111827")};
    font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 -4px 20px rgba(0,0,0,.12);
  }
  .cb-bar { left: 0; right: 0; bottom: 0; justify-content: center; }
  .cb-corner { left: 16px; bottom: 16px; max-width: 360px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.2); }
  .cb p { margin: 0; flex: 1 1 280px; max-width: 720px; }
  .cb a { color: inherit; text-decoration: underline; }
  .cb-buttons { display: flex; gap: 8px; }
  .cb button {
    cursor: pointer; border-radius: 8px; padding: 8px 18px; font: inherit; font-weight: 600;
    border: 1px solid ${color(b.buttonBackground, "#111827")};
    background: ${color(b.buttonBackground, "#111827")}; color: ${color(b.buttonColor, "#ffffff")};
  }
  .cb button:focus-visible { outline: 2px solid ${color(b.buttonBackground, "#111827")}; outline-offset: 2px; }
  .cb button.cb-link { background: transparent; color: inherit; border-color: transparent; text-decoration: underline; padding: 8px 10px; }
${['accept', 'decline', 'customize', 'save'].map((name) => {
    const background = color(b[name + 'Background'], name === 'customize' ? 'transparent' : color(b.buttonBackground, '#111827'));
    const foreground = color(b[name + 'Color'], name === 'customize' ? color(b.color, '#111827') : color(b.buttonColor, '#ffffff'));
    return `.cb button[data-cb="${name}"] { background: ${background}; color: ${foreground}; border-color: ${background}; }`;
  }).join('\n')}
  .cb-open { max-height: 85vh; overflow-y: auto; }
  .cb-list { flex: 1 1 100%; max-width: 720px; margin: 0; padding: 0; list-style: none; }
  .cb-list li { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-top: 1px solid rgba(127,127,127,.25); }
  .cb-list li:first-child { border-top: 0; }
  .cb-list label { flex: 1; cursor: pointer; }
  .cb-list strong { display: block; }
  .cb-list small { display: block; opacity: .8; font-size: 13px; }
  .cb-list input { width: 18px; height: 18px; margin: 2px 0 0; accent-color: ${color(b.buttonBackground, "#111827")}; cursor: pointer; }
  .cb-list input:disabled { cursor: default; opacity: .6; }
  .cb-list em { display: block; font-style: normal; font-size: 12px; opacity: .65; margin-top: 2px; }
  .cb .cb-id { flex: 1 1 100%; margin: 0; font-size: 12px; opacity: .6; }
  @media (max-width: 480px) {
    .cb-corner { left: 8px; right: 8px; bottom: 8px; max-width: none; }
    .cb-buttons { width: 100%; flex-wrap: wrap; }
    .cb button { flex: 1; }
  }
`;

const safeUrl = (value) => (typeof value === "string" && /^(https?:\/\/|\/)/i.test(value) ? value : "");

const OPTIONAL = ["functional", "marketing"];
// For banners saved before categories had texts.
const DEFAULTS = {
  customize: "Customize",
  save: "Save choices",
  necessaryName: "Necessary",
  necessaryDesc: "Needed for the site to work. Always on.",
  analyticsName: "Analytics",
  analyticsDesc: "Helps us see how the site is used and when you come back.",
  functionalName: "Functional",
  functionalDesc: "Extra features such as chat, videos and maps.",
  marketingName: "Marketing",
  marketingDesc: "Ads and measuring them, by us and our partners.",
};
const label = (b, key) => (typeof b[key] === "string" && b[key].trim() ? b[key] : DEFAULTS[key]);

// A constructed sheet, as a page's Content-Security-Policy blocks a <style>
// element without its nonce, and the banner then shows unstyled at the end of
// the page. Browsers without constructed sheets get the element.
function styleBanner(root, text) {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    root.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement("style");
    style.textContent = text;
    root.prepend(style);
  }
}

// answer({ analytics, functional, marketing }) is called once, when the
// visitor decides. current: the answer so far, when reopened from a
// "Cookie settings" link (opens straight on the switches), with the device's
// consent ID so the visitor can quote it.
export function renderBanner(b, answer, current = null, consentId = "") {
  document.getElementById("analytics-consent-banner")?.remove();
  const offered = OPTIONAL.filter((name) => Array.isArray(b.categories) && b.categories.includes(name));
  const host = document.createElement("div");
  host.id = "analytics-consent-banner";
  host.setAttribute("data-sg-widget", "banner");
  for (const name of siteClasses(b.cssClass)) host.classList.add(name);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<div class="cb ${b.position === "corner" ? "cb-corner" : "cb-bar"}" part="box" role="dialog" aria-label="Cookie consent">
      <p part="text"></p>
      <ul class="cb-list" hidden></ul>
      <p class="cb-id" hidden></p>
      <div class="cb-buttons">
        <button type="button" class="cb-link" part="button" data-cb="customize" hidden></button>
        <button type="button" part="button" data-cb="decline"></button>
        <button type="button" part="button" data-cb="save" hidden></button>
        <button type="button" part="button" data-cb="accept"></button>
      </div>
    </div>`;
  styleBanner(root, css(b));
  const box = root.querySelector(".cb");
  const text = root.querySelector("p");
  text.textContent = `${b.text || ""} `;
  const policy = safeUrl(b.policyUrl);
  if (policy) {
    const link = document.createElement("a");
    link.href = policy;
    link.textContent = b.policyLabel || "Cookie policy";
    text.append(link);
  }
  const button = (name) => root.querySelector(`[data-cb="${name}"]`);
  button("accept").textContent = b.accept || "Accept";
  button("decline").textContent = b.decline || "Decline";
  button("customize").textContent = label(b, "customize");
  button("save").textContent = label(b, "save");

  // One switch per category; texts go in with textContent, never as HTML.
  const list = root.querySelector(".cb-list");
  for (const name of ["necessary", "analytics", ...offered]) {
    const item = document.createElement("li");
    const id = `cb-${name}`;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.name = name;
    input.checked = name === "necessary" || current?.[name] === true;
    input.disabled = name === "necessary";
    const caption = document.createElement("label");
    caption.htmlFor = id;
    const title = document.createElement("strong");
    title.textContent = label(b, `${name}Name`);
    const about = document.createElement("small");
    about.textContent = label(b, `${name}Desc`);
    caption.append(title, about);
    // The services the site lists in this category.
    const services = (Array.isArray(b.services) ? b.services : [])
      .filter((s) => s?.category === name && typeof s.name === "string").map((s) => s.name);
    if (services.length) {
      const names = document.createElement("em");
      names.textContent = services.join(", ");
      caption.append(names);
    }
    item.append(input, caption);
    list.append(item);
  }
  if (current && consentId) {
    const id = root.querySelector(".cb-id");
    id.textContent = `Consent ID: ${consentId}`;
    id.hidden = false;
  }
  const openSwitches = () => {
    list.hidden = false;
    box.classList.add("cb-open");
    button("customize").hidden = true;
    button("save").hidden = false;
    list.querySelector("input:not(:disabled)")?.focus();
  };
  if (offered.length) {
    button("customize").hidden = false;
    if (current) openSwitches();
  }

  const all = (allowed) => Object.fromEntries(["analytics", ...OPTIONAL].map((name) => [name, allowed]));
  root.querySelector(".cb-buttons").addEventListener("click", (event) => {
    const choice = event.target.closest("button")?.getAttribute("data-cb");
    if (!choice) return;
    if (choice === "customize") return openSwitches();
    host.remove();
    if (choice !== "save") return answer(all(choice === "accept"));
    // Categories the site doesn't list are declined.
    const picked = all(false);
    for (const input of list.querySelectorAll("input:not(:disabled)")) picked[input.name] = input.checked;
    answer(picked);
  });
  document.body.append(host);
}
