import path from 'path';
import { ensureDir, readJSON, writeJSON } from './utils.js';

const ROOT = path.resolve('sessions');
const REGISTRY = path.join(ROOT, 'registry.json');
ensureDir(ROOT);

export function listSessions() {
  const reg = readJSON(REGISTRY, { sessions: [] });
  return reg.sessions;
}

export function getSession(jid) {
  return listSessions().find(s => s.jid === jid);
}

export function upsertSession(record) {
  const reg = readJSON(REGISTRY, { sessions: [] });
  const i = reg.sessions.findIndex(s => s.jid === record.jid);
  if (i >= 0) reg.sessions[i] = { ...reg.sessions[i], ...record };
  else reg.sessions.push(record);
  writeJSON(REGISTRY, reg);
  return record;
}

export function setSessionState(jid, patch) {
  const s = getSession(jid) || { jid };
  upsertSession({ ...s, ...patch });
}

export function removeSession(jid) {
  const reg = readJSON(REGISTRY, { sessions: [] });
  const next = reg.sessions.filter(s => s.jid !== jid);
  writeJSON(REGISTRY, { sessions: next });
}

export function sessionPathByJid(jid) {
  const safe = jid.replace(/[:\/\\]/g, '_');
  const p = path.join(ROOT, safe);
  ensureDir(p);
  return p;
}