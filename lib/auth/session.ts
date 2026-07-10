import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";

export async function getCurrentSession() {
  return getServerSession(authOptions);
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthenticatedError";
  }
}

/** Throws if there is no logged-in user. Use in API routes / server actions. */
export async function requireUser() {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    throw new UnauthenticatedError();
  }
  return session.user;
}
