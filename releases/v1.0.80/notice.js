const H=/^#[0-9a-f]{6}$/i,N=(e,o)=>H.test(e||"")?e:o,P="#111827",R="#f9fafb",U=e=>{const[o,i,n]=[1,3,5].map(r=>{const a=parseInt(e.slice(r,r+2),16)/255;return a<=.03928?a/12.92:((a+.055)/1.055)**2.4});return .2126*o+.7152*i+.0722*n},W=(e,o)=>{const[i,n]=[U(e),U(o)].sort((r,a)=>a-r);return(i+.05)/(n+.05)},J=e=>W(e,P)>=W(e,R)?P:R,X=e=>{const o=H.test(e.background||"")?e.background:"";if(!o)return e.theme==="dark"?{deep:!0,bg:P,fg:R,line:"#374151",faint:"#1f2937",fieldLine:"#4b5563",field:"#1f2937",mute:"#1f2937",chip:"#00000066"}:{deep:!1,bg:"#ffffff",fg:P,line:"#e5e7eb",faint:"#f3f4f6",fieldLine:"#d1d5db",field:"#ffffff",mute:"#f3f4f6",chip:"#ffffffcc"};const i=J(o),n=i===R;return{deep:n,bg:o,fg:i,line:n?"rgba(255,255,255,.22)":"rgba(0,0,0,.14)",faint:n?"rgba(255,255,255,.10)":"rgba(0,0,0,.06)",fieldLine:n?"rgba(255,255,255,.34)":"rgba(0,0,0,.24)",field:n?"rgba(255,255,255,.08)":"rgba(255,255,255,.72)",mute:n?"rgba(255,255,255,.12)":"rgba(0,0,0,.07)",chip:n?"rgba(0,0,0,.4)":"rgba(255,255,255,.85)"}},Y=e=>/^https?:\/\//i.test(e||"")?e:"",D='font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;',t=(e,o={},i=[])=>{const n=document.createElement(e);for(const[r,a]of Object.entries(o))a===void 0||a===!1||(r==="text"?n.textContent=a:r.startsWith("on")?n.addEventListener(r.slice(2),a):n.setAttribute(r,a===!0?"":a));for(const r of i)n.append(r);return n};function B(e){const o=document.createElement("div");o.setAttribute("data-noanalytics","");const i=o.attachShadow({mode:"open"});return i.append(t("style",{text:`:host { all: initial; } [hidden] { display: none !important; } ${e}`})),{host:o,root:i}}function K(e){const o=new Date(e).getTime()-Date.now();if(!(o>0))return null;const i=Math.floor(o/1e3);return{d:Math.floor(i/86400),h:Math.floor(i%86400/3600),m:Math.floor(i%3600/60),s:i%60}}const F="--analytics-notice-bottom";export function renderBar(e,o){if(e.countdown&&e.ends_at&&!K(e.ends_at))return null;const i=e.look||{},n=N(i.color,"#111827"),r=N(i.text_color,"#ffffff"),a=i.position==="bottom",{host:u,root:S}=B(`
    .bar {
      box-sizing: border-box; ${D} display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
      gap: 8px 16px; width: 100%; padding: 10px 48px; background: ${n}; color: ${r}; text-align: center; position: relative;
      ${a?"position: fixed; z-index: 2147482000; left: 0; right: 0; bottom: 0; box-shadow: 0 -6px 24px rgba(0,0,0,.14); animation: up .35s ease-out;":"animation: down .35s ease-out;"}
    }
    @keyframes down { from { transform: translateY(-100%); opacity: 0; } }
    @keyframes up { from { transform: translateY(100%); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
    .text { font-weight: 600; letter-spacing: .01em; }
    .extras { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 12px; }
    .code {
      display: inline-flex; align-items: center; gap: 6px; padding: 3px 3px 3px 10px; border: 1.5px dashed ${r}aa; border-radius: 7px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; letter-spacing: .06em;
    }
    .copy {
      border: 0; border-radius: 5px; padding: 3px 9px; background: ${r}2e; color: inherit;
      font: 600 12px/1.5 system-ui, -apple-system, sans-serif; letter-spacing: 0; cursor: pointer; transition: background .15s;
    }
    .copy:hover { background: ${r}47; }
    .time { display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
    .time-label { margin-right: 2px; font-size: 12px; opacity: .85; }
    .seg {
      display: inline-flex; align-items: baseline; gap: 1px; min-width: 30px; justify-content: center; padding: 3px 5px;
      border-radius: 5px; background: ${r}24; font-weight: 700;
    }
    .seg small { font-size: 10px; font-weight: 600; opacity: .8; }
    .cta {
      display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 7px; background: ${r}; color: ${n};
      font-weight: 700; text-decoration: none; white-space: nowrap; transition: transform .15s, box-shadow .15s;
    }
    .cta:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.18); }
    .cta:focus-visible, .copy:focus-visible, .x:focus-visible { outline: 2px solid ${r}; outline-offset: 2px; }
    .x {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; border: 0; border-radius: 50%;
      background: none; color: inherit; opacity: .7; cursor: pointer; font-size: 16px; line-height: 1;
    }
    .x:hover { opacity: 1; background: ${r}1f; }
    @media (max-width: 600px) {
      .bar { gap: 8px; padding: 9px 40px 9px 14px; font-size: 13px; }
      .x { right: 4px; top: 6px; transform: none; }
      .time-label { display: none; }
      .seg { min-width: 26px; padding: 2px 4px; }
      .cta { padding: 6px 12px; }
    }
  `),p=t("div",{class:"bar",role:"region","aria-label":e.name||"Announcement"});p.append(t("span",{class:"text",text:e.text||""}));const c=t("span",{class:"extras"});if(e.coupon){const f=t("button",{class:"copy",type:"button",text:"Copy","aria-label":`Copy code ${e.coupon}`});f.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(e.coupon),o.copy?.(),f.textContent="Copied \u2713",setTimeout(()=>{f.textContent="Copy"},2e3)}catch{}}),c.append(t("span",{class:"code"},[t("span",{text:e.coupon}),f]))}let _=null,w=null;if(e.countdown&&e.ends_at){const f=t("span",{class:"time",role:"timer","aria-live":"off"}),s=l=>String(l).padStart(2,"0"),g=(l,L)=>t("span",{class:"seg"},[document.createTextNode(l),t("small",{text:L})]),$=()=>{const l=K(e.ends_at);if(!l)return h();f.replaceChildren(t("span",{class:"time-label",text:"Ends in"}),...l.d?[g(l.d,"d")]:[],g(s(l.h),"h"),g(s(l.m),"m"),g(s(l.s),"s"))};$(),_=setInterval($,1e3),c.append(f)}const A=Y(e.link_url);A&&e.link_label&&c.append(t("a",{class:"cta",href:A,onclick:()=>o.click()},[t("span",{text:e.link_label}),t("span",{"aria-hidden":"true",text:"\u2192"})])),c.childNodes.length&&p.append(c),e.dismissible!==!1&&p.append(t("button",{class:"x",type:"button","aria-label":"Close",title:"Close",text:"\u2715",onclick:()=>{h(),o.close()}})),S.append(p);function h(){clearInterval(_),w?.disconnect(),u.remove(),a&&(document.body.style.removeProperty("padding-bottom"),document.documentElement.style.removeProperty(F))}if(a){document.body.append(u);const f=parseFloat(getComputedStyle(document.body).paddingBottom)||0;w=new ResizeObserver(()=>{const s=p.offsetHeight;document.body.style.paddingBottom=`${f+s}px`,document.documentElement.style.setProperty(F,`${s}px`)}),w.observe(p)}else document.body.prepend(u);return h}const Q=()=>{const e=document.createElementNS("http://www.w3.org/2000/svg","svg");e.setAttribute("viewBox","0 0 16 16"),e.setAttribute("fill","currentColor"),e.setAttribute("aria-hidden","true");const o=document.createElementNS("http://www.w3.org/2000/svg","path");return o.setAttribute("d","M7.66 1.3a.36.36 0 0 1 .68 0l1.1 3.2a2 2 0 0 0 1.24 1.25l3.2 1.1a.36.36 0 0 1 0 .68l-3.2 1.1a2 2 0 0 0-1.24 1.24l-1.1 3.2a.36.36 0 0 1-.68 0l-1.1-3.2a2 2 0 0 0-1.25-1.24l-3.2-1.1a.36.36 0 0 1 0-.68l3.2-1.1A2 2 0 0 0 6.56 4.5z"),e.append(o),e};export function renderChangelog(e,o){const i=e.look||{},n=N(i.color,"#2563eb"),r=i.position==="left",a=X(i),{host:u,root:S}=B(`
    .launch {
      position: fixed; z-index: 2147482000; bottom: calc(16px + var(${F}, 0px)); ${r?"left":"right"}: 16px;
      box-sizing: border-box; ${D} display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px 10px 16px;
      border: 0; border-radius: 999px; cursor: pointer; background: ${n}; color: #fff; font-weight: 600;
      box-shadow: 0 6px 20px rgba(0,0,0,.2); transition: transform .15s, box-shadow .15s, bottom .2s;
    }
    .launch:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(0,0,0,.24); }
    .launch:focus-visible { outline: 2px solid ${n}; outline-offset: 3px; }
    .launch svg { width: 16px; height: 16px; }
    .badge {
      min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; background: #fff; color: ${n};
      font-size: 12px; font-weight: 700; line-height: 20px; text-align: center;
    }
    .shade { position: fixed; z-index: 2147483000; inset: 0; background: rgba(0,0,0,.35); animation: fade .25s ease-out; }
    @keyframes fade { from { opacity: 0; } }
    @keyframes slide { from { transform: translateX(${r?"-":""}100%); } }
    @media (prefers-reduced-motion: reduce) { .shade, .panel { animation: none !important; } }
    .panel {
      position: fixed; z-index: 2147483001; top: 0; bottom: 0; ${r?"left":"right"}: 0; width: 400px; max-width: 100%;
      box-sizing: border-box; display: flex; flex-direction: column; ${D}
      background: ${a.bg}; color: ${a.fg}; box-shadow: 0 0 40px rgba(0,0,0,.25);
      animation: slide .3s cubic-bezier(.2,.8,.2,1);
    }
    .head { border-top: 4px solid ${n}; }
    .head { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid ${a.line}; }
    .title { flex: 1; margin: 0; font-size: 18px; font-weight: 700; }
    .x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; font-size: 18px; line-height: 1; padding: 4px; }
    .x:hover, .x:focus-visible { opacity: 1; }
    .list { flex: 1; overflow-y: auto; margin: 0; padding: 4px 20px 20px; list-style: none; }
    .entry { padding: 16px 0; border-bottom: 1px solid ${a.faint}; }
    .entry:last-child { border-bottom: 0; }
    .meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; opacity: .7; }
    .label { padding: 1px 8px; border-radius: 999px; background: ${n}22; color: ${a.deep?"#fff":n}; font-weight: 700; opacity: 1; }
    .new { width: 8px; height: 8px; border-radius: 50%; background: ${n}; }
    .entry h3 { margin: 0 0 4px; font-size: 15px; font-weight: 700; }
    .shot {
      display: block; width: 100%; height: auto; margin: 4px 0 10px; border-radius: 8px;
      border: 1px solid ${a.line}; background: ${a.mute};
    }
    .entry p { margin: 0 0 8px; white-space: pre-wrap; opacity: .85; }
    .more { color: ${a.deep?"#93c5fd":n}; font-weight: 600; text-decoration: none; }
    .more:hover { text-decoration: underline; }
  `),p=new Set(o.unread),c=e.button_text||"What's new",_=t("span",{class:"badge","aria-hidden":"true",hidden:!p.size,text:String(p.size)}),w=e.launcher==="custom"?null:t("button",{class:"launch",type:"button","aria-label":p.size?`${c}, ${p.size} new`:c,onclick:()=>L()},[Q(),t("span",{text:c}),_]);w&&S.append(w);const A=d=>{try{return new Date(d).toLocaleDateString(void 0,{day:"numeric",month:"short",year:"numeric"})}catch{return""}},h=t("div",{class:"shade",hidden:!0,onclick:()=>z()}),f=t("ul",{class:"list"}),s=t("div",{class:"panel",role:"dialog","aria-modal":"true","aria-labelledby":"t",hidden:!0},[t("div",{class:"head"},[t("p",{class:"title",id:"t",text:e.title||"What's new"}),t("button",{class:"x",type:"button","aria-label":"Close",title:"Close",text:"\u2715",onclick:()=>z()})]),f]);S.append(h,s);const g=()=>{f.replaceChildren(...(e.entries||[]).map(d=>{const E=Y(d.link_url),T=d.image?o.imageUrl?.(d.image):"",b=T?t("img",{class:"shot",src:T,alt:d.image.alt||"",loading:"lazy",decoding:"async",width:d.image.width,height:d.image.height,onerror:()=>b.remove()}):null;return t("li",{class:"entry"},[t("div",{class:"meta"},[...p.has(d.id)?[t("span",{class:"new",title:"New"})]:[],...d.label?[t("span",{class:"label",text:d.label})]:[],t("time",{datetime:d.date,text:A(d.date)})]),t("h3",{text:d.title}),...b?[b]:[],...d.body?[t("p",{text:d.body})]:[],...E?[t("a",{class:"more",href:E,target:"_blank",rel:"noopener",text:"Read more \u2192",onclick:()=>o.click()})]:[]])}))},$=d=>{if(d.key==="Escape"&&z(),d.key!=="Tab")return;const E=[...s.querySelectorAll("button, a[href]")],T=E[0],b=E[E.length-1],v=S.activeElement;(d.shiftKey?v===T||!s.contains(v):v===b||!s.contains(v))&&(d.preventDefault(),(d.shiftKey?b:T).focus())};let l=null;function L(){s.hidden&&(l=document.activeElement,g(),h.hidden=!1,s.hidden=!1,s.querySelector(".x").focus({preventScroll:!0}),document.addEventListener("keydown",$,!0),o.opened())}function z(){h.hidden=!0,s.hidden=!0,document.removeEventListener("keydown",$,!0),p.clear(),_.hidden=!0,w?.setAttribute("aria-label",c),(l===u?w:l)?.focus?.({preventScroll:!0})}return document.body.append(u),{open:L,remove:()=>{document.removeEventListener("keydown",$,!0),u.remove()}}}const V={fade:"opacity: 0;",zoom:"opacity: 0; transform: scale(.92);",up:"opacity: 0; transform: translateY(48px);",none:""};export function renderPopup(e,o){const i=e.look||{},n=N(i.color,"#111827"),r=N(i.text_color,"#ffffff"),a=X(i),u=["full","corner"].includes(e.size)?e.size:"modal",S=i.position==="left",p=e.image&&o.image?o.image:"";let c=p?e.layout||"top":"text";const _=e.animation==="side"?`opacity: 0; transform: translateX(${S?"-":""}64px);`:V[e.animation]??V.zoom,{bg:w,fg:A}=a,{host:h,root:f}=B(`
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
      position: relative; box-sizing: border-box; ${D} pointer-events: auto; display: flex; flex-direction: column;
      width: 520px; max-width: 100%; max-height: 100%; overflow: hidden auto; border-radius: 16px;
      background: ${w}; color: ${A}; box-shadow: 0 24px 64px rgba(0,0,0,.32);
      animation: pop-in .4s cubic-bezier(.2,.8,.2,1) both;
    }
    .pop.out { animation: pop-out .22s ease-in both; }
    @keyframes pop-in { from { ${_} } }
    @keyframes pop-out { to { ${_} } }
    @media (prefers-reduced-motion: reduce) { .shade, .pop { animation: none !important; } }

    .media { display: block; flex: none; background: ${a.mute}; }
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
      border: 0; border-radius: 6px; padding: 4px 10px; background: ${n}; color: ${r};
      font: 600 12px/1.5 system-ui, -apple-system, sans-serif; letter-spacing: 0; cursor: pointer;
    }
    .time { display: inline-flex; gap: 4px; font-variant-numeric: tabular-nums; }
    .seg {
      display: inline-flex; align-items: baseline; gap: 1px; min-width: 34px; justify-content: center; padding: 4px 6px;
      border-radius: 6px; background: ${a.faint}; font-weight: 700;
    }
    .seg small { font-size: 10px; font-weight: 600; opacity: .7; }
    .cta {
      display: flex; align-items: center; justify-content: center; gap: 6px; padding: 13px 22px; border-radius: 10px;
      background: ${n}; color: ${r}; font-weight: 700; font-size: 15px; text-decoration: none;
      transition: transform .15s, box-shadow .15s;
    }
    .cta:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,.2); }
    .cta:focus-visible, .copy:focus-visible, .x:focus-visible, .whole:focus-visible { outline: 2px solid ${n}; outline-offset: 2px; }
    .x {
      position: absolute; z-index: 2; top: 10px; right: 10px; width: 34px; height: 34px; border: 0; border-radius: 50%;
      background: ${a.chip}; color: ${A}; cursor: pointer; font-size: 16px; line-height: 1;
      box-shadow: 0 1px 4px rgba(0,0,0,.15);
    }
    .x:hover { background: ${a.deep?"#000000aa":"#ffffff"}; }

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
    :host(.corner) .wrap { inset: auto 0 0 0; justify-content: ${S?"flex-start":"flex-end"}; align-items: flex-end; }
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
  `);h.className=u;const s=t("div",{class:`pop ${c}`,role:"dialog","aria-modal":u==="corner"?"false":"true","aria-label":e.title||e.image?.alt||e.name||"Offer"});e.image?.width&&e.image?.height&&s.style.setProperty("--ratio",`${e.image.width} / ${e.image.height}`);const g=Y(e.link_url),$=()=>{o.click(),M()},l=p?t("img",{src:p,alt:e.image.alt||"",decoding:"async",width:e.image.width,height:e.image.height}):null;l&&s.append(t("div",{class:"media"},[c==="image"&&g?t("a",{class:"whole",href:g,onclick:$,"aria-label":e.image.alt||e.link_label||"Open offer"},[l]):l]));let L=null;if(c!=="image"){const x=t("div",{class:"content"});e.title&&x.append(t("h2",{text:e.title})),e.body&&x.append(t("p",{class:"body",text:e.body}));const y=t("div",{class:"extras"});if(e.coupon){const m=t("button",{class:"copy",type:"button",text:"Copy","aria-label":`Copy code ${e.coupon}`});m.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(e.coupon),o.copy?.(),m.textContent="Copied \u2713",setTimeout(()=>{m.textContent="Copy"},2e3)}catch{}}),y.append(t("span",{class:"code"},[t("span",{text:e.coupon}),m]))}if(e.countdown&&e.ends_at&&K(e.ends_at)){const m=t("span",{class:"time",role:"timer","aria-live":"off"}),j=k=>String(k).padStart(2,"0"),C=(k,G)=>t("span",{class:"seg"},[document.createTextNode(k),t("small",{text:G})]),q=()=>{const k=K(e.ends_at);if(!k)return clearInterval(L),m.remove();m.replaceChildren(...k.d?[C(k.d,"d")]:[],C(j(k.h),"h"),C(j(k.m),"m"),C(j(k.s),"s"))};q(),L=setInterval(q,1e3),y.append(m)}y.childNodes.length&&x.append(y),g&&e.link_label&&x.append(t("a",{class:"cta",href:g,onclick:$},[t("span",{text:e.link_label}),t("span",{"aria-hidden":"true",text:"\u2192"})])),s.append(x)}s.append(t("button",{class:"x",type:"button","aria-label":"Close",title:"Close",text:"\u2715",onclick:()=>M()}));const z=u==="corner"?null:t("div",{class:"shade",onclick:()=>M()}),d=t("div",{class:"wrap"},[s]);z&&d.addEventListener("click",x=>{x.target===d&&M()}),d.style.pointerEvents=z?"auto":"";const E=x=>{if(x.key==="Escape"&&(u!=="corner"||x.composedPath().includes(h))&&M(),x.key!=="Tab"||u==="corner")return;const y=[...s.querySelectorAll("button, a[href]")],m=y[0],j=y[y.length-1],C=f.activeElement;(x.shiftKey?C===m||!s.contains(C):C===j||!s.contains(C))&&(x.preventDefault(),(x.shiftKey?j:m).focus())};let T=null,b=null,v="waiting";function I(){v==="waiting"&&(v="open",T=document.activeElement,z&&f.append(z),f.append(d),document.body.append(h),u!=="corner"&&(b=document.documentElement.style.overflow,document.documentElement.style.overflow="hidden",s.querySelector(".x").focus({preventScroll:!0})),document.addEventListener("keydown",E,!0),o.shown?.())}function O(){v="gone",clearInterval(L),document.removeEventListener("keydown",E,!0),b!==null&&(document.documentElement.style.overflow=b),b=null,h.remove()}function M(){if(v!=="open")return O();v="closing",o.close(),s.classList.add("out"),z?.classList.add("out"),u!=="corner"&&T?.focus?.({preventScroll:!0}),setTimeout(O,matchMedia("(prefers-reduced-motion: reduce)").matches||e.animation==="none"?0:230)}if(l){const x=l.decode?l.decode():new Promise((m,j)=>{l.onload=m,l.onerror=j}),y=setTimeout(I,3e3);x.then(()=>{clearTimeout(y),I()},()=>{if(clearTimeout(y),c==="image")return O(),o.failed?.();l.parentElement?.remove(),c="text",s.className="pop text",I()})}else I();return O}
