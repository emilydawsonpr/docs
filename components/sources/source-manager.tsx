"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AdapterCatalogEntry {
  id: string;
  adapterType: string;
  displayName: string;
  tier: 1 | 2;
  authStatus: string;
}

interface SourceConnection {
  id: string;
  name: string;
  adapterType: string;
  status: string;
  pollingFrequencyMins: number;
  lastPolledAt: string | null;
  lastError: string | null;
  config: Record<string, unknown>;
  _count: { mentions: number };
}

const CONFIG_FIELDS: Record<string, { key: string; label: string; placeholder?: string }[]> = {
  RSS: [{ key: "feedUrl", label: "Feed URL", placeholder: "https://www.cbc.ca/cmlink/rss-topstories" }],
  GOOGLE_NEWS_RSS: [
    { key: "query", label: "Search query", placeholder: '"Northstar Coffee" Toronto' },
    { key: "language", label: "Language (en or fr)", placeholder: "en" },
  ],
  GDELT: [{ key: "query", label: "Search query", placeholder: "Northstar Coffee" }],
  NEWSAPI: [{ key: "query", label: "Search query" }],
  MANUAL_URL: [{ key: "url", label: "Article URL" }],
};

export function SourceManager({
  projectId,
  initialSources,
  queries,
  adapters,
  canEdit,
}: {
  projectId: string;
  initialSources: SourceConnection[];
  queries: { id: string; name: string }[];
  adapters: AdapterCatalogEntry[];
  canEdit: boolean;
}) {
  const [sources, setSources] = useState(initialSources);
  const [open, setOpen] = useState(false);
  const [adapterType, setAdapterType] = useState("RSS");
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [monitoringQueryId, setMonitoringQueryId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pollResults, setPollResults] = useState<Record<string, any>>({});
  const [polling, setPolling] = useState<Record<string, boolean>>({});

  const tier1Adapters = adapters.filter((a) => a.tier === 1);
  const tier2Adapters = adapters.filter((a) => a.tier === 2);

  async function createSource(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || `${adapterType} source`,
        adapterType,
        config,
        monitoringQueryId: monitoringQueryId || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to create source");
      return;
    }
    setSources((s) => [{ ...data.source, _count: { mentions: 0 } }, ...s]);
    setOpen(false);
    setName("");
    setConfig({});
  }

  async function pollNow(sourceId: string) {
    setPolling((p) => ({ ...p, [sourceId]: true }));
    const res = await fetch(`/api/projects/${projectId}/sources/${sourceId}/poll`, { method: "POST" });
    const data = await res.json();
    setPolling((p) => ({ ...p, [sourceId]: false }));
    setPollResults((r) => ({ ...r, [sourceId]: data }));
    if (res.ok && data.ingestionJob) {
      setSources((prev) =>
        prev.map((s) =>
          s.id === sourceId
            ? {
                ...s,
                lastPolledAt: data.ingestionJob.finishedAt,
                lastError: data.ingestionJob.errorMessage,
                _count: { mentions: s._count.mentions + (data.ingestionJob.itemsNew ?? 0) },
              }
            : s
        )
      );
    }
  }

  const fields = CONFIG_FIELDS[adapterType] ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sources</h2>
          <p className="text-sm text-muted-foreground">
            Connect RSS/Atom feeds, Google News search, GDELT, CSV uploads, or manual URLs. "Poll now" runs the
            adapter immediately; active sources are also polled on their configured schedule by the background
            worker.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canEdit}>+ Connect a source</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect a source</DialogTitle>
              <DialogDescription>Tier 1 sources are live and keyless; Tier 2 requires official API credentials.</DialogDescription>
            </DialogHeader>
            <form onSubmit={createSource} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Adapter</Label>
                <Select value={adapterType} onValueChange={(v) => { setAdapterType(v); setConfig({}); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tier1Adapters.map((a) => (
                      <SelectItem key={a.adapterType} value={a.adapterType}>
                        {a.displayName}
                      </SelectItem>
                    ))}
                    {tier2Adapters.map((a) => (
                      <SelectItem key={a.adapterType} value={a.adapterType} disabled>
                        {a.displayName} (coming soon — requires OAuth)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CBC Top Stories" />
              </div>
              {fields.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <Label>{f.label}</Label>
                  <Input
                    value={config[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                    required
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <Label>Attach to monitoring query (optional)</Label>
                <Select value={monitoringQueryId} onValueChange={setMonitoringQueryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {queries.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit">Connect</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {sources.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No sources connected yet</CardTitle>
              <CardDescription>Connect an RSS feed or Google News search to start ingesting coverage.</CardDescription>
            </CardHeader>
          </Card>
        )}
        {sources.map((source) => (
          <Card key={source.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{source.name}</CardTitle>
                <CardDescription>
                  {source.adapterType} · {source._count.mentions} mentions
                  {source.lastPolledAt && ` · last polled ${new Date(source.lastPolledAt).toLocaleString("en-CA")}`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={source.status === "ACTIVE" ? "success" : source.status === "ERROR" ? "destructive" : "secondary"}>
                  {source.status}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => pollNow(source.id)} disabled={!canEdit || polling[source.id]}>
                  {polling[source.id] ? "Polling…" : "Poll now"}
                </Button>
              </div>
            </CardHeader>
            {(source.lastError || pollResults[source.id]) && (
              <CardContent className="pt-0 text-sm">
                {source.lastError && <p className="text-destructive">{source.lastError}</p>}
                {pollResults[source.id]?.ingestionJob && (
                  <p className="text-muted-foreground">
                    Fetched {pollResults[source.id].ingestionJob.itemsFetched}, new{" "}
                    {pollResults[source.id].ingestionJob.itemsNew}.
                  </p>
                )}
                {pollResults[source.id]?.error && <p className="text-destructive">{pollResults[source.id].error}</p>}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
