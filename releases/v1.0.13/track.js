// Session IDs are scoped to this site and expire after 30 minutes of inactivity.
function createAnalyticsSession(siteId, environment = window) {
  const key = `analytics:session:${siteId}`;
  const timeout = 30 * 60 * 1000;
  const validId = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  let memory = null;
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
      try {
        const stored = environment.localStorage.getItem(key);
        if (stored) session = JSON.parse(stored);
      } catch { /* In-memory tracking remains available when storage is blocked. */ }
      if (!validId(session?.id) || !Number.isFinite(session?.lastActivity) ||
        now < session.lastActivity || now - session.lastActivity >= timeout) {
        session = { id: newId(), lastActivity: now };
      }
      session.lastActivity = now;
      memory = session;
      try { environment.localStorage.setItem(key, JSON.stringify(session)); } catch { /* optional storage */ }
      return session.id;
    },
  };
}

const nav = performance.getEntriesByType("navigation")[0];

let data;
let hasTrackedInitial = false;
let lastTrackedPath = "";

// document.currentScript is set for defer scripts. The querySelector fallback
// covers any edge case (e.g. script injected dynamically).
const current =
  document.currentScript || document.querySelector("script[data-siteid]");
const domain = current?.getAttribute("data-domain") || window.location.hostname;
const siteid = current?.getAttribute("data-siteid");
const analyticsSession = createAnalyticsSession(siteid);
// Customer checkout code reads this ID and sends it to its own backend.
window.analyticsSession = analyticsSession;
const enablePerfMetrics =
  (
    current?.getAttribute("data-metrics") ||
    current?.getAttribute("data-performance") ||
    ""
  ).toLowerCase() === "true";
// web-vitals is inlined so the tracker stays one file with one SRI hash.
// Regenerate with: node scripts/bundle-web-vitals.js
/* BEGIN web-vitals */
// web-vitals v5.1.0 | Apache-2.0 | https://github.com/GoogleChrome/web-vitals
const bundledWebVitals = (() => {
var webVitals=function(e){"use strict";let t=-1;const n=e=>{addEventListener("pageshow",(n=>{n.persisted&&(t=n.timeStamp,e(n))}),!0)},i=(e,t,n,i)=>{let s,r;return o=>{t.value>=0&&(o||i)&&(r=t.value-(s??0),(r||void 0===s)&&(s=t.value,t.delta=r,t.rating=((e,t)=>e>t[1]?"poor":e>t[0]?"needs-improvement":"good")(t.value,n),e(t)))}},s=e=>{requestAnimationFrame((()=>requestAnimationFrame((()=>e()))))},r=()=>{const e=performance.getEntriesByType("navigation")[0];if(e&&e.responseStart>0&&e.responseStart<performance.now())return e},o=()=>{const e=r();return e?.activationStart??0},c=(e,n=-1)=>{const i=r();let s="navigate";t>=0?s="back-forward-cache":i&&(document.prerendering||o()>0?s="prerender":document.wasDiscarded?s="restore":i.type&&(s=i.type.replace(/_/g,"-")));return{name:e,value:n,rating:"good",delta:0,entries:[],id:`v5-${Date.now()}-${Math.floor(8999999999999*Math.random())+1e12}`,navigationType:s}},a=new WeakMap;function d(e,t){return a.get(e)||a.set(e,new t),a.get(e)}class h{t;i=0;o=[];h(e){if(e.hadRecentInput)return;const t=this.o[0],n=this.o.at(-1);this.i&&t&&n&&e.startTime-n.startTime<1e3&&e.startTime-t.startTime<5e3?(this.i+=e.value,this.o.push(e)):(this.i=e.value,this.o=[e]),this.t?.(e)}}const f=(e,t,n={})=>{try{if(PerformanceObserver.supportedEntryTypes.includes(e)){const i=new PerformanceObserver((e=>{Promise.resolve().then((()=>{t(e.getEntries())}))}));return i.observe({type:e,buffered:!0,...n}),i}}catch{}},u=e=>{let t=!1;return()=>{t||(e(),t=!0)}};let l=-1;const m=new Set,v=()=>"hidden"!==document.visibilityState||document.prerendering?1/0:0,p=e=>{if("hidden"===document.visibilityState){if("visibilitychange"===e.type)for(const e of m)e();isFinite(l)||(l="visibilitychange"===e.type?e.timeStamp:0,removeEventListener("prerenderingchange",p,!0))}},g=()=>{if(l<0){const e=o(),t=document.prerendering?void 0:globalThis.performance.getEntriesByType("visibility-state").filter((t=>"hidden"===t.name&&t.startTime>e))[0]?.startTime;l=t??v(),addEventListener("visibilitychange",p,!0),addEventListener("prerenderingchange",p,!0),n((()=>{setTimeout((()=>{l=v()}))}))}return{get firstHiddenTime(){return l},onHidden(e){m.add(e)}}},y=e=>{document.prerendering?addEventListener("prerenderingchange",(()=>e()),!0):e()},b=[1800,3e3],E=(e,t={})=>{y((()=>{const r=g();let a,d=c("FCP");const h=f("paint",(e=>{for(const t of e)"first-contentful-paint"===t.name&&(h.disconnect(),t.startTime<r.firstHiddenTime&&(d.value=Math.max(t.startTime-o(),0),d.entries.push(t),a(!0)))}));h&&(a=i(e,d,b,t.reportAllChanges),n((n=>{d=c("FCP"),a=i(e,d,b,t.reportAllChanges),s((()=>{d.value=performance.now()-n.timeStamp,a(!0)}))})))}))},L=[.1,.25];let P=0,T=1/0,_=0;const M=e=>{for(const t of e)t.interactionId&&(T=Math.min(T,t.interactionId),_=Math.max(_,t.interactionId),P=_?(_-T)/7+1:0)};let w;const C=()=>w?P:performance.interactionCount??0,I=()=>{"interactionCount"in performance||w||(w=f("event",M,{type:"event",buffered:!0,durationThreshold:0}))};let F=0;class k{u=[];l=new Map;m;v;p(){F=C(),this.u.length=0,this.l.clear()}L(){const e=Math.min(this.u.length-1,Math.floor((C()-F)/50));return this.u[e]}h(e){if(this.m?.(e),!e.interactionId&&"first-input"!==e.entryType)return;const t=this.u.at(-1);let n=this.l.get(e.interactionId);if(n||this.u.length<10||e.duration>t.P){if(n?e.duration>n.P?(n.entries=[e],n.P=e.duration):e.duration===n.P&&e.startTime===n.entries[0].startTime&&n.entries.push(e):(n={id:e.interactionId,entries:[e],P:e.duration},this.l.set(n.id,n),this.u.push(n)),this.u.sort(((e,t)=>t.P-e.P)),this.u.length>10){const e=this.u.splice(10);for(const t of e)this.l.delete(t.id)}this.v?.(n)}}}const A=e=>{const t=globalThis.requestIdleCallback||setTimeout;"hidden"===document.visibilityState?e():(e=u(e),addEventListener("visibilitychange",e,{once:!0,capture:!0}),t((()=>{e(),removeEventListener("visibilitychange",e,{capture:!0})})))},B=[200,500];class S{m;h(e){this.m?.(e)}}const N=[2500,4e3],q=[800,1800],H=e=>{document.prerendering?y((()=>H(e))):"complete"!==document.readyState?addEventListener("load",(()=>H(e)),!0):setTimeout(e)};return e.CLSThresholds=L,e.FCPThresholds=b,e.INPThresholds=B,e.LCPThresholds=N,e.TTFBThresholds=q,e.onCLS=(e,t={})=>{const r=g();E(u((()=>{let o,a=c("CLS",0);const u=d(t,h),l=e=>{for(const t of e)u.h(t);u.i>a.value&&(a.value=u.i,a.entries=u.o,o())},m=f("layout-shift",l);m&&(o=i(e,a,L,t.reportAllChanges),r.onHidden((()=>{l(m.takeRecords()),o(!0)})),n((()=>{u.i=0,a=c("CLS",0),o=i(e,a,L,t.reportAllChanges),s((()=>o()))})),setTimeout(o))})))},e.onFCP=E,e.onINP=(e,t={})=>{if(!globalThis.PerformanceEventTiming||!("interactionId"in PerformanceEventTiming.prototype))return;const s=g();y((()=>{I();let r,o=c("INP");const a=d(t,k),h=e=>{A((()=>{for(const t of e)a.h(t);const t=a.L();t&&t.P!==o.value&&(o.value=t.P,o.entries=t.entries,r())}))},u=f("event",h,{durationThreshold:t.durationThreshold??40});r=i(e,o,B,t.reportAllChanges),u&&(u.observe({type:"first-input",buffered:!0}),s.onHidden((()=>{h(u.takeRecords()),r(!0)})),n((()=>{a.p(),o=c("INP"),r=i(e,o,B,t.reportAllChanges)})))}))},e.onLCP=(e,t={})=>{y((()=>{const r=g();let a,h=c("LCP");const l=d(t,S),m=e=>{t.reportAllChanges||(e=e.slice(-1));for(const t of e)l.h(t),t.startTime<r.firstHiddenTime&&(h.value=Math.max(t.startTime-o(),0),h.entries=[t],a())},v=f("largest-contentful-paint",m);if(v){a=i(e,h,N,t.reportAllChanges);const r=u((()=>{m(v.takeRecords()),v.disconnect(),a(!0)})),o=e=>{e.isTrusted&&(A(r),removeEventListener(e.type,o,{capture:!0}))};for(const e of["keydown","click","visibilitychange"])addEventListener(e,o,{capture:!0});n((n=>{h=c("LCP"),a=i(e,h,N,t.reportAllChanges),s((()=>{h.value=performance.now()-n.timeStamp,a(!0)}))}))}}))},e.onTTFB=(e,t={})=>{let s=c("TTFB"),a=i(e,s,q,t.reportAllChanges);H((()=>{const d=r();d&&(s.value=Math.max(d.responseStart-o(),0),s.entries=[d],a(!0),n((()=>{s=c("TTFB",0),a=i(e,s,q,t.reportAllChanges),a(!0)})))}))},e}({});
return webVitals;
})();
/* END web-vitals */
const host = window.location.hostname;
// Configurable wait for web-vitals (ms). Can be set on the script tag
// via `data-web-vitals-wait-ms`. Default 3000ms.
const webVitalsWaitMs =
  Number(current?.getAttribute("data-web-vitals-wait-ms")) || 3000;
const shortWebVitalsWaitMs = Math.min(
  500,
  Math.max(200, Math.floor(webVitalsWaitMs / 6)),
);

// Normalize values that may accidentally be in seconds to milliseconds.
const normalizeToMs = (v) => {
  if (v === null || v === undefined) return v;
  // If value looks like seconds (< 10) assume seconds and convert.
  return typeof v === "number" && Math.abs(v) < 10 ? v * 1000 : v;
};
// NEW: collector URL (defaults to same-origin path, CSP-friendly)
const collectAttr =
  current?.getAttribute("data-collect") ||
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

const navTimings =
  nav && enablePerfMetrics
    ? {
      dns: normalizeToMs(nav.domainLookupEnd - nav.domainLookupStart),
      tcp: normalizeToMs(nav.connectEnd - nav.connectStart),
      tls: normalizeToMs(
        nav.secureConnectionStart > 0
          ? nav.connectEnd - nav.secureConnectionStart
          : 0,
      ),
      redirect: normalizeToMs(nav.redirectEnd - nav.redirectStart),
      response: normalizeToMs(nav.responseEnd - nav.responseStart),
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

// Attempt to flush metrics on pagehide/visibilitychange using sendBeacon.
const flushMetrics = async (type = "pagehide") => {
  try {
    // Try to get metrics but don't wait longer than half the configured wait.
    const race = Promise.race([
      metricsSnapshot(),
      new Promise((res) =>
        setTimeout(
          () => res(null),
          Math.max(250, Math.floor(webVitalsWaitMs / 2)),
        ),
      ),
    ]);
    const metrics = await race;
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
    if (navigator?.sendBeacon) {
      try {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(COLLECT_URL, blob);
        return true;
      } catch (e) {
        // fallback to fetch
      }
    }
    // Best-effort fetch with keepalive
    await fetch(COLLECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: payload,
      keepalive: true,
    });
    return true;
  } catch (e) {
    return false;
  }
};

window.addEventListener("pagehide", () => {
  flushMetrics("pagehide");
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushMetrics("visibilitychange");
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
  heatmapsOff = sessionStorage.getItem(HEATMAPS_OFF_KEY) === "1";
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
// Clicks on these normally change nothing visible (focus, opening a link).
const NOT_DEAD = "input,select,textarea,label,option,[contenteditable],a[href]:not([href^='#']):not([href^='javascript'])";
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
  heatmapSignals.push(detail ? { kind, detail } : kind);
}

function onPageError(message) {
  const last = latestClicks[latestClicks.length - 1];
  if (!last || Date.now() - last.at > ERROR_AFTER_CLICK_MS) return;
  last.click.is_error = 1;
  addSignal("js_error", autoText(message) || "Unknown error");
}
window.addEventListener("error", (e) => {
  onPageError(e.message);
  captureError(e.error, e.message, e.filename, e.lineno, e.colno, "error");
});
window.addEventListener("unhandledrejection", (e) => {
  onPageError(e.reason?.message || String(e.reason ?? ""));
  captureError(e.reason, "", "", 0, 0, "rejection");
});

// JavaScript errors for the Errors report: uncaught exceptions and unhandled
// promise rejections, batched and sent with the page's fields. Each distinct
// error is sent once per page view, at most ERROR_PAGE_LIMIT per page view.
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
const EXTENSION_URL = /(?:chrome|moz|safari(?:-web)?|ms-browser)-extension:\/\//;
let errorsOff = false;
try {
  errorsOff = sessionStorage.getItem(ERRORS_OFF_KEY) === "1";
} catch { /* optional storage */ }
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

function captureError(error, message, file, line, col, kind) {
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
  const type = (isError && typeof error.name === "string" && error.name) ||
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

function requestCrumb(method, url, status) {
  const clean = cleanUrl(url);
  if (!clean || clean.startsWith(new URL(COLLECT_URL, location.href).origin)) return;
  addBreadcrumb("request", `${String(method || "GET").toUpperCase()} ${clean}`, status);
}

if (siteid && !navigator.webdriver) {
  document.addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    const el = e.target?.closest?.(`${AUTO_CLICKABLE},input,select,textarea,label,summary,[role]`) || e.target;
    if (!el?.tagName) return;
    const tag = el.tagName.toLowerCase();
    const label = autoHidden(el) ? "(hidden)"
      : /^(input|select|textarea)$/.test(tag) ? fieldLabel(el)
        : autoText(el.getAttribute("aria-label") || el.innerText || el.getAttribute("title") || "");
    addBreadcrumb("click", label ? `${tag} "${label}"` : tag);
  }, true);

  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      const promise = originalFetch.apply(this, arguments);
      try {
        const url = typeof input === "string" ? input : input?.url || String(input);
        const method = init?.method || input?.method || "GET";
        promise.then(
          (response) => { if (response.status >= 400) requestCrumb(method, url, response.status); },
          (error) => { if (error?.name !== "AbortError") requestCrumb(method, url, 0); },
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
      requests.set(this, { method, url: String(url), aborted: false });
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      const request = requests.get(this);
      if (request) {
        this.addEventListener("abort", () => { request.aborted = true; });
        this.addEventListener("loadend", () => {
          if (this.status >= 400 || (this.status === 0 && !request.aborted)) requestCrumb(request.method, request.url, this.status);
        });
      }
      return originalSend.apply(this, arguments);
    };
  }

  const originalConsoleError = console.error;
  console.error = function (...args) {
    try {
      addBreadcrumb("console", args.map((arg) => {
        if (arg instanceof Error) return arg.message;
        if (typeof arg !== "object" || arg === null) return String(arg);
        try {
          return JSON.stringify(arg).slice(0, 200);
        } catch {
          return String(arg);
        }
      }).join(" "));
    } catch { /* never break logging */ }
    return originalConsoleError.apply(this, args);
  };
}

// Errors before the first page view wait for it, so they carry its fields.
function flushErrors() {
  clearTimeout(errorTimer);
  errorTimer = null;
  if (!pageErrors.length || !data || !hasTrackedInitial || errorsOff) return;
  const { eventname, label, value, variant, eventid, metrics, ...page } = data;
  const payload = { ...page, errors: pageErrors, type: "js_error", session_id: analyticsSession.getId() };
  pageErrors = [];
  const visitor = consentedVisitorId();
  if (visitor) payload.visitor = visitor;
  fetch(COLLECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify(payload),
    cache: "no-store",
    keepalive: true,
  }).then((response) => (response.ok ? response.json() : null)).then((result) => {
    if (result?.enabled !== false) return;
    errorsOff = true;
    try {
      sessionStorage.setItem(ERRORS_OFF_KEY, "1");
    } catch { /* optional storage */ }
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

function runA11yChecks(path) {
  let seen = [];
  try {
    seen = JSON.parse(sessionStorage.getItem(HEALTH_SEEN_KEY) || "[]");
  } catch { /* optional storage */ }
  if (seen.includes(path)) return;
  const issues = [];
  for (const [rule, check] of Object.entries(A11Y_CHECKS)) {
    try {
      const found = check().filter(Boolean);
      if (found.length) issues.push({ rule, count: found.length, samples: found.slice(0, HEALTH_SAMPLE_MAX).map(describe) });
    } catch { /* one check failing should not stop the rest */ }
  }
  // Sent with no issues too, so the report knows the page was checked.
  sendHealth({ url: path, a11y: issues });
  try {
    sessionStorage.setItem(HEALTH_SEEN_KEY, JSON.stringify([...seen, path].slice(-100)));
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
function formFailed(form) {
  formAnalyticsFailed(form);
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
  if (!e.isTrusted || !(form instanceof HTMLFormElement)) return;
  const href = location.href;
  setTimeout(() => {
    if (!form.isConnected || location.href !== href || document.visibilityState === "hidden") return;
    if (form.querySelector("[aria-invalid=true],:invalid")) formFailed(form);
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
  autoEvents.push(event);
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
  if (!e.isTrusted || !(form instanceof HTMLFormElement)) return;
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
// step. Only labels and positions are sent, never what was typed. Sent with
// the heatmap clicks; one attempt is a form's events in one page view.
// Site search boxes are not forms worth reporting and are skipped.
const FORM_PAGE_LIMIT = 150;
// A focus shorter than this (tabbing through) sends no time in field.
const FORM_DWELL_MIN_MS = 300;
// Forms on screen are looked for twice after each pageview: late renders too.
const FORM_VIEW_DELAYS = [1500, 5000];
const FORM_ERRORS_MAX = 5;
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
    const marked = root.getAttribute("data-analytics-form");
    const slots = fieldSlots(root);
    state = {
      key: autoText(marked) || (autoHidden(root) ? "(hidden)" : formLabel(root)),
      reached: new Set(),
      at: Date.now(),
      viewed: false,
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
  formEvents.push(event);
  if (formEvents.length >= HEATMAP_BATCH) sendHeatmapClicks();
}
function formSubmitted(root) {
  const state = formState(root);
  if (state.search) return;
  pushForm({ k: "submit", f: state.key, c: fieldSlots(root).length, ft: state.reached.size, ms: Date.now() - state.at });
}
// Called on every failed attempt, with the fields still invalid.
function formAnalyticsFailed(form) {
  const root = formRoot(form) || form;
  const state = formState(root);
  if (state.search) return;
  const slots = fieldSlots(root);
  pushForm({ k: "fail", f: state.key, c: slots.length, ft: state.reached.size, ms: Date.now() - state.at });
  const invalid = [...root.querySelectorAll(FORM_FIELDS)].filter((el) => el.matches(":invalid,[aria-invalid=true]"));
  const seen = new Set();
  for (const el of invalid) {
    const index = slots.indexOf(fieldSlot(el));
    if (index < 0 || seen.has(index) || seen.size >= FORM_ERRORS_MAX) continue;
    seen.add(index);
    pushForm({ k: "error", f: state.key, n: formFieldLabel(el, index), i: index, c: slots.length, st: formStep(el) });
  }
}
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
  const typed = el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !/^(checkbox|radio|file)$/i.test(el.type));
  focusedField = { el, state, index, count: slots.length, at: Date.now(), before: typed ? el.value : null };
  if (state.reached.has(index)) return;
  if (!state.reached.size) state.at = Date.now();
  state.reached.add(index);
  pushForm({
    k: "field", f: state.key, n: formFieldLabel(el, index), i: index, c: slots.length,
    st: formStep(el), ms: Date.now() - state.at,
  });
}, true);

// Time in the field, and whether a value already there was changed (a
// correction). Also sent when the page is hidden mid-field.
function leaveField() {
  const field = focusedField;
  focusedField = null;
  if (!field?.el.isConnected) return;
  const ms = Date.now() - field.at;
  const corrected = Boolean(field.before) && field.el.value !== field.before;
  if (ms < FORM_DWELL_MIN_MS && !corrected) return;
  pushForm({
    k: "blur", f: field.state.key, n: formFieldLabel(field.el, field.index), i: field.index, c: field.count,
    st: formStep(field.el), fm: Math.min(ms, 10 * 60 * 1000), r: corrected ? 1 : 0,
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
}

document.addEventListener("submit", (e) => {
  const form = e.target;
  if (!e.isTrusted || !(form instanceof HTMLFormElement)) return;
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
  };
  heatmapClicks.push(click);
  latestClicks = [...latestClicks.slice(-9), { click, at: Date.now(), stamp: e.timeStamp }];
  if (!keyboard) markRage(click, clientX, clientY);
  checkDead(click, target, e);
  heatmapPageClicks++;
  if (heatmapClicks.length >= HEATMAP_BATCH) sendHeatmapClicks();
}

function sendHeatmapClicks() {
  if ((!heatmapClicks.length && !heatmapSignals.length && !autoEvents.length && !formEvents.length) ||
      !data || !hasTrackedInitial) return;
  // Only page fields: drop click-event fields a previous custom event left on data.
  const { eventname, label, value, variant, eventid, metrics, ...page } = data;
  const clicks = heatmapClicks;
  const signals = heatmapSignals;
  const auto = autoEvents;
  const forms = formEvents;
  heatmapClicks = [];
  heatmapSignals = [];
  autoEvents = [];
  formEvents = [];
  sendanalytics(
    { ...page, url: lastTrackedPath || page.url, page_version: pageVersion, clicks, signals, auto, forms },
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
      sessionStorage.setItem(HEATMAPS_OFF_KEY, "1");
    } catch { /* optional storage */ }
    return;
  }
  if (claim?.masking) siteMasking = claim.masking;
  if (!claim?.token) return;
  const { captureSnapshot } = await import(new URL("snapshot.js", current.src).href);
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
// loads); the answer is remembered on this device.
const REPLAY_KEY = `analytics:replay:${siteid}`;
// A "no" is asked again after this, so turning replays on takes effect for
// visitors already on the site; a "yes" lasts the whole session.
const REPLAY_RECHECK_MS = 5 * 60 * 1000;
const CONSENT_KEY = `analytics:consent:${siteid}`;
// An answer (and the lasting visitor ID) is kept about 13 months, then asked again.
const CONSENT_AT_KEY = `analytics:consentat:${siteid}`;
const CONSENT_MAX_AGE_MS = 395 * 24 * 60 * 60 * 1000;
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
      for (const key of [CONSENT_KEY, CONSENT_AT_KEY, `analytics:visitor:${siteid}`]) localStorage.removeItem(key);
      return null;
    }
    return stored === "1";
  } catch {
    return null;
  }
}

// Visitors who consent keep one random ID on this device, so their later
// visits count as the same visitor (sites that turn this on in Privacy
// settings; the collector ignores it otherwise). It applies from the next
// visit, so a visit never switches visitor halfway, and "no" deletes it.
const VISITOR_KEY = `analytics:visitor:${siteid}`;
// Sites can also give a lasting ID to visitors who haven't answered (never to
// those who declined). The collector says so in its replay/start answer.
const VISITOR_MODE_KEY = `analytics:visitormode:${siteid}`;
function consentedVisitorId() {
  const consent = readConsent();
  let always = false;
  try {
    always = consent === null && localStorage.getItem(VISITOR_MODE_KEY) === "always";
  } catch { /* optional storage */ }
  if (consent !== true && !always) return "";
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
function reportConsent(choice = false) {
  if (!data || !hasTrackedInitial) {
    consentChoicePending ||= choice;
    return;
  }
  choice ||= consentChoicePending;
  consentChoicePending = false;
  const granted = readConsent();
  if (granted === null) return;
  const session = analyticsSession.getId();
  let sent = null;
  try {
    sent = JSON.parse(localStorage.getItem(CONSENT_SENT_KEY) || "null");
  } catch { /* optional storage */ }
  if (!choice && sent?.session === session && sent.granted === granted) return;
  try {
    localStorage.setItem(CONSENT_SENT_KEY, JSON.stringify({ session, granted }));
  } catch { /* optional storage */ }
  const { eventname, label, value, variant, eventid, metrics, ...page } = data;
  sendanalytics({ ...page, url: lastTrackedPath || page.url, granted, choice }, "consent").catch(() => {});
}

window.analytics = window.analytics || {};
// Custom events from code, e.g. the standard shop events:
//   window.analytics.track("add_to_cart", { item: "Blue shirt", amount: 29.9, currency: "EUR" })
//   window.analytics.track("purchase", { amount: 59.8, currency: "EUR", transaction_id: "order_1042" })
// Same as dispatching an "analytics-event" with eventname, label, numeric_value and currency.
// A transaction_id is sent as the event id "txn:<id>"; revenue counts each id once.
window.analytics.track = (name, props = {}) => {
  if (typeof name !== "string" || !name) return;
  const detail = { eventname: name, label: props.item ?? props.label ?? "", value: props.value ?? "" };
  if (props.transaction_id) detail.eventid = `txn:${props.transaction_id}`;
  if (props.amount !== undefined && props.amount !== null && props.amount !== "") {
    detail.numeric_value = props.amount;
    if (props.currency) detail.currency = props.currency;
  }
  document.dispatchEvent(new CustomEvent("analytics-event", { detail }));
};
window.analytics.consent = (granted) => {
  const value = granted === true;
  // Banners that repeat a stored answer on every page are not making a choice.
  setConsent(value, readConsent() !== value);
};

// Signed-in users, so their visits can be followed across sessions:
//   window.analytics.identify("user_4821")   after login, on every page is fine
//   window.analytics.reset()                 after logout
// Use your own internal ID, never an email address (those are rejected).
// Only sent once per visit, and only when the visitor allowed analytics
// storage, as for lasting visitor IDs.
const IDENTITY_KEY = `analytics:identity:${siteid}`;
window.analytics.identify = (userId) => {
  const id = typeof userId === "number" ? String(userId) : typeof userId === "string" ? userId.trim() : "";
  if (!id || id.length > 200 || id.includes("@")) return;
  let always = false;
  try {
    always = readConsent() === null && localStorage.getItem(VISITOR_MODE_KEY) === "always";
  } catch { /* optional storage */ }
  if (readConsent() !== true && !always) return;
  const session = analyticsSession.getId();
  if (!session) return;
  try {
    const sent = JSON.parse(sessionStorage.getItem(IDENTITY_KEY) || "null");
    if (sent?.id === id && sent.session === session) return;
    sessionStorage.setItem(IDENTITY_KEY, JSON.stringify({ id, session }));
  } catch { /* optional storage */ }
  fetch(new URL("identify", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify({ siteid, session_id: session, user_id: id }),
  }).catch(() => {});
};
window.analytics.reset = () => {
  try {
    sessionStorage.removeItem(IDENTITY_KEY);
  } catch { /* optional storage */ }
};

function setConsent(value, choice) {
  // Repeating the same answer doesn't restart its 13 months.
  const changed = readConsent() !== value;
  try {
    if (changed) localStorage.setItem(CONSENT_AT_KEY, String(Date.now()));
    localStorage.setItem(CONSENT_KEY, value ? "1" : "0");
    if (!value) localStorage.removeItem(VISITOR_KEY);
    // The previous decision may have been "no consent yet".
    sessionStorage.removeItem(REPLAY_KEY);
  } catch { /* optional storage */ }
  window.analyticsConsent = value;
  reportConsent(choice);
  if (value) {
    replayStarted = false;
    startReplay().catch(() => {});
  } else {
    replayRecorder?.stop();
    replayRecorder = null;
  }
}

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
      if (entry?.[0] === "consent" && entry[1] === "update" && entry[2]?.analytics_storage) {
        return entry[2].analytics_storage === "granted";
      }
    }
  } catch { /* a tool's API changed: leave consent alone */ }
  return null;
}

function checkConsentTools(initial) {
  const value = consentFromTools();
  if (value === null || readConsent() === value) return;
  setConsent(value, !initial);
}

const detectConsentTools = (current?.getAttribute("data-consent-detect") || "").toLowerCase() !== "false";
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

// Sites without a consent tool can show ours (Settings → Privacy & consent).
// Its settings come with the surveys config; banner.js is only downloaded for
// visitors who haven't answered, once other tools had time to restore theirs.
// again: shown even after an answer, for a "Cookie settings" link.
async function showConsentBanner(again = false) {
  if (!siteid || !current?.src || navigator.webdriver) return false;
  if (!again && (readConsent() !== null || consentFromTools() !== null)) return false;
  const banner = (await loadSiteConfig().catch(() => null))?.banner;
  if (!banner || (!again && readConsent() !== null)) return false;
  const { renderBanner } = await import(new URL("banner.js", current.src).href);
  renderBanner(banner, (granted) => window.analytics.consent(granted));
  return true;
}
// e.g. <a href="#" onclick="analytics.showConsentBanner(); return false">Cookie settings</a>
window.analytics.showConsentBanner = () => showConsentBanner(true).catch(() => false);

function afterPageLoad() {
  setTimeout(() => {
    if (detectConsentTools) checkConsentTools(true);
    showConsentBanner().catch(() => {});
  }, 1500);
}
if (document.readyState === "complete") afterPageLoad();
else window.addEventListener("load", afterPageLoad, { once: true });

async function startReplay() {
  if (replayStarted || replayRecorder || !siteid || !current?.src || navigator.webdriver ||
      typeof CompressionStream === "undefined" || typeof MutationObserver === "undefined") return;
  replayStarted = true;
  const sessionId = analyticsSession.getId();
  if (!sessionId) return;
  const consent = readConsent();
  let decision = null;
  try {
    decision = JSON.parse(sessionStorage.getItem(REPLAY_KEY) || "null");
  } catch { /* optional storage */ }
  const fresh = decision?.session === sessionId &&
    (decision.record || Date.now() - (decision.at || 0) < REPLAY_RECHECK_MS);
  if (!fresh) {
    const response = await fetch(new URL("replay/start", COLLECT_URL), {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      credentials: "omit",
      body: JSON.stringify({ siteid, session_id: sessionId, consent: consent === true }),
    });
    if (!response.ok) return;
    decision = { session: sessionId, at: Date.now(), ...(await response.json()) };
    try {
      if (decision.visitorIds === "always") localStorage.setItem(VISITOR_MODE_KEY, "always");
      else if (localStorage.getItem(VISITOR_MODE_KEY)) {
        // Turned off: only visitors who consented keep their ID.
        localStorage.removeItem(VISITOR_MODE_KEY);
        if (readConsent() !== true) localStorage.removeItem(VISITOR_KEY);
      }
    } catch { /* optional storage */ }
    // "Waiting for consent" is not kept: consent(true) asks again.
    if (!decision.needsConsent) {
      try {
        sessionStorage.setItem(REPLAY_KEY, JSON.stringify(decision));
      } catch { /* optional storage */ }
    }
  }
  if (!decision.record || !decision.token) return;
  // Consent withdrawn after the session was picked.
  if (decision.requireConsent && consent !== true) return;
  const { startRecording } = await import(new URL("replay.js", current.src).href);
  if (replayRecorder || (decision.requireConsent && readConsent() !== true)) return;
  replayRecorder = startRecording({
    collectUrl: COLLECT_URL,
    token: decision.token,
    masking: decision.masking,
    excludedPaths: decision.excludedPaths || [],
    minDuration: decision.minDuration || 0,
    pageTriggers: decision.pageTriggers || [],
    eventTriggers: decision.eventTriggers || [],
    rageTrigger: Boolean(decision.rageTrigger),
    // Qualifying state and pages buffered before it, shared by the session's pages.
    stateKey: `analytics:replaystate:${siteid}:${sessionId}`,
  });
}

//. SURVEYS -------------------------------------------------------
// The site's active surveys are fetched at most every 10 minutes per tab. On
// each page the first survey whose targeting matches, and that this visitor
// hasn't answered or closed, waits for its trigger (seconds on the page,
// scroll depth, or the mouse leaving the page) and survey.js shows it.
// survey.js sits next to this script and is only downloaded to show one.
const SURVEYS_KEY = `analytics:surveys:${siteid}`;
const SURVEYS_TTL_MS = 10 * 60 * 1000;
// When this visitor last answered or closed any of the site's surveys.
const SURVEY_LAST_KEY = `analytics:survey-last:${siteid}`;
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

// "/blog/*" matches everything under /blog; other patterns match one path.
function pathMatches(path, patterns) {
  const clean = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p).toLowerCase();
  const target = clean(path);
  return patterns.some((pattern) => {
    const p = String(pattern).trim().toLowerCase();
    if (!p) return false;
    return p.endsWith("*") ? target.startsWith(p.slice(0, -1)) : target === clean(p);
  });
}

// The site's active surveys and cookie banner, one request per tab (cached).
let siteConfigRequest = null;
async function loadSiteConfig() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(SURVEYS_KEY) || "null");
    if (cached && Date.now() - cached.at < SURVEYS_TTL_MS) return cached;
  } catch { /* optional storage */ }
  siteConfigRequest ||= fetch(new URL("surveys/config", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    body: JSON.stringify({ siteid }),
  }).then(async (response) => {
    if (!response.ok) return { surveys: [], cooldownDays: 0, banner: null, leadforms: [], notices: [], experiments: [], country: "" };
    const { surveys = [], cooldownDays = 0, banner = null, leadforms = [], notices = [], experiments = [], country = "" } = await response.json();
    const config = { at: Date.now(), surveys, cooldownDays, banner, leadforms, notices, experiments, country };
    try {
      sessionStorage.setItem(SURVEYS_KEY, JSON.stringify(config));
    } catch { /* optional storage */ }
    return config;
  }).finally(() => { siteConfigRequest = null; });
  return siteConfigRequest;
}

// None while the site's cooldown since this visitor's last survey runs.
async function loadSurveys() {
  const { surveys, cooldownDays } = await loadSiteConfig();
  const last = Number(readStored(SURVEY_LAST_KEY)) || 0;
  return Date.now() - last < (Number(cooldownDays) || 0) * DAY_MS ? [] : surveys;
}

// `seen.answered` / `seen.closed` hold when that happened (older trackers
// stored true). 0 days = never again.
const waitedSince = (at, days) => {
  if (!at) return true;
  if (!days) return false;
  return typeof at === "number" && Date.now() - at >= days * DAY_MS;
};

// The targeting's pages and device.
function placeMatches(targeting, path) {
  const mobile = window.innerWidth < 768;
  if ((targeting.device === "mobile" && !mobile) || (targeting.device === "desktop" && mobile)) return false;
  return !(Array.isArray(targeting.pages) && targeting.pages.length && !pathMatches(path, targeting.pages));
}

function surveyMatches(survey, path, key = `analytics:survey:${survey.id}`) {
  const targeting = survey.targeting || {};
  const seen = readStored(key) || {};
  if (!waitedSince(seen.answered, Number(targeting.again_days) || 0)) return false;
  if (!waitedSince(seen.closed, Number(targeting.closed_days) || 0)) return false;
  if (!placeMatches(targeting, path)) return false;
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
  if (!siteid || !current?.src || surveyShowing || navigator.webdriver) return;
  const path = lastTrackedPath;
  const surveys = await loadSurveys().catch(() => []);
  if (lastTrackedPath !== path) return;
  const survey = surveys.find((s) => surveyMatches(s, path));
  if (!survey) return;
  surveyCleanup = watchTrigger(survey.targeting?.trigger, () => {
    surveyCleanup?.();
    surveyCleanup = null;
    if (lastTrackedPath === path && !surveyShowing && !leadPopupShowing) showSurvey(survey, path).catch(() => { surveyShowing = false; });
  });
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
      const room = document.documentElement.scrollHeight - window.innerHeight;
      if (room <= 0 || (window.scrollY / room) * 100 >= (Number(trigger.value) || 50)) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
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

async function showSurvey(survey, path) {
  surveyShowing = true;
  const responseId = globalThis.crypto?.randomUUID?.();
  if (!responseId) {
    surveyShowing = false;
    return;
  }
  const key = `analytics:survey:${survey.id}`;
  const remember = (flag) => {
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
  const { renderSurvey } = await import(new URL("survey.js", current.src).href);
  send("shown");
  renderSurvey(survey, {
    answer: (questionId, answer) => send("answer", { question_id: questionId, answer }),
    complete: () => {
      remember("answered");
      send("completed");
    },
    // Closed without answering anything: not shown to this visitor again.
    close: (answered) => {
      remember(answered ? "answered" : "closed");
      if (!answered) send("closed");
      surveyShowing = false;
    },
    done: () => { surveyShowing = false; },
  });
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
  const forms = (await loadSiteConfig().catch(() => null))?.leadforms || [];
  if (!forms.length || lastTrackedPath !== path) return;

  const fillInline = () => {
    for (const mount of document.querySelectorAll("[data-analytics-leadform]")) {
      if (mount.hasAttribute("data-analytics-leadform-ready")) continue;
      const form = forms.find((f) => f.id === mount.getAttribute("data-analytics-leadform"));
      if (!form) continue;
      mount.setAttribute("data-analytics-leadform-ready", "");
      showLeadForm(form, path, mount).catch(() => mount.removeAttribute("data-analytics-leadform-ready"));
    }
  };
  fillInline();
  // Spots that frameworks render a little after the page view.
  setTimeout(fillInline, 2000);

  const open = (form) => {
    if (lastTrackedPath !== path || leadPopupShowing || surveyShowing) return;
    leadPopupShowing = true;
    showLeadForm(form, path, null).catch(() => { leadPopupShowing = false; });
  };
  const stops = [];
  // Event popups open whenever the visitor asks (e.g. a "Get a quote"
  // button), also after closing or signing up before.
  for (const form of forms) {
    if (form.display === "popup" && form.targeting?.trigger?.type === "event" && placeMatches(form.targeting, path)) {
      stops.push(watchTrigger(form.targeting.trigger, () => open(form)));
    }
  }
  // At most one other popup per page.
  const popup = forms.find((f) => f.display === "popup" && f.targeting?.trigger?.type !== "event"
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

async function showLeadForm(form, path, mount) {
  const key = `analytics:leadform:${form.id}`;
  const remember = (flag) => writeStored(key, { ...(readStored(key) || {}), [flag]: Date.now() });
  const { renderLeadForm } = await import(new URL("leadform.js", current.src).href);
  // Counted for the form's conversion rate.
  fetch(new URL("leads/view", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify({ siteid, form_id: form.id }),
  }).catch(() => {});
  renderLeadForm(form, mount, {
    submit: (values, extra) => fetch(new URL("leads/submit", COLLECT_URL), {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      credentials: "omit",
      body: JSON.stringify({
        // A visitor who declined consent signs up without their visit attached.
        siteid, form_id: form.id, values, ...extra, session_id: readConsent() === false ? "" : analyticsSession.getId(),
        url: lastTrackedPath || path, viewport_width: window.innerWidth,
      }),
    }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) })).catch(() => ({ status: 0 })),
    submitted: () => {
      remember("answered");
      window.analytics.track("lead", { label: form.name || form.id });
    },
    close: () => {
      remember("closed");
      if (!mount) leadPopupShowing = false;
    },
    done: () => {
      if (!mount) leadPopupShowing = false;
    },
  });
}

//. NOTICES -------------------------------------------------------
// Announcement bars (promotions, service notices) and "What's new" panels
// made in the dashboard; notice.js renders them. One bar and one panel per
// page: the newest that matches its pages and device. They stay up across
// single-page navigations while they still match. A closed bar stays closed
// for its closed_days (0 = for good) or until it's edited.
const CHANGELOG_FRESH_MS = 60 * DAY_MS;
let noticeBar = null;
let noticeChangelog = null;

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
  const notices = (await loadSiteConfig().catch(() => null))?.notices || [];
  if (lastTrackedPath !== path) return;
  const live = (n) => !n.ends_at || new Date(n.ends_at).getTime() > Date.now();
  const bar = notices.find((n) => n.kind === "bar" && live(n) && placeMatches(n.targeting || {}, path) && !barClosed(n));
  const changelog = notices.find((n) => n.kind === "changelog" && live(n) && placeMatches(n.targeting || {}, path));
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
}

function barClosed(notice) {
  const seen = readStored(`analytics:notice:${notice.id}`) || {};
  // Edited since it was closed: a new message, shown again.
  if (!seen.closed || (seen.version || 0) < (notice.updated_at || 0)) return false;
  return !waitedSince(seen.closed, Number(notice.targeting?.closed_days) || 0);
}

async function showBar(notice) {
  const { renderBar } = await import(new URL("notice.js", current.src).href);
  sendNotice(notice, "view");
  const remove = renderBar(notice, {
    click: () => {
      sendNotice(notice, "click");
      window.analytics.track("notice_click", { label: notice.name || notice.id });
    },
    close: () => {
      writeStored(`analytics:notice:${notice.id}`, { closed: Date.now(), version: notice.updated_at || 0 });
      noticeBar = null;
    },
  });
  noticeBar = { id: notice.id, updated_at: notice.updated_at, remove };
}

async function showChangelog(notice) {
  const key = `analytics:notice:${notice.id}`;
  // Entries newer than the last one this visitor saw; for first visits, the
  // recent ones only.
  const seenUpTo = Number(readStored(key)?.seen) || Date.now() - CHANGELOG_FRESH_MS;
  const unread = (notice.entries || []).filter((e) => new Date(e.date).getTime() > seenUpTo).map((e) => e.id);
  const { renderChangelog } = await import(new URL("notice.js", current.src).href);
  const panel = renderChangelog(notice, {
    unread,
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
const EXPERIMENTS_KEY = `analytics:experiments:${siteid}`;
const EXPERIMENTS_SEEN_KEY = `analytics:experiments-seen:${siteid}`;
const EXPERIMENTS_HIDE_KEY = `analytics:abhide:${siteid}`;
// The visit this device was first seen in (returning = a later visit), and
// where the current visit came from.
const FIRST_SEEN_KEY = `analytics:firstseen:${siteid}`;
const VISIT_CHANNEL_KEY = `analytics:channel:${siteid}`;
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

const revealExperimentPage = () => document.getElementById("analytics-ab-hide")?.remove();

function queryAllSafe(selector) {
  try {
    return [...document.querySelectorAll(selector)];
  } catch {
    return [];
  }
}

// The snippet's CSS for the next page: every element a test changes.
function rememberExperimentHide(tests) {
  const selectors = [...new Set(tests.flatMap((t) => t.variants.flatMap((v) => (v.changes || []).map((c) => c.selector))))];
  try {
    localStorage.setItem(EXPERIMENTS_HIDE_KEY, selectors.length ? selectors.map((s) => `${s}{opacity:0!important}`).join("") : "none");
  } catch { /* optional storage */ }
}

function isReturningVisitor() {
  const session = analyticsSession.getId();
  let seen = readStored(FIRST_SEEN_KEY);
  if (!seen?.session) {
    seen = { session, at: Date.now() };
    writeStored(FIRST_SEEN_KEY, seen);
  }
  return seen.session !== session;
}

// search | social | paid | email | referral | direct, worked out on the visit's
// first page and kept for the visit. Keep in sync with the backend's SOURCES.
function visitChannel() {
  const session = analyticsSession.getId();
  const stored = readStored(VISIT_CHANNEL_KEY);
  if (stored?.session === session) return stored.channel;
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
  writeStored(VISIT_CHANNEL_KEY, { session, channel });
  return channel;
}

function audienceMatches(audience, country, returning) {
  if (!audience) return true;
  const countries = audience.countries || [];
  if (countries.length) {
    const listed = countries.includes(country);
    if (audience.countries_mode === "exclude" ? listed : !listed) return false;
  }
  if ((audience.visitors === "new" && returning) || (audience.visitors === "returning" && !returning)) return false;
  return !(audience.sources?.length && !audience.sources.includes(visitChannel()));
}

function experimentVariant(test) {
  if (test.rollout) return test.variants[0] || null;
  if (readConsent() === false) return null;
  const stored = { ...experimentMemory, ...(readStored(EXPERIMENTS_KEY) || {}) };
  let id = stored[test.id];
  if (typeof id !== "string" || (id && !test.variants.some((v) => v.id === id))) {
    id = "";
    if (Math.random() * 100 < (Number(test.traffic) || 100)) {
      const total = test.variants.reduce((sum, v) => sum + (Number(v.weight) || 1), 0);
      let pick = Math.random() * total;
      id = (test.variants.find((v) => (pick -= Number(v.weight) || 1) < 0) || test.variants[0]).id;
    }
    experimentMemory[test.id] = stored[test.id] = id;
    writeStored(EXPERIMENTS_KEY, stored);
  }
  return test.variants.find((v) => v.id === id) || null;
}

// Applies one change wherever its element is; false while it isn't on the page.
// Elements already changed are left alone, so running it again changes nothing.
function applyExperimentChange(change) {
  const elements = queryAllSafe(change.selector);
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
    } else if (change.action === "attr") {
      if (el.getAttribute(change.attr) !== change.value) el.setAttribute(change.attr, change.value);
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

function sendExposure(test, variant, path, missed) {
  const session = analyticsSession.getId();
  if (!session) return;
  const seen = readStored(EXPERIMENTS_SEEN_KEY) || {};
  if (seen[test.id] === session) return;
  seen[test.id] = session;
  writeStored(EXPERIMENTS_SEEN_KEY, seen);
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
  const config = await loadSiteConfig().catch(() => null);
  const tests = config?.experiments || [];
  rememberExperimentHide(tests);
  if (experimentPath !== path) return;
  // Every page, so a device is known before any test aimed at returning visitors starts.
  const returning = isReturningVisitor();
  const running = [];
  for (const test of tests) {
    if (!test.variants?.length || !placeMatches({ pages: test.pages, device: test.device }, path)) continue;
    if (!test.rollout && !audienceMatches(test.audience, config.country || "", returning)) continue;
    const variant = experimentVariant(test);
    if (variant) running.push({ test, variant });
  }

  // Split URL tests: the visit goes on at the variant's address, with this page's query.
  for (const { test, variant } of running) {
    if (!variant.redirect_url) continue;
    const target = new URL(variant.redirect_url, location.href);
    if (target.origin === location.origin && target.pathname === location.pathname) continue;
    if (!target.search) target.search = location.search;
    if (!target.hash) target.hash = location.hash;
    if (!test.rollout) sendExposure(test, variant, path, 0);
    location.replace(target.href);
    return;
  }

  const styles = running.filter(({ variant }) => variant.css).map(({ test, variant }) => {
    const style = document.createElement("style");
    style.setAttribute("data-analytics-experiment", test.id);
    style.textContent = variant.css;
    document.head.appendChild(style);
    return style;
  });
  // Every variant waits for the same elements (those any variant changes), so
  // the original's visits are counted on the same pages as the others'.
  const waiting = running.filter(({ test }) => !test.rollout).map(({ test, variant }) => ({
    test,
    variant,
    needed: new Set(test.variants.flatMap((v) => (v.changes || []).flatMap((c) => (c.action === "move" ? [c.selector, c.target] : [c.selector])))),
    found: new Set(),
    sent: false,
  }));
  const report = (entry) => {
    if (entry.sent) return;
    entry.sent = true;
    sendExposure(entry.test, entry.variant, path, entry.needed.size - entry.found.size);
  };
  const reportAll = () => waiting.forEach(report);
  const pass = () => {
    for (const { variant } of running) for (const change of variant.changes || []) applyExperimentChange(change);
    for (const entry of waiting) {
      if (entry.sent) continue;
      for (const selector of entry.needed) {
        if (!entry.found.has(selector) && queryAllSafe(selector).length) entry.found.add(selector);
      }
      if (entry.found.size === entry.needed.size) report(entry);
    }
    if (waiting.every((entry) => entry.sent)) revealExperimentPage();
  };
  pass();

  let frame = 0;
  const observer = new MutationObserver(() => {
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      pass();
    });
  });
  if (running.some(({ variant }) => variant.changes?.length)) {
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: EXPERIMENT_WATCHED_ATTRS,
    });
  }
  const timer = setTimeout(() => {
    reportAll();
    revealExperimentPage();
  }, EXPERIMENT_WAIT_MS);
  window.addEventListener("pagehide", reportAll);
  experimentCleanup = () => {
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
const CAPTURE_SKIP_TYPES = new Set(["password", "file", "hidden", "submit", "button", "reset", "image"]);
const CAPTURE_SKIP_NAMES = /pass|card|cc-|cvv|cvc|iban|ssn|token|captcha|csrf/i;

function captureLabel(el) {
  const text = (value) => (value || "").replace(/\s+/g, " ").replace(/\s*\*$/, "").trim();
  return text(el.labels?.[0]?.textContent) || text(el.getAttribute("aria-label")) || text(el.placeholder) || text(el.name);
}

function capturedFields(form) {
  const fields = [];
  for (const el of form.elements) {
    if (!el.name && !el.id) continue;
    const type = (el.type || "").toLowerCase();
    if (el.disabled || CAPTURE_SKIP_TYPES.has(type) || el.closest("[data-analytics-ignore]")) continue;
    if (CAPTURE_SKIP_NAMES.test(`${el.name} ${el.id} ${el.autocomplete || ""}`)) continue;
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
    fields.push({ label: label.slice(0, 200), name: el.name || el.id, type, value: typeof value === "string" ? value.slice(0, 2000) : value });
  }
  return fields;
}

document.addEventListener("submit", (e) => {
  const form = e.target;
  if (!e.isTrusted || !(form instanceof HTMLFormElement) || !form.hasAttribute("data-analytics-capture") || !siteid) return;
  const action = form.getAttribute("action");
  const handleHere = !e.defaultPrevented && (!action || action === "#");
  if (handleHere) e.preventDefault();
  const name = form.getAttribute("data-analytics-capture") || "Website form";
  const sending = fetch(new URL("leads/capture", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify({
      siteid, form: name, fields: capturedFields(form),
      tags: (form.getAttribute("data-analytics-tags") || "").split(",").map((t) => t.trim()).filter(Boolean),
      elapsed_ms: Math.round(performance.now()),
      session_id: readConsent() === false ? "" : analyticsSession.getId(),
      url: lastTrackedPath || location.pathname, viewport_width: window.innerWidth,
    }),
  }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) })).catch(() => ({ status: 0 }));
  sending.then(({ status }) => {
    if (status >= 200 && status < 300) window.analytics.track("lead", { label: name });
  });
  if (!handleHere) return;
  const button = form.querySelector("[type=submit]");
  if (button) button.disabled = true;
  sending.then(({ status, message }) => {
    if (button) button.disabled = false;
    if (status >= 200 && status < 300) {
      const redirect = form.getAttribute("data-analytics-capture-redirect");
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

let maxScrollDepth = 0;
window.addEventListener(
  "scroll",
  () => {
    const depth = Math.min(
      100,
      Math.round(
        ((window.scrollY + window.innerHeight) /
          document.documentElement.scrollHeight) *
        100,
      ),
    );
    if (depth > maxScrollDepth) {
      maxScrollDepth = depth;
      perfMetrics.scroll_depth = maxScrollDepth;
    }
  },
  { passive: true },
);

// Engaged time: how long the current page was visible, sent when it is hidden,
// left or replaced by an SPA route, with the deepest scroll on that page. Each
// beacon carries only the time since the previous one; reports sum them.
let engagedMs = 0;
let visibleSince = document.visibilityState === "visible" ? Date.now() : null;

const measureScroll = () => {
  const height = document.documentElement.scrollHeight;
  if (!height) return;
  const depth = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / height) * 100));
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
  const height = document.documentElement.scrollHeight;
  attentionBands = height ? [
    Math.max(0, Math.floor((window.scrollY / height) * ATTENTION_BANDS)),
    Math.min(ATTENTION_BANDS, Math.ceil(((window.scrollY + window.innerHeight) / height) * ATTENTION_BANDS)),
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
for (const type of ["scroll", "resize"]) {
  window.addEventListener(type, () => {
    creditAttention();
    lastActivity = Date.now();
  }, { passive: true });
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
    ...(!heatmapsOff && attention.some(Boolean)
      ? { attention: attention.map((ms) => Math.min(ms, 30 * 60 * 1000)) }
      : {}),
  }, "engagement");
  engagedMs = 0;
  attention.fill(0);
}

function resetEngagement() {
  heatmapPageClicks = 0;
  errorPageCount = 0;
  errorSeen.clear();
  autoPageEvents = 0;
  autoSeen.clear();
  formPageEvents = 0;
  formStates = new WeakMap();
  focusedField = null;
  engagedMs = 0;
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
    return;
  } // likely a bot
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
    ref = hasTrackedInitial && lastTrackedPath
      ? new URL(lastTrackedPath, window.location.origin).href
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

  if (url === lastTrackedPath) {
    return;
  }
  // A/B tests first, before anything waits, so changed elements show as soon as possible.
  scheduleExperiments(url).catch(revealExperimentPage);

  // Report the previous route's engaged time before switching pages.
  sendEngagement();
  resetEngagement();

  data = {
    url: url,
    ref: ref,
    screen: screen,
    userAgent: userAgent,
    // timestamp: timestamp,
    language: language,
    timezone: timezone,
    domain: domain || "", // Use the site ID from the script tag or a default value
    siteid: siteid || "",
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

  const metrics = await metricsSnapshot();
  if (metrics) {
    data.metrics = metrics;
  }

  let fetchpost = await fetchpostanalytics(data, "pageview");
  if (!fetchpost) {
  }
  hasTrackedInitial = true;
  lastTrackedPath = url;
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
  //})();
}
// Track initial page load

async function fetchpostanalytics(data, type = "pageview") {
  try {
    const metrics = await metricsSnapshot();
    return await sendanalytics(metrics ? { ...data, metrics } : data, type);
  } catch (error) {
    console.error("Error sending analytics data:", error);
  }
}

// Sends without awaiting anything first, so it also works while the page unloads.
function sendanalytics(data, type) {
  const payloadData = { ...data, type, session_id: analyticsSession.getId() };
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

  if (navigator?.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    const ok = navigator.sendBeacon(COLLECT_URL, blob);
    if (ok) return Promise.resolve(true);
  }

  return fetch(COLLECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    if (!hasTrackedInitial) return;
    track();
  }, 0); // Delay ensures location is updated
};

const originalReplaceState = history.replaceState;
history.replaceState = function () {
  originalReplaceState.apply(this, arguments);
  setTimeout(() => {
    if (!hasTrackedInitial) return;
    track();
  }, 0);
};

// Listen to browser back/forward
window.addEventListener("popstate", () => {
  if (!hasTrackedInitial) return;
  track();
});

document.addEventListener("click", async function (e) {
  const el = e.target.closest("[data-analytics-event]");
  let type;

  if (el) {
    type = "click";
    data = data || {}; // NEW: avoid crashing if click happens before first track() finishes
    data.eventname = el?.dataset.analyticsEvent || "click";
    data.label = el?.dataset.analyticsLabel || "";
    data.value = el?.dataset.analyticsValue || "";
    data.variant = el.dataset.analyticsVariant || "";
    data.eventid = el?.id || "";

    //,check for A/B testing cookies
    const abTests = getABTestsFromCookies() || {};

    data.abTests = JSON.stringify(abTests); // Convert to string for easier handling

    const metrics = metricsSnapshot();
    if (metrics) {
      data.metrics = metrics;
    }

    await fetchpostanalytics(data, type);
  }
});

// Custom event hook for arbitrary front-end events
document.addEventListener("analytics-event", async function (e) {
  const detail = e.detail || {};
  const type = detail.type || "custom";
  data = data || {};
  data.eventname = detail.eventname || detail.name || type;
  data.label = detail.label || "";
  data.value = detail.value || "";
  data.variant = detail.variant || "";
  data.eventid = detail.eventid || detail.id || "";

  const abTests = getABTestsFromCookies() || {};
  data.abTests = JSON.stringify(abTests);

  const metrics = metricsSnapshot();
  if (metrics) {
    data.metrics = metrics;
  }

  // Amounts belong to this event only, so they are not stored on the shared `data`.
  const amount = {};
  if (detail.numeric_value !== undefined && detail.numeric_value !== null && detail.numeric_value !== "") {
    amount.numeric_value = String(detail.numeric_value);
    if (detail.currency) amount.currency = String(detail.currency);
  }

  await fetchpostanalytics({ ...data, ...amount }, type);
});

//. OUTBOUND LINK CLICKS ------------------------------------------
// On by default; disable per site with data-outbound-links="false".
const trackOutboundLinks =
  (current?.getAttribute("data-outbound-links") || "").toLowerCase() !== "false";
const bareHost = (hostname) => hostname.replace(/^www\./, "").toLowerCase();
let lastOutbound = { href: "", at: 0 };

// Returns the sanitized destination, or "" for internal and non-http links.
function outboundHref(link) {
  const raw = typeof link.href === "string" ? link.href : link.getAttribute("href");
  let u;
  try {
    u = new URL(raw, window.location.href);
  } catch {
    return "";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  if (bareHost(u.hostname) === bareHost(window.location.hostname)) return "";
  // Only campaign parameters are kept; others may carry tokens or emails.
  u.username = "";
  u.password = "";
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) {
    if (!/^(utm_[a-z]+|ref)$/i.test(key)) u.searchParams.delete(key);
  }
  return u.toString();
}

function handleOutboundClick(e) {
  // click covers plain, Ctrl/Cmd and Shift clicks; auxclick covers middle clicks.
  if (e.type === "auxclick" && e.button !== 1) return;
  if (navigator.webdriver) return;
  const link = e.target?.closest?.("a[href]");
  if (!link) return;
  const href = outboundHref(link);
  if (!href) return;
  // A double click on one link counts once.
  const now = Date.now();
  if (href === lastOutbound.href && now - lastOutbound.at < 1000) return;
  lastOutbound = { href, at: now };

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
      outbound_url: href,
    },
    "outbound_click",
  ).catch(() => { });
}

// Capture phase: page handlers that stop propagation must not hide the click.
if (trackOutboundLinks) {
  document.addEventListener("click", handleOutboundClick, true);
  document.addEventListener("auxclick", handleOutboundClick, true);
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
