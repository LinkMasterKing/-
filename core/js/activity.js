/* 核心｜會長室「各部門編輯量」曲線（2026-11-05，使用者要求；只在 follow:true 的看板＝會長室）
   - 資料：GitHub 上各部門資料檔的存檔紀錄（commits，編輯紀錄頁讀的同一份；只算帶 Board-Log: 1 的）。不新增任何儲存。
     每次存檔算「改了幾項」：標題「〔名字〕更新 N 項：…」＝N；「存檔（沒有內容變更）」＝0；其他單項（「〔名字〕即時回報｜新增｜…」等）＝1。
   - 範圍：最近 7 天（168 個小時，到現在這一個小時為止），以小時為單位統計，每個部門一條平滑曲線（單調三次插值，不會畫到 0 以下）。
   - 讀取：有權杖時帶權杖（每 5 分鐘、回到分頁時更新）；沒有權杖用公開讀取（GitHub 每小時 60 次，所以 15 分鐘才更新一次）。
     repo 是公開的話，這些存檔紀錄本來任何人都看得到；這裡沒有多公開任何東西。
   - 互動：滑過（手機按住左右拖）＝直線游標＋各曲線上的點＋黑色小標籤列出那個小時各部門的數字；點圖例＝只看那個部門（再點一次取消）。 */
const ACT={at:0,busy:false,rows:null,err:"",focus:null,idx:null,start:0,ro:null};
const ACT_H=168,HOUR=36e5;
/* 一則 commit 訊息 → 改了幾項（不是看板存的回傳 null） */
function actCount(msg){
  if(!/(^|\n)Board-Log:\s*1\s*$/m.test(msg||""))return null;
  const s=msg.split("\n")[0];if(/存檔（沒有內容變更）/.test(s))return 0;
  const m=s.match(/更新 (\d+) 項/);return m?+m[1]:1;
}
async function actFetch(d,since){
  const c=cloudCfg(),h={Accept:"application/vnd.github+json"};if(ghToken())h.Authorization="Bearer "+ghToken();
  const out=[];
  for(let page=1;page<=5;page++){
    const url=`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/commits?path=${encodeURIComponent(d.path)}&sha=${encodeURIComponent(c.branch)}&since=${encodeURIComponent(new Date(since).toISOString())}&per_page=100&page=${page}`;
    const r=await fetch(url,{headers:h,cache:"no-store"});
    if(!r.ok)throw r.status;
    const arr=await r.json();
    arr.forEach(x=>{const n=actCount(x.commit&&x.commit.message);const t=Date.parse((x.commit&&(x.commit.author||x.commit.committer)||{}).date);if(n!=null&&t)out.push({t,n})});
    if(arr.length<100)break;
  }
  return out;
}
async function actLoad(force){
  if(ACT.busy||!CFG.follow)return;
  const ttl=ghToken()?3e5:9e5;if(!force&&ACT.rows&&Date.now()-ACT.at<ttl)return;
  if(!cloudOn()){ACT.err="這個看板沒有連上 GitHub，看不到各部門的存檔紀錄。";ACT.rows=null;ACT.at=Date.now();renderActivity();return}
  ACT.busy=true;renderActivity();
  const now=new Date();now.setMinutes(0,0,0);const start=now.getTime()+HOUR-ACT_H*HOUR;   /* 最後一格＝現在這一個小時 */
  const ds=window.BOARD_DEPTS||[];let err="";
  const res=await Promise.all(ds.map(d=>actFetch(d,start).catch(s=>{err=s===403?"GitHub 讀取次數暫時用完，請過一陣子再試（有權杖的裝置不受限制）":s===404?"找不到 repo":"有部門讀取失敗";return null})));
  ACT.start=start;ACT.rows=ds.map((d,i)=>{const v=new Array(ACT_H).fill(0);(res[i]||[]).forEach(x=>{const k=Math.floor((x.t-start)/HOUR);if(k>=0&&k<ACT_H)v[k]+=x.n});return {id:d.id,name:d.name,v,sum:v.reduce((a,b)=>a+b,0),fail:!res[i]}});
  ACT.err=err;ACT.at=Date.now();ACT.busy=false;renderActivity();
}
/* 單調三次插值（Fritsch–Carlson）：曲線平滑但不會超過相鄰兩點的範圍（不會出現負數或假的高峰） */
function actPath(pts){
  const n=pts.length;if(n<2)return "";
  const dx=[],m=[],t=[];for(let i=0;i<n-1;i++){dx[i]=pts[i+1][0]-pts[i][0];m[i]=(pts[i+1][1]-pts[i][1])/dx[i]}
  t[0]=m[0];t[n-1]=m[n-2];for(let i=1;i<n-1;i++)t[i]=m[i-1]*m[i]<=0?0:(m[i-1]+m[i])/2;
  for(let i=0;i<n-1;i++){if(!m[i]){t[i]=t[i+1]=0;continue}const a=t[i]/m[i],b=t[i+1]/m[i],s=a*a+b*b;if(s>9){const k=3/Math.sqrt(s);t[i]=k*a*m[i];t[i+1]=k*b*m[i]}}
  let d=`M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for(let i=0;i<n-1;i++){const h=dx[i]/3;d+=`C${(pts[i][0]+h).toFixed(1)},${(pts[i][1]+t[i]*h).toFixed(1)} ${(pts[i+1][0]-h).toFixed(1)},${(pts[i+1][1]-t[i+1]*h).toFixed(1)} ${pts[i+1][0].toFixed(1)},${pts[i+1][1].toFixed(1)}`}
  return d;
}
const actNice=v=>{if(v<=4)return 4;const p=Math.pow(10,Math.floor(Math.log10(v))),f=v/p;return (f<=1?1:f<=2?2:f<=5?5:10)*p};
/* 圖的幾何（跟著寬度重算） */
function actGeo(box){const W=Math.max(280,box.clientWidth||600),H=W<560?190:230;return {W,H,l:4,r:W-4,t:16,b:H-34}}
const actX=(g,i)=>g.l+(g.r-g.l)*i/(ACT_H-1);
function actChartHTML(box){
  const g=actGeo(box),rows=ACT.rows,max=actNice(Math.max(1,...rows.map(r=>Math.max(...r.v)))),y=v=>g.b-(g.b-g.t)*v/max;
  const now=Date.now(),days=[];for(let i=0;i<ACT_H;i++){const d=new Date(ACT.start+i*HOUR);if(d.getHours()===0||i===0)days.push([i,d])}
  const ticks=days.map(([i,d])=>{const x=actX(g,i),isT=ymd(d)===today();return `<line class="ac-day" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${g.t}" y2="${g.b}"/>${i===0&&d.getHours()!==0?"":`<text class="ac-xl${isT?" is-today":""}" x="${(x+4).toFixed(1)}" y="${g.b+20}">${"日一二三四五六"[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}</text>`}`}).join("");
  const lines=rows.map(r=>`<path class="ac-line${ACT.focus&&ACT.focus!==r.id?" dim":""}${!r.sum?" zero":""}" d="${actPath(r.v.map((v,i)=>[actX(g,i),y(v)]))}" style="--c:${deptColor(r.id)}"/>`).join("");
  return `<svg class="ac-svg" viewBox="0 0 ${g.W} ${g.H}" width="${g.W}" height="${g.H}" role="img" aria-label="最近 7 天各部門每小時編輯項數，最高 ${max}">
    <line class="ac-grid" x1="${g.l}" x2="${g.r}" y1="${g.t}" y2="${g.t}"/><line class="ac-grid" x1="${g.l}" x2="${g.r}" y1="${((g.t+g.b)/2).toFixed(1)}" y2="${((g.t+g.b)/2).toFixed(1)}"/><line class="ac-base" x1="${g.l}" x2="${g.r}" y1="${g.b}" y2="${g.b}"/>
    <text class="ac-yl" x="${g.r}" y="${g.t-5}">${max}</text><text class="ac-yl" x="${g.r}" y="${((g.t+g.b)/2-5).toFixed(1)}">${max/2}</text>
    ${ticks}${lines}
    <g class="ac-cur"><line x1="0" x2="0" y1="${g.t-4}" y2="${g.b}"/>${rows.map(r=>`<circle r="3.5" data-ac="${r.id}" style="--c:${deptColor(r.id)}"/>`).join("")}</g></svg>
    <div class="ac-tip" hidden></div>`;
}
function renderActivity(){
  const p=$("#actPanel");if(!p)return;p.hidden=!CFG.follow;if(!CFG.follow)return;
  if(!ACT.at&&!ACT.busy){actLoad();return}   /* 第一次畫：先去讀（讀的過程會再呼叫這裡） */
  const box=$("#actChart"),info=$("#actInfo"),leg=$("#actLegend");
  $("#actRefresh").disabled=ACT.busy;$("#actRefresh").textContent=ACT.busy?"讀取中…":"重新整理";
  if(!ACT.rows){box.innerHTML=`<p class="sub ac-msg">${esc(ACT.busy?"讀取各部門的存檔紀錄中…":ACT.err||"")}</p>`;info.textContent="";leg.innerHTML="";return}
  const rows=ACT.rows,tot=rows.reduce((a,r)=>a+r.sum,0),top=[...rows].sort((a,b)=>b.sum-a.sum)[0];
  info.innerHTML=`近 7 天共 <b class="num">${tot}</b> 項編輯${top&&top.sum?`・最多 <b>${esc(top.name)}</b> <span class="num">${top.sum}</span>`:""}${ACT.err?`<span class="ac-err">・${esc(ACT.err)}</span>`:""}`;
  const first=!box.querySelector(".ac-svg");box.innerHTML=actChartHTML(box);
  if(first)Anim.enter(box.querySelector(".ac-svg"),"rise");
  leg.innerHTML=rows.map(r=>`<button type="button" class="ac-k${ACT.focus===r.id?" on":""}${ACT.focus&&ACT.focus!==r.id?" dim":""}${!r.sum?" zero":""}" data-ack="${r.id}" aria-pressed="${ACT.focus===r.id}" style="--c:${deptColor(r.id)}"><i aria-hidden="true"></i>${esc(r.name)}<span class="num">${r.fail?"—":r.sum}</span></button>`).join("");
  if(ACT.idx!=null)actCursor(ACT.idx);
  if(!ACT.ro){ACT.ro=new ResizeObserver(()=>{if(ACT.rows&&box.querySelector(".ac-svg")&&Math.abs(box.clientWidth-(+box.querySelector(".ac-svg").getAttribute("width")))>2){box.innerHTML=actChartHTML(box);if(ACT.idx!=null)actCursor(ACT.idx)}});ACT.ro.observe(box)}
}
/* 游標：直線＋各曲線的點＋小標籤（只動 transform） */
function actCursor(i){
  const box=$("#actChart"),svg=box&&box.querySelector(".ac-svg");if(!svg)return;
  const cur=svg.querySelector(".ac-cur"),tip=box.querySelector(".ac-tip");
  if(i==null){ACT.idx=null;cur.classList.remove("on");tip.hidden=true;return}
  ACT.idx=i;const g=actGeo(box),rows=ACT.rows,max=actNice(Math.max(1,...rows.map(r=>Math.max(...r.v)))),x=actX(g,i);
  cur.classList.add("on");cur.querySelector("line").setAttribute("transform",`translate(${x.toFixed(1)},0)`);
  cur.querySelectorAll("circle").forEach(c=>{const r=rows.find(z=>z.id===c.dataset.ac),v=r.v[i];c.setAttribute("transform",`translate(${x.toFixed(1)},${(g.b-(g.b-g.t)*v/max).toFixed(1)})`);c.classList.toggle("dim",!!ACT.focus&&ACT.focus!==r.id||!v)});
  const d=new Date(ACT.start+i*HOUR),list=rows.filter(r=>(ACT.focus?r.id===ACT.focus:r.v[i]>0)).sort((a,b)=>b.v[i]-a.v[i]);
  tip.innerHTML=`<b class="num">${d.getMonth()+1}/${d.getDate()} 週${"日一二三四五六"[d.getDay()]} ${pad(d.getHours())}:00</b>${list.length?list.map(r=>`<span style="--c:${deptColor(r.id)}"><i></i>${esc(r.name)}<em class="num">${r.v[i]}</em></span>`).join(""):`<span class="ac-none">沒有編輯</span>`}`;
  tip.hidden=false;const sx=box.clientWidth/g.W,tw=tip.offsetWidth,left=Math.max(0,Math.min(box.clientWidth-tw,x*sx-tw/2));
  tip.style.transform=`translate(${left.toFixed(1)}px,0)`;
}
function actPick(e){
  const box=$("#actChart"),svg=box&&box.querySelector(".ac-svg");if(!svg||!ACT.rows)return;
  const r=svg.getBoundingClientRect(),g=actGeo(box),x=(e.clientX-r.left)*g.W/r.width,i=Math.round((x-g.l)/(g.r-g.l)*(ACT_H-1));
  actCursor(Math.max(0,Math.min(ACT_H-1,i)));
}
document.addEventListener("pointermove",e=>{if(e.target.closest&&e.target.closest("#actChart .ac-svg"))actPick(e);else if(ACT.idx!=null&&e.pointerType==="mouse"&&!(e.target.closest&&e.target.closest("#actChart")))actCursor(null)},{passive:true});
document.addEventListener("pointerdown",e=>{if(e.target.closest&&e.target.closest("#actChart .ac-svg"))actPick(e)},{passive:true});
document.addEventListener("click",e=>{
  const t=e.target;if(!t.closest)return;
  if(t.closest("#actRefresh")){actLoad(true);return}
  const k=t.closest("[data-ack]");if(k){ACT.focus=ACT.focus===k.dataset.ack?null:k.dataset.ack;renderActivity();return}
  if(ACT.idx!=null&&!t.closest("#actChart"))actCursor(null);
});
if(CFG.follow){
  setInterval(()=>{if(!document.hidden)actLoad()},6e4);   /* 每分鐘檢查一次是否到了更新時間（有權杖 5 分鐘、沒有 15 分鐘） */
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)actLoad()});
}
