const { getSupabase } = require('../_supabase');
const { requireAdmin } = require('../_auth');

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
  const { id } = req.query || {};
  if (!id) return json(res, 400, { error: 'Missing id' });

  if (req.method === 'PUT') {
    const auth = requireAdmin(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    try {
      const payload = await readBody(req);
      const patch = {
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

      if (!patch.make || !patch.model) return json(res, 400, { error: 'Missing make/model' });

      const { data, error } = await supabase
        .from('cars')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();

      if (error) return json(res, 500, { error: 'DB error' });
      return json(res, 200, data);
    } catch {
      return json(res, 400, { error: 'Bad request' });
    }
  }

  if (req.method === 'DELETE') {
    const auth = requireAdmin(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    const { error } = await supabase
      .from('cars')
      .delete()
      .eq('id', id);

    if (error) return json(res, 500, { error: 'DB error' });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
};
