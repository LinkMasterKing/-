/* 核心｜Firestore 讀取橋接（01B）。ES module：只有部門設成 source:"firestore" 時由 store.js 載入，其他部門完全不載入 Firebase。
   只讀，不寫：查詢條件照 docs/architecture/indexes.md（規則不是篩選器，查詢要帶規則需要的條件，例如卡片只查 open／done）。
   cfg＝dept/config.js 的 BOARD_BASE.firebase（網頁設定，不是機密）；emulator 只給本機測試用。 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

let db = null;
function open(cfg) {
  if (db) return db;
  if (!cfg || !cfg.projectId) throw new Error("dept/config.js 的 firebase 設定還沒填");
  db = getFirestore(initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId }));
  if (cfg.emulator) connectFirestoreEmulator(db, cfg.emulator.host, cfg.emulator.port, cfg.emulator.mockUserToken ? { mockUserToken: cfg.emulator.mockUserToken } : undefined);
  return db;
}
const plain = v => window.StoreMap.plain(v);                 /* Timestamp → {__ts}（store-map.js） */
const one = async ref => { const s = await getDoc(ref); return s.exists() ? { id: s.id, ...plain(s.data()) } : null; };
const many = async q => (await getDocs(q)).docs.map(s => ({ id: s.id, ...plain(s.data()) }));

async function loadDept(cfg, dept) {
  const d = open(cfg), by = c => where("deptId", "==", dept);
  const [settings, org, grant, cards, issues, weeks, labels, events, legacy] = await Promise.all([
    one(doc(d, "deptSettings", dept)),
    one(doc(d, "org", "config")),
    dept === "president" ? one(doc(d, "grants", "meetingEdit")) : null,
    many(query(collection(d, "cards"), by(), where("state", "in", ["open", "done"]))),
    many(query(collection(d, "issues"), by())),
    many(query(collection(d, "weeks"), by())),
    many(query(collection(d, "labels"), by())),
    many(query(collection(d, "events"), by())),
    many(query(collection(d, "legacyIdentities"), by())),
  ]);
  return window.StoreMap.toState(dept, { settings, org, grant, cards, issues, weeks, labels, events, legacy });
}

window.BoardFirestore = { loadDept };
dispatchEvent(new Event("board-firestore-ready"));
