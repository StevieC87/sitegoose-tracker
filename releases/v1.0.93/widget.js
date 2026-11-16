const $=/^#[0-9a-f]{6}$/i,g=(e,a)=>$.test(e||"")?e:a,S=e=>/^https?:\/\//i.test(e||"")?e:"",t=(e,a={},o=[])=>{const n=document.createElement(e);for(const[r,s]of Object.entries(a))s===void 0||s===!1||(r==="text"?n.textContent=s:r.startsWith("on")?n.addEventListener(r.slice(2),s):n.setAttribute(r,s===!0?"":s));for(const r of o)n.append(r);return n};function z(e,a=""){try{if(!(e instanceof ShadowRoot))throw new Error("no shadow root");const o=new CSSStyleSheet;return o.replaceSync(a),e.adoptedStyleSheets=[...e.adoptedStyleSheets,o],{set textContent(n){o.replaceSync(n)}}}catch{const o=document.createElement("style");return o.textContent=a,e.append(o),o}}function w(e,a,o){const n=t("div",{"data-noanalytics":"","data-sg-widget":a}),r=n.attachShadow({mode:"open"});return z(r,`:host { display: block; font: inherit; color: inherit; line-height: inherit; }
      [hidden] { display: none !important; } ${o}`),e.append(n),{host:n,root:r}}function C(e){return e.theme==="dark"||e.theme!=="light"&&window.matchMedia?.("(prefers-color-scheme: dark)").matches?{border:"rgba(255,255,255,.18)",surface:"rgba(255,255,255,.04)",muted:"rgba(255,255,255,.55)",blank:"rgba(255,255,255,.14)"}:{border:"rgba(0,0,0,.12)",surface:"rgba(0,0,0,.02)",muted:"rgba(0,0,0,.5)",blank:"rgba(0,0,0,.1)"}}const v={up:{label:"All systems operational",dot:"#16a34a"},down:{label:"Service disruption",dot:"#dc2626"},unknown:{label:"Status unavailable",dot:"#9ca3af"}},q=(e,a,o,n)=>e==null?n:e>=99.9?a:e>=95?"#f59e0b":o;export function renderStatusBadge(e,a,o){const n=a.look||{},r=["text","pill","bars"].includes(n.size)?n.size:"pill",s=v[o?.status]||v.unknown,l=o?.status==="up"?g(n.accent,s.dot):s.dot,c=C(n),p=typeof o?.uptime=="number"?o.uptime:null,d=Array.isArray(o?.days)?o.days:[],{host:u,root:i}=w(e,"status",`
    .wrap { display: inline-flex; flex-direction: column; gap: 8px; max-width: 100%; }
    .row { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: inherit; }
    .pill { box-sizing: border-box; padding: 7px 12px; border: 1px solid ${c.border}; border-radius: 999px; background: ${c.surface}; }
    a.row:hover { border-color: ${l}; }
    .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: ${l}; }
    .dot.live { animation: pulse 2s ease-in-out infinite; }
    .label { font-size: .9em; }
    .pct { font-size: .9em; color: ${c.muted}; }
    .bars { display: flex; align-items: flex-end; gap: 2px; height: 26px; }
    .bar { flex: 1 1 0; min-width: 2px; height: 100%; border-radius: 2px; }
    .foot { display: flex; justify-content: space-between; gap: 12px; font-size: .78em; color: ${c.muted}; }
    @media (prefers-reduced-motion: reduce) { .dot.live { animation: none; } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  `),x=S(o?.status_url),b=t("span",{class:"label",part:"label",text:s.label}),h=[t("span",{class:`dot${o?.status==="up"?" live":""}`,"aria-hidden":"true"}),b];r!=="text"&&p!==null&&h.push(t("span",{class:"pct",text:`${p.toFixed(2)}%`}));const m=[x?t("a",{class:`row${r==="text"?"":" pill"}`,href:x,target:"_blank",rel:"noopener"},h):t("span",{class:`row${r==="text"?"":" pill"}`},h)];return r==="bars"&&d.length&&(m.push(t("div",{class:"bars","aria-hidden":"true"},d.map(f=>t("span",{class:"bar",style:`background: ${q(f.uptime,g(n.accent,"#16a34a"),"#dc2626",c.blank)}`,title:f.uptime===null?`${f.date}: not checked`:`${f.date}: ${f.uptime.toFixed(2)}%`})))),m.push(t("div",{class:"foot"},[t("span",{text:`${d.length} days ago`}),t("span",{text:"Today"})]))),i.append(t("div",{class:"wrap",part:"box",role:"status","aria-label":p===null?s.label:d.length?`${s.label}. ${p.toFixed(2)}% uptime over the last ${d.length} days.`:`${s.label}. ${p.toFixed(2)}% uptime.`},m)),{remove:()=>u.remove()}}const A=e=>t("span",{class:"stars",part:"stars",role:"img","aria-label":`${e} / 5`},[t("span",{"aria-hidden":"true",text:"\u2605".repeat(e)}),t("span",{class:"off","aria-hidden":"true",text:"\u2605".repeat(5-e)})]),k=(e,a)=>t("figure",{class:"quote",part:"quote"},[...a&&e.rating?[A(e.rating)]:[],t("blockquote",{class:"text",part:"text",text:e.text}),t("figcaption",{},[t("span",{class:"name",part:"name",text:e.name}),...e.role?[t("span",{class:"role",part:"role",text:e.role})]:[]])]);export function renderTestimonials(e,a,o){const n=a.look||{},r=["wall","list","single"].includes(n.layout)?n.layout:"wall",s=Math.min(Math.max(Number(n.count)||9,1),50),l=(Array.isArray(o?.items)?o.items:[]).filter(i=>i?.text&&i?.name).slice(0,s);if(!l.length)return null;const c=g(n.accent,"currentColor"),{host:p,root:d}=w(e,"testimonials",`
    .wall { columns: 280px; column-gap: 16px; }
    .wall .quote { break-inside: avoid; margin: 0 0 16px; }
    .list { display: flex; flex-direction: column; gap: 16px; }
    .quote { position: relative; margin: 0; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; }
    /* The card's line, in the page's own text colour: a border can't be made
       faint without also fading what is inside it. */
    .quote::before { content: ""; position: absolute; inset: 0; border: 1px solid currentColor; border-radius: 12px; opacity: .16; pointer-events: none; }
    .text { margin: 0; white-space: pre-line; overflow-wrap: anywhere; }
    figcaption { display: flex; flex-direction: column; font-size: .9em; }
    .name { font-weight: 600; }
    .role { opacity: .65; }
    .stars { color: ${c}; letter-spacing: 1px; line-height: 1; }
    .stars .off { opacity: .22; }
    .nav { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 10px; font-size: .9em; }
    .nav button { font: inherit; color: inherit; background: none; border: 0; padding: 4px 10px; cursor: pointer; opacity: .7; }
    .nav button:hover, .nav button:focus-visible { opacity: 1; }
    .credit { margin: 10px 0 0; font-size: 12px; opacity: .6; }
    .credit a { color: inherit; text-decoration: none; }
    .credit a:hover { text-decoration: underline; }
  `),u=[];if(r==="single"){let i=0;const x=t("div",{"aria-live":"polite"}),b=t("span"),h=y=>{i=(i+y+l.length)%l.length,x.replaceChildren(k(l[i],n.stars!==!1)),b.textContent=`${i+1} / ${l.length}`};h(0),u.push(x),l.length>1&&u.push(t("div",{class:"nav"},[t("button",{type:"button","aria-label":"Previous",text:"\u2039",onclick:()=>h(-1)}),b,t("button",{type:"button","aria-label":"Next",text:"\u203A",onclick:()=>h(1)})]))}else u.push(t("div",{class:r},l.map(i=>k(i,n.stars!==!1))));return o.branded&&u.push(t("p",{class:"credit"},[t("a",{href:"https://sitegoose.com/?utm_source=powered-by&utm_medium=widget",target:"_blank",rel:"noopener",text:"Powered by SiteGoose"})])),d.append(...u),{remove:()=>p.remove()}}
