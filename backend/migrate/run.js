// 遷移程式（01B）：只讀 repo 根目錄的 data*.json 與 dept/config.js，永遠不寫它們。
// 寫入對象只有呼叫端給的 Firestore（測試與演練＝本機模擬器，經過正式規則，以總管理員身分走 importing() 分支）。
// 欄位對照在 core/js/store-map.js（網頁讀回來也用同一份）。
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MAP = require(path.join(ROOT, 'core/js/store-map.js'));
export const SENSITIVE_KEYS = ['sync', 'tokenAll', 'tokenEnc', 'tok', 'kdf', 'pwKdf', 'pwHash'];
// 階段 00 第 1.3 節的預期筆數（只拿來列差異；驗收以來源實際筆數為準）
export const EXPECTED = { cards: 50, versions: 50, issues: 4, weeks: 11, labels: 1, events: 16, markers: 11, legacyIdentities: 11, departments: 10, deptSettings: 10, multiline: 20 };

// 部門清單：直接執行 dept/config.js（不改它），取出 BOARD_DEPTS
export function loadDepts() {
  const code = readFileSync(path.join(ROOT, 'dept/config.js'), 'utf8') + '\n;this.__D = BOARD_DEPTS;';
  const ctx = { window: {}, location: { search: '' }, URLSearchParams };
  vm.runInNewContext(code, ctx);
  return ctx.__D.map(d => ({ id: d.id, name: d.name, path: d.path, test: !!d.test }));
}

// 讀來源：預設是目前工作目錄的檔案；給 commit 時用 git show 讀那個版本（都是唯讀）
export function loadSources({ commit } = {}) {
  const depts = loadDepts();
  const head = commit || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim();
  const files = depts.map(d => {
    const raw = commit ? execFileSync('git', ['show', `${commit}:${d.path}`], { cwd: ROOT }) : readFileSync(path.join(ROOT, d.path));
    const state = JSON.parse(raw.toString('utf8'));
    return { dept: d.id, path: d.path, sha256: createHash('sha256').update(raw).digest('hex'), state };
  });
  return { depts, commit: head, files };
}

// 產生所有文件（不寫入）。schemaVersion 不是 13 的檔案直接停下來（不猜舊格式）
export function plan(src, { batch, uid }) {
  const out = [], reports = [];
  src.depts.forEach((d, i) => out.push({ kind: 'departments', path: `departments/${d.id}`,
    data: { name: d.name, order: i, active: !d.test, updatedAt: { __now: true }, updatedBy: uid } }));
  for (const f of src.files) {
    const v = +f.state.schemaVersion || +f.state.v || 0;
    if (v !== 13) throw new Error(`${f.path} 的 schemaVersion 是 ${v}，不是 13：請先用看板開啟並儲存一次（core/js/state.js 的 migrate）再遷移`);
    const r = MAP.toDocs(f.dept, f.state, { batch, uid });
    out.push(...r.docs);
    reports.push(r.report);
  }
  return { docs: out, reports };
}

// ---------- 寫入 ----------
const PROTECTED = new Set(['legacyIdentities', 'deptSettings', 'grants']);           // 有 rev＋稽核鏈
const ORDER = ['departments', 'org', 'legacyIdentities', 'deptSettings', 'grants', 'labels', 'issues', 'weeks', 'cards', 'versions', 'events', 'meetingMinutes'];
const COST = { cards: 12, events: 6, legacyIdentities: 6, deptSettings: 6, grants: 6 };   // 規則讀取次數估算（整批上限 20，不依賴快取）
const IGNORE = new Set(['updatedAt', 'updatedBy', 'importBatch', 'at', 'by']);

export function toFirestore(v, FV, TS) {
  if (Array.isArray(v)) return v.map(x => toFirestore(x, FV, TS));
  if (v && typeof v === 'object') {
    if (v.__now) return FV.serverTimestamp();
    if (typeof v.__ts === 'number') return TS.fromMillis(v.__ts);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFirestore(x, FV, TS)]));
  }
  return v;
}
export const fromFirestore = MAP.plain;
// 比對內容（不看寫入者、時間戳記、批次號）；用來判斷重跑時要不要寫
export function contentHash(data) {
  const norm = v => Array.isArray(v) ? v.map(norm) : v && typeof v === 'object'
    ? (v.__now ? '__now' : Object.keys(v).filter(k => !IGNORE.has(k)).sort().reduce((o, k) => (o[k] = norm(v[k]), o), {})) : v;
  return createHash('sha256').update(JSON.stringify(norm(data))).digest('hex');
}

// db：compat Firestore（以總管理員身分登入）；FV／TS：同一個 SDK 的 FieldValue／Timestamp
export async function runImport(db, FV, TS, src, { batch, uid, log = () => {} }) {
  const p = plan(src, { batch, uid });
  const counts = {}, written = {}, skipped = {}, conflicts = [];
  p.docs.forEach(d => counts[d.kind] = (counts[d.kind] || 0) + 1);
  const mref = db.doc(`migrations/${batch}`);
  const existing = await mref.get();
  let mrev;
  if (!existing.exists) {
    const b = db.batch();
    b.set(mref, { status: 'running', sourceCommit: src.commit, fileHashes: Object.fromEntries(src.files.map(f => [f.dept, f.sha256])),
      counts: {}, report: '', startedBy: uid, startedAt: FV.serverTimestamp(), rev: 1, updatedAt: FV.serverTimestamp(), updatedBy: uid });
    b.set(db.doc(`auditLogs/migrations_${batch}_1`), { col: 'migrations', docId: batch, rev: 1, action: 'start', actor: uid,
      at: FV.serverTimestamp(), before: {}, after: { status: 'running' }, ref: src.commit });
    await b.commit();
    mrev = 1;
  } else {
    if (existing.data().status !== 'running') throw new Error(`批次 ${batch} 已經是 ${existing.data().status}，不能再用來寫入`);
    mrev = existing.data().rev;
  }

  // 卡片與它的第 1 版放同一個單位（規則要求同批）；其他一份文件一個單位
  const units = [];
  const versions = new Map(p.docs.filter(d => d.kind === 'versions').map(d => [d.path.split('/versions/')[0], d]));
  for (const kind of ORDER) for (const d of p.docs.filter(x => x.kind === kind)) {
    if (kind === 'versions') continue;
    const writes = [d];
    if (kind === 'cards') writes.push(versions.get(d.path));
    units.push({ kind, writes, cost: COST[kind] || 3 });
  }
  // 重跑：已存在且內容相同就跳過；已存在但不同不覆寫，列為衝突（凍結期間不應發生）
  const todo = [];
  for (const u of units) {
    const snap = await db.doc(u.writes[0].path).get();
    if (snap.exists) {
      const want = { ...u.writes[0].data }, have = fromFirestore(snap.data());
      Object.keys(want).forEach(k => { if (want[k] && want[k].__now) { delete have[k]; delete want[k]; } });   // 伺服器時間欄位不比
      const same = contentHash(have) === contentHash(want);
      if (same) { skipped[u.kind] = (skipped[u.kind] || 0) + 1; continue; }
      conflicts.push(u.writes[0].path); continue;
    }
    todo.push(u);
  }
  // 分批：讀取估算 ≤ 18、寫入 ≤ 400
  const batches = [];
  let cur = [], cost = 0, nw = 0;
  for (const u of todo) {
    const w = u.writes.length + (PROTECTED.has(u.kind) ? 1 : 0);
    if (cur.length && (cost + u.cost > 18 || nw + w > 400)) { batches.push(cur); cur = []; cost = 0; nw = 0; }
    cur.push(u); cost += u.cost; nw += w;
  }
  if (cur.length) batches.push(cur);
  for (const [i, units] of batches.entries()) {
    const b = db.batch();
    for (const u of units) {
      for (const d of u.writes) b.set(db.doc(d.path), toFirestore(d.data, FV, TS));
      if (PROTECTED.has(u.kind)) { const [col, id] = u.writes[0].path.split('/');
        b.set(db.doc(`auditLogs/${col}_${id}_1`), { col, docId: id, rev: 1, action: 'import', actor: uid, at: FV.serverTimestamp(), before: {}, after: {}, ref: batch }); }
      written[u.kind] = (written[u.kind] || 0) + u.writes.length - (u.kind === 'cards' ? 1 : 0);
      if (u.kind === 'cards') written.versions = (written.versions || 0) + 1;
    }
    try { await b.commit(); } catch (e) { e.message = `第 ${i + 1}/${batches.length} 批失敗（${units.map(u => u.writes[0].path).join(', ')}）：${e.message}`; throw e; }
    log(`批次 ${i + 1}/${batches.length}：${units.length} 個單位`);
  }
  return { plan: p, counts, written, skipped, conflicts, batches: batches.length, mrev };
}

// 批次狀態轉換（規則：running → done／failed／rollingBack；failed → rollingBack；rollingBack → rolledBack），每次都有稽核紀錄
export async function setMigrationStatus(db, FV, batch, uid, status, summary = {}) {
  const ref = db.doc(`migrations/${batch}`), cur = (await ref.get()).data();
  const b = db.batch();
  const next = { ...cur, status, rev: cur.rev + 1, updatedAt: FV.serverTimestamp(), updatedBy: uid };
  if (summary.counts) next.counts = summary.counts;
  if (Object.keys(summary).length) next.report = JSON.stringify(summary).slice(0, 50000);
  if (['done', 'failed', 'rolledBack'].includes(status)) next.finishedAt = FV.serverTimestamp();
  b.set(ref, next);
  b.set(db.doc(`auditLogs/migrations_${batch}_${cur.rev + 1}`), { col: 'migrations', docId: batch, rev: cur.rev + 1, action: status, actor: uid,
    at: FV.serverTimestamp(), before: { status: cur.status }, after: { status }, ref: '' });
  await b.commit();
}
export const finishImport = (db, FV, batch, uid, status, summary) => setMigrationStatus(db, FV, batch, uid, status, summary);

// 遷移失敗回復（R1）：只刪這個批次匯入、而且匯入後沒被改過的資料。
// - 卡片：version == 1 才刪，連同遷移產生的第 1 版同批刪（規則只在批次是 rollingBack 時允許刪這種版本）
// - 時間事件、議題：rev == 1；週報、標籤：updatedBy 是匯入的人
// - 有稽核鏈的文件（舊身分、部門設定、授權）與部門、學年設定不刪：重新匯入時內容相同就跳過，不會重複
// 被改過的一律保留並列在報告裡。重新匯入用新的批次號；文件 ID 是決定性的，所以不會產生重複資料。
export async function rollbackImport(db, FV, batch, uid, { log = () => {} } = {}) {
  const m = (await db.doc(`migrations/${batch}`).get()).data();
  if (!m || !['running', 'failed'].includes(m.status)) throw new Error(`批次 ${batch} 的狀態是 ${m && m.status}，只有 running／failed 能回復`);
  await setMigrationStatus(db, FV, batch, uid, 'rollingBack');
  const deleted = {}, kept = [];
  const of = async c => (await db.collection(c).where('importBatch', '==', batch).get()).docs;
  for (const c of await of('cards')) {
    if (c.data().version !== 1) { kept.push(c.ref.path); continue; }
    const b = db.batch(); b.delete(c.ref); b.delete(db.doc(c.ref.path + '/versions/1')); await b.commit();
    deleted.cards = (deleted.cards || 0) + 1;
  }
  for (const [col, untouched] of [['events', d => d.rev === 1], ['issues', d => d.rev === 1], ['weeks', d => d.updatedBy === m.startedBy], ['labels', d => d.updatedBy === m.startedBy]]) {
    for (const x of await of(col)) {
      if (!untouched(x.data())) { kept.push(x.ref.path); continue; }
      await x.ref.delete(); deleted[col] = (deleted[col] || 0) + 1;
    }
  }
  await setMigrationStatus(db, FV, batch, uid, 'rolledBack', { deleted, kept });
  log(`回復完成：刪除 ${JSON.stringify(deleted)}，保留（匯入後被改過）${kept.length} 筆`);
  return { deleted, kept };
}

// ---------- 驗證 V1～V6（V7 在測試裡用不同身分讀；V8 是現有 Playwright 測試） ----------
export async function verify(db, src, p) {
  const out = { ok: true, items: [] };
  const fail = (id, msg) => { out.ok = false; out.items.push({ id, ok: false, msg }); };
  const pass = (id, msg) => out.items.push({ id, ok: true, msg });
  const read = async q => (await q.get()).docs.map(s => ({ id: s.id, path: s.ref.path, ...fromFirestore(s.data()) }));
  const all = {};
  for (const c of ['departments', 'deptSettings', 'legacyIdentities', 'cards', 'issues', 'weeks', 'labels', 'events', 'meetingMinutes'])
    all[c] = await read(db.collection(c));
  all.versions = await read(db.collectionGroup('versions'));
  all.org = await read(db.collection('org'));
  all.grants = await read(db.collection('grants'));
  // V1 筆數：每個集合、每個部門
  const want = {};
  p.docs.forEach(d => { const dept = d.data.deptId || d.path.split('/')[1]; const k = `${d.kind}/${d.kind === 'departments' || d.kind === 'deptSettings' ? '-' : dept}`; want[k] = (want[k] || 0) + 1; });
  const have = {};
  for (const [kind, docs] of Object.entries(all)) docs.forEach(d => { const k = `${kind}/${kind === 'departments' || kind === 'deptSettings' ? '-' : (d.deptId || d.id)}`; have[k] = (have[k] || 0) + 1; });
  const diff = Object.keys({ ...want, ...have }).filter(k => (want[k] || 0) !== (have[k] || 0) && !k.startsWith('org/') && !k.startsWith('grants/'));
  diff.length ? fail('V1', '筆數不符：' + diff.map(k => `${k} 來源 ${want[k] || 0}／寫入 ${have[k] || 0}`).join('；')) : pass('V1', `${Object.keys(want).length} 組集合×部門筆數相同`);
  // V2 多行說明：blocks 接回去＝legacyDesc＝原始 desc
  const srcCards = new Map();
  src.files.forEach(f => (f.state.events || []).forEach(e => srcCards.set(`${f.dept}__${e.id}`, String(e.desc || ''))));
  let multi = 0; const bad2 = [];
  for (const c of all.cards) { const joined = (c.blocks || []).map(b => b.text).join('\n'), orig = srcCards.get(c.id);
    if (orig != null && orig.includes('\n')) multi++;
    if (joined !== orig || c.legacyDesc !== orig) bad2.push(c.id); }
  bad2.length ? fail('V2', '還原不符：' + bad2.join(', ')) : pass('V2', `${all.cards.length} 張卡片還原相同，其中多行 ${multi} 張`);
  // V3 連結：議題、註記、追蹤、分段來源、標籤、負責人
  const ids = new Set([...all.cards, ...all.issues, ...all.labels, ...all.events, ...all.legacyIdentities].map(d => d.id));
  const broken = [];
  const chk = (what, from, id) => { if (id && !ids.has(id)) broken.push(`${what}:${from}→${id}`); };
  all.cards.forEach(c => { chk('issueId', c.id, c.issueId); chk('fromEv', c.id, c.fromEv); (c.labels || []).forEach(x => chk('label', c.id, x));
    (c.staff || []).forEach(s => chk('staff', c.id, s.replace(/^legacy:/, ''))); (c.timeIds || []).forEach(x => chk('timeId', c.id, x)); });
  all.issues.forEach(i => (i.markers || []).forEach(m => { chk('marker.evId', i.id, m.evId); chk('marker.tmId', i.id, m.tmId); }));
  all.deptSettings.forEach(s => (s.follows || []).forEach(f => chk('follow', s.id, f.ref)));
  all.events.forEach(e => chk('event.cardId', e.id, e.cardId));
  const srcBroken = p.reports.flatMap(r => r.broken.map(b => `${b.what}:${r.dept}__${b.from}→${b.id}`));
  broken.length ? fail('V3', '斷掉的連結：' + broken.join(', ') + (srcBroken.length ? `（來源本來就斷的：${srcBroken.join(', ')}）` : ''))
    : pass('V3', '所有連結都指得到' + (srcBroken.length ? `；來源本來就斷的 ${srcBroken.length} 筆已保留原值` : ''));
  // V4 時間：startRaw 重新解析＝start；全天事件在台灣時間是同一天
  const bad4 = all.events.filter(e => { const s = MAP.parseTaipei(e.startRaw);
    return !s || s.ms !== e.start.__ts || s.allDay !== e.allDay || (e.allDay && MAP.fmtTaipei(e.start.__ts, true) !== e.startRaw.slice(0, 10)); });
  bad4.length ? fail('V4', '時間不符：' + bad4.map(e => e.id).join(', ')) : pass('V4', `${all.events.length} 筆時間標記相同`);
  // V6 敏感欄位：鍵名不存在、來源裡的權杖與雜湊字串也不存在
  const secrets = [];
  const grab = (o, inSecret) => { if (Array.isArray(o)) return o.forEach(x => grab(x, inSecret));
    if (o && typeof o === 'object') return Object.entries(o).forEach(([k, v]) => grab(v, inSecret || SENSITIVE_KEYS.includes(k)));
    if (inSecret && typeof o === 'string' && o.length >= 16) secrets.push(o); };
  src.files.forEach(f => grab(f.state, false));
  const dump = JSON.stringify(all);
  const keyHit = SENSITIVE_KEYS.filter(k => dump.includes(`"${k}":`));
  const valHit = secrets.filter(s => dump.includes(s));
  keyHit.length || valHit.length ? fail('V6', `找到敏感欄位 ${keyHit.join(',')}，值 ${valHit.length} 筆`) : pass('V6', `沒有敏感欄位；比對了 ${secrets.length} 個來源機密字串`);
  out.counts = Object.fromEntries(Object.entries(all).map(([k, v]) => [k, v.length]));
  out.counts.markers = all.issues.reduce((n, i) => n + (i.markers || []).length, 0);
  out.counts.multiline = multi;
  out.expectedDiff = Object.entries(EXPECTED).filter(([k, v]) => out.counts[k] !== v).map(([k, v]) => `${k}: 預期 ${v}，實際 ${out.counts[k]}`);
  out.hash = createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(all).map(([k, v]) =>
    [k, v.map(d => [d.path, contentHash(d)]).sort()])))).digest('hex');
  return out;
}
