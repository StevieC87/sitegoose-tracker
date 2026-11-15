const $=/^#[0-9a-f]{6}$/i,g=(e,r)=>$.test(e||"")?e:r,z=e=>/^https?:\/\//i.test(e||"")?e:"",t=(e,r={},n=[])=>{const o=document.createElement(e);for(const[i,a]of Object.entries(r))a===void 0||a===!1||(i==="text"?o.textContent=a:i.startsWith("on")?o.addEventListener(i.slice(2),a):o.setAttribute(i,a===!0?"":a));for(const i of n)o.append(i);return o};function w(e,r){const n=t("div",{"data-noanalytics":""}),o=n.attachShadow({mode:"open"});return o.append(t("style",{text:`:host { display: block; font: inherit; color: inherit; line-height: inherit; }
      [hidden] { display: none !important; } ${r}`})),e.append(n),{host:n,root:o}}function q(e){return e.theme==="dark"||e.theme!=="light"&&window.matchMedia?.("(prefers-color-scheme: dark)").matches?{border:"rgba(255,255,255,.18)",surface:"rgba(255,255,255,.04)",muted:"rgba(255,255,255,.55)",blank:"rgba(255,255,255,.14)"}:{border:"rgba(0,0,0,.12)",surface:"rgba(0,0,0,.02)",muted:"rgba(0,0,0,.5)",blank:"rgba(0,0,0,.1)"}}const v={up:{label:"All systems operational",dot:"#16a34a"},down:{label:"Service disruption",dot:"#dc2626"},unknown:{label:"Status unavailable",dot:"#9ca3af"}},A=(e,r,n,o)=>e==null?o:e>=99.9?r:e>=95?"#f59e0b":n;export function renderStatusBadge(e,r,n){const o=r.look||{},i=["text","pill","bars"].includes(o.size)?o.size:"pill",a=v[n?.status]||v.unknown,l=n?.status==="up"?g(o.accent,a.dot):a.dot,c=q(o),p=typeof n?.uptime=="number"?n.uptime:null,d=Array.isArray(n?.days)?n.days:[],{host:u,root:s}=w(e,`
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
  `),h=z(n?.status_url),f=t("span",{class:"label",text:a.label}),x=[t("span",{class:`dot${n?.status==="up"?" live":""}`,"aria-hidden":"true"}),f];i!=="text"&&p!==null&&x.push(t("span",{class:"pct",text:`${p.toFixed(2)}%`}));const m=[h?t("a",{class:`row${i==="text"?"":" pill"}`,href:h,target:"_blank",rel:"noopener"},x):t("span",{class:`row${i==="text"?"":" pill"}`},x)];return i==="bars"&&d.length&&(m.push(t("div",{class:"bars","aria-hidden":"true"},d.map(b=>t("span",{class:"bar",style:`background: ${A(b.uptime,g(o.accent,"#16a34a"),"#dc2626",c.blank)}`,title:b.uptime===null?`${b.date}: not checked`:`${b.date}: ${b.uptime.toFixed(2)}%`})))),m.push(t("div",{class:"foot"},[t("span",{text:`${d.length} days ago`}),t("span",{text:"Today"})]))),s.append(t("div",{class:"wrap",role:"status","aria-label":p===null?a.label:d.length?`${a.label}. ${p.toFixed(2)}% uptime over the last ${d.length} days.`:`${a.label}. ${p.toFixed(2)}% uptime.`},m)),{remove:()=>u.remove()}}const C=e=>t("span",{class:"stars",part:"stars",role:"img","aria-label":`${e} / 5`},[t("span",{"aria-hidden":"true",text:"\u2605".repeat(e)}),t("span",{class:"off","aria-hidden":"true",text:"\u2605".repeat(5-e)})]),k=(e,r)=>t("figure",{class:"quote",part:"quote"},[...r&&e.rating?[C(e.rating)]:[],t("blockquote",{class:"text",part:"text",text:e.text}),t("figcaption",{},[t("span",{class:"name",part:"name",text:e.name}),...e.role?[t("span",{class:"role",part:"role",text:e.role})]:[]])]);export function renderTestimonials(e,r,n){const o=r.look||{},i=["wall","list","single"].includes(o.layout)?o.layout:"wall",a=Math.min(Math.max(Number(o.count)||9,1),50),l=(Array.isArray(n?.items)?n.items:[]).filter(s=>s?.text&&s?.name).slice(0,a);if(!l.length)return null;const c=g(o.accent,"currentColor"),{host:p,root:d}=w(e,`
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
  `),u=[];if(i==="single"){let s=0;const h=t("div",{"aria-live":"polite"}),f=t("span"),x=y=>{s=(s+y+l.length)%l.length,h.replaceChildren(k(l[s],o.stars!==!1)),f.textContent=`${s+1} / ${l.length}`};x(0),u.push(h),l.length>1&&u.push(t("div",{class:"nav"},[t("button",{type:"button","aria-label":"Previous",text:"\u2039",onclick:()=>x(-1)}),f,t("button",{type:"button","aria-label":"Next",text:"\u203A",onclick:()=>x(1)})]))}else u.push(t("div",{class:i},l.map(s=>k(s,o.stars!==!1))));return n.branded&&u.push(t("p",{class:"credit"},[t("a",{href:"https://sitegoose.com/?utm_source=powered-by&utm_medium=widget",target:"_blank",rel:"noopener",text:"Powered by SiteGoose"})])),d.append(...u),{remove:()=>p.remove()}}
