/* 核心｜GitHub 雲端同步（讀寫 data.json） */
/* ---------- GitHub 雲端同步 (data.json in the repo) ---------- */
const TOKEN_KEY="workboard:ghtoken";
function cloudCfg(){
  const c=Object.assign({},CFG.data,state.sync||{});let owner=c.owner||"",repo=c.repo||"";
  if(!owner&&/\.github\.io$/i.test(location.hostname)){owner=location.hostname.split(".")[0];const seg=location.pathname.split("/").filter(Boolean)[0];repo=seg&&!/\.html?$/i.test(seg)?seg:location.hostname}
  return {owner,repo,branch:c.branch||"main",path:c.path||"data.json"};
}
const cloudOn=()=>{const c=cloudCfg();return !!(c.owner&&c.repo)&&!HOSTED};
const ghToken=()=>{try{return localStorage.getItem(TOKEN_KEY)||""}catch(_){return ""}};
/* 後台管理員（2026-11-06）：設定頁「網站管理」（雲端同步、分享預覽、全會密碼）只給這台裝置是後台管理員的人看。
   記號只存在這台裝置的瀏覽器（localStorage），不上傳。自己貼過權杖（雲端同步、儲存前的權杖欄）就記上；
   新裝置或還沒記上的，網址加 ?admin 打開一次。各部門登入時自動解出的權杖不算（那是全會密碼、部門共用密碼或個人密碼解開的）。
   這只是把入口藏起來，不是權限控管。 */
const SITE_ADMIN_KEY="workboard:siteadmin";
const siteAdminMark=()=>{try{localStorage.setItem(SITE_ADMIN_KEY,"1")}catch(_){}};
const siteAdmin=()=>{try{if(new URLSearchParams(location.search).has("admin"))siteAdminMark();return localStorage.getItem(SITE_ADMIN_KEY)==="1"}catch(_){return false}};
let cloud={sha:null,etag:null,status:"",last:""};
const b64enc=str=>{const bytes=new TextEncoder().encode(str);let bin="";for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(bin)};
const b64dec=b64=>{const bin=atob(String(b64).replace(/\s/g,""));const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new TextDecoder().decode(u)};
const apiURL=c=>`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${c.path.split("/").map(encodeURIComponent).join("/")}`;
async function cloudPull(opts={}){
  if(!cloudOn())return "off";
  const c=cloudCfg(),h={Accept:"application/vnd.github+json"},tk=ghToken();
  if(tk)h.Authorization="Bearer "+tk;
  if(cloud.etag&&!opts.force)h["If-None-Match"]=cloud.etag;
  let r;try{r=await fetch(apiURL(c)+"?ref="+encodeURIComponent(c.branch)+"&t="+Date.now(),{headers:h,cache:"no-store"})}catch(e){cloud.status="offline";return "offline"}
  netFail=false;
  if(r.status===304){cloud.status="ok";return "same"}
  if(r.status===404){cloud.status="empty";cloud.sha=null;return "empty"}
  if(!r.ok){cloud.status=r.status===403?"limited":"error";return "error"}
  const j=await r.json();cloud.etag=r.headers.get("ETag");
  if(j.sha===cloud.sha){cloud.status="ok";return "same"}
  cloud.status="ok";
  try{const remote=normalize(JSON.parse(b64dec(j.content)));
    if(editing&&!opts.apply){cloud.etag=null;cloud.pending={state:remote,sha:j.sha};return "pending"}
    cloud.sha=j.sha;cloud.last=nowStr();baseline=JSON.parse(JSON.stringify(remote));
    const keepSync=state.sync;state=remote;if(!state.sync)state.sync=keepSync;
    try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}
    return "updated";
  }catch(e){cloud.status="error";return "error"}
}
async function cloudPush(){
  const c=cloudCfg(),tk=ghToken();
  if(!tk)return {ok:false,msg:"已存在這台電腦（沒有權杖，未同步到雲端）"};
  if(!cloud.sha){
    try{const r0=await fetch(apiURL(c)+"?ref="+encodeURIComponent(c.branch)+"&t="+Date.now(),{headers:{Accept:"application/vnd.github+json",Authorization:"Bearer "+tk},cache:"no-store"});
      if(r0.ok){const j0=await r0.json();
        const ok=await ask("雲端已經有一份看板資料（可能是別人存的）。要用你目前的內容覆蓋嗎？",[],{danger:"覆蓋雲端"});
        if(ok!=="delete")return {ok:false,msg:"已取消上傳，只存在這台電腦"};
        cloud.sha=j0.sha}
    }catch(_){}
  }
  /* 每次送出都重新組內容與權杖（恢復後 members[].tok 有更新、權杖換成新的） */
  const put=()=>{const body={message:commitMessage(),content:b64enc(JSON.stringify(state,null,1)),branch:c.branch};if(cloud.sha)body.sha=cloud.sha;
    return fetch(apiURL(c),{method:"PUT",headers:{Accept:"application/vnd.github+json",Authorization:"Bearer "+ghToken(),"Content-Type":"application/json"},body:JSON.stringify(body)})};
  let r;try{r=await put()}catch(e){return {ok:false,msg:"連不上 GitHub，已先存在這台電腦"}}
  /* 權杖作廢（401）：輸入全會密碼取得新權杖後自動重試一次（auth.js 的 tokenRecover；過渡用，02D 移除） */
  if(r.status===401){
    const k=await tokenRecover();
    if(k==="cancel")return {ok:false,msg:"上傳權限沒有恢復，這次的修改先存在這台電腦"};
    if(k==="same")return {ok:false,msg:"學生會還沒換上新的上傳權限，這次的修改先存在這台電腦，請稍後再存一次"};
    if(k==="ok"){try{r=await put()}catch(e){return {ok:false,msg:"連不上 GitHub，已先存在這台電腦"}}}
  }
  if(r.ok){const j=await r.json();setBaseline();cloud.sha=j.content&&j.content.sha;cloud.etag=null;cloud.status="ok";cloud.last=nowStr();return {ok:true}}
  if(r.status===409||r.status===422)return {ok:false,conflict:true,msg:"雲端已有別人存的新版本，沒有覆蓋。請重新整理後再修改"};
  if(r.status===401)return {ok:false,msg:"GitHub 權杖無效或過期，請到「雲端同步」重新設定"};
  if(r.status===403||r.status===404)return {ok:false,msg:"權杖沒有這個 repo 的寫入權限（需要 Contents: Read and write）"};
  return {ok:false,msg:"同步失敗（"+r.status+"），已先存在這台電腦"};
}
if(!state.locked&&!HOSTED&&!cloudOn()){
  try{const s=JSON.parse(localStorage.getItem(KEY)||"null");if(s&&s.issues&&(s.savedAt||"")>=(state.savedAt||""))state=normalize(s)}catch(e){localOK=false}
}
