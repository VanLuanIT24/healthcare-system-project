const crypto = require('crypto');
const env = require('../config/env');

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  const secret = env.jwtAccessSecret || env.jwtRefreshSecret || 'development-signed-url-secret';
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function timingSafeSignatureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'base64url');
  const rightBuffer = Buffer.from(String(right || ''), 'base64url');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createSignedDownloadUrl(attachment = {}, { expiresInSeconds = 300 } = {}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = {
    attachment_id: String(attachment._id || attachment.id),
    storage_provider: attachment.storage_provider || 'local',
    storage_key: attachment.storage_key || attachment.storage_path,
    token_version: Number(attachment.signed_download_token_version || 1),
    released_to_patient: Boolean(attachment.released_to_patient),
    visibility: attachment.visibility,
    status: attachment.status,
    iat: issuedAt,
    exp: expiresAt,
  };
  const encoded = base64Url(JSON.stringify(payload));
  const signature = sign(encoded);
  return {
    url: `/records/attachments/${payload.attachment_id}/signed-download?token=${encoded}.${signature}`,
    expires_at: new Date(expiresAt * 1000),
  };
}

function verifySignedDownloadToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return { valid: false, reason: 'invalid_signature' };
  const [encoded, signature] = parts;
  if (!encoded || !signature || !timingSafeSignatureEqual(sign(encoded), signature)) return { valid: false, reason: 'invalid_signature' };
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch (_) {
    return { valid: false, reason: 'invalid_payload' };
  }
  if (!payload || typeof payload !== 'object') return { valid: false, reason: 'invalid_payload' };
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return { valid: false, reason: 'expired' };
  if (!payload.attachment_id || !payload.storage_key || !payload.token_version) return { valid: false, reason: 'invalid_payload' };
  return { valid: true, payload };
}

module.exports = {
  createSignedDownloadUrl,
  verifySignedDownloadToken,
};
