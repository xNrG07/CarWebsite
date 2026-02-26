const crypto = require('crypto');

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function hmac(data, secret) {
  return base64url(crypto.createHmac('sha256', secret).update(data).digest());
}

function signToken(payloadObj, secret) {
  const payload = base64url(JSON.stringify(payloadObj));
  const sig = hmac(payload, secret);
  return `${payload}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = hmac(payload, secret);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const data = JSON.parse(json);
    if (data && data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function getBearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (!h) return null;
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function requireAdmin(req) {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    return { ok: false, status: 500, error: 'Missing ADMIN_JWT_SECRET' };
  }
  const token = getBearerToken(req);
  const data = verifyToken(token, secret);
  if (!data || data.role !== 'admin') {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true, data };
}

module.exports = {
  signToken,
  requireAdmin
};
