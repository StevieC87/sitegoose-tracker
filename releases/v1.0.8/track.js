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
window.addEventListener("error", (e) => onPageError(e.message));
window.addEventListener("unhandledrejection", (e) => onPageError(e.reason?.message || String(e.reason ?? "")));

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
  if ((!heatmapClicks.length && !heatmapSignals.length && !autoEvents.length) || !data || !hasTrackedInitial) return;
  // Only page fields: drop click-event fields a previous custom event left on data.
  const { eventname, label, value, variant, eventid, metrics, ...page } = data;
  const clicks = heatmapClicks;
  const signals = heatmapSignals;
  const auto = autoEvents;
  heatmapClicks = [];
  heatmapSignals = [];
  autoEvents = [];
  sendanalytics(
    { ...page, url: lastTrackedPath || page.url, page_version: pageVersion, clicks, signals, auto },
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
//   window.analytics.track("purchase", { amount: 59.8, currency: "EUR" })
// Same as dispatching an "analytics-event" with eventname, label, numeric_value and currency.
window.analytics.track = (name, props = {}) => {
  if (typeof name !== "string" || !name) return;
  const detail = { eventname: name, label: props.item ?? props.label ?? "", value: props.value ?? "" };
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
    if (!response.ok) return { surveys: [], banner: null };
    const { surveys = [], banner = null } = await response.json();
    const config = { at: Date.now(), surveys, banner };
    try {
      sessionStorage.setItem(SURVEYS_KEY, JSON.stringify(config));
    } catch { /* optional storage */ }
    return config;
  }).finally(() => { siteConfigRequest = null; });
  return siteConfigRequest;
}

async function loadSurveys() {
  return (await loadSiteConfig()).surveys;
}

function surveyMatches(survey, path) {
  const targeting = survey.targeting || {};
  const key = `analytics:survey:${survey.id}`;
  const seen = readStored(key) || {};
  if (seen.answered || seen.closed) return false;
  const mobile = window.innerWidth < 768;
  if ((targeting.device === "mobile" && !mobile) || (targeting.device === "desktop" && mobile)) return false;
  if (Array.isArray(targeting.pages) && targeting.pages.length && !pathMatches(path, targeting.pages)) return false;
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
  const trigger = survey.targeting?.trigger || { type: "delay", value: 5 };
  const show = () => {
    surveyCleanup?.();
    surveyCleanup = null;
    if (lastTrackedPath === path && !surveyShowing) showSurvey(survey, path).catch(() => { surveyShowing = false; });
  };
  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  if (trigger.type === "scroll") {
    const onScroll = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight;
      if (room <= 0 || (window.scrollY / room) * 100 >= (Number(trigger.value) || 50)) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    surveyCleanup = () => window.removeEventListener("scroll", onScroll);
    onScroll();
  } else if (trigger.type === "exit" && !touch) {
    const onLeave = (e) => {
      if (!e.relatedTarget && e.clientY <= 0) show();
    };
    document.addEventListener("mouseout", onLeave);
    surveyCleanup = () => document.removeEventListener("mouseout", onLeave);
  } else {
    // Exit intent has no mouse to watch on touch screens: show after 30 seconds.
    const seconds = trigger.type === "exit" ? 30 : Number(trigger.value) || 5;
    const timer = setTimeout(show, seconds * 1000);
    surveyCleanup = () => clearTimeout(timer);
  }
}

async function showSurvey(survey, path) {
  surveyShowing = true;
  const responseId = globalThis.crypto?.randomUUID?.();
  if (!responseId) {
    surveyShowing = false;
    return;
  }
  const key = `analytics:survey:${survey.id}`;
  const remember = (flag) => writeStored(key, { ...(readStored(key) || {}), [flag]: true });
  const send = (kind, extra = {}) => fetch(new URL("surveys/event", COLLECT_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify({
      siteid, survey_id: survey.id, response_id: responseId, session_id: analyticsSession.getId(),
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
  sendHeatmapClicks();
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
  autoPageEvents = 0;
  autoSeen.clear();
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
  reportConsent();
  scheduleSnapshot();
  startReplay().catch(() => {});
  scheduleSurvey().catch(() => {});
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
