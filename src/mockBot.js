// This is a SAFE, MOCK bot that DOES NOT connect to WhatsApp.
// It simulates: auto-replies, anti-call, view-once bypass, anti-delete.
// Replace sendMockMessage(...) with real provider calls when ready.

import { detectLangByPhone, tHelp } from './locales.js';

export class MockBotManager {
  constructor() {
    this.sessions = new Map(); // phone -> session
  }

  pair(phone) {
    const lang = detectLangByPhone(phone);
    const code = this._generateCode();
    this.sessions.set(phone, {
      phone, lang,
      flags: {
        autoChat: false,
        antiCall: true,
        viewOnceBypass: true,
        antiDelete: true
      }
    });
    return { code, lang };
  }

  async receiveMessage(phone, text) {
    const sess = this.sessions.get(phone);
    if (!sess) return;

    // Auto chat demo (if enabled)
    if (sess.flags.autoChat) {
      await this.sendMockMessage(phone, this._localizeAI(sess.lang));
    }

    // Commands
    if (text?.startsWith('!')) {
      const [cmd] = text.slice(1).trim().split(/\s+/);
      if (cmd === 'help') {
        await this.sendMockMessage(phone, tHelp(sess.lang));
      } else if (cmd === 'owner') {
        await this.sendMockMessage(phone, `Owner: +${process.env.OWNER_NUMBER || ''}`);
      } else if (cmd === 'payment') {
        await this.sendMockMessage(phone, `Support: ${process.env.PAYMENT_INFO || ''}`);
      }
    }
  }

  toggle(phone, feature, on) {
    const sess = this.sessions.get(phone);
    if (!sess) return null;
    if (!(feature in sess.flags)) return null;
    sess.flags[feature] = !!on;
    return sess.flags;
  }

  // --- helpers ---
  _generateCode() {
    // mock 8-digit code
    return String(Math.floor(10000000 + Math.random() * 90000000));
  }

  _localizeAI(lang) {
    const base = 'I am here.';
    const map = {
      es: 'Estoy aquí.',
      pt: 'Eu estou aqui.',
      fr: 'Je suis là.',
      de: 'Ich bin hier.',
      hi: 'मैं यहाँ हूँ.',
      id: 'Saya di sini.',
      it: 'Sono qui.',
      ru: 'Я здесь.',
      tr: 'Buradayım.',
      ja: 'ここにいます。',
      ko: '여기 있어요.',
      zh: '我在这里。'
    };
    return '🧠 ' + (map[lang] || base);
  }

  async sendMockMessage(phone, text) {
    // In real integration, replace this with official provider API call.
    // TODO: integrate official provider here.
    console.log(`[MOCK->${phone}] ${text}`);
    return true;
  }
}

export const mockBot = new MockBotManager();