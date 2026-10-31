import { createGoogle } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAiScheduleUser } from "../_auth";

export const maxDuration = 60;

const categorySchema = z.enum(["STUDY", "SLEEP", "MEAL", "GYM", "PERSONAL"]);
const generatedEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2_000),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  category: categorySchema
});
const responseSchema = z.object({
  reasoning: z.string().min(1).max(4_000),
  events: z.array(generatedEventSchema).max(50)
});

export async function POST(request: Request) {
  const user = await getAiScheduleUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    console.error("[api/ai-schedule/generate] No Google AI API key is configured.");
    return NextResponse.json(
      { error: "AI scheduling is not configured. Add GOOGLE_GENERATIVE_AI_API_KEY to the server environment and restart or redeploy." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "A schedule prompt is required." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const existingScheduleText =
    typeof input.existingScheduleText === "string" ? input.existingScheduleText.slice(0, 100_000) : "";
  const weekStartIso = typeof input.weekStartIso === "string" ? input.weekStartIso : "";
  const currentIso = typeof input.currentIso === "string" ? input.currentIso : "";
  const weekStart = new Date(weekStartIso);
  const current = new Date(currentIso);
  if (!prompt || prompt.length > 4_000 || Number.isNaN(weekStart.getTime()) || Number.isNaN(current.getTime())) {
    return NextResponse.json({ error: "Provide a prompt and valid week/current timestamps." }, { status: 400 });
  }

  try {
    const result = await generateObject({
      model: createGoogle({ apiKey })("gemini-2.5-flash"),
      schema: responseSchema,
      system: `You are a strict academic week scheduler. Create a practical schedule for the target seven-day week.
Never overlap any occupied slot in the existing schedule, and never overlap events you create.
Only schedule within the target week, use valid ISO-8601 timestamps with timezone offsets, and keep events at least 15 minutes long.
Respect the user's request, prioritize study around existing commitments, and do not invent fixed commitments.
Use STUDY, SLEEP, MEAL, GYM, or PERSONAL categories only.
Target week starts at ${weekStart.toISOString()} and ends before ${new Date(weekStart.getTime() + 7 * 86_400_000).toISOString()}.
The current time is ${current.toISOString()}.
Existing occupied slots (these are hard constraints):
${existingScheduleText}`,
      prompt
    });

    const events = result.object.events.map((event) => ({ ...event, description: event.description || null }));
    const weekEnd = weekStart.getTime() + 7 * 86_400_000;
    for (const event of events) {
      const start = new Date(event.startTime).getTime();
      const end = new Date(event.endTime).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < weekStart.getTime() || end > weekEnd || end <= start) {
        return NextResponse.json({ error: "The generated plan contained an event outside the target week." }, { status: 502 });
      }
    }
    return NextResponse.json({ reasoning: result.object.reasoning, events });
  } catch (error) {
    console.error("[api/ai-schedule/generate] Generation failed", error);
    const message = error instanceof Error ? error.message : "";
    const isConfigurationError =
      /api key|api_key|authentication|unauthorized|permission|credential/i.test(message);
    const isRateLimitError = /rate limit|quota|resource exhausted|429/i.test(message);
    const errorMessage = isConfigurationError
      ? "Gemini is not configured correctly on the deployed server. Check GOOGLE_GENERATIVE_AI_API_KEY in Vercel and redeploy."
      : isRateLimitError
        ? "Gemini is temporarily unavailable because its quota or rate limit was reached. Try again later."
        : "Gemini could not generate a plan right now. Check the Vercel function logs for the request error and try again.";
    return NextResponse.json({ error: errorMessage }, { status: 503 });
  }
}
