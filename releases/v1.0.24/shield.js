// Spam protection (sites that turn it on). Loaded by the tracker only then.
// On the visitor's first interaction it fetches a challenge and finds the
// number that answers it, in short slices so the page never stutters. The
// answer goes out with what the visitor did (typed, used a pointer, ticked
// the box), whether the browser is automated, and whether a hidden trap field
// was filled. Protected forms get the answer in a hidden "analytics-shield"
// field, for the site's server to check with POST /shield/verify.
// In "checkbox" mode each protected form also shows "I'm not a robot": one
// click, no puzzles.
// Our own login and sign-up pages use a copy: frontend/src/lib/shield.js.

// SHA-256 of a short ASCII text (one block), first 32 bits only: all the
// proof of work needs.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const W = new Uint32Array(64);
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

export function sha256FirstWord(text) {
  W.fill(0, 0, 16);
  for (let i = 0; i < text.length; i++) W[i >> 2] |= text.charCodeAt(i) << (24 - (i & 3) * 8);
  W[text.length >> 2] |= 0x80 << (24 - (text.length & 3) * 8);
  W[15] = text.length * 8;
  for (let i = 16; i < 64; i++) {
    const x = W[i - 15];
    const y = W[i - 2];
    W[i] = (W[i - 16] + (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) + W[i - 7] + (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10))) | 0;
  }
  let a = 0x6a09e667, b = 0xbb67ae85, c = 0x3c6ef372, d = 0xa54ff53a;
  let e = 0x510e527f, f = 0x9b05688c, g = 0x1f83d9ab, h = 0x5be0cd19;
  for (let i = 0; i < 64; i++) {
    const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
    const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    h = g; g = f; f = e; e = (d + t1) | 0;
    d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  return (a + 0x6a09e667) >>> 0;
}

const SLICE = 20000;
const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

async function solve(challenge, bits) {
  const nonce = JSON.parse(atob(challenge.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"))).n;
  const shift = 32 - bits;
  for (let x = 0; ; x++) {
    if (sha256FirstWord(`${nonce}:${x}`) >>> shift === 0) return String(x);
    if (x % SLICE === SLICE - 1) await pause();
  }
}

// The server refuses answers sent sooner than this after the challenge
// (shieldCore.js MIN_FILL_MS, plus a margin); a quick visitor waits instead.
const MIN_WAIT_MS = 1700;

const b64 = (text) => btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const BOX_CSS = `
  :host { all: initial; display: block; margin: 8px 0; }
  label {
    display: inline-flex; align-items: center; gap: 10px; box-sizing: border-box; min-width: 220px; padding: 10px 14px;
    border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; color: #111827; cursor: pointer;
    font: 14px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  label.nudge { border-color: #dc2626; }
  input { width: 18px; height: 18px; margin: 0; cursor: pointer; }
  .state { width: 18px; height: 18px; display: none; }
  .busy input, .done input { display: none; }
  .busy .spin { display: block; border: 2px solid #d1d5db; border-top-color: #2563eb; border-radius: 50%; animation: s .7s linear infinite; box-sizing: border-box; }
  .done .tick { display: block; color: #16a34a; font-weight: 700; text-align: center; line-height: 18px; }
  @keyframes s { to { transform: rotate(360deg); } }
  @media (prefers-color-scheme: dark) { label { background: #1f2937; color: #f9fafb; border-color: #4b5563; } }
`;

// mode: "invisible" or "checkbox"; fetchChallenge() -> Promise<{ challenge, bits }>.
// session() -> the visit's session ID (or ""), so what /shield/verify flags
// links to its replay.
export function createShield({ mode, fetchChallenge, session = () => "" }) {
  const signals = { k: 0, p: 0, c: 0, h: 0, wd: navigator.webdriver === true ? 1 : 0 };
  const traps = new Set();
  const fields = new Set();
  const boxes = new Set();
  let pending = null;
  let solved = null;
  let received = 0;

  document.addEventListener("keydown", (e) => { if (e.isTrusted) signals.k++; }, { capture: true, passive: true });
  document.addEventListener("pointerdown", (e) => { if (e.isTrusted) signals.p++; }, { capture: true, passive: true });

  const answerNow = () => {
    if (!solved) return "";
    signals.h = [...traps].some((t) => t.value) ? 1 : 0;
    const sid = session();
    if (sid) signals.s = sid;
    else delete signals.s;
    return `${solved.challenge}.${solved.solution}.${b64(JSON.stringify(signals))}`;
  };
  const refresh = () => {
    const answer = answerNow();
    for (const field of fields) field.value = answer;
  };
  const showBoxes = () => {
    for (const box of boxes) box.label.className = box.ticked ? (solved ? "done" : "busy") : box.nudged ? "nudge" : "";
  };
  // Milliseconds until the answer can be sent (Infinity while it's being found).
  const readyIn = () => (solved ? Math.max(0, received + MIN_WAIT_MS - Date.now()) : Infinity);

  function start() {
    pending ||= fetchChallenge()
      .then(async ({ challenge, bits }) => {
        received = Date.now();
        solved = { challenge, solution: await solve(challenge, bits) };
        refresh();
        showBoxes();
        return solved;
      })
      .catch(() => {
        // Tried again on the next submit.
        pending = null;
        return null;
      });
    return pending;
  }

  // The answer for one submission; the next one gets a new challenge. Form
  // fields keep this answer until then, as the browser reads them after.
  function consume() {
    const answer = answerNow();
    solved = null;
    pending = null;
    showBoxes();
    start();
    return answer;
  }
  const take = async () => {
    await start();
    const wait = readyIn();
    if (wait > 0 && wait !== Infinity) await new Promise((resolve) => setTimeout(resolve, wait));
    return consume();
  };

  function box() {
    const host = document.createElement("div");
    host.setAttribute("data-noanalytics", "");
    host.setAttribute("data-analytics-ignore", "");
    const root = host.attachShadow({ mode: "open" });
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    const spin = document.createElement("span");
    spin.className = "state spin";
    spin.setAttribute("aria-hidden", "true");
    const tick = document.createElement("span");
    tick.className = "state tick";
    tick.setAttribute("aria-hidden", "true");
    tick.textContent = "✓";
    const text = document.createElement("span");
    text.textContent = "I'm not a robot";
    label.append(input, spin, tick, text);
    const style = document.createElement("style");
    style.textContent = BOX_CSS;
    root.append(style, label);
    const entry = { host, label, ticked: false, nudged: false };
    input.addEventListener("change", (e) => {
      if (!e.isTrusted || !input.checked) return;
      signals.c = 1;
      entry.ticked = true;
      entry.nudged = false;
      showBoxes();
      start();
      refresh();
    });
    boxes.add(entry);
    showBoxes();
    return host;
  }

  // A protected form: the answer field, the trap and, in checkbox mode, the box.
  function protect(form) {
    if (form.querySelector("input[name='analytics-shield']")) return;
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = "analytics-shield";
    field.value = answerNow();
    fields.add(field);
    // People never see or reach this; form-filling bots fill it.
    const trap = document.createElement("input");
    trap.type = "text";
    trap.name = `contact_${Math.random().toString(36).slice(2, 7)}`;
    trap.tabIndex = -1;
    trap.autocomplete = "off";
    trap.setAttribute("aria-hidden", "true");
    trap.setAttribute("data-analytics-ignore", "");
    trap.style.cssText = "position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0;";
    traps.add(trap);
    form.append(field, trap);
    if (mode !== "checkbox") return;
    const spot = form.querySelector("[data-analytics-shield-box]");
    const button = form.querySelector("button:not([type]),[type=submit]");
    const el = box();
    if (spot) spot.append(el);
    else if (button) button.before(el);
    else form.append(el);
  }

  // A trap inside the lead form widget (its own shadow root).
  const watchTrap = (input) => traps.add(input);

  // Boxes inside scope (a form), or all of them.
  const boxesIn = (scope) => [...boxes].filter((b) => !scope || scope.contains(b.host));
  function nudge(scope) {
    for (const b of boxesIn(scope)) b.nudged = true;
    showBoxes();
  }
  // Each form's own box must be ticked; a form without one (added before
  // checkbox mode was turned on) goes by any box on the page.
  function ticked(scope) {
    if (mode !== "checkbox") return true;
    const own = boxesIn(scope);
    return own.length ? own.some((b) => b.ticked) : signals.c === 1;
  }

  return {
    mode,
    start,
    take,
    consume,
    box,
    protect,
    watchTrap,
    nudge,
    answerNow,
    readyIn,
    ticked,
  };
}
