"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CANADIAN_TIMEZONES, FOCUS_CITIES } from "@/lib/utils";

function toList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const STEPS = ["Organization", "Brand", "Competitors & geography", "Messages & alerts", "Review"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    projectName: "",
    website: "",
    brandName: "",
    aliases: "",
    socialHandles: "",
    executives: "",
    products: "",
    campaigns: "",
    competitors: "",
    geography: "Toronto, Ontario, Canada",
    languages: "en",
    priorityPublications: "",
    excludedMeanings: "",
    keyMessages: "",
    crisisTerms: "recall, lawsuit, data breach, layoffs",
    alertRecipients: "",
    timezone: "America/Toronto",
    focusCities: FOCUS_CITIES.join(", "),
  });

  async function submit() {
    setLoading(true);
    setError(null);
    const payload = {
      projectName: form.projectName,
      website: form.website,
      brandName: form.brandName,
      aliases: toList(form.aliases),
      socialHandles: toList(form.socialHandles),
      executives: toList(form.executives),
      products: toList(form.products),
      campaigns: toList(form.campaigns),
      competitors: toList(form.competitors),
      geography: toList(form.geography),
      languages: toList(form.languages),
      priorityPublications: toList(form.priorityPublications),
      excludedMeanings: toList(form.excludedMeanings),
      keyMessages: toList(form.keyMessages),
      crisisTerms: toList(form.crisisTerms),
      alertRecipients: toList(form.alertRecipients),
      timezone: form.timezone,
      focusCities: toList(form.focusCities),
    };
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(JSON.stringify(data?.error ?? "Failed to create project"));
      return;
    }
    const data = await res.json();
    router.push(`/projects/${data.project.id}/query-builder?review=1`);
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <AppShell title="Guided setup">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
          <CardDescription>
            Step {step + 1} of {STEPS.length}. We'll use this to propose an initial Boolean query — you'll review and
            activate it yourself before anything is monitored.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {step === 0 && (
            <>
              <Field label="Project name">
                <Input value={form.projectName} onChange={set("projectName")} placeholder="Northstar Coffee — Canada" />
              </Field>
              <Field label="Website">
                <Input value={form.website} onChange={set("website")} placeholder="https://northstarcoffee.ca" />
              </Field>
              <Field label="Timezone">
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                >
                  {CANADIAN_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Languages to monitor (comma-separated: en, fr)">
                <Input value={form.languages} onChange={set("languages")} />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Brand / organization name">
                <Input value={form.brandName} onChange={set("brandName")} placeholder="Northstar Coffee" />
              </Field>
              <Field label="Aliases / alternate spellings (comma-separated)">
                <Input value={form.aliases} onChange={set("aliases")} placeholder="North Star Coffee, NSC" />
              </Field>
              <Field label="Social handles">
                <Input value={form.socialHandles} onChange={set("socialHandles")} placeholder="@northstarcoffee" />
              </Field>
              <Field label="Executives / spokespeople">
                <Input value={form.executives} onChange={set("executives")} placeholder="Jane Smith, CEO" />
              </Field>
              <Field label="Products">
                <Input value={form.products} onChange={set("products")} />
              </Field>
              <Field label="Campaigns">
                <Input value={form.campaigns} onChange={set("campaigns")} />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Competitors (comma-separated)">
                <Input value={form.competitors} onChange={set("competitors")} placeholder="Second Cup, Tim Hortons" />
              </Field>
              <Field label="Geography (comma-separated cities/provinces/country)">
                <Input value={form.geography} onChange={set("geography")} />
              </Field>
              <Field label="Focus cities">
                <Input value={form.focusCities} onChange={set("focusCities")} />
              </Field>
              <Field label="Priority publication domains (comma-separated)">
                <Input value={form.priorityPublications} onChange={set("priorityPublications")} placeholder="cbc.ca, theglobeandmail.com" />
              </Field>
              <Field label="Excluded meanings (terms that create false positives)">
                <Input value={form.excludedMeanings} onChange={set("excludedMeanings")} placeholder="astronomy" />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Key messages (one per line)">
                <Textarea value={form.keyMessages} onChange={set("keyMessages")} rows={4} />
              </Field>
              <Field label="Crisis / risk terms (comma-separated)">
                <Input value={form.crisisTerms} onChange={set("crisisTerms")} />
              </Field>
              <Field label="Alert recipient emails (comma-separated)">
                <Input value={form.alertRecipients} onChange={set("alertRecipients")} />
              </Field>
            </>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-2 text-sm">
              <p>
                We'll create <strong>{form.projectName || "your project"}</strong> and propose a Boolean query from
                the brand name, aliases, geography, and any excluded meanings you entered. Nothing will be monitored
                until you review and activate the query on the next screen.
              </p>
              {error && <p className="text-destructive">{error}</p>}
            </div>
          )}

          <div className="mt-4 flex justify-between">
            <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === 0 && !form.projectName}>
                Next
              </Button>
            ) : (
              <Button onClick={submit} disabled={loading}>
                {loading ? "Creating…" : "Create project & propose query"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
