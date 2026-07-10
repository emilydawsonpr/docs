import { prisma } from "@/lib/db/prisma";
import { getAdapter } from "@/lib/adapters/registry";
import { AdapterAuthMissingError, AdapterNotImplementedError, type AdapterConfig } from "@/lib/adapters/types";
import { storeNormalizedMentions } from "./normalize-and-store";

const MAX_ATTEMPTS = 3;

/**
 * Runs a single SourceConnection's adapter end-to-end: fetch -> normalize ->
 * store -> dedup, recording an IngestionJob row throughout (queued -> running
 * -> success/failed) so ingestion history and errors are always visible, and
 * updating SourceConnection.status/lastError for the sources admin view.
 */
export async function runSourceConnection(sourceConnectionId: string, attempt = 1): Promise<{ ingestionJobId: string }> {
  const connection = await prisma.sourceConnection.findUniqueOrThrow({
    where: { id: sourceConnectionId },
    include: { monitoringQuery: true },
  });

  const ingestionJob = await prisma.ingestionJob.create({
    data: {
      projectId: connection.projectId,
      sourceConnectionId: connection.id,
      status: "RUNNING",
      startedAt: new Date(),
      attempt,
    },
  });

  try {
    const adapter = getAdapter(connection.adapterType);
    const authStatus = adapter.authStatus(connection.config as AdapterConfig);
    if (adapter.authRequired && authStatus !== "configured") {
      throw new AdapterAuthMissingError(connection.adapterType);
    }

    const since = connection.lastPolledAt ?? undefined;
    const raw = await adapter.fetch(connection.config as AdapterConfig, since);
    const normalized = adapter.normalize(raw);

    const result = await storeNormalizedMentions({
      projectId: connection.projectId,
      monitoringQueryId: connection.monitoringQueryId,
      sourceConnectionId: connection.id,
      provider: adapter.id,
      items: normalized,
      matchedQuery: connection.monitoringQuery?.booleanExpression,
    });

    await prisma.$transaction([
      prisma.ingestionJob.update({
        where: { id: ingestionJob.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          itemsFetched: result.itemsFetched,
          itemsNew: result.itemsNew,
        },
      }),
      prisma.sourceConnection.update({
        where: { id: connection.id },
        data: { lastPolledAt: new Date(), lastError: null, status: "ACTIVE" },
      }),
    ]);

    return { ingestionJobId: ingestionJob.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown ingestion error";
    const isAuthOrUnimplemented = err instanceof AdapterAuthMissingError || err instanceof AdapterNotImplementedError;
    const willRetry = !isAuthOrUnimplemented && attempt < MAX_ATTEMPTS;

    await prisma.$transaction([
      prisma.ingestionJob.update({
        where: { id: ingestionJob.id },
        data: {
          status: willRetry ? "RETRYING" : "FAILED",
          finishedAt: new Date(),
          errorMessage: message,
        },
      }),
      prisma.sourceConnection.update({
        where: { id: connection.id },
        data: { lastError: message, status: isAuthOrUnimplemented ? "DISABLED" : "ERROR" },
      }),
    ]);

    if (willRetry) {
      // Caller (worker) is expected to handle BullMQ-level retry/backoff;
      // for direct/manual invocation we retry inline with a short backoff.
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      return runSourceConnection(sourceConnectionId, attempt + 1);
    }

    throw err;
  }
}
