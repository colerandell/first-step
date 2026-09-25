// GET /api/config — tells the app which features are switched on.
// The Supabase anon key is designed to be public; row-level security protects the data.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ai: !!process.env.ANTHROPIC_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    google: process.env.GOOGLE_SIGN_IN === "on"
  });
}
