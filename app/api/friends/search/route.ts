import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const currentEmail = session?.user?.email?.trim().toLowerCase();
  if (!currentEmail) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ profiles: [] });
  if (query.length > 100) {
    return NextResponse.json({ error: "Search text must be 100 characters or fewer." }, { status: 400 });
  }

  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: { in: ["PENDING", "ACCEPTED"] },
        OR: [{ senderId: currentEmail }, { receiverId: currentEmail }],
      },
      select: { senderId: true, receiverId: true },
    });
    const excludedEmails = new Set([
      currentEmail,
      ...friendships.map((friendship) =>
        friendship.senderId === currentEmail ? friendship.receiverId : friendship.senderId
      ),
    ]);
    const candidates = await prisma.user.findMany({
      where: {
        AND: [
          { email: { notIn: [...excludedEmails] } },
          {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: { email: true, name: true, image: true },
      take: 100,
    });

    const normalizedQuery = query.toLowerCase();
    const profiles = candidates
      .map((profile) => ({
        ...profile,
        score: Math.min(
          profile.name.toLowerCase().indexOf(normalizedQuery) < 0
            ? Number.MAX_SAFE_INTEGER
            : profile.name.toLowerCase().indexOf(normalizedQuery),
          profile.email.toLowerCase().indexOf(normalizedQuery) < 0
            ? Number.MAX_SAFE_INTEGER
            : profile.email.toLowerCase().indexOf(normalizedQuery)
        ),
      }))
      .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
      .slice(0, 5)
      .map((profile) => ({
        email: profile.email,
        name: profile.name,
        image:
          profile.image && URL.canParse(profile.image) && new URL(profile.image).protocol === "https:"
            ? profile.image
            : null,
      }));

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error("[api/friends/search] Failed to search profiles", error);
    return NextResponse.json(
      { error: "Could not search profiles. Check server logs for details." },
      { status: 503 }
    );
  }
}
