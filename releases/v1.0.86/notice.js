const Y=/^#[0-9a-f]{6}$/i,j=(e,t)=>Y.test(e||"")?e:t,O="#111827",F="#f9fafb",q=e=>{const[t,n,a]=[1,3,5].map(i=>{const r=parseInt(e.slice(i,i+2),16)/255;return r<=.03928?r/12.92:((r+.055)/1.055)**2.4});return .2126*t+.7152*n+.0722*a},H=(e,t)=>{const[n,a]=[q(e),q(t)].sort((i,r)=>r-i);return(n+.05)/(a+.05)},G=e=>H(e,O)>=H(e,F)?O:F,U=e=>{const t=Y.test(e.background||"")?e.background:"";if(!t)return e.theme==="dark"?{deep:!0,bg:O,fg:F,line:"#374151",faint:"#1f2937",fieldLine:"#4b5563",field:"#1f2937",mute:"#1f2937",chip:"#00000066"}:{deep:!1,bg:"#ffffff",fg:O,line:"#e5e7eb",faint:"#f3f4f6",fieldLine:"#d1d5db",field:"#ffffff",mute:"#f3f4f6",chip:"#ffffffcc"};const n=G(t),a=n===F;return{deep:a,bg:t,fg:n,line:a?"rgba(255,255,255,.22)":"rgba(0,0,0,.14)",faint:a?"rgba(255,255,255,.10)":"rgba(0,0,0,.06)",fieldLine:a?"rgba(255,255,255,.34)":"rgba(0,0,0,.24)",field:a?"rgba(255,255,255,.08)":"rgba(255,255,255,.72)",mute:a?"rgba(255,255,255,.12)":"rgba(0,0,0,.07)",chip:a?"rgba(0,0,0,.4)":"rgba(255,255,255,.85)"}},I=["class","data-theme","data-bs-theme"],J=()=>{for(const e of[document.documentElement,document.body]){if(!e)continue;const t=I.flatMap(n=>n==="class"?[...e.classList]:[e.getAttribute(n)]);if(t.includes("dark"))return!0;if(t.includes("light"))return!1}return!!window.matchMedia?.("(prefers-color-scheme: dark)").matches},Q=/^rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)$/,W=(e,t)=>{if(!e)return"";t.style.color="",t.style.color=e;const n=t.style.color&&Q.exec(getComputedStyle(t).color);return!n||n[4]!==void 0&&Number(n[4])<1?"":`#${n.slice(1,4).map(a=>Math.min(255,Math.round(Number(a))).toString(16).padStart(2,"0")).join("")}`},Z=e=>{const t=e.replace(/[{};<>\\/\n\r]/g,"").slice(0,300).trim();return t.split('"').length%2&&t.split("'").length%2?t:""},ee=(e,t,n,a,i)=>{t.setAttribute("data-sg-widget",e);const r=document.createElement("i");r.hidden=!0,n.append(r);let k="",u=!1;const h=()=>{if(t.isConnected)u=!0;else if(u)return M();const l=t.isConnected?getComputedStyle(t):null,$=x=>l?l.getPropertyValue(x).trim():"",b=W($("--sg-bg"),r),d=W($("--sg-accent"),r),f=Z($("--sg-font")),w={...a,theme:a.theme==="auto"?J()?"dark":"light":a.theme,...b&&{background:b},...d&&{color:d}},E=JSON.stringify([w,f]);E!==k&&(k=E,i(w,f))},y=window.matchMedia?.("(prefers-color-scheme: dark)");y?.addEventListener?.("change",h);const g=typeof MutationObserver=="function"?new MutationObserver(h):null;document.documentElement&&g?.observe(document.documentElement,{attributes:!0,attributeFilter:[...I,"style"]}),document.body&&g?.observe(document.body,{attributes:!0,attributeFilter:I}),document.readyState!=="complete"&&window.addEventListener("load",h);function M(){y?.removeEventListener?.("change",h),g?.disconnect(),window.removeEventListener("load",h)}return h(),{update:h,stop:M}},P=e=>/^https?:\/\//i.test(e||"")?e:"",te='system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',B=e=>`font: 14px/1.45 ${e||te};`,o=(e,t={},n=[])=>{const a=document.createElement(e);for(const[i,r]of Object.entries(t))r===void 0||r===!1||(i==="text"?a.textContent=r:i.startsWith("on")?a.addEventListener(i.slice(2),r):a.setAttribute(i,r===!0?"":r));for(const i of n)a.append(i);return a};function D(e,t){const n=document.createElement("div");n.setAttribute("data-noanalytics","");const a=n.attachShadow({mode:"open"}),i=o("style");a.append(i);const r=ee("notice",n,a,e,(k,u)=>{i.textContent=`:host { all: initial; } [hidden] { display: none !important; } ${t(k,u)}`});return{host:n,root:a,site:r}}function R(e){const t=new Date(e).getTime()-Date.now();if(!(t>0))return null;const n=Math.floor(t/1e3);return{d:Math.floor(n/86400),h:Math.floor(n%86400/3600),m:Math.floor(n%3600/60),s:n%60}}const K="--analytics-notice-bottom";export function renderBar(e,t){if(e.countdown&&e.ends_at&&!R(e.ends_at))return null;const n=e.look||{},a=j(n.color,"#111827"),i=j(n.text_color,"#ffffff"),r=n.position==="bottom",{host:k,root:u,site:h}=D(n,(d,f)=>`
    .bar {
      box-sizing: border-box; ${B(f)} display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
      gap: 8px 16px; width: 100%; padding: 10px 48px; background: ${a}; color: ${i}; text-align: center; position: relative;
      ${r?"position: fixed; z-index: 2147482000; left: 0; right: 0; bottom: 0; box-shadow: 0 -6px 24px rgba(0,0,0,.14); animation: up .35s ease-out;":"animation: down .35s ease-out;"}
    }
    @keyframes down { from { transform: translateY(-100%); opacity: 0; } }
    @keyframes up { from { transform: translateY(100%); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
    .text { font-weight: 600; letter-spacing: .01em; }
    .extras { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 12px; }
    .code {
      display: inline-flex; align-items: center; gap: 6px; padding: 3px 3px 3px 10px; border: 1.5px dashed ${i}aa; border-radius: 7px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; letter-spacing: .06em;
    }
    .copy {
      border: 0; border-radius: 5px; padding: 3px 9px; background: ${i}2e; color: inherit;
      font: 600 12px/1.5 system-ui, -apple-system, sans-serif; letter-spacing: 0; cursor: pointer; transition: background .15s;
    }
    .copy:hover { background: ${i}47; }
    .time { display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
    .time-label { margin-right: 2px; font-size: 12px; opacity: .85; }
    .seg {
      display: inline-flex; align-items: baseline; gap: 1px; min-width: 30px; justify-content: center; padding: 3px 5px;
      border-radius: 5px; background: ${i}24; font-weight: 700;
    }
    .seg small { font-size: 10px; font-weight: 600; opacity: .8; }
    .cta {
      display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 7px; background: ${i}; color: ${a};
      font-weight: 700; text-decoration: none; white-space: nowrap; transition: transform .15s, box-shadow .15s;
    }
    .cta:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.18); }
    .cta:focus-visible, .copy:focus-visible, .x:focus-visible { outline: 2px solid ${i}; outline-offset: 2px; }
    .x {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; border: 0; border-radius: 50%;
      background: none; color: inherit; opacity: .7; cursor: pointer; font-size: 16px; line-height: 1;
    }
    .x:hover { opacity: 1; background: ${i}1f; }
    @media (max-width: 600px) {
      .bar { gap: 8px; padding: 9px 40px 9px 14px; font-size: 13px; }
      .x { right: 4px; top: 6px; transform: none; }
      .time-label { display: none; }
      .seg { min-width: 26px; padding: 2px 4px; }
      .cta { padding: 6px 12px; }
    }
  `),y=o("div",{class:"bar",part:"box",role:"region","aria-label":e.name||"Announcement"});y.append(o("span",{class:"text",part:"title",text:e.text||""}));const g=o("span",{class:"extras"});if(e.coupon){const d=o("button",{class:"copy",type:"button",text:"Copy","aria-label":`Copy code ${e.coupon}`});d.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(e.coupon),t.copy?.(),d.textContent="Copied \u2713",setTimeout(()=>{d.textContent="Copy"},2e3)}catch{}}),g.append(o("span",{class:"code"},[o("span",{text:e.coupon}),d]))}let M=null,l=null;if(e.countdown&&e.ends_at){const d=o("span",{class:"time",role:"timer","aria-live":"off"}),f=x=>String(x).padStart(2,"0"),w=(x,s)=>o("span",{class:"seg"},[document.createTextNode(x),o("small",{text:s})]),E=()=>{const x=R(e.ends_at);if(!x)return b();d.replaceChildren(o("span",{class:"time-label",text:"Ends in"}),...x.d?[w(x.d,"d")]:[],w(f(x.h),"h"),w(f(x.m),"m"),w(f(x.s),"s"))};E(),M=setInterval(E,1e3),g.append(d)}const $=P(e.link_url);$&&e.link_label&&g.append(o("a",{class:"cta",part:"button",href:$,onclick:()=>t.click()},[o("span",{text:e.link_label}),o("span",{"aria-hidden":"true",text:"\u2192"})])),g.childNodes.length&&y.append(g),e.dismissible!==!1&&y.append(o("button",{class:"x",type:"button","aria-label":"Close",title:"Close",text:"\u2715",onclick:()=>{b(),t.close()}})),u.append(y);function b(){clearInterval(M),l?.disconnect(),h.stop(),k.remove(),r&&(document.body.style.removeProperty("padding-bottom"),document.documentElement.style.removeProperty(K))}if(r){document.body.append(k);const d=parseFloat(getComputedStyle(document.body).paddingBottom)||0;l=new ResizeObserver(()=>{const f=y.offsetHeight;document.body.style.paddingBottom=`${d+f}px`,document.documentElement.style.setProperty(K,`${f}px`)}),l.observe(y)}else document.body.prepend(k);return h.update(),b}const oe=()=>{const e=document.createElementNS("http://www.w3.org/2000/svg","svg");e.setAttribute("viewBox","0 0 16 16"),e.setAttribute("fill","currentColor"),e.setAttribute("aria-hidden","true");const t=document.createElementNS("http://www.w3.org/2000/svg","path");return t.setAttribute("d","M7.66 1.3a.36.36 0 0 1 .68 0l1.1 3.2a2 2 0 0 0 1.24 1.25l3.2 1.1a.36.36 0 0 1 0 .68l-3.2 1.1a2 2 0 0 0-1.24 1.24l-1.1 3.2a.36.36 0 0 1-.68 0l-1.1-3.2a2 2 0 0 0-1.25-1.24l-3.2-1.1a.36.36 0 0 1 0-.68l3.2-1.1A2 2 0 0 0 6.56 4.5z"),e.append(t),e};export function renderChangelog(e,t){const n=e.look||{},a=n.position==="left",{host:i,root:r,site:k}=D(n,(s,S)=>{const p=j(s.color,"#2563eb"),c=U(s),L=B(S);return`
    .launch {
      position: fixed; z-index: 2147482000; bottom: calc(16px + var(${K}, 0px)); ${a?"left":"right"}: 16px;
      box-sizing: border-box; ${L} display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px 10px 16px;
      border: 0; border-radius: 999px; cursor: pointer; background: ${p}; color: #fff; font-weight: 600;
      box-shadow: 0 6px 20px rgba(0,0,0,.2); transition: transform .15s, box-shadow .15s, bottom .2s;
    }
    .launch:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(0,0,0,.24); }
    .launch:focus-visible { outline: 2px solid ${p}; outline-offset: 3px; }
    .launch svg { width: 16px; height: 16px; }
    .badge {
      min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; background: #fff; color: ${p};
      font-size: 12px; font-weight: 700; line-height: 20px; text-align: center;
    }
    .shade { position: fixed; z-index: 2147483000; inset: 0; background: rgba(0,0,0,.35); animation: fade .25s ease-out; }
    @keyframes fade { from { opacity: 0; } }
    @keyframes slide { from { transform: translateX(${a?"-":""}100%); } }
    @media (prefers-reduced-motion: reduce) { .shade, .panel { animation: none !important; } }
    .panel {
      position: fixed; z-index: 2147483001; top: 0; bottom: 0; ${a?"left":"right"}: 0; width: 400px; max-width: 100%;
      box-sizing: border-box; display: flex; flex-direction: column; ${L}
      background: ${c.bg}; color: ${c.fg}; box-shadow: 0 0 40px rgba(0,0,0,.25);
      animation: slide .3s cubic-bezier(.2,.8,.2,1);
    }
    .head { border-top: 4px solid ${p}; }
    .head { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid ${c.line}; }
    .title { flex: 1; margin: 0; font-size: 18px; font-weight: 700; }
    .x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; font-size: 18px; line-height: 1; padding: 4px; }
    .x:hover, .x:focus-visible { opacity: 1; }
    .list { flex: 1; overflow-y: auto; margin: 0; padding: 4px 20px 20px; list-style: none; }
    .entry { padding: 16px 0; border-bottom: 1px solid ${c.faint}; }
    .entry:last-child { border-bottom: 0; }
    .meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; opacity: .7; }
    .label { padding: 1px 8px; border-radius: 999px; background: ${p}22; color: ${c.deep?"#fff":p}; font-weight: 700; opacity: 1; }
    .new { width: 8px; height: 8px; border-radius: 50%; background: ${p}; }
    .entry h3 { margin: 0 0 4px; font-size: 15px; font-weight: 700; }
    .shot {
      display: block; width: 100%; height: auto; margin: 4px 0 10px; border-radius: 8px;
      border: 1px solid ${c.line}; background: ${c.mute};
    }
    .entry p { margin: 0 0 8px; white-space: pre-wrap; opacity: .85; }
    .more { color: ${c.deep?"#93c5fd":p}; font-weight: 600; text-decoration: none; }
    .more:hover { text-decoration: underline; }
  `}),u=new Set(t.unread),h=e.button_text||"What's new",y=o("span",{class:"badge","aria-hidden":"true",hidden:!u.size,text:String(u.size)}),g=e.launcher==="custom"?null:o("button",{class:"launch",type:"button","aria-label":u.size?`${h}, ${u.size} new`:h,onclick:()=>E()},[oe(),o("span",{text:h}),y]);g&&r.append(g);const M=s=>{try{return new Date(s).toLocaleDateString(void 0,{day:"numeric",month:"short",year:"numeric"})}catch{return""}},l=o("div",{class:"shade",hidden:!0,onclick:()=>x()}),$=o("ul",{class:"list"}),b=o("div",{class:"panel",part:"box",role:"dialog","aria-modal":"true","aria-labelledby":"t",hidden:!0},[o("div",{class:"head"},[o("p",{class:"title",part:"title",id:"t",text:e.title||"What's new"}),o("button",{class:"x",type:"button","aria-label":"Close",title:"Close",text:"\u2715",onclick:()=>x()})]),$]);r.append(l,b);const d=()=>{$.replaceChildren(...(e.entries||[]).map(s=>{const S=P(s.link_url),p=s.image?t.imageUrl?.(s.image):"",c=p?o("img",{class:"shot",src:p,alt:s.image.alt||"",loading:"lazy",decoding:"async",width:s.image.width,height:s.image.height,onerror:()=>c.remove()}):null;return o("li",{class:"entry"},[o("div",{class:"meta"},[...u.has(s.id)?[o("span",{class:"new",title:"New"})]:[],...s.label?[o("span",{class:"label",text:s.label})]:[],o("time",{datetime:s.date,text:M(s.date)})]),o("h3",{text:s.title}),...c?[c]:[],...s.body?[o("p",{text:s.body})]:[],...S?[o("a",{class:"more",href:S,target:"_blank",rel:"noopener",text:"Read more \u2192",onclick:()=>t.click()})]:[]])}))},f=s=>{if(s.key==="Escape"&&x(),s.key!=="Tab")return;const S=[...b.querySelectorAll("button, a[href]")],p=S[0],c=S[S.length-1],L=r.activeElement;(s.shiftKey?L===p||!b.contains(L):L===c||!b.contains(L))&&(s.preventDefault(),(s.shiftKey?c:p).focus())};let w=null;function E(){b.hidden&&(w=document.activeElement,d(),l.hidden=!1,b.hidden=!1,b.querySelector(".x").focus({preventScroll:!0}),document.addEventListener("keydown",f,!0),t.opened())}function x(){l.hidden=!0,b.hidden=!0,document.removeEventListener("keydown",f,!0),u.clear(),y.hidden=!0,g?.setAttribute("aria-label",h),(w===i?g:w)?.focus?.({preventScroll:!0})}return document.body.append(i),k.update(),{open:E,remove:()=>{document.removeEventListener("keydown",f,!0),k.stop(),i.remove()}}}const X={fade:"opacity: 0;",zoom:"opacity: 0; transform: scale(.92);",up:"opacity: 0; transform: translateY(48px);",none:""};export function renderPopup(e,t){const n=e.look||{},a=j(n.text_color,"#ffffff"),i=["full","corner"].includes(e.size)?e.size:"modal",r=n.position==="left",k=e.image&&t.image?t.image:"";let u=k?e.layout||"top":"text";const h=e.animation==="side"?`opacity: 0; transform: translateX(${r?"-":""}64px);`:X[e.animation]??X.zoom,{host:y,root:g,site:M}=D(n,(m,C)=>{const v=j(m.color,"#111827"),z=U(m),{bg:_,fg:N}=z;return`
    .shade {
      position: fixed; z-index: 2147483000; inset: 0; background: rgba(0,0,0,.55);
      animation: shade-in .3s ease-out both;
    }
    .shade.out { animation: shade-out .22s ease-in both; }
    @keyframes shade-in { from { opacity: 0; } }
    @keyframes shade-out { to { opacity: 0; } }
    .wrap {
      position: fixed; z-index: 2147483001; inset: 0; display: flex; align-items: center; justify-content: center;
      padding: 16px; box-sizing: border-box; pointer-events: none;
    }
    .pop {
      position: relative; box-sizing: border-box; ${B(C)} pointer-events: auto; display: flex; flex-direction: column;
      width: 520px; max-width: 100%; max-height: 100%; overflow: hidden auto; border-radius: 16px;
      background: ${_}; color: ${N}; box-shadow: 0 24px 64px rgba(0,0,0,.32);
      animation: pop-in .4s cubic-bezier(.2,.8,.2,1) both;
    }
    .pop.out { animation: pop-out .22s ease-in both; }
    @keyframes pop-in { from { ${h} } }
    @keyframes pop-out { to { ${h} } }
    @media (prefers-reduced-motion: reduce) { .shade, .pop { animation: none !important; } }

    .media { display: block; flex: none; background: ${z.mute}; }
    .media img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .content { display: flex; flex-direction: column; gap: 12px; padding: 28px; }
    h2 { margin: 0; font-size: 24px; line-height: 1.2; font-weight: 800; letter-spacing: -.01em; }
    .body { margin: 0; white-space: pre-wrap; opacity: .85; font-size: 15px; }
    .extras { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; margin-top: 4px; }
    .code {
      display: inline-flex; align-items: center; gap: 8px; padding: 4px 4px 4px 12px; border: 1.5px dashed currentColor; border-radius: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; letter-spacing: .06em;
    }
    .copy {
      border: 0; border-radius: 6px; padding: 4px 10px; background: ${v}; color: ${a};
      font: 600 12px/1.5 system-ui, -apple-system, sans-serif; letter-spacing: 0; cursor: pointer;
    }
    .time { display: inline-flex; gap: 4px; font-variant-numeric: tabular-nums; }
    .seg {
      display: inline-flex; align-items: baseline; gap: 1px; min-width: 34px; justify-content: center; padding: 4px 6px;
      border-radius: 6px; background: ${z.faint}; font-weight: 700;
    }
    .seg small { font-size: 10px; font-weight: 600; opacity: .7; }
    .cta {
      display: flex; align-items: center; justify-content: center; gap: 6px; padding: 13px 22px; border-radius: 10px;
      background: ${v}; color: ${a}; font-weight: 700; font-size: 15px; text-decoration: none;
      transition: transform .15s, box-shadow .15s;
    }
    .cta:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,.2); }
    .cta:focus-visible, .copy:focus-visible, .x:focus-visible, .whole:focus-visible { outline: 2px solid ${v}; outline-offset: 2px; }
    .x {
      position: absolute; z-index: 2; top: 10px; right: 10px; width: 34px; height: 34px; border: 0; border-radius: 50%;
      background: ${z.chip}; color: ${N}; cursor: pointer; font-size: 16px; line-height: 1;
      box-shadow: 0 1px 4px rgba(0,0,0,.15);
    }
    .x:hover { background: ${z.deep?"#000000aa":"#ffffff"}; }

    /* Layouts */
    .top .media { aspect-ratio: var(--ratio, 16 / 9); max-height: 50vh; }
    .side { width: 760px; flex-direction: row; }
    .side .media { width: 44%; }
    .side .content { flex: 1; justify-content: center; }
    .cover { color: #fff; background: #111827; }
    .cover .media { position: absolute; inset: 0; }
    .cover .media::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.1) 20%, rgba(0,0,0,.72)); }
    .cover .content { position: relative; justify-content: flex-end; min-height: 360px; padding-top: 80px; }
    .cover .x { background: #00000066; color: #fff; }
    .image { width: auto; max-width: min(720px, 100%); background: transparent; }
    .image .media { background: transparent; }
    .image .media img { width: auto; max-width: 100%; max-height: calc(100vh - 32px); object-fit: contain; }
    .whole { display: block; }

    /* Sizes */
    :host(.full) .wrap { padding: 0; }
    :host(.full) .pop { width: 100%; height: 100%; max-width: none; border-radius: 0; }
    :host(.full) .top .media { flex: 1; max-height: none; aspect-ratio: auto; }
    :host(.full) .top .content, :host(.full) .text .content { max-width: 640px; margin: 0 auto; width: 100%; box-sizing: border-box; }
    :host(.full) .text { justify-content: center; }
    :host(.full) .side .media { width: 50%; }
    :host(.full) .side .content { padding: 48px; }
    :host(.full) .cover .content { min-height: 0; flex: 1; padding: 48px; max-width: 760px; }
    :host(.full) .image { background: #000; align-items: center; justify-content: center; }
    :host(.full) h2 { font-size: 34px; }
    :host(.corner) .wrap { inset: auto 0 0 0; justify-content: ${r?"flex-start":"flex-end"}; align-items: flex-end; }
    :host(.corner) .pop { width: 360px; border-radius: 14px; max-height: calc(100vh - 32px); }
    :host(.corner) .side { width: 360px; flex-direction: column; }
    :host(.corner) .side .media { width: 100%; aspect-ratio: 16 / 9; }
    :host(.corner) .content { padding: 20px; gap: 10px; }
    :host(.corner) .cover .content { min-height: 240px; }
    :host(.corner) h2 { font-size: 18px; }
    :host(.corner) .body { font-size: 14px; }

    @media (max-width: 600px) {
      :host(.modal) .wrap, :host(.corner) .wrap { padding: 0; align-items: flex-end; }
      :host(.modal) .pop, :host(.corner) .pop { width: 100%; max-height: 88vh; border-radius: 16px 16px 0 0; }
      :host(.modal) .image { width: auto; border-radius: 16px; margin: 0 12px 12px; }
      .side, :host(.full) .side { flex-direction: column; }
      .side .media, :host(.full) .side .media { width: 100%; aspect-ratio: 16 / 9; flex: none; }
      .content, :host(.full) .side .content, :host(.full) .cover .content { padding: 22px; }
      .cover .content { min-height: 300px; }
      h2, :host(.full) h2 { font-size: 21px; }
    }
  `});y.className=i;const l=o("div",{class:`pop ${u}`,part:"box",role:"dialog","aria-modal":i==="corner"?"false":"true","aria-label":e.title||e.image?.alt||e.name||"Offer"});e.image?.width&&e.image?.height&&l.style.setProperty("--ratio",`${e.image.width} / ${e.image.height}`);const $=P(e.link_url),b=()=>{t.click(),A()},d=k?o("img",{src:k,alt:e.image.alt||"",decoding:"async",width:e.image.width,height:e.image.height}):null;d&&l.append(o("div",{class:"media"},[u==="image"&&$?o("a",{class:"whole",href:$,onclick:b,"aria-label":e.image.alt||e.link_label||"Open offer"},[d]):d]));let f=null;if(u!=="image"){const m=o("div",{class:"content"});e.title&&m.append(o("h2",{part:"title",text:e.title})),e.body&&m.append(o("p",{class:"body",text:e.body}));const C=o("div",{class:"extras"});if(e.coupon){const v=o("button",{class:"copy",type:"button",text:"Copy","aria-label":`Copy code ${e.coupon}`});v.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(e.coupon),t.copy?.(),v.textContent="Copied \u2713",setTimeout(()=>{v.textContent="Copy"},2e3)}catch{}}),C.append(o("span",{class:"code"},[o("span",{text:e.coupon}),v]))}if(e.countdown&&e.ends_at&&R(e.ends_at)){const v=o("span",{class:"time",role:"timer","aria-live":"off"}),z=T=>String(T).padStart(2,"0"),_=(T,V)=>o("span",{class:"seg"},[document.createTextNode(T),o("small",{text:V})]),N=()=>{const T=R(e.ends_at);if(!T)return clearInterval(f),v.remove();v.replaceChildren(...T.d?[_(T.d,"d")]:[],_(z(T.h),"h"),_(z(T.m),"m"),_(z(T.s),"s"))};N(),f=setInterval(N,1e3),C.append(v)}C.childNodes.length&&m.append(C),$&&e.link_label&&m.append(o("a",{class:"cta",part:"button",href:$,onclick:b},[o("span",{text:e.link_label}),o("span",{"aria-hidden":"true",text:"\u2192"})])),l.append(m)}l.append(o("button",{class:"x",type:"button","aria-label":"Close",title:"Close",text:"\u2715",onclick:()=>A()}));const w=i==="corner"?null:o("div",{class:"shade",onclick:()=>A()}),E=o("div",{class:"wrap"},[l]);w&&E.addEventListener("click",m=>{m.target===E&&A()}),E.style.pointerEvents=w?"auto":"";const x=m=>{if(m.key==="Escape"&&(i!=="corner"||m.composedPath().includes(y))&&A(),m.key!=="Tab"||i==="corner")return;const C=[...l.querySelectorAll("button, a[href]")],v=C[0],z=C[C.length-1],_=g.activeElement;(m.shiftKey?_===v||!l.contains(_):_===z||!l.contains(_))&&(m.preventDefault(),(m.shiftKey?z:v).focus())};let s=null,S=null,p="waiting";function c(){p==="waiting"&&(p="open",s=document.activeElement,w&&g.append(w),g.append(E),document.body.append(y),M.update(),i!=="corner"&&(S=document.documentElement.style.overflow,document.documentElement.style.overflow="hidden",l.querySelector(".x").focus({preventScroll:!0})),document.addEventListener("keydown",x,!0),t.shown?.())}function L(){p="gone",clearInterval(f),document.removeEventListener("keydown",x,!0),S!==null&&(document.documentElement.style.overflow=S),S=null,M.stop(),y.remove()}function A(){if(p!=="open")return L();p="closing",t.close(),l.classList.add("out"),w?.classList.add("out"),i!=="corner"&&s?.focus?.({preventScroll:!0}),setTimeout(L,matchMedia("(prefers-reduced-motion: reduce)").matches||e.animation==="none"?0:230)}if(d){const m=d.decode?d.decode():new Promise((v,z)=>{d.onload=v,d.onerror=z}),C=setTimeout(c,3e3);m.then(()=>{clearTimeout(C),c()},()=>{if(clearTimeout(C),u==="image")return L(),t.failed?.();d.parentElement?.remove(),u="text",l.className="pop text",c()})}else c();return L}
