"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { compileVisualQuery } from "@/lib/query/compile-visual-query";

interface QueryTerm {
  id?: string;
  termType: string;
  value: string;
  language: string;
  position: number;
}

interface MonitoringQuery {
  id: string;
  name: string;
  mode: "VISUAL" | "EXPERT";
  booleanExpression: string;
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestResultCount: number | null;
  terms: QueryTerm[];
}

const TERM_TYPES = [
  "INCLUDE",
  "EXCLUDE",
  "PHRASE",
  "ALIAS",
  "DOMAIN_INCLUDE",
  "DOMAIN_EXCLUDE",
  "SOURCE_TYPE_FILTER",
  "LANGUAGE_FILTER",
  "GEO_FILTER",
];

export function QueryBuilder({
  projectId,
  initialQueries,
  brandAliases,
  canEdit,
}: {
  projectId: string;
  initialQueries: MonitoringQuery[];
  brandAliases: string[];
  canEdit: boolean;
}) {
  const [queries, setQueries] = useState<MonitoringQuery[]>(initialQueries);
  const [selectedId, setSelectedId] = useState<string | null>(initialQueries[0]?.id ?? null);
  const selected = queries.find((q) => q.id === selectedId) ?? null;

  const [draft, setDraft] = useState<MonitoringQuery | null>(selected);
  const [testResult, setTestResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  function selectQuery(id: string) {
    setSelectedId(id);
    setDraft(queries.find((q) => q.id === id) ?? null);
    setTestResult(null);
  }

  function newDraft() {
    const blank: MonitoringQuery = {
      id: "",
      name: "New query",
      mode: "EXPERT",
      booleanExpression: "",
      isActive: false,
      lastTestedAt: null,
      lastTestResultCount: null,
      terms: [],
    };
    setSelectedId(null);
    setDraft(blank);
    setTestResult(null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setBanner(null);
    const isNew = !draft.id;
    const url = isNew ? `/api/projects/${projectId}/queries` : `/api/projects/${projectId}/queries/${draft.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        mode: draft.mode,
        booleanExpression: draft.booleanExpression,
        terms: draft.terms.map(({ id, ...t }) => t),
      }),
    });
    setSaving(false);
    const data = await res.json();
    if (!res.ok) {
      setBanner(typeof data.error === "string" ? data.error : "Failed to save query.");
      return;
    }
    const saved: MonitoringQuery = data.query;
    setQueries((qs) => (isNew ? [saved, ...qs] : qs.map((q) => (q.id === saved.id ? saved : q))));
    setSelectedId(saved.id);
    setDraft(saved);
    if (data.warnings?.length) {
      setBanner(`Saved with warnings: ${data.warnings.join(" ")}`);
    } else {
      setBanner("Saved.");
    }
  }

  async function test() {
    if (!draft) return;
    const expression = draft.mode === "VISUAL" ? compileVisualQuery(draft.terms as any) : draft.booleanExpression;
    if (!expression.trim()) {
      setTestResult({ errors: ["Enter a Boolean expression (or add terms) before testing."] });
      return;
    }
    setTestResult({ loading: true });
    const url = draft.id
      ? `/api/projects/${projectId}/queries/${draft.id}/test`
      : `/api/projects/${projectId}/queries/test`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expression }),
    });
    const data = await res.json().catch(() => ({}));
    setTestResult(data);
  }

  async function toggleActivate() {
    if (!draft?.id) return;
    const res = await fetch(`/api/projects/${projectId}/queries/${draft.id}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !draft.isActive }),
    });
    const data = await res.json();
    if (res.ok) {
      setDraft({ ...draft, isActive: data.query.isActive });
      setQueries((qs) => qs.map((q) => (q.id === draft.id ? { ...q, isActive: data.query.isActive } : q)));
    } else {
      setBanner(data.error ?? "Failed to update activation state.");
    }
  }

  function updateTerm(index: number, patch: Partial<QueryTerm>) {
    if (!draft) return;
    const terms = draft.terms.map((t, i) => (i === index ? { ...t, ...patch } : t));
    setDraft({ ...draft, terms });
  }

  function addTerm() {
    if (!draft) return;
    setDraft({
      ...draft,
      terms: [...draft.terms, { termType: "INCLUDE", value: "", language: "any", position: draft.terms.length }],
    });
  }

  function removeTerm(index: number) {
    if (!draft) return;
    setDraft({ ...draft, terms: draft.terms.filter((_, i) => i !== index) });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <div>
        <Button className="mb-3 w-full" variant="outline" onClick={newDraft} disabled={!canEdit}>
          + New query
        </Button>
        <div className="flex flex-col gap-2">
          {queries.map((q) => (
            <button
              key={q.id}
              onClick={() => selectQuery(q.id)}
              className={`rounded-md border p-3 text-left text-sm transition-colors ${
                selectedId === q.id ? "border-primary bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{q.name}</span>
                {q.isActive && <Badge variant="success">Active</Badge>}
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{q.booleanExpression}</p>
            </button>
          ))}
        </div>
      </div>

      {draft && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{draft.id ? "Edit query" : "New query"}</CardTitle>
                <CardDescription>
                  Build a query visually or in expert Boolean syntax, validate it, and test it against recently
                  ingested coverage before saving.
                </CardDescription>
              </div>
              {draft.id && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="active-switch" className="text-sm">
                    Active
                  </Label>
                  <Switch id="active-switch" checked={draft.isActive} onCheckedChange={toggleActivate} disabled={!canEdit} />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Query name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} disabled={!canEdit} />
            </div>

            <Tabs value={draft.mode} onValueChange={(mode) => setDraft({ ...draft, mode: mode as "VISUAL" | "EXPERT" })}>
              <TabsList>
                <TabsTrigger value="VISUAL">Visual</TabsTrigger>
                <TabsTrigger value="EXPERT">Expert</TabsTrigger>
              </TabsList>

              <TabsContent value="EXPERT">
                <Textarea
                  rows={4}
                  value={draft.booleanExpression}
                  onChange={(e) => setDraft({ ...draft, booleanExpression: e.target.value })}
                  disabled={!canEdit}
                  placeholder='("Northstar Coffee" OR "North Star Coffee") AND (Toronto OR Ontario OR Canada) NOT ("North Star" AND astronomy)'
                  className="font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="VISUAL">
                <div className="flex flex-col gap-2">
                  {draft.terms.map((term, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select value={term.termType} onValueChange={(v) => updateTerm(i, { termType: v })}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TERM_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t.replaceAll("_", " ").toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={term.value}
                        onChange={(e) => updateTerm(i, { value: e.target.value })}
                        placeholder="term or phrase"
                        disabled={!canEdit}
                      />
                      <Button variant="ghost" size="sm" onClick={() => removeTerm(i)} disabled={!canEdit}>
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addTerm} disabled={!canEdit} className="w-fit">
                    + Add term
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Include/exclude/phrase/alias terms compile into the Boolean expression. Domain, source-type,
                    language, and geography filters are applied separately when routing ingestion and filtering the
                    coverage feed.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {brandAliases.length > 0 && (
              <p className="text-xs text-muted-foreground">Known brand aliases: {brandAliases.join(", ")}</p>
            )}

            <div className="flex gap-2">
              <Button onClick={save} disabled={!canEdit || saving}>
                {saving ? "Saving…" : "Save query"}
              </Button>
              <Button variant="outline" onClick={test} disabled={testResult?.loading}>
                Test against recent results
              </Button>
            </div>

            {banner && <p className="text-sm text-muted-foreground">{banner}</p>}

            {testResult && !testResult.loading && (
              <Card className="bg-muted/40">
                <CardContent className="pt-4 text-sm">
                  {testResult.errors?.length > 0 && (
                    <div className="mb-2 text-destructive">
                      {testResult.errors.map((e: string, i: number) => (
                        <p key={i}>{e}</p>
                      ))}
                    </div>
                  )}
                  {testResult.warnings?.length > 0 && (
                    <div className="mb-2 text-warning-foreground">
                      {testResult.warnings.map((w: string, i: number) => (
                        <p key={i}>⚠ {w}</p>
                      ))}
                    </div>
                  )}
                  {typeof testResult.matchCount === "number" && (
                    <p className="font-medium">
                      {testResult.matchCount} of {testResult.scannedCount} recent mentions matched.
                    </p>
                  )}
                  {testResult.note && <p className="text-muted-foreground">{testResult.note}</p>}
                  {testResult.sample?.length > 0 && (
                    <ul className="mt-2 list-disc pl-4">
                      {testResult.sample.map((m: any) => (
                        <li key={m.id}>
                          {m.headline} <span className="text-muted-foreground">({m.sourceDomain})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
