/* 核心｜資料載入、版本遷移、本機暫存 key */

function defaultRange(){const d=new Date();return{start:ym(new Date(d.getFullYear(),d.getMonth()-1,1)),end:ym(new Date(d.getFullYear(),d.getMonth()+4,1))}}
/* ---------- 資料版本與自動遷移 ---------- */
const SCHEMA_VERSION=12;
let MIGRATE_NOTE={staffDropped:0};   /* 這次讀進來時遷移掉的東西（只給畫面提示，不存進資料） */
const MIGRATIONS={
  /* v2 → v3：結構不變，只是開始記錄 schemaVersion（拆檔版） */
  2:s=>s,
  /* v3 → v4：加入編輯身分（members）、專員名單（staff），議題與即時回報可標專員 */
  3:s=>{s.members=s.members||[];s.staff=s.staff||[];return s},
  /* v4 → v5：即時回報加入時間標記（times）、分段（round）、更新紀錄（touched）。
     舊卡沒有更新紀錄：當作在最近一次回報期限當天更新過（顯示綠色），避免上線後整片變紅；之後照常判斷 */
  4:s=>{const d=pd(s.boardDate||today());d.setDate(d.getDate()-(d.getDay()-(+CFG.week.cutoff||0)+7)%7);const due=ymd(d);
    (s.events||[]).forEach(e=>{if(!e.doneAt)e.touched=[due]});return s},
  /* v5 → v6：拿掉手動完成度，改看「時程」（期間已經過的比例）；完成改成手動結案（doneAt 有值＝已結案）。
     原本 100% 的議題視為已結案；有期間的議題，沒有日期的註記依原本位置換算出日期 */
  5:s=>{const d0=(s.savedAt||"").slice(0,10)||today();(s.issues||[]).forEach(i=>{
      if((+i.progress||0)>=100){if(!i.doneAt)i.doneAt=d0}else i.doneAt=null;
      if(i.start&&i.end)(i.markers||[]).forEach(m=>{if(!m.date&&m.at!=null)m.date=dateAtPct(i,m.at)});
      delete i.progress});return s},
  /* v6 → v7：即時回報加「會議要報告」標記（report，布林）；舊資料一律沒標，由 normalize 補 false */
  6:s=>s,
  /* v7 → v8：
     - 專員改成引用帳號：staff 標記（staff id）換成名字完全相同的帳號（members[].id），沒有對應帳號的直接拿掉；拿掉 staff 名單。
     - 看板日期改成「上次編輯」（savedAt），拿掉 boardDate。
     - 時間標記加地點 times[].place（自由文字，可空白）。
     - 人事時地物標籤：labels[]＝{id,kind:"人|事|時|地|物",name}；即時回報與議題各自 labels[]（存標籤 id）。 */
  7:s=>{const byName=new Map((s.members||[]).map(m=>[m.name,m.id])),sn=new Map((s.staff||[]).map(x=>[x.id,x.name]));
    [...(s.events||[]),...(s.issues||[])].forEach(o=>{const out=[];(o.staff||[]).forEach(id=>{const mid=byName.get(sn.get(id));if(mid){if(!out.includes(mid))out.push(mid)}else MIGRATE_NOTE.staffDropped++});o.staff=out});
    delete s.staff;delete s.boardDate;
    (s.events||[]).forEach(e=>(e.times||[]).forEach(t=>{if(t.place==null)t.place=""}));
    s.labels=s.labels||[];return s},
  /* v8 → v9：會長室開放秘書處「會議編輯」的授權 meetGrant＝{date,by,at}（date＝開放的那一天，過了那天自動失效）或 null；舊資料補 null */
  8:s=>{s.meetGrant=s.meetGrant||null;return s},
  /* v9 → v10：學期 semester＝"up"（上學期）／"down"（下學期）／""（不指定）；甘特圖打開時預設看這個學期。舊資料補 "" */
  9:s=>{s.semester=s.semester||"";return s},
  /* v10 → v11（2026-11-06 全會密碼）：sync.tokenAll＝用全會密碼加密的上傳權限（權杖），由後台管理員的裝置自動補進每個部門（provision.js）；
     測試部門重置時另有 sync.resetAt（重置時間）。兩個都是選填，舊資料不用補 */
  10:s=>s,
  /* v11 → v12（2026-11-06 會長室文件）：docs[]＝{id,name,url}，會長自己新增的文件連結（超連結按鈕）；舊資料補空陣列。
     存在部門自己的資料檔（公開的 repo），網址任何人都看得到 */
  11:s=>{s.docs=s.docs||[];return s},
};
function migrate(s){
  let v=+s.schemaVersion||+s.v||2;if(v<2)v=2;
  if(v>SCHEMA_VERSION){s._newer=true;return s}   /* 比這個程式還新的資料：不動它 */
  while(v<SCHEMA_VERSION){s=(MIGRATIONS[v]||(x=>x))(s);v++}
  s.schemaVersion=SCHEMA_VERSION;return s;
}
/* 學年、開學日、甘特圖預設學期（2026-11-06 使用者：給秘書處管理，全會共用）：
   秘書處改自己資料裡的 yearLabel／termStart／semester（設定頁「學年與開學日」）；其他部門開頁時讀秘書處的資料檔（boot.js，follow.js 的 fwLoad，只讀），
   讀到了放在 termSrc。讀不到（離線、秘書處還沒有資料檔）就用自己資料裡原本的值（沒有的話 normalize 補 dept/config.js 的 term）。
   用到這三個值的地方一律經 termCfg()，不要直接讀 state.yearLabel 等。 */
const TERM_OWNER="secretariat";
const termOwn=()=>CFG.deptId===TERM_OWNER;
let termSrc=null;
function termCfg(){const s=(!termOwn()&&termSrc)||state;return {yearLabel:s.yearLabel||"",termStart:s.termStart||"",semester:["up","down"].includes(s.semester)?s.semester:""}}
function normalize(s){
  s=migrate(s||{});if(!s.id)s.id=CFG.boardId;
  s.members=s.members||[];s.labels=s.labels||[];s.docs=s.docs||[];s.meetGrant=s.meetGrant||null;s.semester=["up","down"].includes(s.semester)?s.semester:"";s.follows=s.follows||[];(s.events||[]).forEach(e=>{e.staff=e.staff||[];e.labels=e.labels||[];e.links=e.links||[];e.times=e.times||[];e.times.forEach(t=>{t.place=t.place||""});e.round=+e.round||1;e.touched=e.touched||[];e.report=!!e.report});
  s.weeks=s.weeks||[];s.issues=s.issues||[];s.events=s.events||[];s.reportBase=s.reportBase||null;if(s.yearLabel===undefined)s.yearLabel=CFG.term.label;if(s.termStart===undefined)s.termStart=CFG.term.start;s.range=s.range||defaultRange();s.title=s.title||CFG.title;
  s.issues.forEach(i=>{i.tags=i.tags||[];i.staff=i.staff||[];i.labels=i.labels||[];i.markers=i.markers||[];i.links=i.links||[];i.cur=i.cur||0;i.doneAt=i.doneAt||null;i.start=i.start||"";i.end=i.end||"";
    i.markers.forEach(m=>{if(m.at==null){m.at=(hasDates(i)&&m.date)?Math.round(clamp((pd(m.date)-pd(i.start))/((pd(i.end)-pd(i.start))||1)*100)):50}m.date=m.date||""})});
  return s;
}

const RAW_STATE=(()=>{try{return JSON.parse($("#state").textContent||"{}")}catch(_){return {}}})();
const SEEDED=!Array.isArray(RAW_STATE.issues);   /* 拆檔版：資料不內嵌，開頁時讀 data.json */
let state=normalize(RAW_STATE);
const KEY="workboard:"+state.id;
let localOK=true;
