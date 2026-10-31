import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAiScheduleUser } from "../_auth";

export async function POST(request: Request) {
  const user = await getAiScheduleUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const requestedBatchId =
    body && typeof body === "object" && "batchId" in body && typeof body.batchId === "string"
      ? body.batchId
      : null;
  try {
    const batchId = requestedBatchId ?? (await prisma.customEvent.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { batchId: true }
    }))?.batchId;
    if (!batchId) return NextResponse.json({ batchId: null, deletedCount: 0 });
    const result = await prisma.customEvent.deleteMany({ where: { userId: user.id, batchId } });
    return NextResponse.json({ batchId, deletedCount: result.count });
  } catch (error) {
    console.error("[api/ai-schedule/undo] Undo failed", error);
    return NextResponse.json({ error: "Could not undo the generated schedule." }, { status: 503 });
  }
}
