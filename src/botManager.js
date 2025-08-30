import Pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import fetch from 'node-fetch';
import {
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeWASocket
} from '@whiskeysockets/baileys';
import { sessionPathByJid, upsertSession, setSessionState, removeSession } from './sessionStore.js';
import { defaultFlags, normalizeFlags } from './features.js';

const logger = Pino({ level: 'info' });
const sockets = new Map(); // jid -> sock

export function getSocket(jid) {
  return sockets.get(jid);
}

export async function createFromPhoneNumber(phoneNumber, env) {
  // Create a temporary "pending" session; JID is unknown until connected.
  // We'll use the phoneNumber as a temp key until we learn the jid.
  const tempKey = `pending:${phoneNumber}`;
  const sessionPath = sessionPathByJid(tempKey);

  const { state, saveCreds, keys } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    logger,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(keys, logger) },
    browser: [env.BOT_NAME || 'DMS', 'Chrome', '1.0.0']
  });

  // Pairing code (MD only; country code must be included, e.g. 2349070810971)
  const code = await sock.requestPairingCode(phoneNumber);

  // Track creds updates
  sock.ev.on('creds.update', saveCreds);

  // Connection lifecycle
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      // We now know our jid
      const jid = sock?.user?.id?.split(':')[0] + '@s.whatsapp.net';
      if (!jid) return;
      sockets.set(jid, sock);
      sockets.delete(tempKey);
      upsertSession({
        jid,
        phoneNumber,
        flags: defaultFlags(env),
        status: 'connected',
        createdAt: new Date().toISOString()
      });
      setSessionState(jid, { lastOpen: new Date().toISOString() });
      logger.info({ jid }, 'Session connected');
    } else if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      logger.warn({ code, shouldReconnect }, 'Connection closed');
      // when closed before finishing pairing, session remains pending
    }
  });

  // Features wiring (will apply once messages arrive & jid is known)
  wireCommonHandlers(sock, env);

  // cache until jid revealed
  sockets.set(tempKey, sock);

  return { pairingCode: code };
}

function wireCommonHandlers(sock, env) {
  const AI_API = env.AI_API || 'https://api.quotable.io/random';

  // Anti call
  sock.ev.on('call', async (events) => {
    const jid = currentJid(sock);
    if (!jid) return;
    const flags = sessionFlags(jid, env);
    if (!flags.antiCall) return;
    for (const c of events) {
      if (c.isVideo || c.isVoice) {
        try { await sock.rejectCall(c.id); } catch {}
      }
    }
  });

  // View once bypass + anti delete + auto chat
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const jid = currentJid(sock);
    if (!jid) return;
    const flags = sessionFlags(jid, env);

    for (const m of messages) {
      if (!m.message) continue;

      // View once bypass
      if (flags.viewOnceBypass && m.message.viewOnceMessage) {
        m.message = m.message.viewOnceMessage.message;
      }

      // Anti delete is handled in messages.update; here we can still reflect
      // Auto chat
      if (flags.autoChat && !m.key.fromMe) {
        const prompt =
          m.message.conversation ||
          m.message.extendedTextMessage?.text ||
          m.message.imageMessage?.caption ||
          m.message.videoMessage?.caption ||
          '';

        const replyText = await simpleAI(AI_API, prompt);
        await sock.sendMessage(m.key.remoteJid, { text: replyText }, { quoted: m });
      }

      // Basic prefix command demo per session
      const prefix = env.BOT_PREFIX || '!';
      const text =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        '';

      if (text?.startsWith(prefix)) {
        const [cmd, ...args] = text.slice(prefix.length).trim().split(/\s+/);
        if (cmd === 'payment') {
          await sock.sendMessage(m.key.remoteJid, { text: `Support: ${env.PAYMENT_INFO}` }, { quoted: m });
        } else if (cmd === 'owner') {
          await sock.sendMessage(m.key.remoteJid, { text: `Owner: +${env.OWNER_NUMBER}` }, { quoted: m });
        } else if (cmd === 'help') {
          await sock.sendMessage(
            m.key.remoteJid,
            {
              text:
                `*${env.BOT_NAME || 'DMS'}* commands:\n` +
                `• ${prefix}help – menu\n` +
                `• ${prefix}owner – show owner\n` +
                `• ${prefix}payment – support info\n`
            },
            { quoted: m }
          );
        }
      }
    }
  });

  // Anti delete: report deleted messages
  sock.ev.on('messages.update', async (updates) => {
    const jid = currentJid(sock);
    if (!jid) return;
    const flags = sessionFlags(jid, env);
    if (!flags.antiDelete) return;
    // Note: Baileys emits messageStubType for revokes; we can log or notify
    // Here: do nothing noisy, just keep the message content visible since viewOnce bypass + logs help.
  });
}

async function simpleAI(api, prompt) {
  // Very small demo; replace with your own LLM service if desired.
  try {
    const res = await fetch(api);
    const js = await res.json();
    const quote = js.content || js.quote || 'I am here.';
    return `🧠 ${quote}`;
  } catch {
    return '🧠 (AI offline) I am here.';
  }
}

function currentJid(sock) {
  const raw = sock?.user?.id;
  if (!raw) return null;
  return raw.split(':')[0] + '@s.whatsapp.net';
}

// Session flags for a jid
function sessionFlags(jid, env) {
  const s = getSessionSafe(jid);
  return normalizeFlags(s?.flags || defaultFlags(env));
}

import { getSession as _getSession, upsertSession as _upsert } from './sessionStore.js';
function getSessionSafe(jid) {
  return _getSession(jid) || _upsert({ jid, flags: defaultFlags(process.env) });
}

// Toggle flag helper
export function setFlag(jid, key, value) {
  const sess = getSessionSafe(jid);
  const flags = { ...(sess.flags || {}), [key]: !!value };
  setSessionState(jid, { flags });
  return flags;
}

// Logout & stop
export async function logoutAndStop(jid) {
  const sock = sockets.get(jid);
  if (sock) {
    try { await sock.logout(); } catch {}
    try { sock.end(); } catch {}
  }
  sockets.delete(jid);
  removeSession(jid);
}
