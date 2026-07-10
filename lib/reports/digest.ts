import nodemailer from "nodemailer";
import { prisma } from "@/lib/db/prisma";
import { generateDailyBrief } from "./daily-brief";
import { renderReportHtml } from "./render-html";

const CADENCE_MS: Record<string, number> = {
  IMMEDIATE: 0,
  HOURLY: 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
};

async function sendDigestEmail(recipients: string[], subject: string, html: string): Promise<boolean> {
  if (!process.env.SMTP_HOST || recipients.length === 0) return false;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "SignalWatch Digests <alerts@example.com>",
    to: recipients.join(", "),
    subject,
    html,
  });
  return true;
}

/**
 * Generates and (if SMTP is configured) emails a daily-brief-style digest
 * for every active Digest whose cadence interval has elapsed. Always
 * generates the underlying Report row regardless of email delivery, so the
 * digest content is visible in-app even without SMTP configured.
 */
export async function sendDueDigests(): Promise<number> {
  const digests = await prisma.digest.findMany({ where: { isActive: true } });
  let sent = 0;

  for (const digest of digests) {
    const interval = CADENCE_MS[digest.cadence] ?? CADENCE_MS.DAILY;
    if (digest.lastSentAt && Date.now() - digest.lastSentAt.getTime() < interval) continue;

    const project = await prisma.project.findUnique({ where: { id: digest.projectId } });
    if (!project) continue;

    const report = await generateDailyBrief(digest.projectId, new Date());
    const html = renderReportHtml(report, { isDemo: project.isDemo });
    await sendDigestEmail(digest.recipients, report.title, html);

    await prisma.digest.update({ where: { id: digest.id }, data: { lastSentAt: new Date() } });
    sent += 1;
  }

  return sent;
}
