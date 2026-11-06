/* 會長室「各部門編輯量」（activity.js）：模擬各部門的 commits（帶 Board-Log、更新 N 項、沒有內容變更、不是看板存的），
   檢查每小時加總、圖例總數、游標小標籤、點圖例只看一個部門、沒有連上 GitHub 的說明；桌面 1300 深色、手機 412 淺色。固定 8300 埠；截圖 ac1_*.png */
const c=require('./common');c.q='?d=president';
(async()=>{const {b,mk}=await c.setup();
const H=36e5,now=Date.now(),msg=(s)=>s+'\n\n明細\n\nBoard-Log: 1';
const fake={'data.json':[[1,'〔王〕更新 5 項：即時回報 5'],[1.2,'〔王〕即時回報｜新增｜甲'],[30,'〔王〕更新 3 項：議題 3'],[50,'〔王〕存檔（沒有內容變更）'],[60,'Merge pull request #3',true]],
 'data-secretariat.json':[[2,'〔李〕更新 2 項：即時回報 2'],[80,'〔李〕設定｜更改個人密碼｜李']],'data-president.json':[[5,'〔陳〕更新 4 項：設定 4']]};
for(const [w,h,sc,tc] of [[1300,900,'dark',false],[412,860,'light',true]]){const p=await mk(w,h,sc,tc);
 await p.route('https://api.github.com/**/commits?*',r=>{const u=new URL(r.request().url()),path=u.searchParams.get('path');
   const arr=(fake[path]||[]).map(([ago,m,raw])=>({commit:{message:raw?m:msg(m),author:{date:new Date(now-ago*H).toISOString()}}}));return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(arr)})});
 console.log(w,'no cloud',await p.evaluate(()=>$('#actChart').textContent.trim()));
 await p.evaluate(()=>{state.sync={...(state.sync||{}),owner:'o',repo:'r'};ACT.at=0;ACT.rows=null;renderActivity()});await p.waitForTimeout(1200);
 console.log(w,'sums',await p.evaluate(()=>ACT.rows.filter(r=>r.sum).map(r=>r.id+':'+r.sum).join(' ')),'(want rights:9 secretariat:3 president:4)');
 console.log(w,'info',await p.evaluate(()=>$('#actInfo').textContent));
 console.log(w,'paths',await p.evaluate(()=>document.querySelectorAll('#actChart .ac-line').length),'svgW',await p.evaluate(()=>[+$('#actChart .ac-svg').getAttribute('width'),$('#actChart').clientWidth]));
 await p.evaluate(()=>$('#actPanel').scrollIntoView());
 const bx=await (await p.$('#actChart .ac-svg')).boundingBox();
 await p.mouse.move(bx.x+bx.width*(1-1.5/167),bx.y+bx.height/2);await p.waitForTimeout(200);
 console.log(w,'tip',await p.evaluate(()=>[ACT.idx,$('#actChart .ac-tip').textContent]));
 await p.screenshot({path:`ac1_${w}.png`});
 await p.click('#actLegend [data-ack=secretariat]');await p.waitForTimeout(400);
 console.log(w,'focus',await p.evaluate(()=>[ACT.focus,document.querySelectorAll('#actChart .ac-line.dim').length]));
 await p.screenshot({path:`ac1_${w}_focus.png`});
 console.log(w,'errs',p.errs.filter(x=>!x.includes('404')))}
await b.close()})();
