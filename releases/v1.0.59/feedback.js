const M={button:"Feedback",title:"Send us feedback",bug:"Something's wrong",idea:"Idea",other:"Other",placeholder:"What happened, or what would you like?",point:"Point at it on the page",pointing:"Click the part of the page you mean \xB7 Esc to cancel",email:"Your email (optional, if you'd like a reply)",send:"Send",thanks:"Thanks! We've got it.",close:"Close"},W=/^#[0-9a-f]{6}$/i,$="#111827",E="#f9fafb",R=e=>{const[n,t,i]=[1,3,5].map(a=>{const s=parseInt(e.slice(a,a+2),16)/255;return s<=.03928?s/12.92:((s+.055)/1.055)**2.4});return .2126*n+.7152*t+.0722*i},O=(e,n)=>{const[t,i]=[R(e),R(n)].sort((a,s)=>s-a);return(t+.05)/(i+.05)},j=e=>O(e,$)>=O(e,E)?$:E,B=e=>{const n=W.test(e.background||"")?e.background:"";if(!n)return e.theme==="dark"?{deep:!0,bg:$,fg:E,line:"#374151",faint:"#1f2937",fieldLine:"#4b5563",field:"#1f2937",mute:"#1f2937",chip:"#00000066"}:{deep:!1,bg:"#ffffff",fg:$,line:"#e5e7eb",faint:"#f3f4f6",fieldLine:"#d1d5db",field:"#ffffff",mute:"#f3f4f6",chip:"#ffffffcc"};const t=j(n),i=t===E;return{deep:i,bg:n,fg:t,line:i?"rgba(255,255,255,.22)":"rgba(0,0,0,.14)",faint:i?"rgba(255,255,255,.10)":"rgba(0,0,0,.06)",fieldLine:i?"rgba(255,255,255,.34)":"rgba(0,0,0,.24)",field:i?"rgba(255,255,255,.08)":"rgba(255,255,255,.72)",mute:i?"rgba(255,255,255,.12)":"rgba(0,0,0,.07)",chip:i?"rgba(0,0,0,.4)":"rgba(255,255,255,.85)"}},F=(e,n,t)=>`
  :host { all: initial; }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  .root { font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: ${n.fg}; }
  .launch {
    position: fixed; z-index: 2147482999; bottom: 96px; ${t?"left: 0; border-radius: 0 8px 8px 0;":"right: 0; border-radius: 8px 0 0 8px;"}
    writing-mode: vertical-rl; ${t?"transform: rotate(180deg);":""}
    border: 0; padding: 12px 8px; cursor: pointer; font: 600 13px/1 system-ui, sans-serif; letter-spacing: .02em;
    background: ${e}; color: #fff; box-shadow: 0 4px 14px rgba(0,0,0,.18);
  }
  .launch:focus-visible { outline: 3px solid ${e}55; outline-offset: 2px; }
  .panel {
    position: fixed; z-index: 2147483000; bottom: 16px; ${t?"left: 16px;":"right: 16px;"}
    width: calc(100vw - 32px); max-width: 360px; padding: 16px; border-radius: 12px;
    background: ${n.bg}; border: 1px solid ${n.line};
    box-shadow: 0 10px 30px rgba(0,0,0,.2); display: flex; flex-direction: column; gap: 12px;
  }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  h2 { margin: 0; font-size: 16px; font-weight: 600; }
  .x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; font-size: 18px; line-height: 1; padding: 2px; }
  .x:hover, .x:focus-visible { opacity: 1; }
  .cats { display: flex; flex-wrap: wrap; gap: 6px; }
  .cat {
    flex: 1 1 auto; padding: 7px 10px; border-radius: 8px; cursor: pointer; font: inherit; color: inherit; background: none;
    border: 1px solid ${n.fieldLine};
  }
  .cat[aria-pressed="true"] { border-color: ${e}; background: ${e}22; }
  textarea, input {
    width: 100%; padding: 9px 12px; border-radius: 8px; font: inherit; color: inherit; background: none;
    border: 1px solid ${n.fieldLine};
  }
  textarea { min-height: 90px; resize: vertical; }
  textarea:focus, input:focus { outline: none; border-color: ${e}; }
  .link { border: 0; background: none; color: ${e}; cursor: pointer; font: inherit; padding: 0; text-align: left; }
  .picked { display: flex; align-items: center; gap: 8px; font-size: 13px; opacity: .85; }
  .picked span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .err { color: #dc2626; font-size: 13px; margin: 0; }
  .btn { margin-left: auto; border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; font: inherit; font-weight: 600; background: ${e}; color: #fff; }
  .btn[disabled] { opacity: .45; cursor: default; }
  .thanks { margin: 4px 0; font-weight: 600; }
  .hint {
    position: fixed; z-index: 2147483001; top: 12px; left: 50%; transform: translateX(-50%); max-width: calc(100vw - 24px);
    padding: 8px 14px; border-radius: 99px; background: #111827; color: #fff; font-size: 13px; box-shadow: 0 4px 14px rgba(0,0,0,.25);
  }
  .box { position: fixed; z-index: 2147483000; pointer-events: none; border: 2px solid ${e}; background: ${e}1a; border-radius: 4px; }
`,o=(e,n={},t=[])=>{const i=document.createElement(e);for(const[a,s]of Object.entries(n))a==="text"?i.textContent=s:a.startsWith("on")?i.addEventListener(a.slice(2),s):i.setAttribute(a,s);for(const a of t)i.append(a);return i};function I(e){const n=e.tagName.toLowerCase(),i=/^(input|select|textarea)$/.test(n)?e.getAttribute("aria-label")||e.getAttribute("name")||e.getAttribute("placeholder")||"":e.getAttribute("aria-label")||e.innerText||e.getAttribute("alt")||e.getAttribute("title")||"";return{tag:n,text:String(i).replace(/\s+/g," ").trim().slice(0,100)}}export function renderFeedback(e,n){const t={...M,...e.texts||{}},i=/^#[0-9a-f]{3,8}$/i.test(e.color||"")?e.color:"#2563eb",a=(e.categories||["bug","idea","other"]).filter(f=>["bug","idea","other"].includes(f)),s=document.createElement("div");s.setAttribute("data-noanalytics","");const z=s.attachShadow({mode:"open"});z.append(o("style",{text:F(i,B(e),e.position==="left")}));const y=o("div",{class:"root"});z.append(y),document.body.append(s);let l=null,x=null,L=!1,r={category:a[0]||"other",message:"",email:"",element:null};e.button!==!1&&(x=o("button",{class:"launch",type:"button",text:t.button,onclick:()=>C()}),y.append(x));const A=f=>{f.key==="Escape"&&l&&!L&&S()};function S(){l?.remove(),l=null,document.removeEventListener("keydown",A,!0),x&&(x.hidden=!1,x.focus({preventScroll:!0}))}function P(){l.hidden=!0,L=!0;const f=o("div",{class:"hint",role:"status",text:t.pointing}),u=o("div",{class:"box",hidden:""});y.append(f,u);const g=c=>c===s||s.contains(c),v=c=>{const d=c.target;if(!d?.getBoundingClientRect||g(d))return;const p=d.getBoundingClientRect();u.hidden=!1,Object.assign(u.style,{left:`${p.left}px`,top:`${p.top}px`,width:`${p.width}px`,height:`${p.height}px`})},m=()=>{document.removeEventListener("mousemove",v,!0),document.removeEventListener("click",w,!0),document.removeEventListener("keydown",b,!0),f.remove(),u.remove(),L=!1,l&&(l.hidden=!1,k())};function w(c){const d=c.target;if(!d?.tagName||g(d))return;c.preventDefault(),c.stopPropagation();const p=d.getBoundingClientRect(),h=n.selector(d);h&&(r.element={selector:h,...I(d),x:Math.round(p.left+window.scrollX),y:Math.round(p.top+window.scrollY),w:Math.round(p.width),h:Math.round(p.height)}),m()}function b(c){c.key==="Escape"&&(c.stopPropagation(),m())}document.addEventListener("mousemove",v,!0),document.addEventListener("click",w,!0),document.addEventListener("keydown",b,!0)}function k(f=""){const u=o("textarea",{"aria-label":t.placeholder,placeholder:t.placeholder,maxlength:"2000"});u.value=r.message;const g=o("button",{class:"btn",type:"submit",text:t.send}),v=()=>{r.message=u.value,g.disabled=!u.value.trim()};u.addEventListener("input",v),v();const m=o("div",{class:"cats",role:"group","aria-label":t.title});for(const d of a)m.append(o("button",{class:"cat",type:"button","aria-pressed":String(r.category===d),text:t[d],onclick:()=>{r.category=d;for(const p of m.children)p.setAttribute("aria-pressed",String(p===m.children[a.indexOf(d)]))}}));const w=r.element?o("div",{class:"picked"},[o("span",{text:`\u2713 ${r.element.text?`\u201C${r.element.text}\u201D`:`<${r.element.tag}>`}`}),o("button",{class:"link",type:"button",text:"\u2715","aria-label":"Remove",onclick:()=>{r.element=null,k()}})]):o("button",{class:"link",type:"button",text:`\u2316 ${t.point}`,onclick:P}),b=e.ask_email?o("input",{type:"email",placeholder:t.email,"aria-label":t.email,maxlength:"200"}):null;b&&(b.value=r.email,b.addEventListener("input",()=>{r.email=b.value}));const c=o("form",{class:"panel",role:"dialog","aria-modal":"false","aria-labelledby":"fb-title"},[o("div",{class:"head"},[o("h2",{id:"fb-title",text:t.title}),o("button",{class:"x",type:"button","aria-label":t.close,title:t.close,text:"\u2715",onclick:S})]),...a.length>1?[m]:[],u,w,...b?[b]:[],...f?[o("p",{class:"err",role:"alert",text:f})]:[],o("div",{class:"foot"},[g])]);c.addEventListener("submit",async d=>{if(d.preventDefault(),g.disabled)return;g.disabled=!0;const p=await n.submit({category:r.category,message:r.message.trim(),email:r.email.trim(),element:r.element});if(!l)return;if(!p.ok){k(p.message||"Couldn't send it. Please try again.");return}r={category:a[0]||"other",message:"",email:"",element:null};const h=o("div",{class:"panel",role:"status"},[o("p",{class:"thanks",text:t.thanks})]);l.replaceWith(h),l=h,setTimeout(()=>{l===h&&S()},2500)}),l?l.replaceWith(c):y.append(c),l=c,f||u.focus({preventScroll:!0})}function C(){if(!l){try{n.capture?.()}catch{}x&&(x.hidden=!0),document.addEventListener("keydown",A,!0),k()}}function T(){document.removeEventListener("keydown",A,!0),l=null,s.remove()}return{open:C,isOpen:()=>!!l,remove:T}}
