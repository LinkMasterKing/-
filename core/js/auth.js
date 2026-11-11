/* 核心｜編輯密碼與權杖加密 */
/* ---------- simple edit password (default 0000) ---------- */
const pwHash=str=>{let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(36)};
const curPw=()=>state.pwHash||pwHash("0000");
/* ---- stronger password hash + encrypted token (only the edit password can unlock it) ---- */
let sessionPw="";
const hasSubtle=()=>!!(window.crypto&&crypto.subtle);
const _te=new TextEncoder(),_td=new TextDecoder();
const toB64=u=>{let b="";u.forEach(x=>b+=String.fromCharCode(x));return btoa(b)},fromB64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function _base(pw){return crypto.subtle.importKey("raw",_te.encode(pw),"PBKDF2",false,["deriveBits","deriveKey"])}
async function kdfHash(pw,salt){const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:fromB64(salt),iterations:210000},await _base(pw),256);return toB64(new Uint8Array(bits))}
async function checkPw(pw){if(state.pwKdf&&hasSubtle()){const [salt,h]=state.pwKdf.split(":");return (await kdfHash(pw,salt))===h}return pwHash(pw)===curPw()}
async function setPw(pw){if(!hasSubtle()){state.pwHash=pwHash(pw);return}const salt=toB64(crypto.getRandomValues(new Uint8Array(16)));state.pwKdf=salt+":"+await kdfHash(pw,salt);delete state.pwHash}
async function _aes(pw,salt){return crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt,iterations:210000},await _base(pw),{name:"AES-GCM",length:256},false,["encrypt","decrypt"])}
async function encToken(tok,pw){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));const c=await crypto.subtle.encrypt({name:"AES-GCM",iv},await _aes(pw,salt),_te.encode(tok));return {s:toB64(salt),i:toB64(iv),c:toB64(new Uint8Array(c))}}
async function decToken(o,pw){const p=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(o.i)},await _aes(pw,fromB64(o.s)),fromB64(o.c));return _td.decode(p)}
/* 部門共用密碼不再保管上傳權限（2026-11-11 權杖更換的資安修正）：sync.tokenEnc 只讀不寫。
   舊資料裡已有的 tokenEnc 留著（換權杖後它解出來的是作廢的舊權杖，不構成風險）；改共用密碼時直接拿掉。
   新成員用學生會給的全會密碼加入（sync.tokenAll）。過渡用，02D 切到 Firebase 後連同密碼與權杖機制一起移除。 */
const dropSharedToken=()=>{if(state.sync&&state.sync.tokenEnc){delete state.sync.tokenEnc;return true}return false};
/* 權杖作廢後恢復（2026-11-11，過渡用，02D 移除）：存檔收到 401 時由 cloud.js 的 cloudPush 呼叫，只問一次。
   新權杖只在 sync.tokenAll（全會密碼加密，管理員換權杖後重新輸入全會密碼時更新），所以要輸入一次全會密碼；
   用記住的裝置登入、手上沒有個人密碼的人，再輸入個人密碼，把新權杖加密進自己的 members[].tok，
   其他裝置之後只用個人密碼登入就拿得到新權杖。權杖不顯示在畫面或 console。
   回傳 "ok"（換上新權杖）、"same"（全會密碼那份還是作廢的舊權杖＝學生會還沒換）、"cancel"、"none"（這個部門沒有全會密碼那份） */
async function tokenRecover(){
  const ta=state.sync&&state.sync.tokenAll;if(!ta||!hasSubtle())return "none";
  const old=ghToken(),me=meMember(),needMe=!!(me&&me.kdf&&!sessionPw);
  try{localStorage.removeItem(TOKEN_KEY)}catch(_){}   /* 先清掉作廢的舊權杖 */
  let fresh="";
  const v=await ask("上傳權限已更新",[{name:"all",label:"學生會給的全會密碼",type:"password"},
      ...(needMe?[{name:"me",label:`${me.name} 的個人密碼`,type:"password"}]:[])],
    {note:"學生會換了新的上傳權限，這台裝置原本的已經失效，所以剛剛沒有存到雲端。輸入一次學生會給的全會密碼（各部門都一樣）就會恢復並自動再存一次；"
      +(me?"之後你在其他裝置用個人密碼登入也會自動更新。":"")+"\n按「取消」的話，這次的修改先存在這台裝置。",
     validate:async o=>{try{fresh=await decToken(ta,o.all||"")}catch(_){fresh="";return "全會密碼不正確。請向學生會索取（各部門都一樣）。"}
       return needMe&&!(await kdfCheck(me.kdf,o.me||""))?"個人密碼不正確。":""}});
  /* 沒有換成功：放回原本那把（已作廢），下次存檔收到 401 會再問一次 */
  const keepOld=()=>{try{if(old)localStorage.setItem(TOKEN_KEY,old)}catch(_){}};
  if(!v||typeof v!=="object"||!fresh){keepOld();return "cancel"}
  if(fresh===old){keepOld();return "same"}
  if(needMe)sessionPw=v.me;
  try{localStorage.setItem(TOKEN_KEY,fresh)}catch(_){}
  if(me&&sessionPw)me.tok=await encToken(fresh,sessionPw);   /* 隨這次重試一起存回資料檔 */
  return "ok";
}
/* 加入部門時輸入的密碼（2026-11-06 全會密碼）：學生會給的全會密碼（解得開 sync.tokenAll），或部門自己的共用密碼（pwKdf）。
   回傳 "all"／"dept"／""（不對）。自動開通建立的看板只有全會密碼、沒有部門共用密碼：預設的 0000 不算 */
async function sharedKind(pw){
  const ta=state.sync&&state.sync.tokenAll;
  if(ta&&pw&&hasSubtle()){try{await decToken(ta,pw);return "all"}catch(_){}}
  if(ta&&!state.pwKdf&&!state.pwHash)return "";
  return await checkPw(pw||"")?"dept":"";
}
/* 用加入時輸入的密碼取出上傳權限（全會密碼那份或部門共用密碼那份），解不開回傳空字串。權杖不顯示在畫面或 console */
async function tokenFromShared(pw){
  const s=state.sync||{};if(!pw||!hasSubtle())return "";
  for(const o of [s.tokenAll,s.tokenEnc]){if(!o)continue;try{return await decToken(o,pw)}catch(_){}}
  return "";
}
async function unlockShared(title,note){
  for(;;){
    const all=!!(state.sync&&state.sync.tokenAll);let kind="";
    const v=await ask(title||"輸入部門共用密碼",[{name:"pw",label:all?"學生會給的密碼（或部門共用密碼）":state.sync&&state.sync.initial?"初始密碼":"共用密碼",type:"password"}],
      {...(all||state.members.length||(state.sync&&state.sync.initial)?{}:{alt:"更改密碼"}),note:note||"",
       validate:async o=>(kind=await sharedKind(o.pw||""))?"":all?"密碼不正確。請向學生會索取密碼（各部門都一樣），或向部門管理員要部門共用密碼。":"密碼不正確。剛開通的部門請用學生會給的初始密碼；忘記共用密碼請找部門管理員重設。"});
    if(v===null)return null;
    if(v==="alt"){await changePassword();continue}
    {
      sessionPw=v.pw||"";
      if(kind==="dept"&&!state.pwKdf&&hasSubtle()){try{await setPw(sessionPw)}catch(_){}}   /* 舊的共用密碼雜湊升級成 PBKDF2（全會密碼不寫進部門的共用密碼） */
      if(!ghToken()){const t=await tokenFromShared(sessionPw);if(t){try{localStorage.setItem(TOKEN_KEY,t)}catch(_){}}}
      return v.pw||"";
    }
  }
}
async function changePassword(){
  const v=await ask("更改密碼",[{name:"old",label:"目前密碼",type:"password"},{name:"n1",label:"新密碼",type:"password"},{name:"n2",label:"再輸入一次新密碼",type:"password"}],
    {validate:async o=>!(await checkPw(o.old||""))?"目前密碼不正確":!o.n1?"新密碼不能是空的":o.n1!==o.n2?"兩次輸入的新密碼不一樣":""});
  if(!v||v==="alt")return;
  await setPw(v.n1);sessionPw=v.n1;
  let note="";
  dropSharedToken();   /* 共用密碼不再保管上傳權限，舊的那份拿掉，不重新加密 */
  await persist("密碼已更新"+note);
}
