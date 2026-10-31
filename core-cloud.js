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
    cloud.sha=j.sha;cloud.last=nowStr();
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
  const body={message:`更新看板 ${nowStr()}`,content:b64enc(JSON.stringify(state,null,1)),branch:c.branch};
  if(cloud.sha)body.sha=cloud.sha;
  let r;try{r=await fetch(apiURL(c),{method:"PUT",headers:{Accept:"application/vnd.github+json",Authorization:"Bearer "+tk,"Content-Type":"application/json"},body:JSON.stringify(body)})}
  catch(e){return {ok:false,msg:"連不上 GitHub，已先存在這台電腦"}}
  if(r.ok){const j=await r.json();cloud.sha=j.content&&j.content.sha;cloud.etag=null;cloud.status="ok";cloud.last=nowStr();return {ok:true}}
  if(r.status===409||r.status===422)return {ok:false,conflict:true,msg:"雲端已有別人存的新版本，沒有覆蓋。請重新整理後再修改"};
  if(r.status===401)return {ok:false,msg:"GitHub 權杖無效或過期，請到「雲端同步」重新設定"};
  if(r.status===403||r.status===404)return {ok:false,msg:"權杖沒有這個 repo 的寫入權限（需要 Contents: Read and write）"};
  return {ok:false,msg:"同步失敗（"+r.status+"），已先存在這台電腦"};
}
if(!state.locked&&!HOSTED&&!cloudOn()){
  try{const s=JSON.parse(localStorage.getItem(KEY)||"null");if(s&&s.issues&&(s.savedAt||"")>=(state.savedAt||""))state=normalize(s)}catch(e){localOK=false}
}
