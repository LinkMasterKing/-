/* 核心｜資料載入、版本遷移、本機暫存 key */

function defaultRange(){const d=new Date();return{start:ym(new Date(d.getFullYear(),d.getMonth()-1,1)),end:ym(new Date(d.getFullYear(),d.getMonth()+4,1))}}
/* ---------- 資料版本與自動遷移 ---------- */
const SCHEMA_VERSION=6;
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
};
function migrate(s){
  let v=+s.schemaVersion||+s.v||2;if(v<2)v=2;
  if(v>SCHEMA_VERSION){s._newer=true;return s}   /* 比這個程式還新的資料：不動它 */
  while(v<SCHEMA_VERSION){s=(MIGRATIONS[v]||(x=>x))(s);v++}
  s.schemaVersion=SCHEMA_VERSION;return s;
}
function normalize(s){
  s=migrate(s||{});if(!s.id)s.id=CFG.boardId;
  s.members=s.members||[];s.staff=s.staff||[];s.follows=s.follows||[];(s.events||[]).forEach(e=>{e.staff=e.staff||[];e.links=e.links||[];e.times=e.times||[];e.round=+e.round||1;e.touched=e.touched||[]});
  s.weeks=s.weeks||[];s.issues=s.issues||[];s.events=s.events||[];s.reportBase=s.reportBase||null;if(s.yearLabel===undefined)s.yearLabel=CFG.term.label;if(s.termStart===undefined)s.termStart=CFG.term.start;s.range=s.range||defaultRange();s.title=s.title||CFG.title;
  s.issues.forEach(i=>{i.tags=i.tags||[];i.staff=i.staff||[];i.markers=i.markers||[];i.links=i.links||[];i.cur=i.cur||0;i.doneAt=i.doneAt||null;i.start=i.start||"";i.end=i.end||"";
    i.markers.forEach(m=>{if(m.at==null){m.at=(hasDates(i)&&m.date)?Math.round(clamp((pd(m.date)-pd(i.start))/((pd(i.end)-pd(i.start))||1)*100)):50}m.date=m.date||""})});
  return s;
}

const RAW_STATE=(()=>{try{return JSON.parse($("#state").textContent||"{}")}catch(_){return {}}})();
const SEEDED=!Array.isArray(RAW_STATE.issues);   /* 拆檔版：資料不內嵌，開頁時讀 data.json */
let state=normalize(RAW_STATE);
const KEY="workboard:"+state.id;
let localOK=true;
