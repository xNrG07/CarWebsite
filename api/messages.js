const { getSupabase } = require('./_supabase');

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(e); }
    });
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const supabase = getSupabase();

  try {
    const p = await readBody(req);

    const row = {
      vorname: p.vorname ?? null,
      nachname: p.nachname ?? null,
      email: p.email ?? null,
      telefon: p.telefon ?? null,
      nachricht: p.nachricht ?? null,
      submitted_at: p.submitted_at ? new Date(p.submitted_at).toISOString() : new Date().toISOString()
    };

    const { error } = await supabase.from('contact_messages').insert(row);
    if (error) return json(res, 500, { error: 'DB error' });

    return json(res, 200, { ok: true });
  } catch {
    return json(res, 400, { error: 'Bad request' });
  }
};
