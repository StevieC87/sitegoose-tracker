const K={next:"Next",submit:"Send",skip:"Skip",close:"Close",thanks:"Thanks for your feedback!",placeholder:"Type your answer\u2026",yes:"Yes",no:"No",npsLow:"Not likely",npsHigh:"Very likely"},P=/^#[0-9a-f]{6}$/i,A="#111827",S="#f9fafb",U=i=>{const[t,o,n]=[1,3,5].map(r=>{const d=parseInt(i.slice(r,r+2),16)/255;return d<=.03928?d/12.92:((d+.055)/1.055)**2.4});return .2126*t+.7152*o+.0722*n},V=(i,t)=>{const[o,n]=[U(i),U(t)].sort((r,d)=>d-r);return(o+.05)/(n+.05)},X=i=>V(i,A)>=V(i,S)?A:S,B=i=>{const t=P.test(i.background||"")?i.background:"";if(!t)return i.theme==="dark"?{deep:!0,bg:A,fg:S,line:"#374151",faint:"#1f2937",fieldLine:"#4b5563",field:"#1f2937",mute:"#1f2937",chip:"#00000066"}:{deep:!1,bg:"#ffffff",fg:A,line:"#e5e7eb",faint:"#f3f4f6",fieldLine:"#d1d5db",field:"#ffffff",mute:"#f3f4f6",chip:"#ffffffcc"};const o=X(t),n=o===S;return{deep:n,bg:t,fg:o,line:n?"rgba(255,255,255,.22)":"rgba(0,0,0,.14)",faint:n?"rgba(255,255,255,.10)":"rgba(0,0,0,.06)",fieldLine:n?"rgba(255,255,255,.34)":"rgba(0,0,0,.24)",field:n?"rgba(255,255,255,.08)":"rgba(255,255,255,.72)",mute:n?"rgba(255,255,255,.12)":"rgba(0,0,0,.07)",chip:n?"rgba(0,0,0,.4)":"rgba(255,255,255,.85)"}},D=(i,t,o)=>`
  :host { all: initial; ${o==="inline"?"display: block;":""} }
  .wrap {
    box-sizing: border-box;
    ${o==="inline"?"margin: 24px 0;":o==="center"?"position: fixed; z-index: 2147483000; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.35);":"position: fixed; z-index: 2147483000; right: 16px; bottom: 16px; left: 16px; display: flex; justify-content: flex-end; pointer-events: none;"}
    font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .box {
    pointer-events: auto; box-sizing: border-box; width: 100%; max-width: ${o==="inline"?"520px":"360px"}; padding: 18px;
    border-radius: 12px; ${o==="inline"?"":"box-shadow: 0 10px 30px rgba(0,0,0,.2);"}
    background: ${t.bg}; color: ${t.fg};
    border: 1px solid ${t.line};
  }
  .head { display: flex; align-items: flex-start; gap: 12px; }
  .q { flex: 1; margin: 0 0 14px; font-size: 16px; font-weight: 600; }
  .x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; font-size: 18px; line-height: 1; padding: 2px; }
  .x:hover, .x:focus-visible { opacity: 1; }
  .opts { display: flex; flex-direction: column; gap: 8px; }
  .opts.row { flex-direction: row; }
  .opts.row .opt { flex: 0 1 120px; justify-content: center; }
  .opt {
    display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 8px; cursor: pointer;
    border: 1px solid ${t.fieldLine}; background: none; color: inherit; font: inherit; text-align: left;
  }
  .opt:hover, .opt:focus-visible, .opt.on { border-color: ${i}; outline: none; }
  .opt.on { background: ${i}22; }
  .scale { display: flex; flex-wrap: wrap; gap: 6px; }
  .scale .opt { justify-content: center; min-width: 32px; padding: 8px 0; flex: 1 0 32px; }
  .ends { display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; opacity: .7; }
  textarea {
    box-sizing: border-box; width: 100%; min-height: 80px; padding: 9px 12px; border-radius: 8px; resize: vertical;
    border: 1px solid ${t.fieldLine}; background: none; color: inherit; font: inherit;
  }
  textarea:focus { outline: none; border-color: ${i}; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 14px; }
  .dots { display: flex; gap: 4px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: ${t.fieldLine}; }
  .dot.on { background: ${i}; }
  .actions { display: flex; gap: 8px; margin-left: auto; }
  .btn { border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; font: inherit; font-weight: 600; background: ${i}; color: #fff; }
  .btn[disabled] { opacity: .45; cursor: default; }
  .link { border: 0; background: none; color: inherit; opacity: .7; cursor: pointer; font: inherit; }
  .thanks { margin: 4px 0; font-weight: 600; }
`,s=(i,t={},o=[])=>{const n=document.createElement(i);for(const[r,d]of Object.entries(t))r==="text"?n.textContent=d:r.startsWith("on")?n.addEventListener(r.slice(2),d):n.setAttribute(r,d);for(const r of o)n.append(r);return n};function W(i,t){for(const o of i.logic||[])if(Array.isArray(t)?o.op==="is"&&t.includes(o.value):o.op==="is"?String(t)===o.value:typeof t=="number"&&(o.op==="lte"?t<=Number(o.value):t>=Number(o.value)))return o.to;return null}export function renderSurvey(i,t,o=null){const n={...K,...i.texts||{}},r=i.look||{},d=/^#[0-9a-f]{3,8}$/i.test(r.color||"")?r.color:"#2563eb",b=(i.questions||[]).filter(e=>e&&e.id&&e.text);if(!b.length)return t.done(),()=>{};const x=!!o,C=x?"inline":r.position,y=document.createElement("div");y.setAttribute("data-noanalytics","");const N=y.attachShadow({mode:"open"});N.append(s("style",{text:D(d,B(r),C)}));const q=x?s("section",{class:"box","aria-labelledby":"q"}):s("div",{class:"box",role:"dialog","aria-modal":C==="center"?"true":"false","aria-labelledby":"q"});N.append(s("div",{class:"wrap"},[q])),(o||document.body).append(y);let g=0,T=!1,w=!1,L=null;if(x){const e=()=>{L?.disconnect(),t.shown?.()};typeof IntersectionObserver=="function"?(L=new IntersectionObserver(a=>a.some(h=>h.isIntersecting)&&e()),L.observe(y)):e()}const z=()=>{w=!0,L?.disconnect(),document.removeEventListener("keydown",O,!0),y.remove()},j=()=>{w||(z(),t.close(T))},O=e=>{e.key==="Escape"&&j()};x||document.addEventListener("keydown",O,!0);const _=()=>{t.complete(),q.replaceChildren(s("p",{class:"thanks",role:"status",text:n.thanks})),!x&&setTimeout(()=>{w||(z(),t.done())},2500)},H=(e=null)=>{const a=e&&e!=="end"?b.findIndex(h=>h.id===e):-1;g=e==="end"?b.length:a>g?a:g+1,g>=b.length?_():R()};function R(){const e=b[g];let a=e.type==="multi"?[]:null;const h=g===b.length-1,m=s("button",{class:"btn",type:"button",text:h?n.submit:n.next}),v=l=>{a=l,m.disabled=a===null||a===""||Array.isArray(a)&&!a.length};v(a);let p;if(e.type==="choice"||e.type==="multi"||e.type==="yesno"){const l=e.type==="yesno"?[["yes",n.yes],["no",n.no]]:(e.options||[]).map(c=>[c,c]);p=s("div",{class:"opts",role:e.type==="multi"?"group":"radiogroup","aria-labelledby":"q"});for(const[c,k]of l){const f=s("button",{class:"opt",type:"button","aria-pressed":"false",text:k});f.addEventListener("click",()=>{if(e.type==="multi"){const u=a.includes(c)?a.filter(E=>E!==c):[...a,c];f.classList.toggle("on",u.includes(c)),f.setAttribute("aria-pressed",String(u.includes(c))),v(u)}else{for(const u of p.children)u.classList.remove("on"),u.setAttribute("aria-pressed","false");f.classList.add("on"),f.setAttribute("aria-pressed","true"),v(c)}}),p.append(f)}}else if(e.type==="rating"||e.type==="nps"){const l=e.type==="nps"?0:1,c=e.type==="nps"||e.scale===10?10:5,k=s("div",{class:"scale",role:"radiogroup","aria-labelledby":"q"});for(let f=l;f<=c;f++){const u=s("button",{class:"opt",type:"button","aria-pressed":"false",text:String(f)});u.addEventListener("click",()=>{for(const E of k.children)E.classList.remove("on"),E.setAttribute("aria-pressed","false");u.classList.add("on"),u.setAttribute("aria-pressed","true"),v(f)}),k.append(u)}p=s("div",{},[k]),e.type==="nps"&&p.append(s("div",{class:"ends"},[s("span",{text:n.npsLow}),s("span",{text:n.npsHigh})]))}else{const l=s("textarea",{"aria-labelledby":"q",placeholder:n.placeholder,maxlength:"1000"});l.addEventListener("input",()=>v(l.value.trim())),p=l}const $=x&&e.type==="yesno";if($){p.classList.add("row");for(const l of p.children)l.addEventListener("click",()=>m.click())}m.addEventListener("click",()=>{m.disabled||(T=!0,t.answer(e.id,a).then(l=>{l===403&&j()}),H(W(e,a)))});const F=s("div",{class:"dots","aria-hidden":"true"},b.length>1?b.map((l,c)=>s("span",{class:`dot${c<=g?" on":""}`})):[]),I=s("div",{class:"actions"});!e.required&&!$&&I.append(s("button",{class:"link",type:"button",text:n.skip,onclick:()=>H()})),$||I.append(m),q.replaceChildren(s("div",{class:"head"},[s("p",{class:"q",id:"q",text:e.text}),...x?[]:[s("button",{class:"x",type:"button","aria-label":n.close,title:n.close,text:"\u2715",onclick:j})]]),p,...$?[]:[s("div",{class:"foot"},[x?s("span"):F,I])]),r.position==="center"&&(p.querySelector?.("button, textarea")||p).focus?.({preventScroll:!0})}return R(),()=>{w||z()}}
