/* 核心｜共用小工具（日期、跳脫、toast） */
let TEMPLATE="",BODY_SRC="";   /* 在 boot.js 擷取（扣除執行期產生的骨架）*/
const HOSTED=!!(window.claude&&window.claude.use);
let artifactNS=null,canWrite=!HOSTED;
const readOnly=()=>!!state.locked||(HOSTED&&!canWrite)||(isOffline()&&!editing);
const COLORS=["#6a4fd8","#3d7fe0","#a24fc0","#d84f92","#2f8f84","#c26a12","#6b6b75","#111114"];
const MARK_COLORS=["#8a6cf2","#6ea2f2","#b993f2","#f39ac8","#7fd0c8","#111114"];
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const ym=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
const pd=s=>{const [y,m,d]=String(s).split("-").map(Number);return new Date(y,(m||1)-1,d||1)};
const today=()=>ymd(new Date());
const nowStr=()=>{const d=new Date();return `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`};
const fmt=s=>s?String(s).slice(0,10).replaceAll("-","/"):"";
const safeUrl=u=>!u?"#":/^https?:\/\//i.test(u)?u:"https://"+u;
const clamp=(v,a=0,b=100)=>Math.min(b,Math.max(a,v));
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("show"),2000)};
const hasDates=i=>!!(i.start&&i.end);
/* 液態玻璃材質：加上 .glass，並讓高光跟著指標位置走 */
function glassify(el){
  if(!el||el._glass)return;el._glass=true;el.classList.add("glass");
  el.addEventListener("pointermove",e=>{const r=el.getBoundingClientRect();el.style.setProperty("--mx",((e.clientX-r.left)/r.width*100).toFixed(1)+"%");el.style.setProperty("--my",((e.clientY-r.top)/r.height*100).toFixed(1)+"%")},{passive:true});
}
