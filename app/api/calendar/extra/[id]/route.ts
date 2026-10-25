import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Extra calendar was not found." }, { status: 404 });
    }
    const result = await prisma.customCalendar.deleteMany({
      where: { id, ownerId: user.id },
    });
    if (result.count !== 1) {
      return NextResponse.json({ error: "Extra calendar was not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/calendar/extra] Failed to delete private calendar", error);
    return NextResponse.json(
      { error: "Could not delete your extra calendar. Check server logs for details." },
      { status: 503 }
    );
  }
}
