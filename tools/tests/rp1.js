// 工作報告：從設定頁登入→選期間→預覽→新增／移除區塊→輸出 PDF（列印樣式）
const {chromium}=require('playwright');const fs=require('fs');
const FIX=new Date('2026-11-01T10:00:00+08:00').getTime();
const URL=process.env.URL||'http://127.0.0.1:8300/index.html';
(async()=>{const b=await chromium.launch();
let remote=JSON.parse(fs.readFileSync('data_test.json','utf8')),sha='s0',commits=[];
for(const [w,h,sc,tag] of [[1300,860,'dark','d'],[412,915,'light','m']]){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:w<500?2:1,colorScheme:sc,serviceWorkers:'block'});
  await ctx.addInitScript(F=>{const D=Date;class FD extends D{constructor(...a){super(...(a.length?a:[F]))}static now(){return F}};window.Date=FD},FIX);
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url();
    if(u.includes('/commits?'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(commits)});
    if(q.method()==='GET')return r.fulfill({status:200,contentType:'application/json',headers:{ETag:'"'+sha+'"'},body:JSON.stringify({sha,content:Buffer.from(JSON.stringify(remote)).toString('base64')})});
    const bd=JSON.parse(q.postData());if(bd.sha!==sha)return r.fulfill({status:409,body:'{}'});
    remote=JSON.parse(Buffer.from(bd.content,'base64').toString());sha='s'+(commits.length+1);commits.unshift({sha,commit:{message:bd.message,committer:{date:new Date().toISOString()}}});
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha}})})});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL);await p.waitForFunction(()=>document.body&&!document.body.classList.contains('intro'));await p.waitForTimeout(500);
  await p.evaluate(()=>localStorage.setItem('workboard:ghtoken','TOK_A_123'));
  await p.click('#setBtn');await p.waitForTimeout(500);
  await p.click('#setOv .set-gate .primary');await p.waitForTimeout(400);
  const ok=()=>p.click('#dlgForm [data-act=ok]');
  if(tag==='d'){await p.fill('#dlgForm input[name=pw]','0000');await ok();await p.waitForTimeout(500);
    await p.fill('#dlgForm input[name=name]','王小明');await p.fill('#dlgForm input[name=p1]','wang-password-1');await p.fill('#dlgForm input[name=p2]','wang-password-1');await ok();await p.waitForTimeout(2500);await (async()=>{for(let i=0;i<4;i++){await p.waitForTimeout(500);const t=await p.$eval('#dlg[open] #dlgForm>b',b=>b.textContent).catch(()=>'');if(/共用密碼太短|沒有連上雲端/.test(t))await p.click('#dlgForm [data-act=cancel]').catch(()=>{})}})();}   /* 2026-11-05：建立第一個身分後，共用密碼 0000 會請管理員換（team.js 的 sharedPwFix），測試先取消 */
  else{await p.fill('#dlgForm input[name=pw]','wang-password-1');await ok();await p.waitForTimeout(1500)}
  await p.$eval('#setOv [data-set=report]',e=>e.scrollIntoView({block:'center'}));await p.waitForTimeout(150);
  console.log(tag,'row:',await p.$eval('#setOv [data-set=report]',e=>e.textContent+'|'+e.getAttribute('aria-disabled')));
  await p.click('#setOv [data-set=report]');await p.waitForTimeout(700);
  console.log(tag,'dialog:',await p.evaluate(()=>[$('#dlgForm b').textContent,...[...document.querySelectorAll('#dlgForm input')].map(i=>i.name+'='+i.value)]));
  await ok();await p.waitForTimeout(900);
  console.log(tag,'report:',await p.evaluate(()=>({open:rptOpen,secs:[...document.querySelectorAll('.rpt-sec>h2')].map(h=>getComputedStyle(h,'::before').content+h.textContent),issues:document.querySelectorAll('.rpt-issue').length,gantt:!!document.querySelector('.rpt-gantt svg'),stats:[...document.querySelectorAll('.rpt-stats b')].map(b=>b.textContent)})));
  await p.screenshot({path:`rp_${tag}_1.png`});
  // 改字、新增區塊、移除區塊
  await p.click('.rpt-free .rpt-text');await p.keyboard.type('本期完成六宿停車場公告清理，與總務處建立固定回報窗口。');
  await p.click('#rptAdd');await p.waitForTimeout(500);await p.keyboard.type('附件與感謝');await p.keyboard.press('Tab');
  await p.evaluate(()=>{const t=[...document.querySelectorAll('.rpt-sec')].pop().querySelector('.rpt-text');t.focus()});await p.keyboard.type('感謝各位專員的協助。');
  await p.evaluate(()=>[...document.querySelectorAll('.rpt-sec')].find(s=>s.querySelector('h2').textContent==='下期規劃').querySelector('.rpt-x').click());await p.waitForTimeout(400);
  console.log(tag,'after edit:',await p.evaluate(()=>[...document.querySelectorAll('.rpt-sec>h2')].map(h=>getComputedStyle(h,'::before').content+h.textContent)));
  await p.screenshot({path:`rp_${tag}_2.png`,fullPage:false});
  if(tag==='d'){
    await p.evaluate(()=>document.activeElement&&document.activeElement.blur());await p.emulateMedia({media:'print'});
    await p.pdf({path:'rp_report.pdf',preferCSSPageSize:true,printBackground:true});
    await p.emulateMedia({media:'screen'});
  }
  // 列印時 document.title 換成報告名稱、印完換回
  await p.evaluate(()=>{window.print=()=>{window.__pt=document.title;dispatchEvent(new Event('afterprint'))}});await p.click('#rptPrint');
  console.log(tag,'print title:',await p.evaluate(()=>[window.__pt,document.title]));
  await p.click('#rptClose');await p.waitForTimeout(500);
  console.log(tag,'closed:',await p.evaluate(()=>({open:rptOpen,ov:!!document.querySelector('#rptOv'),cls:document.body.classList.contains('rpt-open'),set:setOpen})),'errs',errs);
  await ctx.close();}
await b.close()})();
