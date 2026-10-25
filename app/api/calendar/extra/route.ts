import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const MAX_EVENT_COUNT = 5_000;
const MAX_FILE_LENGTH = 1_000_000;
const MAX_TEXT_LENGTH = 50_000;

function isCalendarEvent(value: unknown): value is Prisma.InputJsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === "string" &&
    event.id.length <= 500 &&
    typeof event.title === "string" &&
    event.title.length <= MAX_TEXT_LENGTH &&
    typeof event.location === "string" &&
    event.location.length <= MAX_TEXT_LENGTH &&
    typeof event.lecturer === "string" &&
    event.lecturer.length <= MAX_TEXT_LENGTH &&
    typeof event.category === "string" &&
    event.category.length <= MAX_TEXT_LENGTH &&
    Number.isInteger(event.dayIndex) &&
    Number(event.dayIndex) >= 0 &&
    Number(event.dayIndex) <= 6 &&
    Number.isInteger(event.weekOffset) &&
    Math.abs(Number(event.weekOffset)) <= 10_000 &&
    typeof event.start === "number" &&
    Number.isFinite(event.start) &&
    event.start >= 0 &&
    event.start < 24 &&
    typeof event.end === "number" &&
    Number.isFinite(event.end) &&
    event.end > event.start &&
    event.end <= 24
  );
}

function isCalendarEventArray(value: unknown): value is Prisma.InputJsonArray {
  return Array.isArray(value) && value.length <= MAX_EVENT_COUNT && value.every(isCalendarEvent);
}

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;
  return { email, name: session?.user?.name || email, image: session?.user?.image ?? null };
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: currentUser.email },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ calendars: [] });

    const calendars = await prisma.customCalendar.findMany({
      where: { ownerId: user.id },
      select: { id: true, name: true, eventsJson: true },
    });
    return NextResponse.json({
      calendars: calendars.map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        events: calendar.eventsJson,
      })),
    });
  } catch (error) {
    console.error("[api/calendar/extra] Failed to list private calendars", error);
    return NextResponse.json(
      { error: "Could not load your extra calendars. Check server logs for details." },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Calendar data is required." }, { status: 400 });
  }
  const { name, events, ics } = body as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    return NextResponse.json({ error: "Calendar name must be 1–100 characters." }, { status: 400 });
  }
  if (ics !== undefined && ics !== null && (typeof ics !== "string" || ics.length > MAX_FILE_LENGTH)) {
    return NextResponse.json({ error: "Calendar file must be smaller than 1 MB." }, { status: 400 });
  }
  if (!Array.isArray(events) || events.length > MAX_EVENT_COUNT || !isCalendarEventArray(events)) {
    return NextResponse.json({ error: "Extra calendar contains invalid or too many events." }, { status: 400 });
  }

  try {
    const user = await prisma.user.upsert({
      where: { email: currentUser.email },
      update: {
        name: currentUser.name,
        ...(currentUser.image ? { image: currentUser.image } : {}),
      },
      create: { email: currentUser.email, name: currentUser.name, image: currentUser.image },
      select: { id: true },
    });
    const calendar = await prisma.customCalendar.create({
      data: {
        ownerId: user.id,
        name: name.trim(),
        eventsJson: events,
        sourceIcs: typeof ics === "string" ? ics : null,
      },
      select: { id: true, name: true },
    });
    return NextResponse.json(calendar, { status: 201 });
  } catch (error) {
    console.error("[api/calendar/extra] Failed to save private calendar", error);
    return NextResponse.json(
      { error: "Could not save your extra calendar. Check server logs for details." },
      { status: 503 }
    );
  }
}
