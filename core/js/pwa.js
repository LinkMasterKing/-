/* 核心｜可安裝（PWA）、離線唯讀、分享預覽文字 */
let netFail=false;   /* 讀 data.json 或 GitHub 時連不上 */
const isOffline=()=>!navigator.onLine||netFail;
function offlinePill(){
  let op=document.getElementById("offlinePill");
  if(!op){const si=document.getElementById("saveInfo");if(!si)return;op=document.createElement("span");op.id="offlinePill";op.className="offline-pill";op.setAttribute("role","status");op.innerHTML='<span class="live-dot" aria-hidden="true"></span>離線中';si.before(op)}
  op.hidden=!isOffline();
}
window.addEventListener("offline",()=>{if(!editing)render();else offlinePill()});
window.addEventListener("online",async()=>{netFail=false;if(cloudOn()){const r=await cloudPull({force:true});if(r==="updated")toast("已重新連線，看板已更新")}if(!editing)render();else offlinePill()});

/* Service Worker：只在正式網址（https / localhost）且頁面有 manifest 時註冊 */
if("serviceWorker" in navigator&&document.querySelector('link[rel="manifest"]')&&(location.protocol==="https:"||/^(localhost|127\.0\.0\.1)$/.test(location.hostname))){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("sw.js").then(()=>navigator.serviceWorker.ready).then(reg=>{
      const same=u=>{try{return new URL(u,location.href).origin===location.origin}catch(_){return false}};
      const urls=[new URL("./",location.href).href,...performance.getEntriesByType("resource").map(e=>e.name),
        ...[...document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"],link[rel="manifest"]')].map(l=>l.href)]
        .filter(same).map(u=>u.split("#")[0].split("?")[0]);
      reg.active&&reg.active.postMessage({type:"precache",urls:[...new Set(urls)]});
    }).catch(()=>{});
  });
}

/* ---------- 分享預覽文字：改 index.html 的 meta（透過 GitHub API，用這台裝置的權杖） ---------- */
const metaGet=k=>document.querySelector(`meta[property="${k}"],meta[name="${k}"]`)?.getAttribute("content")||"";
function metaSet(html,k,v){
  const attr=k.startsWith("og:")?"property":"name",val=esc(v);
  const re=new RegExp(`<meta ${attr}="${k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}" content="[^"]*">`);
  const tag=`<meta ${attr}="${k}" content="${val}">`;
  return re.test(html)?html.replace(re,()=>tag):html.replace("</head>",()=>tag+"\n</head>");
}
async function shareSettings(){
  const v=await ask("分享預覽（貼連結到 LINE、IG、FB 時顯示）",[
    {name:"t",label:"標題",value:metaGet("og:title")||state.title},
    {name:"d",label:"說明文字",value:metaGet("og:description")}],{wide:true});
  if(!v)return;
  const t=(v.t||"").trim(),d=(v.d||"").trim();
  if(!t){toast("標題不能空白");return}
  if(!cloudOn()||!ghToken()){toast("要先在「雲端設定」連上 GitHub 才能更新預覽");return}
  const c=cloudCfg(),pc={...c,path:CFG.data.page||"index.html"},h={Accept:"application/vnd.github+json",Authorization:"Bearer "+ghToken()};
  toast("更新中…");
  let r;try{r=await fetch(apiURL(pc)+"?ref="+encodeURIComponent(c.branch)+"&t="+Date.now(),{headers:h,cache:"no-store"})}catch(_){toast("連不上 GitHub，沒有更新");return}
  if(!r.ok){toast(r.status===404?`在 repo 裡找不到 ${pc.path}`:"讀取網頁檔失敗（"+r.status+"）");return}
  const j=await r.json();let html=b64dec(j.content);
  const base=location.protocol==="https:"?new URL("./",location.href).href:"";
  const pairs=[["description",d],["og:title",t],["og:description",d],["twitter:title",t],["twitter:description",d]];
  if(base)pairs.push(["og:url",base],["og:image",base+"dept/cover.png"],["twitter:image",base+"dept/cover.png"]);
  pairs.forEach(([k,val])=>{html=metaSet(html,k,val)});
  let w;try{w=await fetch(apiURL(pc),{method:"PUT",headers:{...h,"Content-Type":"application/json"},body:JSON.stringify({message:`更新分享預覽文字 ${nowStr()}`,content:b64enc(html),sha:j.sha,branch:c.branch})})}catch(_){toast("連不上 GitHub，沒有更新");return}
  if(!w.ok){toast(w.status===409||w.status===422?"網頁檔剛好被別人改過，請再試一次":w.status===401?"GitHub 權杖無效或過期":"更新失敗（"+w.status+"）");return}
  pairs.forEach(([k,val])=>{const m=document.querySelector(`meta[property="${k}"],meta[name="${k}"]`);if(m)m.setAttribute("content",val)});
  toast("已更新預覽文字（約 1 分鐘後生效；LINE、FB 會快取舊預覽一段時間）");
}
