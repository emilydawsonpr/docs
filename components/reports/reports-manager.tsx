"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateCA } from "@/lib/utils";

interface ReportSummary {
  id: string;
  title: string;
  templateType: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  status: string;
  createdAt: string;
  shareToken: string | null;
}

export function ReportsManager({
  projectId,
  initialReports,
  canEdit,
}: {
  projectId: string;
  initialReports: ReportSummary[];
  canEdit: boolean;
}) {
  const [reports, setReports] = useState(initialReports);
  const [generating, setGenerating] = useState<string | null>(null);

  async function generate(templateType: "DAILY_BRIEF" | "MONTHLY_PR") {
    setGenerating(templateType);
    const res = await fetch(`/api/projects/${projectId}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateType }),
    });
    setGenerating(null);
    if (res.ok) {
      const data = await res.json();
      setReports((r) => [{ ...data.report, sections: undefined }, ...r]);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground">
            Generate a daily brief or monthly PR report from stored coverage. Every claim links back to real mentions.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button onClick={() => generate("DAILY_BRIEF")} disabled={generating !== null}>
              {generating === "DAILY_BRIEF" ? "Generating…" : "Generate daily brief"}
            </Button>
            <Button variant="outline" onClick={() => generate("MONTHLY_PR")} disabled={generating !== null}>
              {generating === "MONTHLY_PR" ? "Generating…" : "Generate monthly report"}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {reports.length === 0 && <p className="text-sm text-muted-foreground">No reports generated yet.</p>}
        {reports.map((r) => (
          <Card key={r.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">
                  <Link href={`/projects/${projectId}/reports/${r.id}`} className="hover:underline">
                    {r.title}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {formatDateCA(r.dateRangeStart)} – {formatDateCA(r.dateRangeEnd)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{r.templateType.replaceAll("_", " ")}</Badge>
                <Badge variant="secondary">{r.status}</Badge>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
