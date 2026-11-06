/* 核心｜全會密碼與自動開通（2026-11-06 第二版，取代原本「開通部門」的手動勾選與初始密碼）
   使用者要求：部門的人第一次進系統不要處理雲端、權杖貼上；第一個開通的人也不用透過有權杖的管理員說明操作。
   做法：
   - 後台管理員（這台裝置有權杖、cloud.js 的 siteAdmin）在「設定 → 網站管理 → 全會密碼」設一次全會密碼（至少 12 碼）。
     看板用它把權杖加密成一份 tokenAll，存在這台裝置（ALL_KEY，只存加密後的，不存密碼）。
   - 自動開通（pvAuto）：後台管理員的裝置打開任何部門的看板時（最多每 10 分鐘一次，boot.js），逐一檢查所有部門的資料檔：
       沒有資料檔＝建立空白看板（只有 tokenAll，沒有部門共用密碼）；有資料檔但 tokenAll 不是最新的＝只補上 sync.tokenAll，其他內容、各部門的共用密碼都不動。
   - 部門的人：設定 → 登入 → 輸入學生會給的全會密碼（或部門自己的共用密碼）→ 取名字、設個人密碼 → 自動連上雲端（team.js 的 unlockEdit、auth.js 的 sharedKind／tokenFromShared）。
   - 權杖換新（後台管理員貼了新的權杖）：這台裝置存的 tokenAll 還是舊權杖加密的（用權杖指紋 fp 判斷），要再輸入一次全會密碼才會更新到各部門。
   資料存在哪、誰看得到：tokenAll 在各部門的資料檔（公開的 repo，任何人都下載得到），但沒有全會密碼解不開；
   知道全會密碼的人能加入任何部門，也就能寫入整個 repo，所以全會密碼只交給各部門的人。權杖不會顯示在畫面或 console。
   測試部門（dept/config.js 的 test:true，水果部）：後台管理員可以「重置」，回到剛開通的狀態（pvReset）。 */
const ALL_KEY="workboard:tokenall";
function allRead(){try{const a=JSON.parse(localStorage.getItem(ALL_KEY)||"null");return a&&a.blob?a:null}catch(_){return null}}
async function tokPrint(t){const h=await crypto.subtle.digest("SHA-256",_te.encode(String(t||"")));return toB64(new Uint8Array(h)).slice(0,16)}
const allFresh=async a=>!!(a&&ghToken()&&a.fp===await tokPrint(ghToken()));   /* 這台裝置的 tokenAll 是不是用目前這把權杖加密的 */
/* 空白看板：雲端位置照這台裝置的設定寫進去（github.io 上本來就會自動判斷，寫明了在其他網址也連得上） */
const pvBlank=d=>{const c=cloudCfg();return {schemaVersion:SCHEMA_VERSION,id:d.boardId,title:`${d.name}工作進度`,members:[],issues:[],events:[],weeks:[],savedAt:nowStr(),sync:{owner:c.owner,repo:c.repo,branch:c.branch,path:d.path}}};
async function pvStatus(d){
  const c={...cloudCfg(),path:d.path},h={Accept:"application/vnd.github+json",Authorization:"Bearer "+ghToken()};
  try{
    const r=await fetch(apiURL(c)+"?ref="+encodeURIComponent(c.branch)+"&t="+Date.now(),{headers:h,cache:"no-store"});
    if(r.status===404)return {d,st:"none"};
    if(!r.ok)return {d,st:"err",code:r.status};
    const j=await r.json();return {d,st:"ok",sha:j.sha,data:JSON.parse(b64dec(j.content))};
  }catch(_){return {d,st:"err"}}
}
async function pvPut(d,data,sha,what){
  const c={...cloudCfg(),path:d.path},h={Accept:"application/vnd.github+json",Authorization:"Bearer "+ghToken(),"Content-Type":"application/json"};
  const who=meName()||"學生會管理員";
  const body={message:`〔${who}〕設定｜${what}\n\n全會密碼自動開通（provision.js）。\n\nBoard-Log: 1`,content:b64enc(JSON.stringify(data,null,1)),branch:c.branch};
  if(sha)body.sha=sha;
  try{const r=await fetch(apiURL(c),{method:"PUT",headers:h,body:JSON.stringify(body)});
    return r.ok?"":r.status===409||r.status===422?"剛好有人存過，下次再補":r.status===401?"權杖無效或過期":r.status===403||r.status===404?"權杖沒有寫入權限":"失敗（"+r.status+"）"}
  catch(_){return "連不上 GitHub"}
}
/* 自動開通：report＝true 時不看間隔、回傳結果給畫面顯示；否則安靜地做（最多每 10 分鐘一次） */
let pvBusy=false;
async function pvAuto(report){
  if(pvBusy||!siteAdmin()||!cloudOn()||!ghToken()||!hasSubtle())return null;
  const a=allRead();if(!a)return null;
  if(!(await allFresh(a))){if(!report)toast("權杖換過了：到「設定 → 網站管理 → 全會密碼」再輸入一次，各部門才會用新的權杖");return {stale:true}}
  if(!report){try{const t=+localStorage.getItem(ALL_KEY+":at")||0;if(Date.now()-t<6e5)return null;localStorage.setItem(ALL_KEY+":at",String(Date.now()))}catch(_){}}
  pvBusy=true;const out={made:[],fixed:[],bad:[]};
  try{
    for(const d of BOARD_DEPTS){
      if(d.id===CFG.deptId&&editing)continue;   /* 自己這個部門正在編輯：下次再補，免得儲存時跟雲端衝突 */
      const x=await pvStatus(d);if(x.st==="err"){out.bad.push(`${d.name}（讀取失敗${x.code?"，"+x.code:""}）`);continue}
      if(x.data&&JSON.stringify((x.data.sync||{}).tokenAll||null)===JSON.stringify(a.blob))continue;
      const data=x.data||pvBlank(d);data.sync={...(data.sync||{}),tokenAll:a.blob};
      const e=await pvPut(d,data,x.sha,x.data?"補上全會密碼的上傳權限":"開通雲端（建立看板）");
      if(e)out.bad.push(`${d.name}（${e}）`);else (x.data?out.fixed:out.made).push(d.name);
    }
  }finally{pvBusy=false}
  if([...out.made,...out.fixed].includes(CFG.dept.name)&&!editing){cloud.etag=null;await cloudPull({force:true});render()}   /* 自己這個部門剛更新：載入雲端的新版本 */
  return out;
}
const allSub=()=>allRead()?"已設定：各部門自動開通，部門的人用這組密碼加入":"還沒設定：設定後各部門自動開通，部門的人不用碰權杖";
/* 設定 → 網站管理 → 全會密碼 */
async function allPwSet(){
  if(!cloudOn()||!ghToken()){await ask("這台裝置沒有權杖",[],{note:"全會密碼要在已經連上雲端（貼過 GitHub 權杖）的裝置上設定。請先到「雲端同步」貼上權杖。"});return}
  if(editing){await ask("請先結束編輯",[],{note:"設定全會密碼會直接寫入各部門的雲端資料。請先把編輯中的那張卡片按「儲存」或「取消」。"});return}
  const old=allRead();
  const v=await ask(old?"更改全會密碼":"設定全會密碼",[{name:"p1",label:`全會密碼（至少 ${MIN_PW} 碼）`,type:"password"},{name:"p2",label:"再輸入一次",type:"password"}],
    {note:"全會密碼交給各部門的人：第一次使用時在設定頁按「登入」，輸入這組密碼、取名字、設個人密碼，就會自動連上雲端，不用碰權杖。"
      +"\n設定後，這台裝置每次打開看板都會自動檢查各部門：沒有看板的建立、缺上傳權限的補上（各部門現有的內容與共用密碼都不動）。"
      +(old?"\n改了以後舊的全會密碼就不能用來加入（已經加入的人不受影響）。換了新權杖也要在這裡再輸入一次。":"")
      +"\n上傳權限用這組密碼加密後放在公開的資料檔，所以密碼要夠長、只交給各部門的人。",
     validate:o=>pwProblem(o.p1||"",o.p2||"","全會密碼")});
  if(!v)return;
  const a={blob:await encToken(ghToken(),v.p1),fp:await tokPrint(ghToken())};
  try{localStorage.setItem(ALL_KEY,JSON.stringify(a))}catch(_){await ask("沒有存起來",[],{note:"這個瀏覽器不能保存資料，請換一個瀏覽器再設定。"});return}
  toast("正在更新各部門…");
  const r=await pvAuto(true);if(!r)return;
  await ask(r.bad.length?"部分部門沒有更新":"全會密碼已設定",[],{note:
    (r.made.length?`新建立看板：${r.made.join("、")}\n`:"")+(r.fixed.length?`補上上傳權限：${r.fixed.join("、")}\n`:"")
    +(r.bad.length?`沒有更新：${r.bad.join("、")}（下次打開看板會再試）\n`:"")
    +"把全會密碼交給各部門的人就好，他們不用做任何雲端設定。"});
  renderSettings();
}
/* 重置測試部門（只有 test:true 的部門）：回到剛開通的狀態（身分、內容全部清空，只留全會密碼的上傳權限） */
async function pvReset(id){
  const d=BOARD_DEPTS.find(x=>x.id===id&&x.test),a=allRead();if(!d)return;
  if(!a||!(await allFresh(a))){await ask("請先設定全會密碼",[],{note:"重置後的部門要用全會密碼加入，請先在「全會密碼」設定（或換了權杖後再輸入一次）。"});return}
  if(editing&&CFG.deptId===d.id){await ask("請先結束編輯",[],{note:"請先把編輯中的那張卡片按「儲存」或「取消」。"});return}
  const ok=await ask(`重置${d.name}`,[],{danger:"重置",note:`${d.name}會回到剛開通的狀態：身分、議題、即時回報、週報、標籤全部清空（只有測試部門可以重置）。\n重置後在設定頁按「登入」、輸入全會密碼，就能重新走一次第一位成員的流程。要模擬全新的裝置，請用無痕視窗打開（一般視窗裡已經存著上傳權限）。`});
  if(ok!=="delete")return;
  const x=await pvStatus(d);if(x.st==="err"){await ask("重置失敗",[],{note:"讀取失敗，請稍後再試。"});return}
  const data=pvBlank(d);Object.assign(data.sync,{tokenAll:a.blob,resetAt:nowStr()});
  const e=await pvPut(d,data,x.sha,"重置測試部門");
  if(e){await ask("重置失敗",[],{note:e});return}
  if(CFG.deptId===d.id){try{localStorage.removeItem(KEY)}catch(_){}remClear();meId="";location.reload();return}
  toast(`${d.name}已重置`);
}
