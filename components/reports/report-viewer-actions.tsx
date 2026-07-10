"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReportViewerActions({
  projectId,
  reportId,
  canEdit,
  initialShareToken,
}: {
  projectId: string;
  reportId: string;
  canEdit: boolean;
  initialShareToken: string | null;
}) {
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [loading, setLoading] = useState(false);

  async function createShareLink() {
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/reports/${reportId}/share`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setShareToken(data.shareToken);
    }
  }

  const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/reports/shared/${shareToken}` : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline">
        <a href={`/api/projects/${projectId}/reports/${reportId}/export?format=pdf`}>Export PDF</a>
      </Button>
      {canEdit &&
        (shareToken ? (
          <Input readOnly value={shareUrl ?? ""} className="max-w-md" onFocus={(e) => e.currentTarget.select()} />
        ) : (
          <Button variant="outline" onClick={createShareLink} disabled={loading}>
            {loading ? "Creating…" : "Create shareable read-only link"}
          </Button>
        ))}
    </div>
  );
}
