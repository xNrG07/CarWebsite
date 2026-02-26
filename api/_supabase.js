const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const err = new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    err.statusCode = 500;
    throw err;
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'wm-autoparadies-vercel' } }
  });
}

module.exports = { getSupabase };
