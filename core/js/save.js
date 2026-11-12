/* 核心｜儲存、匯出備份、雲端設定 */
/* ---------- save / export ---------- */
function selfDoc(){
  const reset=document.head.querySelector("style")?.textContent||"";
  const body=BODY_SRC.replace(/(<script id="state" type="application\/json">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+"\n"+JSON.stringify(state).replace(/</g,"\\u003c")+"\n"+b);
  return `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${reset}</style></head><body>${body}</body></html>`;
}
async function persist(msg){
  if(artifactNS){
    try{await artifactNS.publish(selfDoc());toast(msg||"已發布，所有人都會看到最新版");return true}
    catch(e){
      const c=e&&e.code;
      if(c==="conflict")toast("剛剛有人更新了看板，已載入最新版本");
      else if(c==="not_writer"||c==="not_granted"){canWrite=false;toast("你只有檢視權限，無法儲存");render()}
      else toast("發布失敗，請稍後再試");
      return false;
    }
  }
  if(cloudOn()){
    try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}
    const r=await cloudPush();renderHeader();
    toast(r.ok?(msg||"已儲存並同步到雲端，其他人約 1 分鐘內會看到"):r.msg);return r.ok;
  }
  try{localStorage.setItem(KEY,JSON.stringify(state));localOK=true;toast(msg||"已儲存並定型");return true}catch(e){localOK=false;toast("這個瀏覽器無法保存，請按「匯出備份」");return false}
}
function save(){
  state.savedAt=nowStr();if(meName())state.savedBy=meName();
  editing=false;dirty=false;render();
  persist().then(()=>{if(CFG.meeting)mtPushAll()});   /* 秘書處：改過的其他部門各自寫回 */
}
/* 匯出單一 HTML：把拆開的 CSS / JS / 設定檔全部打包回同一個檔案 */
async function exportBackup(){
  const s=JSON.parse(JSON.stringify(state));s.locked=false;if(!s.savedAt)s.savedAt=nowStr();
  /* 備份 = JSON（只有資料，用「匯入備份」還原） */
  const kind={mime:"application/json",ext:".json",desc:"JSON"},doc=JSON.stringify(s,null,1);
  const name=`${state.title.replace(/[\\/:*?"<>|]/g,"_")}_備份_${today()}.json`,label="備份";
  if(HOSTED){
    const dl=await window.claude.use("downloads");
    if(dl){try{await dl.save({filename:name,data:new Blob([doc],{type:kind.mime})});toast(`已下載${label}`)}catch(e){if(e&&e.code!=="declined")toast("下載失敗："+(e&&e.code||""))}return}
  }
  /* 1) real "Save as" dialog where the browser supports it: we know for sure whether it was saved */
  if(window.showSaveFilePicker){
    try{
      const h=await showSaveFilePicker({suggestedName:name,types:[{description:kind.desc,accept:{[kind.mime]:[kind.ext]}}]});
      const w=await h.createWritable();await w.write(doc);await w.close();
      toast(`已儲存${label}：${h.name||name}`);return;
    }catch(e){if(e&&e.name==="AbortError")return;/* blocked here: fall through */}
  }
  /* 2) classic download link; we cannot verify it, so offer fallbacks instead of claiming success */
  const url=URL.createObjectURL(new Blob([doc],{type:kind.mime}));
  try{const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove()}catch(_){}
  const f=$("#dlgForm"),d=$("#dlg");d.classList.remove("wide");
  f.innerHTML=`<b>匯出${label}</b><p class="sub" style="margin:0">已嘗試下載「${esc(name)}」。如果沒有看到檔案（有些檢視器或手機會擋下載），可以改用下面方式：</p>
    <div style="display:grid;gap:8px"><button type="button" data-x="open">在新分頁開啟 → 再用瀏覽器「另存新檔」</button><button type="button" data-x="copy">複製整份${kind.desc}內容</button></div>
    <div class="dlg-actions"><button type="button" class="primary" data-x="close">好，已經有檔案了</button></div>`;
  f.querySelectorAll("[data-x]").forEach(b=>b.onclick=async()=>{
    const x=b.dataset.x;
    if(x==="open"){const w=window.open(url,"_blank");if(!w)toast("新分頁被擋住了，請改用「複製原始碼」")}
    if(x==="copy"){await copyText(doc);toast(`已複製：貼到文字編輯器存成 ${kind.ext} 即可`)}
    if(x==="close")d.close();
  });
  d.onclose=()=>setTimeout(()=>URL.revokeObjectURL(url),60000);
  dlgOpen(true);
}
async function copyText(t){
  try{await navigator.clipboard.writeText(t);toast("已複製")}
  catch(e){const ta=document.createElement("textarea");ta.value=t;document.body.append(ta);ta.select();try{document.execCommand("copy");toast("已複製")}catch(_){toast("無法複製，請手動選取")}ta.remove()}
}
const findIssue=el=>state.issues.find(i=>i.id===el.closest("[data-issue]")?.dataset.issue);
const changed=()=>{dirty=true;render()};


/* ---------- 雲端設定與儲存流程 ---------- */
async function cloudSettings(){
    const c=cloudCfg();
    const v=await ask("雲端同步設定（GitHub）",[
      {name:"owner",label:"GitHub 帳號（或組織）",value:c.owner},
      {name:"repo",label:"Repo 名稱",value:c.repo},
      {name:"branch",label:"分支",value:c.branch},
      {name:"path",label:"資料檔路徑",value:c.path},
      ...(ghToken()?[{name:"tokact",label:"這台裝置已設定權杖",type:"select",value:"keep",options:[["keep","保持不變"],["clear","從這台裝置移除"]]}]:[]),
      {name:"token",label:ghToken()?"換新權杖（留空＝不變更）":"權杖（只存在這台裝置，不會放進網頁）",type:"password",value:""}],
      {wide:true,note:pagesRepo()?"這個網址上，帳號與 Repo 名稱一律依網址判斷；這兩欄只在其他網址（本機、自訂網域）使用。":""});
    if(!v)return false;
    state.sync={owner:v.owner,repo:v.repo,branch:v.branch||"main",path:v.path||"data.json"};dirty=true;
    try{const nt=(v.token||"").trim();if(nt){localStorage.setItem(TOKEN_KEY,nt);siteAdminMark()}else if(v.tokact==="clear")localStorage.removeItem(TOKEN_KEY)}catch(_){}
    {const nt=(v.token||"").trim(),me=meMember();if(nt&&me&&(sessionPw||await needPw()))me.tok=await encToken(nt,sessionPw)}
    cloud={sha:null,etag:null,status:"",last:""};
    let res=await cloudPull({force:true});
    if(res==="pending"&&cloud.pending){const ok=await ask("雲端已經有看板資料，要載入雲端的內容嗎？",[],{danger:"載入雲端內容"});
      if(ok==="delete"){const keep=state.sync;state=cloud.pending.state;state.sync=keep;cloud.sha=cloud.pending.sha;snapshot=JSON.stringify(state);dirty=true;render();res="same"}else{cloud.sha=cloud.pending.sha;res="kept"}
      cloud.pending=null}
    renderHeader();
    toast({same:"已連上雲端",updated:"已連上雲端（目前編輯中，按取消可載入雲端內容）",pending:"已連上雲端（目前編輯中，按取消可載入雲端內容）",kept:"已連上雲端；儲存時會以目前畫面的內容覆蓋雲端",empty:"已連上 repo，第一次儲存時會建立 "+(v.path||"data.json"),limited:"GitHub 讀取次數暫時用完，請稍後再試",offline:"連不上 GitHub",error:"讀取失敗：請確認帳號、repo、分支與權杖",off:"設定未完成"}[res]||"已更新設定");
  return true;
}
/* 儲存前：這台裝置還沒有權杖就先問；順手把權杖加密存進身分／共用密碼。取消就回傳 null */
async function prepareSave(){
  if(cloudOn()&&!ghToken()){
    const c=cloudCfg();
    /* 一般成員沒有權杖：說清楚是部門還沒開通（或要重新登入），不要讓人以為存到雲端了；有權杖的管理員才貼上 */
    const ready=!!(state.sync&&(state.sync.tokenEnc||state.sync.tokenAll));
    const note=(ready?"這個部門已經開通雲端，但這台裝置還沒拿到上傳權限。請按「取消」，重新整理後再到設定頁登入一次，就會自動連上。"
         :"這個部門還沒開通雲端。按「只存在這台裝置」的話，資料只留在這個瀏覽器，其他人、其他裝置都看不到。\n請通知學生會：後台管理員打開自己電腦上的看板就會自動開通，之後重新登入即可。");
    /* 貼權杖的欄位只給後台管理員（cloud.js 的 siteAdmin）；一般成員只看到說明（2026-11-06 使用者：其他人不要處理雲端、權杖） */
    const v=siteAdmin()
      ?await ask("這台裝置沒有連上雲端",[{name:"token",label:"學生會管理員：貼上 GitHub 權杖",type:"password"}],
        {danger:"只存在這台裝置",alt:"進階設定",note:note+`\n（雲端位置：${c.owner}/${c.repo}，公開的網站，所有人都看得到看板內容）`,
         validate:o=>(o.token||"").trim()?"":"沒有權杖的話，請按「只存在這台裝置」或「取消」"})
      :await ask("這台裝置沒有連上雲端",[],{danger:"只存在這台裝置",note});
    if(v==="alt"){if(!(await cloudSettings()))return null;}
    else if(v&&v.token){try{localStorage.setItem(TOKEN_KEY,v.token.trim())}catch(_){}siteAdminMark()}
    else if(v===null)return null;
  }
  let weak=false;
  const me=meMember();
  if(ghToken()&&me&&!me.tok&&sessionPw)me.tok=await encToken(ghToken(),sessionPw);
  if(ghToken()&&sharedPwSession&&!(state.sync&&state.sync.tokenEnc))weak=sharedPwSession.length<8;   /* 共用密碼太短的提醒照舊；不再寫 tokenEnc（auth.js 的 dropSharedToken） */
  return {weak};
}
async function saveFlow(){
  const p=await prepareSave();if(!p)return;
  morph(()=>save());
  if(p.weak&&isAdmin())setTimeout(()=>sharedPwFix(),2600);   /* 共用密碼太短：直接請管理員換一組（team.js） */
  else if(p.weak)setTimeout(()=>toast("提醒：部門共用密碼太短，新成員建立身分時拿不到上傳權限；請管理員到「身分與專員」把共用密碼改成 12 碼以上"),2600);
}
/* 設定頁的變更：編輯中就併入這次編輯（按儲存才上傳）；沒在編輯就直接儲存並同步 */
async function settingSave(apply,msg){
  if(editing){if(apply()===false)return false;dirty=true;render();toast(msg+"（按編輯中那張卡片的「儲存」後才會上傳）");return true}
  const p=await prepareSave();if(!p)return false;
  if(apply()===false)return false;
  state.savedAt=nowStr();if(meName())state.savedBy=meName();
  render();const ok=await persist(msg);dirty=false;return ok;
}
