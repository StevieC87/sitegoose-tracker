// Share buttons a site puts on its own pages. Loaded by the tracker only when a
// page has a [data-share] element, so sites that don't use them download nothing.
//
//   <div data-share></div>                          the page itself
//   <div data-share="facebook,x,whatsapp"></div>    only these buttons
//   <div data-share data-share-url="https://shop.example.com/blue-shirt"
//        data-share-title="Blue shirt" data-share-label="Blue shirt"></div>
//
// Anything with an address can be shared this way, including one product, one
// post or one image on a page full of them: give each its own data-share-url,
// and data-share-label names it in the report.
//
// The address people share always carries campaign tags, so the visits it
// brings back are counted against the thing that was shared and not written
// off as "direct". The click itself is sent as a "share" event, which is how
// a share that nobody follows is still counted.
//
// The ::part() names box (the row) and button are a promise to every site that
// styles them: never rename one. The element is the site's own, so its own
// class names are how a site singles one row out.
//
// renderShareButtons(host, options, hooks) -> remove()
//   options: { platforms, url, title, label }
//   hooks:   { shared(platform, link) }

const FONT = 'font: 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;';

// What each button does with the address. `window` is false where a share is
// not a page we open (copying, or handing over to the mail program).
export const PLATFORMS = {
  facebook: { name: "Facebook", medium: "social", url: (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  x: { name: "X", medium: "social", url: (u, t) => `https://twitter.com/intent/tweet?url=${u}${t ? `&text=${t}` : ""}` },
  linkedin: { name: "LinkedIn", medium: "social", url: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  whatsapp: { name: "WhatsApp", medium: "social", url: (u, t) => `https://api.whatsapp.com/send?text=${t ? `${t}%20` : ""}${u}` },
  telegram: { name: "Telegram", medium: "social", url: (u, t) => `https://t.me/share/url?url=${u}${t ? `&text=${t}` : ""}` },
  reddit: { name: "Reddit", medium: "social", url: (u, t) => `https://www.reddit.com/submit?url=${u}${t ? `&title=${t}` : ""}` },
  pinterest: { name: "Pinterest", medium: "social", url: (u, t) => `https://pinterest.com/pin/create/button/?url=${u}${t ? `&description=${t}` : ""}` },
  email: { name: "Email", medium: "email", window: false, url: (u, t) => `mailto:?subject=${t || ""}&body=${u}` },
  // A link copied and sent privately — the share nobody can otherwise see.
  copy: { name: "Copy link", medium: "link", window: false },
};
const DEFAULT = ["facebook", "x", "whatsapp", "linkedin", "copy"];
export const PLATFORM_KEYS = Object.keys(PLATFORMS);

// The same shape of tag the dashboard's saved links use, so both are read the
// same way: lowercase, underscores for spaces, nothing needing URL escaping.
// Separators become underscores rather than vanishing: the default label for a
// button is the page's path, so deleting "/" would turn /shop/red and /shopred
// into the same tag and merge two different things in the report.
export const cleanTag = (value) => String(value ?? "").trim().toLowerCase()
  .replace(/[^a-z0-9_.-]+/g, "_")
  .replace(/_+/g, "_")
  .replace(/^_+|_+$/g, "")
  .slice(0, 100)
  .replace(/_+$/, "");

// Ad click IDs: they name the click that brought this visitor, not a share.
const CLICK_IDS = ["gclid", "gbraid", "wbraid", "dclid", "fbclid", "msclkid", "ttclid", "twclid", "li_fat_id", "yclid", "igshid", "mc_cid", "mc_eid", "_gl"];

// The shadow root's styles as a constructed sheet, which a site's
// Content-Security-Policy style-src doesn't block (a <style> here would be,
// leaving everything unstyled); a <style> where that isn't supported. Either
// way, set .textContent to restyle.
function shadowStyle(root, text = "") {
  try {
    if (!(root instanceof ShadowRoot)) throw new Error("no shadow root");
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return { set textContent(value) { sheet.replaceSync(value); } };
  } catch {
    const style = document.createElement("style");
    style.textContent = text;
    root.append(style);
    return style;
  }
}

// The address to share, tagged so the visits it brings back are attributed.
// Tags already on an address the site gave are left alone: the site meant
// them. On the page's own address they are how this visitor arrived (often
// from an earlier share), so they are dropped, with any ad click ID, before
// the share's own tags go on.
export function taggedUrl(raw, platform, label) {
  try {
    const url = new URL(raw, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.href === new URL(window.location.href).href) {
      for (const key of [...url.searchParams.keys()]) {
        if (key.toLowerCase().startsWith("utm_") || CLICK_IDS.includes(key.toLowerCase())) url.searchParams.delete(key);
      }
    }
    if (!url.searchParams.has("utm_source")) url.searchParams.set("utm_source", platform);
    if (!url.searchParams.has("utm_medium")) url.searchParams.set("utm_medium", PLATFORMS[platform]?.medium || "social");
    if (!url.searchParams.has("utm_campaign")) url.searchParams.set("utm_campaign", "share_button");
    const content = cleanTag(label);
    if (content && !url.searchParams.has("utm_content")) url.searchParams.set("utm_content", content);
    return url.toString();
  } catch {
    return "";
  }
}

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

const CSS = `
.sb { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; ${FONT} }
.sb button {
  ${FONT} cursor: pointer; border: 1px solid #d7dbe0; background: #fff; color: #1f2937;
  border-radius: 999px; padding: 6px 12px; line-height: 1.4;
}
.sb button:hover { background: #f3f4f6; }
.sb button:focus-visible { outline: 2px solid #0e8fc0; outline-offset: 2px; }
.sb .done { color: #15803d; border-color: #15803d; }
@media (prefers-color-scheme: dark) {
  .sb button { background: #111827; color: #e5e7eb; border-color: #374151; }
  .sb button:hover { background: #1f2937; }
}
`;

export function renderShareButtons(host, options = {}, hooks = {}) {
  const chosen = (Array.isArray(options.platforms) ? options.platforms : DEFAULT)
    .map((key) => String(key).trim().toLowerCase()).filter((key) => PLATFORMS[key]);
  const platforms = chosen.length ? [...new Set(chosen)] : DEFAULT;
  const title = String(options.title || "").slice(0, 200);
  const label = options.label || options.url || "";

  const root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  shadowStyle(root, `:host { all: initial; } ${CSS}`);
  const row = el("div", { class: "sb", part: "box", role: "group", "aria-label": "Share this" });

  for (const key of platforms) {
    const platform = PLATFORMS[key];
    const button = el("button", {
      type: "button",
      part: "button",
      "aria-label": key === "copy" ? "Copy link" : `Share on ${platform.name}`,
      text: platform.name,
    });
    button.addEventListener("click", async () => {
      const link = taggedUrl(options.url || window.location.href, key, label);
      if (!link) return;
      if (key === "copy") {
        try {
          await navigator.clipboard.writeText(link);
          button.textContent = "Copied";
          button.classList.add("done");
          setTimeout(() => { button.textContent = platform.name; button.classList.remove("done"); }, 1500);
        } catch {
          // Copying can be refused; the share is still worth counting.
        }
      } else {
        const target = platform.url(encodeURIComponent(link), encodeURIComponent(title));
        if (platform.window === false) window.location.href = target;
        else window.open(target, "_blank", "noopener,noreferrer,width=600,height=520");
      }
      try { hooks.shared?.(key, link); } catch { /* counting must never break sharing */ }
    });
    row.append(button);
  }
  root.append(row);
  return () => { row.remove(); };
}
