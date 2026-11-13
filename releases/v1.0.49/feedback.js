const O={button:"Feedback",title:"Send us feedback",bug:"Something's wrong",idea:"Idea",other:"Other",placeholder:"What happened, or what would you like?",point:"Point at it on the page",pointing:"Click the part of the page you mean \xB7 Esc to cancel",email:"Your email (optional, if you'd like a reply)",send:"Send",thanks:"Thanks! We've got it.",close:"Close"},R=(e,l,n)=>`
  :host { all: initial; }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  .root { font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: ${l?"#f9fafb":"#111827"}; }
  .launch {
    position: fixed; z-index: 2147482999; bottom: 96px; ${n?"left: 0; border-radius: 0 8px 8px 0;":"right: 0; border-radius: 8px 0 0 8px;"}
    writing-mode: vertical-rl; ${n?"transform: rotate(180deg);":""}
    border: 0; padding: 12px 8px; cursor: pointer; font: 600 13px/1 system-ui, sans-serif; letter-spacing: .02em;
    background: ${e}; color: #fff; box-shadow: 0 4px 14px rgba(0,0,0,.18);
  }
  .launch:focus-visible { outline: 3px solid ${e}55; outline-offset: 2px; }
  .panel {
    position: fixed; z-index: 2147483000; bottom: 16px; ${n?"left: 16px;":"right: 16px;"}
    width: calc(100vw - 32px); max-width: 360px; padding: 16px; border-radius: 12px;
    background: ${l?"#111827":"#ffffff"}; border: 1px solid ${l?"#374151":"#e5e7eb"};
    box-shadow: 0 10px 30px rgba(0,0,0,.2); display: flex; flex-direction: column; gap: 12px;
  }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  h2 { margin: 0; font-size: 16px; font-weight: 600; }
  .x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; font-size: 18px; line-height: 1; padding: 2px; }
  .x:hover, .x:focus-visible { opacity: 1; }
  .cats { display: flex; flex-wrap: wrap; gap: 6px; }
  .cat {
    flex: 1 1 auto; padding: 7px 10px; border-radius: 8px; cursor: pointer; font: inherit; color: inherit; background: none;
    border: 1px solid ${l?"#4b5563":"#d1d5db"};
  }
  .cat[aria-pressed="true"] { border-color: ${e}; background: ${e}22; }
  textarea, input {
    width: 100%; padding: 9px 12px; border-radius: 8px; font: inherit; color: inherit; background: none;
    border: 1px solid ${l?"#4b5563":"#d1d5db"};
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
`,t=(e,l={},n=[])=>{const f=document.createElement(e);for(const[d,p]of Object.entries(l))d==="text"?f.textContent=p:d.startsWith("on")?f.addEventListener(d.slice(2),p):f.setAttribute(d,p);for(const d of n)f.append(d);return f};function T(e){const l=e.tagName.toLowerCase(),f=/^(input|select|textarea)$/.test(l)?e.getAttribute("aria-label")||e.getAttribute("name")||e.getAttribute("placeholder")||"":e.getAttribute("aria-label")||e.innerText||e.getAttribute("alt")||e.getAttribute("title")||"";return{tag:l,text:String(f).replace(/\s+/g," ").trim().slice(0,100)}}export function renderFeedback(e,l){const n={...O,...e.texts||{}},f=/^#[0-9a-f]{3,8}$/i.test(e.color||"")?e.color:"#2563eb",d=(e.categories||["bug","idea","other"]).filter(u=>["bug","idea","other"].includes(u)),p=document.createElement("div");p.setAttribute("data-noanalytics","");const z=p.attachShadow({mode:"open"});z.append(t("style",{text:R(f,e.theme==="dark",e.position==="left")}));const y=t("div",{class:"root"});z.append(y),document.body.append(p);let i=null,b=null,$=!1,o={category:d[0]||"other",message:"",email:"",element:null};e.button!==!1&&(b=t("button",{class:"launch",type:"button",text:n.button,onclick:()=>S()}),y.append(b));const E=u=>{u.key==="Escape"&&i&&!$&&L()};function L(){i?.remove(),i=null,document.removeEventListener("keydown",E,!0),b&&(b.hidden=!1,b.focus({preventScroll:!0}))}function A(){i.hidden=!0,$=!0;const u=t("div",{class:"hint",role:"status",text:n.pointing}),c=t("div",{class:"box",hidden:""});y.append(u,c);const m=a=>a===p||p.contains(a),v=a=>{const r=a.target;if(!r?.getBoundingClientRect||m(r))return;const s=r.getBoundingClientRect();c.hidden=!1,Object.assign(c.style,{left:`${s.left}px`,top:`${s.top}px`,width:`${s.width}px`,height:`${s.height}px`})},h=()=>{document.removeEventListener("mousemove",v,!0),document.removeEventListener("click",w,!0),document.removeEventListener("keydown",x,!0),u.remove(),c.remove(),$=!1,i&&(i.hidden=!1,k())};function w(a){const r=a.target;if(!r?.tagName||m(r))return;a.preventDefault(),a.stopPropagation();const s=r.getBoundingClientRect(),g=l.selector(r);g&&(o.element={selector:g,...T(r),x:Math.round(s.left+window.scrollX),y:Math.round(s.top+window.scrollY),w:Math.round(s.width),h:Math.round(s.height)}),h()}function x(a){a.key==="Escape"&&(a.stopPropagation(),h())}document.addEventListener("mousemove",v,!0),document.addEventListener("click",w,!0),document.addEventListener("keydown",x,!0)}function k(u=""){const c=t("textarea",{"aria-label":n.placeholder,placeholder:n.placeholder,maxlength:"2000"});c.value=o.message;const m=t("button",{class:"btn",type:"submit",text:n.send}),v=()=>{o.message=c.value,m.disabled=!c.value.trim()};c.addEventListener("input",v),v();const h=t("div",{class:"cats",role:"group","aria-label":n.title});for(const r of d)h.append(t("button",{class:"cat",type:"button","aria-pressed":String(o.category===r),text:n[r],onclick:()=>{o.category=r;for(const s of h.children)s.setAttribute("aria-pressed",String(s===h.children[d.indexOf(r)]))}}));const w=o.element?t("div",{class:"picked"},[t("span",{text:`\u2713 ${o.element.text?`\u201C${o.element.text}\u201D`:`<${o.element.tag}>`}`}),t("button",{class:"link",type:"button",text:"\u2715","aria-label":"Remove",onclick:()=>{o.element=null,k()}})]):t("button",{class:"link",type:"button",text:`\u2316 ${n.point}`,onclick:A}),x=e.ask_email?t("input",{type:"email",placeholder:n.email,"aria-label":n.email,maxlength:"200"}):null;x&&(x.value=o.email,x.addEventListener("input",()=>{o.email=x.value}));const a=t("form",{class:"panel",role:"dialog","aria-modal":"false","aria-labelledby":"fb-title"},[t("div",{class:"head"},[t("h2",{id:"fb-title",text:n.title}),t("button",{class:"x",type:"button","aria-label":n.close,title:n.close,text:"\u2715",onclick:L})]),...d.length>1?[h]:[],c,w,...x?[x]:[],...u?[t("p",{class:"err",role:"alert",text:u})]:[],t("div",{class:"foot"},[m])]);a.addEventListener("submit",async r=>{if(r.preventDefault(),m.disabled)return;m.disabled=!0;const s=await l.submit({category:o.category,message:o.message.trim(),email:o.email.trim(),element:o.element});if(!i)return;if(!s.ok){k(s.message||"Couldn't send it. Please try again.");return}o={category:d[0]||"other",message:"",email:"",element:null};const g=t("div",{class:"panel",role:"status"},[t("p",{class:"thanks",text:n.thanks})]);i.replaceWith(g),i=g,setTimeout(()=>{i===g&&L()},2500)}),i?i.replaceWith(a):y.append(a),i=a,u||c.focus({preventScroll:!0})}function S(){if(!i){try{l.capture?.()}catch{}b&&(b.hidden=!0),document.addEventListener("keydown",E,!0),k()}}function C(){document.removeEventListener("keydown",E,!0),i=null,p.remove()}return{open:S,isOpen:()=>!!i,remove:C}}
