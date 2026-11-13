// Cookie banner. Loaded by the tracker only for visitors who haven't answered
// on sites that turn it on. Renders inside a shadow root, so the site's CSS
// can't change it. Accept and Decline look the same, as EU rules expect.
// The dashboard's "Copy code" version (cookieBannerCode.js) uses the same CSS.

const HEX = /^#[0-9a-f]{6}$/i;
const color = (value, fallback) => (HEX.test(value || "") ? value : fallback);

const css = (b) => `
  :host { all: initial; }
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
  @media (max-width: 480px) {
    .cb-corner { left: 8px; right: 8px; bottom: 8px; max-width: none; }
    .cb-buttons { width: 100%; }
    .cb button { flex: 1; }
  }
`;

const safeUrl = (value) => (typeof value === "string" && /^(https?:\/\/|\/)/i.test(value) ? value : "");

// answer(granted) is called once, when the visitor clicks a button.
export function renderBanner(b, answer) {
  document.getElementById("analytics-consent-banner")?.remove();
  const host = document.createElement("div");
  host.id = "analytics-consent-banner";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${css(b)}</style>
    <div class="cb ${b.position === "corner" ? "cb-corner" : "cb-bar"}" role="dialog" aria-label="Cookie consent">
      <p></p>
      <div class="cb-buttons"><button type="button" data-cb="decline"></button><button type="button" data-cb="accept"></button></div>
    </div>`;
  const text = root.querySelector("p");
  text.textContent = `${b.text || ""} `;
  const policy = safeUrl(b.policyUrl);
  if (policy) {
    const link = document.createElement("a");
    link.href = policy;
    link.textContent = b.policyLabel || "Cookie policy";
    text.append(link);
  }
  root.querySelector('[data-cb="accept"]').textContent = b.accept || "Accept";
  root.querySelector('[data-cb="decline"]').textContent = b.decline || "Decline";
  root.querySelector(".cb-buttons").addEventListener("click", (event) => {
    const choice = event.target.closest("button")?.getAttribute("data-cb");
    if (!choice) return;
    host.remove();
    answer(choice === "accept");
  });
  document.body.append(host);
}
