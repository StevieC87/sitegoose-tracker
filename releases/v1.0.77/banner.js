const z=/^#[0-9a-f]{6}$/i,c=(t,n)=>z.test(t||"")?t:n,E=t=>`
  :host { all: initial; }
  [hidden] { display: none !important; }
  .cb {
    position: fixed; z-index: 2147483000; box-sizing: border-box; display: flex; flex-wrap: wrap;
    align-items: center; gap: 12px 16px; padding: 14px 16px;
    background: ${c(t.background,"#ffffff")}; color: ${c(t.color,"#111827")};
    font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 -4px 20px rgba(0,0,0,.12);
  }
  .cb-bar { left: 0; right: 0; bottom: 0; justify-content: center; }
  .cb-corner { left: 16px; bottom: 16px; max-width: 360px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.2); }
  .cb p { margin: 0; flex: 1 1 280px; max-width: 720px; }
  .cb a { color: inherit; text-decoration: underline; }
  .cb-buttons { display: flex; gap: 8px; }
  .cb button {
    cursor: pointer; border-radius: 8px; padding: 8px 18px; font: inherit; font-weight: 600;
    border: 1px solid ${c(t.buttonBackground,"#111827")};
    background: ${c(t.buttonBackground,"#111827")}; color: ${c(t.buttonColor,"#ffffff")};
  }
  .cb button:focus-visible { outline: 2px solid ${c(t.buttonBackground,"#111827")}; outline-offset: 2px; }
  .cb button.cb-link { background: transparent; color: inherit; border-color: transparent; text-decoration: underline; padding: 8px 10px; }
${["accept","decline","customize","save"].map(n=>{const o=c(t[n+"Background"],n==="customize"?"transparent":c(t.buttonBackground,"#111827")),p=c(t[n+"Color"],n==="customize"?c(t.color,"#111827"):c(t.buttonColor,"#ffffff"));return`.cb button[data-cb="${n}"] { background: ${o}; color: ${p}; border-color: ${o}; }`}).join(`
`)}
  .cb-open { max-height: 85vh; overflow-y: auto; }
  .cb-list { flex: 1 1 100%; max-width: 720px; margin: 0; padding: 0; list-style: none; }
  .cb-list li { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-top: 1px solid rgba(127,127,127,.25); }
  .cb-list li:first-child { border-top: 0; }
  .cb-list label { flex: 1; cursor: pointer; }
  .cb-list strong { display: block; }
  .cb-list small { display: block; opacity: .8; font-size: 13px; }
  .cb-list input { width: 18px; height: 18px; margin: 2px 0 0; accent-color: ${c(t.buttonBackground,"#111827")}; cursor: pointer; }
  .cb-list input:disabled { cursor: default; opacity: .6; }
  .cb-list em { display: block; font-style: normal; font-size: 12px; opacity: .65; margin-top: 2px; }
  .cb .cb-id { flex: 1 1 100%; margin: 0; font-size: 12px; opacity: .6; }
  @media (max-width: 480px) {
    .cb-corner { left: 8px; right: 8px; bottom: 8px; max-width: none; }
    .cb-buttons { width: 100%; flex-wrap: wrap; }
    .cb button { flex: 1; }
  }
`,A=t=>typeof t=="string"&&/^(https?:\/\/|\/)/i.test(t)?t:"",$=["functional","marketing"],B={customize:"Customize",save:"Save choices",necessaryName:"Necessary",necessaryDesc:"Needed for the site to work. Always on.",analyticsName:"Analytics",analyticsDesc:"Helps us see how the site is used and when you come back.",functionalName:"Functional",functionalDesc:"Extra features such as chat, videos and maps.",marketingName:"Marketing",marketingDesc:"Ads and measuring them, by us and our partners."},m=(t,n)=>typeof t[n]=="string"&&t[n].trim()?t[n]:B[n];function q(t,n){try{const o=new CSSStyleSheet;o.replaceSync(n),t.adoptedStyleSheets=[o]}catch{const o=document.createElement("style");o.textContent=n,t.prepend(o)}}export function renderBanner(t,n,o=null,p=""){document.getElementById("analytics-consent-banner")?.remove();const x=$.filter(e=>Array.isArray(t.categories)&&t.categories.includes(e)),u=document.createElement("div");u.id="analytics-consent-banner";const a=u.attachShadow({mode:"open"});a.innerHTML=`<div class="cb ${t.position==="corner"?"cb-corner":"cb-bar"}" role="dialog" aria-label="Cookie consent">
      <p></p>
      <ul class="cb-list" hidden></ul>
      <p class="cb-id" hidden></p>
      <div class="cb-buttons">
        <button type="button" class="cb-link" data-cb="customize" hidden></button>
        <button type="button" data-cb="decline"></button>
        <button type="button" data-cb="save" hidden></button>
        <button type="button" data-cb="accept"></button>
      </div>
    </div>`,q(a,E(t));const C=a.querySelector(".cb"),y=a.querySelector("p");y.textContent=`${t.text||""} `;const g=A(t.policyUrl);if(g){const e=document.createElement("a");e.href=g,e.textContent=t.policyLabel||"Cookie policy",y.append(e)}const r=e=>a.querySelector(`[data-cb="${e}"]`);r("accept").textContent=t.accept||"Accept",r("decline").textContent=t.decline||"Decline",r("customize").textContent=m(t,"customize"),r("save").textContent=m(t,"save");const b=a.querySelector(".cb-list");for(const e of["necessary","analytics",...x]){const i=document.createElement("li"),d=`cb-${e}`,s=document.createElement("input");s.type="checkbox",s.id=d,s.name=e,s.checked=e==="necessary"||o?.[e]===!0,s.disabled=e==="necessary";const f=document.createElement("label");f.htmlFor=d;const w=document.createElement("strong");w.textContent=m(t,`${e}Name`);const v=document.createElement("small");v.textContent=m(t,`${e}Desc`),f.append(w,v);const S=(Array.isArray(t.services)?t.services:[]).filter(l=>l?.category===e&&typeof l.name=="string").map(l=>l.name);if(S.length){const l=document.createElement("em");l.textContent=S.join(", "),f.append(l)}i.append(s,f),b.append(i)}if(o&&p){const e=a.querySelector(".cb-id");e.textContent=`Consent ID: ${p}`,e.hidden=!1}const h=()=>{b.hidden=!1,C.classList.add("cb-open"),r("customize").hidden=!0,r("save").hidden=!1,b.querySelector("input:not(:disabled)")?.focus()};x.length&&(r("customize").hidden=!1,o&&h());const k=e=>Object.fromEntries(["analytics",...$].map(i=>[i,e]));a.querySelector(".cb-buttons").addEventListener("click",e=>{const i=e.target.closest("button")?.getAttribute("data-cb");if(!i)return;if(i==="customize")return h();if(u.remove(),i!=="save")return n(k(i==="accept"));const d=k(!1);for(const s of b.querySelectorAll("input:not(:disabled)"))d[s.name]=s.checked;n(d)}),document.body.append(u)}
