// Basic mapping from country code to language (best-effort)
export function detectLangByPhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  const rules = [
    [/^(234)/, 'en'], // NG
    [/^(1)/, 'en'],   // US/CA
    [/^(44)/, 'en'],  // UK
    [/^(91)/, 'hi'],
    [/^(55)/, 'pt'],
    [/^(34)/, 'es'],
    [/^(39)/, 'it'],
    [/^(33)/, 'fr'],
    [/^(49)/, 'de'],
    [/^(62)/, 'id'],
    [/^(90)/, 'tr'],
    [/^(7)/,  'ru'],
    [/^(81)/, 'ja'],
    [/^(82)/, 'ko'],
    [/^(86)/, 'zh']
  ];
  for (const [re, lang] of rules) if (re.test(digits)) return lang;
  return 'en';
}

const T = {
  help: {
    en: `*DMS* commands:\n• !help — menu\n• !owner — show owner\n• !payment — support info`,
    es: `*DMS* comandos:\n• !help — menú\n• !owner — dueño\n• !payment — pagos`,
    pt: `*DMS* comandos:\n• !help — menu\n• !owner — dono\n• !payment — pagamento`,
    fr: `*DMS* commandes:\n• !help — menu\n• !owner — propriétaire\n• !payment — paiement`,
    de: `*DMS* Befehle:\n• !help — Menü\n• !owner — Besitzer\n• !payment — Zahlung`,
    hi: `*DMS* कमांड्स:\n• !help — मेनू\n• !owner — मालिक\n• !payment — भुगतान`,
    id: `*DMS* perintah:\n• !help — menu\n• !owner — pemilik\n• !payment — pembayaran`,
    it: `*DMS* comandi:\n• !help — menu\n• !owner — proprietario\n• !payment — pagamenti`,
    ru: `*DMS* команды:\n• !help — меню\n• !owner — владелец\n• !payment — оплата`,
    tr: `*DMS* komutlar:\n• !help — menü\n• !owner — sahip\n• !payment — ödeme`,
    ja: `*DMS* コマンド:\n• !help — メニュー\n• !owner — オーナー\n• !payment — 支払い`,
    ko: `*DMS* 명령어:\n• !help — 메뉴\n• !owner — 소유자\n• !payment — 결제`,
    zh: `*DMS* 命令：\n• !help — 菜单\n• !owner — 所有者\n• !payment — 付款`
  }
};

export function tHelp(lang) { return T.help[lang] || T.help.en; }