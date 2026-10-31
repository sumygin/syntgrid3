import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAiScheduleUser } from "../_auth";

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2_000).nullable().optional(),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  category: z.enum(["STUDY", "SLEEP", "MEAL", "GYM", "PERSONAL"])
});

export async function POST(request: Request) {
  const user = await getAiScheduleUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = z.object({ events: z.array(eventSchema).min(1).max(50) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Approved events are invalid." }, { status: 400 });
  if (parsed.data.events.some((event) => new Date(event.endTime) <= new Date(event.startTime))) {
    return NextResponse.json({ error: "Every event must end after it starts." }, { status: 400 });
  }

  const batchId = crypto.randomUUID();
  try {
    await prisma.customEvent.createMany({
      data: parsed.data.events.map((event) => ({
        userId: user.id,
        batchId,
        title: event.title.trim(),
        description: event.description?.trim() || null,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
        category: event.category
      }))
    });
    const events = await prisma.customEvent.findMany({ where: { userId: user.id, batchId }, orderBy: { startTime: "asc" } });
    return NextResponse.json({ batchId, events });
  } catch (error) {
    console.error("[api/ai-schedule/commit] Commit failed", error);
    return NextResponse.json({ error: "Could not save the generated schedule." }, { status: 503 });
  }
}
