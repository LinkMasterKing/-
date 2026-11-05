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
async function rememberToken(tok,pw){
  if(!hasSubtle())return "nocrypto";
  if((pw||"").length<8)return "weak";
  state.sync=Object.assign({},state.sync||{},{tokenEnc:await encToken(tok,pw)});return "ok";
}
async function unlockShared(title){
  for(;;){
    const v=await ask(title||"輸入部門共用密碼",[{name:"pw",label:"共用密碼",type:"password"}],state.members.length?{}:{alt:"更改密碼"});
    if(v===null)return null;
    if(v==="alt"){await changePassword();continue}
    if(await checkPw(v.pw||"")){
      sessionPw=v.pw||"";
      if(!state.pwKdf&&hasSubtle()){try{await setPw(sessionPw)}catch(_){}}
      const te=state.sync&&state.sync.tokenEnc;
      if(te&&!ghToken()&&hasSubtle()){try{localStorage.setItem(TOKEN_KEY,await decToken(te,sessionPw))}catch(_){}}
      return v.pw||"";
    }
    toast("密碼錯誤");
  }
}
async function changePassword(){
  const v=await ask("更改密碼",[{name:"old",label:"目前密碼",type:"password"},{name:"n1",label:"新密碼",type:"password"},{name:"n2",label:"再輸入一次新密碼",type:"password"}]);
  if(!v||v==="alt")return;
  if(!(await checkPw(v.old||""))){toast("目前密碼不正確，未更改");return}
  if(!v.n1){toast("新密碼不能是空的");return}
  if(v.n1!==v.n2){toast("兩次輸入的新密碼不一樣");return}
  await setPw(v.n1);sessionPw=v.n1;
  let note="";
  if(ghToken()){const r=await rememberToken(ghToken(),v.n1);if(r==="weak"&&state.sync){delete state.sync.tokenEnc;note="（新密碼少於 8 碼，權杖只記在這台裝置）"}}
  else if(state.sync&&state.sync.tokenEnc){delete state.sync.tokenEnc;note="（請在下次儲存時重新貼一次權杖）"}
  await persist("密碼已更新"+note);
}
