// The whole tracker runs inside this one function, so none of its names
// become globals on the site's page, where a site script declaring the same
// name (nav, data, track…) would stop one of the two from running. Its API is
// window.analytics. The body is deliberately not indented.
(() => {
// Session IDs are scoped to this site and expire after 30 minutes of inactivity.
// `storeFor` says where this visitor's ID may live. Only one kept on the device
// outlasts the page, so any other starts with zeros, which tells the collector to
// swap it for the visit's real ID (utils/visitSession.js).
function createAnalyticsSession(siteId, environment = window, storeFor = () => environment.localStorage) {
  const key = `analytics:session:${siteId}`;
  const timeout = 30 * 60 * 1000;
  const validId = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  let memory = null;
  let oldCopyGone = false;
  function newId() {
    if (environment.crypto?.randomUUID) return environment.crypto.randomUUID();
    if (!environment.crypto?.getRandomValues) return "";
    const bytes = environment.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return {
    getId() {
      if (!siteId) return "";
      const now = Date.now();
      let session = memory;
      let store = null;
      try {
        store = storeFor();
        const stored = store.getItem(key);
        if (stored) session = JSON.parse(stored);
      } catch { /* In-memory tracking remains available when storage is blocked. */ }
      let onDevice = false;
      try { onDevice = store === environment.localStorage; } catch { /* blocked: nothing lasts */ }
      // Older trackers left this on the device whatever the visitor had said.
      if (!onDevice && !oldCopyGone) {
        oldCopyGone = true;
        try { environment.localStorage.removeItem(key); } catch { /* optional storage */ }
      }
      if (!validId(session?.id) || !Number.isFinite(session?.lastActivity) ||
        now < session.lastActivity || now - session.lastActivity >= timeout) {
        session = { id: onDevice ? newId() : newId().replace(/^.{8}/, "00000000"), lastActivity: now };
      }
      session.lastActivity = now;
      memory = session;
      try { store?.setItem(key, JSON.stringify(session)); } catch { /* optional storage */ }
      return session.id;
    },
    // The ID the collector gave a tab it records (sessionReplay.js).
    adopt(id) {
      if (!validId(id)) return;
      memory = { id, lastActivity: Date.now() };
      try { storeFor().setItem(key, JSON.stringify(memory)); } catch { /* optional storage */ }
    },
  };
}

const nav = performance.getEntriesByType("navigation")[0];

let data;
let hasTrackedInitial = false;
let lastTrackedPath = "";
// Set as soon as a page's pageview starts, before it waits for metrics, so a
// route change during that wait is neither dropped nor tracked twice.
// lastTrackedPath follows once the pageview is sent.
let trackingPath = "";

// document.currentScript is set for defer scripts. The querySelector fallback
// covers any edge case (e.g. script injected dynamically).
const current =
  document.currentScript || document.querySelector("script[data-siteid]");
// Settings are the script tag's data- attributes. Where the tag isn't the
// site's to write (the Google Tag Manager template injects a bare script) they
// come from window.analyticsConfig instead, set before this file loads, under
// the attribute's name without "data-":
//   window.analyticsConfig = { siteid: "…", domain: "example.com", performance: "true" }
// Only a tag with no data-siteid of its own reads it, so a pasted tag is never
// changed by a site script that happens to use the same global name. An
// attribute on the tag wins, and an empty value counts as not set, as it
// always has for the attributes.
const pageConfig = !current?.getAttribute("data-siteid") &&
  window.analyticsConfig !== null && typeof window.analyticsConfig === "object"
  ? window.analyticsConfig
  : {};
const setting = (name) => {
  const attr = current?.getAttribute(`data-${name}`);
  if (attr) return attr;
  const value = pageConfig[name];
  return value === undefined || value === null || value === "" ? null : String(value);
};
// A tracker configured that way still carries data-siteid on its own tag, so
// the install check and the consent scan, which look for that attribute,
// find it as they find a pasted one.
if (current && !current.getAttribute("data-siteid") && setting("siteid")) {
  current.setAttribute("data-siteid", setting("siteid"));
}
// Written by the release script (release-tracker.js). The tracker's other
// files load from this release's own folder, so a site on the auto-updating
// /v1/track.js never mixes this track.js with another release's files.
const TRACKER_RELEASE = "dev";
const trackerFile = (file) => (/^\d+\.\d+\.\d+$/.test(TRACKER_RELEASE)
  ? new URL(`../v${TRACKER_RELEASE}/${file}`, current.src)
  : new URL(file, current.src));

// The files this one loads are NOT covered by the snippet's integrity hash:
// that hash only pins track.js. The release script writes their SHA-384 here,
// so this file vouches for the rest — but only when the browser itself
// checked this file, which is when the tag carries an integrity attribute
// (a pinned install). Then a file that doesn't match is refused and its
// feature doesn't run (loadModule). Elsewhere a mismatch is only reported:
// an auto-updating /v1/track.js could have been changed together with the
// hashes inside it, and blocking there would cost features over a rewriting
// proxy while stopping no one.
const MODULE_INTEGRITY = null;
const MODULE_REPORTED_KEY = "analytics_module_integrity";
const modulesChecked = new Set();

// Base64 of the file's SHA-384, the same digest the snippet's hash uses.
async function moduleDigest(url) {
  const response = await fetch(url, { credentials: "omit", cache: "force-cache" });
  if (!response.ok) return "";
  const digest = await crypto.subtle.digest("SHA-384", await response.arrayBuffer());
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

async function verifyModule(file, url) {
  const expected = MODULE_INTEGRITY?.[file];
  // No hashes (development), no subtle crypto (plain HTTP), or already done.
  if (!expected || modulesChecked.has(file) || !globalThis.crypto?.subtle) return;
  modulesChecked.add(file);
  let actual;
  try {
    actual = await moduleDigest(url);
  } catch {
    return; // offline, blocked by an extension, or no CORS: not tampering
  }
  if (!actual || actual === expected) return;
  // Once per tab per file where the tab is remembered, so a rewriting proxy
  // cannot flood. The collector holds the rest to once a visit.
  let reported = [];
  try {
    reported = JSON.parse(tabStore().getItem(MODULE_REPORTED_KEY) || "[]");
  } catch { /* optional storage */ }
  if (reported.includes(file)) return;
  try {
    tabStore().setItem(MODULE_REPORTED_KEY, JSON.stringify([...reported, file].slice(-20)));
  } catch { /* optional storage */ }
  sendSecurity({ type: "integrity", change_kind: "module", change_host: file });
}

// The files that import another of ours themselves. On a pinned install that
// one is loaded checked first, so the browser reuses the checked copy rather
// than fetching it again unchecked.
const MODULE_IMPORTS = { "replay.js": ["snapshot.js"], "picker.js": ["editor.js"] };
const pinnedInstall = Boolean(MODULE_INTEGRITY && current?.integrity);
const checkedLoads = new Map();

// Has the browser fetch the file against its hash, without running it: a
// modulepreload link (whose href, unlike a script's src, Trusted Types leave
// alone), or a module script where that isn't supported (Safari before 17).
// Either way the browser keeps the checked copy, or the failure, under the
// file's address, and import() of that address uses it and never refetches.
function fetchChecked(file) {
  const url = trackerFile(file).href;
  const hash = MODULE_INTEGRITY[file];
  if (!hash) return Promise.reject(new Error(`${file} has no hash`));
  return new Promise((resolve, reject) => {
    const preload = document.createElement("link").relList?.supports?.("modulepreload");
    const tag = document.createElement(preload ? "link" : "script");
    if (preload) tag.rel = "modulepreload";
    else tag.type = "module";
    tag.crossOrigin = "anonymous";
    tag.integrity = `sha384-${hash}`;
    if (current.nonce) tag.nonce = current.nonce;
    tag.onload = () => { tag.remove(); resolve(); };
    tag.onerror = () => { tag.remove(); reject(new Error(`${file} did not match its hash`)); };
    if (preload) tag.href = url;
    else tag.src = url;
    document.head.append(tag);
  });
}

// Once per file per page, its own imports first.
function checkModule(file) {
  if (!checkedLoads.has(file)) {
    checkedLoads.set(file, Promise.all((MODULE_IMPORTS[file] || []).map(checkModule))
      .then(() => fetchChecked(file)));
  }
  return checkedLoads.get(file);
}

// Every lazily loaded file goes through here. The report runs alongside the
// load, so checking costs the feature no delay.
function loadModule(file) {
  const url = trackerFile(file).href;
  verifyModule(file, url).catch(() => { /* never break a feature over its own check */ });
  return pinnedInstall ? checkModule(file).then(() => import(url)) : import(url);
}
// Sent with each event so the dashboard can say when a pinned install
// (/v<x.y.z>/, which never changes) is behind the newest release.
const trackerInfo = (() => {
  if (!/^\d+\.\d+\.\d+$/.test(TRACKER_RELEASE) || !current?.src) return null;
  try {
    return { tracker_version: TRACKER_RELEASE, tracker_pinned: /\/v\d+\.\d+\.\d+\/[^/]+$/.test(new URL(current.src).pathname) };
  } catch {
    return null;
  }
})();
const domain = setting("domain") || window.location.hostname;
const siteid = setting("siteid");
// Which build of the site this is, for the Errors report: it says which release
// an issue first appeared in and lets one release be compared with another.
// Set it from your build, either on the script tag (data-release="2.4.1") or,
// where the tag is not yours to edit, as window.ANALYTICS_RELEASE before the
// tracker loads. Anything but letters, numbers and .-_+ is dropped so a commit
// SHA, a tag or a semver all work.
const release = String(setting("release") || window.ANALYTICS_RELEASE || "")
  .trim().replace(/[^\w.+-]/g, "").slice(0, 64);
// Which build the page is when the site tags nothing: a short hash of the
// addresses of its own scripts and stylesheets, which a rebuild changes
// (hashed file names, WordPress's ?ver=). Sent with the vitals; a new one
// first seen by enough visits is a deploy on the dashboard. Taken once, when
// the page has parsed, so scripts loaded later by a click never change it.
// Left out: other sites' files, this tracker's own, chunks webpack loads on
// demand, and query strings other than a version (a cache-buster changes on
// every load). A page with none of its own files has no build.
let pageBuild = "";
function readPageBuild() {
  try {
    // Our own files are left out: their folder, or just the file itself when
    // it is served from the site's root (a first-party proxy at /s.js), as the
    // root folder would leave out every file the site has.
    const self = current?.src ? new URL(current.src).pathname : "";
    const own = [current?.src ? new URL(".", current.src).pathname : "", trackerFile("x").pathname.slice(0, -1)]
      .filter((dir) => dir && dir !== "/");
    const addresses = [];
    const nodes = document.querySelectorAll('script[src]:not([data-webpack]), link[rel="stylesheet"][href]');
    for (const node of nodes) {
      const url = new URL(node.getAttribute("src") || node.getAttribute("href"), location.href);
      if (url.origin !== location.origin || url.pathname === self || own.some((dir) => url.pathname.startsWith(dir))) continue;
      // ?ver=6.4.2 is a version; ?v=1730650000123 is a cache-buster that
      // changes every load, and would make every page view a new build.
      const given = url.searchParams.get("ver") || url.searchParams.get("v") || "";
      const version = /^\d{10,}$/.test(given) ? "" : given;
      addresses.push(version ? `${url.pathname}?${version}` : url.pathname);
    }
    if (!addresses.length) return;
    // FNV-1a, 32 bits twice (forwards and backwards), base 36: short, stable, not secret.
    const text = addresses.sort().join("\n");
    let a = 0x811c9dc5;
    let b = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      a = Math.imul(a ^ text.charCodeAt(i), 16777619);
      b = Math.imul(b ^ text.charCodeAt(text.length - 1 - i), 16777619);
    }
    pageBuild = ((a >>> 0).toString(36) + (b >>> 0).toString(36)).slice(0, 16);
  } catch { /* no build: nothing is sent */ }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", readPageBuild, { once: true });
else readPageBuild();
// ---- What the browser keeps ----
// Analytics on its own stores nothing on the visitor's device: these notes last
// as long as the page. A site running tools that need to remember across pages
// (popups, forms, surveys, tests, a banner) keeps them for this tab instead, from
// the moment its config says so. A visitor the site may recognise is the only
// one with a lasting ID (see mayRemember).
const pageNotes = new Map();
const pageStore = {
  getItem: (key) => pageNotes.get(key) ?? null,
  setItem: (key, value) => { pageNotes.set(key, String(value)); },
  removeItem: (key) => { pageNotes.delete(key); },
};
const ONSITE_TOOLS_KEY = `analytics:tools:${siteid}`;
let onsiteTools = false;
try {
  onsiteTools = sessionStorage.getItem(ONSITE_TOOLS_KEY) === "1";
} catch { /* optional storage */ }
const tabStore = () => (onsiteTools ? sessionStorage : pageStore);
function keepForTab() {
  if (onsiteTools) return;
  try {
    sessionStorage.setItem(ONSITE_TOOLS_KEY, "1");
    for (const [key, value] of pageNotes) sessionStorage.setItem(key, value);
    onsiteTools = true;
    pageNotes.clear();
  } catch { /* optional storage: the notes stay with this page */ }
}
// Without a tab's memory the same thing would be sent on every page, so these
// reports go out from one page in ten instead.
const REPORT_SAMPLE = 0.1;
const skipReport = () => tabStore() === pageStore && Math.random() >= REPORT_SAMPLE;
// ---- end what the browser keeps ----
const analyticsSession = createAnalyticsSession(siteid, window, () => (mayRemember() ? localStorage : tabStore()));
// Customer checkout code reads this ID and sends it to its own backend.
window.analyticsSession = { getId: analyticsSession.getId };
const enablePerfMetrics =
  (
    setting("metrics") ||
    setting("performance") ||
    ""
  ).toLowerCase() === "true";
// web-vitals is inlined so the tracker stays one file with one SRI hash.
// Regenerate with: node scripts/bundle-web-vitals.js
/* BEGIN web-vitals */
/*! web-vitals v5.1.0 | Apache-2.0 | https://github.com/GoogleChrome/web-vitals */
const bundledWebVitals = (() => {
var webVitals=function(e){"use strict";let t=-1;const n=e=>{addEventListener("pageshow",(n=>{n.persisted&&(t=n.timeStamp,e(n))}),!0)},i=(e,t,n,i)=>{let s,r;return o=>{t.value>=0&&(o||i)&&(r=t.value-(s??0),(r||void 0===s)&&(s=t.value,t.delta=r,t.rating=((e,t)=>e>t[1]?"poor":e>t[0]?"needs-improvement":"good")(t.value,n),e(t)))}},s=e=>{requestAnimationFrame((()=>requestAnimationFrame((()=>e()))))},r=()=>{const e=performance.getEntriesByType("navigation")[0];if(e&&e.responseStart>0&&e.responseStart<performance.now())return e},o=()=>{const e=r();return e?.activationStart??0},c=(e,n=-1)=>{const i=r();let s="navigate";t>=0?s="back-forward-cache":i&&(document.prerendering||o()>0?s="prerender":document.wasDiscarded?s="restore":i.type&&(s=i.type.replace(/_/g,"-")));return{name:e,value:n,rating:"good",delta:0,entries:[],id:`v5-${Date.now()}-${Math.floor(8999999999999*Math.random())+1e12}`,navigationType:s}},a=new WeakMap;function d(e,t){return a.get(e)||a.set(e,new t),a.get(e)}class h{t;i=0;o=[];h(e){if(e.hadRecentInput)return;const t=this.o[0],n=this.o.at(-1);this.i&&t&&n&&e.startTime-n.startTime<1e3&&e.startTime-t.startTime<5e3?(this.i+=e.value,this.o.push(e)):(this.i=e.value,this.o=[e]),this.t?.(e)}}const f=(e,t,n={})=>{try{if(PerformanceObserver.supportedEntryTypes.includes(e)){const i=new PerformanceObserver((e=>{Promise.resolve().then((()=>{t(e.getEntries())}))}));return i.observe({type:e,buffered:!0,...n}),i}}catch{}},u=e=>{let t=!1;return()=>{t||(e(),t=!0)}};let l=-1;const m=new Set,v=()=>"hidden"!==document.visibilityState||document.prerendering?1/0:0,p=e=>{if("hidden"===document.visibilityState){if("visibilitychange"===e.type)for(const e of m)e();isFinite(l)||(l="visibilitychange"===e.type?e.timeStamp:0,removeEventListener("prerenderingchange",p,!0))}},g=()=>{if(l<0){const e=o(),t=document.prerendering?void 0:globalThis.performance.getEntriesByType("visibility-state").filter((t=>"hidden"===t.name&&t.startTime>e))[0]?.startTime;l=t??v(),addEventListener("visibilitychange",p,!0),addEventListener("prerenderingchange",p,!0),n((()=>{setTimeout((()=>{l=v()}))}))}return{get firstHiddenTime(){return l},onHidden(e){m.add(e)}}},y=e=>{document.prerendering?addEventListener("prerenderingchange",(()=>e()),!0):e()},b=[1800,3e3],E=(e,t={})=>{y((()=>{const r=g();let a,d=c("FCP");const h=f("paint",(e=>{for(const t of e)"first-contentful-paint"===t.name&&(h.disconnect(),t.startTime<r.firstHiddenTime&&(d.value=Math.max(t.startTime-o(),0),d.entries.push(t),a(!0)))}));h&&(a=i(e,d,b,t.reportAllChanges),n((n=>{d=c("FCP"),a=i(e,d,b,t.reportAllChanges),s((()=>{d.value=performance.now()-n.timeStamp,a(!0)}))})))}))},L=[.1,.25];let P=0,T=1/0,_=0;const M=e=>{for(const t of e)t.interactionId&&(T=Math.min(T,t.interactionId),_=Math.max(_,t.interactionId),P=_?(_-T)/7+1:0)};let w;const C=()=>w?P:performance.interactionCount??0,I=()=>{"interactionCount"in performance||w||(w=f("event",M,{type:"event",buffered:!0,durationThreshold:0}))};let F=0;class k{u=[];l=new Map;m;v;p(){F=C(),this.u.length=0,this.l.clear()}L(){const e=Math.min(this.u.length-1,Math.floor((C()-F)/50));return this.u[e]}h(e){if(this.m?.(e),!e.interactionId&&"first-input"!==e.entryType)return;const t=this.u.at(-1);let n=this.l.get(e.interactionId);if(n||this.u.length<10||e.duration>t.P){if(n?e.duration>n.P?(n.entries=[e],n.P=e.duration):e.duration===n.P&&e.startTime===n.entries[0].startTime&&n.entries.push(e):(n={id:e.interactionId,entries:[e],P:e.duration},this.l.set(n.id,n),this.u.push(n)),this.u.sort(((e,t)=>t.P-e.P)),this.u.length>10){const e=this.u.splice(10);for(const t of e)this.l.delete(t.id)}this.v?.(n)}}}const A=e=>{const t=globalThis.requestIdleCallback||setTimeout;"hidden"===document.visibilityState?e():(e=u(e),addEventListener("visibilitychange",e,{once:!0,capture:!0}),t((()=>{e(),removeEventListener("visibilitychange",e,{capture:!0})})))},B=[200,500];class S{m;h(e){this.m?.(e)}}const N=[2500,4e3],q=[800,1800],H=e=>{document.prerendering?y((()=>H(e))):"complete"!==document.readyState?addEventListener("load",(()=>H(e)),!0):setTimeout(e)};return e.CLSThresholds=L,e.FCPThresholds=b,e.INPThresholds=B,e.LCPThresholds=N,e.TTFBThresholds=q,e.onCLS=(e,t={})=>{const r=g();E(u((()=>{let o,a=c("CLS",0);const u=d(t,h),l=e=>{for(const t of e)u.h(t);u.i>a.value&&(a.value=u.i,a.entries=u.o,o())},m=f("layout-shift",l);m&&(o=i(e,a,L,t.reportAllChanges),r.onHidden((()=>{l(m.takeRecords()),o(!0)})),n((()=>{u.i=0,a=c("CLS",0),o=i(e,a,L,t.reportAllChanges),s((()=>o()))})),setTimeout(o))})))},e.onFCP=E,e.onINP=(e,t={})=>{if(!globalThis.PerformanceEventTiming||!("interactionId"in PerformanceEventTiming.prototype))return;const s=g();y((()=>{I();let r,o=c("INP");const a=d(t,k),h=e=>{A((()=>{for(const t of e)a.h(t);const t=a.L();t&&t.P!==o.value&&(o.value=t.P,o.entries=t.entries,r())}))},u=f("event",h,{durationThreshold:t.durationThreshold??40});r=i(e,o,B,t.reportAllChanges),u&&(u.observe({type:"first-input",buffered:!0}),s.onHidden((()=>{h(u.takeRecords()),r(!0)})),n((()=>{a.p(),o=c("INP"),r=i(e,o,B,t.reportAllChanges)})))}))},e.onLCP=(e,t={})=>{y((()=>{const r=g();let a,h=c("LCP");const l=d(t,S),m=e=>{t.reportAllChanges||(e=e.slice(-1));for(const t of e)l.h(t),t.startTime<r.firstHiddenTime&&(h.value=Math.max(t.startTime-o(),0),h.entries=[t],a())},v=f("largest-contentful-paint",m);if(v){a=i(e,h,N,t.reportAllChanges);const r=u((()=>{m(v.takeRecords()),v.disconnect(),a(!0)})),o=e=>{e.isTrusted&&(A(r),removeEventListener(e.type,o,{capture:!0}))};for(const e of["keydown","click","visibilitychange"])addEventListener(e,o,{capture:!0});n((n=>{h=c("LCP"),a=i(e,h,N,t.reportAllChanges),s((()=>{h.value=performance.now()-n.timeStamp,a(!0)}))}))}}))},e.onTTFB=(e,t={})=>{let s=c("TTFB"),a=i(e,s,q,t.reportAllChanges);H((()=>{const d=r();d&&(s.value=Math.max(d.responseStart-o(),0),s.entries=[d],a(!0),n((()=>{s=c("TTFB",0),a=i(e,s,q,t.reportAllChanges),a(!0)})))}))},e}({});
return webVitals;
})();
/* END web-vitals */
const host = window.location.hostname;
// Configurable wait for web-vitals (ms). Can be set on the script tag
// via `data-web-vitals-wait-ms`. Default 3000ms.
const webVitalsWaitMs =
  Number(setting("web-vitals-wait-ms")) || 3000;
const shortWebVitalsWaitMs = Math.min(
  500,
  Math.max(200, Math.floor(webVitalsWaitMs / 6)),
);

// NEW: collector URL (defaults to same-origin path, CSP-friendly)
const collectAttr =
  setting("collect") ||
  "/collector/collectanalytics/collect";
let COLLECT_URL = collectAttr;
try {
  const base = current?.src
    ? new URL(current.src).origin
    : window.location.origin;
  COLLECT_URL = new URL(collectAttr, base).toString();
} catch {
  // leave as-is
}

// Hands a JSON string to the browser to deliver; false when it won't, so the
// caller falls back to fetch. The string goes as is (the browser labels it
// text/plain;charset=UTF-8, still a simple CORS request) rather than in a Blob:
// some visitors' pages and bots have no working Blob constructor, and a throw
// here once lost the page view itself.
function beacon(url, body) {
  try {
    return navigator.sendBeacon ? navigator.sendBeacon(url, body) : false;
  } catch {
    return false;
  }
}

// Navigation Timing is always in milliseconds; a cached DNS lookup really is 3 ms.
const navTimings =
  nav && enablePerfMetrics
    ? {
      dns: nav.domainLookupEnd - nav.domainLookupStart,
      tcp: nav.connectEnd - nav.connectStart,
      tls: nav.secureConnectionStart > 0
        ? nav.connectEnd - nav.secureConnectionStart
        : 0,
      redirect: nav.redirectEnd - nav.redirectStart,
      response: nav.responseEnd - nav.responseStart,
    }
    : null;

const perfMetrics = {};
let onLCP;
let onCLS;
let onINP;
let onFCP;
let onTTFB;
let webVitalsRegistered = false;
let inpFlushed = false;

const flushInpOnce = async () => {
  if (inpFlushed || perfMetrics.inp == null) return;
  inpFlushed = true;
  // INP is a perf metric only — no analytics post needed
};

const loadWebVitals = () => {
  if (!onLCP) ({ onLCP, onCLS, onINP, onFCP, onTTFB } = bundledWebVitals);
  return Promise.resolve();
};

// ---- Shared scroll geometry ----
// Reading document.documentElement.scrollHeight forces the browser to lay the
// page out, and several handlers want the same three numbers on the same
// scroll: the scroll depth, the attention bands, and a scroll-triggered
// notice. So scroll and resize only queue a frame, and the frame measures once
// and hands the numbers to every watcher. Called outside a frame (page load,
// visibilitychange, pagehide, an SPA route change) this measures afresh, which
// is what those one-off callers need.
let scrollGeometry = null;
let scrollFrame = 0;
let scrollMoved = false;
const scrollWatchers = new Set();

function pageScroll() {
  return scrollGeometry || {
    y: window.scrollY,
    view: window.innerHeight,
    height: document.documentElement.scrollHeight,
  };
}

function queueScrollFrame(event) {
  // Resize moves the bands too, but only a scroll can deepen the scroll depth.
  if (event?.type === "scroll") scrollMoved = true;
  // requestAnimationFrame never returns 0, so every event in a frame coalesces
  // into one measurement. A frame queued while the tab is hidden runs when it
  // comes back, which is also when the numbers matter again.
  scrollFrame ||= requestAnimationFrame(() => {
    scrollFrame = 0;
    scrollGeometry = {
      y: window.scrollY,
      view: window.innerHeight,
      height: document.documentElement.scrollHeight,
    };
    try {
      for (const watcher of scrollWatchers) {
        try {
          watcher();
        } catch { /* one watcher must not stop the others */ }
      }
    } finally {
      scrollGeometry = null;
      scrollMoved = false;
    }
  });
}

//. PERFORMANCE AND DIAGNOSTIC METRIC ---------------------------
const metricsSnapshot = async () => {
  if (!enablePerfMetrics) return null;
  const combined = { ...(navTimings || {}) };
  for (const [key, value] of Object.entries(perfMetrics)) {
    combined[key] = value;
  }
  // Load web-vitals and capture individual values into variables so
  // they can be merged into the combined metrics object.
  let lcpVal = null;
  let clsVal = null;
  let inpVal = null;
  let fcpVal = null;
  let ttfbVal = null;

  // If handlers ran earlier, capture values already present in perfMetrics
  if (perfMetrics.lcp != null) lcpVal = perfMetrics.lcp;
  if (perfMetrics.cls != null) clsVal = perfMetrics.cls;
  if (perfMetrics.inp != null) inpVal = perfMetrics.inp;
  if (perfMetrics.fcp != null) fcpVal = perfMetrics.fcp;
  if (perfMetrics.ttfb != null) ttfbVal = perfMetrics.ttfb;

  await loadWebVitals();
  if (onLCP) {
    const allHandlersRegistered = webVitalsRegistered;

    // Register handlers once; reuse captured values on later calls.
    if (!allHandlersRegistered) {
      webVitalsRegistered = true;
      let metricsReadyResolve = null;
      let ready = false;
      const metricsReady = new Promise((res) => {
        metricsReadyResolve = res;
      });
      const maybeReady = () => {
        if (ready) return;
        // FCP + TTFB + LCP fire on load; CLS accumulates; INP needs interaction.
        // Resolve once we have the 3 that always fire on page load.
        if (fcpVal !== null && ttfbVal !== null && lcpVal !== null) {
          ready = true;
          metricsReadyResolve();
        }
      };
      // web-vitals v5 keys its internal state by the options object, so each
      // metric needs its own; a shared one makes onINP reuse LCP's state.
      const register = (fn, setter) => {
        if (typeof fn !== "function") return;
        fn((m) => {
          try {
            setter(m.value);
            captureMetric(m);
            captureAttribution(m);
            if (m.name?.toLowerCase() === "inp") flushInpOnce();
            maybeReady();
          } catch (e) { }
        }, { reportAllChanges: true });
      };

      register(onLCP, (v) => {
        lcpVal = v;
      });
      register(onCLS, (v) => {
        clsVal = v;
      });
      register(onINP, (v) => {
        inpVal = v;
      });
      register(onFCP, (v) => {
        fcpVal = v;
      });
      register(onTTFB, (v) => {
        ttfbVal = v;
      });

      // Wait until FCP+TTFB+LCP arrive or a configurable timeout.
      const timeout = setTimeout(() => {
        if (!ready && metricsReadyResolve) metricsReadyResolve();
      }, webVitalsWaitMs);
      await metricsReady;
      clearTimeout(timeout);
    } else {
      // If already registered, give a shorter window for late metrics.
      await new Promise((res) => setTimeout(res, shortWebVitalsWaitMs));
    }
  }

  // Ensure CLS/INP keys are present when perf metrics are enabled.
  if (clsVal === null && perfMetrics.cls !== undefined)
    clsVal = perfMetrics.cls;
  if (inpVal === null && perfMetrics.inp !== undefined)
    inpVal = perfMetrics.inp;

  if (lcpVal !== null) combined.lcp = lcpVal;
  if (clsVal !== null) combined.cls = clsVal;
  if (inpVal !== null) {
    combined.inp = inpVal;
  } else {
    combined.inp_pending = true; // INP reports after interaction; flag pending state
  }
  if (fcpVal !== null) combined.fcp = fcpVal;
  if (ttfbVal !== null) combined.ttfb = ttfbVal;
  Object.assign(combined, perfAttribution, deviceContext());

  return Object.keys(combined).length ? combined : null;
};

// What has been measured so far, without waiting: a page being unloaded
// doesn't run timers, so anything sent after an await is usually lost.
const currentMetrics = () => {
  if (!enablePerfMetrics) return null;
  const combined = { ...(navTimings || {}), ...perfMetrics };
  if (combined.inp == null) combined.inp_pending = true;
  // Which build these vitals are from, so a release can be compared with the last.
  if (release) combined.release = release;
  if (pageBuild) combined.build = pageBuild;
  return Object.assign(combined, perfAttribution, deviceContext());
};

// Leaving a page fires visibilitychange (hidden) and then pagehide: one
// beacon for the two. Set again each time the page is shown.
let metricsFlushed = false;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") metricsFlushed = false;
});
window.addEventListener("pageshow", () => {
  metricsFlushed = false;
});

// Flush metrics on pagehide/visibilitychange using sendBeacon.
const flushMetrics = (type = "pagehide") => {
  if (metricsFlushed) return false;
  try {
    const metrics = currentMetrics();
    // Empty performance beacons cannot pass collector validation.
    if (!metrics || Object.keys(metrics).length === 0) return false;
    const payloadObj = {
      url: typeof window !== "undefined" ? window.location.pathname : "",
      type,
      metrics: { ...metrics, ...resourceSnapshot() },
      timestamp: new Date().toISOString(),
      siteid: siteid || "",
      domain: domain || "",
      // Links speed data to the visit's pageviews.
      session_id: analyticsSession.getId(),
    };
    const payload = JSON.stringify(payloadObj);
    metricsFlushed = true;
    if (beacon(COLLECT_URL, payload)) return true;
    // Best-effort fetch with keepalive
    fetch(COLLECT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      credentials: "omit",
      body: payload,
      keepalive: true,
    }).catch(() => {});
    return true;
  } catch (e) {
    return false;
  }
};

// A lead the collector could not take is kept here rather than lost. The
// visitor filled the form in once and must not be asked to do it again, and an
// enquiry is the one thing this tracker carries whose loss costs the site
// owner real money — everything else it sends is a statistic. Each entry
// carries the submission id the form generated, so an answer that arrives
// twice (the original request landing late as well as a retry here) is still
// one lead on the other side.
const LEAD_QUEUE_KEY = "analytics:leads:pending";
const LEAD_QUEUE_MAX = 20;
const LEAD_QUEUE_TTL_MS = 24 * 60 * 60 * 1000;
// A queued answer carries the endpoint it was going to: a form of ours
// (leads/submit) or one of the site's own that we captured (leads/capture).
// Nothing else may be retried, so a tampered-with queue can't aim a POST
// somewhere else on the collector, and an entry left by an older tracker,
// which has no path at all, still goes where it was written for.
const LEAD_SUBMIT_PATH = "leads/submit";
const LEAD_CAPTURE_PATH = "leads/capture";
const LEAD_PATHS = [LEAD_SUBMIT_PATH, LEAD_CAPTURE_PATH];
const leadUrl = (path) => new URL(path || LEAD_SUBMIT_PATH, COLLECT_URL);

// Same shape and the same fallback as a session id, because randomUUID is only
// there in a secure context and a form on plain http still has to be sendable.
const randomId = () => {
  if (crypto?.randomUUID) return crypto.randomUUID();
  if (!crypto?.getRandomValues) return "";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const readLeadQueue = () => {
  try {
    const queued = JSON.parse(localStorage.getItem(LEAD_QUEUE_KEY) || "[]");
    if (!Array.isArray(queued)) return [];
    return queued.filter((item) => item?.body && LEAD_PATHS.includes(item.path || LEAD_SUBMIT_PATH)
      && Date.now() - Number(item.at) < LEAD_QUEUE_TTL_MS);
  } catch {
    return [];
  }
};

const writeLeadQueue = (queued) => {
  try {
    if (queued.length) localStorage.setItem(LEAD_QUEUE_KEY, JSON.stringify(queued.slice(-LEAD_QUEUE_MAX)));
    else localStorage.removeItem(LEAD_QUEUE_KEY);
  } catch { /* storage blocked or full: nothing to keep it in, so the retry is simply not made */ }
};

const queueLead = (body, path = LEAD_SUBMIT_PATH) => writeLeadQueue([...readLeadQueue(), { at: Date.now(), path, body }]);

// Tried again on the next page view, and once more as the page goes away. Only
// a collector that is down or broken is worth retrying: a 4xx says this
// submission will never be accepted however often it is sent, so it is dropped
// rather than carried around for a day.
const flushLeadQueue = async (leaving = false) => {
  const queued = readLeadQueue();
  if (!queued.length) return;
  if (leaving) {
    if (!navigator.sendBeacon) return;
    // The page is going: hand each one to the browser to deliver after we are
    // gone, and keep only those it would not take.
    writeLeadQueue(queued.filter((item) => !beacon(leadUrl(item.path), JSON.stringify(item.body))));
    return;
  }
  const done = new Set();
  for (const item of queued) {
    const delivered = await fetch(leadUrl(item.path), {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      credentials: "omit",
      keepalive: true,
      body: JSON.stringify(item.body),
    }).then((r) => r.status < 500, () => false);
    if (delivered) done.add(JSON.stringify(item));
  }
  // Read again rather than writing back what was read before the requests:
  // a lead the visitor sent while they were in flight is in there too.
  writeLeadQueue(readLeadQueue().filter((item) => !done.has(JSON.stringify(item))));
};

flushLeadQueue();

window.addEventListener("pagehide", () => {
  flushMetrics("pagehide");
  flushLeadQueue(true);
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushMetrics("visibilitychange");
    flushLeadQueue(true);
  }
});

// Capture INP as soon as the user interacts once (perf only, no analytics post).
const handleFirstInteraction = async () => {
  document.removeEventListener("pointerdown", handleFirstInteraction, true);
  document.removeEventListener("keydown", handleFirstInteraction, true);
  document.removeEventListener("touchstart", handleFirstInteraction, true);
  try {
    await metricsSnapshot();
  } catch (e) {
    // ignore
  }
};

document.addEventListener("pointerdown", handleFirstInteraction, true);
document.addEventListener("keydown", handleFirstInteraction, true);
document.addEventListener("touchstart", handleFirstInteraction, true);

const captureMetric = (metric) => {
  perfMetrics[metric.name.toLowerCase()] = metric.value;
};

// ---- Developer diagnostics: which element, resource or script caused it ----
// Everything here is best-effort: unsupported browsers just send less.
const perfAttribution = {};
// Short CSS path, e.g. "main > div.hero > img.banner"; stops at an id.
const describeElement = (el) => {
  try {
    const parts = [];
    for (let node = el; node && node.nodeType === 1 && parts.length < 4; node = node.parentElement) {
      if (node === document.body || node === document.documentElement) break;
      const tag = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(`${tag}#${node.id}`);
        break;
      }
      const classes = typeof node.className === "string"
        ? node.className.trim().split(/\s+/).filter(Boolean).slice(0, 2)
        : [];
      parts.unshift(classes.length ? `${tag}.${classes.join(".")}` : tag);
    }
    return parts.join(" > ").slice(0, 200);
  } catch (e) {
    return "";
  }
};
// Origin + path only: query strings can carry tokens or emails.
const cleanUrl = (u) => {
  try {
    const parsed = new URL(u, location.href);
    if (!/^https?:$/.test(parsed.protocol)) return "";
    return (parsed.origin + parsed.pathname).slice(0, 300);
  } catch (e) {
    return "";
  }
};
// Where a captured form goes once sent: web addresses only. The attribute can
// come from markup a visitor posted (sanitizers keep data-* attributes), and a
// javascript: address would run in the site's page.
const captureRedirect = (value) => {
  if (!value) return "";
  try {
    const parsed = new URL(value, location.href);
    return /^https?:$/.test(parsed.protocol) ? parsed.href : "";
  } catch (e) {
    return "";
  }
};
// Where the site's settings may send a visitor without a click (a split URL
// test, a form's "after sending" redirect): this page's own host, or the
// domain on the site's own tag, or a subdomain of either. Judged only by what
// the page says, never by the settings, so whoever reached the dashboard or
// our database still can't send a site's visitors to a page of theirs. The
// backend refuses the rest on save (sameSiteRedirect); this holds if that is
// bypassed. Returns the address to go to, or "".
const siteHostBase = (value) => String(value || "").trim().toLowerCase()
  .replace(/^https?:\/\//, "").replace(/[/:?#].*$/, "").replace(/^www\./, "");
const sameSiteTarget = (value) => {
  if (!value) return "";
  try {
    const url = new URL(value, location.href);
    if (!/^https?:$/.test(url.protocol)) return "";
    const host = siteHostBase(url.hostname);
    const ours = [location.hostname, domain].map(siteHostBase).filter(Boolean);
    return ours.some((base) => host === base || host.endsWith(`.${base}`)) ? url.href : "";
  } catch (e) {
    return "";
  }
};
// The same for the CSS a test or edit applies (its CSS box and its style
// changes): every url() in it on the site, read with escapes decoded as the
// browser reads them ("\75rl(" is "url("), and every url( one this reads.
// So settings can't make a page send what's on it, or what a visitor types,
// to another server. The backend refuses the rest on save (cssOnSite).
const cssDecoded = (text) => text.replace(/\/\*[\s\S]*?(\*\/|$)/g, " ")
  .replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex) => {
    const code = Number.parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "\ufffd";
  })
  .replace(/\\(.)/g, "$1");
const cssOnSite = (css) => {
  const plain = cssDecoded(String(css || ""));
  const found = [...plain.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]*))\s*\)/gi)];
  return found.length === (plain.match(/url\(/gi) || []).length
    && found.every((m) => {
      const address = m[1] ?? m[2] ?? m[3];
      return !address || Boolean(sameSiteTarget(address));
    });
};
const variantCssOnSite = (variant) => cssOnSite(variant?.css)
  && (variant?.changes || []).every((c) => c.action !== "style" || cssOnSite(c.value));
const wholeMs = (v) => Math.max(0, Math.round(v || 0));

const captureAttribution = (m) => {
  try {
    const entries = m.entries || [];
    if (m.navigationType && !perfAttribution.nav_type) perfAttribution.nav_type = m.navigationType;
    if (m.name === "LCP") {
      // LCP = TTFB + load delay + load time + render delay.
      const e = entries[entries.length - 1];
      if (!e) return;
      const navEntry = performance.getEntriesByType("navigation")[0];
      const activation = navEntry?.activationStart || 0;
      const ttfb = Math.max(0, (navEntry?.responseStart || 0) - activation);
      let loadStart = ttfb;
      let loadEnd = ttfb;
      const res = e.url && performance.getEntriesByType("resource").find((r) => r.name === e.url);
      if (res) {
        loadStart = Math.max(ttfb, (res.requestStart || res.startTime) - activation);
        loadEnd = Math.max(loadStart, res.responseEnd - activation);
      }
      perfAttribution.lcp_element = describeElement(e.element);
      perfAttribution.lcp_url = e.url ? cleanUrl(e.url) : "";
      perfAttribution.lcp_load_delay = wholeMs(loadStart - ttfb);
      perfAttribution.lcp_load_time = wholeMs(loadEnd - loadStart);
      perfAttribution.lcp_render_delay = wholeMs(m.value - loadEnd);
    } else if (m.name === "CLS") {
      // The biggest element in the biggest shift of the worst window.
      let largest = null;
      for (const e of entries) if (!largest || e.value > largest.value) largest = e;
      let node = null;
      let area = -1;
      for (const source of largest?.sources || []) {
        const rect = source.currentRect || source.previousRect;
        const size = rect ? rect.width * rect.height : 0;
        if (source.node && size > area) {
          area = size;
          node = source.node;
        }
      }
      if (node) perfAttribution.cls_element = describeElement(node.nodeType === 1 ? node : node.parentElement);
    } else if (m.name === "INP") {
      // INP = input delay + processing + presentation delay.
      const first = entries[0];
      if (!first) return;
      const target = entries.find((e) => e.target)?.target;
      const processingStart = Math.min(...entries.map((e) => e.processingStart));
      const processingEnd = Math.max(...entries.map((e) => e.processingEnd));
      perfAttribution.inp_element = target ? describeElement(target) : "";
      perfAttribution.inp_event = first.name || "";
      perfAttribution.inp_input_delay = wholeMs(processingStart - first.startTime);
      perfAttribution.inp_processing = wholeMs(processingEnd - processingStart);
      perfAttribution.inp_presentation = wholeMs(first.startTime + first.duration - processingEnd);
    }
  } catch (e) { }
};

const deviceContext = () => ({
  effective_type: navigator.connection?.effectiveType || "",
  // Browser estimates (Chromium only): round-trip time and bandwidth, capped at 10 Mbps.
  rtt_ms: Number(navigator.connection?.rtt) || 0,
  downlink_mbps: Number(navigator.connection?.downlink) || 0,
  device_memory: Number(navigator.deviceMemory) || 0,
  cpu_cores: Number(navigator.hardwareConcurrency) || 0,
});

// Scripts behind long animation frames (Chromium only), summed per script + invoker.
const slowScripts = new Map();
try {
  if (enablePerfMetrics && PerformanceObserver.supportedEntryTypes?.includes("long-animation-frame")) {
    new PerformanceObserver((list) => {
      for (const frame of list.getEntries()) {
        for (const s of frame.scripts || []) {
          const url = cleanUrl(s.sourceURL) || "(inline)";
          const invoker = String(s.invoker || "").replace(/\?\S*/g, "").slice(0, 120);
          const key = `${url}|${invoker}`;
          const seen = slowScripts.get(key);
          if (seen) seen.duration += s.duration;
          else if (slowScripts.size < 200) slowScripts.set(key, { url, invoker, duration: s.duration });
        }
      }
    }).observe({ type: "long-animation-frame", buffered: true });
  }
} catch (e) { }

// Sent with the pagehide/visibilitychange beacon only: render-blocking
// resources plus the 15 slowest (max 25), and the 10 slowest scripts.
const resourceSnapshot = () => {
  const out = {
    res_url: [], res_type: [], res_duration: [], res_size: [], res_blocking: [], res_cached: [],
    script_url: [], script_invoker: [], script_duration: [],
  };
  try {
    const collector = cleanUrl(COLLECT_URL);
    const all = performance.getEntriesByType("resource")
      .filter((r) => { const u = cleanUrl(r.name); return u && u !== collector; });
    const blocking = all.filter((r) => r.renderBlockingStatus === "blocking");
    const slowest = [...all].sort((a, b) => b.duration - a.duration).slice(0, 15);
    for (const r of [...new Set([...blocking, ...slowest])].slice(0, 25)) {
      out.res_url.push(cleanUrl(r.name));
      out.res_type.push(r.initiatorType || "other");
      out.res_duration.push(wholeMs(r.duration));
      out.res_size.push(wholeMs(r.transferSize));
      out.res_blocking.push(r.renderBlockingStatus === "blocking" ? 1 : 0);
      // Cross-origin files without Timing-Allow-Origin report 0 sizes, so they never count as cached.
      out.res_cached.push(r.transferSize === 0 && r.decodedBodySize > 0 ? 1 : 0);
    }
    for (const s of [...slowScripts.values()].sort((a, b) => b.duration - a.duration).slice(0, 10)) {
      out.script_url.push(s.url);
      out.script_invoker.push(s.invoker);
      out.script_duration.push(wholeMs(s.duration));
    }
  } catch (e) { }
  return out;
};

//. HEATMAP CLICKS ------------------------------------------------
// Every click, buffered and sent in batches (at most 50 per request, 500 per
// page). Positions are relative to the clicked element so heatmaps line up at
// any screen width; the page position is a fallback when the element is gone.
const HEATMAP_BATCH = 50;
const HEATMAP_PAGE_LIMIT = 500;
const HEATMAP_TARGET =
  "a,button,input,select,textarea,label,summary,[role=button],[role=link],[role=tab],[onclick]";
const HEATMAPS_OFF_KEY = `analytics:heatmapsoff:${siteid}`;
let heatmapClicks = [];
let heatmapPageClicks = 0;
// Structure fingerprint of the current page (see pageFingerprint), sent with
// its clicks so the dashboard only draws them on the matching snapshot.
let pageVersion = "";
// Set when the collector says this site has heatmaps turned off.
let heatmapsOff = false;
try {
  heatmapsOff = tabStore().getItem(HEATMAPS_OFF_KEY) === "1";
} catch { /* optional storage */ }

// Generated ids (React useId ":r1:", long numbers) differ per page load.
const isStableId = (id) => /^[A-Za-z][\w-]{0,63}$/.test(id) && !/\d{4,}/.test(id);

// Child path from the nearest stable id (or body), e.g.
// "#nav>ul:nth-of-type(1)>li:nth-of-type(3)>a:nth-of-type(1)". Class names
// are skipped: build tools generate them and they change between deploys.
function heatmapSelector(el) {
  const parts = [];
  for (let node = el; node && node.nodeType === 1 && parts.length < 40; node = node.parentElement) {
    if (node === document.body) {
      parts.unshift("body");
      break;
    }
    if (node.id && isStableId(node.id)) {
      parts.unshift(`#${node.id}`);
      break;
    }
    const tag = node.tagName.toLowerCase();
    if (!/^[a-z][a-z0-9-]*$/.test(tag)) return "";
    let index = 1;
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.tagName === node.tagName) index++;
    }
    parts.unshift(`${tag}:nth-of-type(${index})`);
  }
  return parts.join(">");
}

const basisPoints = (ratio) =>
  Math.min(10000, Math.max(0, Math.round((Number.isFinite(ratio) ? ratio : 0.5) * 10000)));

//. FRUSTRATION SIGNALS -------------------------------------------
// Sent with the heatmap clicks, so they follow the site's heatmap switch.
// Rage click: 3 clicks within a second and 30px (the same rule as session
// replays). Dead click: nothing happened within a second (no page change,
// navigation, scroll or tab switch). Both flag the click itself. Excessive
// scrolling (direction flipped 4 times within 3 s) and intense mouse movement
// (8 fast left-right flips within 1.5 s) are page signals, at most one of
// each per 10 s.
// Error click: a script error within a second of the click; the error's
// message is sent as a js_error signal. Slow click: the page took 500 ms or
// more to respond (Event Timing, Chromium only). Form failure: the same form
// failed twice in a page view, either blocked by the browser's own checks or
// still showing invalid fields 1.5 s after submitting.
const RAGE_CLICKS = 3;
const RAGE_MS = 1000;
const RAGE_PX = 30;
const DEAD_MS = 1000;
const ERROR_AFTER_CLICK_MS = 1000;
const SLOW_CLICK_MS = 500;
const FORM_CHECK_MS = 1500;
const SIGNAL_COOLDOWN_MS = 10000;
// Clicks on these normally change nothing visible in the HTML (focus, opening
// a link, a canvas chart or map redrawing its own pixels).
const NOT_DEAD = "canvas,input,select,textarea,label,option,[contenteditable],a[href]:not([href^='#']):not([href^='javascript'])";
// Dead clicks only count on what looks clickable: a click on plain text or
// background that changes nothing is normal (focusing the window, selecting
// text, idle clicks).
const LOOKS_CLICKABLE = "a,button,summary,img,svg,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=switch],[onclick],[tabindex]";
function looksClickable(el) {
  if (el.closest(LOOKS_CLICKABLE)) return true;
  const style = getComputedStyle(el);
  return style.cursor === "pointer" || style.textDecorationLine.includes("underline");
}
let recentHeatmapClicks = [];
let heatmapSignals = [];
const lastSignalAt = {};
let lastPageChange = 0;
let deadObserver = null;
let deadChecks = 0;
// The last few recorded clicks, for the error and slow checks.
let latestClicks = [];

function addSignal(kind, detail = "") {
  const now = Date.now();
  if (heatmapsOff || now - (lastSignalAt[kind] || 0) < SIGNAL_COOLDOWN_MS) return;
  lastSignalAt[kind] = now;
  const at = performance.now();
  heatmapSignals.push(detail ? { kind, detail, at } : { kind, at });
}

function onPageError(message) {
  const last = latestClicks[latestClicks.length - 1];
  if (!last || Date.now() - last.at > ERROR_AFTER_CLICK_MS) return;
  last.click.is_error = 1;
  addSignal("js_error", autoText(message) || "Unknown error");
}
window.addEventListener("error", (e) => {
  onPageError(e.message);
  noteFeedbackError(e.error?.name, e.message, e.filename, e.lineno);
  captureError(e.error, e.message, e.filename, e.lineno, e.colno, "error");
});
window.addEventListener("unhandledrejection", (e) => {
  onPageError(e.reason?.message || String(e.reason ?? ""));
  noteFeedbackError(e.reason?.name || "UnhandledRejection", e.reason?.message || String(e.reason ?? ""), "", 0);
  captureError(e.reason, "", "", 0, 0, "rejection");
});

// The last few script errors, sent with a feedback report (also when the
// Errors report is off). Masked like the Errors report's messages.
const FEEDBACK_ERRORS_MAX = 10;
let feedbackErrors = [];
function noteFeedbackError(type, message, file, line) {
  const text = String(message || "").replace(/^Uncaught\s+/, "");
  if (!siteid || !text || (text === "Script error." && !file) || EXTENSION_URL.test(file || "")) return;
  feedbackErrors.push({
    type: String(type || "Error").slice(0, 64), message: errorMessage(text).slice(0, 500),
    file: file ? cleanUrl(file) : "", line: Number(line) || 0, at: Date.now(),
  });
  if (feedbackErrors.length > FEEDBACK_ERRORS_MAX) feedbackErrors.shift();
}

// JavaScript errors for the Errors report: uncaught exceptions, unhandled
// promise rejections and the ones your code reports itself
// (window.analytics.captureException), batched and sent with the page's fields.
// Each distinct error is sent once per page view, at most ERROR_PAGE_LIMIT per
// page view.
// URLs lose their query and hash; emails, tokens and long numbers in messages
// are masked (the collector masks again). Errors thrown by browser extensions
// and opaque cross-origin "Script error." are skipped. The collector says when
// the site has error tracking off, and nothing more is sent this session.
const ERROR_PAGE_LIMIT = 10;
const ERROR_FLUSH_MS = 2000;
const ERROR_STACK_MAX = 4000;
// Sent at once from this many waiting errors, so a request (with stacks and
// breadcrumbs) stays well under the 64 KB keepalive limit.
const ERROR_BATCH = 3;
const BREADCRUMB_MAX = 15;
const ERRORS_OFF_KEY = `analytics:errorsoff:${siteid}`;
// This session's replay decision (see startReplay).
const REPLAY_KEY = `analytics:replay:${siteid}`;
const EXTENSION_URL = /(?:chrome|moz|safari(?:-web)?|ms-browser)-extension:\/\//;
let errorsOff = false;
try {
  errorsOff = tabStore().getItem(ERRORS_OFF_KEY) === "1";
} catch { /* optional storage */ }

// Error tracking is off for this site. Kept for the session so the breadcrumb
// wrappers are not installed again on the next page view. Called both from the
// site config and from the reply to an error report, whichever comes first.
function errorsAreOff(enabled) {
  if (enabled !== false || errorsOff) return;
  errorsOff = true;
  try {
    tabStore().setItem(ERRORS_OFF_KEY, "1");
  } catch { /* optional storage */ }
}
let pageErrors = [];
let errorPageCount = 0;
const errorSeen = new Set();
let errorTimer = null;

// Query strings and hashes off every URL; ":line:col" after them is kept.
const errorUrls = (text) => text.replace(/(\b(?:https?|file):\/\/[^\s?#()]+)[?#][^\s():]*/g, "$1");
const errorMessage = (text) => errorUrls(text)
  .replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, "•••")
  .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "•••")
  .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "•••")
  .replace(/\d[\d -]{6,}\d/g, "•••");

function captureError(error, message, file, line, col, kind, typeName) {
  if (errorsOff || !siteid || navigator.webdriver || errorPageCount >= ERROR_PAGE_LIMIT) return;
  const isError = error instanceof Error || (error && typeof error === "object" && "message" in error);
  let text = isError ? String(error.message ?? "") : message;
  if (!isError && kind === "rejection") {
    try {
      text = typeof error === "string" ? error : JSON.stringify(error) ?? String(error);
    } catch {
      text = String(error);
    }
  }
  text = String(text || "").replace(/^Uncaught\s+/, "");
  if (!text || (text === "Script error." && !file)) return;
  const stack = isError && typeof error.stack === "string" ? error.stack : "";
  if (EXTENSION_URL.test(file || "") || EXTENSION_URL.test(stack.split("\n").find((l) => /:\d+:\d+/.test(l)) || "")) return;
  const type = typeName ||
    (isError && typeof error.name === "string" && error.name) ||
    (kind === "rejection" ? "UnhandledRejection" : "Error");
  const item = {
    message: errorMessage(text).slice(0, 500),
    error_type: type.slice(0, 64),
    kind,
    stack: errorUrls(stack).slice(0, ERROR_STACK_MAX),
    file: file ? cleanUrl(file) : "",
    line: Number(line) || 0,
    col: Number(col) || 0,
    url: lastTrackedPath || location.pathname,
    // Oldest first; `ms` is how long before the error each one happened.
    breadcrumbs: breadcrumbs.map(({ at, ...crumb }) => ({ ...crumb, ms: Math.max(0, Date.now() - at) })),
  };
  const key = `${item.error_type}|${item.message}|${item.file}|${item.line}`;
  if (errorSeen.has(key)) return;
  errorSeen.add(key);
  errorPageCount++;
  pageErrors.push(item);
  if (pageErrors.length >= ERROR_BATCH) flushErrors();
  else errorTimer ||= setTimeout(flushErrors, ERROR_FLUSH_MS);
}

// Breadcrumbs: the last BREADCRUMB_MAX things that happened before an error,
// sent with it. Clicks (the element and its label, never typed values), page
// changes, failed fetch/XHR requests (method, URL without query, status; 0 =
// network error) and console.error messages, masked like error messages.
// Requests to the collector are not recorded.
let breadcrumbs = [];
function addBreadcrumb(type, text, status) {
  if (errorsOff) return;
  breadcrumbs.push({ type, text: errorMessage(String(text || "")).slice(0, 200), ...(status !== undefined ? { status } : {}), at: Date.now() });
  if (breadcrumbs.length > BREADCRUMB_MAX) breadcrumbs.shift();
}

// The same wrappers feed a recording (replay.js shows them in the player):
// failed or slow requests, and console errors and warnings. The recorder only
// starts once the site config has arrived, and a request that fails while the
// page loads is often why it looks broken, so the page's first
// REPLAY_LOG_EARLY wait here for it. Nothing waits once they are handed over
// or the page is known not to be recorded.
const REPLAY_LOG_EARLY = 20;
const SLOW_REQUEST_MS = 3000;
let replayLogEarly = [];
// The running recorder's log(), set by startReplay.
let replayLog = null;
let replayLogDone = false;
const replayWants = () => Boolean(replayLog) || (!replayLogDone && replayLogEarly.length < REPLAY_LOG_EARLY);
function logForReplay(entry) {
  if (replayLog) replayLog(entry);
  else if (replayWants()) replayLogEarly.push({ ...entry, at: Date.now() });
}
// This page won't be recorded.
function noReplayLog() {
  replayLogDone = true;
  replayLogEarly = [];
}
// Neither breadcrumbs nor a recording want them: the wrappers pass straight through.
const hooksIdle = () => errorsOff && !replayWants();

// Same-origin requests by path, others by origin and path; never the query.
function requestDone(method, url, status, ms) {
  const failed = status >= 400 || status === 0;
  if (!failed && ms < SLOW_REQUEST_MS) return;
  const clean = cleanUrl(url);
  if (!clean || clean.startsWith(new URL(COLLECT_URL, location.href).origin)) return;
  const name = String(method || "GET").toUpperCase().slice(0, 10);
  if (failed) addBreadcrumb("request", `${name} ${clean}`, status);
  if (replayWants()) {
    const shown = clean.startsWith(`${location.origin}/`) ? clean.slice(location.origin.length) : clean;
    logForReplay({ k: "req", m: name, u: errorMessage(shown), s: status, d: Math.round(ms) });
  }
}

// A form's send that failed. For FORM_SEND_WATCH_MS after a submit
// (watchFormSend), the requests the page starts that change something (not a
// GET, not a keepalive beacon, not ours) are taken as the form's, and the last
// one answered decides: an error status, or no answer at all from the site's
// own server. A cross-origin request with no answer doesn't count: that is
// what an ad blocker does to a beacon sent with the submit. It is settled once
// no request is open for FORM_SEND_SETTLE_MS (settleFormSend), so one the site
// retries and gets through isn't a failure. An answer later than
// FORM_SEND_ANSWER_MS after the submit isn't judged.
const FORM_SEND_WATCH_MS = 5000;
const FORM_SEND_SETTLE_MS = 1000;
const FORM_SEND_ANSWER_MS = 30000;
// The submit being watched: { root, at, until, open, failure, timer }.
let formSend = null;
function formSendWatched() {
  return Boolean(formSend) && Date.now() < formSend.until;
}
// Called as a request starts; returns what to call with its status (null: no
// status to judge, such as an opaque answer or an abort), or null to skip it.
function formSendStarted(method, url, beacon) {
  const watch = formSend;
  if (!watch || Date.now() >= watch.until || beacon || /^(GET|HEAD|OPTIONS)$/i.test(String(method || "GET"))) return null;
  let target;
  try {
    target = new URL(url, location.href);
    if (target.href.startsWith(new URL(".", new URL(COLLECT_URL, location.href)).href)) return null;
  } catch {
    return null;
  }
  const own = target.origin === location.origin;
  watch.open++;
  clearTimeout(watch.timer);
  return (status) => {
    watch.open--;
    if (watch !== formSend) return;
    if (status !== null && (status !== 0 || own) && Date.now() - watch.at <= FORM_SEND_ANSWER_MS) {
      watch.failure = status >= 400 ? `HTTP ${status}` : status === 0 ? "No response" : "";
    }
    clearTimeout(watch.timer);
    if (!watch.open) watch.timer = setTimeout(() => settleFormSend(watch), FORM_SEND_SETTLE_MS);
  };
}

// A console line for a recording: text and Error messages only. A logged
// object can hold anything (a user's name and address), so it is only "{…}".
function consoleForReplay(level, args) {
  if (!replayWants()) return;
  const text = args.map((arg) => {
    if (arg instanceof Error) return arg.message;
    return typeof arg === "object" && arg !== null ? "{…}" : String(arg);
  }).join(" ");
  logForReplay({ k: "log", lv: level, x: errorMessage(text).slice(0, 300) });
}

// Breadcrumbs only ever feed JS error reports, and the request and console
// lines only recordings. A site with error tracking off pays for the wrappers
// below on the first page view of a visit and no more, unless the visit is
// being recorded: they go inert the moment the site config says errors are off
// and the page won't be recorded (every one of them re-checks hooksIdle), the
// errors answer is kept for the session, and later page views skip installing
// them at all. It cannot be skipped on the very first one, because the config
// arrives after this runs and what happened before it is what's worth having.
// A recording that starts on a page that skipped them installs them then
// (startReplay), without the page's early lines.
let hooksInstalled = false;
function installHooks() {
  if (hooksInstalled || !siteid || navigator.webdriver) return;
  hooksInstalled = true;
  document.addEventListener("click", (e) => {
    if (!e.isTrusted || errorsOff) return;
    const el = e.target?.closest?.(`${AUTO_CLICKABLE},input,select,textarea,label,summary,[role]`) || e.target;
    if (!el?.tagName) return;
    const tag = el.tagName.toLowerCase();
    const label = autoHidden(el) ? "(hidden)"
      : /^(input|select|textarea)$/.test(tag) ? fieldLabel(el)
        : autoText(el.getAttribute("aria-label") || el.innerText || el.getAttribute("title") || "");
    addBreadcrumb("click", label ? `${tag} "${label}"` : tag);
  }, true);

  installRequestHooks();

  const originalConsoleError = console.error;
  console.error = function (...args) {
    if (hooksIdle()) return originalConsoleError.apply(this, args);
    try {
      if (!errorsOff) {
        addBreadcrumb("console", args.map((arg) => {
          if (arg instanceof Error) return arg.message;
          if (typeof arg !== "object" || arg === null) return String(arg);
          try {
            return JSON.stringify(arg).slice(0, 200);
          } catch {
            return String(arg);
          }
        }).join(" "));
      }
      consoleForReplay("error", args);
    } catch { /* never break logging */ }
    return originalConsoleError.apply(this, args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = function (...args) {
    try {
      consoleForReplay("warn", args);
    } catch { /* never break logging */ }
    return originalConsoleWarn.apply(this, args);
  };
}
// The fetch and XHR wrappers. A form submit installs them too (when it is
// watched for a failed send), so they are in place before the site's own
// submit handler sends its request. Each request is judged as it starts: lines
// for breadcrumbs and recordings unless hooksIdle(), and the watched form's
// send (formSendStarted, with the form analytics) for one sent soon after a
// submit.
let requestHooksInstalled = false;
function installRequestHooks() {
  if (requestHooksInstalled || !siteid || navigator.webdriver) return;
  requestHooksInstalled = true;
  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      const start = Date.now();
      const promise = originalFetch.apply(this, arguments);
      const idle = hooksIdle();
      if (idle && !formSendWatched()) return promise;
      try {
        const url = typeof input === "string" ? input : input?.url || String(input);
        const method = init?.method || input?.method || "GET";
        const send = formSendStarted(method, url, Boolean(init?.keepalive || input?.keepalive));
        promise.then(
          // A no-cors response is opaque: status 0 though it arrived, and nothing to judge.
          (response) => {
            const status = response.type?.startsWith("opaque") ? null : response.status;
            if (!idle && status !== null) requestDone(method, url, status, Date.now() - start);
            send?.(status);
          },
          (error) => {
            const aborted = error?.name === "AbortError";
            if (!idle && !aborted) requestDone(method, url, 0, Date.now() - start);
            send?.(aborted ? null : 0);
          },
        );
      } catch { /* never break the page's request */ }
      return promise;
    };
  }

  if (typeof XMLHttpRequest === "function") {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const requests = new WeakMap();
    XMLHttpRequest.prototype.open = function (method, url) {
      if (!hooksIdle() || formSendWatched()) requests.set(this, { method, url: String(url), aborted: false });
      else requests.delete(this);
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      const request = requests.get(this);
      const idle = hooksIdle();
      const send = request ? formSendStarted(request.method, request.url, false) : null;
      if (request && (!idle || send)) {
        const start = Date.now();
        this.addEventListener("abort", () => { request.aborted = true; });
        this.addEventListener("loadend", () => {
          const status = this.status === 0 && request.aborted ? null : this.status;
          if (!idle && status !== null) requestDone(request.method, request.url, status, Date.now() - start);
          send?.(status);
        });
      }
      return originalSend.apply(this, arguments);
    };
  }
}

// A session the collector already said isn't recorded (the decision is kept
// for the tab only when it is) leaves them out with errors off.
let recordedSession = false;
try {
  recordedSession = JSON.parse(tabStore().getItem(REPLAY_KEY) || "null")?.record === true;
} catch { /* optional storage */ }
if (!errorsOff || recordedSession) installHooks();

// Errors before the first page view wait for it, so they carry its fields.
function flushErrors() {
  clearTimeout(errorTimer);
  errorTimer = null;
  if (!pageErrors.length || !data || !hasTrackedInitial || errorsOff) return;
  const { eventname, label, value, variant, eventid, metrics, ...page } = data;
  const payload = { ...page, errors: pageErrors, type: "js_error", session_id: analyticsSession.getId() };
  if (release) payload.release = release;
  pageErrors = [];
  const visitor = consentedVisitorId();
  if (visitor) payload.visitor = visitor;
  fetch(COLLECT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    body: JSON.stringify(payload),
    cache: "no-store",
    keepalive: true,
  }).then((response) => (response.ok ? response.json() : null)).then((result) => {
    errorsAreOff(result?.enabled);
  }).catch(() => {});
}

// Site health, for the Site health report. Not-found pages: the first page
// load's HTTP status (Navigation Timing's responseStatus, where the browser has
// it) or, for any page, a title that says it was not found, with the page that
// linked there. Accessibility: a few cheap checks of the rendered page, run
// once per path per session when the browser is idle. Samples are element
// descriptions (tag, id, class), never page text.
const HEALTH_SEEN_KEY = `analytics:health:${siteid}`;
const NOT_FOUND_TITLE = /\b404\b|page not found|not found|doesn['’]t exist|does not exist|no longer available/i;
const HEALTH_SAMPLE_MAX = 3;
let firstHealthCheck = true;

function sendHealth(fields) {
  if (!data || !hasTrackedInitial) return;
  const { eventname, label, value, variant, eventid, metrics, ...page } = data;
  sendanalytics({ ...page, ...fields }, "site_health");
}

// "/pricing" for links within the site, "google.com" for others, "" for none.
function linkingPage(ref) {
  if (!ref) return "";
  try {
    const from = new URL(ref, location.href);
    return from.host === location.host ? from.pathname : from.host;
  } catch {
    return "";
  }
}

function describe(el) {
  const id = el.id && !/\d{4,}/.test(el.id) ? `#${el.id}` : "";
  const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
  let extra = "";
  if (el.tagName === "IMG") {
    const src = (el.getAttribute("src") || "").split(/[?#]/)[0].split("/").pop();
    if (src && !src.startsWith("data:")) extra = `[src=${src.slice(0, 60)}]`;
  }
  return `${el.tagName.toLowerCase()}${id}${cls ? `.${cls.slice(0, 40)}` : ""}${extra}`;
}

const isHidden = (el) => el.closest("[hidden],[aria-hidden='true']") || (el.offsetParent === null && getComputedStyle(el).position !== "fixed");

function accessibleName(el) {
  if (el.getAttribute("aria-label")?.trim() || el.getAttribute("title")?.trim()) return true;
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby && labelledby.split(/\s+/).some((id) => document.getElementById(id)?.textContent.trim())) return true;
  if (el.textContent.trim()) return true;
  return [...el.querySelectorAll("img[alt],svg[aria-label],[aria-label]")].some((child) =>
    (child.getAttribute("alt") || child.getAttribute("aria-label") || "").trim());
}

// "rgb(1, 2, 3)" / "rgba(1, 2, 3, 0.5)" -> [r, g, b, a]
const parseColor = (value) => {
  const m = value.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?/);
  return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
};
const luminance = ([r, g, b]) => {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
// The first solid background behind an element, or null when an image or
// gradient is in the way and the contrast cannot be known.
function backgroundOf(el) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.backgroundImage !== "none") return null;
    const color = parseColor(style.backgroundColor);
    if (color && color[3] >= 1) return color;
    if (color && color[3] > 0) return null;
  }
  return [255, 255, 255, 1];
}

const A11Y_CHECKS = {
  // Images without alt text (decorative images should have alt="").
  img_alt: () => [...document.querySelectorAll("img:not([alt])")]
    .filter((el) => el.getAttribute("role") !== "presentation" && !isHidden(el)),
  // Form fields with no label.
  form_label: () => [...document.querySelectorAll("input,select,textarea")].filter((el) => {
    if (/^(hidden|submit|button|reset|image)$/i.test(el.type) || isHidden(el)) return false;
    if (el.labels?.length || el.getAttribute("aria-label")?.trim() || el.getAttribute("aria-labelledby") || el.getAttribute("title")) return false;
    return true;
  }),
  // Buttons with no text or label (icon-only buttons).
  button_name: () => [...document.querySelectorAll("button,[role='button'],input[type='button'],input[type='submit']")]
    .filter((el) => !isHidden(el) && !(el.tagName === "INPUT" && el.value?.trim()) && !accessibleName(el)),
  // Links with no text or label.
  link_name: () => [...document.querySelectorAll("a[href]")].filter((el) => !isHidden(el) && !accessibleName(el)),
  // No lang on <html>, so screen readers guess the language.
  html_lang: () => (document.documentElement.getAttribute("lang")?.trim() ? [] : [document.documentElement]),
  // No page title.
  page_title: () => (document.title.trim() ? [] : [document.documentElement]),
  // Heading levels that skip one (h2 straight to h4), or no h1.
  heading_order: () => {
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter((el) => !isHidden(el));
    const bad = [];
    let previous = 0;
    for (const el of headings) {
      const level = Number(el.tagName[1]);
      if (previous && level > previous + 1) bad.push(el);
      previous = level;
    }
    if (headings.length && !headings.some((el) => el.tagName === "H1")) bad.unshift(headings[0]);
    return bad;
  },
  // The same id on more than one element (breaks labels and aria references).
  duplicate_id: () => {
    const seen = new Map();
    for (const el of document.querySelectorAll("[id]")) {
      if (el.id) seen.set(el.id, (seen.get(el.id) || 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => document.getElementById(id));
  },
  // Pinch zoom turned off.
  zoom_disabled: () => {
    const meta = document.querySelector("meta[name='viewport']");
    const content = meta?.getAttribute("content") || "";
    const max = content.match(/maximum-scale\s*=\s*([\d.]+)/i);
    return /user-scalable\s*=\s*(no|0)/i.test(content) || (max && Number(max[1]) < 2) ? [meta] : [];
  },
  // Text below WCAG AA contrast (4.5:1, or 3:1 for large text). Checks at
  // most 400 elements that hold text directly.
  contrast: () => {
    const bad = [];
    let checked = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const done = new Set();
    for (let node = walker.nextNode(); node && checked < 400; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || done.has(el) || !node.textContent.trim() || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
      done.add(el);
      if (isHidden(el)) continue;
      checked++;
      const style = getComputedStyle(el);
      const fg = parseColor(style.color);
      const bg = backgroundOf(el);
      if (!fg || !bg || fg[3] < 1 || Number(style.opacity) < 1) continue;
      const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) bad.push(el);
    }
    return bad;
  },
};

// Scripts from other sites, for the Scripts report: the host and address (no
// query string) of each <script src> and each script the browser fetched,
// which covers ones added by other scripts (tag managers, injected code).
// The site's own subdomains and this tracker's hosts are first-party.
// Scripts that arrive after the page's check are sent as they load.
const SCRIPTS_MAX = 50;
const LATE_SCRIPTS_WAIT_MS = 2000;
const siteBase = host.replace(/^www\./, "");
const ownHosts = new Set([current?.src, COLLECT_URL].map((src) => {
  try { return new URL(src, location.href).hostname; } catch { return ""; }
}));
// Hosts already sent, per path, in this page load.
const scriptsSent = new Map();

function thirdPartyScript(src) {
  try {
    const url = new URL(src, location.href);
    const name = url.hostname;
    if (!/^https?:$/.test(url.protocol) || name === siteBase || name.endsWith(`.${siteBase}`) || ownHosts.has(name)) return null;
    return { host: name, src: `${url.origin}${url.pathname}`.slice(0, 300) };
  } catch {
    return null;
  }
}

// The scripts on `path` not sent for it yet, marked as sent.
function unsentScripts(path, srcs) {
  const sent = scriptsSent.get(path) || new Set();
  scriptsSent.set(path, sent);
  const out = [];
  for (const src of srcs) {
    const script = thirdPartyScript(src);
    if (!script || sent.has(script.host) || out.length >= SCRIPTS_MAX) continue;
    sent.add(script.host);
    out.push(script);
  }
  return out;
}

function pageScripts(path) {
  const srcs = [...document.scripts].map((script) => script.src).filter(Boolean);
  try {
    for (const entry of performance.getEntriesByType("resource")) if (entry.initiatorType === "script") srcs.push(entry.name);
  } catch { /* no Resource Timing */ }
  return unsentScripts(path, srcs);
}

let lateScripts = [];
let lateTimer = 0;
function watchLateScripts() {
  if (!siteid || navigator.webdriver) return;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (entry.initiatorType === "script") lateScripts.push(entry.name);
      if (!lateScripts.length || lateTimer) return;
      lateTimer = setTimeout(() => {
        const path = lastTrackedPath;
        // Only for a page whose check has run: until then, it picks these up itself.
        const found = scriptsSent.has(path) ? unsentScripts(path, lateScripts) : [];
        lateScripts = [];
        lateTimer = 0;
        if (found.length) sendHealth({ url: path, scripts: found });
      }, LATE_SCRIPTS_WAIT_MS);
    }).observe({ type: "resource" });
  } catch { /* no Resource Timing */ }
}
watchLateScripts();

// An element's selector for the dashboard to pin a finding to, or "" when it
// is too long to send whole: one cut short can point at another element.
const selectorOf = (el) => {
  const selector = heatmapSelector(el);
  return selector.length <= 300 ? selector : "";
};

function runA11yChecks(path) {
  let seen = [];
  try {
    seen = JSON.parse(tabStore().getItem(HEALTH_SEEN_KEY) || "[]");
  } catch { /* optional storage */ }
  if (seen.includes(path) || skipReport()) return;
  const issues = [];
  for (const [rule, check] of Object.entries(A11Y_CHECKS)) {
    try {
      const found = check().filter(Boolean);
      // Each sample with the element's path (the heatmap's selector), so the
      // dashboard can point at it on the page's copy. No text either way.
      const picked = found.slice(0, HEALTH_SAMPLE_MAX);
      if (found.length) issues.push({ rule, count: found.length, samples: picked.map(describe), selectors: picked.map(selectorOf) });
    } catch { /* one check failing should not stop the rest */ }
  }
  // Sent with no issues too, so the report knows the page was checked.
  let scripts = [];
  try {
    scripts = pageScripts(path);
  } catch { /* optional */ }
  sendHealth({ url: path, a11y: issues, scripts });
  try {
    tabStore().setItem(HEALTH_SEEN_KEY, JSON.stringify([...seen, path].slice(-100)));
  } catch { /* optional storage */ }
}

function checkSiteHealth(path, ref) {
  if (!siteid || navigator.webdriver) return;
  const from = linkingPage(firstHealthCheck ? document.referrer : ref);
  let status = 0;
  if (firstHealthCheck) {
    try {
      status = performance.getEntriesByType("navigation")[0]?.responseStatus || 0;
    } catch { /* no Navigation Timing */ }
  }
  firstHealthCheck = false;
  // Single-page apps set the title after the route renders, so wait a moment.
  setTimeout(() => {
    if (lastTrackedPath !== path) return;
    if (status === 404 || status === 410 || NOT_FOUND_TITLE.test(document.title)) {
      sendHealth({ url: path, not_found: { status: status >= 400 ? status : 0, from } });
      return; // An error page's accessibility is not the site's.
    }
    if (status >= 400) return;
    const run = () => { if (lastTrackedPath === path) runA11yChecks(path); };
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 5000 });
    else run();
  }, 1500);
}

try {
  if (PerformanceObserver.supportedEntryTypes?.includes("event")) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name !== "click" || entry.duration < SLOW_CLICK_MS) continue;
        const hit = latestClicks.find((c) => Math.abs(c.stamp - entry.startTime) < 2);
        if (hit) hit.click.is_slow = 1;
      }
    }).observe({ type: "event", durationThreshold: SLOW_CLICK_MS });
  }
} catch { /* no Event Timing */ }

// Failed attempts per form in this page view. The browser fires "invalid" on
// every bad field (and on script validity checks), so only the first one
// right after a submit click or Enter counts.
const formFailures = new WeakMap();
let submitIntent = { form: null, at: 0 };
// `sent` and `why`: as formAnalyticsFailed takes them.
function formFailed(form, sent = false, why = "") {
  if (!formAnalyticsFailed(form, sent, why)) return;
  const failures = (formFailures.get(form) || 0) + 1;
  formFailures.set(form, failures);
  if (failures === 2) addSignal("form_fail", autoHidden(form) ? "(hidden)" : formLabel(form));
}
document.addEventListener("click", (e) => {
  const button = e.target?.closest?.("button:not([type=button]):not([type=reset]),input[type=submit],input[type=image]");
  if (e.isTrusted && button?.form) submitIntent = { form: button.form, at: Date.now() };
}, true);
document.addEventListener("keydown", (e) => {
  if (e.isTrusted && e.key === "Enter" && e.target?.form && e.target.tagName === "INPUT") {
    submitIntent = { form: e.target.form, at: Date.now() };
  }
}, true);
document.addEventListener("invalid", (e) => {
  const form = e.target?.form;
  if (!e.isTrusted || !form || submitIntent.form !== form || Date.now() - submitIntent.at > 500) return;
  submitIntent = { form: null, at: 0 };
  formFailed(form);
}, true);
document.addEventListener("submit", (e) => {
  const form = e.target;
  if (!(e.isTrusted || shieldResubmits.has(form)) || !(form instanceof HTMLFormElement)) return;
  const href = location.href;
  setTimeout(() => {
    if (!form.isConnected || location.href !== href || document.visibilityState === "hidden") return;
    if (form.querySelector("[aria-invalid=true],:invalid")) formFailed(form, true);
  }, FORM_CHECK_MS);
}, true);

function markRage(click, x, y) {
  const now = Date.now();
  recentHeatmapClicks = recentHeatmapClicks.filter((c) => now - c.at <= RAGE_MS);
  recentHeatmapClicks.push({ click, x, y, at: now });
  const near = recentHeatmapClicks.filter((c) => Math.abs(c.x - x) <= RAGE_PX && Math.abs(c.y - y) <= RAGE_PX);
  if (near.length >= RAGE_CLICKS) for (const c of near) c.click.is_rage = 1;
}

// Watches the page only while a check runs.
function checkDead(click, target, e) {
  if (e.detail > 1 || target.closest(NOT_DEAD) || typeof MutationObserver === "undefined") return;
  const clicked = e.target?.nodeType === 1 ? e.target : target;
  if (!looksClickable(clicked)) return;
  const at = Date.now();
  const href = location.href;
  const scrollY = window.scrollY;
  deadObserver = deadObserver || new MutationObserver(() => { lastPageChange = Date.now(); });
  if (deadChecks++ === 0) {
    deadObserver.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  }
  setTimeout(() => {
    if (--deadChecks === 0) deadObserver.disconnect();
    if (lastPageChange >= at || location.href !== href || window.scrollY !== scrollY ||
        document.visibilityState === "hidden") return;
    click.is_dead = 1;
  }, DEAD_MS);
}

let scrollDirection = 0;
let scrollTurnY = 0;
let lastScrollY = 0;
let scrollTurns = [];
window.addEventListener("scroll", () => {
  const y = window.scrollY;
  const direction = Math.sign(y - lastScrollY);
  lastScrollY = y;
  if (!direction || direction === scrollDirection) return;
  // A flip counts after scrolling at least 100px the other way.
  if (scrollDirection && Math.abs(y - scrollTurnY) > 100) {
    const now = Date.now();
    scrollTurns = scrollTurns.filter((t) => now - t < 3000);
    scrollTurns.push(now);
    if (scrollTurns.length >= 4) {
      scrollTurns = [];
      addSignal("excessive_scroll");
    }
  }
  scrollDirection = direction;
  scrollTurnY = y;
}, { passive: true });

let mouseDirection = 0;
let mouseX = 0;
let mouseTurns = [];
document.addEventListener("mousemove", (e) => {
  const dx = e.clientX - mouseX;
  mouseX = e.clientX;
  // Only fast movement: 15px or more between two mouse events.
  if (Math.abs(dx) < 15) return;
  const direction = Math.sign(dx);
  if (direction === mouseDirection) return;
  mouseDirection = direction;
  const now = Date.now();
  mouseTurns = mouseTurns.filter((t) => now - t < 1500);
  mouseTurns.push(now);
  if (mouseTurns.length >= 8) {
    mouseTurns = [];
    addSignal("mouse_thrash");
  }
}, { passive: true });

//. AUTOMATIC EVENTS ----------------------------------------------
// Button and link clicks, form submits, field changes and dropdown/checkbox
// changes as events, without tagging. Sent with the heatmap clicks; the
// collector keeps them (in their own table, analytics_auto_events) only for
// sites that turned automatic events on. Each one counts once per page view. Only a
// control's own label is sent, never what was typed or chosen (a checkbox
// sends checked/unchecked). Elements with data-analytics-event are already
// tracked and skipped.
const AUTO_CLICKABLE = "a[href],button,[role=button],input[type=submit],input[type=button]";
const AUTO_PAGE_LIMIT = 30;
let autoEvents = [];
let autoPageEvents = 0;
const autoSeen = new Set();
// Learned from the snapshot claim; strict hides all page text.
let siteMasking = "balanced";

function autoText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, 80);
  return text.replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, "•••").replace(/\d[\d -]{6,}\d/g, "•••");
}
function autoHidden(el) {
  return siteMasking === "strict" || Boolean(el.closest?.("[data-noanalytics],[contenteditable='true'],[contenteditable='']"));
}
function fieldLabel(el) {
  const byFor = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
  return autoText(
    el.getAttribute("aria-label") || byFor?.innerText || el.closest("label")?.innerText ||
    el.getAttribute("placeholder") || el.getAttribute("name") || el.id,
  );
}
function formLabel(form) {
  const heading = form.querySelector("legend,h1,h2,h3,h4");
  let action = "";
  try {
    action = new URL(form.getAttribute("action") || "", location.href).pathname;
  } catch { /* no action */ }
  return autoText(
    form.getAttribute("aria-label") || form.getAttribute("name") || form.id || heading?.innerText || action || "form",
  );
}
const AUTO_PREFIX = { click: "Click", form: "Form", field: "Field", select: "Select", checkbox: "Checkbox" };
function pushAuto(event) {
  const key = `${event.t}:${event.n}:${event.s || ""}`;
  if (!event.n || autoPageEvents >= AUTO_PAGE_LIMIT || autoSeen.has(key)) return;
  autoSeen.add(key);
  autoPageEvents++;
  autoEvents.push({ ...event, at: performance.now() });
  // Session replays can use automatic events as triggers (same name as stored).
  document.dispatchEvent(new CustomEvent("analytics-auto", { detail: { eventname: `${AUTO_PREFIX[event.t]}: ${event.n}` } }));
  if (autoEvents.length >= HEATMAP_BATCH) sendHeatmapClicks();
}

document.addEventListener("click", (e) => {
  if (!e.isTrusted || navigator.webdriver) return;
  const el = e.target?.closest?.(AUTO_CLICKABLE);
  if (!el || el.closest("[data-analytics-event]")) return;
  const label = autoHidden(el) ? "(hidden)" : autoText(
    el.getAttribute("aria-label") || el.innerText || el.value || el.getAttribute("title") ||
    el.querySelector("img[alt]")?.getAttribute("alt"),
  );
  pushAuto({ t: "click", n: label });
}, true);

document.addEventListener("submit", (e) => {
  const form = e.target;
  if (!(e.isTrusted || shieldResubmits.has(form)) || !(form instanceof HTMLFormElement)) return;
  pushAuto({ t: "form", n: autoHidden(form) ? "(hidden)" : formLabel(form) });
}, true);

document.addEventListener("change", (e) => {
  const el = e.target;
  if (!e.isTrusted || !el?.tagName) return;
  const type = (el.type || "").toLowerCase();
  if (type === "hidden") return;
  const label = autoHidden(el) ? "(hidden)" : fieldLabel(el);
  if (type === "checkbox") {
    pushAuto({ t: "checkbox", n: label, s: el.checked ? "checked" : "unchecked" });
  } else if (type === "radio" || el.tagName === "SELECT") {
    // The group's name only: the chosen option can be personal.
    pushAuto({ t: "select", n: type === "radio" ? autoText(el.getAttribute("name")) || label : label });
  } else if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    // That the field was filled in, never its contents.
    pushAuto({ t: "field", n: label });
  }
}, true);

//. FORM ANALYTICS ------------------------------------------------
// Views, starts, fields reached, time in each field, corrections, submits and
// errors per form, for drop-off by field.
// Any <form> on the page counts, or a container marked
// data-analytics-form="Name" (also for forms built without a <form> tag:
// a click on [type=submit] or [data-analytics-submit] inside it is the
// submit). data-analytics-step="2" on a container names a multi-step form's
// step. data-analytics-success on a thank-you message marks a submit that
// went through when it shows up after the submit; with a form's name
// (data-analytics-success="Name") on a thank-you page, that form's submit.
// data-analytics-error does the same for an error message: a submit that
// wasn't sent. A request that failed after a submit says so too (formSend).
// Only labels, positions and yes/no flags (left empty, autofilled, pasted)
// are sent, never what was typed. Sent with the heatmap clicks.
// Site search boxes are not forms worth reporting and are skipped.
const FORM_PAGE_LIMIT = 150;
// A focus shorter than this (tabbing through) sends no time in field.
const FORM_DWELL_MIN_MS = 300;
// Forms on screen are looked for twice after each pageview: late renders too.
const FORM_VIEW_DELAYS = [1500, 5000];
const FORM_ERRORS_MAX = 5;
// Fields left empty or autofilled, sent with a submit.
const FORM_FILL_MAX = 20;
// A thank-you or error message is looked for this long after a submit.
const FORM_OUTCOME_DELAYS = [1500, 5000];
const FORM_FIELDS = "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]),select,textarea";
let formEvents = [];
let formPageEvents = 0;
let formStates = new WeakMap();
let focusedField = null;
let formViewObserver = null;
let formViewTimers = [];

const formRoot = (el) => el?.closest?.("[data-analytics-form]") || el?.form || null;
// A radio group is one field.
const fieldSlot = (el) => (el.type === "radio" && el.name ? `radio:${el.name}` : el);
function fieldSlots(root) {
  const slots = [];
  for (const el of root.querySelectorAll(FORM_FIELDS)) {
    const slot = fieldSlot(el);
    if (!slots.includes(slot)) slots.push(slot);
  }
  return slots;
}
function formState(root) {
  let state = formStates.get(root);
  if (!state) {
    // A captured form's name too, so the Forms page lines up its submissions.
    const marked = root.getAttribute("data-analytics-form") || root.getAttribute("data-analytics-capture");
    const slots = fieldSlots(root);
    state = {
      key: autoText(marked) || (autoHidden(root) ? "(hidden)" : formLabel(root)),
      reached: new Set(),
      at: Date.now(),
      viewed: false,
      viewedAt: 0,
      search: !marked && (root.matches("[role=search]") ||
        (slots.length > 0 && slots.every((slot) => typeof slot !== "string" && slot.type === "search"))),
    };
    formStates.set(root, state);
  }
  return state;
}
function formFieldLabel(el, index) {
  if (autoHidden(el)) return `Field ${index + 1}`;
  const label = el.type === "radio" ? autoText(el.getAttribute("name")) || fieldLabel(el) : fieldLabel(el);
  return label || `Field ${index + 1}`;
}
function pushForm(event) {
  if (formPageEvents >= FORM_PAGE_LIMIT) return;
  formPageEvents++;
  formEvents.push({ ...event, at: performance.now() });
  if (formEvents.length >= HEATMAP_BATCH) sendHeatmapClicks();
}
const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
function autofilled(el) {
  for (const selector of [":autofill", ":-webkit-autofill"]) {
    try {
      return el.matches(selector);
    } catch { /* not supported: try the next */ }
  }
  return false;
}
// A field with no answer: a blank text, no option chosen, no file, no radio
// in the group checked. Checkboxes are answers either way.
function fieldEmpty(el, root) {
  if (el.type === "checkbox") return false;
  if (el.type === "radio") return !root.querySelector(`input[type=radio][name="${CSS.escape(el.name)}"]:checked`);
  if (el.type === "file") return !el.files?.length;
  return !String(el.value || "").trim();
}
function formSubmitted(root) {
  const state = formState(root);
  if (state.search) return;
  state.failed = false;
  watchFormSend(root);
  const slots = fieldSlots(root);
  pushForm({ k: "submit", f: state.key, c: slots.length, ft: state.reached.size, ms: Date.now() - state.at });
  // Which visible fields were sent empty or filled in by the browser.
  let sent = 0;
  slots.forEach((slot, index) => {
    if (sent >= FORM_FILL_MAX) return;
    const el = typeof slot === "string" ? root.querySelector(`input[type=radio][name="${CSS.escape(slot.slice(6))}"]`) : slot;
    if (!el || !shown(el)) return;
    const empty = fieldEmpty(el, root);
    const auto = !empty && autofilled(el);
    if (!empty && !auto) return;
    sent++;
    pushForm({ k: "fill", f: state.key, n: formFieldLabel(el, index), i: index, c: slots.length, st: formStep(el), e: empty ? 1 : 0, af: auto ? 1 : 0 });
  });
  watchFormOutcome(root, state);
}
// An error message with text in it, on screen.
const errorShowing = (el) => shown(el) && Boolean(el.innerText.trim());
// Sent: a thank-you message that was not on screen at the submit and is soon
// after. Not sent: an error message that wasn't showing at the submit, or
// said something else then, and is soon after (sites often keep an empty
// error box on the page and fill it in).
function watchFormOutcome(root, state) {
  const ours = (el, attribute) => {
    const name = autoText(el.getAttribute(attribute));
    if (name) return name.toLowerCase() === state.key.toLowerCase();
    // Unnamed: inside this form, or on its own (not in another form).
    return root.contains(el) || !el.closest("form,[data-analytics-form]");
  };
  const before = new Set([...document.querySelectorAll("[data-analytics-success]")].filter(shown));
  const errorsBefore = new Map([...document.querySelectorAll("[data-analytics-error]")]
    .filter(errorShowing).map((el) => [el, el.innerText.trim()]));
  const href = location.href;
  let done = false;
  for (const delay of FORM_OUTCOME_DELAYS) {
    setTimeout(() => {
      if (done || location.href !== href) return;
      const found = [...document.querySelectorAll("[data-analytics-success]")]
        .some((el) => !before.has(el) && shown(el) && ours(el, "data-analytics-success"));
      if (found) {
        done = true;
        pushForm({ k: "success", f: state.key });
        return;
      }
      const error = [...document.querySelectorAll("[data-analytics-error]")].find((el) =>
        errorShowing(el) && errorsBefore.get(el) !== el.innerText.trim() && ours(el, "data-analytics-error"));
      if (!error) return;
      done = true;
      sendFailed(root, sendErrorText(error, root));
    }, delay);
  }
}
// A page view showing a form's outcome: a thank-you page
// (data-analytics-success="Form name"), or a page a form posted to that shows
// why it wasn't sent (data-analytics-error="Form name", or in the form).
function checkThankYouPage() {
  const names = new Set();
  for (const el of document.querySelectorAll("[data-analytics-success]")) {
    const name = autoText(el.getAttribute("data-analytics-success"));
    if (name && shown(el) && !el.closest("form,[data-analytics-form]")) names.add(name);
  }
  for (const name of names) pushForm({ k: "success", f: name });
  const failed = new Set();
  for (const el of document.querySelectorAll("[data-analytics-error]")) {
    if (!errorShowing(el)) continue;
    const name = autoText(el.getAttribute("data-analytics-error"));
    const root = el.closest("[data-analytics-form]") || el.closest("form");
    if (!name && root && !failed.has(root)) {
      failed.add(root);
      sendFailed(root, sendErrorText(el, root));
    } else if (name && !failed.has(name.toLowerCase())) {
      failed.add(name.toLowerCase());
      pushForm({ k: "fail", f: name, m: sendErrorText(el, root || document.body) });
    }
  }
}
// The watched send (formSendStarted) for this submit.
function watchFormSend(root) {
  if (formSend) clearTimeout(formSend.timer);
  formSend = { root, at: Date.now(), until: Date.now() + FORM_SEND_WATCH_MS, open: 0, failure: "", timer: 0 };
  installRequestHooks();
}
// Records the watched send's failure, if its last answer was one.
function settleFormSend(watch) {
  clearTimeout(watch.timer);
  const why = watch.failure;
  watch.failure = "";
  if (why) sendFailed(watch.root, why);
}
// A submit that wasn't sent. Fields the site marked invalid with it (a server
// that checked them) make it a validation error, not a failed send.
function sendFailed(root, why) {
  if (root.querySelector("[aria-invalid=true]")) formFailed(root, true);
  else formFailed(root, true, why);
}
// Called on every failed attempt, with the fields still invalid. After a
// submit (sent) only the first failure counts, since a failed request, an
// error message and fields marked invalid can all follow the same one. A
// failed send says why (why: never empty, which is what tells it apart from
// a validation error) and has no invalid fields to list. False when it
// didn't count.
function formAnalyticsFailed(form, sent = false, why = "") {
  const root = formRoot(form) || form;
  const state = formState(root);
  if (state.search) return true;
  if (sent && state.failed) return false;
  state.failed = true;
  const slots = fieldSlots(root);
  pushForm({ k: "fail", f: state.key, c: slots.length, ft: state.reached.size, ms: Date.now() - state.at, ...(why ? { m: why } : {}) });
  if (why) return true;
  const invalid = [...root.querySelectorAll(FORM_FIELDS)].filter((el) => el.matches(":invalid,[aria-invalid=true]"));
  const seen = new Set();
  for (const el of invalid) {
    const index = slots.indexOf(fieldSlot(el));
    if (index < 0 || seen.has(index) || seen.size >= FORM_ERRORS_MAX) continue;
    seen.add(index);
    pushForm({
      k: "error", f: state.key, n: formFieldLabel(el, index), i: index, c: slots.length, st: formStep(el),
      m: fieldErrorMessage(el),
    });
  }
  return true;
}
// Text the page shows, with the values given cut out of it, and anything
// quoted, emails and long numbers.
function maskShown(text, values) {
  for (const value of values) if (value.length >= 2) text = text.split(value).join("…");
  return autoText(text.replace(/(["'“‘«]).*?(["'”’»])/g, "$1…$2"));
}
// The message shown for an invalid field: the site's own (aria-errormessage,
// aria-describedby) or the browser's. Whatever was typed is cut out of it.
function fieldErrorMessage(el) {
  if (autoHidden(el)) return "";
  let text = "";
  const ids = `${el.getAttribute("aria-errormessage") || ""} ${el.getAttribute("aria-describedby") || ""}`.trim();
  for (const id of ids ? ids.split(/\s+/) : []) {
    const node = document.getElementById(id);
    text = node && shown(node) ? node.innerText.trim() : "";
    if (text) break;
  }
  text = text || el.validationMessage || "";
  return maskShown(text, [typeof el.value === "string" ? el.value.trim() : ""]);
}
// A failed send's error message, with everything typed into the form cut out
// (only values of 3 characters or more: shorter ones would cut up the words).
function sendErrorText(el, root) {
  if (autoHidden(el)) return "Error message shown";
  const typed = [...root.querySelectorAll(FORM_FIELDS)].filter(typedField)
    .map((field) => field.value.trim()).filter((value) => value.length >= 3);
  return maskShown(el.innerText, typed) || "Error message shown";
}
// A field the visitor types into, so its value is what they typed.
const typedField = (el) => el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !/^(checkbox|radio|file)$/i.test(el.type));
const formStep = (el) => autoText(el.closest("[data-analytics-step]")?.getAttribute("data-analytics-step"));

document.addEventListener("focusin", (e) => {
  const el = e.target;
  if (!e.isTrusted || navigator.webdriver || !el?.matches?.(FORM_FIELDS)) return;
  const root = formRoot(el);
  if (!root) return;
  const state = formState(root);
  if (state.search) return;
  const slots = fieldSlots(root);
  const index = slots.indexOf(fieldSlot(el));
  if (index < 0) return;
  // Kept in the browser only: to tell a corrected value from a first entry.
  const typed = typedField(el);
  const revisit = state.reached.has(index);
  focusedField = { el, state, index, count: slots.length, at: Date.now(), before: typed ? el.value : null, revisit, pasted: false };
  if (revisit) return;
  const first = !state.reached.size;
  if (first) state.at = Date.now();
  state.reached.add(index);
  pushForm({
    k: "field", f: state.key, n: formFieldLabel(el, index), i: index, c: slots.length,
    st: formStep(el), ms: Date.now() - state.at,
    // The first field only: time from the form showing on screen to starting it.
    ...(first && state.viewedAt ? { w: Math.min(Date.now() - state.viewedAt, 2 * 60 * 60 * 1000) } : {}),
  });
}, true);
document.addEventListener("paste", (e) => {
  if (e.isTrusted && focusedField?.el === e.target) focusedField.pasted = true;
}, true);

// Time in the field, whether a value already there was changed (a
// correction), whether something was pasted and whether the visitor came
// back to it. Also sent when the page is hidden mid-field.
function leaveField() {
  const field = focusedField;
  focusedField = null;
  if (!field?.el.isConnected) return;
  const ms = Date.now() - field.at;
  const corrected = Boolean(field.before) && field.el.value !== field.before;
  if (ms < FORM_DWELL_MIN_MS && !corrected && !field.pasted) return;
  pushForm({
    k: "blur", f: field.state.key, n: formFieldLabel(field.el, field.index), i: field.index, c: field.count,
    st: formStep(field.el), fm: Math.min(ms, 10 * 60 * 1000), r: corrected ? 1 : 0,
    p: field.pasted ? 1 : 0, rv: field.revisit ? 1 : 0,
  });
}
document.addEventListener("focusout", (e) => {
  if (e.isTrusted && focusedField?.el === e.target) leaveField();
}, true);

// A view: at least part of the form was on screen.
function formViewed(root) {
  const state = formState(root);
  if (state.viewed || state.search) return;
  const count = fieldSlots(root).length;
  if (!count) return;
  state.viewed = true;
  state.viewedAt = Date.now();
  pushForm({ k: "view", f: state.key, c: count });
}
function watchFormViews() {
  if (typeof IntersectionObserver === "undefined") return;
  formViewObserver = formViewObserver || new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      formViewObserver.unobserve(entry.target);
      formViewed(entry.target);
    }
  });
  const roots = new Set([...document.querySelectorAll("form,[data-analytics-form]")]
    .map((el) => el.closest("[data-analytics-form]") || el));
  for (const root of roots) {
    if (!formStates.get(root)?.viewed) formViewObserver.observe(root);
  }
}
function scheduleFormViews() {
  formViewObserver?.disconnect();
  for (const timer of formViewTimers) clearTimeout(timer);
  formViewTimers = FORM_VIEW_DELAYS.map((delay) => setTimeout(watchFormViews, delay));
  formViewTimers.push(setTimeout(checkThankYouPage, FORM_VIEW_DELAYS[0]));
}

document.addEventListener("submit", (e) => {
  const form = e.target;
  if (!(e.isTrusted || shieldResubmits.has(form)) || !(form instanceof HTMLFormElement)) return;
  formSubmitted(formRoot(form) || form);
}, true);

// Marked containers without a <form> have no submit event.
document.addEventListener("click", (e) => {
  if (!e.isTrusted) return;
  const button = e.target?.closest?.("[type=submit],[data-analytics-submit]");
  const root = button?.closest("[data-analytics-form]");
  if (root && !button.form) formSubmitted(root);
}, true);

function recordHeatmapClick(e) {
  if (!e.isTrusted || navigator.webdriver || heatmapsOff ||
      heatmapPageClicks >= HEATMAP_PAGE_LIMIT) return;
  const target = e.target?.closest?.(HEATMAP_TARGET) || e.target;
  if (!target || target.nodeType !== 1 || target === document.documentElement) return;
  const selector = heatmapSelector(target);
  if (!selector) return;
  const rect = target.getBoundingClientRect();
  // Keyboard activation (Enter/Space) reports 0,0: use the element's centre.
  const keyboard = e.detail === 0 && e.clientX === 0 && e.clientY === 0;
  const clientX = keyboard ? rect.left + rect.width / 2 : e.clientX;
  const clientY = keyboard ? rect.top + rect.height / 2 : e.clientY;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const click = {
    selector,
    tag: target.tagName.toLowerCase(),
    el_x: basisPoints((clientX - rect.left) / rect.width),
    el_y: basisPoints((clientY - rect.top) / rect.height),
    x: basisPoints(clientX / viewportWidth),
    y: Math.max(0, Math.round(clientY + window.scrollY)),
    viewport_width: viewportWidth,
    page_height: document.documentElement.scrollHeight,
    at: performance.now(),
  };
  heatmapClicks.push(click);
  latestClicks = [...latestClicks.slice(-9), { click, at: Date.now(), stamp: e.timeStamp }];
  // Quick clicks around a canvas chart or map are normal use (picking points, zooming).
  if (!keyboard && click.tag !== "canvas") markRage(click, clientX, clientY);
  checkDead(click, target, e);
  heatmapPageClicks++;
  if (heatmapClicks.length >= HEATMAP_BATCH) sendHeatmapClicks();
}

//. COPIED TEXT ---------------------------------------------------
// What visitors copy from the page: how much, a short snippet (masked like
// automatic event labels), the kind of element it came from, and how: keys
// (Ctrl/Cmd+C or X), the right-click menu, a copy button, or other (the
// browser's own menu). Text copied out of fields (what the visitor typed) is
// never sent, and a copy button sends only its own label and the length:
// it may hand out keys or codes. Sent with the heatmap clicks; the collector
// keeps them unless the site turned copy tracking off, and drops snippets on
// strict-masking sites. With attribution on, a long enough copy of page text
// (never code) gets a "Read more at <link>" line, the link tagged
// utm_source=copy so the visits it brings back are counted.
const COPY_PAGE_LIMIT = 20;
const COPY_KEYS_MS = 1500;
const COPY_MENU_MS = 10000;
const ATTRIBUTION_MIN_CHARS = 40;
const COPY_FIELDS = "input,textarea,select,[contenteditable='true'],[contenteditable='']";
const COPY_KINDS = [
  ["pre,code", "code"], ["h1,h2,h3,h4,h5,h6", "heading"], ["a", "link"], ["td,th", "table"],
  ["li", "list"], ["blockquote", "quote"],
];
let copyEvents = [];
let copyPageEvents = 0;
let copyKeysAt = 0;
let copyMenuAt = 0;
let copyClick = { label: "", at: 0 };
// { attribution, text, protect } from the site config; null when both are off.
let copySettings = null;

function pushCopy(event) {
  if (copyPageEvents >= COPY_PAGE_LIMIT || navigator.webdriver) return;
  copyPageEvents++;
  copyEvents.push({ ...event, at: performance.now() });
}
function copiedByButton(chars) {
  if (Date.now() - copyClick.at > COPY_KEYS_MS) return;
  pushCopy({ h: "button", k: "button", n: chars, l: copyClick.label });
}
// The page's link without campaign tags or click ids, tagged as a copy.
function attributionUrl() {
  const url = new URL(location.href);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|gclid$|fbclid$|msclkid$|ttclid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.set("utm_source", "copy");
  url.searchParams.set("utm_medium", "copy");
  return url.href;
}
const escapeCopyHtml = (value) =>
  value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

document.addEventListener("keydown", (e) => {
  if (e.isTrusted && (e.ctrlKey || e.metaKey) && /^[cx]$/i.test(e.key)) copyKeysAt = Date.now();
}, true);
//. CONTENT PROTECTION --------------------------------------------
// For sites that turn it on (Copied text → Settings). "images": no
// right-click, dragging or long-press save on images. "page": that, plus no
// right-click or copying anywhere. In either mode, [data-analytics-protect]
// areas can't be selected, copied or right-clicked. Links (right-click to
// open in a new tab), form fields and editable text always work. Each
// blocked attempt is sent as a copy with how "blocked". This only stops
// casual copying: page source, screenshots and scrapers get around it.
const PROTECT_MEDIA = "img,picture,video";
const PROTECT_AREA = "[data-analytics-protect]";
const protectMode = () => (copySettings?.protect === "images" || copySettings?.protect === "page" ? copySettings.protect : "");
// The image's alt text, or its file name.
function imageName(el) {
  const img = el.matches("img") ? el : el.querySelector("img");
  const alt = img?.getAttribute("alt");
  if (alt) return autoText(alt);
  try {
    return autoText(decodeURIComponent(new URL(img?.currentSrc || img?.src || el.getAttribute("poster") || "", location.href).pathname.split("/").pop()));
  } catch {
    return "";
  }
}
function blockImage(e) {
  const target = e.target?.closest ? e.target : e.target?.parentElement;
  if (!e.isTrusted || !protectMode() || !target || target.closest(COPY_FIELDS)) return false;
  const media = target.closest(PROTECT_MEDIA);
  const area = target.closest(PROTECT_AREA);
  if (!media && !area && !(e.type === "contextmenu" && protectMode() === "page" && !target.closest("a[href]"))) return false;
  e.preventDefault();
  pushCopy(media
    ? { h: "blocked", k: "image", n: 0, x: autoHidden(media) ? "" : imageName(media) }
    : { h: "blocked", k: "text", n: 0, x: "" });
  return true;
}
function applyProtection() {
  document.getElementById("analytics-protect")?.remove();
  if (!protectMode()) return;
  const style = document.createElement("style");
  style.id = "analytics-protect";
  style.textContent = `${PROTECT_MEDIA}{-webkit-touch-callout:none;-webkit-user-drag:none}` +
    `${PROTECT_AREA}{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}` +
    `${PROTECT_AREA} :is(input,textarea,select,[contenteditable]){-webkit-user-select:text;user-select:text}`;
  document.head.appendChild(style);
}

document.addEventListener("contextmenu", (e) => {
  if (!e.isTrusted || blockImage(e)) return;
  copyMenuAt = Date.now();
}, true);
document.addEventListener("dragstart", blockImage, true);
document.addEventListener("click", (e) => {
  const el = e.isTrusted && e.target?.closest?.(AUTO_CLICKABLE);
  if (!el) return;
  const label = autoHidden(el) ? "(hidden)" : autoText(
    el.getAttribute("aria-label") || el.innerText || el.value || el.getAttribute("title"),
  );
  copyClick = { label, at: Date.now() };
}, true);

// Copy buttons usually write with the Clipboard API, which fires no copy event.
const pageClipboard = globalThis.navigator?.clipboard;
if (siteid && typeof pageClipboard?.writeText === "function") {
  const writeText = pageClipboard.writeText.bind(pageClipboard);
  try {
    pageClipboard.writeText = function (text) {
      try { copiedByButton(String(text ?? "").length); } catch { /* never break the copy */ }
      return writeText(text);
    };
  } catch { /* read-only clipboard: copy buttons go uncounted */ }
}

document.addEventListener("copy", (e) => {
  if (!e.isTrusted || !siteid) return;
  const field = document.activeElement?.closest?.(COPY_FIELDS);
  if (field) {
    // Older copy buttons select a hidden field and run execCommand("copy").
    copiedByButton(Math.max(0, (field.selectionEnd ?? 0) - (field.selectionStart ?? 0)));
    return;
  }
  const selection = document.getSelection();
  const text = String(selection || "");
  if (!text.trim() || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const el = node.nodeType === 1 ? node : node.parentElement;
  if (!el || el.closest(COPY_FIELDS)) return;
  const now = Date.now();
  const how = now - copyKeysAt < COPY_KEYS_MS ? "keys" : now - copyMenuAt < COPY_MENU_MS ? "menu" : "other";
  const kind = COPY_KINDS.find(([selector]) => el.closest(selector))?.[1] || "text";
  const snippet = autoHidden(el) ? "" : autoText(text);
  if (protectMode() === "page" || (protectMode() && el.closest(PROTECT_AREA))) {
    e.preventDefault();
    pushCopy({ h: "blocked", k: kind, n: text.length, x: snippet });
    return;
  }
  pushCopy({ h: how, k: kind, n: text.length, x: snippet });

  if (!copySettings?.attribution || kind === "code" || text.trim().length < ATTRIBUTION_MIN_CHARS ||
      !e.clipboardData || el.closest("[data-analytics-noattribution]")) return;
  const link = attributionUrl();
  const label = copySettings.text || "Read more at";
  const holder = document.createElement("div");
  for (let i = 0; i < selection.rangeCount; i++) holder.appendChild(selection.getRangeAt(i).cloneContents());
  try {
    e.clipboardData.setData("text/plain", `${text}\n\n${label} ${link}`);
    e.clipboardData.setData("text/html",
      `${holder.innerHTML}<p>${escapeCopyHtml(label)} <a href="${escapeCopyHtml(link)}">${escapeCopyHtml(link)}</a></p>`);
    e.preventDefault();
  } catch { /* the browser copies the plain selection */ }
}, true);

function sendHeatmapClicks() {
  if ((!heatmapClicks.length && !heatmapSignals.length && !autoEvents.length && !formEvents.length && !copyEvents.length) ||
      !data || !hasTrackedInitial) return;
  // Only page fields: drop click-event fields a previous custom event left on data.
  const { eventname, label, value, variant, eventid, metrics, ...page } = data;
  // A batch often goes out as the page is left, long after what it carries
  // happened, so each item says how many ms before sending it did (ago) and
  // the collector dates it by that. performance.now(): the clock can't jump.
  const now = performance.now();
  const dated = (items) => items.map(({ at, ...item }) => ({ ...item, ago: Math.max(0, Math.round(now - at)) }));
  const clicks = dated(heatmapClicks);
  const signals = dated(heatmapSignals);
  const auto = dated(autoEvents);
  const forms = dated(formEvents);
  const copies = dated(copyEvents);
  heatmapClicks = [];
  heatmapSignals = [];
  autoEvents = [];
  formEvents = [];
  copyEvents = [];
  sendanalytics(
    { ...page, url: lastTrackedPath || page.url, page_version: pageVersion, clicks, signals, auto, forms, copies },
    "clicks",
  ).catch(() => {});
}

// Capture phase: page handlers that stop propagation must not hide the click.
document.addEventListener("click", recordHeatmapClick, true);

//. HEATMAP SNAPSHOTS ---------------------------------------------
// Shortly after each pageview the tracker fingerprints the page structure.
// Clicks carry it, and the collector only asks for a snapshot when it has not
// stored that structure yet (refreshed every 30 days), so most visits stop
// after one small request. snapshot.js sits next to this script and is only
// downloaded by the visitor asked.
const SNAPSHOT_DELAY_MS = 2500;
const FINGERPRINT_SKIP = new Set(["SCRIPT", "NOSCRIPT", "STYLE", "LINK", "TEMPLATE", "IFRAME"]);
let snapshotTimer;

// Hash of the body's element tags, nesting and stable ids: the parts heatmap
// selectors depend on. Text changes (prices, dates) keep the same hash, and
// CSS-only responsive pages hash the same at every screen width. A run of
// identical siblings counts once, so a list growing from 10 to 12 items is
// still the same design.
async function pageFingerprint() {
  let budget = 50000;
  const structure = (el) => {
    const parts = [];
    let previous = "";
    for (let child = el.firstElementChild; child && budget > 0; child = child.nextElementSibling) {
      if (FINGERPRINT_SKIP.has(child.tagName)) continue;
      budget--;
      const name = child.id && isStableId(child.id) ? `${child.tagName}#${child.id}` : child.tagName;
      const part = `${name}(${structure(child)})`;
      if (part !== previous) parts.push(part);
      previous = part;
    }
    return parts.join(",");
  };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(structure(document.body)));
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

function scheduleSnapshot() {
  clearTimeout(snapshotTimer);
  pageVersion = "";
  if (!siteid || navigator.webdriver || heatmapsOff || !globalThis.crypto?.subtle) return;
  const path = lastTrackedPath;
  snapshotTimer = setTimeout(async () => {
    if (lastTrackedPath !== path || !document.body) return;
    try {
      const fingerprint = await pageFingerprint();
      if (lastTrackedPath !== path) return;
      pageVersion = fingerprint;
      if (document.visibilityState !== "visible" || !current?.src ||
          typeof CompressionStream === "undefined") return;
      await takeSnapshot(path, fingerprint);
    } catch { /* heatmaps are best-effort */ }
  }, SNAPSHOT_DELAY_MS);
}

// text/plain bodies keep these simple CORS requests (no preflight).
async function takeSnapshot(path, fingerprint) {
  const claimResponse = await fetch(new URL("snapshot/claim", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    body: JSON.stringify({
      siteid,
      url: path,
      viewport_width: window.innerWidth,
      fingerprint,
    }),
  });
  if (!claimResponse.ok) return;
  const claim = await claimResponse.json();
  if (claim?.enabled === false) {
    heatmapsOff = true;
    heatmapClicks = [];
    try {
      tabStore().setItem(HEATMAPS_OFF_KEY, "1");
    } catch { /* optional storage */ }
    return;
  }
  if (claim?.masking) siteMasking = claim.masking;
  if (!claim?.token) return;
  const { captureSnapshot } = await loadModule("snapshot.js");
  if (lastTrackedPath !== path) return;
  const snapshot = captureSnapshot({ masking: claim.masking });
  if (!snapshot) return;
  const body = await new Response(
    new Blob([snapshot.html]).stream().pipeThrough(new CompressionStream("gzip")),
  ).blob();
  const upload = new URL("snapshot", COLLECT_URL);
  upload.searchParams.set("token", claim.token);
  upload.searchParams.set("viewport_width", snapshot.viewport_width);
  upload.searchParams.set("page_height", snapshot.page_height);
  await fetch(upload, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    body,
  });
}

//. SESSION REPLAY ------------------------------------------------
// Sites that turn replays on record a sample of sessions. The collector
// decides once per session; the decision and upload token are kept for the
// session so each of its pages is recorded. replay.js sits next to this
// script and is only downloaded for recorded sessions.
//
// Sites that require consent call window.analytics.consent(true) from their
// cookie banner (or set window.analyticsConsent = true before this script
// loads); the answer is remembered on this device. The decision is kept
// under REPLAY_KEY (defined with the error constants, which read it first).
// A "no" is asked again after this, so turning replays on takes effect for
// visitors already on the site; a "yes" lasts the whole session.
const REPLAY_RECHECK_MS = 5 * 60 * 1000;
const CONSENT_KEY = `analytics:consent:${siteid}`;
// An answer (and the lasting visitor ID) is kept about 13 months, then asked again.
const CONSENT_AT_KEY = `analytics:consentat:${siteid}`;
const CONSENT_MAX_AGE_MS = 395 * 24 * 60 * 60 * 1000;
// The functional/marketing answers (see readCategories).
const CATEGORIES_KEY = `analytics:consentcats:${siteid}`;
// A random ID for this device's answers, sent with each one, so a visitor's
// consent can be looked up in the consent log (shown in the banner's switches).
const CONSENT_ID_KEY = `analytics:consentid:${siteid}`;
let replayStarted = false;
let replayRecorder = null;

function readConsent() {
  if (typeof window.analyticsConsent === "boolean") return window.analyticsConsent;
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === null) return null;
    const at = Number(localStorage.getItem(CONSENT_AT_KEY));
    // Answers saved without a time (older trackers) start counting now.
    if (!at) localStorage.setItem(CONSENT_AT_KEY, String(Date.now()));
    else if (Date.now() - at > CONSENT_MAX_AGE_MS) {
      for (const key of [CONSENT_KEY, CONSENT_AT_KEY, CATEGORIES_KEY, CONSENT_ID_KEY, `analytics:visitor:${siteid}`]) localStorage.removeItem(key);
      return null;
    }
    return stored === "1";
  } catch {
    return null;
  }
}

// The banner's other categories, kept next to the analytics answer (which is
// the "analytics" category). Answers saved without them (a plain Accept, or
// older trackers) count for every category. "necessary" is always allowed.
const OPTIONAL_CATEGORIES = ["functional", "marketing"];
// Names other consent tools use, so data-consent="statistics" works too.
const CATEGORY_ALIASES = { statistics: "analytics", performance: "analytics", preferences: "functional", advertising: "marketing", ads: "marketing" };
// Visitors outside the countries where the banner asks (it can ask only in
// Europe) have every category allowed until they answer themselves. This is
// never stored as an answer, and counts for lasting IDs and replays only when
// the site picked "Ask visitors in Europe only" (visitor mode "europe").
let consentImplied = false;
function readCategories() {
  const analytics = readConsent();
  if (analytics === null) {
    return consentImplied ? { necessary: true, analytics: true, functional: true, marketing: true } : null;
  }
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(CATEGORIES_KEY) || "null");
  } catch { /* optional storage */ }
  const categories = { necessary: true, analytics };
  for (const name of OPTIONAL_CATEGORIES) {
    categories[name] = typeof stored?.[name] === "boolean" ? stored[name] : analytics;
  }
  return categories;
}
function hasConsent(name) {
  const key = String(name || "").toLowerCase();
  return readCategories()?.[CATEGORY_ALIASES[key] || key] === true;
}

// Visitors who consent keep one random ID on this device, so their later
// visits count as the same visitor (sites that turn this on in Privacy
// settings; the collector ignores it otherwise). It applies from the next
// visit, so a visit never switches visitor halfway, and "no" deletes it.
const VISITOR_KEY = `analytics:visitor:${siteid}`;
// Sites can also give a lasting ID to visitors who haven't answered (never to
// those who declined): "always" (everyone until they say no) or "europe" (the
// banner only asks in Europe; visitors elsewhere until they say no). The
// collector says which in its replay/start answer.
const VISITOR_MODE_KEY = `analytics:visitormode:${siteid}`;
// Set while this device was last seen outside Europe by a banner that only
// asks there, so a visit's first pageview (before the config with the country
// arrives) already knows.
const OUTSIDE_EUROPE_KEY = `analytics:outsideeurope:${siteid}`;
function visitorMode() {
  try {
    return localStorage.getItem(VISITOR_MODE_KEY) || "";
  } catch {
    return "";
  }
}
// Not asked in Europe-only mode: counts as yes until the visitor answers.
function europeImplied() {
  if (readConsent() !== null || visitorMode() !== "europe") return false;
  if (consentImplied) return true;
  try {
    return localStorage.getItem(OUTSIDE_EUROPE_KEY) === "1";
  } catch {
    return false;
  }
}
// No answer yet, but the site recognises this visitor anyway.
function recognisedWithoutAnswer() {
  return readConsent() === null && (visitorMode() === "always" || europeImplied());
}
function consentedVisitorId() {
  if (readConsent() !== true && !recognisedWithoutAnswer()) return "";
  try {
    const stored = JSON.parse(localStorage.getItem(VISITOR_KEY) || "null");
    // Like an answer, the ID itself lasts about 13 months (older IDs have no
    // time yet and get one now).
    if (stored?.id && !stored.at) {
      localStorage.setItem(VISITOR_KEY, JSON.stringify({ ...stored, at: Date.now() }));
    }
    if (stored?.id && !(Date.now() - stored.at > CONSENT_MAX_AGE_MS)) {
      return stored.from === analyticsSession.getId() ? "" : stored.id;
    }
    if (globalThis.crypto?.randomUUID) {
      localStorage.setItem(VISITOR_KEY, JSON.stringify({ id: crypto.randomUUID(), from: analyticsSession.getId(), at: Date.now() }));
    }
  } catch { /* optional storage */ }
  return "";
}

// Consent answers for the Privacy report: each new answer from the banner,
// and once a visit the answer this device gave before. A choice made before
// the first pageview is sent with it.
const CONSENT_SENT_KEY = `analytics:consentsent:${siteid}`;
let consentChoicePending = false;
let answeredBannerVersion = "";

// A short fingerprint of the banner's texts, the same as the dashboard keeps
// for each saved banner (backend bannerVersion.js), so the log can show
// exactly what a visitor saw.
const BANNER_VERSION_KEYS = ["text", "accept", "decline", "policyUrl", "customize", "save", "necessaryName", "necessaryDesc",
  "analyticsName", "analyticsDesc", "functionalName", "functionalDesc", "marketingName", "marketingDesc", "categories", "services"];
function bannerVersion(banner) {
  const source = JSON.stringify(BANNER_VERSION_KEYS.map((key) => banner?.[key] ?? null));
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
const CONSENT_VISIT_MS = 30 * 60 * 1000;
function reportConsent(choice = false) {
  if (!data || !hasTrackedInitial) {
    consentChoicePending ||= choice;
    return;
  }
  choice ||= consentChoicePending;
  consentChoicePending = false;
  if (readConsent() === null) return;
  const categories = readCategories();
  if (!categories) return;
  const granted = categories.analytics;
  const others = OPTIONAL_CATEGORIES.map((name) => (categories[name] ? 1 : 0)).join("");
  const session = analyticsSession.getId();
  let sent = null;
  try {
    sent = JSON.parse(localStorage.getItem(CONSENT_SENT_KEY) || "null");
  } catch { /* optional storage */ }
  // Once a visit. A visitor who keeps no ID has a new one on each page, so the
  // visit's end is timed here as well.
  const now = Date.now();
  const sameVisit = sent?.session === session || now - (sent?.at || 0) < CONSENT_VISIT_MS;
  const repeat = !choice && sameVisit && sent?.granted === granted && (sent?.others ?? others) === others;
  try {
    localStorage.setItem(CONSENT_SENT_KEY, JSON.stringify({ session, granted, others, at: now }));
  } catch { /* optional storage */ }
  if (repeat) return;
  let consentId = "";
  try {
    consentId = localStorage.getItem(CONSENT_ID_KEY) || "";
    if (!consentId && globalThis.crypto?.randomUUID) {
      consentId = crypto.randomUUID();
      localStorage.setItem(CONSENT_ID_KEY, consentId);
    }
  } catch { /* optional storage */ }
  // The banner text the visitor answered, for the consent log (our banner only).
  const version = choice ? answeredBannerVersion : "";
  if (choice) answeredBannerVersion = "";
  const { eventname, label, value, variant, eventid, metrics, ...page } = data;
  sendanalytics({
    ...page, url: lastTrackedPath || page.url, granted, choice,
    consent_functional: categories.functional, consent_marketing: categories.marketing,
    consent_id: consentId, banner_version: version,
  }, "consent").catch(() => {});
}

window.analytics = window.analytics || {};

// The loader snippet stubs track/identify/consent/reset so calls made before
// this file arrived are queued in window.analytics.q (e.g. a purchase on the
// confirmation page). They are replayed once the first pageview has set up `data`.
function flushQueuedCalls() {
  const queued = window.analytics.q;
  if (!Array.isArray(queued)) return;
  window.analytics.q = [];
  for (const [method, args] of queued) {
    try {
      window.analytics[method]?.(...(args || []));
    } catch { /* one bad call doesn't stop the rest */ }
  }
}
// Custom events from code, e.g. the standard shop events:
//   window.analytics.track("add_to_cart", { item: "Blue shirt", amount: 29.9, currency: "EUR" })
//   window.analytics.track("purchase", { amount: 59.8, currency: "EUR", transaction_id: "order_1042", coupon: "SUMMER10" })
// Same as dispatching an "analytics-event" with eventname, label, numeric_value and currency.
// A transaction_id is sent as the event id "txn:<id>"; revenue counts each id once.
// A coupon code is sent as the variant, so orders can be grouped by code.
// A purchase can say who bought and what the total is made of, for the Shop
// report's Sales, Customers and Cohorts:
//   window.analytics.track("purchase", { amount: 59.8, currency: "EUR", transaction_id: "order_1042",
//     customer_id: "c_381", subtotal: 64.8, discount: 10, shipping: 5, tax: 0,
//     items: [{ name: "Blue mug", sku: "MUG-B", quantity: 2, price: 32.4 }] })
// customer_email instead of customer_id is hashed (SHA-256) here, so the address
// never leaves the page; without either, a visitor identified with
// analytics.identify() in this visit is the customer.
// Any other keys are custom properties, for breakdowns in the Events report:
//   window.analytics.track("signup", { plan: "pro", seats: 5 })
// (text, numbers or true/false; the collector keeps up to 20 and drops email addresses).
const ORDER_FIELDS = ["customer_id", "customer_email", "subtotal", "discount", "shipping", "tax", "items", "prior_orders"];
const TRACK_FIELDS = new Set(["item", "label", "value", "transaction_id", "coupon", "amount", "currency", ...ORDER_FIELDS]);
// The purchase's order fields, with an email hashed. Resolves to {} when the
// browser can't hash (crypto.subtle needs https): an address is never sent.
async function orderFields(props) {
  const order = Object.fromEntries(ORDER_FIELDS.filter((key) => props[key] !== undefined && props[key] !== null).map((key) => [key, props[key]]));
  const email = typeof order.customer_email === "string" ? order.customer_email.trim().toLowerCase() : "";
  if (email && !/^[0-9a-f]{64}$/.test(email)) {
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
      order.customer_email = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch {
      delete order.customer_email;
    }
  }
  if (!order.customer_id && !order.customer_email) {
    try {
      const identity = JSON.parse(sessionStorage.getItem(IDENTITY_KEY) || "null");
      if (identity?.id && identity.session === analyticsSession.getId()) order.customer_id = identity.id;
    } catch { /* optional storage */ }
  }
  return order;
}
window.analytics.track = (name, props = {}) => {
  if (typeof name !== "string" || !name) return;
  props = props && typeof props === "object" ? props : {};
  const detail = { eventname: name, label: props.item ?? props.label ?? "", value: props.value ?? "" };
  const properties = Object.fromEntries(Object.entries(props || {}).filter(([key]) => !TRACK_FIELDS.has(key)));
  if (Object.keys(properties).length) detail.properties = properties;
  if (props.transaction_id) detail.eventid = `txn:${props.transaction_id}`;
  if (props.coupon) detail.variant = String(props.coupon).trim();
  if (props.amount !== undefined && props.amount !== null && props.amount !== "") {
    detail.numeric_value = props.amount;
    if (props.currency) detail.currency = props.currency;
  }
  if (name.trim().toLowerCase() !== "purchase") {
    document.dispatchEvent(new CustomEvent("analytics-event", { detail }));
    return;
  }
  orderFields(props).then((order) => {
    if (Object.keys(order).length) detail.order = order;
    document.dispatchEvent(new CustomEvent("analytics-event", { detail }));
  });
};
// window.analytics.consent(true)  allows every category, false declines them all;
// window.analytics.consent({ analytics: true, functional: true, marketing: false })
// answers per category (left out = declined).
window.analytics.consent = (answer) => {
  const all = typeof answer === "object" && answer !== null ? null : answer === true;
  const value = all ?? answer.analytics === true;
  const others = Object.fromEntries(OPTIONAL_CATEGORIES.map((name) => [name, all ?? answer[name] === true]));
  // Banners that repeat a stored answer on every page are not making a choice.
  const before = readCategories();
  const same = before?.analytics === value && OPTIONAL_CATEGORIES.every((name) => before[name] === others[name]);
  setConsent(value, !same, others);
};
// e.g. if (analytics.hasConsent("marketing")) loadChatWidget();
window.analytics.hasConsent = hasConsent;

// Signed-in users, so their visits can be followed across sessions:
//   window.analytics.identify("user_4821")   after login, on every page is fine
//   window.analytics.reset()                 after logout
// Use your own internal ID, never an email address (those are rejected).
// Only sent once per visit, and only when the visitor allowed analytics
// storage, as for lasting visitor IDs.
// Properties of the person ("plan is pro") can come along, or on their own:
//   window.analytics.identify("user_4821", { plan: "pro", logged_in: true })
//   window.analytics.identify({ plan: "free" })
// They replace the ones set before, and are kept in this browser for
// audiences. With a user ID (now, or earlier in this visit) they are also
// sent, under the same consent as the ID, so the dashboard can filter and
// split visits by them; email addresses among them are dropped there.
const IDENTITY_KEY = `analytics:identity:${siteid}`;
const TRAITS_KEY = `analytics:traits:${siteid}`;
window.analytics.identify = (userId, traits) => {
  if (userId && typeof userId === "object") [userId, traits] = ["", userId];
  if (traits && typeof traits === "object") {
    const kept = Object.entries(traits).slice(0, 30)
      .filter(([key, value]) => key && value !== undefined && value !== null && typeof value !== "object")
      .map(([key, value]) => [String(key).slice(0, 60).toLowerCase(), String(value).slice(0, 100)]);
    try {
      localStorage.setItem(TRAITS_KEY, JSON.stringify(Object.fromEntries(kept)));
    } catch { /* optional storage */ }
  }
  let sent = null;
  try {
    sent = JSON.parse(sessionStorage.getItem(IDENTITY_KEY) || "null");
  } catch { /* optional storage */ }
  const session = analyticsSession.getId();
  const given = typeof userId === "number" ? String(userId) : typeof userId === "string" ? userId.trim() : "";
  // Properties on their own go with the ID this visit was already linked to.
  const id = given || (sent?.session === session ? sent?.id || "" : "");
  if (!id || id.length > 200 || id.includes("@")) return;
  if (readConsent() !== true && !recognisedWithoutAnswer()) return;
  if (!session) return;
  const stored = readStored(TRAITS_KEY) || {};
  const fingerprint = JSON.stringify(stored);
  // Once per visit, and again only when the ID or the properties change.
  if (sent?.id === id && sent.session === session && (sent.traits ?? "{}") === fingerprint) return;
  try {
    sessionStorage.setItem(IDENTITY_KEY, JSON.stringify({ id, session, traits: fingerprint }));
  } catch { /* optional storage */ }
  fetch(new URL("identify", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify({ siteid, session_id: session, user_id: id, ...(fingerprint !== "{}" ? { traits: stored } : {}) }),
  }).catch(() => {});
};
window.analytics.reset = () => {
  try {
    sessionStorage.removeItem(IDENTITY_KEY);
    localStorage.removeItem(TRAITS_KEY);
  } catch { /* optional storage */ }
};

// Errors your own code catches, so they reach the Errors report alongside the
// uncaught ones: a React error boundary, Vue's errorHandler, a failed request
// you handle, a retry that gave up. They are stored as "handled", and get the
// same masking, breadcrumbs, grouping and per-page-view limit as an uncaught
// error, so one of these cannot flood the report either.
//   window.analytics.captureException(error)
//   window.analytics.captureException("Checkout gave up after 3 tries", { type: "CheckoutError" })
// A string is reported with a stack from the call site, so it still points at
// your code. Call it optionally (window.analytics?.captureException?.(error))
// if your code can run before the tracker has loaded.
window.analytics.captureException = (error, options) => {
  const isError = error instanceof Error || (error && typeof error === "object" && "message" in error);
  if (!isError && (typeof error !== "string" || !error.trim())) return;
  const thrown = isError ? error : new Error(error);
  // The Error for a string is built in here, so without this the top frame is
  // this function and every string report would group under it, with a stack
  // pointing at the tracker instead of the caller.
  if (!isError) {
    if (Error.captureStackTrace) Error.captureStackTrace(thrown, window.analytics.captureException);
    else if (typeof thrown.stack === "string") {
      thrown.stack = thrown.stack.split("\n").filter((line) => !line.includes("captureException")).join("\n");
    }
  }
  const type = options && typeof options.type === "string" ? options.type.trim() : "";
  captureError(thrown, "", "", 0, 0, "handled", type.slice(0, 64));
};

// others: the functional/marketing answers from our banner or analytics.consent();
// consent tools only report analytics, so they leave those alone.
function setConsent(value, choice, others) {
  const before = readCategories();
  // Repeating the same answer doesn't restart its 13 months.
  const changed = readConsent() !== value;
  try {
    if (changed) localStorage.setItem(CONSENT_AT_KEY, String(Date.now()));
    localStorage.setItem(CONSENT_KEY, value ? "1" : "0");
    if (others) localStorage.setItem(CATEGORIES_KEY, JSON.stringify(others));
    if (!value) {
      localStorage.removeItem(VISITOR_KEY);
      localStorage.removeItem(`analytics:session:${siteid}`);
    }
    if (!value) forgetVisitMemory();
    // The previous decision may have been "no consent yet".
    tabStore().removeItem(REPLAY_KEY);
  } catch { /* optional storage */ }
  window.analyticsConsent = value;
  reportConsent(choice);
  consentChanged(before, readCategories());
  if (value) {
    replayStarted = false;
    startReplay().catch(() => {});
  } else {
    replayRecorder?.stop();
    replayRecorder = null;
    replayLog = null;
  }
}

//. OTHER SCRIPTS AFTER CONSENT ------------------------------------
// The site's other tags wait for their category, with no code:
//   <script type="text/plain" data-consent="marketing" src="https://..."></script>
//   <script type="text/plain" data-consent="analytics">gtag("config", "G-XXXX");</script>
//   <iframe data-consent="functional" data-src="https://www.youtube.com/embed/..."></iframe>
// They run once the visitor allows the category (several, comma separated,
// need all of them), in page order, so an inline tag runs after the file it uses.
const CONSENT_SELECTOR = 'script[type="text/plain"][data-consent], iframe[data-consent][data-src]';
const ranCategories = new Set();
let activating = Promise.resolve();

const categoriesOf = (el) => (el.getAttribute("data-consent") || "").toLowerCase().split(/[\s,]+/)
  .filter(Boolean).map((name) => CATEGORY_ALIASES[name] || name);

// A web address to load, or null. These tags are found anywhere on the page,
// including in content the site let visitors post: a sanitizer that keeps
// iframes and data-* attributes checks src but not data-src, so a
// "javascript:" there would run in the site's origin once we copied it over.
function loadableUrl(value) {
  try {
    const url = new URL(value || "", location.href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function runConsentedTags() {
  activating = activating.then(async () => {
    const categories = readCategories();
    if (!categories) return;
    for (const el of document.querySelectorAll(CONSENT_SELECTOR)) {
      const names = categoriesOf(el);
      if (!names.length || !names.every((name) => categories[name] === true)) continue;
      if (el.tagName === "IFRAME") {
        const src = loadableUrl(el.getAttribute("data-src"));
        el.removeAttribute("data-src");
        if (!src) continue;
        for (const name of names) ranCategories.add(name);
        el.setAttribute("src", src);
        continue;
      }
      // A script's file only from a web address: never data:, blob: or javascript:.
      if (el.hasAttribute("src") && !loadableUrl(el.getAttribute("src"))) continue;
      for (const name of names) ranCategories.add(name);
      // A script only runs when it's a new element; data-type keeps a module's type.
      const script = document.createElement("script");
      for (const { name, value } of el.attributes) {
        if (name !== "type" && name !== "data-type") script.setAttribute(name, value);
      }
      if (el.getAttribute("data-type")) script.type = el.getAttribute("data-type");
      if (el.hasAttribute("src")) {
        const loaded = el.hasAttribute("async") ? null : new Promise((resolve) => {
          script.onload = script.onerror = resolve;
        });
        el.replaceWith(script);
        await loaded;
      } else {
        script.text = el.text;
        el.replaceWith(script);
      }
    }
  }).catch(() => {});
  return activating;
}

// First-party cookies the common tags leave behind, removed when their
// category is withdrawn (third-party cookies can't be reached from the page).
const CATEGORY_COOKIES = {
  analytics: /^(_ga|_gid|_gat|_hj|_clck|_clsk|mp_|ajs_|_pk_)/,
  marketing: /^(_fbp|_fbc|_gcl|_ttp|_tt_|_uet|_pin_|_rdt_|_scid|li_|IDE$|fr$)/,
  functional: /^(intercom-|crisp-|__hs|hubspotutk|_zlc|tawk)/,
};
function removeCookies(pattern) {
  const parts = location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; domain=.${parts.slice(i).join(".")}`);
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0].trim();
    if (!name || !pattern.test(name)) continue;
    for (const domain of domains) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
  }
}

// Google Consent Mode v2 from our banner's answer, for sites with Google tags.
// Answers read from other consent tools are left to those tools, which send
// their own. Off with data-consent-mode="false".
const sendConsentMode = (setting("consent-mode") || "").toLowerCase() !== "false";
// What we pushed, so consentFromTools doesn't read our own update back as a
// consent tool's answer: an implied yes outside Europe must never be stored.
const ownConsentUpdates = new WeakSet();
function updateConsentMode(categories) {
  if (!sendConsentMode || !categories) return;
  try {
    if (localStorage.getItem(CATEGORIES_KEY) === null && !consentImplied) return;
  } catch {
    return;
  }
  const state = (allowed) => (allowed ? "granted" : "denied");
  const update = {
    analytics_storage: state(categories.analytics),
    ad_storage: state(categories.marketing),
    ad_user_data: state(categories.marketing),
    ad_personalization: state(categories.marketing),
    functionality_storage: state(categories.functional),
    personalization_storage: state(categories.functional),
  };
  ownConsentUpdates.add(update);
  if (typeof window.gtag === "function") return window.gtag("consent", "update", update);
  window.dataLayer = window.dataLayer || [];
  // Like gtag(): Google reads an arguments object, not a plain array.
  (function () { window.dataLayer.push(arguments); })("consent", "update", update);
}

// After every answer, and once per page for the answer already stored.
// Sites can listen too: document.addEventListener("analytics-consent", (e) => e.detail.marketing)
function consentChanged(before, after) {
  if (!after) return;
  const same = before && Object.keys(after).every((name) => before[name] === after[name]);
  if (before && same) return;
  updateConsentMode(after);
  document.dispatchEvent(new CustomEvent("analytics-consent", { detail: { ...after } }));
  const withdrawn = before ? Object.keys(CATEGORY_COOKIES).filter((name) => before[name] && !after[name]) : [];
  for (const name of withdrawn) removeCookies(CATEGORY_COOKIES[name]);
  // Tags that already ran can't be stopped: reload so they don't run again.
  if (withdrawn.some((name) => ranCategories.has(name))) return location.reload();
  runConsentedTags();
}

function applyStoredConsent() {
  consentChanged(null, readCategories());
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyStoredConsent, { once: true });
else applyStoredConsent();

// Sites with a common consent tool need no code: its answer for statistics/
// analytics is picked up here. Turn off with data-consent-detect="false".
// Answers the tool already had when the page loaded are not new choices.
function consentFromTools() {
  try {
    const cookiebot = window.Cookiebot;
    if (cookiebot?.hasResponse) return Boolean(cookiebot.consent?.statistics);
    const cookieyes = window.getCkyConsent?.();
    if (cookieyes?.isUserActionCompleted) return Boolean(cookieyes.categories?.analytics);
    if (window.OneTrust?.IsAlertBoxClosed?.() && typeof window.OnetrustActiveGroups === "string") {
      return window.OnetrustActiveGroups.split(",").includes("C0002");
    }
    const complianz = /(?:^|;\s*)cmplz_statistics=(allow|deny)/.exec(document.cookie);
    if (complianz) return complianz[1] === "allow";
    // Google Consent Mode, which most other consent tools also send:
    // the latest gtag("consent", "update", { analytics_storage }).
    const layer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
    for (let i = layer.length - 1; i >= 0; i--) {
      const entry = layer[i];
      if (entry?.[0] === "consent" && entry[1] === "update" && entry[2]?.analytics_storage && !ownConsentUpdates.has(entry[2])) {
        return entry[2].analytics_storage === "granted";
      }
    }
  } catch { /* a tool's API changed: leave consent alone */ }
  return null;
}

// Another consent tool on the page, answered or not: ours steps aside so
// visitors never see two banners. __tcfapi is the IAB standard most paid
// tools (Usercentrics, Didomi, Quantcast, Sourcepoint…) provide; cookieBanner
// is our own banner's copied code (cookieBannerCode.js).
function otherConsentTool() {
  try {
    return Boolean(window.Cookiebot || window.getCkyConsent || window.OneTrust || window.Optanon ||
      window.complianz || window.cmplz_banner || window.UC_UI || window.Didomi || window._iub?.cs ||
      window.Osano || window.Termly || window.klaro || window.cookieBanner || typeof window.__tcfapi === "function" ||
      /(?:^|;\s*)cmplz_/.test(document.cookie));
  } catch {
    return false;
  }
}

function checkConsentTools(initial) {
  const value = consentFromTools();
  if (value === null || readConsent() === value) return;
  setConsent(value, !initial);
}

const detectConsentTools = (setting("consent-detect") || "").toLowerCase() !== "false";
if (detectConsentTools) {
  checkConsentTools(true);
  const later = () => setTimeout(() => checkConsentTools(false), 300);
  for (const name of ["CookiebotOnAccept", "CookiebotOnDecline", "OneTrustGroupsUpdated"]) {
    window.addEventListener(name, later);
  }
  for (const name of ["cookieyes_consent_update", "cmplz_status_change"]) {
    document.addEventListener(name, later);
  }
  // Catches Consent Mode and any tool without an event: banners are clicked.
  document.addEventListener("click", later, true);
}

// Sites without a consent tool can show ours (Widgets → Cookie banner); it
// stays hidden on pages that have one.
// Its settings come with the surveys config; banner.js is only downloaded for
// visitors who haven't answered, once other tools had time to restore theirs.
// again: shown even after an answer, for a "Cookie settings" link.
async function showConsentBanner(again = false) {
  if (!siteid || !current?.src || navigator.webdriver) return false;
  if (!again && (readConsent() !== null || consentFromTools() !== null)) return false;
  const config = await loadSiteConfig().catch(() => null);
  const banner = config?.banner;
  // Before the banner check: a site asking only in Europe with its own banner
  // still recognises visitors elsewhere.
  if (!again && readConsent() === null && applyRegion(config)) return false;
  if (!banner || (!again && (readConsent() !== null || otherConsentTool()))) return false;
  const { renderBanner } = await loadModule("banner.js");
  let consentId = "";
  try {
    consentId = localStorage.getItem(CONSENT_ID_KEY) || "";
  } catch { /* optional storage */ }
  const answers = again && readConsent() !== null ? readCategories() : null;
  renderBanner(banner, (answer) => {
    answeredBannerVersion = bannerVersion(banner);
    window.analytics.consent(answer);
  }, answers, consentId);
  return true;
}

// Banners that only ask in Europe (EU, EEA, UK, Switzerland). An unknown
// country is asked, to be safe.
const EUROPE = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT",
  "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH"]);
// A site can add countries whose own law expects the same question
// (banner.extraRegions, ISO codes; see frontend consentRegions.js). Older
// banners have no such list, so they keep asking in Europe only.
function askedIn(banner, country) {
  if (!country || EUROPE.has(country)) return true;
  const extra = banner?.extraRegions;
  return Array.isArray(extra) && extra.includes(country);
}
// Who is asked: consentRegions when only Europe is asked, by our banner or
// the site's own; older collectors only sent it as part of our banner.
const askedRegions = (config) => config?.consentRegions || config?.banner;
function applyRegion(config) {
  const country = String(config?.country || "").toUpperCase();
  const regions = askedRegions(config);
  const outside = regions?.regions === "europe" && !askedIn(regions, country);
  try {
    if (outside) localStorage.setItem(OUTSIDE_EUROPE_KEY, "1");
    else localStorage.removeItem(OUTSIDE_EUROPE_KEY);
  } catch { /* optional storage */ }
  if (!outside) return false;
  if (!consentImplied && readConsent() === null) {
    consentImplied = true;
    consentChanged(null, readCategories());
  }
  return true;
}
// The config this tab already has, so outside Europe tags run without waiting.
try {
  // Same key as SURVEYS_KEY, which is declared further down.
  const cached = JSON.parse(tabStore().getItem(`analytics:surveys:${siteid}`) || "null");
  if (askedRegions(cached)?.regions === "europe" && readConsent() === null) {
    const country = String(cached.country || "").toUpperCase();
    consentImplied = !askedIn(askedRegions(cached), country);
    // Otherwise applyStoredConsent runs on DOMContentLoaded and sees it.
    if (consentImplied && document.readyState !== "loading") consentChanged(null, readCategories());
  }
} catch { /* optional storage */ }
// e.g. <a href="#" onclick="analytics.showConsentBanner(); return false">Cookie settings</a>
window.analytics.showConsentBanner = () => showConsentBanner(true).catch(() => false);

// Cookies and outside services on the site's pages, for "Found on your site"
// in Widgets → Cookie banner: cookie names and host names only, never values.
// Sites that use consent only; sent again in a visit only when it changes.
const SCAN_KEY = `analytics:cookiescan:${siteid}`;
async function scanCookies() {
  if (!data || !hasTrackedInitial || !siteid) return;
  const config = await loadSiteConfig().catch(() => null);
  if (!config?.banner && readConsent() === null) return;
  const cookies = [...new Set(document.cookie.split(";").map((pair) => pair.split("=")[0].trim()))]
    .filter((name) => name && name.length <= 100).sort().slice(0, 60);
  const own = new Set([location.hostname, new URL(COLLECT_URL).hostname, current?.src ? new URL(current.src).hostname : ""]);
  const hosts = new Set();
  for (const entry of performance.getEntriesByType?.("resource") || []) {
    let host = "";
    try {
      host = new URL(entry.name).hostname;
    } catch { continue; }
    if (host && !own.has(host)) hosts.add(host);
  }
  // Visitors outside the banner's countries count as answered (all allowed).
  const answered = readConsent() !== null || consentImplied;
  const categories = answered ? readCategories() : null;
  const found = { cookies, hosts: [...hosts].sort().slice(0, 60) };
  const signature = JSON.stringify([found, categories]);
  try {
    if (tabStore().getItem(SCAN_KEY) === signature) return;
    tabStore().setItem(SCAN_KEY, signature);
  } catch { /* optional storage */ }
  if (!found.cookies.length && !found.hosts.length) return;
  if (skipReport()) return;
  const { eventname, label, value, variant, eventid, metrics, ...page } = data;
  sendanalytics({
    ...page, url: lastTrackedPath || page.url, ...found, answered,
    consent_analytics: Boolean(categories?.analytics),
    consent_functional: Boolean(categories?.functional),
    consent_marketing: Boolean(categories?.marketing),
  }, "cookies").catch(() => {});
}

function afterPageLoad() {
  setTimeout(() => {
    if (detectConsentTools) checkConsentTools(true);
    showConsentBanner().catch(() => {});
    // Tags the page added after it loaded.
    runConsentedTags();
    setTimeout(() => scanCookies().catch(() => {}), 3000);
    feedbackReady = true;
    scheduleFeedback().catch(() => {});
  }, 1500);
}
if (document.readyState === "complete") afterPageLoad();
else window.addEventListener("load", afterPageLoad, { once: true });

// The collector's answer says whether this site waits for a "yes"; a "no"
// always stops a recording. Europe-only banners count visitors elsewhere as a
// yes until they answer, as the collector did when it picked the session.
function replayConsented(decision) {
  const answer = readConsent();
  return answer !== false && (!decision.requireConsent || answer === true || europeImplied());
}

async function startReplay() {
  if (replayStarted || replayRecorder) return;
  if (!siteid || !current?.src || navigator.webdriver ||
      typeof CompressionStream === "undefined" || typeof MutationObserver === "undefined") {
    noReplayLog();
    return;
  }
  replayStarted = true;
  let sessionId = analyticsSession.getId();
  if (!sessionId) return;
  const consent = readConsent();
  let decision = null;
  try {
    decision = JSON.parse(tabStore().getItem(REPLAY_KEY) || "null");
  } catch { /* optional storage */ }
  const fresh = decision?.session === sessionId &&
    (decision.record || Date.now() - (decision.at || 0) < REPLAY_RECHECK_MS);
  if (!fresh) {
    const response = await fetch(new URL("replay/start", COLLECT_URL), {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      credentials: "omit",
      // lead_up: this tracker can keep a visit in memory until a feedback report.
      // Europe-only banners: visitors elsewhere are recorded until they say no.
      // only_pages: this tracker's recorder pauses outside the site's tracked pages.
      body: JSON.stringify({ siteid, session_id: sessionId, consent: consent === true || europeImplied(), declined: consent === false, lead_up: true, only_pages: true }),
    });
    if (!response.ok) return;
    decision = { session: sessionId, at: Date.now(), ...(await response.json()) };
    try {
      if (decision.visitorIds === "always" || decision.visitorIds === "europe") localStorage.setItem(VISITOR_MODE_KEY, decision.visitorIds);
      else if (localStorage.getItem(VISITOR_MODE_KEY)) {
        // Turned off: only visitors who consented keep their ID.
        localStorage.removeItem(VISITOR_MODE_KEY);
        if (readConsent() !== true) {
          localStorage.removeItem(VISITOR_KEY);
          forgetVisitMemory();
        }
      }
    } catch { /* optional storage */ }
    // "Waiting for consent" is not kept: consent(true) asks again.
    if (!decision.needsConsent) {
      try {
        tabStore().setItem(REPLAY_KEY, JSON.stringify(decision));
      } catch { /* optional storage */ }
    }
  }
  if (!decision.record || !decision.token) {
    noReplayLog();
    return;
  }
  keepForTab();
  if (decision.session !== sessionId) {
    analyticsSession.adopt(decision.session);
    sessionId = decision.session;
  }
  // Consent withdrawn after the session was picked.
  if (!replayConsented(decision)) return;
  const { startRecording } = await loadModule("replay.js");
  if (replayRecorder || !replayConsented(decision)) return;
  installHooks();
  replayRecorder = startRecording({
    collectUrl: COLLECT_URL,
    token: decision.token,
    masking: decision.masking,
    excludedPaths: decision.excludedPaths || [],
    onlyPaths: decision.onlyPaths || [],
    canvasPages: decision.canvasPages || [],
    minDuration: decision.minDuration || 0,
    pageTriggers: decision.pageTriggers || [],
    eventTriggers: decision.eventTriggers || [],
    rageTrigger: Boolean(decision.rageTrigger),
    feedbackOnly: Boolean(decision.feedbackOnly),
    // Qualifying state and pages buffered before it, shared by the session's pages.
    stateKey: `analytics:replaystate:${siteid}:${sessionId}`,
    // The page's requests and console lines from before it started.
    earlyLog: replayLogEarly,
  });
  replayLogEarly = [];
  replayLogDone = true;
  replayLog = replayRecorder.log;
}

//. FEEDBACK ------------------------------------------------------
// The site's feedback buttons, on sites that turned one on (feedback.js is
// only downloaded there). Each button has its own pages, devices and visitors;
// each page shows the first that matches (the collector puts ones for some
// pages first) and swaps it on single-page navigations, unless the visitor is
// writing in it. A report carries the button, the page, the visit (for its
// recording), the element the visitor pointed at (as a heatmap selector),
// screen size and the page's recent script errors, failed requests and
// console errors. window.analytics.feedback() opens the page's form from the
// site's own link, also when the button is hidden; analytics.feedback(id)
// opens that button's form.
//
// Buttons with snapshots on also send a masked copy of the page (snapshot.js,
// like heatmaps) as it was when the form opened, uploaded after the report.
// A recorded visit (sampled, or kept in memory for a button with "lead_up")
// is qualified by the report, so its lead-up is uploaded with it.
let feedbackModule = null;
// snapshot.js once loaded, for buttons with snapshots; capture is synchronous.
let feedbackSnapshotLib = null;
// The page as it was when the form opened.
let feedbackCapture = null;
// { id, widget } of the button on the page.
let feedbackShown = null;
// Set once the page has loaded, so the first button doesn't slow it down.
let feedbackReady = false;
let feedbackQueue = Promise.resolve();
const queueFeedback = (task) => (feedbackQueue = feedbackQueue.then(task).catch(() => {}));
const scheduleFeedback = () => (feedbackReady ? queueFeedback(updateFeedback) : Promise.resolve());

// Older collectors send one button for every page.
const feedbackList = (config) => (config?.feedbacks?.length ? config.feedbacks : config?.feedback ? [config.feedback] : []);
const feedbackFor = (list, path) => list.find((w) => placeMatches(w.targeting || {}, path) && widgetAudienceMatches(w.targeting));

async function showFeedback(settings) {
  if (feedbackShown && feedbackShown.id === settings?.id) return;
  feedbackShown?.widget.remove();
  feedbackShown = null;
  if (!settings) return;
  feedbackModule ||= loadModule("feedback.js").catch((error) => {
    feedbackModule = null;
    throw error;
  });
  const { renderFeedback } = await feedbackModule;
  if (settings.snapshot && !feedbackSnapshotLib) {
    loadModule("snapshot.js").then((lib) => { feedbackSnapshotLib = lib; }).catch(() => {});
  }
  const widget = renderFeedback(settings, {
    selector: heatmapSelector,
    capture: () => {
      feedbackCapture = null;
      if (!settings.snapshot || !feedbackSnapshotLib || typeof CompressionStream === "undefined") return;
      const snapshot = feedbackSnapshotLib.captureSnapshot({ masking: settings.masking });
      if (!snapshot) return;
      feedbackCapture = {
        html: snapshot.html, page_height: snapshot.page_height,
        w: window.innerWidth, h: window.innerHeight, sx: Math.round(window.scrollX), sy: Math.round(window.scrollY),
      };
    },
    submit: (report) => sendFeedback({ ...report, widget_id: settings.id || "" }),
  });
  feedbackShown = { id: settings.id, widget };
}

async function updateFeedback() {
  if (!siteid || !current?.src || navigator.webdriver) return;
  const path = lastTrackedPath || location.pathname;
  const list = feedbackList(await loadSiteConfig().catch(() => null));
  if ((lastTrackedPath || location.pathname) !== path || feedbackShown?.widget.isOpen()) return;
  await showFeedback(pageTracked(path) ? feedbackFor(list, path) : null);
}

window.analytics.feedback = (id) => queueFeedback(async () => {
  if (!siteid || !current?.src || navigator.webdriver) return;
  const list = feedbackList(await loadSiteConfig().catch(() => null));
  // That button, else the page's, else the first.
  const settings = id ? list.find((w) => w.id === String(id))
    : feedbackShown ? null : feedbackFor(list, lastTrackedPath || location.pathname) || list[0];
  if (settings) await showFeedback(settings);
  feedbackShown?.widget.open();
});

// Resolves to { ok, message }.
function sendFeedback(report) {
  const now = Date.now();
  const capture = feedbackCapture;
  return fetch(new URL("feedback/submit", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    body: JSON.stringify({
      ...report,
      siteid,
      path: lastTrackedPath || location.pathname,
      title: document.title,
      session_id: readConsent() === false ? "" : analyticsSession.getId(),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      page_height: document.documentElement.scrollHeight,
      language: navigator.language || "",
      errors: feedbackErrors.map(({ at, ...e }) => ({ ...e, ms: now - at })),
      breadcrumbs: breadcrumbs.map(({ at, ...crumb }) => ({ ...crumb, ms: Math.max(0, now - at) })),
      snapshot: Boolean(capture),
    }),
  }).then(async (response) => {
    const answer = await response.json().catch(() => ({}));
    if (response.ok) {
      feedbackCapture = null;
      replayRecorder?.report?.();
      if (capture && answer.snapshot_token) uploadFeedbackSnapshot(answer.snapshot_token, capture).catch(() => {});
    }
    return { ok: response.ok, message: answer.message || "" };
  }).catch(() => ({ ok: false, message: "" }));
}

// After the report, so the visitor isn't kept waiting.
async function uploadFeedbackSnapshot(token, capture) {
  const body = await new Response(
    new Blob([capture.html]).stream().pipeThrough(new CompressionStream("gzip")),
  ).blob();
  const upload = new URL("feedback/snapshot", COLLECT_URL);
  upload.searchParams.set("token", token);
  for (const key of ["w", "h", "sx", "sy", "page_height"]) upload.searchParams.set(key, capture[key]);
  await fetch(upload, { method: "POST", headers: { "Content-Type": "text/plain" }, credentials: "omit", body });
}

//. SURVEYS -------------------------------------------------------
// The site's active surveys are fetched at most every 10 minutes per tab. On
// each page the first survey whose targeting matches, and that this visitor
// hasn't answered or closed, waits for its trigger (seconds on the page,
// scroll depth, or the mouse leaving the page) and survey.js shows it.
// Surveys shown after an event are watched beside it; an event that leads to
// another page (a purchase redirecting to a thank-you page) shows the survey
// there. Page votes ("Was this page helpful?") sit inside the page, once per
// page per visitor, and don't count towards the site's cooldown.
// survey.js sits next to this script and is only downloaded to show one.
const SURVEYS_KEY = `analytics:surveys:${siteid}`;
const SURVEYS_TTL_MS = 10 * 60 * 1000;
// When this visitor last answered or closed any of the site's surveys.
const SURVEY_LAST_KEY = `analytics:survey-last:${siteid}`;
// An event survey waiting to be shown: { id, at } (when to show it).
const SURVEY_PENDING_KEY = `analytics:survey-pending:${siteid}`;
const SURVEY_PENDING_MS = 10 * 60 * 1000;
// Pages voted on, per page vote: { path: when }.
const HELPFUL_PATHS_MAX = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
let surveyCleanup = null;
let surveyShowing = false;

const readStored = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};
const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* optional storage */ }
};

// ---- Visit memory ----
// What this device remembers of earlier visits for audience rules and tests:
// its first visit, visit count, events fired, survey answers, test variants,
// last lead and how the visit arrived. Only a visitor this site may recognise
// (they said yes, or its mode recognises them until they say no) keeps it on
// the device. Everyone else keeps it for this tab only, in tabStore, so
// nothing lasting is stored before they agree; their rules see a first visit
// each time. A lasting copy from an older tracker is removed as it's touched.
// On a site with none of those rules, "this tab" is only this page (tabStore).
// Function declarations, so setConsent can clear them whenever it runs.
function visitMemoryKeys() {
  return ["firstseen", "channel", "visitstats", "lead", "events-seen", "answers", "experiments", "experiments-seen"]
    .map((name) => `analytics:${name}:${siteid}`);
}
function mayRemember() {
  return readConsent() === true || recognisedWithoutAnswer();
}
function readVisitMemory(key) {
  try {
    return JSON.parse((mayRemember() ? localStorage : tabStore()).getItem(key) || "null");
  } catch {
    return null;
  }
}
function writeVisitMemory(key, value) {
  try {
    if (mayRemember()) {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      tabStore().setItem(key, JSON.stringify(value));
      localStorage.removeItem(key);
    }
  } catch { /* optional storage */ }
}
function forgetVisitMemory() {
  try {
    for (const key of visitMemoryKeys()) localStorage.removeItem(key);
  } catch { /* optional storage */ }
}
// ---- end visit memory ----

// "/blog/*" matches /blog and everything under it (never /blogger), the
// dashboard's own rule; "/blog*" is any path starting /blog; other patterns
// match one path.
function pathMatches(path, patterns) {
  const clean = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p).toLowerCase();
  const target = clean(path);
  return patterns.some((pattern) => {
    const p = String(pattern).trim().toLowerCase();
    if (!p) return false;
    if (!p.endsWith("*")) return target === clean(p);
    return target.startsWith(p.slice(0, -1)) || (p.endsWith("/*") && target === clean(p.slice(0, -2)));
  });
}

// The site's active surveys and cookie banner, one request per tab (cached).
let siteConfigRequest = null;
// The visitor's country as the collector saw it, for widget audiences.
let visitorCountry = "";
// The site's model of who converts (intentModel.js), for "likely to convert" audiences.
let siteIntent = null;
// The visitor's device, browser, OS, region and city as analytics names them
// (the collector works them out), for audiences matching those values.
let visitorFacts = {};
// "Pages to track" in the site's settings. The collector keeps nothing from a
// page left out, so surveys, popups, notices, feedback buttons, A/B tests and
// lead capture stay off it too. The banner, spam protection, site edits and
// widgets placed in the page stay: they aren't tracking.
let trackedPages = null;
function pageTracked(path) {
  if (!trackedPages?.pages?.length) return true;
  return pathMatches(path, trackedPages.pages) === (trackedPages.mode === "only");
}
async function loadSiteConfig() {
  try {
    const cached = JSON.parse(tabStore().getItem(SURVEYS_KEY) || "null");
    if (cached && Date.now() - cached.at < SURVEYS_TTL_MS) {
      visitorCountry = cached.country || "";
      siteIntent = cached.intent || null;
      visitorFacts = cached.visitor || {};
      trackedPages = cached.trackedPages || null;
      errorsAreOff(cached.errors);
      return cached;
    }
  } catch { /* optional storage */ }
  siteConfigRequest ||= fetch(new URL("surveys/config", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    // Page votes are only sent to trackers that can place them.
    body: JSON.stringify({
      siteid,
      features: ["helpful", "widget-tests", "edit-audience", "triggers", "shield", "launcher", "audience-2", "feedback-list", "audience-3", "widgets-inline"],
      screen: { width: window.screen.width, height: window.screen.height },
    }),
  }).then(async (response) => {
    if (!response.ok) return { surveys: [], cooldownDays: 0, banner: null, consentRegions: null, leadforms: [], notices: [], experiments: [], country: "", capture_all: false, feedback: null, feedbacks: [], clicks: [], widgets: [], shield: null, intent: null, errors: true, visitor: {}, trackedPages: null };
    // errors: an older collector leaves it out, which must not read as "off".
    const { surveys = [], cooldownDays = 0, banner = null, consentRegions = null, leadforms = [], notices = [], experiments = [], country = "", capture_all = false, feedback = null, feedbacks = [], clicks = [], widgets = [], shield = null, intent = null, errors = true, visitor = {}, trackedPages: pagesToTrack = null } = await response.json();
    const config = { at: Date.now(), surveys, cooldownDays, banner, consentRegions, leadforms, notices, experiments, country, capture_all, feedback, feedbacks, clicks, widgets, shield, intent, errors, visitor, trackedPages: pagesToTrack };
    visitorCountry = country || "";
    trackedPages = pagesToTrack;
    siteIntent = intent;
    visitorFacts = visitor || {};
    errorsAreOff(errors);
    if (banner || consentRegions || surveys.length || leadforms.length || notices.length || experiments.length ||
        [feedback, ...feedbacks, ...widgets].some((w) => w?.targeting?.audience)) keepForTab();
    try {
      tabStore().setItem(SURVEYS_KEY, JSON.stringify(config));
    } catch { /* optional storage */ }
    return config;
  }).finally(() => { siteConfigRequest = null; });
  return siteConfigRequest;
}

// Only page votes while the site's cooldown since this visitor's last survey runs.
async function loadSurveys() {
  const { surveys, cooldownDays } = await loadSiteConfig();
  const last = Number(readStored(SURVEY_LAST_KEY)) || 0;
  return Date.now() - last < (Number(cooldownDays) || 0) * DAY_MS ? surveys.filter((s) => s.kind === "helpful") : surveys;
}

const readPending = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SURVEY_PENDING_KEY) || "null");
  } catch {
    return null;
  }
};
const writePending = (value) => {
  try {
    if (value) sessionStorage.setItem(SURVEY_PENDING_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(SURVEY_PENDING_KEY);
  } catch { /* optional storage */ }
};

const helpfulKey = (survey) => `analytics:helpful:${survey.id}`;
const helpfulPath = (path) => (path.length > 1 ? path.replace(/\/+$/, "") : path).toLowerCase();
function rememberHelpful(survey, path) {
  const voted = { ...(readStored(helpfulKey(survey)) || {}), [helpfulPath(path)]: Date.now() };
  writeStored(helpfulKey(survey), Object.fromEntries(
    Object.entries(voted).sort((a, b) => b[1] - a[1]).slice(0, HELPFUL_PATHS_MAX)));
}

// `seen.answered` / `seen.closed` hold when that happened (older trackers
// stored true). 0 days = never again.
const waitedSince = (at, days) => {
  if (!at) return true;
  if (!days) return false;
  return typeof at === "number" && Date.now() - at >= days * DAY_MS;
};

// The targeting's pages (unless anyPage) and device.
function placeMatches(targeting, path, anyPage = false) {
  const mobile = window.innerWidth < 768;
  if ((targeting.device === "mobile" && !mobile) || (targeting.device === "desktop" && mobile)) return false;
  return anyPage || !(Array.isArray(targeting.pages) && targeting.pages.length && !pathMatches(path, targeting.pages));
}

function surveyMatches(survey, path, key = `analytics:survey:${survey.id}`, anyPage = false) {
  const targeting = survey.targeting || {};
  const seen = readStored(key) || {};
  if (survey.kind === "helpful") {
    if (readStored(helpfulKey(survey))?.[helpfulPath(path)]) return false;
  } else {
    if (!waitedSince(seen.answered, Number(targeting.again_days) || 0)) return false;
    if (!waitedSince(seen.closed, Number(targeting.closed_days) || 0)) return false;
  }
  if (!placeMatches(targeting, path, anyPage)) return false;
  if (!widgetAudienceMatches(targeting)) return false;
  // One sample decision per visitor and survey, kept on the device.
  const sample = Number(targeting.sample) || 100;
  if (sample < 100) {
    if (seen.sampled === undefined) {
      seen.sampled = Math.random() * 100 < sample;
      writeStored(key, seen);
    }
    if (!seen.sampled) return false;
  }
  return true;
}

async function scheduleSurvey() {
  surveyCleanup?.();
  surveyCleanup = null;
  if (!siteid || !current?.src || navigator.webdriver) return;
  const path = lastTrackedPath;
  const surveys = await loadSurveys().catch(() => []);
  if (lastTrackedPath !== path || !pageTracked(path)) return;
  const stops = [];
  surveyCleanup = () => stops.forEach((stop) => stop());

  const helpful = surveys.find((s) => s.kind === "helpful" && surveyMatches(s, path));
  if (helpful) stops.push(showHelpful(helpful, path));

  if (surveyShowing) return;
  const popups = surveys.filter((s) => s.kind !== "helpful");
  const open = (survey) => {
    if (lastTrackedPath === path && !surveyShowing && !leadPopupShowing && !noticePopupShowing) showSurvey(survey, path).catch(() => { surveyShowing = false; });
  };

  // An event on an earlier page: shown here, on any page.
  const pending = readPending();
  if (pending) {
    const survey = Date.now() - pending.at < SURVEY_PENDING_MS
      && popups.find((s) => s.id === pending.id && surveyMatches(s, path, undefined, true));
    if (survey) {
      const timer = setTimeout(() => open(survey), Math.max(1000, pending.at - Date.now()));
      stops.push(() => clearTimeout(timer));
      return;
    }
    writePending(null);
  }

  for (const survey of popups) {
    if (survey.targeting?.trigger?.type !== "event" || !surveyMatches(survey, path)) continue;
    let timer = null;
    stops.push(watchTrigger(survey.targeting.trigger, () => {
      if (timer || surveyShowing) return;
      const delay = (Number(survey.targeting.trigger.value) || 0) * 1000;
      writePending({ id: survey.id, at: Date.now() + delay });
      timer = setTimeout(() => open(survey), delay);
    }));
    stops.push(() => clearTimeout(timer));
  }

  const survey = popups.find((s) => s.targeting?.trigger?.type !== "event" && surveyMatches(s, path));
  if (!survey) return;
  // Scroll triggers can fire while being set up, so a flag rather than stopping.
  let fired = false;
  stops.push(watchTrigger(survey.targeting?.trigger, () => {
    if (fired) return;
    fired = true;
    open(survey);
  }));
}

// A page vote at <div data-analytics-helpful> or at the end of the vote's
// anchor (e.g. "article, main"); nothing when the page has neither. Returns a
// function that takes it off the page.
function showHelpful(survey, path) {
  let removed = false;
  let remove = null;
  const place = () => {
    let mount = document.querySelector("[data-analytics-helpful]");
    try {
      mount ||= survey.look?.anchor ? document.querySelector(survey.look.anchor) : null;
    } catch { /* invalid selector */ }
    if (!mount) return false;
    showSurvey(survey, path, mount).then((stop) => {
      if (removed) stop?.();
      else remove = stop;
    }).catch(() => {});
    return true;
  };
  // Spots that frameworks render a little after the page view.
  const timer = place() ? null : setTimeout(place, 2000);
  return () => {
    removed = true;
    clearTimeout(timer);
    remove?.();
  };
}

// Calls show once the trigger fires (seconds on the page, scroll depth, the
// mouse leaving the page, or a named event); returns a function that stops watching.
function watchTrigger(trigger = { type: "delay", value: 5 }, show) {
  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  // window.analytics.track("name") or a click on [data-analytics-event="name"].
  if (trigger.type === "event") {
    const onEvent = (e) => {
      if (e.detail?.eventname === trigger.name) show();
    };
    const onClick = (e) => {
      if (e.target?.closest?.("[data-analytics-event]")?.dataset.analyticsEvent === trigger.name) show();
    };
    document.addEventListener("analytics-event", onEvent);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("analytics-event", onEvent);
      document.removeEventListener("click", onClick, true);
    };
  }
  if (trigger.type === "scroll") {
    const onScroll = () => {
      const { y, view, height } = pageScroll();
      const room = height - view;
      if (room <= 0 || (y / room) * 100 >= (Number(trigger.value) || 50)) show();
    };
    // Rides the shared per-frame measurement instead of its own layout read.
    scrollWatchers.add(onScroll);
    onScroll();
    return () => scrollWatchers.delete(onScroll);
  }
  if (trigger.type === "exit" && !touch) {
    const onLeave = (e) => {
      if (!e.relatedTarget && e.clientY <= 0) show();
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }
  // Exit intent has no mouse to watch on touch screens: show after 30 seconds.
  const seconds = trigger.type === "exit" ? 30 : Number(trigger.value) || 5;
  const timer = setTimeout(show, seconds * 1000);
  return () => clearTimeout(timer);
}

// A popup survey, or a page vote inside `mount`; resolves to a function that
// removes it.
async function showSurvey(survey, path, mount = null) {
  const inline = Boolean(mount);
  if (!inline) {
    surveyShowing = true;
    writePending(null);
  }
  const responseId = globalThis.crypto?.randomUUID?.();
  if (!responseId) {
    if (!inline) surveyShowing = false;
    return null;
  }
  const key = `analytics:survey:${survey.id}`;
  const remember = (flag) => {
    if (inline) return;
    writeStored(key, { ...(readStored(key) || {}), [flag]: Date.now() });
    writeStored(SURVEY_LAST_KEY, Date.now());
  };
  const send = (kind, extra = {}) => fetch(new URL("surveys/event", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify({
      // A visitor who declined consent answers without their visit attached.
      siteid, survey_id: survey.id, response_id: responseId, session_id: readConsent() === false ? "" : analyticsSession.getId(),
      url: path, viewport_width: window.innerWidth, kind, ...extra,
    }),
  }).then((r) => r.status).catch(() => 0);
  const { renderSurvey } = await loadModule("survey.js");
  if (inline && lastTrackedPath !== path) return null;
  // A page vote counts as shown once it scrolls into view.
  if (!inline) send("shown");
  return renderSurvey(survey, {
    shown: () => send("shown"),
    answer: (questionId, answer) => {
      if (inline) rememberHelpful(survey, path);
      rememberAnswer(survey.id, questionId, answer);
      return send("answer", { question_id: questionId, answer });
    },
    complete: () => {
      remember("answered");
      send("completed");
    },
    // Closed without answering anything: not shown to this visitor again.
    close: (answered) => {
      remember(answered ? "answered" : "closed");
      if (!answered) send("closed");
      if (!inline) surveyShowing = false;
    },
    done: () => { if (!inline) surveyShowing = false; },
  }, mount);
}

//. LEAD FORMS ----------------------------------------------------
// Newsletter, contact and download forms made in the dashboard. Inline ones
// fill <div data-analytics-leadform="id"> on any page; popups wait for their
// trigger like surveys (never both at once). A visitor who signed up doesn't
// see that popup again (unless "again_days" passed). Each sign-up is also a
// "lead" event, so it counts in goals and funnels without the contact details.
let leadPopupCleanup = null;
let leadPopupShowing = false;

async function scheduleLeadForms() {
  leadPopupCleanup?.();
  leadPopupCleanup = null;
  if (!siteid || !current?.src || navigator.webdriver) return;
  const path = lastTrackedPath;
  const config = await loadSiteConfig().catch(() => null);
  // A/B tests between forms leave this visitor's version only.
  const { hidden, swap, extra } = await widgetPicks("leadform", config, path);
  const tracked = pageTracked(path);
  const forms = [...config?.leadforms || [], ...extra].filter((f, i, all) => !hidden.has(f.id) && all.findIndex((x) => x.id === f.id) === i && (tracked || f.display !== "popup"));
  if (!forms.length || lastTrackedPath !== path) return;

  const fillInline = () => {
    for (const mount of document.querySelectorAll("[data-analytics-leadform]")) {
      if (mount.hasAttribute("data-analytics-leadform-ready")) continue;
      // A tested form's spot shows the visitor's version, unless that's a popup.
      const wanted = mount.getAttribute("data-analytics-leadform");
      const form = forms.find((f) => f.id === (swap.get(wanted) || wanted));
      if (!form || (form.id !== wanted && form.display === "popup")) continue;
      mount.setAttribute("data-analytics-leadform-ready", "");
      showLeadForm(form, path, mount).catch(() => mount.removeAttribute("data-analytics-leadform-ready"));
    }
  };
  fillInline();
  // Spots that frameworks render a little after the page view.
  setTimeout(fillInline, 2000);

  const open = (form, after) => {
    if (lastTrackedPath !== path || leadPopupShowing || surveyShowing || noticePopupShowing) return false;
    leadPopupShowing = true;
    showLeadForm(form, path, null, after).catch(() => {
      leadPopupShowing = false;
      after?.();
    });
    return true;
  };
  const stops = [];
  // "Button" popups get a floating button (e.g. "Request a call") that opens
  // them on click and comes back when they close; they never open by themselves.
  const launched = forms.filter((f) => f.display === "popup" && f.targeting?.trigger?.type === "button" && placeMatches(f.targeting, path)
    && widgetAudienceMatches(f.targeting));
  if (launched.length) {
    let stopped = false;
    let launcher = null;
    stops.push(() => {
      stopped = true;
      launcher?.remove();
    });
    // One button per page: the first such form.
    const form = launched[0];
    loadModule("leadform.js").then(({ renderLauncher }) => {
      if (stopped) return;
      launcher = renderLauncher(form, () => {
        if (open(form, () => launcher?.show(true))) launcher.show(false);
      });
    }).catch(() => {});
  }
  // Event popups open whenever the visitor asks (e.g. a "Get a quote"
  // button), also after closing or signing up before.
  for (const form of forms) {
    if (form.display === "popup" && form.targeting?.trigger?.type === "event" && placeMatches(form.targeting, path)
      && widgetAudienceMatches(form.targeting)) {
      stops.push(watchTrigger(form.targeting.trigger, () => open(form)));
    }
  }
  // At most one other popup per page.
  const popup = forms.find((f) => f.display === "popup" && !["event", "button"].includes(f.targeting?.trigger?.type)
    && surveyMatches(f, path, `analytics:leadform:${f.id}`));
  if (popup) {
    // Scroll triggers can fire while being set up, so a flag rather than stopping.
    let fired = false;
    stops.push(watchTrigger(popup.targeting?.trigger, () => {
      if (fired) return;
      fired = true;
      open(popup);
    }));
  }
  leadPopupCleanup = () => stops.forEach((stop) => stop());
}

// `after` runs once a popup is gone (closed or finished).
async function showLeadForm(form, path, mount, after) {
  const key = `analytics:leadform:${form.id}`;
  const remember = (flag) => writeStored(key, { ...(readStored(key) || {}), [flag]: Date.now() });
  // Cached, so this is the same config the forms themselves came from: it
  // carries the country the collector geo-located for this visit, which a
  // field's condition can be written against.
  const [{ renderLeadForm }, shield, config] = await Promise.all([
    loadModule("leadform.js"), pageShield(), loadSiteConfig().catch(() => null),
  ]);
  // A shown lead form is a protected form: its check starts now. A calculator
  // sends nothing, so there is no submission to protect.
  if (form.submit !== false) shield?.start();
  // Counted for the form's conversion rate.
  fetch(new URL("leads/view", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify({ siteid, form_id: form.id }),
  }).catch(() => {});
  renderLeadForm(form, mount, {
    shield,
    image: mount ? "" : siteImageUrl(form.image),
    // What a field's condition can know about the visit rather than the
    // answers. The country is the one the collector geo-located for this
    // visit; the width is bucketed here on the same thresholds deviceBucket
    // uses server-side (expresscollect/utils/heatmap.js), and the collector
    // buckets viewport_width again from the submission below, so the form a
    // visitor is shown and the one that is kept agree.
    context: {
      country: String(config?.country || "").toUpperCase(),
      device: window.innerWidth < 768 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop",
    },
    submit: (values, extra) => {
      const body = {
        // A visitor who declined consent signs up without their visit attached.
        siteid, form_id: form.id, values, ...extra, session_id: readConsent() === false ? "" : analyticsSession.getId(),
        url: lastTrackedPath || path, viewport_width: window.innerWidth,
        // What lets this answer be sent more than once safely: the collector
        // keeps the first arrival and acknowledges the rest.
        submission_id: randomId(),
      };
      return fetch(leadUrl(LEAD_SUBMIT_PATH), {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        credentials: "omit",
        body: JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) })).catch(() => ({ status: 0 }))
        .then((reply) => {
          // Unreachable or broken, which is our fault and not the visitor's:
          // keep the answer and thank them, rather than showing an error that
          // sends a real enquiry away for good. A 4xx still comes back as
          // itself — that is the form telling them something they can fix.
          // Only to an address on this site (sameSiteTarget); otherwise the thank-you.
          if (reply.redirect) reply.redirect = sameSiteTarget(reply.redirect);
          if (reply.status !== 0 && reply.status < 500) return reply;
          if (!body.submission_id) return reply;
          queueLead(body, LEAD_SUBMIT_PATH);
          return { status: 202, message: "Accepted" };
        });
    },
    submitted: () => {
      remember("answered");
      markLead();
      window.analytics.track("lead", { label: form.name || form.id });
    },
    // A calculator's one event: what they priced, and the answers it came
    // from, as an ordinary custom event. Its figure lands as the event's
    // amount, so the Events report totals what people are pricing.
    used: ({ label, amount, answers }) => {
      remember("answered");
      window.analytics.track("calculator", { label, ...(amount === undefined ? {} : { amount }), ...answers });
    },
    // The sign-up discount copied off the thank-you. The same event the notice
    // bar's Copy button sends, so one code used on both reads as one code in
    // the Shop report's coupons, against the orders it was spent on.
    copy: (code) => window.analytics.track("coupon_copied", { label: code }),
    close: () => {
      remember("closed");
      if (!mount) leadPopupShowing = false;
      after?.();
    },
    done: () => {
      if (!mount) leadPopupShowing = false;
      after?.();
    },
  });
}

//. NOTICES -------------------------------------------------------
// Announcement bars (promotions, service notices), "What's new" panels and
// popups made in the dashboard; notice.js renders them. One of each per
// page: the newest that matches its pages and device. Bars and panels stay
// up across single-page navigations while they still match. A closed bar or
// popup stays closed for its closed_days (0 = for good) or until it's edited.
// A popup waits for its trigger, and never opens over (or under) a survey or
// lead form popup.
const CHANGELOG_FRESH_MS = 60 * DAY_MS;
let noticeBar = null;
let noticeChangelog = null;
let noticePopupWatch = null;
let noticePopupShowing = false;
// Shown on this page load already: not again on the next navigations.
const noticePopupsShown = new Set();

// A notice's or form's image (served by the collector).
const siteImageUrl = (image) => (image?.url ? new URL(image.url, COLLECT_URL).href : "");

function sendNotice(notice, kind) {
  fetch(new URL("notices/event", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify({ siteid, notice_id: notice.id, kind }),
  }).catch(() => {});
}

// One update at a time, so quick navigations can't show two bars.
let noticeQueue = Promise.resolve();
const scheduleNotices = () => (noticeQueue = noticeQueue.then(updateNotices).catch(() => {}));

async function updateNotices() {
  if (!siteid || !current?.src || navigator.webdriver) return;
  const path = lastTrackedPath;
  const config = await loadSiteConfig().catch(() => null);
  // A/B tests between notices leave this visitor's version only.
  const { hidden, extra } = await widgetPicks("notice", config, path);
  const notices = !pageTracked(path) ? [] : [...config?.notices || [], ...extra].filter((n, i, all) => !hidden.has(n.id) && all.findIndex((x) => x.id === n.id) === i);
  if (lastTrackedPath !== path) return;
  const live = (n) => !n.ends_at || new Date(n.ends_at).getTime() > Date.now();
  const shown = (n) => live(n) && placeMatches(n.targeting || {}, path) && widgetAudienceMatches(n.targeting);
  const bar = notices.find((n) => n.kind === "bar" && shown(n) && !noticeClosed(n));
  // Event popups open whenever the visitor asks, also after closing.
  const popup = notices.find((n) => n.kind === "popup" && shown(n)
    && (n.targeting?.trigger?.type === "event" || (!noticeClosed(n) && !noticePopupsShown.has(n.id))));
  const changelog = notices.find((n) => n.kind === "changelog" && shown(n));
  if (noticeBar?.id !== bar?.id || noticeBar?.updated_at !== bar?.updated_at) {
    noticeBar?.remove();
    noticeBar = null;
    if (bar) await showBar(bar);
  }
  if (noticeChangelog?.id !== changelog?.id || noticeChangelog?.updated_at !== changelog?.updated_at) {
    noticeChangelog?.remove();
    noticeChangelog = null;
    if (changelog) await showChangelog(changelog);
  }
  if (noticeChangelog) bindChangelogLaunchers();
  watchPopup(popup);
}

function noticeClosed(notice) {
  const seen = readStored(`analytics:notice:${notice.id}`) || {};
  // Edited since it was closed: a new message, shown again.
  if (!seen.closed || (seen.version || 0) < (notice.updated_at || 0)) return false;
  return !waitedSince(seen.closed, Number(notice.targeting?.closed_days) || 0);
}

async function showBar(notice) {
  const { renderBar } = await loadModule("notice.js");
  const remove = renderBar(notice, {
    click: () => {
      sendNotice(notice, "click");
      window.analytics.track("notice_click", { label: notice.name || notice.id });
    },
    // The Shop report's Coupons table counts copies per code.
    copy: () => window.analytics.track("coupon_copied", { label: notice.coupon }),
    close: () => {
      writeStored(`analytics:notice:${notice.id}`, { closed: Date.now(), version: notice.updated_at || 0 });
      noticeBar = null;
    },
  });
  if (!remove) return;
  sendNotice(notice, "view");
  noticeBar = { id: notice.id, updated_at: notice.updated_at, remove };
}

// Watches the page's popup trigger; an open popup stays through navigations.
function watchPopup(notice) {
  if (noticePopupShowing) return;
  noticePopupWatch?.();
  noticePopupWatch = null;
  if (!notice) return;
  const event = notice.targeting?.trigger?.type === "event";
  // Scroll triggers can fire while being set up, so a flag rather than stopping.
  let fired = false;
  noticePopupWatch = watchTrigger(notice.targeting?.trigger, () => {
    if ((fired && !event) || noticePopupShowing || surveyShowing || leadPopupShowing) return;
    fired = true;
    showPopup(notice).catch(() => { noticePopupShowing = false; });
  });
}

async function showPopup(notice) {
  noticePopupShowing = true;
  noticePopupsShown.add(notice.id);
  const { renderPopup } = await loadModule("notice.js");
  renderPopup(notice, {
    image: siteImageUrl(notice.image),
    shown: () => sendNotice(notice, "view"),
    click: () => {
      sendNotice(notice, "click");
      window.analytics.track("notice_click", { label: notice.name || notice.id });
    },
    copy: () => window.analytics.track("coupon_copied", { label: notice.coupon }),
    close: () => {
      writeStored(`analytics:notice:${notice.id}`, { closed: Date.now(), version: notice.updated_at || 0 });
      noticePopupShowing = false;
    },
    // Its image didn't load, and the image was all of it.
    failed: () => { noticePopupShowing = false; },
  });
}

async function showChangelog(notice) {
  const key = `analytics:notice:${notice.id}`;
  // Entries newer than the last one this visitor saw; for first visits, the
  // recent ones only.
  const seenUpTo = Number(readStored(key)?.seen) || Date.now() - CHANGELOG_FRESH_MS;
  const unread = (notice.entries || []).filter((e) => new Date(e.date).getTime() > seenUpTo).map((e) => e.id);
  const { renderChangelog } = await loadModule("notice.js");
  const panel = renderChangelog(notice, {
    unread,
    imageUrl: siteImageUrl,
    opened: () => {
      const newest = Math.max(0, ...(notice.entries || []).map((e) => new Date(e.date).getTime() || 0));
      writeStored(key, { seen: Math.max(newest, Date.now()) });
      setLauncherUnread(0);
      sendNotice(notice, "view");
    },
    click: () => {
      sendNotice(notice, "click");
      window.analytics.track("notice_click", { label: notice.name || notice.id });
    },
  });
  noticeChangelog = { id: notice.id, updated_at: notice.updated_at, unread: unread.length, ...panel };
}

// The site's own "What's new" links (data-analytics-changelog) open the
// panel and carry the unread count in data-analytics-unread for styling.
let changelogClicksBound = false;
function bindChangelogLaunchers() {
  setLauncherUnread(noticeChangelog.unread);
  if (changelogClicksBound) return;
  changelogClicksBound = true;
  document.addEventListener("click", (e) => {
    if (!noticeChangelog || !e.target?.closest?.("[data-analytics-changelog]")) return;
    e.preventDefault();
    noticeChangelog.open();
  }, true);
}

function setLauncherUnread(count) {
  if (noticeChangelog) noticeChangelog.unread = count;
  for (const node of document.querySelectorAll("[data-analytics-changelog]")) {
    if (count) node.setAttribute("data-analytics-unread", String(count));
    else node.removeAttribute("data-analytics-unread");
  }
}

//. SITE WIDGETS -------------------------------------------------
// Widgets the owner mounts inside their own pages, rather than over them: an
// empty element with data-analytics-widget="<kind>" (and
// data-analytics-widget-id="<id>" when a page has two of the same kind) is
// where the widget is drawn. widget.js is only downloaded on pages that have
// one.
//
// Mounts are resolved on each page view, and on DOM changes, because a mount
// added by the site's own client-side rendering can appear after the page
// view. Room is kept for the widget before its module loads, so the page
// below it doesn't shift once it draws (the owner sets the same height on
// their own element, since on a cold cache this script isn't what renders
// first).
const WIDGET_ATTR = "data-analytics-widget";
const WIDGET_SELECTOR = `[${WIDGET_ATTR}]`;
let widgetModule = null;
// The element each widget is drawn in -> { id, remove() }.
const widgetsMounted = new WeakMap();
let widgetObserver = null;
let widgetScan = null;
let widgetQueue = Promise.resolve();
const queueWidgets = (task) => (widgetQueue = widgetQueue.then(task).catch(() => {}));
const scheduleSiteWidgets = () => queueWidgets(updateSiteWidgets);

// The live numbers the status badge shows. Fetched once per page load (its own
// endpoint, cached a minute at the browser): the config this rides beside is
// kept ten minutes per tab, which would leave a badge stale through the start
// of an outage.
const widgetStatusRequests = new Map();
function loadWidgetStatus(days) {
  // Per window, since two badges on a page can cover different ones.
  if (!widgetStatusRequests.has(days)) {
    widgetStatusRequests.set(days, fetch(
      new URL(`widgets/status?siteid=${encodeURIComponent(siteid)}&days=${days}`, COLLECT_URL),
      { method: "GET", credentials: "omit" },
    ).then((response) => (response.ok ? response.json() : null)).catch(() => null));
  }
  return widgetStatusRequests.get(days);
}

// The widget for a mount element: its kind, and its id when the element names
// one. An element naming an id that isn't served gets nothing, rather than
// another widget of the same kind.
function widgetForMount(list, node) {
  const kind = node.getAttribute(WIDGET_ATTR);
  if (!kind) return null;
  const wanted = node.getAttribute("data-analytics-widget-id") || "";
  const path = lastTrackedPath || location.pathname;
  const matches = list.filter((w) => w.kind === kind
    && placeMatches(w.targeting || {}, path) && widgetAudienceMatches(w.targeting));
  if (wanted) return matches.find((w) => w.id === wanted) || null;
  // Otherwise the first that matches, as the other widgets do.
  return matches[0] || null;
}

async function drawWidget(node, widget) {
  const already = widgetsMounted.get(node);
  if (already?.id === widget.id) return;
  already?.remove();
  widgetsMounted.delete(node);
  // Keep the room before the module loads, not after.
  if (widget.height > 0 && !node.style.minHeight) node.style.minHeight = `${widget.height}px`;
  widgetModule ||= loadModule("widget.js").catch((error) => {
    widgetModule = null;
    throw error;
  });
  const { renderStatusBadge } = await widgetModule;
  if (!node.isConnected) return;
  let drawn = null;
  if (widget.kind === "status") {
    const days = Math.min(Math.max(Number(widget.look?.days) || 30, 1), 90);
    const status = await loadWidgetStatus(days);
    if (!status || !node.isConnected) return;
    drawn = renderStatusBadge(node, widget, status);
  }
  if (!drawn) return;
  widgetsMounted.set(node, { id: widget.id, remove: drawn.remove });
}

async function updateSiteWidgets() {
  if (!siteid || !current?.src || navigator.webdriver) return;
  const list = (await loadSiteConfig().catch(() => null))?.widgets || [];
  const nodes = document.querySelectorAll(WIDGET_SELECTOR);
  // Sites with no widgets and no mount elements do nothing beyond this.
  if (!list.length && !nodes.length) return;
  // Only watch for new mounts where there is something to draw in them.
  if (list.length) watchWidgetMounts();
  for (const node of nodes) {
    const widget = widgetForMount(list, node);
    if (!widget) {
      widgetsMounted.get(node)?.remove();
      widgetsMounted.delete(node);
      continue;
    }
    await drawWidget(node, widget).catch(() => {});
  }
}

// Mounts the site adds after the page view (client-side rendering, or a
// single-page navigation that swapped the page's content).
function watchWidgetMounts() {
  if (widgetObserver || typeof MutationObserver === "undefined") return;
  widgetObserver = new MutationObserver((records) => {
    if (widgetScan) return;
    const added = records.some((record) => [...record.addedNodes].some((node) => node.nodeType === 1
      && (node.matches?.(WIDGET_SELECTOR) || node.querySelector?.(WIDGET_SELECTOR))));
    if (!added) return;
    widgetScan = setTimeout(() => {
      widgetScan = null;
      scheduleSiteWidgets().catch(() => {});
    }, 200);
  });
  widgetObserver.observe(document.body, { childList: true, subtree: true });
}

//. A/B TESTS -----------------------------------------------------
// Tests made in the dashboard. On a page a running test targets, each visitor
// gets one variant (weighted, kept on this device; visitors outside the
// test's traffic share see the original and aren't counted), and the page is
// changed for it: text, an attribute, inline styles, hiding or moving an
// element, extra CSS; or the visitor is sent to the variant's URL. Changes are
// applied again whenever the page changes, so React and the like can't undo
// them. Once per visit and test the variant seen is reported
// (experiments/exposure), with how many of the test's elements weren't on the
// page. Visitors who declined consent see the original. A test can be for some
// visitors only (audience: countries, new or returning, where the visit came
// from); the others see the original and aren't counted. An ended test can keep
// its winner for everyone (rollout), which is applied but not reported.
// The optional snippet in <head> hides the elements tests change (as this
// device last saw them, or the whole page on a first visit) until this runs.
// A preview link (?ab_preview=<token>.<variant>) shows that variant in this
// tab, in any test status, with a badge to leave; previews are never reported.
// An editing link (?ab_edit=<token>.<variant>, opened from the dashboard)
// loads editor.js in this tab instead of running tests.
const EXPERIMENTS_KEY = `analytics:experiments:${siteid}`;
const EXPERIMENTS_SEEN_KEY = `analytics:experiments-seen:${siteid}`;
const EXPERIMENTS_HIDE_KEY = `analytics:abhide:${siteid}`;
// The visit this device was first seen in (returning = a later visit), and
// where the current visit came from.
const FIRST_SEEN_KEY = `analytics:firstseen:${siteid}`;
const VISIT_CHANNEL_KEY = `analytics:channel:${siteid}`;
// This visit's pages and the device's visit count (visitStats), and when it
// last sent one of the site's forms, for audience rules on what visitors did.
const VISIT_STATS_KEY = `analytics:visitstats:${siteid}`;
const LEAD_KEY = `analytics:lead:${siteid}`;
// Kept per visit: enough for "viewed /pricing" rules without growing forever.
const VISIT_PAGES_MAX = 50;
const EXPERIMENT_PREVIEW_KEY = `analytics:abpreview:${siteid}`;
const EXPERIMENT_EDIT_KEY = `analytics:abedit:${siteid}`;
// The pages of this visit each live edit's health was reported on.
const EDIT_HEALTH_KEY = `analytics:edithealth:${siteid}`;
// The open live editor, kept across a single-page app's pages.
let experimentEditor = null;
// A picking link (?ev_pick=<token>, from the dashboard's Events page) loads
// picker.js instead, to pick an element whose clicks become an event.
const EVENT_PICK_KEY = `analytics:evpick:${siteid}`;
let eventPicker = null;
// The elements whose clicks (and more) are events (see ELEMENT EVENTS).
let clickEvents = [];
const SEARCH_HOSTS = /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|qwant|startpage|search\.brave)\./;
const SOCIAL_HOSTS = /(^|\.)(facebook\.com|fb\.com|instagram\.com|t\.co|twitter\.com|x\.com|linkedin\.com|lnkd\.in|reddit\.com|youtube\.com|youtu\.be|tiktok\.com|pinterest\.[a-z.]+|threads\.net|bsky\.app)$/;
// How long to wait for a test's elements before reporting the ones missing.
const EXPERIMENT_WAIT_MS = 3000;
const EXPERIMENT_WATCHED_ATTRS = ["style", "class", "href", "src", "srcset", "alt", "title", "placeholder", "aria-label", "hidden"];
let experimentPath = null;
let experimentCleanup = null;
// Assignments for this page when storage is blocked.
const experimentMemory = {};
// What each style change left in an element's style, so an unchanged
// element isn't set again (browsers rewrite values, e.g. #fff to rgb()).
const experimentStyles = new WeakMap();

// "html" changes: only these tags and attributes reach the page. The value is
// parsed in an inert <template> (nothing in it runs or loads) and rebuilt
// node by node, so scripts, handlers and javascript: links never get through.
// Keep in sync with editor.js and the dashboard's visualEditorDom.js.
const SAFE_HTML_TAGS = new Set(["b", "strong", "i", "em", "u", "s", "small", "mark", "sup", "sub", "br", "span", "a", "code", "p", "ul", "ol", "li"]);
const DROPPED_HTML_TAGS = /^(script|style|template|iframe|object|embed|svg|math|noscript|textarea|select|title)$/;
const SAFE_HREF = /^(https?:\/\/|\/|#|mailto:|tel:|\?)/i;
function safeHtmlFragment(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  const out = document.createDocumentFragment();
  const copy = (from, to) => {
    for (const node of from.childNodes) {
      if (node.nodeType === 3) to.append(node.data);
      if (node.nodeType !== 1) continue;
      const tag = node.localName;
      if (!SAFE_HTML_TAGS.has(tag)) {
        if (!DROPPED_HTML_TAGS.test(tag)) copy(node, to);
        continue;
      }
      const clean = document.createElement(tag);
      for (const name of ["class", "title"]) if (node.hasAttribute(name)) clean.setAttribute(name, node.getAttribute(name));
      if (tag === "a") {
        const href = (node.getAttribute("href") || "").trim();
        if (SAFE_HREF.test(href)) clean.setAttribute("href", href);
        if (node.getAttribute("target") === "_blank") {
          clean.setAttribute("target", "_blank");
          clean.setAttribute("rel", "noopener noreferrer");
        }
      }
      copy(node, clean);
      to.append(clean);
    }
  };
  copy(template.content, out);
  return out;
}
// Each value cleaned once, as the markup it leaves, so an element already
// changed is left alone.
const safeHtmlCache = new Map();
function safeHtmlString(html) {
  if (!safeHtmlCache.has(html)) {
    const box = document.createElement("div");
    box.append(safeHtmlFragment(html));
    safeHtmlCache.set(html, box.innerHTML);
  }
  return safeHtmlCache.get(html);
}

const revealExperimentPage = () => document.getElementById("analytics-ab-hide")?.remove();
// The hide snippet is on this page: it hides the whole body when it finds no note.
const hasHideSnippet = Boolean(document.getElementById("analytics-ab-hide"));

function queryAllSafe(selector) {
  try {
    return [...document.querySelectorAll(selector)];
  } catch {
    return [];
  }
}

// The snippet's CSS for the next page: every element a test changes.
// Tests with a trigger change the page later on purpose, so they're left out.
function rememberExperimentHide(tests) {
  const selectors = [...new Set(tests.filter((t) => !waitsForTrigger(t))
    .flatMap((t) => t.variants.flatMap((v) => (v.changes || []).map((c) => c.selector))))];
  try {
    // A site that has never run a test leaves nothing behind.
    if (!selectors.length && !hasHideSnippet && localStorage.getItem(EXPERIMENTS_HIDE_KEY) === null) return;
    localStorage.setItem(EXPERIMENTS_HIDE_KEY, selectors.length ? selectors.map((s) => `${s}{opacity:0!important}`).join("") : "none");
  } catch { /* optional storage */ }
}

// The previewed test and variant for this tab, from the link or from an
// earlier page of the same preview.
async function experimentPreview() {
  let stored = null;
  try {
    stored = JSON.parse(sessionStorage.getItem(EXPERIMENT_PREVIEW_KEY) || "null");
  } catch { /* optional storage */ }
  let wanted = stored;
  const [token, variant] = (new URLSearchParams(location.search).get("ab_preview") || "").split(".");
  if (/^[0-9a-f]{24}$/.test(token || "") && variant) wanted = { token, variant };
  if (!wanted) return null;
  if (stored?.test && stored.token === wanted.token && stored.variant === wanted.variant) return stored;
  const response = await fetch(new URL("experiments/preview", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    body: JSON.stringify({ siteid, token: wanted.token }),
  });
  if (!response.ok) {
    try {
      sessionStorage.removeItem(EXPERIMENT_PREVIEW_KEY);
    } catch { /* optional storage */ }
    return null;
  }
  const entry = { token: wanted.token, variant: wanted.variant, test: (await response.json()).experiment };
  try {
    sessionStorage.setItem(EXPERIMENT_PREVIEW_KEY, JSON.stringify(entry));
  } catch { /* optional storage */ }
  return entry;
}

// The live-editor link for this tab (from the URL or an earlier page), checked
// with the collector; null when this isn't an editing tab.
async function experimentEditLink() {
  let stored = null;
  try {
    stored = JSON.parse(sessionStorage.getItem(EXPERIMENT_EDIT_KEY) || "null");
  } catch { /* optional storage */ }
  const [token, variant] = (new URLSearchParams(location.search).get("ab_edit") || "").split(".");
  const wanted = /^[0-9a-f]{24}$/.test(token || "") ? { token, variant: variant || "" } : stored;
  if (!wanted) return null;
  if (stored?.data && stored.token === wanted.token) return stored;
  const response = await fetch(new URL("experiments/edit-check", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    body: JSON.stringify({ siteid, token: wanted.token }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    try {
      sessionStorage.removeItem(EXPERIMENT_EDIT_KEY);
    } catch { /* optional storage */ }
    window.alert(data.message || "This editing link doesn't work any more. Open the editor again from your dashboard.");
    return null;
  }
  const entry = { ...wanted, data };
  try {
    sessionStorage.setItem(EXPERIMENT_EDIT_KEY, JSON.stringify(entry));
  } catch { /* optional storage */ }
  return entry;
}

// The element picker link for this tab (from the URL or an earlier page),
// checked with the collector; null when this isn't a picking tab.
async function eventPickLink() {
  let stored = null;
  try {
    stored = JSON.parse(sessionStorage.getItem(EVENT_PICK_KEY) || "null");
  } catch { /* optional storage */ }
  const token = new URLSearchParams(location.search).get("ev_pick") || "";
  const wanted = /^[0-9a-f]{24}$/.test(token) ? { token } : stored;
  if (!wanted) return null;
  if (stored?.data && stored.token === wanted.token) return stored;
  const response = await fetch(new URL("events/pick-check", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    body: JSON.stringify({ siteid, token: wanted.token }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.dashboard_origin) {
    try {
      sessionStorage.removeItem(EVENT_PICK_KEY);
    } catch { /* optional storage */ }
    window.alert(data.message || "This link doesn't work any more. Open the picker again from your dashboard.");
    return null;
  }
  const entry = { ...wanted, data };
  try {
    sessionStorage.setItem(EVENT_PICK_KEY, JSON.stringify(entry));
  } catch { /* optional storage */ }
  return entry;
}

function leaveEventPicker() {
  eventPicker = null;
  try {
    sessionStorage.removeItem(EVENT_PICK_KEY);
  } catch { /* optional storage */ }
  const url = new URL(location.href);
  url.searchParams.delete("ev_pick");
  location.replace(url.href);
}

function leaveExperimentEditor() {
  experimentEditor = null;
  try {
    sessionStorage.removeItem(EXPERIMENT_EDIT_KEY);
  } catch { /* optional storage */ }
  const url = new URL(location.href);
  url.searchParams.delete("ab_edit");
  url.searchParams.delete("ab_focus");
  location.replace(url.href);
}

function showPreviewBadge(preview, here) {
  document.getElementById("analytics-ab-preview")?.remove();
  if (!preview || !document.body) return;
  const bar = document.createElement("div");
  bar.id = "analytics-ab-preview";
  bar.setAttribute("style", "position:fixed;left:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:12px;"
    + "max-width:calc(100vw - 32px);padding:10px 12px 10px 14px;border-radius:10px;background:#111827;color:#fff;"
    + "font:600 13px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.3)");
  const label = document.createElement("span");
  const name = preview.test.variant_names?.[preview.variant] || preview.variant;
  label.textContent = `A/B preview: ${preview.test.name} · ${name}${here ? "" : " (not on this page)"}`;
  const exit = document.createElement("button");
  exit.type = "button";
  exit.textContent = "Exit preview";
  exit.setAttribute("style", "flex:none;padding:6px 10px;border:0;border-radius:6px;background:#fff;color:#111827;font:inherit;cursor:pointer");
  exit.addEventListener("click", () => {
    try {
      sessionStorage.removeItem(EXPERIMENT_PREVIEW_KEY);
    } catch { /* optional storage */ }
    const url = new URL(location.href);
    url.searchParams.delete("ab_preview");
    location.replace(url.href);
  });
  bar.append(label, exit);
  document.body.appendChild(bar);
}

function isReturningVisitor() {
  const session = analyticsSession.getId();
  let seen = readVisitMemory(FIRST_SEEN_KEY);
  if (!seen?.session) {
    seen = { session, at: Date.now() };
    writeVisitMemory(FIRST_SEEN_KEY, seen);
  }
  return seen.session !== session;
}

// Where the visit came from, worked out on its first page and kept for the
// visit: channel (search | social | paid | email | referral | direct; keep in
// sync with the backend's SOURCES), utm_campaign, referring site (no www.)
// and landing page. scheduleExperiments asks on every page, so the first is seen.
function visitOrigin() {
  const session = analyticsSession.getId();
  const stored = readVisitMemory(VISIT_CHANNEL_KEY);
  if (stored?.session === session && typeof stored.landing === "string") return stored;
  const params = new URLSearchParams(location.search);
  const medium = (params.get("utm_medium") || "").toLowerCase();
  let host = "";
  try {
    host = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : "";
  } catch { /* no referrer */ }
  let channel = "referral";
  if (/cpc|ppc|paid|cpm|display/.test(medium) || ["gclid", "gbraid", "wbraid", "msclkid", "ttclid"].some((k) => params.get(k))) channel = "paid";
  else if (/e-?mail|newsletter/.test(medium)) channel = "email";
  else if (medium.includes("social")) channel = "social";
  else if (!host || host === location.hostname) channel = "direct";
  else if (SEARCH_HOSTS.test(host)) channel = "search";
  else if (SOCIAL_HOSTS.test(host)) channel = "social";
  // The landing page's query parameters (a few, short), for URL parameter rules.
  const query = {};
  for (const [key, value] of params) if (Object.keys(query).length < 20 && key.length <= 60) query[key.toLowerCase()] = value.slice(0, 100);
  const origin = {
    session, channel, query,
    campaign: (params.get("utm_campaign") || "").trim().toLowerCase(),
    referrer: host && host !== location.hostname ? host.replace(/^www\./, "") : "",
    // A visit already under way when this was first asked keeps its channel.
    landing: stored?.session === session ? "" : location.pathname,
  };
  if (stored?.session === session) Object.assign(origin, { channel: stored.channel, campaign: stored.campaign || "", referrer: stored.referrer || "", query: stored.query || {} });
  writeVisitMemory(VISIT_CHANNEL_KEY, origin);
  return origin;
}

// This visit's distinct pages (the current one included) and which visit of
// this device it is, counted from when this tracker version first ran here;
// when the visit started, and how long since the device's previous visit
// (away, ms; null on a first visit).
function visitStats(path = location.pathname) {
  const session = analyticsSession.getId();
  let stats = readVisitMemory(VISIT_STATS_KEY);
  let changed = false;
  const now = Date.now();
  if (!stats || stats.session !== session || !Array.isArray(stats.pages)) {
    const away = stats?.last ? now - stats.last : null;
    stats = { session, visits: (Number(stats?.visits) || 0) + 1, pages: [], started: now, away };
    changed = true;
  }
  if (!stats.started) stats.started = now;
  // Last seen, at most once a minute, for the next visit's "away".
  if (!stats.last || now - stats.last > 60000) {
    stats.last = now;
    changed = true;
  }
  const page = (path.length > 1 ? path.replace(/\/+$/, "") : path).toLowerCase();
  if (!stats.pages.includes(page)) {
    stats.pages = [...stats.pages, page].slice(-VISIT_PAGES_MAX);
    changed = true;
  }
  if (changed) writeVisitMemory(VISIT_STATS_KEY, stats);
  return stats;
}

const markLead = () => writeVisitMemory(LEAD_KEY, Date.now());

// Events this device fired (name → { at, session }), and its answers to the
// site's surveys ("<survey>:<question>" → answer), for audience rules.
const EVENTS_SEEN_KEY = `analytics:events-seen:${siteid}`;
const ANSWERS_KEY = `analytics:answers:${siteid}`;
const EVENTS_SEEN_MAX = 60;
document.addEventListener("analytics-event", (e) => {
  const name = String(e.detail?.eventname || e.detail?.name || "").slice(0, 100);
  if (!name) return;
  const seen = readVisitMemory(EVENTS_SEEN_KEY) || {};
  delete seen[name];
  seen[name] = { at: Date.now(), session: analyticsSession.getId() };
  writeVisitMemory(EVENTS_SEEN_KEY, Object.fromEntries(Object.entries(seen).slice(-EVENTS_SEEN_MAX)));
});
function rememberAnswer(surveyId, questionId, answer) {
  const answers = readVisitMemory(ANSWERS_KEY) || {};
  answers[`${surveyId}:${questionId}`] = answer;
  writeVisitMemory(ANSWERS_KEY, Object.fromEntries(Object.entries(answers).slice(-50)));
}

// A `match` rule's value for this visitor, as analytics shows it (lower case).
function audienceValue(dim, origin) {
  if (dim === "language") return (navigator.languages?.[0] || navigator.language || "").toLowerCase();
  if (dim.startsWith("utm_")) return String(origin.query?.[dim] || "").toLowerCase();
  return String(visitorFacts[dim] || "").toLowerCase();
}
const matchesValue = (dim, actual, wanted) => {
  const w = String(wanted).toLowerCase();
  // "fr" also matches "fr-ca".
  return actual === w || (dim === "language" && !w.includes("-") && actual.split("-")[0] === w);
};
// A survey answer against a rule: equal (or, for several, picked), at most, at least.
function answerMatches(answer, { op, value }) {
  if (answer === undefined || answer === null || answer === "") return false;
  if (op === "lte" || op === "gte") {
    const [a, v] = [Number(answer), Number(value)];
    return Number.isFinite(a) && Number.isFinite(v) && (op === "lte" ? a <= v : a >= v);
  }
  return Array.isArray(answer) ? answer.map(String).includes(String(value)) : String(answer) === String(value);
}

// Who sees a test, edit or widget (backend audience.js); no audience = everyone.
function audienceMatches(audience, country, returning) {
  if (!audience) return true;
  const countries = audience.countries || [];
  if (countries.length) {
    const listed = countries.includes(country);
    if (audience.countries_mode === "exclude" ? listed : !listed) return false;
  }
  if ((audience.visitors === "new" && returning) || (audience.visitors === "returning" && !returning)) return false;
  const origin = visitOrigin();
  if (!audience3Matches(audience, origin)) return false;
  if (audience.sources?.length && !audience.sources.includes(origin.channel)) return false;
  if (audience.campaigns?.length && !audience.campaigns.includes(origin.campaign)) return false;
  if (audience.referrers?.length && !audience.referrers.some((r) => origin.referrer === r || origin.referrer.endsWith(`.${r}`))) return false;
  if (audience.landing?.length && !(origin.landing && pathMatches(origin.landing, audience.landing))) return false;
  // What the visitor has done.
  const lead = Boolean(readVisitMemory(LEAD_KEY));
  if ((audience.lead === "lead" && !lead) || (audience.lead === "not_lead" && lead)) return false;
  if (audience.intent === "high" || audience.intent === "low") {
    const lift = intentLift();
    if (lift === null || (audience.intent === "high" ? lift < HIGH_INTENT : lift > LOW_INTENT)) return false;
  }
  const needsVisit = audience.pages_min > 0 || audience.visits_min > 0 || audience.viewed?.length || audience.not_viewed?.length;
  if (!needsVisit) return true;
  const stats = visitStats();
  if (audience.pages_min > 0 && stats.pages.length < audience.pages_min) return false;
  if (audience.visits_min > 0 && stats.visits < audience.visits_min) return false;
  if (audience.viewed?.length && !stats.pages.some((page) => pathMatches(page, audience.viewed))) return false;
  return !(audience.not_viewed?.length && stats.pages.some((page) => pathMatches(page, audience.not_viewed)));
}

// The "audience-3" rules (backend audience.js): device, browser, OS, region,
// city, language and UTM values; URL parameters; identify() properties;
// events; survey answers; time on site; days away; weekday and hour.
function audience3Matches(audience, origin) {
  for (const rule of audience.match || []) {
    const actual = audienceValue(rule.dim, origin);
    const hit = rule.values.some((v) => matchesValue(rule.dim, actual, v));
    if (rule.exclude ? hit : !hit) return false;
  }
  if (audience.params?.length) {
    const here = Object.fromEntries([...new URLSearchParams(location.search)].map(([k, v]) => [k.toLowerCase(), v]));
    const query = { ...origin.query, ...here };
    if (!audience.params.every(({ key, value }) => {
      const actual = query[key.toLowerCase()];
      return actual !== undefined && (!value || actual.toLowerCase() === value.toLowerCase());
    })) return false;
  }
  if (audience.properties?.length) {
    const traits = readStored(TRAITS_KEY) || {};
    if (!audience.properties.every(({ key, op, value }) => {
      const actual = traits[key.toLowerCase()];
      const set = actual !== undefined && actual !== "";
      if (op === "set") return set;
      if (op === "not_set") return !set;
      const same = set && actual.toLowerCase() === String(value).toLowerCase();
      return op === "is" ? same : !same;
    })) return false;
  }
  if (audience.events?.length) {
    const seen = readVisitMemory(EVENTS_SEEN_KEY) || {};
    const session = analyticsSession.getId();
    if (!audience.events.every(({ name, did, when }) => {
      const hit = seen[name] && (when === "ever" || seen[name].session === session);
      return did ? Boolean(hit) : !hit;
    })) return false;
  }
  if (audience.answers?.length) {
    const answers = readVisitMemory(ANSWERS_KEY) || {};
    if (!audience.answers.every((rule) => answerMatches(answers[`${rule.survey_id}:${rule.question_id}`], rule))) return false;
  }
  if (audience.visit_seconds_min > 0 || audience.away_days_min > 0) {
    const stats = visitStats();
    if (audience.visit_seconds_min > 0 && (Date.now() - stats.started) / 1000 < audience.visit_seconds_min) return false;
    if (audience.away_days_min > 0 && !(stats.away >= audience.away_days_min * DAY_MS)) return false;
  }
  const now = new Date();
  if (audience.days?.length && !audience.days.includes((now.getDay() + 6) % 7)) return false;
  return !(audience.hours?.length && !audience.hours.includes(now.getHours()));
}

// How many times the average visitor's chance of converting this visitor has,
// by the site's model (the backend's propensity.js features, from what this
// device knows: where the visit came from, device, country, visits, and this
// visit's pages). null without a model.
function intentLift() {
  const model = siteIntent;
  if (!model?.base_rate) return null;
  const stats = visitStats();
  const width = window.innerWidth;
  const keys = [`channel:${visitOrigin().channel}`, `device:${width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop"}`];
  if ((model.countries || []).includes(visitorCountry)) keys.push(`country:${visitorCountry}`);
  const visits = Math.max(stats.visits, isReturningVisitor() ? 2 : 1);
  if (visits >= 2) keys.push("visits:2");
  if (visits >= 3) keys.push("visits:3");
  if (stats.pages.length >= 5) keys.push("pages:5");
  if (stats.pages.length >= 10) keys.push("pages:10");
  for (const page of stats.pages) keys.push(`page:${page}`);
  const z = model.intercept + keys.reduce((sum, key) => sum + (model.weights?.[key] || 0), 0);
  return 1 / (1 + Math.exp(-z)) / model.base_rate;
}
// "Likely" converters have at least twice the average chance, "unlikely" half or less.
const HIGH_INTENT = 2;
const LOW_INTENT = 0.5;

// A widget's audience, for this visitor (country from the site config).
const widgetAudienceMatches = (targeting) => !targeting?.audience
  || audienceMatches(targeting.audience, visitorCountry, isReturningVisitor());

function experimentVariant(test) {
  if (test.rollout) return test.variants[0] || null;
  if (readConsent() === false) return null;
  const stored = { ...experimentMemory, ...(readVisitMemory(EXPERIMENTS_KEY) || {}) };
  let id = stored[test.id];
  if (typeof id !== "string" || (id && !test.variants.some((v) => v.id === id))) {
    id = "";
    if (Math.random() * 100 < (Number(test.traffic) || 100)) {
      const total = test.variants.reduce((sum, v) => sum + (Number(v.weight) || 1), 0);
      let pick = Math.random() * total;
      id = (test.variants.find((v) => (pick -= Number(v.weight) || 1) < 0) || test.variants[0]).id;
    }
    experimentMemory[test.id] = stored[test.id] = id;
    writeVisitMemory(EXPERIMENTS_KEY, stored);
  }
  return test.variants.find((v) => v.id === id) || null;
}

// Elements a change never touches, whatever its selector (`#id`, `[data-x]`):
// a script's text or src, a consent-gated <script type="text/plain"> (which
// the consent loader turns into a live one), <base>, <link>, <meta> or a frame
// would run code or load it from elsewhere. Kept in step with BLOCKED_ELEMENTS
// in the backend's experiments.js. src only goes on media elements.
const CHANGE_BLOCKED = new Set(["script", "style", "template", "iframe", "frame", "frameset", "object", "embed", "link", "base", "meta", "noscript"]);
const SRC_ELEMENTS = new Set(["img", "source", "video", "audio", "track"]);
const changeable = (el, change) => !CHANGE_BLOCKED.has(el.localName)
  && !(change.action === "attr" && (change.attr === "src" || change.attr === "srcset") && !SRC_ELEMENTS.has(el.localName));

// Applies one change wherever its element is; false while it isn't on the page.
// Elements already changed are left alone, so running it again changes nothing.
function applyExperimentChange(change) {
  const elements = queryAllSafe(change.selector).filter((el) => changeable(el, change));
  if (!elements.length) return false;
  if (change.action === "move") {
    const el = elements[0];
    const target = queryAllSafe(change.target || "")[0];
    if (!target) return false;
    if (target === el || el.contains(target)) return true;
    const before = change.position === "before";
    if ((before ? el.nextElementSibling : el.previousElementSibling) !== target) {
      target.insertAdjacentElement(before ? "beforebegin" : "afterend", el);
    }
    return true;
  }
  for (const el of elements) {
    if (change.action === "text") {
      if (el.textContent !== change.value) el.textContent = change.value;
    } else if (change.action === "html") {
      if (el.innerHTML !== safeHtmlString(change.value)) el.replaceChildren(safeHtmlFragment(change.value));
    } else if (change.action === "attr") {
      if (el.getAttribute(change.attr) !== change.value) el.setAttribute(change.attr, change.value);
    } else if (change.action === "classes") {
      // "+new -old": only these classes, so the site's own (open, active) stay.
      for (const token of String(change.value || "").split(/\s+/)) {
        const name = token.slice(1);
        if (!name) continue;
        try {
          if (token[0] === "+" && !el.classList.contains(name)) el.classList.add(name);
          else if (token[0] === "-" && el.classList.contains(name)) el.classList.remove(name);
        } catch { /* not a valid class name */ }
      }
    } else if (change.action === "hide") {
      if (el.style.getPropertyValue("display") !== "none") el.style.setProperty("display", "none", "important");
    } else if (change.action === "style") {
      if (!experimentStyles.has(el)) experimentStyles.set(el, new Map());
      const done = experimentStyles.get(el);
      for (const declaration of String(change.value || "").split(";")) {
        const at = declaration.indexOf(":");
        if (at < 1) continue;
        const property = declaration.slice(0, at).trim().toLowerCase();
        if (done.has(property) && el.style.getPropertyValue(property) === done.get(property)) continue;
        el.style.setProperty(property, declaration.slice(at + 1).replace(/!important/i, "").trim(), "important");
        done.set(property, el.style.getPropertyValue(property));
      }
    }
  }
  return true;
}

// What widget tests (A/B tests between the site's own lead forms or notices)
// leave for this visitor: { hidden: ids not to show, swap: Map(original id ->
// the visitor's version), for inline form spots, extra: a previewed test's
// forms or notices, which the site's config lacks before the test starts }. On a test's pages the
// visitor's variant decides (scheduleExperiments reports the exposure);
// elsewhere, and for visitors outside the test, the original shows. A kept
// winner shows to everyone; a preview link shows its variant.
async function widgetPicks(type, config, path) {
  const hidden = new Set();
  const swap = new Map();
  const preview = await experimentPreview().catch(() => null);
  const tests = (config?.experiments || []).filter((t) => t.id !== preview?.test.id);
  if (preview?.test.widget) tests.push(preview.test);
  const ofType = tests.filter((t) => t.widget?.type === type && t.widget.ids?.length);
  const extra = preview?.test.widget?.type === type ? preview.test.widget.docs || [] : [];
  if (!ofType.length) return { hidden, swap, extra };
  const returning = isReturningVisitor();
  for (const test of ofType) {
    let pick = test.widget.ids[0];
    if (test === preview?.test) {
      pick = test.variants.find((v) => v.id === preview.variant)?.widget_id || pick;
    } else if (test.rollout) {
      pick = test.variants[0]?.widget_id || pick;
    } else if (placeMatches({ pages: test.pages, device: test.device }, path) && audienceMatches(test.audience, config.country || "", returning)) {
      pick = experimentVariant(test)?.widget_id || pick;
    }
    for (const id of test.widget.ids) if (id !== pick) hidden.add(id);
    swap.set(test.widget.ids[0], pick);
  }
  return { hidden, swap, extra };
}

// Which of a live edit's changes were on this page; once per visit, page and edit.
function sendEditHealth(entry, path) {
  if (entry.sent) return;
  entry.sent = true;
  const session = analyticsSession.getId() || "";
  let seen = readStored(EDIT_HEALTH_KEY);
  if (seen?.session !== session || !Array.isArray(seen.sent)) seen = { session, sent: [] };
  const key = `${entry.test.id} ${path}`;
  if (seen.sent.includes(key)) return;
  seen.sent = [...seen.sent, key].slice(-100);
  writeStored(EDIT_HEALTH_KEY, seen);
  const all = entry.variant.changes.map((_, i) => i);
  fetch(new URL("experiments/health", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify({ siteid, edit_id: entry.test.id, found: [...entry.found], missed: all.filter((i) => !entry.found.has(i)) }),
  }).catch(() => {});
}

// A test or edit that changes the page only once its trigger fires (after a
// delay or a scroll, on exit intent or an event; see watchTrigger).
const waitsForTrigger = (test) => Boolean(test.trigger) && test.trigger.type !== "load";

function sendExposure(test, variant, path, missed) {
  const session = analyticsSession.getId();
  if (!session) return;
  const seen = readVisitMemory(EXPERIMENTS_SEEN_KEY) || {};
  if (seen[test.id] === session) return;
  seen[test.id] = session;
  writeVisitMemory(EXPERIMENTS_SEEN_KEY, seen);
  fetch(new URL("experiments/exposure", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify({
      siteid, experiment_id: test.id, variant_id: variant.id, session_id: session,
      url: path, viewport_width: window.innerWidth, missed,
    }),
  }).catch(() => {});
}

async function scheduleExperiments(path) {
  if (path === experimentPath) return;
  experimentPath = path;
  experimentCleanup?.();
  experimentCleanup = null;
  if (!siteid) return revealExperimentPage();
  const pick = await eventPickLink().catch(() => null);
  if (pick) {
    revealExperimentPage();
    if (eventPicker) return eventPicker.pageChanged();
    const { startPicker } = await loadModule("picker.js");
    eventPicker = startPicker({ token: pick.token, dashboardOrigin: pick.data.dashboard_origin, onExit: leaveEventPicker });
    return;
  }
  const edit = await experimentEditLink().catch(() => null);
  if (edit) {
    revealExperimentPage();
    if (experimentEditor) return experimentEditor.pageChanged();
    const { startEditor } = await loadModule("editor.js");
    experimentEditor = startEditor({
      token: edit.token, variant: edit.variant, dashboardOrigin: edit.data.dashboard_origin,
      experiment: edit.data.experiment, onExit: leaveExperimentEditor,
      // From a heatmap's "Fix": the element to start with selected.
      focus: new URLSearchParams(location.search).get("ab_focus") || "",
    });
    return;
  }
  const [config, preview] = await Promise.all([
    loadSiteConfig().catch(() => null),
    experimentPreview().catch(() => null),
  ]);
  setupElementEvents(config?.clicks || []);
  // All of them: the next page may be tracked, and this list is for it.
  rememberExperimentHide(config?.experiments || []);
  const tracked = pageTracked(path);
  // A site edit still applies, but like a kept winner it isn't reported.
  const tests = (config?.experiments || []).filter((test) => tracked || test.edit).map((test) => (tracked ? test : { ...test, rollout: true }));
  if (experimentPath !== path) return;
  // Every page, so a device is known before any test aimed at returning visitors
  // starts, and the visit's landing page before any aimed at one.
  const returning = isReturningVisitor();
  visitOrigin();
  const running = [];
  for (const test of tests) {
    if (!test.variants?.length || !placeMatches({ pages: test.pages, device: test.device }, path)) continue;
    if (preview?.test.id === test.id) continue;
    // Site edits (test.edit) can be for some visitors only, also when they show to all of them.
    if ((!test.rollout || test.edit) && !audienceMatches(test.audience, config.country || "", returning)) continue;
    // A test or edit that would send visitors off the site, or load CSS from
    // another one, runs for nobody, so its results never count a visit to a
    // page that wasn't shown (sameSiteTarget, cssOnSite).
    if (test.variants.some((v) => (v.redirect_url && !sameSiteTarget(v.redirect_url)) || !variantCssOnSite(v))) continue;
    const variant = experimentVariant(test);
    if (variant) running.push({ test, variant });
    // A measured edit still shows to visitors who declined consent, just not counted.
    else if (test.edit) running.push({ test: { ...test, rollout: true }, variant: test.variants.find((v) => v.id === "edit") });
  }
  // The previewed variant on the test's pages, on any device, never reported.
  const previewVariant = preview?.test.variants.find((v) => v.id === preview.variant);
  const previewHere = Boolean(previewVariant) && variantCssOnSite(previewVariant) && placeMatches({ pages: preview.test.pages, device: "all" }, path);
  if (previewHere) running.push({ test: { ...preview.test, rollout: true }, variant: previewVariant });
  showPreviewBadge(preview, previewHere);

  // Split URL tests: the visit goes on at the variant's address, with this page's query.
  for (const { test, variant } of running) {
    const href = sameSiteTarget(variant.redirect_url);
    if (!href) continue;
    const target = new URL(href);
    if (target.origin === location.origin && target.pathname === location.pathname) continue;
    if (!target.search) target.search = location.search;
    if (!target.hash) target.hash = location.hash;
    if (!test.rollout) sendExposure(test, variant, path, 0);
    location.replace(target.href);
    return;
  }

  // Tests and edits with a trigger start when it fires; the others now. A
  // triggered test reports every variant's exposure only then, so visits that
  // left before it are in none of them.
  const triggered = running.filter(({ test }) => waitsForTrigger(test));
  const active = [];
  const styles = [];
  // Every variant waits for the same elements (those any variant changes), so
  // the original's visits are counted on the same pages as the others'.
  const waiting = [];
  // Live edits shown here, to report which of their changes the page has.
  const health = [];
  const report = (entry) => {
    if (entry.sent) return;
    entry.sent = true;
    sendExposure(entry.test, entry.variant, path, entry.needed.size - entry.found.size);
  };
  const reportAll = () => {
    waiting.forEach(report);
    health.forEach((entry) => sendEditHealth(entry, path));
  };
  const start = (entries) => {
    for (const { test, variant } of entries) {
      active.push({ test, variant });
      if (variant.css) {
        const style = document.createElement("style");
        style.setAttribute("data-analytics-experiment", test.id);
        style.textContent = variant.css;
        document.head.appendChild(style);
        styles.push(style);
      }
      if (!test.rollout) {
        waiting.push({
          test,
          variant,
          needed: new Set(test.variants.flatMap((v) => (v.changes || []).flatMap((c) => (c.action === "move" ? [c.selector, c.target] : [c.selector])))),
          found: new Set(),
          sent: false,
        });
      }
      if (test.edit && variant.id === "edit" && variant.changes?.length) health.push({ test, variant, found: new Set(), sent: false });
    }
  };
  const pass = () => {
    for (const { variant } of active) for (const change of variant.changes || []) applyExperimentChange(change);
    for (const entry of health) {
      if (entry.sent) continue;
      entry.variant.changes.forEach((c, i) => {
        if (!entry.found.has(i) && queryAllSafe(c.selector).length && (c.action !== "move" || queryAllSafe(c.target || "").length)) entry.found.add(i);
      });
      if (entry.found.size === entry.variant.changes.length) sendEditHealth(entry, path);
    }
    for (const entry of waiting) {
      if (entry.sent) continue;
      for (const selector of entry.needed) {
        if (!entry.found.has(selector) && queryAllSafe(selector).length) entry.found.add(selector);
      }
      if (entry.found.size === entry.needed.size) report(entry);
    }
    if (waiting.every((entry) => entry.sent)) revealExperimentPage();
  };

  let frame = 0;
  let observing = false;
  const observer = new MutationObserver(() => {
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      pass();
    });
  });
  const observe = () => {
    if (observing || !active.some(({ variant }) => variant.changes?.length)) return;
    observing = true;
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: EXPERIMENT_WATCHED_ATTRS,
    });
  };

  start(running.filter((entry) => !triggered.includes(entry)));
  pass();
  observe();
  // Each trigger fires once per page view; what the page lacks then is reported as missing.
  const stopTriggers = triggered.map((entry) => {
    let fired = false;
    const stop = watchTrigger(entry.test.trigger, () => {
      if (fired || experimentPath !== path) return;
      fired = true;
      const from = waiting.length;
      const fromHealth = health.length;
      start([entry]);
      pass();
      observe();
      waiting.slice(from).forEach(report);
      health.slice(fromHealth).forEach((h) => sendEditHealth(h, path));
    });
    return stop;
  });
  const timer = setTimeout(() => {
    reportAll();
    revealExperimentPage();
  }, EXPERIMENT_WAIT_MS);
  window.addEventListener("pagehide", reportAll);
  experimentCleanup = () => {
    stopTriggers.forEach((stop) => stop());
    observer.disconnect();
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    window.removeEventListener("pagehide", reportAll);
    reportAll();
    styles.forEach((style) => style.remove());
  };
}

//. FORM CAPTURE --------------------------------------------------
// The site's own forms as leads, for sites with no form backend (static
// sites): <form data-analytics-capture="Contact"> (the name groups them in
// the dashboard; optional data-analytics-tags="quote, web"). Needs form
// capture on in the dashboard's lead settings.
// A form with an action keeps working as before and a copy is sent. A form
// without one is handled here: the page doesn't reload, and the form is
// replaced by data-analytics-capture-thanks (or the visitor goes to
// data-analytics-capture-redirect). If the site's code already handled the
// submit (React and the like), only the copy is sent and the page is left alone.
// Passwords, card and bank details, files, hidden fields and anything marked
// data-analytics-ignore are never sent.
// With "capture all forms" on in the dashboard, unmarked forms are captured
// too (named like form analytics names them), except login, search and
// payment forms and forms inside data-analytics-ignore.
const CAPTURE_SKIP_TYPES = new Set(["password", "file", "hidden", "submit", "button", "reset", "image"]);
const CAPTURE_SKIP_NAMES = /pass|card|cc-|cvv|cvc|iban|ssn|token|captcha|csrf|secret/i;
// One-time codes, PINs and keys, matched as whole words of the name, id and
// autocomplete (otpCode, otp_code and one-time-code all count), so "postcode",
// "shipping" and "keywords" are still captured.
const CAPTURE_SECRET_WORDS = /(^| )(otp|totp|hotp|mfa|2fa|pin|one time code|(recovery|backup|verification|security|auth|sms|2fa|mfa) codes?|(api|private|access|secret|license|licence) key)( |$)/;
const captureWords = (el) => `${el.name || ""} ${el.id || ""} ${el.autocomplete || ""}`
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const isSecretField = (el) => CAPTURE_SKIP_NAMES.test(`${el.name} ${el.id} ${el.autocomplete || ""}`)
  || CAPTURE_SECRET_WORDS.test(captureWords(el));

function captureLabel(el) {
  const text = (value) => (value || "").replace(/\s+/g, " ").replace(/\s*\*$/, "").trim();
  return text(el.labels?.[0]?.textContent) || text(el.getAttribute("aria-label")) || text(el.placeholder) || text(el.name);
}

// Known once the site config loads (it loads on every page).
let captureAllForms = false;
loadSiteConfig().then((config) => {
  captureAllForms = config?.capture_all === true;
  copySettings = config?.copies || null;
  applyProtection();
}).catch(() => {});

function autoCaptured(form) {
  if (form.closest("[data-analytics-ignore],[data-noanalytics]") || form.getAttribute("role") === "search") return false;
  if (form.querySelector("input[type=password],input[type=search],[autocomplete^=cc-],[autocomplete*=' cc-']")) return false;
  const inputs = [...form.elements].filter((el) => el.tagName !== "BUTTON" && !CAPTURE_SKIP_TYPES.has((el.type || "").toLowerCase()));
  // A one-time code or a key makes it a sign-in or account form, like a password does.
  if (inputs.some((el) => CAPTURE_SECRET_WORDS.test(captureWords(el)))) return false;
  // A lone q/s/search box is a site search without the markup.
  if (inputs.length === 1 && /^(q|s|search|query|keywords?)$/i.test(inputs[0].name || inputs[0].id)) return false;
  return capturedFields(form).length > 0;
}

function capturedFields(form) {
  const fields = [];
  for (const el of form.elements) {
    const type = (el.type || "").toLowerCase();
    if (el.disabled || CAPTURE_SKIP_TYPES.has(type) || el.closest("[data-analytics-ignore]")) continue;
    if (isSecretField(el)) continue;
    let value;
    if (type === "checkbox") {
      if (!el.checked) continue;
      value = el.value && el.value !== "on" ? el.value : true;
    } else if (type === "radio") {
      if (!el.checked) continue;
      value = el.value;
    } else if (el.tagName === "SELECT" && el.multiple) {
      value = [...el.selectedOptions].map((o) => o.value).join(", ");
    } else {
      value = el.value;
    }
    if (value === "" || value === undefined) continue;
    // Radios and checkboxes are labelled by their group (fieldset legend or name).
    const group = type === "radio" || type === "checkbox";
    const label = group ? (el.closest("fieldset")?.querySelector("legend")?.textContent?.trim() || el.name || captureLabel(el)) : captureLabel(el);
    // Fields with no name, label or placeholder can't be told apart.
    if (!label) continue;
    fields.push({ label: label.slice(0, 200), name: el.name || el.id || "", type, value: typeof value === "string" ? value.slice(0, 2000) : value });
  }
  return fields;
}

document.addEventListener("submit", (e) => {
  const form = e.target;
  if (!(e.isTrusted || shieldResubmits.has(form)) || !(form instanceof HTMLFormElement) || !siteid) return;
  const marked = form.hasAttribute("data-analytics-capture");
  if (!marked && !(captureAllForms && pageTracked(location.pathname) && autoCaptured(form))) return;
  const action = form.getAttribute("action");
  const handleHere = !e.defaultPrevented && (!action || action === "#");
  if (handleHere) e.preventDefault();
  // Named like form analytics names it, so the Forms page lines them up.
  const name = autoText(form.getAttribute("data-analytics-capture") || form.getAttribute("data-analytics-form")) || formLabel(form) || "Website form";
  const body = {
    siteid, form: name, fields: capturedFields(form),
    tags: (form.getAttribute("data-analytics-tags") || "").split(",").map((t) => t.trim()).filter(Boolean),
    elapsed_ms: Math.round(performance.now()),
    shield: form.elements["analytics-shield"]?.value || "",
    session_id: readConsent() === false ? "" : analyticsSession.getId(),
    url: lastTrackedPath || location.pathname, viewport_width: window.innerWidth,
    // As on our own forms: what lets this be sent again safely, because the
    // collector keeps the first arrival of an id and acknowledges the rest.
    submission_id: randomId(),
  };
  const sending = fetch(leadUrl(LEAD_CAPTURE_PATH), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) })).catch(() => ({ status: 0 }))
    .then((reply) => {
      // A collector that is unreachable or broken is our fault, not the
      // visitor's. When this form posts nowhere else, we are the only one
      // being told about the enquiry, so the answer is kept and sent again
      // rather than lost; when the form has its own action the site's server
      // has it too, and keeping ours only saves the record of it. Either way
      // the form ends as though it had been sent. A 4xx comes back as itself.
      if (reply.status !== 0 && reply.status < 500) return reply;
      if (!body.submission_id) return reply;
      queueLead(body, LEAD_CAPTURE_PATH);
      return { status: 202, message: "Accepted" };
    });
  sending.then(({ status }) => {
    if (status >= 200 && status < 300) {
      markLead();
      window.analytics.track("lead", { label: name });
    }
  });
  if (!handleHere) return;
  const button = form.querySelector("[type=submit]");
  if (button) button.disabled = true;
  sending.then(({ status, message }) => {
    if (button) button.disabled = false;
    if (status >= 200 && status < 300) {
      const redirect = captureRedirect(form.getAttribute("data-analytics-capture-redirect"));
      if (redirect) return location.assign(redirect);
      const thanks = document.createElement("p");
      thanks.setAttribute("role", "status");
      thanks.className = "analytics-capture-thanks";
      thanks.textContent = form.getAttribute("data-analytics-capture-thanks") || "Thanks! Your message was sent.";
      form.replaceWith(thanks);
      return;
    }
    let note = form.querySelector(".analytics-capture-error");
    if (!note) {
      note = document.createElement("p");
      note.setAttribute("role", "alert");
      note.className = "analytics-capture-error";
      form.append(note);
    }
    note.textContent = status === 429 ? "Too many attempts, please try again later." : message || "Sorry, your message couldn't be sent. Please try again.";
  });
});

//. SPAM PROTECTION ----------------------------------------------
// Sites that turn it on (Forms page); shield.js does the work. Protected
// forms: lead forms, captured forms, forms marked data-analytics-shield, and
// every other form (but searches) with "all forms" on. A submit waits for
// the answer (usually ready long before), and in checkbox mode for the box.
// The answer is in the form's hidden "analytics-shield" field for the site's
// server to verify; JavaScript that posts its own data can get one with
// await window.analytics.shield().
let shieldLoad = null;
let shieldNow = null;
// Forms sent again by the tracker once their answer was ready. That submit is
// untrusted (requestSubmit), so the submit listeners accept these as well:
// the visitor's own submit was stopped before it reached them.
const shieldResubmits = new WeakSet();
const shieldPassing = new WeakSet();

function pageShield() {
  shieldLoad ||= loadSiteConfig().then(async (config) => {
    if (!config?.shield || !siteid) return null;
    const { createShield } = await loadModule("shield.js");
    shieldNow = createShield({
      mode: config.shield.mode,
      fetchChallenge: () => fetch(new URL("shield/challenge", COLLECT_URL), {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        credentials: "omit",
        body: JSON.stringify({ siteid }),
      }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("challenge")))),
      session: () => (readConsent() === false ? "" : analyticsSession.getId()),
    });
    shieldNow.all = config.shield.all === true;
    return shieldNow;
  }).catch(() => null);
  return shieldLoad;
}

function shieldedForm(form) {
  if (form.closest("[data-noanalytics]")) return false;
  if (form.hasAttribute("data-analytics-shield") || form.hasAttribute("data-analytics-capture")) return true;
  if (captureAllForms && pageTracked(location.pathname) && autoCaptured(form)) return true;
  if (!shieldNow?.all || form.getAttribute("role") === "search") return false;
  const inputs = [...form.elements].filter((el) => el.tagName !== "BUTTON" && !CAPTURE_SKIP_TYPES.has((el.type || "").toLowerCase()));
  return !(inputs.length && inputs.every((el) => el.type === "search" || /^(q|s|search|query|keywords?)$/i.test(el.name || el.id)));
}

function protectForms() {
  for (const form of document.forms) if (shieldedForm(form)) shieldNow.protect(form);
}

pageShield().then((shield) => {
  if (!shield) return;
  // Boxes go in now, so the page doesn't shift later; forms added later get
  // theirs when first used.
  protectForms();
  // The check starts on the first interaction, and only on pages with a
  // protected form: other pages cost no request or work. Forms rendered
  // later start it when first used; analytics.shield() starts it itself.
  const begin = () => {
    protectForms();
    if ([...document.forms].some(shieldedForm)) shield.start();
  };
  for (const type of ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "focusin"]) {
    window.addEventListener(type, begin, { capture: true, passive: true, once: true });
  }
  document.addEventListener("focusin", (e) => {
    const form = e.target?.form || e.target?.closest?.("form");
    if (!form || !shieldedForm(form)) return;
    shield.protect(form);
    shield.start();
  }, true);
});

// Before the site's own handlers, so a blocked submit never reaches them.
window.addEventListener("submit", (e) => {
  const form = e.target;
  if (!shieldNow || !(form instanceof HTMLFormElement) || !shieldedForm(form)) return;
  if (shieldPassing.has(form)) {
    shieldPassing.delete(form);
    return;
  }
  shieldNow.protect(form);
  const field = form.elements["analytics-shield"];
  const hold = () => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  if (!shieldNow.ticked(form)) {
    hold();
    shieldNow.nudge(form);
    return;
  }
  // Ready, and not sooner than the server allows.
  const ready = shieldNow.readyIn() === 0 && shieldNow.answerNow();
  if (ready) {
    if (field) field.value = shieldNow.consume();
    return;
  }
  hold();
  const submitter = e.submitter;
  shieldNow.take().then((answer) => {
    // Sent even without an answer (collector unreachable): the form keeps working.
    if (!form.isConnected) return;
    if (field) field.value = answer;
    shieldResubmits.add(form);
    shieldPassing.add(form);
    // The submit event fires inside requestSubmit; if the browser's own
    // validation stops it, the next submit must not slip through.
    const button = submitter && submitter.form === form ? submitter : null;
    // Safari before 16 has no requestSubmit: clicking the button does the same.
    if (form.requestSubmit) form.requestSubmit(button || undefined);
    else if (button) button.click();
    else form.submit();
    shieldPassing.delete(form);
  });
}, true);

window.analytics.shield = () => pageShield().then((shield) => (shield ? shield.take() : "")).catch(() => "");

// Security reports for the Security page, sent without visitor or session.
function sendSecurity(payload) {
  if (!siteid || navigator.webdriver) return;
  const body = JSON.stringify({ ...payload, siteid, domain: domain || "", url: location.pathname });
  if (beacon(COLLECT_URL, body)) return;
  fetch(COLLECT_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, credentials: "omit", body, keepalive: true }).catch(() => {});
}

// The site calls this when a login fails; bursts from one address show up
// on the Security page as attacks.
window.analytics.loginFailed = () => sendSecurity({ type: "login_failed" });

// Page tampering: a form whose destination is changed, while the page is
// open, to another site (what card skimmers do). New script hosts are found
// from the Scripts report's data instead. Each host once per browser session.
const CHANGES_KEY = "analytics_form_changes";
const formHost = (action) => {
  try {
    return new URL(action || location.href, location.href).hostname;
  } catch {
    return "";
  }
};
let formChangesSent = 0;
function reportFormChange(host) {
  const own = location.hostname.replace(/^www\./, "");
  if (!host || host === own || host.endsWith(`.${own}`) || ownHosts.has(host) || formChangesSent >= 5) return;
  let seen = [];
  try {
    seen = JSON.parse(tabStore().getItem(CHANGES_KEY) || "[]");
  } catch { /* optional storage */ }
  if (seen.includes(host)) return;
  formChangesSent++;
  try {
    tabStore().setItem(CHANGES_KEY, JSON.stringify([...seen, host].slice(-50)));
  } catch { /* optional storage */ }
  sendSecurity({ type: "integrity", change_kind: "form_action", change_host: host });
}
if (siteid && !navigator.webdriver && typeof MutationObserver === "function") {
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.target instanceof HTMLFormElement && formHost(record.oldValue) !== formHost(record.target.getAttribute("action"))) {
        reportFormChange(formHost(record.target.getAttribute("action")));
      }
    }
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["action"], attributeOldValue: true });
}

let maxScrollDepth = 0;

// Engaged time: how long the current page was visible, sent when it is hidden,
// left or replaced by an SPA route, with the deepest scroll on that page. Each
// beacon carries only the time since the previous one; reports sum them.
let engagedMs = 0;
let visibleSince = document.visibilityState === "visible" ? Date.now() : null;

const measureScroll = () => {
  const { y, view, height } = pageScroll();
  if (!height) return;
  const depth = Math.min(100, Math.round(((y + view) / height) * 100));
  if (depth > maxScrollDepth) {
    maxScrollDepth = depth;
    perfMetrics.scroll_depth = maxScrollDepth;
  }
};

// Attention: how long each 2% band of the page (by height) was on screen,
// for the heatmap's engagement view. Time counts while the page is visible,
// up to 30 s after the last scroll, key, touch or mouse movement, so a tab
// left open does not heat the band it stopped on. Sent with the engagement
// beacon; follows the site's heatmap switch.
const ATTENTION_BANDS = 50;
const ATTENTION_IDLE_MS = 30000;
let attention = new Array(ATTENTION_BANDS).fill(0);
let attentionAt = null;
let attentionBands = null;
let lastActivity = Date.now();

// Credits the time since the last call to the bands that were on screen,
// then notes what is on screen now.
function creditAttention() {
  const now = Date.now();
  if (attentionAt !== null && attentionBands) {
    const ms = Math.min(now, lastActivity + ATTENTION_IDLE_MS) - attentionAt;
    if (ms > 0) for (let i = attentionBands[0]; i < attentionBands[1]; i++) attention[i] += ms;
  }
  attentionAt = document.visibilityState === "visible" && !heatmapsOff ? now : null;
  const { y, view, height } = pageScroll();
  attentionBands = height ? [
    Math.max(0, Math.floor((y / height) * ATTENTION_BANDS)),
    Math.min(ATTENTION_BANDS, Math.ceil(((y + view) / height) * ATTENTION_BANDS)),
  ] : null;
}

const noteActivity = () => {
  // Back from idle: close the idle stretch before it counts again.
  if (Date.now() - lastActivity > ATTENTION_IDLE_MS) creditAttention();
  lastActivity = Date.now();
};
for (const type of ["mousemove", "keydown", "touchstart", "click"]) {
  document.addEventListener(type, noteActivity, { passive: true, capture: true });
}

// Bot signs for the Security page, sent with engaged time: real mouse,
// touch, key and wheel use on this page (mouse moves counted at most every
// 250 ms), and clicks or key presses a script made up (not isTrusted).
let pageInputs = 0;
let pageSynthetic = 0;
let lastMoveAt = -Infinity;
const countInput = (e) => {
  if (!e.isTrusted) {
    if (e.type === "click" || e.type === "keydown") pageSynthetic++;
    return;
  }
  if (e.type === "mousemove") {
    if (e.timeStamp - lastMoveAt < 250) return;
    lastMoveAt = e.timeStamp;
  }
  pageInputs++;
};
for (const type of ["mousemove", "keydown", "touchstart", "click", "wheel"]) {
  document.addEventListener(type, countInput, { passive: true, capture: true });
}

// Signs of a real person on this page, sent with engaged time (`human`, bits
// below). They only ever lower a visit's risk score: having none (screen
// readers, keyboard or voice control, a quick read) costs nothing.
const HUMAN_MOUSE = 1; // a mouse path that curves and wobbles (scripts move straight or jump)
const HUMAN_KEYS = 2; // uneven gaps between key presses
const HUMAN_SCROLL = 4; // wheel or swipe scrolling at uneven pace
const HUMAN_TOUCH = 8; // taps in different places at uneven times
let pageHuman = 0;
// Spread of a list of numbers against their average (0 = all the same).
const unevenness = (values) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (!mean) return 0;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) / mean;
};
// Gaps between the last few times of one kind of input.
const gapsOf = () => {
  const times = [];
  return (t) => {
    times.push(t);
    if (times.length > 12) times.shift();
    return times.slice(1).map((time, i) => time - times[i]);
  };
};
let mouseLast = null;
let mouseAngle = null;
let mouseCurves = 0;
document.addEventListener("mousemove", (e) => {
  if (!e.isTrusted || pageHuman & HUMAN_MOUSE) return;
  const point = [e.clientX, e.clientY];
  if (mouseLast) {
    const dx = point[0] - mouseLast[0];
    const dy = point[1] - mouseLast[1];
    if (Math.abs(dx) + Math.abs(dy) < 3) return;
    const angle = Math.atan2(dy, dx);
    if (mouseAngle !== null) {
      const turn = Math.abs(Math.atan2(Math.sin(angle - mouseAngle), Math.cos(angle - mouseAngle)));
      // A small, changing turn: a hand drawing a curve, not a line or a jump.
      if (turn > 0.03 && turn < 1.2 && ++mouseCurves >= 8) pageHuman |= HUMAN_MOUSE;
    }
    mouseAngle = angle;
  }
  mouseLast = point;
}, { passive: true, capture: true });
const keyGaps = gapsOf();
document.addEventListener("keydown", (e) => {
  if (!e.isTrusted || e.repeat || pageHuman & HUMAN_KEYS) return;
  const gaps = keyGaps(e.timeStamp).filter((gap) => gap < 2000);
  if (gaps.length >= 5 && unevenness(gaps) > 0.3) pageHuman |= HUMAN_KEYS;
}, { passive: true, capture: true });
const wheelGaps = gapsOf();
const swipeGaps = gapsOf();
const scrolled = (e, gapsFor) => {
  if (!e.isTrusted || pageHuman & HUMAN_SCROLL) return;
  const gaps = gapsFor(e.timeStamp).filter((gap) => gap < 1000);
  if (gaps.length >= 6 && unevenness(gaps) > 0.25) pageHuman |= HUMAN_SCROLL;
};
document.addEventListener("wheel", (e) => scrolled(e, wheelGaps), { passive: true, capture: true });
document.addEventListener("touchmove", (e) => scrolled(e, swipeGaps), { passive: true, capture: true });
const tapGaps = gapsOf();
const tapSpots = new Set();
document.addEventListener("touchstart", (e) => {
  if (!e.isTrusted || pageHuman & HUMAN_TOUCH || !e.touches?.[0]) return;
  tapSpots.add(`${Math.round(e.touches[0].clientX / 20)}:${Math.round(e.touches[0].clientY / 20)}`);
  const gaps = tapGaps(e.timeStamp);
  if (tapSpots.size >= 3 && gaps.length >= 2 && unevenness(gaps) > 0.25) pageHuman |= HUMAN_TOUCH;
}, { passive: true, capture: true });
scrollWatchers.add(() => {
  if (scrollMoved) measureScroll();
  creditAttention();
  lastActivity = Date.now();
});
for (const type of ["scroll", "resize"]) {
  window.addEventListener(type, queueScrollFrame, { passive: true });
}
// Images and fonts change the page height after the first measure.
window.addEventListener("load", creditAttention);
creditAttention();

const pauseEngagement = () => {
  if (visibleSince !== null) {
    engagedMs += Date.now() - visibleSince;
    visibleSince = null;
  }
};

function sendEngagement() {
  if (focusedField) leaveField();
  // A failed send still waiting to settle goes now, while the page can send it.
  if (formSend?.failure) settleFormSend(formSend);
  sendHeatmapClicks();
  flushErrors();
  pauseEngagement();
  creditAttention();
  if (!data || !hasTrackedInitial || engagedMs <= 0) return;
  // Only page fields: drop click-event fields a previous custom event left on data.
  const { eventname, label, value, variant, eventid, metrics, ...page } = data;
  sendanalytics({
    ...page,
    url: lastTrackedPath || page.url,
    engaged_ms: Math.min(engagedMs, 30 * 60 * 1000),
    scroll_depth: maxScrollDepth,
    inputs: Math.min(pageInputs, 65535),
    synthetic: Math.min(pageSynthetic, 65535),
    human: pageHuman,
    ...(!heatmapsOff && attention.some(Boolean)
      ? { attention: attention.map((ms) => Math.min(ms, 30 * 60 * 1000)) }
      : {}),
  }, "engagement");
  engagedMs = 0;
  pageInputs = 0;
  pageSynthetic = 0;
  pageHuman = 0;
  attention.fill(0);
}

function resetEngagement() {
  heatmapPageClicks = 0;
  errorPageCount = 0;
  errorSeen.clear();
  autoPageEvents = 0;
  autoSeen.clear();
  formPageEvents = 0;
  copyPageEvents = 0;
  formStates = new WeakMap();
  focusedField = null;
  engagedMs = 0;
  pageInputs = 0;
  pageSynthetic = 0;
  pageHuman = 0;
  maxScrollDepth = 0;
  visibleSince = document.visibilityState === "visible" ? Date.now() : null;
  measureScroll();
  attention.fill(0);
  attentionAt = null;
  creditAttention();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") sendEngagement();
  else {
    if (visibleSince === null) visibleSince = Date.now();
    lastActivity = Date.now();
    creditAttention();
  }
});
window.addEventListener("pagehide", sendEngagement);

if (enablePerfMetrics) {
}

// Store for future use on SPA route changes
window._trackingConfig = { domain, siteid };
track();

//.... THE MAIN FUNCTION ----------------------------------------
async function track() {
  //some checks make sure browser
  if (!navigator || !window || !document) {
    return; // likely not a browser
  }
  if (navigator.webdriver) {
    // Counted on the site's Security page; nothing else is sent.
    if (siteid) {
      const payload = JSON.stringify({ type: "automated", siteid, domain: domain || "", url: location.pathname });
      if (!beacon(COLLECT_URL, payload)) {
        fetch(COLLECT_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, credentials: "omit", body: payload, keepalive: true }).catch(() => {});
      }
    }
    return;
  }
  const width = window.screen.width;
  const height = window.screen.height;

  const dpr = window.devicePixelRatio || 1;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const touchPoints = navigator.maxTouchPoints || 0;
  const hasTouch = "ontouchstart" in window || touchPoints > 0;
  const pointer = touchPoints > 0 ? "coarse" : "fine";

  if (!width || !height) {
    return; // suspicious
  }
  //if (!document.referrer) return; // might be API or direct call

  if (typeof document !== "undefined") {
  }
  // let timestamp = new Date().toISOString();

  const params = new URLSearchParams(window.location.search);
  // Ad platforms auto-tag clicks with an ID instead of UTMs; treat those as
  // paid unless the link carries its own medium. fbclid is skipped because
  // Facebook also adds it to organic shares.
  const clickId = [
    ["gclid", "google"], ["gbraid", "google"], ["wbraid", "google"],
    ["msclkid", "bing"], ["ttclid", "tiktok"],
  ].find(([key]) => params.get(key));
  let utm_source = params.get("utm_source") || "";
  let utm_medium = params.get("utm_medium") || "";
  const utm_campaign = params.get("utm_campaign") || "";
  const utm_term = params.get("utm_term") || "";
  const utm_content = params.get("utm_content") || "";
  if (clickId && !utm_medium) {
    utm_medium = "cpc";
    utm_source = utm_source || clickId[1];
  }

  //,see if a/b testing cookie exists

  const abTests = getABTestsFromCookies() || {};

  let url = typeof window !== "undefined" ? window.location.pathname : "";
  let ref = "";
  if (typeof document !== "undefined") {
    // document.referrer is fixed for the lifetime of an SPA document, so use
    // the previously tracked route after the initial pageview.
    ref = trackingPath
      ? new URL(trackingPath, window.location.origin).href
      : document.referrer;
  }
  let page_title = typeof document !== "undefined" ? document.title : "";
  const screen = {
    width,
    height,
    dpr,
    viewportWidth,
    viewportHeight,
    touchPoints,
    hasTouch,
    pointer,
  };
  let userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  let language = typeof navigator !== "undefined" ? navigator.language : "";
  //returns the client’s browser/OS time zone (e
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (url === trackingPath) {
    return;
  }
  trackingPath = url;
  // A/B tests first, before anything waits, so changed elements show as soon as possible.
  scheduleExperiments(url).catch(revealExperimentPage);

  // Report the previous route's engaged time before switching pages.
  sendEngagement();
  resetEngagement();

  // Its own object: a route change while this one waits replaces `data`.
  const page = {
    url: url,
    ref: ref,
    screen: screen,
    userAgent: userAgent,
    // timestamp: timestamp,
    language: language,
    timezone: timezone,
    domain: domain || "", // Use the site ID from the script tag or a default value
    siteid: siteid || "",
    bot_flags: botFlags(),
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    abTests: JSON.stringify(abTests), // Convert to string for easier handling
    host: host || "",
    screen_width: width,
    screen_height: height,
    page_title: page_title || "",
  };
  data = page;

  const metrics = await metricsSnapshot();
  await fetchpostanalytics(metrics ? { ...page, metrics } : page, "pageview");
  hasTrackedInitial = true;
  // A newer route started while this one waited: it schedules for itself.
  if (trackingPath !== url) return;
  lastTrackedPath = url;
  visitStats(url);
  addBreadcrumb("navigation", url);
  flushErrors();
  checkSiteHealth(url, ref);
  reportConsent();
  scheduleSnapshot();
  scheduleFormViews();
  startReplay().catch(() => {});
  scheduleSurvey().catch(() => {});
  scheduleLeadForms().catch(() => {});
  scheduleNotices().catch(() => {});
  scheduleFeedback().catch(() => {});
  scheduleSiteWidgets().catch(() => {});
  flushQueuedCalls();
  //})();
}
// Track initial page load

async function fetchpostanalytics(data, type = "pageview") {
  try {
    return await sendanalytics(data, type);
  } catch (error) {
    console.error("Error sending analytics data:", error);
  }
}

// Sends without awaiting anything first, so it also works while the page unloads.
// Never throws and never rejects: most callers don't wait for it, and a failure
// here (an ad blocker, no network, a page that has replaced fetch or JSON)
// would otherwise land on the site's own Errors page as if the site had broken.
function sendanalytics(data, type) {
  try {
    return sendanalyticsNow(data, type).catch(() => undefined);
  } catch {
    return Promise.resolve(undefined);
  }
}

function sendanalyticsNow(data, type) {
  const payloadData = { ...data, type, session_id: analyticsSession.getId(), ...trackerInfo };
  const visitor = consentedVisitorId();
  if (visitor) payloadData.visitor = visitor;
  // Preserve this ID in the serialized payload for the beacon/fetch fallback.
  // The collector generates one when randomUUID is unavailable.
  if (globalThis.crypto?.randomUUID) {
    payloadData.event_uid = globalThis.crypto.randomUUID();
  } else {
    delete payloadData.event_uid;
  }

  const payload = JSON.stringify(payloadData);

  if (beacon(COLLECT_URL, payload)) return Promise.resolve(true);

  return fetch(COLLECT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    body: payload,
    cache: "no-store",
    keepalive: true,
  }).then((response) => (response.ok ? true : undefined));
}

// Monkey-patch history methods
const originalPushState = history.pushState;
history.pushState = function () {
  originalPushState.apply(this, arguments);
  setTimeout(() => {
    if (!trackingPath) return;
    track();
    renderShareButtonsOnPage();
  }, 0); // Delay ensures location is updated
};

const originalReplaceState = history.replaceState;
history.replaceState = function () {
  originalReplaceState.apply(this, arguments);
  setTimeout(() => {
    if (!trackingPath) return;
    track();
    renderShareButtonsOnPage();
  }, 0);
};

// Listen to browser back/forward
window.addEventListener("popstate", () => {
  if (!trackingPath) return;
  track();
  renderShareButtonsOnPage();
});

// Events are sent at once (a click often leaves the page) and carry no
// metrics: the collector turns any metrics object into a performance row, and
// the pageview and the page's hide beacon already send those. Each event is
// its own object, so a second click can't rename one still being sent.
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-analytics-event]");
  if (!el) return;
  fetchpostanalytics({
    ...data,
    eventname: el.dataset.analyticsEvent || "click",
    label: el.dataset.analyticsLabel || "",
    value: el.dataset.analyticsValue || "",
    variant: el.dataset.analyticsVariant || "",
    eventid: el.id || "",
    abTests: JSON.stringify(getABTestsFromCookies() || {}),
  }, "click");
});

//. ELEMENT EVENTS -----------------------------------------------
// Elements the site owner picked on the Events page (no code on the site):
// the event is sent when its trigger happens on one (or inside one): a click
// (as a data-analytics-event click would), the element seen (half of it in
// view), its form submitted, hovered or its input changed. Seen and hovered
// count once per page view. Optionally only when the element's text matches,
// only on a page. Capture phase: page handlers that stop propagation must not
// hide them.
const elementEventsSent = new Set();
let elementSeenObserver = null;
let elementSeenScan = null;

function elementEventMatch(click, target) {
  if (click.page && !pathMatches(location.pathname, [click.page])) return null;
  let el = null;
  try {
    el = target.closest(click.selector);
  } catch { /* not a valid selector */ }
  if (!el) return null;
  if (click.text && (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase() !== click.text.toLowerCase()) return null;
  return el;
}

function sendElementEvent(click, el, once) {
  if (once) {
    if (elementEventsSent.has(click)) return;
    elementEventsSent.add(click);
  }
  document.dispatchEvent(new CustomEvent("analytics-event", {
    detail: { eventname: click.name, type: click.trigger === "click" ? "click" : "custom", label: click.label, value: click.value, eventid: el.id || "" },
  }));
}

const ELEMENT_TRIGGERS = { click: "click", submit: "submit", mouseover: "hover", change: "change" };
for (const [type, trigger] of Object.entries(ELEMENT_TRIGGERS)) {
  document.addEventListener(type, (e) => {
    // Not while picking elements (Browse mode lets clicks through).
    if (eventPicker || !(e.target instanceof Element)) return;
    for (const click of clickEvents) {
      if ((click.trigger || "click") !== trigger) continue;
      const el = elementEventMatch(click, e.target);
      if (el) sendElementEvent(click, el, trigger === "hover");
    }
  }, true);
}

// Seen: the matching elements on the page are watched, again as the page changes.
function watchSeenElements() {
  const seen = clickEvents.filter((c) => c.trigger === "seen" && !elementEventsSent.has(c)
    && (!c.page || pathMatches(location.pathname, [c.page])));
  if (!seen.length || eventPicker || !("IntersectionObserver" in window)) return;
  elementSeenObserver ||= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const click of clickEvents) {
        if (click.trigger === "seen" && elementEventMatch(click, entry.target)) sendElementEvent(click, entry.target, true);
      }
    }
  }, { threshold: 0.5 });
  for (const click of seen) {
    for (const el of queryAllSafe(click.selector)) elementSeenObserver.observe(el);
  }
}

// On every page: what was sent once is reset and the seen elements looked for.
function setupElementEvents(list) {
  clickEvents = list;
  elementEventsSent.clear();
  elementSeenObserver?.disconnect();
  elementSeenObserver = null;
  elementSeenScan?.disconnect();
  elementSeenScan = null;
  if (!clickEvents.some((c) => c.trigger === "seen") || !document.body) return;
  watchSeenElements();
  let timer = 0;
  elementSeenScan = new MutationObserver(() => {
    timer ||= setTimeout(() => {
      timer = 0;
      watchSeenElements();
    }, 500);
  });
  elementSeenScan.observe(document.body, { childList: true, subtree: true });
}

// Custom event hook for arbitrary front-end events
// Sent at once and without metrics, like a data-analytics-event click.
document.addEventListener("analytics-event", (e) => {
  const detail = e.detail || {};
  const type = detail.type || "custom";
  const event = {
    ...data,
    eventname: detail.eventname || detail.name || type,
    label: detail.label || "",
    value: detail.value || "",
    variant: detail.variant || "",
    eventid: detail.eventid || detail.id || "",
    abTests: JSON.stringify(getABTestsFromCookies() || {}),
  };
  if (detail.numeric_value !== undefined && detail.numeric_value !== null && detail.numeric_value !== "") {
    event.numeric_value = String(detail.numeric_value);
    if (detail.currency) event.currency = String(detail.currency);
  }
  if (detail.properties && typeof detail.properties === "object") event.properties = detail.properties;
  // A purchase's customer, breakdown and items (analytics.track above).
  if (detail.order && typeof detail.order === "object") Object.assign(event, detail.order);

  fetchpostanalytics(event, type);
});

//. OUTBOUND LINK CLICKS AND FILE DOWNLOADS -----------------------
// Both on by default; disable per site with data-outbound-links="false" or
// data-file-downloads="false". A link to a file counts as a download wherever
// the file is hosted, and only as that: never also as an outbound click.
const trackOutboundLinks =
  (setting("outbound-links") || "").toLowerCase() !== "false";
const trackFileDownloads =
  (setting("file-downloads") || "").toLowerCase() !== "false";
const bareHost = (hostname) => hostname.replace(/^www\./, "").toLowerCase();
let lastLinkClick = { href: "", at: 0 };

// Links to these count as downloads. Images are left out: links to them are
// mostly galleries and lightboxes, not files being taken away.
const FILE_EXTENSIONS = new Set(("pdf doc docx xls xlsx ppt pptx odt ods odp rtf txt csv key pages numbers epub " +
  "zip rar 7z gz tgz tar bz2 xz exe msi dmg pkg apk deb rpm iso appimage " +
  "mp3 wav flac m4a ogg wma mid midi mp4 mov avi mkv webm wmv mpeg mpg").split(" "));

// The link's address, cleaned, or null for non-http links.
function linkUrl(link) {
  const raw = typeof link.href === "string" ? link.href : link.getAttribute("href");
  let u;
  try {
    u = new URL(raw, window.location.href);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  // Only campaign parameters are kept; others may carry tokens or emails.
  u.username = "";
  u.password = "";
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) {
    if (!/^(utm_[a-z]+|ref)$/i.test(key)) u.searchParams.delete(key);
  }
  return u;
}

// Returns the sanitized destination, or "" for internal and non-http links.
function outboundHref(link) {
  const u = linkUrl(link);
  if (!u || bareHost(u.hostname) === bareHost(window.location.hostname)) return "";
  return u.toString();
}

// Returns the sanitized file address, or "" when the link is not a download:
// a known file extension, a download attribute, or data-analytics-download.
function downloadHref(link) {
  if (!trackFileDownloads) return "";
  const u = linkUrl(link);
  if (!u) return "";
  const extension = (/\.([a-z0-9]{1,10})$/i.exec(u.pathname)?.[1] || "").toLowerCase();
  const marked = link.hasAttribute("download") || Boolean(link.closest("[data-analytics-download]"));
  return marked || FILE_EXTENSIONS.has(extension) ? u.toString() : "";
}

function handleLinkClick(e) {
  // click covers plain, Ctrl/Cmd and Shift clicks; auxclick covers middle clicks.
  if (e.type === "auxclick" && e.button !== 1) return;
  if (navigator.webdriver) return;
  const link = e.target?.closest?.("a[href]");
  if (!link) return;
  const file = downloadHref(link);
  // An ignored file link is sent as nothing, not as an outbound click instead.
  if (file && link.closest("[data-analytics-ignore],[data-noanalytics]")) return;
  const href = file || (trackOutboundLinks ? outboundHref(link) : "");
  if (!href) return;
  // A double click on one link counts once.
  const now = Date.now();
  if (href === lastLinkClick.href && now - lastLinkClick.at < 1000) return;
  lastLinkClick = { href, at: now };

  // Built fresh: the shared `data` may hold a previous custom event's fields.
  sendanalytics(
    {
      url: window.location.pathname,
      ref: data?.ref || "",
      screen: { width: window.screen.width, height: window.screen.height },
      userAgent: navigator.userAgent,
      language: navigator.language,
      domain: domain || "",
      siteid: siteid || "",
      host: host || "",
      utm_source: data?.utm_source || "",
      utm_medium: data?.utm_medium || "",
      utm_campaign: data?.utm_campaign || "",
      utm_term: data?.utm_term || "",
      utm_content: data?.utm_content || "",
      abTests: JSON.stringify(getABTestsFromCookies() || {}),
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      page_title: document.title || "",
      ...(file ? { file_url: href } : { outbound_url: href }),
    },
    file ? "file_download" : "outbound_click",
  ).catch(() => { });
}

// Capture phase: page handlers that stop propagation must not hide the click.
if (trackOutboundLinks || trackFileDownloads) {
  document.addEventListener("click", handleLinkClick, true);
  document.addEventListener("auxclick", handleLinkClick, true);
}

function getABTestsFromCookies() {
  const result = {};
  const cookies = document.cookie.split("; ");
  for (const c of cookies) {
    if (c.startsWith("ab_")) {
      const [key, value] = c.split("=");
      const testId = key.slice(3); // remove 'ab_'
      result[testId] = value;
    }
  }
  return result;
}

// Browser signs of automation, checked once per page load and sent with
// every event (`bot_flags`, bits below; the collector adds 64 for addresses
// in data centres). Checks that phones and tablets would fail for innocent
// reasons (no plugins, no window frame, graphics) only run on desktops, and
// none of them looks at what a visitor does.
function botFlags() {
  if (botFlags.value !== undefined) return botFlags.value;
  let flags = 0;
  try {
    const touch = (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
    const ua = navigator.userAgent || "";
    // 1: leftovers of Selenium, ChromeDriver, PhantomJS or Nightmare.
    const traces = /^(\$?cdc_|\$wdc_|_Selenium_IDE_Recorder|__webdriver_|__driver_evaluate|__selenium_|__fxdriver_)/;
    if (window.callPhantom || window._phantom || window.__nightmare || window.domAutomation || window.domAutomationController ||
        document.documentElement.getAttribute("webdriver") !== null ||
        Object.keys(document).some((key) => traces.test(key)) || Object.keys(window).some((key) => traces.test(key))) flags |= 1;
    if (!touch) {
      // 2: a desktop window with no size (headless browsers have no window).
      if (document.visibilityState === "visible" && !document.prerendering && (window.outerWidth === 0 || window.outerHeight === 0)) flags |= 2;
      // 4: claims Windows or a Mac but runs on Linux (servers dressed up as PCs).
      const platform = `${navigator.userAgentData?.platform || ""} ${navigator.platform || ""}`;
      if ((/Windows/.test(ua) && /Linux/i.test(platform) && !/Win/i.test(platform)) ||
          (/Macintosh/.test(ua) && /Linux/i.test(platform) && !/Mac/i.test(platform))) flags |= 4;
      // 8: drawing in software, as on servers without graphics.
      const gl = document.createElement("canvas").getContext("webgl");
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      if (info && /SwiftShader|llvmpipe|softpipe/i.test(String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)))) flags |= 8;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      // 16: desktop Chrome and Firefox list their PDF viewer as plugins.
      if (/Chrome|Firefox/.test(ua) && !/Mobile|Android/.test(ua) && navigator.plugins?.length === 0) flags |= 16;
      // 32: the user agent names a browser the engine isn't. Every Chromium
      // browser (Chrome, Edge, Opera, Brave) has window.chrome and says
      // "Chrome/"; Firefox and Safari have neither.
      if (/Chrome\//.test(ua) !== (typeof window.chrome === "object" && window.chrome !== null)) flags |= 32;
    }
  } catch { /* a check that fails says nothing */ }
  botFlags.value = flags;
  return flags;
}

//. SHARE BUTTONS -------------------------------------------------
// Buttons a site puts on its own pages by marking an element [data-share].
// share.js is only downloaded when a page actually has one, so sites that
// don't use them pay nothing. Each element is rendered once; elements that
// appear later (a shop loading products as you scroll, or a page change in a
// single-page site) are picked up by the observer at the bottom.
//
// The share itself is sent as a "share" event, labelled with the platform and
// identified by what was shared, so a share nobody follows is still counted.
// The address people get carries campaign tags, so the visits it does bring
// back are attributed to the thing that was shared.
let shareModule = null;
const shareRendered = new WeakSet();

// Only these elements may hold a shadow root. Anything else — an <img> above
// all — gets a container of its own right after it.
const SHADOW_OK = new Set(["ARTICLE", "ASIDE", "BLOCKQUOTE", "BODY", "DIV", "FOOTER",
  "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "MAIN", "NAV", "P", "SECTION", "SPAN"]);

function shareHostFor(marked) {
  if (SHADOW_OK.has(marked.tagName)) return marked;
  const holder = document.createElement("span");
  holder.setAttribute("data-noanalytics", "");
  marked.after(holder);
  return holder;
}

// What is shared, and what the report calls it. The page is the default even
// on an image, because a visitor who follows it should land on the site; set
// data-share-url to share the image itself. The label is what tells two
// products (or two images) apart in the report.
function shareOptionsOf(marked) {
  const chosen = (marked.getAttribute("data-share") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const url = marked.getAttribute("data-share-url") || location.href;
  let label = marked.getAttribute("data-share-label") || "";
  if (!label) {
    if (marked.tagName === "IMG") label = marked.getAttribute("alt") || (marked.getAttribute("src") || "").split("/").pop() || "";
    else label = location.pathname;
  }
  return {
    platforms: chosen.length ? chosen : undefined,
    url,
    title: marked.getAttribute("data-share-title") || document.title || "",
    label,
  };
}

// A site with no share buttons must not pay for a live DOM observer, so the
// observer only starts once a [data-share] element has actually been seen.
// Until then the page is scanned at load and on each client-side route change.
let shareObserver = null;
function watchShareButtons() {
  if (shareObserver || !("MutationObserver" in window) || !document.body) return;
  let shareScan = 0;
  shareObserver = new MutationObserver(() => {
    shareScan ||= setTimeout(() => { shareScan = 0; renderShareButtonsOnPage(); }, 300);
  });
  shareObserver.observe(document.body, { childList: true, subtree: true });
}

async function renderShareButtonsOnPage() {
  const present = queryAllSafe("[data-share]");
  if (present.length) watchShareButtons();
  const marked = present.filter((node) => !shareRendered.has(node));
  if (!marked.length) return;
  shareModule ||= loadModule("share.js").catch((error) => {
    shareModule = null;
    throw error;
  });
  let lib;
  try {
    lib = await shareModule;
  } catch {
    return; // the page keeps working without the buttons
  }
  for (const node of marked) {
    if (shareRendered.has(node)) continue;
    shareRendered.add(node);
    const options = shareOptionsOf(node);
    try {
      lib.renderShareButtons(shareHostFor(node), options, {
        shared(platform) {
          document.dispatchEvent(new CustomEvent("analytics-event", {
            detail: {
              eventname: "share",
              label: platform,
              eventid: lib.cleanTag(options.label),
              properties: { shared_url: options.url },
            },
          }));
        },
      });
    } catch { /* one bad element must not stop the rest */ }
  }
}

if (document.body) renderShareButtonsOnPage();
else document.addEventListener("DOMContentLoaded", () => renderShareButtonsOnPage(), { once: true });
})();
