const w={button:"Subscribe",thanks:"Thanks! You're on the list.",next:"Next",back:"Back",close:"Close",download:"Download"},me=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,fe=(o,s,r)=>`
  :host { all: initial; }
  [hidden] { display: none !important; }
  .wrap {
    box-sizing: border-box; font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    ${r==="center"?"position: fixed; z-index: 2147483000; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,.35);":""}
    ${r==="corner"?"position: fixed; z-index: 2147483000; right: 16px; bottom: 16px; left: 16px; display: flex; justify-content: flex-end; pointer-events: none;":""}
  }
  .box {
    pointer-events: auto; box-sizing: border-box; width: 100%; max-width: ${r==="inline"?"480px":"380px"}; padding: 20px;
    border-radius: 12px; ${r==="inline"?"":"box-shadow: 0 10px 30px rgba(0,0,0,.2);"}
    background: ${s?"#111827":"#ffffff"}; color: ${s?"#f9fafb":"#111827"};
    border: 1px solid ${s?"#374151":"#e5e7eb"};
  }
  .head { display: flex; align-items: flex-start; gap: 12px; }
  .title { flex: 1; margin: 0 0 6px; font-size: 18px; font-weight: 700; }
  .desc { margin: 0 0 14px; opacity: .8; }
  .x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; font-size: 18px; line-height: 1; padding: 2px; }
  .x:hover, .x:focus-visible { opacity: 1; }
  form { display: flex; flex-direction: column; gap: 12px; margin: 0; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 14px; font-weight: 600; }
  input, select, textarea {
    box-sizing: border-box; width: 100%; padding: 9px 12px; border-radius: 8px; font: inherit; font-weight: 400;
    border: 1px solid ${s?"#4b5563":"#d1d5db"}; background: ${s?"#1f2937":"#fff"}; color: inherit;
  }
  textarea { min-height: 80px; resize: vertical; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: ${o}; box-shadow: 0 0 0 3px ${o}33; }
  [aria-invalid=true] { border-color: #dc2626; }
  .check { flex-direction: row; align-items: flex-start; gap: 8px; font-weight: 400; font-size: 13px; }
  .check input { width: auto; margin: 2px 0 0; }
  .field { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .cap { font-weight: 600; }
  .group { display: flex; flex-direction: column; gap: 6px; }
  .group[aria-invalid=true] { border: 0; }
  .group[aria-invalid=true] .check span { color: #dc2626; }
  .range { display: flex; align-items: center; gap: 10px; }
  .range input { padding: 0; }
  .out { flex: none; min-width: 3.5em; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  .step { display: flex; align-items: center; gap: 6px; }
  .step input { text-align: center; }
  .step button { flex: none; width: 38px; height: 38px; padding: 0; border-radius: 8px; cursor: pointer; font: inherit; font-size: 18px; font-weight: 600;
    border: 1px solid ${s?"#4b5563":"#d1d5db"}; background: ${s?"#1f2937":"#fff"}; color: inherit; }
  .step button:hover { border-color: ${o}; }
  .seg { flex-direction: row; flex-wrap: wrap; }
  .seg .check { padding: 8px 12px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;
    border: 1px solid ${s?"#4b5563":"#d1d5db"}; }
  .seg .check input { position: absolute; width: 1px; height: 1px; opacity: 0; }
  .seg .check.on { border-color: ${o}; box-shadow: 0 0 0 2px ${o}33; }
  .seg .check:focus-within { outline: 2px solid ${o}; outline-offset: 2px; }
  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .err { margin: 0; color: #dc2626; font-size: 13px; }
  .foot { display: flex; align-items: center; gap: 8px; }
  .dots { display: flex; gap: 4px; margin-right: auto; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: ${s?"#4b5563":"#d1d5db"}; }
  .dot.on { background: ${o}; }
  .btn { margin-left: auto; border: 0; border-radius: 8px; padding: 10px 16px; cursor: pointer; font: inherit; font-weight: 600; background: ${o}; color: #fff; text-decoration: none; display: inline-block; }
  .btn[disabled] { opacity: .5; cursor: default; }
  .link { border: 0; background: none; color: inherit; opacity: .7; cursor: pointer; font: inherit; }
  .thanks { margin: 0 0 12px; font-weight: 600; }
  .box.pic { padding: 0; overflow: hidden auto; max-height: calc(100vh - 32px); }
  .box.pic .main { padding: 20px; }
  .media { background: ${s?"#1f2937":"#f3f4f6"}; }
  .media img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .top .media { aspect-ratio: var(--ratio, 16 / 9); max-height: ${r==="center"?"240px":"160px"}; }
  .side { display: flex; max-width: 720px; }
  .side .media { width: 44%; flex: none; }
  .side .main { flex: 1; align-self: center; }
  @media (max-width: 600px) {
    .side { flex-direction: column; }
    .side .media { width: 100%; aspect-ratio: 16 / 9; max-height: 160px; }
  }
`,n=(o,s={},r=[])=>{const b=document.createElement(o);for(const[c,m]of Object.entries(s))m===void 0||m===!1||(c==="text"?b.textContent=m:c.startsWith("on")?b.addEventListener(c.slice(2),m):b.setAttribute(c,m===!0?"":m));for(const c of r)b.append(c);return b},ge={email:"email",phone:"tel",name:"text",text:"text",number:"number",date:"date",url:"url"},ye={email:"email",phone:"tel",name:"name",url:"url"},se=["radio","multi"],we=/^\d{4}-\d{2}-\d{2}$/,ve=/^-?\d+(\.\d+)?$/,ke={letters:[/^[\p{L}\s'-]+$/u,"Please use letters only."],digits:[/^\d+$/,"Please use digits only."],alnum:[/^[\p{L}\d\s'-]+$/u,"Please use letters and digits only."],postcode:[/^[A-Za-z\d][A-Za-z\d\s-]*$/,"Please enter a valid postcode."]},$e=o=>{try{const{protocol:s}=new URL(o);return s==="http:"||s==="https:"}catch{return!1}},Se=o=>{if(!we.test(o))return!1;const s=new Date(`${o}T00:00:00Z`);return!Number.isNaN(s.getTime())&&s.toISOString().slice(0,10)===o};export function renderLeadForm(o,s,r){const b={...w,button:o.button||w.button,thanks:o.thanks||w.thanks},c=o.look||{},m=/^#[0-9a-f]{6}$/i.test(c.color||"")?c.color:"#2563eb",v=s?"inline":c.position==="center"?"center":"corner",L=(o.fields||[]).filter(e=>e&&e.id&&e.label),W=L.some(e=>e.type==="phone"),ae=L.some(e=>e.type==="email"),l=L.map(e=>e.type==="email"&&!W||e.type==="phone"&&!ae?{...e,required:!0}:e),F=W&&l.find(e=>e.type==="email"&&!e.required),R=F&&l.find(e=>e.type==="phone"&&!e.required);if(!l.length){r.done();return}const N=document.createElement("div");N.setAttribute("data-noanalytics","");const H=N.attachShadow({mode:"open"});H.append(n("style",{text:fe(m,c.theme==="dark",v)}));const _=n("div",v==="inline"?{class:"box"}:{class:"box",role:"dialog","aria-modal":v==="center"?"true":"false","aria-labelledby":"t"}),S=r.image?n("div",{class:"main"}):_;if(r.image){const e=o.image||{};_.classList.add("pic",v==="center"&&o.image_layout==="side"?"side":"top"),e.width&&e.height&&_.style.setProperty("--ratio",`${e.width} / ${e.height}`);const t=n("div",{class:"media"},[n("img",{src:r.image,alt:e.alt||"",decoding:"async",width:e.width,height:e.height,onerror:()=>t.remove()})]);_.append(t,S)}H.append(n("div",{class:"wrap"},[_])),(s||document.body).append(N);let j=!1;const B=()=>{j=!0,document.removeEventListener("keydown",Q,!0),s||N.remove()},J=()=>{j||(B(),r.close())},Q=e=>{e.key==="Escape"&&J()};s||document.addEventListener("keydown",Q,!0);const $=new Map,C=new Map,X=l.map(e=>{let t,i=null;if(e.type==="textarea")t=n("textarea",{name:e.id,maxlength:"2000",required:e.required});else if(e.type==="select")t=n("select",{name:e.id,required:e.required},[n("option",{value:"",text:"\u2014"}),...(e.options||[]).map(a=>n("option",{value:a,text:a}))]);else if(e.type==="checkbox")t=n("input",{type:"checkbox",name:e.id});else if(se.includes(e.type)){const a=(e.options||[]).map(f=>n("input",{type:e.type==="radio"?"radio":"checkbox",name:e.id,value:f}));C.set(e.id,a);const p=e.control==="segmented",A=a.map((f,x)=>n("label",{class:"check"},[f,n("span",{text:e.options[x]})]));if(p){const f=()=>A.forEach((x,z)=>{x.className=a[z].checked?"check on":"check"});for(const x of a)x.addEventListener("change",f)}t=n("div",{class:p?"group seg":"group",role:e.type==="radio"?"radiogroup":"group","aria-label":e.label},A)}else if(e.type==="number"&&(e.control==="slider"||e.control==="stepper")){const a=e.control==="slider";if(t=n("input",{type:a?"range":"number",name:e.id,required:e.required,autocomplete:"off",placeholder:a?void 0:e.placeholder||void 0,min:e.min===void 0?void 0:String(e.min),max:e.max===void 0?void 0:String(e.max),step:e.step===void 0?void 0:String(e.step),value:a?String(e.min??0):void 0}),a){const p=n("span",{class:"out",text:ee(e,t.value)});t.addEventListener("input",()=>{p.textContent=ee(e,t.value)}),i=n("div",{class:"range"},[t,p])}else{const p=A=>()=>{const f=e.step||1,x=Number(t.value===""?e.min??0:t.value),z=Math.min(e.max??1/0,Math.max(e.min??-1/0,x+A*f));t.value=typeof e.decimals=="number"?z.toFixed(e.decimals):String(Math.round(z*1e6)/1e6),t.dispatchEvent(new Event("input",{bubbles:!0}))};i=n("div",{class:"step"},[n("button",{type:"button",text:"\u2212","aria-label":`Less: ${e.label}`,onclick:p(-1)}),t,n("button",{type:"button",text:"+","aria-label":`More: ${e.label}`,onclick:p(1)})])}}else t=n("input",{type:ge[e.type]||"text",name:e.id,maxlength:"300",required:e.required,autocomplete:ye[e.type],placeholder:e.placeholder||void 0,min:e.min===void 0?void 0:String(e.min),max:e.max===void 0?void 0:String(e.max)});if($.set(e.id,t),e.type==="checkbox")return n("label",{class:"check"},[t,n("span",{text:e.label})]);const d=e.label+(e.required?" *":"");return se.includes(e.type)?n("div",{class:"field"},[n("span",{class:"cap",text:d}),i||t]):n("label",{},[n("span",{text:d}),i||t])}),E=o.consent?n("input",{type:"checkbox",name:"consent"}):null,U=E?n("label",{class:"check"},[E,n("span",{text:o.consent})]):null,Y=n("input",{type:"text",name:"website",tabindex:"-1",autocomplete:"off"}),k=n("p",{class:"err",role:"alert"}),re=Date.now(),y=r.shield||null;y&&y.watchTrap(Y);const D=y?.mode==="checkbox"?y.box():null,M=e=>{if(e.type==="multi")return C.get(e.id).filter(i=>i.checked).map(i=>i.value);if(e.type==="radio")return C.get(e.id).find(i=>i.checked)?.value||"";const t=$.get(e.id);return e.type==="checkbox"?t.checked:t.value.trim()},Z=e=>C.has(e.id)?C.get(e.id)[0]:$.get(e.id),de=(e,t)=>{if(e.type==="email")return me.test(t)?"":"Please enter a valid email address.";if(e.type==="url")return $e(t)?"":"Please enter a full web address, starting with http:// or https://.";if(e.type==="number"){if(!ve.test(t))return"Please enter a number.";const d=Number(t);return typeof e.min=="number"&&d<e.min?`Please enter ${e.min} or more.`:typeof e.max=="number"&&d>e.max?`Please enter ${e.max} or less.`:""}if(e.type==="date")return Se(t)?typeof e.min=="string"&&t<e.min?`Please pick a date no earlier than ${e.min}.`:typeof e.max=="string"&&t>e.max?`Please pick a date no later than ${e.max}.`:"":"Please pick a date.";const i=(e.type==="text"||e.type==="textarea")&&ke[e.format];return i?i[0].test(t)?"":i[1]:""},ee=(e,t)=>{const i=typeof e.decimals=="number"?Number(t||0).toFixed(e.decimals):String(t);return`${e.prefix||""}${i}${e.unit?` ${e.unit}`:""}`},le=e=>{const t=M(e);return e.type==="checkbox"?t===!0?["yes"]:[]:Array.isArray(t)?t:t===""?[]:[String(t)]},ce=(e,t)=>{if(e.op==="filled")return t.length>0;if(e.op==="empty")return t.length===0;const i=t.includes(e.value);return e.op==="not"?!i:i},pe=l.some(e=>e.show_if),ue=new Map(l.map(e=>[e.id,e])),T=()=>{const e=new Set;for(const t of l)t.show_if?e.has(t.show_if.field)&&ce(t.show_if,le(ue.get(t.show_if.field)))&&e.add(t.id):e.add(t.id);return e},xe=e=>{for(const t of e){const i=M(t),d=Array.isArray(i)?i.length===0:!i,a=t.required&&d?`Please fill in ${t.label}.`:d?"":de(t,i);if($.get(t.id).setAttribute("aria-invalid",String(!!a)),a)return Z(t).focus(),a}return""},he=new Map(l.map((e,t)=>[e.id,t])),G=new Set,u=[];for(const e of Array.isArray(o.step_groups)?o.step_groups:[]){const t=(Array.isArray(e)?e:[]).map(i=>he.get(i)).filter(i=>i!==void 0&&!G.has(i));for(const i of t)G.add(i);t.length&&u.push(t)}const K=l.map((e,t)=>t).filter(e=>!G.has(e));u.length?u[u.length-1].push(...K):o.steps?u.push(...K.map(e=>[e])):u.push(K);let g=0;const q=n("button",{class:"btn",type:"submit"}),te=n("button",{class:"link",type:"button",text:w.back,onclick:()=>P(O(g-1,-1))}),ne=n("div",{class:"dots","aria-hidden":"true"}),I=n("form",{novalidate:!0}),ie=(e,t)=>u[e].some(i=>t.has(l[i].id)),O=(e,t)=>{const i=T();for(let d=e;d>=0&&d<u.length;d+=t)if(ie(d,i))return d;return-1};function P(e){e>=0&&(g=e);const t=T(),i=O(g+1,1)===-1;X.forEach((a,p)=>{a.hidden=!u[g].includes(p)||!t.has(l[p].id)}),U&&(U.hidden=!i),D&&(D.hidden=!i),q.textContent=i?b.button:w.next,te.hidden=O(g-1,-1)===-1;const d=u.map((a,p)=>p).filter(a=>ie(a,t));ne.replaceChildren(...d.length>1?d.map(a=>n("span",{class:`dot${a<=g?" on":""}`})):[]),k.textContent=""}I.addEventListener("submit",async e=>{if(e.preventDefault(),q.disabled)return;const t=T(),i=u[g].map(h=>l[h]).filter(h=>t.has(h.id)),d=xe(i);if(d){k.textContent=d;return}const a=O(g+1,1);if(a===-1&&R&&!M(F)&&!M(R)){k.textContent=`Please fill in ${R.label} or ${F.label}.`;return}if(a!==-1){P(a),Z(u[g].map(h=>l[h]).find(h=>T().has(h.id))).focus();return}if(E&&!E.checked){k.textContent="Please tick the box to continue.",E.focus();return}if(y&&!y.ticked(I)){k.textContent="Please tick \u201CI'm not a robot\u201D.",y.nudge(I);return}const p=Object.fromEntries(l.map(h=>[h.id,M(h)]));E&&(p.consent=!0),q.disabled=!0,k.textContent="";const A=y?await y.take():"",{status:f,field:x,message:z}=await r.submit(p,{website:Y.value,elapsed_ms:Date.now()-re,shield:A});if(q.disabled=!1,f>=200&&f<300)return be();if(x&&$.has(x)){const h=l.findIndex(V=>V.id===x);P(u.findIndex(V=>V.includes(h))),$.get(x).setAttribute("aria-invalid","true")}k.textContent=f===429?"Too many attempts, please try again later.":z||"Something went wrong, please try again."}),I.append(...X,...U?[U]:[],...D?[D]:[],n("div",{class:"hp","aria-hidden":"true"},[Y]),k,n("div",{class:"foot"},[ne,te,q]));const oe=n("div",{class:"head"},[n("p",{class:"title",id:"t",text:o.title||""})]);if(s||oe.append(n("button",{class:"x",type:"button","aria-label":w.close,title:w.close,text:"\u2715",onclick:J})),S.append(oe),o.description&&S.append(n("p",{class:"desc",text:o.description})),S.append(I),pe)for(const e of $.values())e.addEventListener("input",()=>P(-1)),e.addEventListener("change",()=>P(-1));if(P(Math.max(O(0,1),0)),v==="center"){const e=u[g].map(t=>l[t]).find(t=>T().has(t.id))||l[0];Z(e).focus({preventScroll:!0})}function be(){const e=[n("p",{class:"thanks",role:"status",text:b.thanks})];/^https?:\/\//i.test(o.download_url||"")&&e.push(n("a",{class:"btn",href:o.download_url,target:"_blank",rel:"noopener",text:w.download})),S.replaceChildren(...e),r.submitted(),!s&&!o.download_url?setTimeout(()=>{j||(B(),r.done())},3e3):s||S.prepend(n("div",{class:"head"},[n("span",{class:"title"}),n("button",{class:"x",type:"button","aria-label":w.close,text:"\u2715",onclick:()=>{B(),r.done()}})]))}}export function renderLauncher(o,s){const r=o.look||{},b=/^#[0-9a-f]{6}$/i.test(r.color||"")?r.color:"#2563eb",c=document.createElement("div");c.setAttribute("data-noanalytics","");const m=c.attachShadow({mode:"open"});m.append(n("style",{text:`
    :host { all: initial; }
    [hidden] { display: none !important; }
    button {
      position: fixed; z-index: 2147482999; right: 16px; bottom: 16px; border: 0; border-radius: 999px;
      padding: 12px 18px; cursor: pointer; font: 600 15px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: ${b}; color: #fff; box-shadow: 0 6px 20px rgba(0,0,0,.2); max-width: calc(100vw - 32px);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    button:focus-visible { outline: 3px solid ${b}66; outline-offset: 2px; }
  `}));const v=n("button",{type:"button","aria-haspopup":"dialog",text:o.targeting?.trigger?.label||"Contact us",onclick:s});return m.append(v),document.body.append(c),{show:L=>{v.hidden=!L},remove:()=>c.remove()}}
