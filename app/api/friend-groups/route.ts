import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const MAX_GROUPS_PER_USER = 25;
const MAX_GROUP_NAME_LENGTH = 40;

async function getCurrentEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email?.trim().toLowerCase() ?? null;
}

export async function GET() {
  const ownerEmail = await getCurrentEmail();
  if (!ownerEmail) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const groups = await prisma.friendGroup.findMany({
      where: { ownerEmail },
      select: { id: true, name: true, friendEmails: true, isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ groups });
  } catch (error) {
    console.error("[api/friend-groups] Failed to load groups", error);
    return NextResponse.json(
      { error: "Could not load your friend groups." },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  const ownerEmail = await getCurrentEmail();
  if (!ownerEmail) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const name =
    body && typeof body === "object" && "name" in body && typeof body.name === "string"
      ? body.name.trim()
      : "";
  if (!name || name.length > MAX_GROUP_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Group name must be 1–${MAX_GROUP_NAME_LENGTH} characters.` },
      { status: 400 }
    );
  }

  try {
    const count = await prisma.friendGroup.count({ where: { ownerEmail } });
    if (count >= MAX_GROUPS_PER_USER) {
      return NextResponse.json(
        { error: `You can create up to ${MAX_GROUPS_PER_USER} groups.` },
        { status: 400 }
      );
    }
    const group = await prisma.friendGroup.create({
      data: { ownerEmail, name, friendEmails: [], isActive: true },
      select: { id: true, name: true, friendEmails: true, isActive: true },
    });
    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error("[api/friend-groups] Failed to create group", error);
    return NextResponse.json(
      { error: "Could not create your friend group." },
      { status: 503 }
    );
  }
}
