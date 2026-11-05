/* 核心｜編輯身分（也是卡片上的專員）、編輯紀錄 */
const MIN_PW=12;
const ME_KEY="workboard:me:"+state.id;
let meId="",sharedPwSession="";   /* 只存在記憶體，不寫進資料 */
const meMember=()=>state.members.find(x=>x.id===meId)||null;
const meName=()=>(meMember()||{}).name||"";
const isAdmin=()=>(meMember()||{}).role==="admin";
const adminCount=()=>state.members.filter(m=>m.role==="admin").length;
/* 記住這台裝置：只存身分和「密碼雜湊的指紋」（不存密碼、不上傳）；密碼一改指紋就對不上，自動失效 */
const REM_KEY="workboard:remember:"+state.id;
function remRead(){try{return JSON.parse(localStorage.getItem(REM_KEY)||"null")}catch(_){return null}}
function remClear(){try{localStorage.removeItem(REM_KEY)}catch(_){}}
async function kdfPrint(kdf){const h=await crypto.subtle.digest("SHA-256",_te.encode(String(kdf||"")));return toB64(new Uint8Array(h)).slice(0,22)}
async function remSave(m){try{localStorage.setItem(REM_KEY,JSON.stringify({id:m.id,fp:await kdfPrint(m.kdf)}))}catch(_){}}
async function remLogin(){
  const r=remRead();if(!r||!hasSubtle())return false;
  const m=state.members.find(x=>x.id===r.id);
  if(!m||r.fp!==await kdfPrint(m.kdf)){remClear();return false}
  if(cloudOn()&&!ghToken()&&m.tok)return false;   /* 這台裝置的權杖不見了：要輸入密碼才解得開 */
  meId=m.id;try{localStorage.setItem(ME_KEY,m.id)}catch(_){}
  return true;
}
const loggedIn=()=>!!meMember();
/* 需要登入的操作（進入編輯、設定頁各項）共用：這次已經登入就直接通過 */
async function ensureLogin(){
  if(loggedIn())return true;
  if(await remLogin()){toast(`已用這台裝置記住的身分登入：${meName()}`);return true}
  return unlockEdit();
}
/* 用記住的裝置登入時手上沒有密碼；要加密新權杖時再問一次 */
async function needPw(){
  const me=meMember();if(sessionPw||!me)return !!sessionPw;
  const v=await ask("輸入個人密碼",[{name:"pw",label:`${me.name} 的個人密碼（用來加密新權杖，其他裝置登入後才會自動連上）`,type:"password"}]);
  if(v&&await kdfCheck(me.kdf,v.pw)){sessionPw=v.pw;return true}
  if(v)toast("密碼不正確，新權杖只存在這台裝置");return false;
}
async function kdfMake(pw){const salt=toB64(crypto.getRandomValues(new Uint8Array(16)));return salt+":"+await kdfHash(pw,salt)}
async function kdfCheck(stored,pw){if(!stored||!pw)return false;const [s,h]=stored.split(":");try{return (await kdfHash(pw,s))===h}catch(_){return false}}

/* ---------- 進入編輯：選身分＋個人密碼 ---------- */
async function unlockEdit(){
  if(!hasSubtle()){toast("這個瀏覽器不支援加密功能，無法使用編輯身分");return false}
  if(!state.members.length){
    /* 舊版看板：先用現有的共用密碼登入，再建立第一個個人身分 */
    const pw=await unlockShared("輸入目前的編輯密碼");if(pw===null)return false;
    sharedPwSession=pw;
    const ok=await createMember(true);if(!ok)return false;
    if(pw.length<MIN_PW)setTimeout(()=>toast(`提醒：共用密碼少於 ${MIN_PW} 碼，建議到「身分與專員」更換`),2800);
    return true;
  }
  let last="";try{last=localStorage.getItem(ME_KEY)||""}catch(_){}
  for(;;){
    const opts=state.members.map(m=>[m.id,m.name+(m.role==="admin"?"（管理員）":"")]);
    const v=await ask("選擇編輯身分",[{name:"who",label:"我是",type:"select",value:last||opts[0][0],options:opts},{name:"pw",label:"個人密碼",type:"password"},{name:"rem",label:"在這個裝置上記住密碼",type:"check"}],{alt:"＋ 新增身分"});
    if(v===null)return false;
    if(v==="alt"){
      const pw=await unlockShared("新增身分：先輸入部門共用密碼");if(pw===null)continue;
      sharedPwSession=pw;if(await createMember(false))return true;continue;
    }
    const m=state.members.find(x=>x.id===v.who);last=v.who;
    if(m&&await kdfCheck(m.kdf,v.pw)){
      meId=m.id;sessionPw=v.pw;try{localStorage.setItem(ME_KEY,m.id)}catch(_){}
      if(v.rem)await remSave(m);
      if(!ghToken()&&m.tok){try{localStorage.setItem(TOKEN_KEY,await decToken(m.tok,v.pw));toast("已自動連上雲端")}catch(_){}}
      return true;
    }
    toast("密碼錯誤");
  }
}
async function askNewPassword(title,extra=[]){
  for(;;){
    const v=await ask(title,[...extra,{name:"p1",label:`個人密碼（至少 ${MIN_PW} 碼）`,type:"password"},{name:"p2",label:"再輸入一次",type:"password"}]);
    if(!v||v==="alt")return null;
    if(extra.some(f=>f.name==="name")){const n=(v.name||"").trim();if(!n){toast("請填名字");extra=extra.map(f=>({...f,value:v[f.name]}));continue}
      if(state.members.some(m=>m.name===n)){toast("已經有同名的身分");extra=extra.map(f=>({...f,value:v[f.name]}));continue}}
    if((v.p1||"").length<MIN_PW){toast(`密碼至少要 ${MIN_PW} 碼`);extra=extra.map(f=>({...f,value:v[f.name]}));continue}
    if(v.p1!==v.p2){toast("兩次輸入的密碼不一樣");extra=extra.map(f=>({...f,value:v[f.name]}));continue}
    return v;
  }
}
async function createMember(first){
  const v=await askNewPassword(first?"建立你的編輯身分（第一位會是管理員）":"新增編輯身分",[{name:"name",label:"名字（會顯示在編輯紀錄）",ph:"例如：王小明"}]);
  if(!v)return false;
  const m={id:uid("m"),name:v.name.trim(),role:first?"admin":"member",kdf:await kdfMake(v.p1),createdAt:nowStr()};
  let tk=ghToken();
  if(!tk&&state.sync&&state.sync.tokenEnc&&sharedPwSession){try{tk=await decToken(state.sync.tokenEnc,sharedPwSession);localStorage.setItem(TOKEN_KEY,tk)}catch(_){tk=""}}
  if(tk)m.tok=await encToken(tk,v.p1);
  state.members.push(m);meId=m.id;sessionPw=v.p1;try{localStorage.setItem(ME_KEY,m.id)}catch(_){}
  await persist(`已建立身分「${m.name}」`);
  return true;
}

/* ---------- 身分與專員（設定） ---------- */
function teamHTML(){
  const me=meMember(),adm=isAdmin();
  const rows=state.members.map(m=>`<li class="tm-row"><span class="tm-name">${esc(m.name)}</span>${m.role==="admin"?'<span class="tm-pill on">管理員</span>':""}${m.id===meId?'<span class="tm-pill">我</span>':""}
    <span class="tm-act">${m.id===meId?'<button type="button" class="icon" data-x="mypw">改個人密碼</button>':""}${adm?`<button type="button" class="icon" data-x="role" data-id="${m.id}">${m.role==="admin"?"取消管理員":"設為管理員"}</button><button type="button" class="icon danger" data-x="del" data-id="${m.id}">刪除</button>`:""}</span></li>`).join("");
  return `<b>身分與專員</b>
  <section class="tm-sec"><div class="att-h">編輯身分${me?`（目前：${esc(me.name)}）`:""}</div><ul class="tm-list">${rows||'<li class="sub">還沒有身分</li>'}</ul>
    <p class="sub tm-note">即時回報與議題上的「專員」就是從這些身分挑選；沒有身分的人不能被標。新成員：按「編輯」→「＋ 新增身分」，輸入部門共用密碼後自己設定個人密碼。${adm?"":"刪除身分、指定管理員需要管理員。"}</p>
    ${adm?'<div class="tm-tools"><button type="button" class="ghost" data-x="sharedpw">更改部門共用密碼</button></div>':""}</section>
  <p class="sub tm-note">${editing?"變更會在按「儲存並同步」後生效。":"按「完成」後會直接儲存並同步。"}</p>
  <div class="dlg-actions"><button type="button" class="primary" data-x="done">完成</button></div>`;
}
async function teamSettings(){
  const d=$("#dlg"),f=$("#dlgForm");d.classList.add("wide");
  const paint=()=>{f.innerHTML=teamHTML();bind()};
  const reopen=()=>{paint();d.oncancel=ev=>{ev.preventDefault();f.querySelector('[data-x="done"]')?.click()};if(!d.open)dlgOpen(false)};
  const leave=async()=>{d.oncancel=null;d.onclose=null;if(d.open)await new Promise(r=>{d.addEventListener("close",()=>setTimeout(r,0),{once:true});d.close()})};
  const bind=()=>{
    f.onsubmit=ev=>ev.preventDefault();
    f.querySelectorAll("[data-x]").forEach(b=>b.onclick=async()=>{
      const x=b.dataset.x,id=b.dataset.id,m=state.members.find(y=>y.id===id);
      if(x==="done"){await leave();d.classList.remove("wide");if(editing)changed();else if(dirty)await settingSave(()=>{},"已更新身分與專員");else render();finish();return}
      if(x==="role"&&m){if(m.role==="admin"&&adminCount()<=1){toast("至少要保留一位管理員");return}m.role=m.role==="admin"?"member":"admin";dirty=true;paint();return}
      if(x==="del"&&m){
        if(m.role==="admin"&&adminCount()<=1){toast("至少要保留一位管理員");return}
        await leave();const ok=await ask(`刪除編輯身分「${m.name}」？${m.id===meId?"（這是你自己）":""}`,[],{danger:"刪除身分"});
        if(ok==="delete"){state.members=state.members.filter(y=>y!==m);[...state.issues,...state.events].forEach(o=>{if(o.staff)o.staff=o.staff.filter(s=>s!==m.id)});dirty=true}
        reopen();return}
      if(x==="mypw"){await leave();const me=meMember();
        const old=await ask("更改個人密碼",[{name:"old",label:"目前的個人密碼",type:"password"}]);
        if(old&&me){if(!(await kdfCheck(me.kdf,old.old))){toast("目前密碼不正確");reopen();return}
          const v=await askNewPassword("設定新的個人密碼");
          if(v){me.kdf=await kdfMake(v.p1);sessionPw=v.p1;if(ghToken())me.tok=await encToken(ghToken(),v.p1);else delete me.tok;dirty=true;toast("個人密碼已更改，儲存後生效")}}
        reopen();return}
      if(x==="sharedpw"){await leave();
        const old=await ask("更改部門共用密碼",[{name:"old",label:"目前的共用密碼",type:"password"}]);
        if(old){if(!(await checkPw(old.old||""))){toast("目前共用密碼不正確");reopen();return}
          for(;;){const v=await ask("新的部門共用密碼",[{name:"n1",label:`新密碼（至少 ${MIN_PW} 碼，新成員建立身分時要用）`,type:"password"},{name:"n2",label:"再輸入一次",type:"password"}]);
            if(!v)break;if((v.n1||"").length<MIN_PW){toast(`至少要 ${MIN_PW} 碼`);continue}if(v.n1!==v.n2){toast("兩次輸入不一樣");continue}
            await setPw(v.n1);sharedPwSession=v.n1;
            if(ghToken()){await rememberToken(ghToken(),v.n1)}else if(state.sync)delete state.sync.tokenEnc;
            dirty=true;toast("共用密碼已更改，儲存後生效");break}}
        reopen();return}
    });
  };
  /* 按「完成」並儲存後才結束（設定頁右側面板靠這個知道何時收起） */
  let finish;return new Promise(r=>{finish=r;reopen()});
}

/* ---------- 專員標籤 ---------- */
/* 專員＝本看板的編輯身分（members）；ev.staff／issues[].staff 存 member id（schemaVersion 8 起） */
const staffOpts=()=>state.members.map(m=>[m.id,m.name]);
const staffNames=ids=>(ids||[]).map(id=>state.members.find(m=>m.id===id)).filter(Boolean).map(m=>m.name);
function staffHTML(ids){
  const names=staffNames(ids);
  return names.length?`<div class="staff-row"><span class="staff-h">專員</span>${names.map(n=>`<span class="staff-chip">${esc(n)}</span>`).join("")}</div>`:"";
}
const staffField=v=>state.members.length?[{name:"staff",label:"專員（可複選）",type:"multi",value:v||[],options:staffOpts()}]:[];

/* ---------- 編輯紀錄：存檔時比對前後，寫成結構化的 commit 訊息 ---------- */
let baseline=null;
const setBaseline=()=>{baseline=JSON.parse(JSON.stringify(state))};
function diffState(a,b){
  const L=[],byId=x=>new Map((x||[]).map(o=>[o.id,o])),same=(x,y)=>JSON.stringify(x??null)===JSON.stringify(y??null);
  const rng=i=>i.start&&i.end?`${fmt(i.start).slice(5)}~${fmt(i.end).slice(5)}`:"未排";
  const sname=id=>(b.members||[]).concat(a.members||[]).find(s=>s.id===id)?.name||"?";
  const staffD=(o,x,cat,t)=>{const A=new Set(o||[]),B=new Set(x||[]);const add=[...B].filter(i=>!A.has(i)).map(sname),rm=[...A].filter(i=>!B.has(i)).map(sname);
    if(add.length||rm.length)L.push(`${cat}｜專員${add.length?" +"+add.join("、"):""}${rm.length?" −"+rm.join("、"):""}｜${t}`)};
  const lname=id=>{const l=(b.labels||[]).concat(a.labels||[]).find(x=>x.id===id);return l?l.kind+"·"+l.name:"?"};
  const lblD=(o,x,cat,t)=>{const A=new Set(o||[]),B=new Set(x||[]);const add=[...B].filter(i=>!A.has(i)).map(lname),rm=[...A].filter(i=>!B.has(i)).map(lname);
    if(add.length||rm.length)L.push(`${cat}｜標籤${add.length?" +"+add.join("、"):""}${rm.length?" −"+rm.join("、"):""}｜${t}`)};
  const linkD=(o,x,cat,t)=>{const A=byId(o),B=byId(x);for(const [k,l] of B){if(!A.has(k))L.push(`${cat}｜新增連結「${l.name}」｜${t}`);else if(!same(A.get(k),l))L.push(`${cat}｜修改連結「${l.name}」｜${t}`)}for(const [k,l] of A)if(!B.has(k))L.push(`${cat}｜刪除連結「${l.name}」｜${t}`)};
  [["title","看板名稱"],["yearLabel","學年"],["termStart","開學日"]].forEach(([k,t])=>{if((a[k]||"")!==(b[k]||""))L.push(`看板｜${t} ${a[k]||"（空）"}→${b[k]||"（空）"}`)});
  if(!same(a.range,b.range))L.push("看板｜調整時間軸範圍");
  /* 議題 */
  const AI=byId(a.issues),BI=byId(b.issues);
  for(const [id,x] of BI){const o=AI.get(id),t=x.title;
    if(!o){L.push(`議題｜新增｜${t}`);continue}
    if(o.title!==x.title)L.push(`議題｜改名 ${o.title}→${x.title}`);
    const st=i=>(i.tags||[])[i.cur]||"";
    if(st(o)!==st(x))L.push(`議題｜階段 ${st(o)||"—"}→${st(x)||"—"}｜${t}`);else if(!same(o.tags,x.tags))L.push(`議題｜修改階段標籤｜${t}`);
    if((o.start||"")!==(x.start||"")||(o.end||"")!==(x.end||""))L.push(`議題｜時程 ${rng(o)}→${rng(x)}｜${t}`);
    if((o.note||"")!==(x.note||""))L.push(`議題｜更新進度說明｜${t}`);
    if((o.doneAt||"")!==(x.doneAt||""))L.push(!o.doneAt?`議題｜結案｜${t}`:!x.doneAt?`議題｜取消結案｜${t}`:`議題｜結案日期 ${fmt(x.doneAt)}｜${t}`);
    const AM=byId(o.markers),BM=byId(x.markers);
    for(const [k,m] of BM){if(!AM.has(k))L.push(`議題｜新增註記「${m.text||""}」｜${t}`);else if(!same(AM.get(k),m))L.push(`議題｜修改註記「${m.text||""}」｜${t}`)}
    for(const [k,m] of AM)if(!BM.has(k))L.push(`議題｜刪除註記「${m.text||""}」｜${t}`);
    linkD(o.links,x.links,"議題",t);staffD(o.staff,x.staff,"議題",t);lblD(o.labels,x.labels,"議題",t);
  }
  for(const [id,o] of AI)if(!BI.has(id))L.push(`議題｜刪除｜${o.title}`);
  const ord=x=>(x.issues||[]).map(i=>i.id).filter(i=>AI.has(i)&&BI.has(i)).join();
  if(ord(a)!==ord(b))L.push("議題｜調整順序");
  /* 即時回報 */
  const AE=byId(a.events),BE=byId(b.events),iname=id=>(b.issues||[]).find(i=>i.id===id)?.title||(a.issues||[]).find(i=>i.id===id)?.title||"";
  for(const [id,x] of BE){const o=AE.get(id),t=x.name;
    if(!o){L.push(x.fromEv?`即時回報｜完成第 ${x.round} 段｜${t}`:`即時回報｜新增｜${t}`);continue}
    if(o.name!==x.name)L.push(`即時回報｜改名 ${o.name}→${x.name}`);
    if((o.desc||"")!==(x.desc||""))L.push(`即時回報｜更新說明｜${t}`);
    if(!o.doneAt&&x.doneAt)L.push(`即時回報｜結案｜${t}`);else if(o.doneAt&&!x.doneAt)L.push(`即時回報｜重新開啟｜${t}`);else if(o.doneAt&&x.doneAt&&o.doneAt!==x.doneAt)L.push(`即時回報｜完成日期 ${fmt(x.doneAt)}｜${t}`);
    if((o.issueId||"")!==(x.issueId||""))L.push(x.issueId?`即時回報｜連結議題「${iname(x.issueId)}」｜${t}`:`即時回報｜取消議題連結｜${t}`);
    linkD(o.links,x.links,"即時回報",t);staffD(o.staff,x.staff,"即時回報",t);lblD(o.labels,x.labels,"即時回報",t);
    const OT=byId(o.times),XT=byId(x.times);
    for(const [k,m] of XT){const q=OT.get(k);if(!q)L.push(`即時回報｜新增時間「${m.label}」｜${t}`);else if(!same(q,m))L.push(`即時回報｜修改時間「${m.label}」｜${t}`)}
    for(const [k,m] of OT)if(!XT.has(k))L.push(`即時回報｜刪除時間「${m.label}」｜${t}`);
  }
  for(const [id,o] of AE)if(!BE.has(id))L.push(`即時回報｜刪除｜${o.name}`);
  /* 每週概述 */
  const AW=byId(a.weeks),BW=byId(b.weeks);
  for(const [id,x] of BW){const o=AW.get(id);if(!o)L.push(`每週概述｜新增｜${fmt(x.date)}`);else if(o.text!==x.text||o.date!==x.date)L.push(`每週概述｜修改｜${fmt(x.date)}`)}
  for(const [id,o] of AW)if(!BW.has(id))L.push(`每週概述｜刪除｜${fmt(o.date)}`);
  /* 設定 */
  if(!same(a.meetGrant,b.meetGrant))L.push(b.meetGrant?`設定｜開放秘書處會議編輯（${fmt(b.meetGrant.date)}）`:"設定｜關閉秘書處會議編輯");
  const AL=byId(a.labels),BL=byId(b.labels);
  for(const [id,l] of BL){if(!AL.has(id))L.push(`設定｜新增標籤｜${l.kind}·${l.name}`);else if(AL.get(id).name!==l.name)L.push(`設定｜標籤改名 ${AL.get(id).name}→${l.name}`)}
  for(const [id,l] of AL)if(!BL.has(id))L.push(`設定｜刪除標籤｜${l.kind}·${l.name}`);
  const AMb=byId(a.members),BMb=byId(b.members);
  for(const [id,m] of BMb){const o=AMb.get(id);if(!o){L.push(`設定｜新增編輯身分｜${m.name}`);continue}
    if(o.role!==m.role)L.push(`設定｜${m.role==="admin"?"設為管理員":"取消管理員"}｜${m.name}`);if(o.kdf!==m.kdf)L.push(`設定｜更改個人密碼｜${m.name}`)}
  for(const [id,m] of AMb)if(!BMb.has(id))L.push(`設定｜刪除編輯身分｜${m.name}`);
  if(a.pwKdf!==b.pwKdf&&a.pwKdf&&b.pwKdf)L.push("設定｜更改部門共用密碼");else if(!a.pwKdf&&b.pwKdf)L.push("設定｜共用密碼升級加密");
  const sy=x=>{const s={...(x.sync||{})};delete s.tokenEnc;return s};
  if(!same(sy(a),sy(b)))L.push("設定｜雲端同步設定");else if(!same((a.sync||{}).tokenEnc,(b.sync||{}).tokenEnc))L.push("設定｜更新雲端連線");
  /* 會長室的追蹤項目 */
  const AF=byId(a.follows),BF=byId(b.follows),fl=f=>{const d=(window.BOARD_DEPTS||[]).find(x=>x.id===f.dept);return `${d?d.name:f.dept}的${(typeof FW_KIND!=="undefined"&&FW_KIND[f.kind])||f.kind}`};
  for(const [k,f] of BF)if(!AF.has(k))L.push(`追蹤｜新增｜${fl(f)}`);
  for(const [k,f] of AF)if(!BF.has(k))L.push(`追蹤｜移除｜${fl(f)}`);
  return L;
}
/* 參數給秘書處寫回其他部門時用（a＝讀進來時、b＝改過的那份資料） */
function commitMessage(a=baseline,b=state,who=meName()||"未具名"){
  if(!a)return `〔${who}〕存檔\n\nBoard-Log: 1`;
  const L=diffState(a,b);
  if(!L.length)return `〔${who}〕存檔（沒有內容變更）\n\nBoard-Log: 1`;
  const cnt={};L.forEach(l=>{const c=l.split("｜")[0];cnt[c]=(cnt[c]||0)+1});
  const subj=L.length===1?`〔${who}〕${L[0]}`:`〔${who}〕更新 ${L.length} 項：${Object.entries(cnt).map(([c,n])=>`${c} ${n}`).join("、")}`;
  const MAX=80;
  return `${subj}\n\n${L.slice(0,MAX).join("\n")}${L.length>MAX?`\n…另有 ${L.length-MAX} 項`:""}\n\nBoard-Log: 1`;
}

/* ---------- 編輯紀錄頁（打開時才向 GitHub 讀取） ---------- */
const logState={page:0,done:false,busy:false,items:[]};
function parseCommit(c){
  const msg=(c.commit&&c.commit.message)||"",date=new Date((c.commit&&(c.commit.committer||c.commit.author)||{}).date||Date.now());
  const lines=msg.split("\n"),subj=lines[0]||"";
  const m=subj.match(/^〔(.+?)〕(.*)$/);
  if(!m)return {date,old:true,subj,sha:c.sha,url:c.html_url};
  const body=lines.slice(1).map(x=>x.trim()).filter(x=>x&&!/^Board-Log:/.test(x));
  return {date,old:false,who:m[1],subj:m[2],lines:body.length?body:[m[2]],sha:c.sha,url:c.html_url};
}
function logItemHTML(x){
  const t=`${pad(x.date.getHours())}:${pad(x.date.getMinutes())}`;
  if(x.old)return `<li class="lg-item old"><span class="lg-time num">${t}</span><div class="lg-main"><span class="lg-old">舊版存檔（無詳細紀錄）</span></div></li>`;
  return `<li class="lg-item"><span class="lg-time num">${t}</span><div class="lg-main"><span class="lg-who">${esc(x.who)}</span><ul class="lg-lines">${x.lines.map(l=>{const p=l.split("｜");return `<li><span class="lg-cat">${esc(p[0])}</span><span>${esc(p.slice(1).join("｜"))}</span></li>`}).join("")}</ul></div></li>`;
}
function renderLog(msg){
  const list=$("#logList");if(!list)return;
  const groups=[];logState.items.forEach(x=>{const k=ymd(x.date);let g=groups.find(y=>y.k===k);if(!g)groups.push(g={k,items:[]});g.items.push(x)});
  list.innerHTML=groups.map(g=>`<li class="lg-day"><div class="lg-date"><span class="num">${fmt(g.k)}</span><span class="sub">${"日一二三四五六"[pd(g.k).getDay()]}</span></div><ol>${g.items.map(logItemHTML).join("")}</ol></li>`).join("")
    ||(msg?"":`<li class="sub lg-empty">${logState.busy?"讀取中…":"還沒有紀錄"}</li>`);
  $("#logMsg").textContent=msg||"";
  const more=$("#logMore");more.hidden=logState.done||!!msg&&!logState.items.length;more.disabled=logState.busy;more.textContent=logState.busy?"讀取中…":"載入更早的紀錄";
}
async function loadLog(){
  if(logState.busy||logState.done)return;
  if(!cloudOn()){renderLog("這個看板沒有連上 GitHub，所以沒有編輯紀錄");return}
  logState.busy=true;renderLog();
  const c=cloudCfg(),h={Accept:"application/vnd.github+json"};if(ghToken())h.Authorization="Bearer "+ghToken();
  const url=`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/commits?path=${encodeURIComponent(c.path)}&sha=${encodeURIComponent(c.branch)}&per_page=30&page=${logState.page+1}`;
  let msg="";
  try{const r=await fetch(url,{headers:h,cache:"no-store"});
    if(r.ok){const arr=await r.json();logState.page++;logState.items.push(...arr.map(parseCommit));if(arr.length<30)logState.done=true}
    else msg=r.status===403?"GitHub 讀取次數暫時用完，請過一陣子再試":r.status===404?"找不到這個 repo 或資料檔":"讀取失敗（"+r.status+"）";
  }catch(_){msg="連不上 GitHub（離線中？）"}
  logState.busy=false;renderLog(msg);
}
/* host：設定頁桌面版的右側面板（沒有就是全螢幕）。回傳的 Promise 在關閉時完成 */
let logDone=null;
function openLog(host){
  let ov=$("#logOv");
  if(!ov){document.body.insertAdjacentHTML("beforeend",`<div class="log-ov" id="logOv" role="dialog" aria-modal="true" aria-label="編輯紀錄" hidden>
    <div class="anim-top"><div class="anim-title"><span class="anim-k">HISTORY</span><b>編輯紀錄</b><span class="sub">每次「儲存並同步」都會留下一筆</span></div><div class="anim-ctl"><button type="button" id="logClose" aria-label="關閉編輯紀錄">${ico("close")}關閉</button></div></div>
    <div class="log-scroll"><div class="log-inner"><ol class="log-list" id="logList"></ol><p class="sub log-msg" id="logMsg"></p><button type="button" class="ghost log-more" id="logMore">載入更早的紀錄</button></div></div></div>`);
    ov=$("#logOv");$("#logClose").onclick=closeLog;elastic(ov.querySelector(".log-scroll"),ov.querySelector(".log-inner"));$("#logMore").onclick=loadLog;}
  Object.assign(logState,{page:0,done:false,busy:false,items:[]});
  ov.classList.toggle("in-pane",!!host);const at=host||document.body;if(ov.parentNode!==at)at.append(ov);
  const from=host?null:pageUnder(ov);
  ov.hidden=false;if(!host){document.body.classList.add("log-open");Back.layers.log()}
  if(!host)PageFx.swap(from,ov);   /* 獨立一層（手機）：換頁動畫 */
  else if(!reduceMotion())ov.animate([{opacity:0,transform:"translateY(14px)"},{opacity:1,transform:"none"}],{duration:320,easing:"cubic-bezier(.2,.9,.25,1)"});   /* 設定頁右側面板裡：淡入 */
  renderLog();loadLog();$("#logClose").focus();
  return new Promise(r=>logDone=r);
}
function closeLog(instant){const ov=$("#logOv");if(!ov||ov.hidden)return;if(!ov.classList.contains("in-pane"))Back.closed("log");const done=()=>{ov.hidden=true;document.body.classList.remove("log-open");if(logDone){logDone();logDone=null}};
  if(instant===true||reduceMotion())return done();
  if(!ov.classList.contains("in-pane")){PageFx.swap(ov,pageUnder(ov),{done});return}   /* 獨立一層（手機）：換頁動畫；設定頁右側面板裡的照舊淡出 */
  const a=ov.animate([{opacity:1},{opacity:0,transform:"translateY(10px)"}],{duration:200,easing:"ease-in"});a.onfinish=done}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#logOv")&&!$("#logOv").hidden&&!$("#dlg").open)closeLog()});
