/* 核心｜開通部門（全會）：讓各部門的人不用自己弄 GitHub 權杖也能上傳。
   誰用：有 GitHub 權杖的學生會管理員，在自己已經連上雲端的裝置上（設定 →「開通部門」）。
   做什麼：設一組「全會初始密碼」（至少 12 碼），對勾選的部門：
     - 雲端還沒有資料檔：建立一份空白看板（data-代號.json），共用密碼＝初始密碼，上傳權限（權杖）用初始密碼加密存進去；
     - 已經有資料檔：只換共用密碼（pwKdf）與加密的權杖（sync.tokenEnc），看板內容、身分都不動，舊的共用密碼失效。
     兩種都標 sync.initial＝true（部門第一位管理員登入後，team.js 會請他換成部門自己的共用密碼）。
   之後部門的人：按「編輯」→ 輸入初始密碼 → 建立身分（第一位是管理員）→ 自動連上雲端（auth.js 的 unlockShared 解開權杖）。
   資料存在哪、誰看得到：各部門資料檔在公開的 repo，任何人都下載得到，但權杖是加密的，沒有初始密碼（或部門共用密碼、個人密碼）解不開；
   知道密碼的人就能寫入整個 repo（所有部門），所以初始密碼只交給各部部長。
   權杖不會顯示在畫面或 console。 */
const PV_ST={none:"雲端還沒有資料檔",nokey:"已有資料檔，但新成員連不上雲端",ok:"已開通（新成員可以連上）",err:"讀取失敗"};
async function pvStatus(d){
  const c={...cloudCfg(),path:d.path},h={Accept:"application/vnd.github+json",Authorization:"Bearer "+ghToken()};
  try{
    const r=await fetch(apiURL(c)+"?ref="+encodeURIComponent(c.branch)+"&t="+Date.now(),{headers:h,cache:"no-store"});
    if(r.status===404)return {d,st:"none"};
    if(!r.ok)return {d,st:"err",code:r.status};
    const j=await r.json(),data=JSON.parse(b64dec(j.content));
    return {d,st:data.sync&&data.sync.tokenEnc?"ok":"nokey",sha:j.sha,data};
  }catch(_){return {d,st:"err"}}
}
async function pvWrite(x,pw){
  const c={...cloudCfg(),path:x.d.path},h={Accept:"application/vnd.github+json",Authorization:"Bearer "+ghToken(),"Content-Type":"application/json"};
  const fresh=!x.data,data=fresh?{schemaVersion:SCHEMA_VERSION,id:x.d.boardId,title:`${x.d.name}工作進度`,members:[],issues:[],events:[],weeks:[]}:x.data;
  data.pwKdf=await kdfMake(pw);delete data.pwHash;
  data.sync={...(data.sync||{}),tokenEnc:await encToken(ghToken(),pw),initial:true};
  const who=meName()||"學生會管理員";
  const body={message:`〔${who}〕設定｜${fresh?"開通雲端（建立看板）":"重設共用密碼並開通雲端"}\n\n用全會初始密碼開通；新成員輸入初始密碼後會自動連上雲端。\n\nBoard-Log: 1`,content:b64enc(JSON.stringify(data,null,1)),branch:c.branch};
  if(x.sha)body.sha=x.sha;
  try{const r=await fetch(apiURL(c),{method:"PUT",headers:h,body:JSON.stringify(body)});
    return r.ok?"":r.status===409||r.status===422?"剛好有人存過，請重新開啟這個畫面再試":r.status===401?"權杖無效或過期":r.status===403||r.status===404?"權杖沒有寫入權限":"失敗（"+r.status+"）"}
  catch(_){return "連不上 GitHub"}
}
async function provisionDepts(){
  if(!cloudOn()||!ghToken()){await ask("這台裝置沒有權杖",[],{note:"開通部門要在已經連上雲端（貼過 GitHub 權杖）的裝置上做。請到「雲端同步」貼上權杖後再來。"});return}
  if(editing){await ask("請先結束編輯",[],{note:"開通會直接寫入各部門的雲端資料。請先按「儲存並同步」或「取消」，再開通。"});return}
  toast("讀取各部門的狀態…");
  const list=await Promise.all(BOARD_DEPTS.map(pvStatus));
  const first=BOARD_DEPTS[0].id;
  const fields=[...list.map(x=>({name:"d_"+x.d.id,type:"check",label:`${x.d.name}：${PV_ST[x.st]}${x.st==="err"&&x.code?`（${x.code}）`:""}`,value:x.st==="none"||x.st==="nokey"&&x.d.id!==first})),
    {name:"p1",label:`全會初始密碼（至少 ${MIN_PW} 碼）`,type:"password"},{name:"p2",label:"再輸入一次",type:"password"}];
  const v=await ask("開通部門（全會）",fields,{wide:true,
    note:"勾選要開通的部門，設一組全會初始密碼，交給各部部長。部長按「編輯」、輸入初始密碼、建立身分（第一位是管理員），就會自動連上雲端。\n已有資料檔的部門：只換共用密碼與上傳權限，看板內容、身分都不動，舊的共用密碼失效。\n權杖用初始密碼加密後存在公開的資料檔裡；知道密碼的人就能寫入整個網站的資料，請只交給部長。",
    validate:o=>{if(!list.some(x=>o["d_"+x.d.id]))return "請至少勾一個部門";if(list.some(x=>o["d_"+x.d.id]&&x.st==="err"))return "有勾選的部門讀取失敗，先取消勾選或稍後再試";return pwProblem(o.p1||"",o.p2||"","初始密碼")}});
  if(!v)return;
  const pick=list.filter(x=>v["d_"+x.d.id]),reset=pick.filter(x=>x.data);
  if(reset.length){const ok=await ask("確認重設共用密碼",[],{danger:"確認開通",note:`${reset.map(x=>x.d.name).join("、")} 已經有資料，共用密碼會換成這組初始密碼，舊的共用密碼就不能用了。看板內容與身分不會變；已經有身分的人照常用個人密碼登入。`});
    if(ok!=="delete")return}
  const res=[];for(const x of pick){res.push([x,await pvWrite(x,v.p1)])}
  const bad=res.filter(r=>r[1]),good=res.filter(r=>!r[1]);
  if(good.some(([x])=>x.d.id===CFG.deptId)){cloud.etag=null;await cloudPull({force:true});render()}   /* 開通的是目前這個部門：載入新的設定 */
  await ask(bad.length?"部分部門沒有開通":"開通完成",[],{note:(good.length?`已開通：${good.map(([x])=>x.d.name).join("、")}。把初始密碼交給這些部門的部長，請他們打開自己部門的看板，按「編輯」輸入初始密碼。`:"")+(bad.length?`\n沒有開通：${bad.map(([x,m])=>`${x.d.name}（${m}）`).join("、")}`:"")});
}
