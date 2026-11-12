/* 核心｜讀取部門設定檔（window.BOARD_CONFIG），沒給的欄位用通用預設值。核心程式只透過 CFG 取得部門資訊。 */
const CFG=(()=>{
  const D={
    boardId:"board-main",
    title:"工作看板",
    brand:"",
    dept:{name:"",org:""},
    stageTags:["進行中","完成"],
    colors:{},
    sections:{live:true,timeline:true,cards:true,done:true,weekly:true,simple:true},
    term:{label:"",start:"",end:""},
    data:{owner:"",repo:"",branch:"main",path:"data.json",page:"index.html"},
    notify:{url:""},
    week:{cutoff:2},
    deptId:"",logo:true,follow:false,meeting:false,grant:false,ext:"",extIcon:"",mergeDone:false,source:"github",firebase:null,
  };
  const u=window.BOARD_CONFIG||{},o={...D,...u};
  ["dept","colors","sections","term","data","notify","week"].forEach(k=>o[k]={...D[k],...(u[k]||{})});
  if(!Array.isArray(o.stageTags))o.stageTags=D.stageTags;
  return Object.freeze(o);
})();
const secOn=k=>k==="progress"?(CFG.sections.timeline||CFG.sections.cards):k==="ext"?!!CFG.ext:CFG.sections[k]!==false;
/* 底部工具列的分頁（區塊）：完成紀錄併進即時回報的部門（mergeDone）不另外算一區；secOf＝某一區實際在哪個分頁裡 */
const secTab=k=>secOn(k)&&!(k==="done"&&CFG.mergeDone);
const secOf=k=>k==="done"&&CFG.mergeDone?"live":k;
