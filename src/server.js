import 'dotenv/config.js';
import express from 'express';
import cors from 'cors';
import Pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';
import { mockBot } from './mockBot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const logger = Pino({ level: 'info' });

app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN === '*' ? true : process.env.FRONTEND_ORIGIN || true
}));

// Serve frontend
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// Health
app.get('/api/health', (req, res) => res.json({ ok: true, name: process.env.BOT_NAME || 'DMS (Mock)' }));

// Pair (password protected)
app.post('/api/pair', (req, res) => {
  const { phone, password } = req.body || {};
  const pw = process.env.PAIR_PASSWORD || 'Sazzy';
  if (!phone || !/^\+?[0-9]{6,15}$/.test(String(phone))) {
    return res.status(400).json({ error: 'Provide phone with country code, digits only (6-15).' });
  }
  if (password !== pw) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Normalize phone to digits only (keep optional leading +)
  const normalized = String(phone).trim();
  const { code, lang } = mockBot.pair(normalized);
  logger.info({ phone: normalized, lang }, 'Mock pair created');
  return res.json({ code, lang, mock: true });
});

// Simulate inbox for demo (optional)
app.post('/api/mock/sendToBot', async (req, res) => {
  const { phone, text } = req.body || {};
  if (!phone || !text) return res.status(400).json({ error: 'phone and text required' });
  await mockBot.receiveMessage(String(phone), String(text));
  res.json({ ok: true });
});

// Toggle features per phone (demo admin)
app.post('/api/mock/toggle', (req, res) => {
  const { phone, feature, on } = req.body || {};
  const flags = mockBot.toggle(String(phone), feature, !!on);
  if (!flags) return res.status(400).json({ error: 'invalid phone or feature' });
  res.json({ phone, flags });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => logger.info(`DMS (Mock) running on :${PORT}`));