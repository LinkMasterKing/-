/* 核心｜資料來源轉接（01B，docs/architecture/migration.md 第 5 節）
   dept/config.js 每個部門的 source：
     "github"   ＝現狀：讀寫 repo 裡的 data*.json（預設，畫面與行為完全不變）
     "frozen"   ＝搬家中：照樣讀資料檔，但整個看板唯讀，任何寫入資料檔的路徑都擋下（凍結只靠程式設定，不寫資料檔的 locked）
     "firestore"＝讀 Cloud Firestore（core/js/store-firestore.js）。02 加上 Google 登入之前只有唯讀
   Firestore 讀回來的資料由 store-map.js 轉成跟資料檔一樣的格式，再交給 normalize，所以上層的 state 與 render 不變。 */
const STORE_SOURCES=["github","frozen","firestore"];
const deptSourceOf=id=>{const d=BOARD_DEPTS.find(x=>x.id===id);return d&&STORE_SOURCES.includes(d.source)?d.source:"github"};
const storeSource=()=>deptSourceOf(CFG.deptId);
const storeLocked=()=>storeSource()!=="github";
const boardLocked=()=>!!state.locked||storeLocked();   /* 看板唯讀：定型版（state.locked）或部門不是 github 模式 */
const STORE_NOTE={frozen:"這個部門正在搬到新資料庫，暫停編輯。",firestore:"這個部門已搬到新資料庫，目前只能檢視；登入與編輯在下一階段開放。"};
/* Firestore 模式：第一次用到才載入橋接模組（type=module，SDK 從 gstatic 載入）；回傳 schemaVersion 13 格式的部門資料 */
let storeFsMod=null;
function storeFsLoad(){
  if(!storeFsMod)storeFsMod=new Promise((ok,no)=>{
    if(window.BoardFirestore)return ok(window.BoardFirestore);
    addEventListener("board-firestore-ready",()=>ok(window.BoardFirestore),{once:true});
    const s=document.createElement("script");s.type="module";s.src="core/js/store-firestore.js";s.onerror=()=>no(new Error("load"));
    document.head.append(s);
  });
  return storeFsMod.then(fs=>fs.loadDept(CFG.firebase,CFG.deptId));
}
