/* 舊網址的清除用 Service Worker（repo 移轉：linkmasterking/- → stustsa/council）
   舊看板在 /-/ 註冊過 sw.js（網路優先＋離線備份）。瀏覽器下次打開 /-/ 底下的頁面時會發現 sw.js 變了，裝上這一份：
   立刻接管 → 刪掉舊看板的快取（board-cache-*）→ 解除註冊 → 已開著的分頁重新整理一次，改由轉址頁帶到新網址。
   只刪舊看板自己的快取，同一個網域底下其他網站的快取不動；不讀寫任何瀏覽器儲存區。 */
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>{e.waitUntil((async()=>{
  try{for(const k of await caches.keys())if(/^board-cache-/.test(k))await caches.delete(k)}catch(_){}
  try{await self.registration.unregister()}catch(_){}
  try{for(const c of await self.clients.matchAll({type:"window"}))c.navigate(c.url).catch(()=>{})}catch(_){}
})())});
/* 不攔任何請求：一律走網路（拿到的就是轉址頁） */
