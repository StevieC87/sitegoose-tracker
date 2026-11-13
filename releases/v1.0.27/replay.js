// Session replay recorder. Loaded by the tracker only for sessions the
// collector picked for recording, so other visitors never download it.
//
// Each page load is recorded as a list of timestamped events: a full snapshot
// first (the same masked, script-free HTML as heatmap snapshots, with a
// data-nid on every element), then page changes that refer to those ids,
// plus mouse, scroll, resize and input events. Typed text is never recorded,
// only how many characters a field holds. Events are uploaded in gzipped
// batches every few seconds and when the page is hidden.
//
// Nothing is uploaded until the visit qualifies: it lasted the site's minimum
// duration and, when the site set triggers, met one: reached a trigger page,
// fired a trigger event, or rage-clicked (3 clicks within a second, close
// together). Events and rage clicks are also marked on the replay timeline. Until
// then events stay in memory, and pages the visitor leaves are kept in this
// tab's sessionStorage, so the upload after qualifying includes the lead-up.
// Qualifying counts the visit against the site's monthly quota; visits that
// never qualify send nothing.
//
// A feedback report qualifies the visit at once (report()), so what led up to
// it is uploaded. Visits the site didn't sample can still be kept in memory
// for that, when a feedback button asks for its lead-up (feedbackOnly): they
// qualify only through a report, and send nothing otherwise.
//
// Recording pauses while the tab is hidden (pages that update themselves
// would otherwise record nobody watching) and resumes with a fresh snapshot.
// After 30 minutes without visitor input it stops: page changes alone do not
// keep a recording going.
import { createSerializer } from "./snapshot.js";

const FLUSH_MS = 5000;
const SAMPLE_MS = 100;
// Upload early when a batch grows past this many characters.
const BATCH_CHARS = 1000000;
// keepalive requests (sent while the page unloads) are limited to 64 KB.
const KEEPALIVE_BYTES = 60000;
const MAX_PAGE_MS = 60 * 60 * 1000;
// The same as the analytics session timeout.
const INACTIVE_MS = 30 * 60 * 1000;
// Rage click: this many clicks within RAGE_MS and RAGE_PX of each other.
const RAGE_CLICKS = 3;
const RAGE_MS = 1000;
const RAGE_PX = 30;
// Before qualifying: per page in memory, and all left pages in sessionStorage.
const BUFFER_CHARS = 3000000;
const STORED_CHARS = 3000000;

// "/blog/*" matches everything under /blog; other patterns match one path.
function matchesPath(path, patterns) {
  const clean = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p).toLowerCase();
  const target = clean(path);
  return patterns.some((pattern) => {
    const p = String(pattern).trim().toLowerCase();
    if (!p) return false;
    return p.endsWith("*") ? target.startsWith(p.slice(0, -1)) : target === clean(p);
  });
}

const uuid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

async function gzip(text) {
  return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
}

// A short label for the journey timeline: the clicked control's own text, or
// a field's name. Masked like the snapshot (data-noanalytics, contenteditable,
// strict mode); emails and long numbers are always hidden.
const CONTROL = "a,button,input,select,textarea,label,summary,[role=button],[role=link],[role=tab],[role=menuitem]";
function journeyLabel(el, masked) {
  const text = (
    el.getAttribute?.("aria-label") || el.getAttribute?.("title") || el.getAttribute?.("alt") ||
    (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT"
      ? el.getAttribute("placeholder") || el.getAttribute("name") || el.type
      : el.innerText) || ""
  ).replace(/\s+/g, " ").trim().slice(0, 60);
  if (!text) return "";
  if (masked) return text.replace(/\S/g, "•");
  return text.replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, "•••").replace(/\d[\d -]{6,}\d/g, "•••");
}

const eventChars = (e) => (e.html?.length || e.css?.length || 0) + 40;

function readJson(key, fallback) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function startRecording({
  collectUrl, token, masking = "balanced", excludedPaths = [],
  minDuration = 0, pageTriggers = [], eventTriggers = [], rageTrigger = false, feedbackOnly = false, stateKey,
}) {
  const hasTriggers = feedbackOnly || pageTriggers.length > 0 || eventTriggers.length > 0 || rageTrigger;
  // Per session: { since, triggered, reported, qualified, rejected }.
  const state = { since: Date.now(), triggered: false, qualified: false, rejected: false, ...readJson(stateKey, {}) };
  if (state.rejected) return { stop() {} };
  const pagesKey = `${stateKey}:pages`;
  const saveState = () => writeJson(stateKey, state);
  const ids = new WeakMap();
  const serializer = createSerializer({ masking, ids });
  const pageId = uuid();
  const startedAt = Date.now();
  const pagePath = location.pathname;
  let qualifying = false;
  let seq = 0;
  let events = [];
  let chars = 0;
  // Excluded page, or tab hidden: nothing but the resume is recorded.
  let paused = false;
  let hidden = document.visibilityState === "hidden";
  let stopped = false;
  let lastInput = Date.now();
  const idle = () => paused || hidden;
  let path = location.pathname;
  const timers = [];
  const listeners = [];

  const emit = (event, size = 40) => {
    if (stopped) return;
    event.t = Date.now() - startedAt;
    events.push(event);
    chars += size;
    if (state.qualified) {
      if (chars > BATCH_CHARS) flush(false);
    } else if (chars > BUFFER_CHARS) {
      // Not qualified yet: keep the newest snapshot and what followed it.
      const last = events.findLastIndex((e) => e.k === "full");
      if (last > 0) {
        events = events.slice(last);
        chars = events.reduce((sum, e) => sum + eventChars(e), 0);
      }
      if (chars > BUFFER_CHARS * 2) stop();
    }
    if (event.t > MAX_PAGE_MS) stop();
  };

  // Keeps this page's unsent events for the next page of the visit.
  function storePage() {
    const pages = readJson(pagesKey, []).filter((page) => page.pageId !== pageId);
    pages.push({ pageId, startedAt, path: pagePath, events });
    while (pages.length && JSON.stringify(pages).length > STORED_CHARS) pages.shift();
    writeJson(pagesKey, pages);
  }

  async function upload(batch, page, final) {
    const url = new URL("replay", collectUrl);
    url.searchParams.set("token", token);
    url.searchParams.set("page", page.pageId);
    url.searchParams.set("seq", page.seq);
    url.searchParams.set("started", page.startedAt);
    url.searchParams.set("path", page.path);
    const json = JSON.stringify(batch);
    // While the page unloads there is no time to compress: small final
    // batches go uncompressed with keepalive; larger ones are best effort.
    const body = final && json.length < KEEPALIVE_BYTES ? json : await gzip(json);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        credentials: "omit",
        body,
        keepalive: final && (typeof body === "string" ? body.length : body.size) < KEEPALIVE_BYTES,
      });
      // Over the session's size limit, or the token expired: stop recording.
      if (response.status === 403 || response.status === 413) stop();
    } catch { /* lost batch; recording continues */ }
  }

  async function flush(final) {
    if (!events.length) return;
    if (!state.qualified) {
      if (final) storePage();
      return;
    }
    const batch = events;
    events = [];
    chars = 0;
    await upload(batch, { pageId, seq: seq++, startedAt, path }, final);
  }

  // Counted against the quota once the visit meets the site's rules; then
  // earlier pages of the visit and this page's buffer are uploaded.
  async function maybeQualify() {
    if (state.qualified || qualifying || stopped) return;
    // A feedback report doesn't wait for the minimum duration.
    if (!state.triggered || (!state.reported && Date.now() - state.since < minDuration * 1000)) return;
    qualifying = true;
    let ok = false;
    try {
      const url = new URL("replay/qualify", collectUrl);
      url.searchParams.set("token", token);
      const response = await fetch(url, { method: "POST", credentials: "omit" });
      ok = response.ok;
      if (!ok && response.status === 403) {
        state.rejected = true;
        saveState();
      }
    } catch { /* tried again on the next check */ }
    qualifying = false;
    if (!ok) {
      if (state.rejected) {
        writeJson(pagesKey, []);
        stop();
      }
      return;
    }
    state.qualified = true;
    saveState();
    const earlier = readJson(pagesKey, []).filter((page) => page.pageId !== pageId);
    writeJson(pagesKey, []);
    for (const page of earlier) {
      if (page.events?.length) await upload(page.events, { ...page, seq: 0 }, false);
    }
    flush(false);
  }

  // Any trigger anywhere in the visit qualifies it (with the duration).
  function trigger() {
    if (state.triggered) return;
    state.triggered = true;
    saveState();
  }
  // The visitor sent a feedback report: marked on the timeline, and the visit
  // (with its lead-up) is uploaded.
  function report() {
    if (stopped) return;
    emit({ k: "ev", n: "feedback sent" });
    state.triggered = true;
    state.reported = true;
    saveState();
    maybeQualify();
  }
  function checkTrigger(next) {
    if (!hasTriggers || matchesPath(next, pageTriggers)) trigger();
  }
  function onNamedEvent(name) {
    const lower = String(name || "").toLowerCase();
    if (!lower || idle()) return;
    emit({ k: "ev", n: lower.slice(0, 100) });
    if (eventTriggers.includes(lower)) trigger();
  }
  const recentClicks = [];
  function checkRage(x, y) {
    const now = Date.now();
    recentClicks.push({ x, y, at: now });
    while (recentClicks.length && now - recentClicks[0].at > RAGE_MS) recentClicks.shift();
    const near = recentClicks.filter((c) => Math.abs(c.x - x) <= RAGE_PX && Math.abs(c.y - y) <= RAGE_PX);
    if (near.length < RAGE_CLICKS) return;
    recentClicks.length = 0;
    emit({ k: "rage", x, y });
    if (rageTrigger) trigger();
  }

  function full() {
    const doc = serializer.document();
    if (!doc) {
      stop();
      return;
    }
    emit({
      k: "full",
      html: doc.html,
      w: window.innerWidth,
      h: window.innerHeight,
      // Width taken by a classic scrollbar (0 on phones and overlay scrollbars).
      sb: Math.max(0, window.innerWidth - document.documentElement.clientWidth),
      sx: Math.round(window.scrollX),
      sy: Math.round(window.scrollY),
      url: location.pathname,
    }, doc.html.length);
    flush(false);
  }

  // ---- Page changes ----
  const dirty = new Set();
  const dirtyStyles = new Set();
  let styleTimer = 0;

  function hasDirtyAncestor(el) {
    for (let node = el.parentElement; node; node = node.parentElement) {
      if (dirty.has(node)) return true;
    }
    return false;
  }

  // The next element sibling the player already knows, to insert before.
  function knownNextSibling(node) {
    for (let next = node.nextElementSibling; next; next = next.nextElementSibling) {
      const id = ids.get(next);
      if (id) return id;
    }
    return 0;
  }

  function onMutations(records) {
    if (idle() || stopped) return;
    for (const r of records) {
      if (r.type === "childList") {
        const parent = r.target;
        if (!ids.has(parent)) continue; // inside a new subtree, sent with it
        const textChange = [...r.addedNodes, ...r.removedNodes].some((n) => n.nodeType === 3);
        if (textChange || parent.tagName === "STYLE") {
          dirty.add(parent);
          continue;
        }
        for (const node of r.removedNodes) {
          const id = node.nodeType === 1 && ids.get(node);
          if (id) emit({ k: "rm", id });
        }
        for (const node of r.addedNodes) {
          if (node.nodeType !== 1 || !node.isConnected || node.parentElement !== parent) continue;
          const html = serializer.node(node);
          if (html) emit({ k: "add", p: ids.get(parent), b: knownNextSibling(node), html }, html.length);
        }
      } else if (r.type === "characterData") {
        const parent = r.target.parentElement;
        if (parent && ids.has(parent)) dirty.add(parent);
      } else if (r.type === "attributes") {
        const el = r.target;
        const id = ids.get(el);
        if (!id || !el.isConnected) continue;
        emit({ k: "attr", id, n: r.attributeName, v: serializer.attribute(el, r.attributeName) });
      }
    }
    for (const el of dirty) {
      if (!el.isConnected || hasDirtyAncestor(el)) continue;
      if (el.tagName === "STYLE") {
        const css = serializer.styleContent(el);
        emit({ k: "css", id: ids.get(el), css }, css.length);
      } else {
        const html = serializer.children(el);
        if (html !== null) emit({ k: "html", id: ids.get(el), html }, html.length);
      }
    }
    dirty.clear();
  }

  // CSS-in-JS libraries add rules with insertRule, which no MutationObserver
  // sees; the owning <style> is sent again shortly after.
  function onStyleRule(sheet) {
    const owner = sheet?.ownerNode;
    if (!owner || !ids.has(owner) || idle() || stopped) return;
    dirtyStyles.add(owner);
    if (styleTimer) return;
    styleTimer = setTimeout(() => {
      styleTimer = 0;
      for (const el of dirtyStyles) {
        const css = serializer.styleContent(el);
        emit({ k: "css", id: ids.get(el), css }, css.length);
      }
      dirtyStyles.clear();
    }, 50);
  }
  const proto = globalThis.CSSStyleSheet?.prototype;
  const patched = {};
  for (const name of ["insertRule", "deleteRule"]) {
    const original = proto?.[name];
    if (typeof original !== "function") continue;
    patched[name] = original;
    proto[name] = function patchedRule(...args) {
      const result = original.apply(this, args);
      try {
        onStyleRule(this);
      } catch { /* never break the page */ }
      return result;
    };
  }

  const observer = new MutationObserver(onMutations);

  // ---- Visitor activity ----
  const on = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push([target, type, handler, options]);
  };
  let pointer = null;
  let pointerTarget = null;
  let lastSent = null;
  const scrolled = new Set();

  const active = () => { lastInput = Date.now(); };
  on(document, "mousemove", (e) => { pointer = [e.clientX, e.clientY]; pointerTarget = e.target; active(); }, { passive: true, capture: true });
  on(document, "touchstart", (e) => {
    const t = e.touches?.[0];
    if (t) {
      pointer = [t.clientX, t.clientY];
      pointerTarget = document.elementFromPoint(t.clientX, t.clientY) || t.target;
    }
    active();
  }, { passive: true, capture: true });
  on(document, "touchmove", (e) => {
    const t = e.touches?.[0];
    if (t) {
      pointer = [t.clientX, t.clientY];
      pointerTarget = document.elementFromPoint(t.clientX, t.clientY) || t.target;
    }
    active();
  }, { passive: true, capture: true });
  on(document, "keydown", active, { passive: true, capture: true });
  // The recorded element under the pointer and the pointer's offset inside it,
  // so the player puts the pointer on the same spot even when the replayed
  // layout differs (fonts, scrollbars, viewport units).
  function anchor(target, x, y) {
    let el = target?.nodeType === 1 ? target : target?.parentElement;
    while (el && !ids.has(el)) el = el.parentElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    const r = el.getBoundingClientRect();
    // Offsets inside page-sized wrappers drift as much as raw coordinates.
    if (r.height > window.innerHeight) return null;
    return { id: ids.get(el), ox: Math.round(x - r.left), oy: Math.round(y - r.top) };
  }

  const pointerEvent = (k, x, y, target) => ({ k, x: Math.round(x), y: Math.round(y), ...anchor(target, x, y) });

  // Sends pointer and scroll positions that changed since the last sample.
  function sample() {
    if (pointer && (!lastSent || pointer[0] !== lastSent[0] || pointer[1] !== lastSent[1])) {
      emit(pointerEvent("m", pointer[0], pointer[1], pointerTarget));
      lastSent = pointer;
    }
    for (const target of scrolled) {
      if (target === window) {
        emit({ k: "s", x: Math.round(window.scrollX), y: Math.round(window.scrollY) });
      } else {
        const id = ids.get(target);
        if (id) emit({ k: "s", id, x: Math.round(target.scrollLeft), y: Math.round(target.scrollTop) });
      }
    }
    scrolled.clear();
  }

  on(document, "click", (e) => {
    active();
    if (idle()) return;
    // A scroll just before the click must be replayed before it, or the click
    // lands against the old scroll position.
    pointer = [e.clientX, e.clientY];
    pointerTarget = e.target;
    sample();
    const x = Math.round(e.clientX);
    const y = Math.round(e.clientY);
    const control = e.target?.closest?.(CONTROL) || e.target;
    const label = control?.nodeType === 1
      ? journeyLabel(control, masking === "strict" || serializer.maskedContext(control))
      : "";
    const click = pointerEvent("c", x, y, control || e.target);
    emit(label ? { ...click, l: label } : click);
    checkRage(x, y);
    // Tracked clicks (data-analytics-event) count as events.
    const tracked = e.target?.closest?.("[data-analytics-event]");
    if (tracked) onNamedEvent(tracked.dataset.analyticsEvent || "click");
  }, true);
  // Custom events sent with the tracker's "analytics-event", and automatic
  // events ("Click: Sign up") announced by the tracker as "analytics-auto".
  on(document, "analytics-event", (e) => {
    const detail = e.detail || {};
    onNamedEvent(detail.eventname || detail.name || detail.type || "custom");
  });
  on(document, "analytics-auto", (e) => onNamedEvent(e.detail?.eventname));
  on(document, "scroll", (e) => {
    scrolled.add(e.target === document ? window : e.target);
    active();
  }, { passive: true, capture: true });
  on(window, "resize", () => {
    if (!idle()) emit({ k: "r", w: window.innerWidth, h: window.innerHeight });
  });
  // Field contents are never recorded: only their length, or a checked or
  // selected state.
  const onField = (e) => {
    const el = e.target;
    const id = ids.get(el);
    active();
    if (!id || idle()) return;
    const type = (el.type || "").toLowerCase();
    if (type === "checkbox" || type === "radio") emit({ k: "check", id, v: el.checked });
    else if (el.tagName === "SELECT") emit({ k: "sel", id, v: el.selectedIndex });
    else if ("value" in el) {
      // The field's name for the timeline (never its contents).
      const field = journeyLabel(el, masking === "strict" || serializer.maskedContext(el));
      emit(field ? { k: "input", id, n: String(el.value || "").length, f: field } : { k: "input", id, n: String(el.value || "").length });
    }
  };
  on(document, "input", onField, true);
  on(document, "change", onField, true);

  // Pointer and scroll are sampled; route changes are noticed here too.
  timers.push(setInterval(() => {
    if (stopped) return;
    if (location.pathname !== path) navigate(location.pathname);
    if (idle()) return;
    maybeQualify();
    // Nothing more is sent, so the visit's length ends at the last input.
    if (Date.now() - lastInput > INACTIVE_MS) {
      stop();
      return;
    }
    sample();
  }, SAMPLE_MS));
  timers.push(setInterval(() => flush(false), FLUSH_MS));

  // Single-page apps change route without a page load.
  function navigate(next) {
    path = next;
    checkTrigger(next);
    const excluded = matchesPath(next, excludedPaths);
    emit({ k: "nav", url: next, excluded });
    if (excluded) {
      paused = true;
    } else if (paused) {
      paused = false;
      if (!hidden) full();
    }
  }

  // Hidden: send what we have and stop recording. Visible again: the page may
  // have changed meanwhile, so recording restarts from a fresh snapshot.
  const onVisibility = () => {
    if (stopped) return;
    if (document.visibilityState === "hidden") {
      if (hidden) return;
      hidden = true;
      emit({ k: "hidden" });
      flush(true);
    } else if (hidden) {
      hidden = false;
      lastInput = Date.now();
      emit({ k: "visible" });
      if (!paused) full();
    }
  };
  on(document, "visibilitychange", onVisibility);
  on(window, "pagehide", () => flush(true));

  function stop() {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    for (const timer of timers) clearInterval(timer);
    clearTimeout(styleTimer);
    for (const [target, type, handler, options] of listeners) target.removeEventListener(type, handler, options);
    for (const [name, original] of Object.entries(patched)) proto[name] = original;
  }

  saveState();
  checkTrigger(path);
  if (matchesPath(path, excludedPaths)) {
    paused = true;
    emit({ k: "nav", url: path, excluded: true });
  } else if (hidden) {
    // Opened in a background tab: the snapshot is taken when it is shown.
    emit({ k: "hidden" });
  } else {
    full();
  }
  if (!stopped) {
    observer.observe(document.documentElement, {
      subtree: true, childList: true, attributes: true, characterData: true,
    });
  }
  return { stop, report };
}
