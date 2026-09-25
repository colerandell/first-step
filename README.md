# First Step

Break vague career and school tasks into one small step a day.

The app works in three levels. Each one adds a feature, and you can stop at any level.

| Level | What works | What you need |
|---|---|---|
| 1. Deploy | Whole app. Accounts and tasks save in each visitor's browser. Sample tasks have hand-written steps. | A Vercel account |
| 2. Turn on AI | Clarifying questions, AI breakdowns, "Still too big", Regenerate | An Anthropic API key |
| 3. Turn on real accounts | Email + password sign-up, tasks sync across devices, password reset | A free Supabase project |

---

## Level 1: Deploy (about 10 minutes)

1. Create a GitHub account if you don't have one, then create a **new repository** called `first-step`.
2. In the new repo, click **Add file → Upload files**. Drag in everything **inside** this folder (`index.html`, `api`, `supabase`, `package.json`, `README.md`), then click **Commit changes**.
3. Go to **vercel.com**, sign up with GitHub, click **Add New → Project**, and import `first-step`.
4. Leave every setting as it is (Framework Preset: **Other**) and click **Deploy**.

You get a live link like `first-step.vercel.app`. Anyone can open it.

## Level 2: Turn on AI (about 5 minutes)

1. Go to **console.anthropic.com** → **API Keys** → create a key. Add a little credit, and set a **monthly spend limit** under Billing.
2. In Vercel: your project → **Settings → Environment Variables**. Add:
   - `ANTHROPIC_API_KEY` = your key
   - `ANTHROPIC_MODEL` (optional) = a model ID from the Anthropic docs. It defaults to `claude-haiku-4-5`, which is fast and cheap.
3. **Deployments → ⋯ → Redeploy.**

Your key stays on the server. The app can only ask for First Step's three jobs (questions, breakdowns, splits), so nobody can use your key for anything else. Once Level 3 is on, only signed-in users can use AI.

## Level 3: Turn on real accounts (about 15 minutes)

1. Go to **supabase.com** → **New project** (the free plan is fine).
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and click **Run**. This creates the table and the rules that keep each user's tasks private.
3. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
4. In Vercel's Environment Variables, add:
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_ANON_KEY` = the anon public key
5. In Supabase, open **Authentication → URL Configuration**:
   - **Site URL** = your Vercel link (e.g. `https://first-step.vercel.app`)
   - **Redirect URLs** → add the same link
6. Redeploy in Vercel.

Sign-up now asks for a password. Supabase emails new users a confirmation link, and "Forgot password?" sends a reset link.

### Optional: "Continue with Google"

1. In Supabase, open **Authentication → Providers → Google** and follow its steps to create a Google OAuth client.
2. In Vercel, add `GOOGLE_SIGN_IN` = `on` and redeploy.

---

## What's different from the Claude version

- **Accounts:** email + password through Supabase, instead of your Claude login.
- **AI:** runs on your own Anthropic API key, so you pay for usage (small at this scale).
- **Google Calendar:** "Add to Google Calendar" opens Google Calendar with the event already filled in, and the user taps Save. No calendar connection is needed.
- Everything else is the same: onboarding, one step a day, the wait line, AI tags, Settings, and Behind the build.

## Files

- `index.html`: the whole app
- `api/ai.js`: the AI endpoint (the prompts live here)
- `api/config.js`: tells the app which levels are switched on
- `supabase/schema.sql`: the database table and privacy rules
