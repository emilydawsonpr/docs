import { describe, it, expect } from "vitest";
import { renderReportHtml } from "@/lib/reports/render-html";

function reportWithMentionLinks(url: string) {
  return {
    title: "Test report",
    templateType: "daily_brief",
    dateRangeStart: new Date("2026-07-01"),
    dateRangeEnd: new Date("2026-07-10"),
    status: "GENERATED",
    sections: [
      {
        sectionType: "top_coverage",
        order: 0,
        content: { mentions: [{ url, headline: "Headline" }] },
      },
    ],
  };
}

describe("renderReportHtml link sanitization", () => {
  it("keeps http(s) mention URLs as real hrefs", () => {
    const html = renderReportHtml(reportWithMentionLinks("https://example.com/story"));
    expect(html).toContain('href="https://example.com/story"');
  });

  it("neutralizes a javascript: URL instead of emitting it as an href", () => {
    const html = renderReportHtml(reportWithMentionLinks("javascript:alert(1)"));
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  it("neutralizes a data: URL", () => {
    const html = renderReportHtml(reportWithMentionLinks("data:text/html,<script>alert(1)</script>"));
    expect(html).not.toContain("data:text/html");
    expect(html).toContain('href="#"');
  });
});
