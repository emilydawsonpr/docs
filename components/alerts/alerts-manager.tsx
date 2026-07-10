"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatDateCA } from "@/lib/utils";

const TRIGGER_TYPES = [
  "HIGH_RELEVANCE",
  "HIGH_RISK",
  "NEGATIVE_SENTIMENT",
  "MAJOR_PUBLICATION",
  "EXEC_MENTION",
  "COMPETITOR_SPIKE",
  "VOLUME_SPIKE",
  "SENTIMENT_DETERIORATION",
  "TOPIC_PHRASE",
  "JOURNALIST_INQUIRY",
  "REGULATORY_LANGUAGE",
  "MISINFORMATION_INDICATOR",
];
const CHANNELS = ["IN_APP", "EMAIL", "SLACK", "TEAMS"];
const CADENCES = ["IMMEDIATE", "HOURLY", "DAILY", "WEEKLY"];

interface AlertRule {
  id: string;
  name: string;
  triggerType: string;
  deliveryChannels: string[];
  cadence: string;
  isActive: boolean;
  slackWebhookUrl: string | null;
  teamsWebhookUrl: string | null;
  emailRecipients: string[];
}

interface AlertEvent {
  id: string;
  triggeredAt: string;
  deliveryStatus: string;
  alertRule: { name: string; triggerType: string };
  mention: { headline: string; originalUrl: string } | null;
  payload: any;
}

export function AlertsManager({
  projectId,
  initialRules,
  initialEvents,
  canEdit,
}: {
  projectId: string;
  initialRules: AlertRule[];
  initialEvents: AlertEvent[];
  canEdit: boolean;
}) {
  const [rules, setRules] = useState(initialRules);
  const [events] = useState(initialEvents);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    triggerType: "HIGH_RISK",
    channels: new Set<string>(["IN_APP"]),
    cadence: "IMMEDIATE",
    slackWebhookUrl: "",
    teamsWebhookUrl: "",
    emailRecipients: "",
  });

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/alert-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        triggerType: form.triggerType,
        deliveryChannels: Array.from(form.channels),
        cadence: form.cadence,
        slackWebhookUrl: form.slackWebhookUrl || undefined,
        teamsWebhookUrl: form.teamsWebhookUrl || undefined,
        emailRecipients: form.emailRecipients ? form.emailRecipients.split(",").map((s) => s.trim()) : [],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to create alert rule");
      return;
    }
    setRules((r) => [data.rule, ...r]);
    setOpen(false);
  }

  async function toggleActive(rule: AlertRule) {
    const res = await fetch(`/api/projects/${projectId}/alert-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    if (res.ok) {
      setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r)));
    }
  }

  function toggleChannel(channel: string) {
    setForm((f) => {
      const next = new Set(f.channels);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return { ...f, channels: next };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Alert rules</h2>
          <p className="text-sm text-muted-foreground">
            In-app alerts always fire. Slack/Teams deliver via a webhook URL you supply; email requires SMTP to be
            configured for this deployment.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canEdit}>+ New alert rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New alert rule</DialogTitle>
              <DialogDescription>Choose a trigger and delivery channel(s).</DialogDescription>
            </DialogHeader>
            <form onSubmit={createRule} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Trigger</Label>
                <Select value={form.triggerType} onValueChange={(v) => setForm({ ...form, triggerType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Delivery channels</Label>
                <div className="flex gap-3">
                  {CHANNELS.map((c) => (
                    <label key={c} className="flex items-center gap-1.5 text-sm">
                      <Checkbox checked={form.channels.has(c)} onCheckedChange={() => toggleChannel(c)} />
                      {c.replace("_", "-")}
                    </label>
                  ))}
                </div>
              </div>
              {form.channels.has("SLACK") && (
                <div className="flex flex-col gap-1.5">
                  <Label>Slack webhook URL</Label>
                  <Input value={form.slackWebhookUrl} onChange={(e) => setForm({ ...form, slackWebhookUrl: e.target.value })} placeholder="https://hooks.slack.com/services/..." />
                </div>
              )}
              {form.channels.has("TEAMS") && (
                <div className="flex flex-col gap-1.5">
                  <Label>Teams webhook URL</Label>
                  <Input value={form.teamsWebhookUrl} onChange={(e) => setForm({ ...form, teamsWebhookUrl: e.target.value })} />
                </div>
              )}
              {form.channels.has("EMAIL") && (
                <div className="flex flex-col gap-1.5">
                  <Label>Email recipients (comma-separated)</Label>
                  <Input value={form.emailRecipients} onChange={(e) => setForm({ ...form, emailRecipients: e.target.value })} />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label>Cadence</Label>
                <Select value={form.cadence} onValueChange={(v) => setForm({ ...form, cadence: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CADENCES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit">Create rule</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-2">
        {rules.length === 0 && <p className="text-sm text-muted-foreground">No alert rules configured yet.</p>}
        {rules.map((rule) => (
          <Card key={rule.id}>
            <CardContent className="flex items-center justify-between pt-4">
              <div>
                <p className="font-medium">{rule.name}</p>
                <p className="text-xs text-muted-foreground">
                  {rule.triggerType.replaceAll("_", " ")} · {rule.deliveryChannels.join(", ")} · {rule.cadence}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={rule.isActive ? "success" : "secondary"}>{rule.isActive ? "Active" : "Paused"}</Badge>
                <Switch checked={rule.isActive} onCheckedChange={() => toggleActive(rule)} disabled={!canEdit} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Recent alert events</h2>
        <div className="flex flex-col gap-2">
          {events.length === 0 && <p className="text-sm text-muted-foreground">No alerts have fired yet.</p>}
          {events.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex items-center justify-between pt-4 text-sm">
                <div>
                  <p className="font-medium">{e.alertRule.name}</p>
                  {e.mention && (
                    <a href={e.mention.originalUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:underline">
                      {e.mention.headline}
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground">{formatDateCA(e.triggeredAt, { hour: "numeric", minute: "2-digit" })}</p>
                </div>
                <Badge
                  variant={
                    e.deliveryStatus === "DELIVERED" ? "success" : e.deliveryStatus === "SUPPRESSED" ? "secondary" : "outline"
                  }
                >
                  {e.deliveryStatus}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
