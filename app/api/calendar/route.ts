import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const MAX_ICS_LENGTH = 1_000_000;
const MAX_EVENT_COUNT = 5_000;

function isCalendarEvent(value: unknown): value is Prisma.InputJsonObject {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === "string" &&
    typeof event.title === "string" &&
    event.title.length <= 300 &&
    typeof event.location === "string" &&
    event.location.length <= 300 &&
    typeof event.lecturer === "string" &&
    event.lecturer.length <= 300 &&
    typeof event.category === "string" &&
    event.category.length <= 100 &&
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

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;
  return { email, name: session?.user?.name || email };
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: currentUser.email },
    select: { calendarName: true, personalCalendarIcs: true, calendarEvents: true },
  });

  return NextResponse.json({
    name: user?.calendarName ?? `${currentUser.name} (Me)`,
    ics: user?.personalCalendarIcs ?? null,
    events: Array.isArray(user?.calendarEvents) ? user.calendarEvents : [],
  });
}

export async function PUT(request: Request) {
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

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Calendar data is required." }, { status: 400 });
  }

  const { name, ics, events } = body as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    return NextResponse.json({ error: "Calendar name must be 1–100 characters." }, { status: 400 });
  }
  if (
    typeof ics !== "string" ||
    ics.length > MAX_ICS_LENGTH ||
    !ics.includes("BEGIN:VCALENDAR") ||
    !ics.includes("END:VCALENDAR")
  ) {
    return NextResponse.json({ error: "Upload a valid .ics calendar under 1 MB." }, { status: 400 });
  }
  if (
    !Array.isArray(events) ||
    events.length > MAX_EVENT_COUNT ||
    !events.every(isCalendarEvent)
  ) {
    return NextResponse.json({ error: "Calendar contains invalid or too many events." }, { status: 400 });
  }

  await prisma.user.upsert({
    where: { email: currentUser.email },
    update: {
      name: currentUser.name,
      calendarName: name.trim(),
      personalCalendarIcs: ics,
      calendarEvents: events,
    },
    create: {
      email: currentUser.email,
      name: currentUser.name,
      calendarName: name.trim(),
      personalCalendarIcs: ics,
      calendarEvents: events,
    },
  });

  return NextResponse.json({ name: name.trim(), ics, events });
}
