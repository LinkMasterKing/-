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
    super: false, viewer: false, depts: {}, rev: 1, lastVia: 'manual', lastRef: 'bootstrap',
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
export async function readDoc(t, p) { let v; await seed(t, async db => { v = (await db.doc(p).get()).data(); }); return v; }

// ---------- 稽核紀錄 ----------
export function audit(col, docId, rev, actor, o = {}) {
  return { col, docId, rev, action: 'x', actor, at: NOW(), before: {}, after: {}, ref: '', ...o };
}
export const auditId = (col, id, rev) => `auditLogs/${col}_${id}_${rev}`;

// ---------- 邀請 ----------
import { createHash, randomBytes } from 'node:crypto';
export function newToken() { const t = randomBytes(32).toString('base64url'); return { token: t, h: createHash('sha256').update(t).digest('hex') }; }
