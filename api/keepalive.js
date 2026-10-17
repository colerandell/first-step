// GET /api/keepalive — run once a day by the Vercel cron in vercel.json.
// Free Supabase projects pause after about a week with no requests, which breaks sign-in.
// One tiny read a day keeps the project awake. Row-level security means it returns no rows.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return res.status(200).json({ ok: true, skipped: "accounts not configured" });
  try {
    const r = await fetch(`${url}/rest/v1/items?select=id&limit=1`, { headers: { apikey: anon } });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status });
  } catch {
    return res.status(502).json({ ok: false });
  }
}
