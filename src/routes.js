import express from 'express';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { listSessions, getSession, setSessionState } from './sessionStore.js';
import { createFromPhoneNumber, getSocket, setFlag, logoutAndStop } from './botManager.js';

export function buildRouter(env) {
  const router = express.Router();

  const requireAdmin = (req, res, next) => {
    const tok = req.headers['x-admin-token'] || req.query.token;
    if (!env.ADMIN_TOKEN || tok === env.ADMIN_TOKEN) return next();
    return res.status(401).json({ error: 'Unauthorized' });
  };

  // Health
  router.get('/health', (req, res) => res.json({ ok: true, name: env.BOT_NAME || 'DMS' }));

  // Public: request pairing code
  router.post('/pair', express.json(), async (req, res) => {
    try {
      const { phone } = req.body || {};
      if (!phone || !/^\d{6,15}$/.test(phone)) {
        return res.status(400).json({ error: 'Provide phone with country code, digits only.' });
      }
      const { pairingCode } = await createFromPhoneNumber(phone, env);
      res.json({ code: pairingCode });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  // Public: quick QR render (optional, not needed for pairing code flow)
  router.get('/qr.svg', async (req, res) => {
    const { text } = req.query;
    if (!text) return res.status(400).send('missing ?text=');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(await QRCode.toString(String(text), { type: 'svg' }));
  });

  // Admin: list sessions
  router.get('/sessions', requireAdmin, (req, res) => {
    res.json({ sessions: listSessions() });
  });

  // Admin: session status
  router.get('/sessions/:jid', requireAdmin, (req, res) => {
    const s = getSession(req.params.jid);
    if (!s) return res.status(404).json({ error: 'Not found' });
    const connected = !!getSocket(req.params.jid);
    res.json({ ...s, connected });
  });

  // Admin: toggle features per session
  router.post('/sessions/:jid/toggle', requireAdmin, express.json(), (req, res) => {
    const { feature, on } = req.body || {};
    const valid = ['autoChat', 'antiCall', 'viewOnceBypass', 'antiDelete'];
    if (!valid.includes(feature)) {
      return res.status(400).json({ error: `feature must be one of: ${valid.join(', ')}` });
    }
    const flags = setFlag(req.params.jid, feature, !!on);
    res.json({ jid: req.params.jid, flags });
  });

  // Admin: broadcast simple message
  router.post('/sessions/:jid/send', requireAdmin, express.json(), async (req, res) => {
    const { to, text } = req.body || {};
    if (!to || !text) return res.status(400).json({ error: 'to and text required' });
    const sock = getSocket(req.params.jid);
    if (!sock) return res.status(400).json({ error: 'Session not connected' });
    await sock.sendMessage(to, { text });
    res.json({ ok: true });
  });

  // Admin: logout session
  router.post('/sessions/:jid/logout', requireAdmin, async (req, res) => {
    await logoutAndStop(req.params.jid);
    res.json({ ok: true });
  });

  // Minimal branding/info
  router.get('/info', (req, res) => {
    res.json({
      name: env.BOT_NAME || 'DMS',
      owner: `+${env.OWNER_NUMBER || ''}`,
      email: env.SUPPORT_EMAIL || '',
      payment: env.PAYMENT_INFO || ''
    });
  });

  return router;
}