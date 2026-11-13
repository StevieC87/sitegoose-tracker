const E=/^#[0-9a-f]{6}$/i,n=(t,o)=>E.test(t||"")?t:o,S=t=>`
  :host { all: initial; }
  [hidden] { display: none !important; }
  .cb {
    position: fixed; z-index: 2147483000; box-sizing: border-box; display: flex; flex-wrap: wrap;
    align-items: center; gap: 12px 16px; padding: 14px 16px;
    background: ${n(t.background,"#ffffff")}; color: ${n(t.color,"#111827")};
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
    border: 1px solid ${n(t.buttonBackground,"#111827")};
    background: ${n(t.buttonBackground,"#111827")}; color: ${n(t.buttonColor,"#ffffff")};
  }
  .cb button:focus-visible { outline: 2px solid ${n(t.buttonBackground,"#111827")}; outline-offset: 2px; }
  .cb button.cb-link { background: transparent; color: inherit; border-color: transparent; text-decoration: underline; padding: 8px 10px; }
${["accept","decline","customize","save"].map(o=>{const l=n(t[o+"Background"],o==="customize"?"transparent":n(t.buttonBackground,"#111827")),p=n(t[o+"Color"],o==="customize"?n(t.color,"#111827"):n(t.buttonColor,"#ffffff"));return`.cb button[data-cb="${o}"] { background: ${l}; color: ${p}; border-color: ${l}; }`}).join(`
`)}
  .cb-open { max-height: 85vh; overflow-y: auto; }
  .cb-list { flex: 1 1 100%; max-width: 720px; margin: 0; padding: 0; list-style: none; }
  .cb-list li { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-top: 1px solid rgba(127,127,127,.25); }
  .cb-list li:first-child { border-top: 0; }
  .cb-list label { flex: 1; cursor: pointer; }
  .cb-list strong { display: block; }
  .cb-list small { display: block; opacity: .8; font-size: 13px; }
  .cb-list input { width: 18px; height: 18px; margin: 2px 0 0; accent-color: ${n(t.buttonBackground,"#111827")}; cursor: pointer; }
  .cb-list input:disabled { cursor: default; opacity: .6; }
  .cb-list em { display: block; font-style: normal; font-size: 12px; opacity: .65; margin-top: 2px; }
  .cb .cb-id { flex: 1 1 100%; margin: 0; font-size: 12px; opacity: .6; }
  @media (max-width: 480px) {
    .cb-corner { left: 8px; right: 8px; bottom: 8px; max-width: none; }
    .cb-buttons { width: 100%; flex-wrap: wrap; }
    .cb button { flex: 1; }
  }
`,A=t=>typeof t=="string"&&/^(https?:\/\/|\/)/i.test(t)?t:"",C=["functional","marketing"],q={customize:"Customize",save:"Save choices",necessaryName:"Necessary",necessaryDesc:"Needed for the site to work. Always on.",analyticsName:"Analytics",analyticsDesc:"Helps us see how the site is used and when you come back.",functionalName:"Functional",functionalDesc:"Extra features such as chat, videos and maps.",marketingName:"Marketing",marketingDesc:"Ads and measuring them, by us and our partners."},x=(t,o)=>typeof t[o]=="string"&&t[o].trim()?t[o]:q[o];export function renderBanner(t,o,l=null,p=""){document.getElementById("analytics-consent-banner")?.remove();const m=C.filter(e=>Array.isArray(t.categories)&&t.categories.includes(e)),u=document.createElement("div");u.id="analytics-consent-banner";const s=u.attachShadow({mode:"open"});s.innerHTML=`<style>${S(t)}</style>
    <div class="cb ${t.position==="corner"?"cb-corner":"cb-bar"}" role="dialog" aria-label="Cookie consent">
      <p></p>
      <ul class="cb-list" hidden></ul>
      <p class="cb-id" hidden></p>
      <div class="cb-buttons">
        <button type="button" class="cb-link" data-cb="customize" hidden></button>
        <button type="button" data-cb="decline"></button>
        <button type="button" data-cb="save" hidden></button>
        <button type="button" data-cb="accept"></button>
      </div>
    </div>`;const z=s.querySelector(".cb"),y=s.querySelector("p");y.textContent=`${t.text||""} `;const g=A(t.policyUrl);if(g){const e=document.createElement("a");e.href=g,e.textContent=t.policyLabel||"Cookie policy",y.append(e)}const a=e=>s.querySelector(`[data-cb="${e}"]`);a("accept").textContent=t.accept||"Accept",a("decline").textContent=t.decline||"Decline",a("customize").textContent=x(t,"customize"),a("save").textContent=x(t,"save");const b=s.querySelector(".cb-list");for(const e of["necessary","analytics",...m]){const c=document.createElement("li"),d=`cb-${e}`,i=document.createElement("input");i.type="checkbox",i.id=d,i.name=e,i.checked=e==="necessary"||l?.[e]===!0,i.disabled=e==="necessary";const f=document.createElement("label");f.htmlFor=d;const $=document.createElement("strong");$.textContent=x(t,`${e}Name`);const v=document.createElement("small");v.textContent=x(t,`${e}Desc`),f.append($,v);const w=(Array.isArray(t.services)?t.services:[]).filter(r=>r?.category===e&&typeof r.name=="string").map(r=>r.name);if(w.length){const r=document.createElement("em");r.textContent=w.join(", "),f.append(r)}c.append(i,f),b.append(c)}if(l&&p){const e=s.querySelector(".cb-id");e.textContent=`Consent ID: ${p}`,e.hidden=!1}const h=()=>{b.hidden=!1,z.classList.add("cb-open"),a("customize").hidden=!0,a("save").hidden=!1,b.querySelector("input:not(:disabled)")?.focus()};m.length&&(a("customize").hidden=!1,l&&h());const k=e=>Object.fromEntries(["analytics",...C].map(c=>[c,e]));s.querySelector(".cb-buttons").addEventListener("click",e=>{const c=e.target.closest("button")?.getAttribute("data-cb");if(!c)return;if(c==="customize")return h();if(u.remove(),c!=="save")return o(k(c==="accept"));const d=k(!1);for(const i of b.querySelectorAll("input:not(:disabled)"))d[i.name]=i.checked;o(d)}),document.body.append(u)}
