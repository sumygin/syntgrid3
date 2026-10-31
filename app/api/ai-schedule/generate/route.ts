import { createGroq } from "@ai-sdk/groq";
import { createGoogle } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAiScheduleUser } from "../_auth";

export const maxDuration = 60;
const MAX_SCHEDULE_HORIZON_DAYS = 14;
const MAX_OUTPUT_TOKENS = 950;
const MAX_SCHEDULE_CONTEXT_LENGTH = 30_000;

const categorySchema = z.enum(["STUDY", "SLEEP", "MEAL", "GYM", "PERSONAL"]);
const generatedEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  category: categorySchema
});
const responseSchema = z.object({
  reasoning: z.string().min(1).max(500),
  events: z.array(generatedEventSchema).max(35)
});
const GROQ_MODEL = "qwen/qwen3.8-27b";
const GEMINI_MODEL = "gemini-3.8-flash";

export async function POST(request: Request) {
  const user = await getAiScheduleUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  const googleApiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();
  if (!groqApiKey && !googleApiKey) {
    console.error("[api/ai-schedule/generate] No Groq or Google AI API key is configured.");
    return NextResponse.json(
      { error: "AI scheduling is not configured. Add GROQ_API_KEY to the server environment and restart or redeploy." },
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
    typeof input.existingScheduleText === "string"
      ? input.existingScheduleText.slice(0, MAX_SCHEDULE_CONTEXT_LENGTH)
      : "";
  const weekStartIso = typeof input.weekStartIso === "string" ? input.weekStartIso : "";
  const currentIso = typeof input.currentIso === "string" ? input.currentIso : "";
  const weekStart = new Date(weekStartIso);
  const current = new Date(currentIso);
  if (!prompt || prompt.length > 4_000 || Number.isNaN(weekStart.getTime()) || Number.isNaN(current.getTime())) {
    return NextResponse.json({ error: "Provide a prompt and valid week/current timestamps." }, { status: 400 });
  }

  const system = `You are a strict academic week scheduler. Create a practical schedule for the target seven-day week.
Never overlap any occupied slot in the existing schedule, and never overlap events you create.
Normally schedule within the target week. If the user explicitly requests a contiguous date range that extends beyond it, honor that request up to ${MAX_SCHEDULE_HORIZON_DAYS} days from the target start. Never schedule outside that maximum horizon.
Use valid ISO-8601 timestamps with timezone offsets, and keep events at least 15 minutes long.
Respect the user's request, prioritize study around existing commitments, and do not invent fixed commitments.
Use STUDY, SLEEP, MEAL, GYM, or PERSONAL categories only.
Target week starts at ${weekStart.toISOString()}. The maximum allowed scheduling horizon ends before ${new Date(weekStart.getTime() + MAX_SCHEDULE_HORIZON_DAYS * 86_400_000).toISOString()}.
The current time is ${current.toISOString()}.
Existing occupied slots (these are hard constraints):
${existingScheduleText}

Keep the response compact. Return ONLY minified valid JSON with this exact shape:
{"reasoning":"brief explanation","events":[{"title":"...","description":"...","startTime":"ISO-8601 with timezone offset","endTime":"ISO-8601 with timezone offset","category":"STUDY"}]}
Do not wrap the JSON in markdown fences.`;
  const requestPrompt = `User scheduling request:
${prompt}`;

  const generate = (provider: "groq" | "gemini") =>
    generateText({
      model: provider === "groq"
        ? createGroq({ apiKey: groqApiKey! })(GROQ_MODEL)
        : createGoogle({ apiKey: googleApiKey! })(GEMINI_MODEL),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      system,
      prompt: requestPrompt
    });

  let providerUsed: "groq" | "gemini" = "gemini";
  let groqFailureMessage: string | null = null;
  try {
    let result;
    if (groqApiKey) {
      try {
        result = await generate("groq");
        providerUsed = "groq";
      } catch (groqError) {
        console.error("[api/ai-schedule/generate] Groq failed; trying Gemini fallback.", groqError);
        groqFailureMessage = groqError instanceof Error ? groqError.message : "Groq returned an unknown error.";
        if (!googleApiKey) throw groqError;
        result = await generate("gemini");
        providerUsed = "gemini";
      }
    } else {
      result = await generate("gemini");
    }

    const rawText = result.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const objectStart = rawText.indexOf("{");
    const objectEnd = rawText.lastIndexOf("}");
    const jsonText = objectStart >= 0 && objectEnd > objectStart
      ? rawText.slice(objectStart, objectEnd + 1)
      : rawText;
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch {
      return NextResponse.json(
        {
          error: `${providerUsed === "groq" ? "Groq" : "Gemini"} returned an invalid schedule response. Try a more specific request.`,
          ...(process.env.NODE_ENV !== "production"
            ? { details: `Response was not valid JSON: ${rawText.slice(0, 300)}` }
            : {})
        },
        { status: 502 }
      );
    }
    const parsedResult = responseSchema.safeParse(parsedJson);
    if (!parsedResult.success) {
      return NextResponse.json({ error: `${providerUsed === "groq" ? "Groq" : "Gemini"} returned an incomplete schedule response. Try again.` }, { status: 502 });
    }
    const events = parsedResult.data.events.map((event) => ({ ...event, description: event.description || null }));
    const weekEnd = weekStart.getTime() + MAX_SCHEDULE_HORIZON_DAYS * 86_400_000;
    for (const event of events) {
      const start = new Date(event.startTime).getTime();
      const end = new Date(event.endTime).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < weekStart.getTime() || end > weekEnd || end <= start) {
        return NextResponse.json({ error: "The generated plan contained an event outside the target week." }, { status: 502 });
      }
    }
    return NextResponse.json({ reasoning: parsedResult.data.reasoning, events });
  } catch (error) {
    console.error("[api/ai-schedule/generate] Generation failed", error);
    const message = error instanceof Error ? error.message : "";
    const isConfigurationError =
      /api key|api_key|authentication|unauthorized|permission|credential/i.test(message);
    const isRateLimitError = /rate limit|quota|resource exhausted|429/i.test(message);
    const errorMessage = isConfigurationError
      ? "The AI provider is not configured correctly. Check GROQ_API_KEY and GOOGLE_GENERATIVE_AI_API_KEY in Vercel and redeploy."
      : isRateLimitError
        ? "The AI providers are temporarily unavailable because a quota or rate limit was reached. Try again later."
        : "The AI providers could not generate a plan right now. Check the server logs and try again.";
    return NextResponse.json(
      {
        error: errorMessage,
        ...(process.env.NODE_ENV !== "production"
          ? {
              details: message.slice(0, 500) || "The provider returned an unknown error.",
              ...(groqFailureMessage ? { groqFailure: groqFailureMessage.slice(0, 500) } : {})
            }
          : {})
      },
      { status: 503 }
    );
  }
}
