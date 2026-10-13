import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AiResult = { ok: boolean; error: string; result: string };
const fail = (error: string): AiResult => ({ ok: false, error, result: "" });

const MODEL = "google/gemini-3.1-flash-lite";

const Input = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("search"), query: z.string().min(1).max(300) }),
  z.object({ mode: z.literal("describe"), title: z.string().min(1).max(200), notes: z.string().max(1000).default("") }),
  z.object({
    mode: z.literal("recommend"),
    current: z.object({ title: z.string(), description: z.string() }),
    candidates: z.array(z.object({ id: z.string(), title: z.string(), keywords: z.string() })).max(60),
  }),
]);

function prompt(d: z.infer<typeof Input>) {
  switch (d.mode) {
    case "search":
      return `A user searched a movie site for: "${d.query}". Return json {"terms": string[]} with 3-8 short single-word or two-word keywords (genres, synonyms, key nouns) that would match relevant movie titles or descriptions.`;
    case "describe":
      return `Write an upload listing for a movie titled "${d.title}". Extra notes from the uploader: "${d.notes}". Return json {"description": string, "keywords": string} where description is 2-3 engaging sentences and keywords is a comma-separated list of 6-10 search keywords.`;
    case "recommend":
      return `Current movie: "${d.current.title}" — ${d.current.description}. Candidates: ${JSON.stringify(d.candidates)}. Return json {"ids": string[]} with up to 6 candidate ids most similar, best first.`;
  }
}

export const runAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data, context }): Promise<AiResult> => {
    const { data: quota, error: qErr } = await context.supabase.rpc("consume_ai_quota");
    if (qErr) return fail("Could not check AI quota");
    const q = quota as { ok: boolean; reason?: string };
    if (!q.ok) return fail(q.reason ?? "AI limit reached");

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return fail("AI is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are the assistant for ReynaShows, a movie platform. Reply with json only." },
          { role: "user", content: prompt(data) },
        ],
      }),
    });
    if (res.status === 429) return fail("AI is busy, try again shortly");
    if (res.status === 402) return fail("AI credits are used up");
    if (!res.ok) return fail(`AI request failed (${res.status})`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(text.replace(/^```json\s*|```$/g, "")) as Record<string, unknown>;
      return { ok: true, error: "", result: JSON.stringify(parsed) };
    } catch {
      return fail("AI returned an unreadable answer");
    }
  });
