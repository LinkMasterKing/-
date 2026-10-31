/* 核心｜資料載入、版本遷移、本機暫存 key */

function defaultRange(){const d=new Date();return{start:ym(new Date(d.getFullYear(),d.getMonth()-1,1)),end:ym(new Date(d.getFullYear(),d.getMonth()+4,1))}}
/* ---------- 資料版本與自動遷移 ---------- */
const SCHEMA_VERSION=4;
const MIGRATIONS={
  /* v2 → v3：結構不變，只是開始記錄 schemaVersion（拆檔版） */
  2:s=>s,
  /* v3 → v4：加入編輯身分（members）、專員名單（staff），議題與即時回報可標專員 */
  3:s=>{s.members=s.members||[];s.staff=s.staff||[];return s},
};
function migrate(s){
  let v=+s.schemaVersion||+s.v||2;if(v<2)v=2;
  if(v>SCHEMA_VERSION){s._newer=true;return s}   /* 比這個程式還新的資料：不動它 */
  while(v<SCHEMA_VERSION){s=(MIGRATIONS[v]||(x=>x))(s);v++}
  s.schemaVersion=SCHEMA_VERSION;return s;
}
function normalize(s){
  s=migrate(s||{});if(!s.id)s.id=CFG.boardId;
  s.members=s.members||[];s.staff=s.staff||[];(s.events||[]).forEach(e=>{e.staff=e.staff||[]});
  s.weeks=s.weeks||[];s.issues=s.issues||[];s.events=s.events||[];s.reportBase=s.reportBase||null;if(s.yearLabel===undefined)s.yearLabel=CFG.term.label;if(s.termStart===undefined)s.termStart=CFG.term.start;s.range=s.range||defaultRange();s.title=s.title||CFG.title;
  s.issues.forEach(i=>{i.tags=i.tags||[];i.staff=i.staff||[];i.markers=i.markers||[];i.links=i.links||[];i.cur=i.cur||0;i.progress=+i.progress||0;i.start=i.start||"";i.end=i.end||"";
    i.markers.forEach(m=>{if(m.at==null){m.at=(hasDates(i)&&m.date)?Math.round(clamp((pd(m.date)-pd(i.start))/((pd(i.end)-pd(i.start))||1)*100)):50}m.date=m.date||""})});
  return s;
}

const RAW_STATE=(()=>{try{return JSON.parse($("#state").textContent||"{}")}catch(_){return {}}})();
const SEEDED=!Array.isArray(RAW_STATE.issues);   /* 拆檔版：資料不內嵌，開頁時讀 data.json */
let state=normalize(RAW_STATE);
const KEY="workboard:"+state.id;
let localOK=true;
