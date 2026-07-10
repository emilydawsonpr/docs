import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { registerSchema } from "@/lib/validation/auth";
import { slugify } from "@/lib/utils";
import { seedDemoWorkspace } from "@/lib/demo/seed-demo-workspace";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, password, organizationName, locale } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const baseSlug = slugify(organizationName) || "organization";
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      locale,
      memberships: {
        create: {
          role: "OWNER",
          organization: {
            create: {
              name: organizationName,
              slug,
              country: "CA",
            },
          },
        },
      },
    },
    select: { id: true, email: true, memberships: { select: { organizationId: true } } },
  });

  try {
    await seedDemoWorkspace(user.memberships[0].organizationId);
  } catch (err) {
    // Demo seeding must never block account creation.
    // eslint-disable-next-line no-console
    console.error("Failed to seed demo workspace for new organization:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true, userId: user.id });
}
