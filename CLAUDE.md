# First Step

First Step breaks vague career and school tasks ("update my portfolio", "apply to internships") into one small step a day. The Today tab shows a single step, never the whole list. Users can mark it **Done**, press **Still too big** to split it smaller, or press **Not today**.

## The one hard rule

**The first step of any task must always take 10 minutes or less.** Any change to prompts, settings or step handling has to keep this true.

- `api/ai.js` enforces it on the server. `FIRST_STEP_CEILING` is 10, and the user's "First step size" setting can only lower it (2 to 10 minutes, picked on a scroll wheel). If Claude returns a breakdown whose step 1 is over the limit, `enforceFirstStep` asks Claude to split that step and puts the smaller steps in its place.
- The "Still too big" split prompt asks for a first step of 5 minutes or less.
- Hand-written sample steps in `index.html` follow the same rule.

## Files

- `index.html`: the whole front end in one file (HTML, CSS and vanilla JS). It has no build step and no framework. Supabase JS loads from jsDelivr.
- `api/ai.js`: `POST /api/ai`, a Vercel serverless function. All prompts live here. It only accepts three request kinds: `clarify` (one clarifying question), `breakdown` (the task's steps) and `split` ("Still too big"). This keeps it from being used as a general proxy for the API key.
- `api/config.js`: `GET /api/config`. It tells the app which features are switched on, based on environment variables.
- `supabase/schema.sql`: one `items` table (a JSON document per task, settings row and profile row) plus row-level security so each user sees only their own rows.
- `package.json`: ES modules (`"type": "module"`), Node 18+. It has no dependencies.
- `README.md`: setup guide for the non-technical owner (the three levels: deploy, AI, accounts).

## Stack and deployment

- **Hosting:** Vercel. It deploys from the `main` branch, so anything merged to `main` goes live. The framework preset is "Other", and Vercel serves `index.html` statically and `api/*.js` as serverless functions.
- **Accounts and data:** Supabase handles email/password sign-up, optional Google sign-in and task sync. Without Supabase configured, the app stores everything in the visitor's `localStorage`.
- **AI:** The app calls the Anthropic Messages API from `api/ai.js` using `fetch`, not an SDK. The model comes from `ANTHROPIC_MODEL` and defaults to `claude-haiku-4-5`. When Supabase is on, only signed-in users can call the endpoint.

Environment variables (set in Vercel): `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (optional), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_SIGN_IN=on` (optional). Every feature is optional: the app has to keep working when any of them is missing.

## Working on it

- Keep the API key and prompts server-side. Never call Anthropic from `index.html`.
- `api/ai.js` returns errors as `{ code }` (`not_configured`, `not_signed_in`, `rate_limited`, `upstream_error`, `invalid_json`, `bad_request`). `aiErr` in `index.html` maps these codes to messages, so keep them in sync.
- Step count: when adding a task the user picks how many steps on a scroll wheel (2 to 10, plus a "Custom" row for any number up to `MAX_STEPS` = 100, set in both `index.html` and `api/ai.js`). The breakdown's `max_tokens` grows with the step count. The `clarify` reply suggests a count (`steps`), the "Default steps" setting is the fallback, and the choice is saved on the task as `stepCount` so Regenerate keeps it. The breakdown prompt asks for exactly that many; a first-step split can add one more.
- Which task's step shows on Today comes from `ranked()`. A task swapped in today (`focusAt`) goes first. Then come deadlines within 3 days, then tasks with no deadline (a setting), then the task that has waited longest. "Swap task" sets `focusAt` for the current day only (days start at 4 AM, `appDayStart`).
- Number pickers use the `wheel()` helper in `index.html` (scroll, tap, mouse wheel or arrow keys).
- The client (`cleanSteps` in `index.html`) clamps minutes and caps a list at 10 steps.
- Keep the portfolio iteration log (a Google Doc in the owner's Drive, "First Step – Iteration Log") up to date: add an entry for each shipped change with what changed and why.
- No test suite or local dev server is set up. `vercel dev` runs the app with its functions locally.
