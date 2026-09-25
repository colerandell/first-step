// POST /api/ai — writes clarifying questions and step breakdowns with Claude.
// The prompts live here on the server, so the endpoint can only do First Step's
// three jobs and can't be used as a general-purpose proxy for your API key.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const clip = (v, n) => String(v ?? "").slice(0, n);

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

Reply with JSON only: {"vague": true, "question": "..."} or {"vague": false, "question": ""}`;
  }
  if (b.kind === "breakdown") {
    const t = b.task || {};
    const maxSteps = [3, 5, 10].includes(b.maxSteps) ? b.maxSteps : 5;
    const firstMax = [5, 10, 15].includes(b.firstStepMax) ? b.firstStepMax : 10;
    const ctx = [focus];
    if (t.purpose) ctx.push(`They answered "${clip(t.purposeQ || "What's this for?", 120)}": ${clip(t.purpose, 200)}`);
    if (t.timing && t.timing.date) ctx.push(`Timing: ${clip(t.timing.label || "deadline", 60)} on ${clip(t.timing.date, 10)} (today is ${clip(b.today, 10)})`);
    else ctx.push("No deadline. Nothing external is forcing this.");
    const done = Array.isArray(b.keepDone) ? b.keepDone.slice(0, 10).map(s => clip(s, 160)) : [];
    if (done.length) ctx.push(`Already done: ${done.join("; ")}. Continue from there.`);
    const minSteps = Math.min(3, maxSteps);
    return `Break down a stalled, self-directed career or school task into concrete steps.

Task: "${clip(t.title, 200)}"
${ctx.filter(Boolean).join("\n")}

Rules:
- ${minSteps === maxSteps ? maxSteps : `${minSteps} to ${maxSteps}`} steps, in order. Use only as many as the task needs. Smallest action first: step 1 is startable right now and takes ${firstMax} minutes or less.
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

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const prompt = buildPrompt(body);
  if (!prompt) return res.status(400).json({ code: "bad_request" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 800, messages: [{ role: "user", content: prompt }] })
    });
    if (r.status === 429) return res.status(429).json({ code: "rate_limited" });
    if (!r.ok) return res.status(502).json({ code: "upstream_error" });
    const data = await r.json();
    const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ code: "invalid_json" });
    return res.status(200).json(JSON.parse(match[0]));
  } catch {
    return res.status(502).json({ code: "upstream_error" });
  }
}
