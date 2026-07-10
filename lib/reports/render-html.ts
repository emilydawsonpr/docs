import { formatDateCA } from "@/lib/utils";

interface ReportSectionLike {
  sectionType: string;
  order: number;
  content: any;
  commentary?: string | null;
}

interface ReportLike {
  title: string;
  templateType: string;
  dateRangeStart: Date | string;
  dateRangeEnd: Date | string;
  status: string;
  sections: ReportSectionLike[];
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderSection(section: ReportSectionLike): string {
  const c = section.content ?? {};
  switch (section.sectionType) {
    case "volume_baseline":
      return `<h2>Volume vs. baseline</h2><p>${esc(c.fact)}</p>${
        c.isSpike ? `<p class="flag">⚠ Flagged as an unusual increase in coverage.</p>` : ""
      }`;
    case "top_coverage":
    case "recommended_review":
      return `<h2>${section.sectionType === "top_coverage" ? "Top coverage" : "Recommended for review"}</h2>${renderMentionList(c.mentions)}`;
    case "risks":
      return `<h2>Reputational risk items</h2>${
        (c.mentions ?? []).length === 0
          ? "<p><em>No high-risk mentions detected in this window.</em></p>"
          : `<ul>${(c.mentions ?? [])
              .map(
                (m: any) =>
                  `<li><a href="${esc(m.url)}">${esc(m.headline)}</a> — risk score ${esc(m.riskScore)}${
                    m.riskReasons?.length ? `<br><span class="muted">${esc(m.riskReasons.join("; "))}</span>` : ""
                  }</li>`
              )
              .join("")}</ul>`
      }`;
    case "emerging_themes":
    case "key_themes":
      return `<h2>${section.sectionType === "key_themes" ? "Key themes" : "Emerging themes"}</h2><ul>${(c.themes ?? [])
        .map((t: any) => `<li>${esc(t.topic)} — ${esc(t.count)} mention(s)</li>`)
        .join("")}</ul>`;
    case "competitor_activity":
    case "share_of_voice":
      return `<h2>Share of voice</h2><p class="muted">${esc(c.methodology)}</p><table><thead><tr><th>Brand</th><th>Total placements</th><th>Unique stories</th><th>Total-placement share</th></tr></thead><tbody>${(
        c.entries ?? []
      )
        .map(
          (e: any) =>
            `<tr${e.isPrimary ? ' class="primary"' : ""}><td>${esc(e.brandName)}</td><td>${esc(e.totalPlacements)}</td><td>${esc(
              e.uniqueStories
            )}</td><td>${e.totalPlacementSharePct.toFixed(1)}%</td></tr>`
        )
        .join("")}</tbody></table>`;
    case "message_pull_through":
      return `<h2>Key message pull-through</h2><p>${esc(c.matchedMentionsCount)} mention(s) matched a defined key message (full or partial).</p>`;
    case "kpi_summary":
      return `<h2>KPI summary</h2><ul>
        <li>Total mentions: ${esc(c.totalMentions)}</li>
        <li>Unique stories: ${esc(c.uniqueStories)}</li>
        <li>High-risk mentions: ${esc(c.highRiskCount)}</li>
        <li>Reviewed: ${esc(c.reviewedCount)} / ${esc(c.totalMentions)}</li>
        <li>Sentiment — positive: ${esc(c.sentimentBreakdown?.POSITIVE)}, neutral: ${esc(c.sentimentBreakdown?.NEUTRAL)}, mixed: ${esc(
          c.sentimentBreakdown?.MIXED
        )}, negative: ${esc(c.sentimentBreakdown?.NEGATIVE)}</li>
      </ul>`;
    case "methodology_notes":
      return `<h2>Methodology &amp; data notes</h2><p class="muted">${esc(c.note)}</p>`;
    default:
      return `<h2>${esc(section.sectionType)}</h2><pre>${esc(JSON.stringify(c, null, 2))}</pre>`;
  }
}

function renderMentionList(mentions: any[] = []): string {
  if (mentions.length === 0) return "<p><em>No mentions in this section.</em></p>";
  return `<ul>${mentions
    .map(
      (m) =>
        `<li><a href="${esc(m.url)}">${esc(m.headline)}</a>${m.sourceName ? ` — ${esc(m.sourceName)}` : ""}${
          m.sentiment ? ` <span class="tag">${esc(m.sentiment)}</span>` : ""
        }</li>`
    )
    .join("")}</ul>`;
}

/** Renders a Report + sections to a self-contained, print-ready HTML document. */
export function renderReportHtml(report: ReportLike, options?: { isDemo?: boolean; shareUrl?: string }): string {
  const dateRange = `${formatDateCA(report.dateRangeStart)} – ${formatDateCA(report.dateRangeEnd)}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(report.title)}</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0b0b0b; max-width: 800px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin-top: 28px; border-bottom: 1px solid #e1e0d9; padding-bottom: 4px; }
  .meta { color: #52514e; font-size: 13px; margin-bottom: 24px; }
  .muted { color: #898781; font-size: 13px; }
  .flag { color: #d03b3b; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e1e0d9; }
  tr.primary { font-weight: 600; }
  ul { padding-left: 20px; font-size: 13px; }
  li { margin-bottom: 6px; }
  .tag { display: inline-block; font-size: 11px; padding: 1px 6px; border-radius: 8px; background: #f0efec; }
  .demo-banner { background: #fff4d6; border: 1px solid #fab219; padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
  a { color: #2a78d6; }
</style>
</head>
<body>
  ${options?.isDemo ? `<div class="demo-banner">⚠ Synthetic demo data — this report never mixes with live project data.</div>` : ""}
  <h1>${esc(report.title)}</h1>
  <p class="meta">${esc(report.templateType.replace(/_/g, " "))} · ${dateRange} · Status: ${esc(report.status)}</p>
  ${report.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => renderSection(s) + (s.commentary ? `<p><em>${esc(s.commentary)}</em></p>` : ""))
    .join("\n")}
  <p class="muted" style="margin-top:32px;">Generated by SignalWatch. Every figure above is computed from stored mentions for this project; nothing is estimated unless explicitly labelled.</p>
</body>
</html>`;
}
