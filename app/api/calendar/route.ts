import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const MAX_ICS_LENGTH = 1_000_000;
const MAX_EVENT_COUNT = 5_000;
const MAX_EVENT_TEXT_LENGTH = 50_000;

function getDatabaseFailureResponse(error: unknown, operation: "read" | "save") {
  console.error(`[api/calendar] Failed to ${operation} calendar`, error);
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : error instanceof Error
        ? error.name
        : "UnknownError";
  return NextResponse.json(
    { error: `Calendar storage failed (${code}). Check the server logs for details.` },
    { status: 503 }
  );
}

function isCalendarEvent(value: unknown): value is Prisma.InputJsonObject {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === "string" &&
    event.id.length <= 500 &&
    typeof event.title === "string" &&
    event.title.length <= MAX_EVENT_TEXT_LENGTH &&
    typeof event.location === "string" &&
    event.location.length <= MAX_EVENT_TEXT_LENGTH &&
    typeof event.lecturer === "string" &&
    event.lecturer.length <= MAX_EVENT_TEXT_LENGTH &&
    typeof event.category === "string" &&
    event.category.length <= MAX_EVENT_TEXT_LENGTH &&
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

function getCalendarEventError(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "event must be an object";
  }
  const event = value as Record<string, unknown>;
  for (const key of ["id", "title", "location", "lecturer", "category"]) {
    if (typeof event[key] !== "string") return `${key} must be text`;
    if (event[key].length > (key === "id" ? 500 : MAX_EVENT_TEXT_LENGTH)) {
      return `${key} is too long`;
    }
  }
  if (!Number.isInteger(event.dayIndex) || Number(event.dayIndex) < 0 || Number(event.dayIndex) > 6) {
    return "dayIndex must be an integer from 0 to 6";
  }
  if (!Number.isInteger(event.weekOffset) || Math.abs(Number(event.weekOffset)) > 10_000) {
    return "weekOffset must be a valid whole number";
  }
  if (
    typeof event.start !== "number" ||
    !Number.isFinite(event.start) ||
    event.start < 0 ||
    event.start >= 24
  ) {
    return "start must be a time from 0 up to (but not including) 24";
  }
  if (
    typeof event.end !== "number" ||
    !Number.isFinite(event.end) ||
    event.end <= Number(event.start) ||
    event.end > 24
  ) {
    return "end must be after start and no later than 24";
  }
  return "event has an unsupported format";
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

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email: currentUser.email },
      select: { calendarName: true, personalCalendarIcs: true, calendarEvents: true },
    });
  } catch (error) {
    return getDatabaseFailureResponse(error, "read");
  }

  return NextResponse.json({
    name: user?.calendarName ?? `${currentUser.name} (Me)`,
    ownerName: currentUser.name,
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
  if (!Array.isArray(events)) {
    return NextResponse.json({ error: "Calendar events must be provided as a list." }, { status: 400 });
  }
  if (events.length > MAX_EVENT_COUNT) {
    return NextResponse.json(
      { error: `Calendar has ${events.length} events; the limit is ${MAX_EVENT_COUNT}.` },
      { status: 400 }
    );
  }
  const invalidEventIndex = events.findIndex((event) => !isCalendarEvent(event));
  if (invalidEventIndex !== -1) {
    return NextResponse.json(
      {
        error: `Calendar event ${invalidEventIndex + 1} is invalid: ${getCalendarEventError(events[invalidEventIndex])}.`
      },
      { status: 400 }
    );
  }

  try {
    await prisma.user.upsert({
      where: { email: currentUser.email },
      update: {
        name: currentUser.name,
        ...(currentUser.image ? { image: currentUser.image } : {}),
        calendarName: name.trim(),
        personalCalendarIcs: ics,
        calendarEvents: events,
      },
      create: {
        email: currentUser.email,
        name: currentUser.name,
        image: currentUser.image,
        calendarName: name.trim(),
        personalCalendarIcs: ics,
        calendarEvents: events,
      },
    });
  } catch (error) {
    return getDatabaseFailureResponse(error, "save");
  }

  return NextResponse.json({ name: name.trim() });
}
