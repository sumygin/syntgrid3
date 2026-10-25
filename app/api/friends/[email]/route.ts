import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ email: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }
  const { email: rawSenderEmail } = await context.params;
  const senderEmail = rawSenderEmail.trim().toLowerCase();
  const result = await prisma.friendship.updateMany({
    where: { senderId: senderEmail, receiverId: email, status: "PENDING" },
    data: { status: "ACCEPTED" },
  });
  if (result.count !== 1) {
    return NextResponse.json({ error: "No matching friend request was found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }
  const { email: rawFriendEmail } = await context.params;
  const friendEmail = rawFriendEmail.trim().toLowerCase();
  const result = await prisma.friendship.deleteMany({
    where: {
      status: { in: ["PENDING", "ACCEPTED"] },
      OR: [
        { senderId: email, receiverId: friendEmail },
        { senderId: friendEmail, receiverId: email },
      ],
    },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "No matching request or friendship was found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
