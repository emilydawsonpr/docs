import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthenticatedError } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError } from "@/lib/rbac/permissions";

/**
 * Wraps an API route body, mapping known domain errors to the right HTTP
 * status instead of leaking a 500 (and a stack trace) for expected
 * authz/validation failures. Never logs request bodies/secrets.
 */
export function withApiErrorHandling(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  return fn().catch((err) => {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    // eslint-disable-next-line no-console
    console.error("Unhandled API error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  });
}
