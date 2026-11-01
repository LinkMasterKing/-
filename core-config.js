/* 核心｜讀取部門設定檔（window.BOARD_CONFIG），沒給的欄位用通用預設值。核心程式只透過 CFG 取得部門資訊。 */
const CFG=(()=>{
  const D={
    boardId:"board-main",
    title:"工作看板",
    brand:"",
    dept:{name:"",org:""},
    stageTags:["進行中","完成"],
    colors:{},
    sections:{live:true,timeline:true,cards:true,done:true,weekly:true,simple:true,animation:true},
    term:{label:"",start:"",end:""},
    data:{owner:"",repo:"",branch:"main",path:"data.json",page:"index.html"},
    notify:{url:""},
    week:{cutoff:2},
  };
  const u=window.BOARD_CONFIG||{},o={...D,...u};
  ["dept","colors","sections","term","data","notify","week"].forEach(k=>o[k]={...D[k],...(u[k]||{})});
  if(!Array.isArray(o.stageTags))o.stageTags=D.stageTags;
  return Object.freeze(o);
})();
const secOn=k=>k==="progress"?(CFG.sections.timeline||CFG.sections.cards):CFG.sections[k]!==false;
