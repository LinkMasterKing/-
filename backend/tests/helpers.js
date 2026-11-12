// 規則測試共用：模擬器環境、測試身分、合法寫入的建構函式。
// 只連本機 Firestore 模擬器（專案 ID 以 demo- 開頭＝模擬器專用，不會連到任何真的專案）。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { setLogLevel } from 'firebase/firestore';
setLogLevel('silent');

export { assertSucceeds, assertFails };
export const PROJECT = 'demo-stustsa-board';
const here = path.dirname(fileURLToPath(import.meta.url));
export const RULES = readFileSync(path.join(here, '..', 'firestore.rules'), 'utf8');
export const FV = firebase.firestore.FieldValue;
export const TS = firebase.firestore.Timestamp;
export const NOW = () => FV.serverTimestamp();
export const DEPTS = ['rights', 'president', 'secretariat', 'marketing', 'finance', 'events', 'affairs', 'pr', 'works', 'fruit'];
export const SLOT = 1800000;

export async function env() {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  return initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: RULES, host, port: +port } });
}

// Google 登入、信箱已驗證的測試帳號（其他登入方式見 I-22）
export function google(t, uid, extra = {}) {
  return t.authenticatedContext(uid, {
    email: `${uid}@example.test`, email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...extra,
  }).firestore();
}
export const anon = t => t.unauthenticatedContext().firestore();

// 規則停用下直接寫（等同主控台）：只給測試布置用
export async function seed(t, fn) { await t.withSecurityRulesDisabled(async c => fn(c.firestore())); }

export async function seedRole(t, uid, r) {
  await seed(t, db => db.doc(`roles/${uid}`).set({
    super: false, depts: {}, rev: 1, lastVia: 'manual', lastRef: 'bootstrap',
    updatedAt: TS.now(), updatedBy: uid, ...r,
  }));
}
export async function seedDepts(t) {
  await seed(t, async db => {
    const b = db.batch();
    DEPTS.forEach((id, i) => b.set(db.doc(`departments/${id}`), { name: id, order: i, active: id !== 'fruit', updatedAt: TS.now(), updatedBy: 'seed' }));
    await b.commit();
  });
}

// ---------- 卡片 ----------
export function cardData(uid, o = {}) {
  return {
    deptId: 'rights', title: '卡片', blocks: [{ id: 'b1', text: '第一行', check: null, timeId: null }],
    timeIds: [], issueId: null, staff: [], labels: [], links: [], report: false, state: 'open',
    doneAt: null, deletedAt: null, deletedBy: null, order: 1000, version: 1,
    createdAt: NOW(), createdBy: uid, updatedAt: NOW(), updatedBy: uid, ...o,
  };
}
export function verData(uid, cardId, card, o = {}) {
  return {
    cardId, deptId: card.deptId, version: card.version, title: card.title, blocks: card.blocks,
    times: [], state: card.state, by: uid, at: NOW(), imported: false, ...o,
  };
}
// 新建卡片＋第 1 版
export function createCard(db, uid, id, o = {}, vo = {}) {
  const c = cardData(uid, o);
  const b = db.batch();
  b.set(db.doc(`cards/${id}`), c);
  if (vo !== null) b.set(db.doc(`cards/${id}/versions/${c.version}`), verData(uid, id, c, vo));
  return b.commit();
}
// 修改卡片（version +1）＋新版本；cur＝目前卡片內容
export function editCard(db, uid, id, cur, patch = {}, vo = {}) {
  const c = { ...cur, ...patch, updatedAt: NOW(), updatedBy: uid };
  if (!('version' in patch)) c.version = cur.version + 1;
  const b = db.batch();
  b.set(db.doc(`cards/${id}`), c);
  if (vo !== null) b.set(db.doc(`cards/${id}/versions/${c.version}`), verData(uid, id, c, vo));
  return b.commit();
}
// ---------- 永久刪除卡片（02A；前端 02B／03 照這個順序做） ----------
// ① 開始：open／done → purging，同批先刪最多 3 個時間事件；② 清除：每批最多 3 個時間事件、或由新往舊最多 3 個版本；
// ③ 最後一批刪掉剩下的版本（最多 3 個）與卡片。x＝使用者的 Firestore（部門編輯者以上）。
// 一批的大小照整批讀取上限 20 估算、不依賴快取：事件 3×4＋卡片 5＝17；版本 3×5＋卡片 3＝18。
export function purgeStartData(cur, uid, timeIds) {
  return { ...cur, state: 'purging', deletedAt: NOW(), deletedBy: uid, timeIds, updatedAt: NOW(), updatedBy: uid };
}
export async function purgeCard(x, uid, id, { evPer = 3, verPer = 3 } = {}) {
  const ref = x.doc(`cards/${id}`);
  let cur = (await ref.get()).data();
  let ids = [...(cur.timeIds || [])];
  const take = n => ids.splice(0, n);
  let gone = take(evPer), b = x.batch();
  if (cur.state !== 'purging') {
    b.set(ref, purgeStartData(cur, uid, ids.slice()));
    gone.forEach(e => b.delete(x.doc(`events/${e}`)));
    await b.commit();
  } else { ids.unshift(...gone); }
  while (ids.length) {
    gone = take(evPer); b = x.batch();
    gone.forEach(e => b.delete(x.doc(`events/${e}`)));
    b.update(ref, { timeIds: ids.slice(), updatedAt: NOW(), updatedBy: uid });
    await b.commit();
  }
  const vs = (await x.collection(`cards/${id}/versions`).get()).docs.map(d => +d.id).sort((p, q) => q - p);   // 新 → 舊
  while (vs.length > verPer) { b = x.batch(); vs.splice(0, verPer).forEach(v => b.delete(x.doc(`cards/${id}/versions/${v}`))); await b.commit(); }
  b = x.batch(); vs.forEach(v => b.delete(x.doc(`cards/${id}/versions/${v}`))); b.delete(ref);
  await b.commit();
}
// 卡片＋時間事件（timeIds 列出全部事件）
export function eventData(uid, cardId, o = {}) {
  return { deptId: 'rights', cardId, blockId: null, label: '時間', start: TS.fromMillis(Date.UTC(2026, 10, 20)), end: TS.fromMillis(Date.UTC(2026, 10, 20)),
    startRaw: '2026-11-20', endRaw: '2026-11-20', allDay: true, place: '', toIssue: false, scope: 'dept', visibility: 'internal',
    rev: 1, updatedAt: NOW(), updatedBy: uid, ...o };
}
export async function createCardWithEvents(x, uid, id, nEvents, o = {}) {
  const timeIds = Array.from({ length: nEvents }, (_, i) => `${id}_t${i + 1}`);
  const c = cardData(uid, { timeIds, ...o });
  const b = x.batch();
  b.set(x.doc(`cards/${id}`), c);
  b.set(x.doc(`cards/${id}/versions/1`), verData(uid, id, c));
  timeIds.forEach(e => b.set(x.doc(`events/${e}`), eventData(uid, id, { deptId: c.deptId })));
  await b.commit();
  return timeIds;
}
export async function readDoc(t, p) { let v; await seed(t, async db => { v = (await db.doc(p).get()).data(); }); return v; }

// ---------- 稽核紀錄 ----------
export function audit(col, docId, rev, actor, o = {}) {
  return { col, docId, rev, action: 'x', actor, at: NOW(), before: {}, after: {}, ref: '', ...o };
}
export const auditId = (col, id, rev) => `auditLogs/${col}_${id}_${rev}`;

// ---------- 邀請 ----------
import { createHash, randomBytes } from 'node:crypto';
export function newToken() { const t = randomBytes(32).toString('base64url'); return { token: t, h: createHash('sha256').update(t).digest('hex') }; }
// ---------- 建構合法的邀請／角色寫入；攻擊測試改其中的欄位（rules-invites、rules-02a 共用） ----------
const MIN = 60000;
export async function commit(x, writes) { const b = x.batch(); for (const [p, v, op] of writes) op === 'delete' ? b.delete(x.doc(p)) : b.set(x.doc(p), v); return b.commit(); }
export function inviteWrites(u, h, o = {}) {
  const inv = { deptId: 'rights', role: 'editor', status: 'active', rev: 1, createdBy: u, createdAt: NOW(),
    expiresAt: TS.fromMillis(Date.now() + 10 * MIN - 5000), updatedAt: NOW(), updatedBy: u, ...o };
  return [[`invitations/${h}`, inv],
    [auditId('invitations', h, 1), { col: 'invitations', docId: h, rev: 1, action: 'create', actor: u, at: NOW(), before: {}, after: { status: 'active' }, ref: '' }]];
}
// 核銷：cur＝目前的 roles（或 null），next＝核銷後的權限 {super, depts}
export function redeemWrites(u, k, cur, next, o = {}) {
  const rev = cur ? cur.rev + 1 : 1;
  const inv = { ...k.inv, status: 'used', usedBy: u, usedAt: NOW(), token: k.token, rev: k.inv.rev + 1, updatedAt: NOW(), updatedBy: u };
  const roles = { super: false, depts: {}, ...(cur ? { super: cur.super, depts: cur.depts } : {}), ...next,
    rev, lastVia: 'invite', lastRef: k.h, updatedAt: NOW(), updatedBy: u };
  const w = [[`invitations/${k.h}`, inv],
    [auditId('invitations', k.h, inv.rev), { col: 'invitations', docId: k.h, rev: inv.rev, action: 'redeem', actor: u, at: NOW(), before: { status: 'active' }, after: { status: 'used' }, ref: k.h }],
    [`roles/${u}`, roles],
    [auditId('roles', u, rev), { col: 'roles', docId: u, rev, action: 'invite', actor: u, at: NOW(),
      before: cur ? { super: cur.super, depts: cur.depts } : {},
      after: { super: roles.super, depts: roles.depts }, ref: k.h }]];
  if (k.inv.legacyRef) w.push([`legacyIdentities/${k.inv.legacyRef}`, { ...o.legacy, claimedBy: u, claimedAt: NOW(), rev: o.legacy.rev + 1, updatedAt: NOW(), updatedBy: u }],
    [auditId('legacyIdentities', k.inv.legacyRef, o.legacy.rev + 1), { col: 'legacyIdentities', docId: k.inv.legacyRef, rev: o.legacy.rev + 1, action: 'claim', actor: u, at: NOW(), before: {}, after: {}, ref: k.h }]);
  return w;
}
export const patch = (w, i, p) => { w[i] = [w[i][0], { ...w[i][1], ...p }]; return w; };
// 總管理員寫角色（manual／revoke／request）
export function superRoleWrites(actor, uid, cur, next, via, ref = 'manual-1', o = {}) {
  const rev = cur ? cur.rev + 1 : 1;
  const roles = { super: false, depts: {}, ...(cur ? { super: cur.super, depts: cur.depts } : {}), ...next,
    rev, lastVia: via, lastRef: ref, updatedAt: NOW(), updatedBy: actor };
  return [[`roles/${uid}`, roles],
    [auditId('roles', uid, rev), { col: 'roles', docId: uid, rev, action: via, actor, at: NOW(),
      before: cur ? { super: cur.super, depts: cur.depts } : {},
      after: { super: roles.super, depts: roles.depts }, ref, ...o }]];
}
