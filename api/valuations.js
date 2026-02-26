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
      marke: p.marke ?? null,
      modell: p.modell ?? null,
      jahr: p.jahr ?? null,
      km: p.km ?? null,
      kraftstoff: p.kraftstoff ?? null,
      zustand: p.zustand ?? null,
      kontakt: p.kontakt ?? null,
      anmerkung: p.anmerkung ?? null,
      submitted_at: p.submitted_at ? new Date(p.submitted_at).toISOString() : new Date().toISOString()
    };

    const { error } = await supabase.from('valuation_requests').insert(row);
    if (error) return json(res, 500, { error: 'DB error' });

    return json(res, 200, { ok: true });
  } catch {
    return json(res, 400, { error: 'Bad request' });
  }
};
