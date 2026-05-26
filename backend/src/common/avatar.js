const palettes = [
  ['#2563eb', '#0f766e'],
  ['#7c3aed', '#2563eb'],
  ['#0891b2', '#16a34a'],
  ['#db2777', '#7c3aed'],
  ['#ea580c', '#dc2626'],
  ['#0f766e', '#047857'],
  ['#4f46e5', '#0ea5e9'],
  ['#be123c', '#9333ea'],
  ['#0f172a', '#475569'],
  ['#0369a1', '#0f766e'],
];

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hashString(value) {
  return Array.from(String(value || '')).reduce(
    (sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0,
    7,
  );
}

function getInitials(label, fallbackInitials = 'TK') {
  const words = normalizeText(label).split(' ').filter(Boolean);
  const initials = words
    .slice(-2)
    .map((word) => Array.from(word)[0] || '')
    .join('')
    .toUpperCase();

  return (initials || fallbackInitials).slice(0, 2);
}

function escapeSvgText(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return map[char] || char;
  });
}

function buildInitialAvatar({ label, seed, fallbackInitials = 'TK' } = {}) {
  const source = normalizeText(seed || label || fallbackInitials || 'account');
  const [from, to] = palettes[hashString(source) % palettes.length];
  const initials = escapeSvgText(getInitials(label || seed, fallbackInitials));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="160" height="160" rx="80" fill="url(#g)"/><circle cx="118" cy="42" r="26" fill="rgba(255,255,255,.14)"/><circle cx="38" cy="128" r="34" fill="rgba(255,255,255,.10)"/><text x="80" y="94" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="#fff">${initials}</text></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

module.exports = {
  buildInitialAvatar,
  normalizeText,
};
