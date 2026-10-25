import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ email: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }
  const { email: rawFriendEmail } = await context.params;
  const friendEmail = rawFriendEmail.trim().toLowerCase();
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: email, receiverId: friendEmail },
        { senderId: friendEmail, receiverId: email },
      ],
    },
  });
  if (!friendship) {
    return NextResponse.json({ error: "An accepted friendship is required." }, { status: 403 });
  }

  const friend = await prisma.user.findUnique({
    where: { email: friendEmail },
    select: { name: true, calendarName: true, calendarEvents: true },
  });
  return NextResponse.json({
    name: friend?.calendarName ?? friend?.name ?? friendEmail.split("@")[0],
    email: friendEmail,
    events: Array.isArray(friend?.calendarEvents) ? friend.calendarEvents : [],
  });
}
