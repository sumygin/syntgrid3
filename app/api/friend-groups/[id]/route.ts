import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getCurrentEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email?.trim().toLowerCase() ?? null;
}

export async function PATCH(request: Request, context: RouteContext) {
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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Group updates are required." }, { status: 400 });
  }

  const updates: { name?: string; friendEmails?: string[]; isActive?: boolean } = {};
  const input = body as Record<string, unknown>;
  if ("name" in input) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 40) {
      return NextResponse.json({ error: "Group name must be 1–40 characters." }, { status: 400 });
    }
    updates.name = input.name.trim();
  }
  if ("isActive" in input) {
    if (typeof input.isActive !== "boolean") {
      return NextResponse.json({ error: "Group active state must be a boolean." }, { status: 400 });
    }
    updates.isActive = input.isActive;
  }
  if ("friendEmails" in input) {
    if (
      !Array.isArray(input.friendEmails) ||
      input.friendEmails.length > 100 ||
      !input.friendEmails.every(
        (email) => typeof email === "string" && EMAIL_PATTERN.test(email.trim())
      )
    ) {
      return NextResponse.json({ error: "Group members must be valid account emails." }, { status: 400 });
    }
    updates.friendEmails = [...new Set(
      (input.friendEmails as string[]).map((email) => email.trim().toLowerCase())
    )];
  }
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No valid group changes were provided." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return NextResponse.json({ error: "Friend group was not found." }, { status: 404 });
    }
    if (updates.friendEmails) {
      const acceptedFriendships = await prisma.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ senderId: ownerEmail }, { receiverId: ownerEmail }],
        },
        select: { senderId: true, receiverId: true },
      });
      const acceptedEmails = new Set(
        acceptedFriendships.map((friendship) =>
          friendship.senderId === ownerEmail ? friendship.receiverId : friendship.senderId
        )
      );
      if (updates.friendEmails.some((email) => !acceptedEmails.has(email))) {
        return NextResponse.json(
          { error: "Groups can only contain accepted friends." },
          { status: 403 }
        );
      }
    }

    const result = await prisma.friendGroup.updateMany({
      where: { id, ownerEmail },
      data: updates,
    });
    if (result.count !== 1) {
      return NextResponse.json({ error: "Friend group was not found." }, { status: 404 });
    }
    const group = await prisma.friendGroup.findFirst({
      where: { id, ownerEmail },
      select: { id: true, name: true, friendEmails: true, isActive: true },
    });
    return NextResponse.json({ group });
  } catch (error) {
    console.error("[api/friend-groups] Failed to update group", error);
    return NextResponse.json(
      { error: "Could not update your friend group." },
      { status: 503 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ownerEmail = await getCurrentEmail();
  if (!ownerEmail) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return NextResponse.json({ error: "Friend group was not found." }, { status: 404 });
    }
    const result = await prisma.friendGroup.deleteMany({ where: { id, ownerEmail } });
    if (result.count !== 1) {
      return NextResponse.json({ error: "Friend group was not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/friend-groups] Failed to delete group", error);
    return NextResponse.json(
      { error: "Could not delete your friend group." },
      { status: 503 }
    );
  }
}
