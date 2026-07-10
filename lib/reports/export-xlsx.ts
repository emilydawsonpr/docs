import ExcelJS from "exceljs";
import type { MentionCsvRow } from "./export-csv";

/** XLSX export of a mention list, with a formatted header row and column widths. */
export async function mentionsToXlsx(rows: MentionCsvRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SignalWatch";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Coverage");
  sheet.columns = [
    { header: "Headline", key: "headline", width: 50 },
    { header: "Source", key: "sourceName", width: 24 },
    { header: "Domain", key: "sourceDomain", width: 24 },
    { header: "URL", key: "originalUrl", width: 40 },
    { header: "Published (UTC)", key: "publishedAt", width: 22 },
    { header: "Language", key: "language", width: 10 },
    { header: "Sentiment", key: "sentiment", width: 12 },
    { header: "Relevance", key: "relevanceLabel", width: 16 },
    { header: "Risk score", key: "riskScore", width: 10 },
    { header: "Coverage type", key: "coverageType", width: 22 },
    { header: "Review status", key: "reviewStatus", width: 14 },
    { header: "Placement", key: "placementType", width: 12 },
    { header: "Synthetic demo data", key: "isDemo", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow({ ...row, isDemo: row.isDemo ? "YES" : "NO" });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
