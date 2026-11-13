const U={next:"Next",submit:"Send",skip:"Skip",close:"Close",thanks:"Thanks for your feedback!",placeholder:"Type your answer\u2026",yes:"Yes",no:"No",npsLow:"Not likely",npsHigh:"Very likely"},_=(a,n,o)=>`
  :host { all: initial; ${o==="inline"?"display: block;":""} }
  .wrap {
    box-sizing: border-box;
    ${o==="inline"?"margin: 24px 0;":o==="center"?"position: fixed; z-index: 2147483000; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.35);":"position: fixed; z-index: 2147483000; right: 16px; bottom: 16px; left: 16px; display: flex; justify-content: flex-end; pointer-events: none;"}
    font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .box {
    pointer-events: auto; box-sizing: border-box; width: 100%; max-width: ${o==="inline"?"520px":"360px"}; padding: 18px;
    border-radius: 12px; ${o==="inline"?"":"box-shadow: 0 10px 30px rgba(0,0,0,.2);"}
    background: ${n?"#111827":"#ffffff"}; color: ${n?"#f9fafb":"#111827"};
    border: 1px solid ${n?"#374151":"#e5e7eb"};
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
    border: 1px solid ${n?"#4b5563":"#d1d5db"}; background: none; color: inherit; font: inherit; text-align: left;
  }
  .opt:hover, .opt:focus-visible, .opt.on { border-color: ${a}; outline: none; }
  .opt.on { background: ${a}22; }
  .scale { display: flex; flex-wrap: wrap; gap: 6px; }
  .scale .opt { justify-content: center; min-width: 32px; padding: 8px 0; flex: 1 0 32px; }
  .ends { display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; opacity: .7; }
  textarea {
    box-sizing: border-box; width: 100%; min-height: 80px; padding: 9px 12px; border-radius: 8px; resize: vertical;
    border: 1px solid ${n?"#4b5563":"#d1d5db"}; background: none; color: inherit; font: inherit;
  }
  textarea:focus { outline: none; border-color: ${a}; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 14px; }
  .dots { display: flex; gap: 4px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: ${n?"#4b5563":"#d1d5db"}; }
  .dot.on { background: ${a}; }
  .actions { display: flex; gap: 8px; margin-left: auto; }
  .btn { border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; font: inherit; font-weight: 600; background: ${a}; color: #fff; }
  .btn[disabled] { opacity: .45; cursor: default; }
  .link { border: 0; background: none; color: inherit; opacity: .7; cursor: pointer; font: inherit; }
  .thanks { margin: 4px 0; font-weight: 600; }
`,t=(a,n={},o=[])=>{const s=document.createElement(a);for(const[d,y]of Object.entries(n))d==="text"?s.textContent=y:d.startsWith("on")?s.addEventListener(d.slice(2),y):s.setAttribute(d,y);for(const d of o)s.append(d);return s};function B(a,n){for(const o of a.logic||[])if(Array.isArray(n)?o.op==="is"&&n.includes(o.value):o.op==="is"?String(n)===o.value:typeof n=="number"&&(o.op==="lte"?n<=Number(o.value):n>=Number(o.value)))return o.to;return null}export function renderSurvey(a,n,o=null){const s={...U,...a.texts||{}},d=a.look||{},y=/^#[0-9a-f]{3,8}$/i.test(d.color||"")?d.color:"#2563eb",u=(a.questions||[]).filter(e=>e&&e.id&&e.text);if(!u.length)return n.done(),()=>{};const x=!!o,j=x?"inline":d.position,g=document.createElement("div");g.setAttribute("data-noanalytics","");const T=g.attachShadow({mode:"open"});T.append(t("style",{text:_(y,d.theme==="dark",j)}));const E=x?t("section",{class:"box","aria-labelledby":"q"}):t("div",{class:"box",role:"dialog","aria-modal":j==="center"?"true":"false","aria-labelledby":"q"});T.append(t("div",{class:"wrap"},[E])),(o||document.body).append(g);let b=0,C=!1,w=!1,L=null;if(x){const e=()=>{L?.disconnect(),n.shown?.()};typeof IntersectionObserver=="function"?(L=new IntersectionObserver(i=>i.some(h=>h.isIntersecting)&&e()),L.observe(g)):e()}const S=()=>{w=!0,L?.disconnect(),document.removeEventListener("keydown",I,!0),g.remove()},q=()=>{w||(S(),n.close(C))},I=e=>{e.key==="Escape"&&q()};x||document.addEventListener("keydown",I,!0);const V=()=>{n.complete(),E.replaceChildren(t("p",{class:"thanks",role:"status",text:s.thanks})),!x&&setTimeout(()=>{w||(S(),n.done())},2500)},N=(e=null)=>{const i=e&&e!=="end"?u.findIndex(h=>h.id===e):-1;b=e==="end"?u.length:i>b?i:b+1,b>=u.length?V():O()};function O(){const e=u[b];let i=e.type==="multi"?[]:null;const h=b===u.length-1,m=t("button",{class:"btn",type:"button",text:h?s.submit:s.next}),v=r=>{i=r,m.disabled=i===null||i===""||Array.isArray(i)&&!i.length};v(i);let p;if(e.type==="choice"||e.type==="multi"||e.type==="yesno"){const r=e.type==="yesno"?[["yes",s.yes],["no",s.no]]:(e.options||[]).map(l=>[l,l]);p=t("div",{class:"opts",role:e.type==="multi"?"group":"radiogroup","aria-labelledby":"q"});for(const[l,k]of r){const c=t("button",{class:"opt",type:"button","aria-pressed":"false",text:k});c.addEventListener("click",()=>{if(e.type==="multi"){const f=i.includes(l)?i.filter(A=>A!==l):[...i,l];c.classList.toggle("on",f.includes(l)),c.setAttribute("aria-pressed",String(f.includes(l))),v(f)}else{for(const f of p.children)f.classList.remove("on"),f.setAttribute("aria-pressed","false");c.classList.add("on"),c.setAttribute("aria-pressed","true"),v(l)}}),p.append(c)}}else if(e.type==="rating"||e.type==="nps"){const r=e.type==="nps"?0:1,l=e.type==="nps"||e.scale===10?10:5,k=t("div",{class:"scale",role:"radiogroup","aria-labelledby":"q"});for(let c=r;c<=l;c++){const f=t("button",{class:"opt",type:"button","aria-pressed":"false",text:String(c)});f.addEventListener("click",()=>{for(const A of k.children)A.classList.remove("on"),A.setAttribute("aria-pressed","false");f.classList.add("on"),f.setAttribute("aria-pressed","true"),v(c)}),k.append(f)}p=t("div",{},[k]),e.type==="nps"&&p.append(t("div",{class:"ends"},[t("span",{text:s.npsLow}),t("span",{text:s.npsHigh})]))}else{const r=t("textarea",{"aria-labelledby":"q",placeholder:s.placeholder,maxlength:"1000"});r.addEventListener("input",()=>v(r.value.trim())),p=r}const $=x&&e.type==="yesno";if($){p.classList.add("row");for(const r of p.children)r.addEventListener("click",()=>m.click())}m.addEventListener("click",()=>{m.disabled||(C=!0,n.answer(e.id,i).then(r=>{r===403&&q()}),N(B(e,i)))});const H=t("div",{class:"dots","aria-hidden":"true"},u.length>1?u.map((r,l)=>t("span",{class:`dot${l<=b?" on":""}`})):[]),z=t("div",{class:"actions"});!e.required&&!$&&z.append(t("button",{class:"link",type:"button",text:s.skip,onclick:()=>N()})),$||z.append(m),E.replaceChildren(t("div",{class:"head"},[t("p",{class:"q",id:"q",text:e.text}),...x?[]:[t("button",{class:"x",type:"button","aria-label":s.close,title:s.close,text:"\u2715",onclick:q})]]),p,...$?[]:[t("div",{class:"foot"},[x?t("span"):H,z])]),d.position==="center"&&(p.querySelector?.("button, textarea")||p).focus?.({preventScroll:!0})}return O(),()=>{w||S()}}
