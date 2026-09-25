// POST /api/ai — writes clarifying questions and step breakdowns with Claude.
// The prompts live here on the server, so the endpoint can only do First Step's
// three jobs and can't be used as a general-purpose proxy for your API key.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const FIRST_STEP_CEILING = 10; // the first step is never longer than this, whatever the setting says
const clip = (v, n) => String(v ?? "").slice(0, n);
const between = (v, lo, hi, d) => Number.isInteger(v) && v >= lo && v <= hi ? v : d;
const firstStepMax = (b) => between(b.firstStepMax, 2, FIRST_STEP_CEILING, FIRST_STEP_CEILING);
const MAX_STEPS = 100;
const stepCount = (b) => between(b.stepCount ?? b.maxSteps, 2, MAX_STEPS, 5); // maxSteps: older clients

async function signedIn(req) {
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return true; // no accounts configured: allow (browser-only mode)
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } });
    return r.ok;
  } catch { return false; }
}

function buildPrompt(b) {
  const focus = b.focus ? `The user's focus: ${clip(b.focus, 40)}.` : "";
  if (b.kind === "clarify") {
    return `A career-focused student or early-career person just added this to their to-do list: "${clip(b.title, 200)}"
${focus}
Decide if it's vague or oversized (no obvious first action, or more than ~2 hours of work). If it is, write ONE short clarifying question that would make the breakdown specific to them. Good questions ask what it's for, who it's aimed at, or what the one sticking point is (e.g. "What's this portfolio for?", "Which roles are you applying to?", "What part feels hardest to start?"). Don't ask about timing; that's asked separately. Under 70 characters.

Also suggest how many steps it needs, from 2 to 10: 2-3 for a small, clear task, 4-6 for a typical one, 7-10 for a big project.

Reply with JSON only: {"vague": true, "question": "...", "steps": 5} or {"vague": false, "question": "", "steps": 3}`;
  }
  if (b.kind === "breakdown") {
    const t = b.task || {};
    const firstMax = firstStepMax(b);
    const ctx = [focus];
    if (t.purpose) ctx.push(`They answered "${clip(t.purposeQ || "What's this for?", 120)}": ${clip(t.purpose, 200)}`);
    if (t.timing && t.timing.date) ctx.push(`Timing: ${clip(t.timing.label || "deadline", 60)} on ${clip(t.timing.date, 10)} (today is ${clip(b.today, 10)})`);
    else ctx.push("No deadline. Nothing external is forcing this.");
    const done = Array.isArray(b.keepDone) ? b.keepDone.slice(0, MAX_STEPS).map(s => clip(s, 160)) : [];
    if (done.length) ctx.push(`Already done: ${done.join("; ")}. Continue from there.`);
    const count = done.length ? Math.max(1, stepCount(b) - done.length) : stepCount(b);
    return `Break down a stalled, self-directed career or school task into concrete steps.

Task: "${clip(t.title, 200)}"
${ctx.filter(Boolean).join("\n")}

Rules:
- Exactly ${count} ${done.length ? "more " : ""}step${count === 1 ? "" : "s"}, in order. The person chose this number: fewer steps means each one covers more. Smallest action first: step 1 is startable right now and takes ${firstMax} minutes or less.
- Each step starts with a physical verb and names the specific thing produced, using details they gave. Never generic phases like "Research", "Outline", "Build", "Plan".
- If the hard part is a decision or something uncomfortable (a resume gap, a topic choice), make step 1 a tiny, low-stakes draft of that decision.
- Under 90 characters each. Realistic minute estimates.

Reply with JSON only: {"steps":[{"text":"...","minutes":10}]}`;
  }
  if (b.kind === "split") {
    return `Someone is stuck on one step of a career or school task.
Task: "${clip(b.title, 200)}"${b.purpose ? `\nContext: ${clip(b.purpose, 200)}` : ""}
Stuck step: "${clip(b.stepText, 160)}"

Split it into 2 or 3 smaller steps. The first takes 5 minutes or less and can start right now. Physical verbs, specific, under 90 characters.

Reply with JSON only: {"steps":[{"text":"...","minutes":5}]}`;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ code: "bad_request" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ code: "not_configured" });
  if (!(await signedIn(req))) return res.status(401).json({ code: "not_signed_in" });

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); }
  catch { return res.status(400).json({ code: "bad_request" }); }
  const prompt = buildPrompt(body);
  if (!prompt) return res.status(400).json({ code: "bad_request" });

  try {
    // Long breakdowns need room: roughly 40 tokens per step.
    const result = await askClaude(prompt, body.kind === "breakdown" ? Math.min(8000, 800 + 40 * stepCount(body)) : 800);
    if (body.kind === "breakdown") await enforceFirstStep(result, body);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 502).json({ code: e.code || "upstream_error", ...e.detail });
  }
}

// Sends one prompt to Claude and returns the JSON object from its reply.
async function askClaude(prompt, maxTokens = 800) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] })
  });
  if (r.status === 429) throw { status: 429, code: "rate_limited" };
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    const detail = { status: r.status, type: err?.error?.type || null, message: String(err?.error?.message || "").slice(0, 300), model: MODEL };
    console.error("Anthropic API error", detail);
    throw { status: 502, code: "upstream_error", detail };
  }
  const data = await r.json();
  const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw { status: 502, code: "invalid_json" };
  try { return JSON.parse(match[0]); } catch { throw { status: 502, code: "invalid_json" }; }
}

// If step 1 of a breakdown is over the first-step limit, asks Claude to split it
// and puts the smaller steps in its place. On any failure, keeps the original breakdown.
async function enforceFirstStep(result, b) {
  const steps = Array.isArray(result.steps) ? result.steps : [];
  const first = steps[0];
  if (!first || !(Number(first.minutes) > firstStepMax(b))) return;
  try {
    const t = b.task || {};
    const split = await askClaude(buildPrompt({ kind: "split", title: t.title, purpose: t.purpose, stepText: first.text }));
    const smaller = Array.isArray(split.steps) ? split.steps.filter(s => s && s.text) : [];
    if (!smaller.length || !(Number(smaller[0].minutes) <= firstStepMax(b))) return;
    result.steps = [...smaller, ...steps.slice(1)].slice(0, MAX_STEPS);
  } catch { /* keep the original breakdown */ }
}
