const { signToken } = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const pw = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_JWT_SECRET;

  if (!pw || !secret) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Server not configured' }));
    return;
  }

  let body = '';
  req.on('data', (c) => body += c);
  req.on('end', () => {
    try {
      const { password } = JSON.parse(body || '{}');
      if (!password || password !== pw) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'Invalid password' }));
        return;
      }

      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
      const token = signToken({ role: 'admin', exp: expiresAt }, secret);

      res.statusCode = 200;
      res.end(JSON.stringify({ token, expiresAt }));
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Bad request' }));
    }
  });
};
