import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAiScheduleUser } from "../_auth";

export async function GET() {
  const user = await getAiScheduleUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const events = await prisma.customEvent.findMany({
      where: { userId: user.id },
      orderBy: { startTime: "asc" }
    });
    const latestBatch = events.reduce<{ batchId: string; createdAt: Date } | null>(
      (latest, event) => !latest || event.createdAt > latest.createdAt
        ? { batchId: event.batchId, createdAt: event.createdAt }
        : latest,
      null
    );
    return NextResponse.json({ events, latestBatchId: latestBatch?.batchId ?? null });
  } catch (error) {
    console.error("[api/ai-schedule/events] Read failed", error);
    return NextResponse.json({ error: "Could not load generated schedules." }, { status: 503 });
  }
}
