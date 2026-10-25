import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ senderId: email }, { receiverId: email }],
    },
    select: { senderId: true, receiverId: true, status: true },
  });
  const pending = friendships
    .filter((friendship) => friendship.status === "PENDING" && friendship.receiverId === email)
    .map((friendship) => ({
      id: friendship.senderId,
      email: friendship.senderId,
      name: friendship.senderId.split("@")[0],
    }));
  const friends = friendships
    .filter((friendship) => friendship.status === "ACCEPTED")
    .map((friendship) => {
      const friendEmail = friendship.senderId === email
        ? friendship.receiverId
        : friendship.senderId;
      return {
        email: friendEmail,
        name: friendEmail.split("@")[0],
      };
    });

  return NextResponse.json({ requests: pending, friends });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const friendEmail = body && typeof body === "object" && "email" in body &&
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(friendEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (friendEmail === email.toLowerCase()) {
    return NextResponse.json({ error: "You cannot add your own account." }, { status: 400 });
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      status: { in: ["PENDING", "ACCEPTED"] },
      OR: [
        { senderId: email, receiverId: friendEmail },
        { senderId: friendEmail, receiverId: email },
      ],
    },
  });
  if (existing) {
    return NextResponse.json({ error: "A request or friendship already exists." }, { status: 409 });
  }

  await prisma.friendship.create({
    data: { senderId: email, receiverId: friendEmail },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
