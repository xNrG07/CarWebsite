const { getSupabase } = require('./_supabase');
const { requireAdmin } = require('./_auth');

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

function normalizeStatus(v) {
  return String(v || '').toLowerCase() === 'reserviert' ? 'reserviert' : 'verkauf';
}

module.exports = async (req, res) => {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return json(res, 500, { error: 'DB error' });

    // Public inventory only (verkauf/reserviert)
    const cars = (data || []).filter(c => ['verkauf', 'reserviert'].includes(String(c.status || '').toLowerCase()));
    return json(res, 200, cars);
  }

  if (req.method === 'POST') {
    const auth = requireAdmin(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    try {
      const payload = await readBody(req);
      const row = {
        make: String(payload.make || '').trim(),
        model: String(payload.model || '').trim(),
        year: payload.year ?? null,
        km: payload.km ?? null,
        fuel: payload.fuel ?? null,
        gearbox: payload.gearbox ?? null,
        price: payload.price ?? null,
        status: normalizeStatus(payload.status),
        image_url: payload.image_url ?? null,
        description: payload.description ?? null,
        willhaben_url: payload.willhaben_url ?? null
      };

      if (!row.make || !row.model) return json(res, 400, { error: 'Missing make/model' });

      const { data, error } = await supabase
        .from('cars')
        .insert(row)
        .select('*')
        .single();

      if (error) return json(res, 500, { error: 'DB error' });
      return json(res, 200, data);
    } catch {
      return json(res, 400, { error: 'Bad request' });
    }
  }

  return json(res, 405, { error: 'Method not allowed' });
};
