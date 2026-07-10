import { prisma } from "@/lib/db/prisma";
import { ingestionQueue } from "./queue";

/**
 * Finds active SourceConnections whose polling interval has elapsed and
 * enqueues an ingestion job for each. Intended to run on a short repeatable
 * schedule (see run-workers.ts) rather than being called per-request.
 */
export async function scheduleDueIngestionJobs(): Promise<number> {
  const connections = await prisma.sourceConnection.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, lastPolledAt: true, pollingFrequencyMins: true },
  });

  const now = Date.now();
  const due = connections.filter((c) => {
    if (c.pollingFrequencyMins <= 0) return false; // one-shot adapters (CSV/manual URL) are never auto-polled
    if (!c.lastPolledAt) return true;
    return now - c.lastPolledAt.getTime() >= c.pollingFrequencyMins * 60 * 1000;
  });

  for (const connection of due) {
    await ingestionQueue().add(
      "poll-source",
      { sourceConnectionId: connection.id },
      { attempts: 1, jobId: `scheduled-${connection.id}-${now}` }
    );
  }

  return due.length;
}
