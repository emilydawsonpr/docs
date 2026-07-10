"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CANADIAN_TIMEZONES } from "@/lib/utils";

interface ProjectLike {
  id: string;
  name: string;
  timezone: string;
  languages: string[];
  regions: string[];
  focusCities: string[];
  crisisTerms: string[];
}

interface BrandLike {
  id: string;
  name: string;
  aliases: string[];
  websites: string[];
  handles: { handles?: string[] } | null;
  executives: { executives?: string[] } | null;
  products: string[];
  campaigns: string[];
  isPrimary: boolean;
}

interface KeyMessageLike {
  id: string;
  text: string;
  aliases: string[];
}

function toList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function jsonList(json: { handles?: string[]; executives?: string[] } | null, key: "handles" | "executives"): string[] {
  return json?.[key] ?? [];
}

export function SettingsManager({
  projectId,
  initialProject,
  initialBrands,
  initialKeyMessages,
  canEdit,
}: {
  projectId: string;
  initialProject: ProjectLike;
  initialBrands: BrandLike[];
  initialKeyMessages: KeyMessageLike[];
  canEdit: boolean;
}) {
  const [project, setProject] = useState(initialProject);
  const [brands, setBrands] = useState(initialBrands);
  const [keyMessages, setKeyMessages] = useState(initialKeyMessages);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const primaryBrand = brands.find((b) => b.isPrimary);
  const competitors = brands.filter((b) => !b.isPrimary);

  function flash(message: string) {
    setSavedNotice(message);
    setTimeout(() => setSavedNotice(null), 2500);
  }

  async function saveProjectDetails(form: {
    timezone: string;
    languages: string;
    regions: string;
    focusCities: string;
    crisisTerms: string;
  }) {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timezone: form.timezone,
        languages: toList(form.languages),
        regions: toList(form.regions),
        focusCities: toList(form.focusCities),
        crisisTerms: toList(form.crisisTerms),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(typeof data.error === "string" ? data.error : "Failed to save project details");
    setProject(data.project);
    flash("Project details saved.");
  }

  async function saveBrand(
    brandId: string,
    form: { name: string; aliases: string; websites: string; handles: string; executives: string; products: string; campaigns: string }
  ) {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/brands/${brandId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        aliases: toList(form.aliases),
        websites: toList(form.websites),
        handles: toList(form.handles),
        executives: toList(form.executives),
        products: toList(form.products),
        campaigns: toList(form.campaigns),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(typeof data.error === "string" ? data.error : "Failed to save brand");
    setBrands((bs) => bs.map((b) => (b.id === brandId ? data.brand : b)));
    flash("Brand saved.");
  }

  async function addCompetitor(name: string, aliases: string): Promise<boolean> {
    setError(null);
    if (!name.trim()) return false;
    try {
      const res = await fetch(`/api/projects/${projectId}/brands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), aliases: toList(aliases) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to add competitor");
        return false;
      }
      setBrands((bs) => [...bs, data.brand]);
      flash("Competitor added.");
      return true;
    } catch {
      setError("Network error — please try again.");
      return false;
    }
  }

  async function removeCompetitor(brandId: string) {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/brands/${brandId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setError(typeof data.error === "string" ? data.error : "Failed to remove competitor");
    setBrands((bs) => bs.filter((b) => b.id !== brandId));
    flash("Competitor removed.");
  }

  async function addKeyMessage(text: string, aliases: string): Promise<boolean> {
    setError(null);
    if (!text.trim()) return false;
    try {
      const res = await fetch(`/api/projects/${projectId}/key-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), aliases: toList(aliases) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to add key message");
        return false;
      }
      setKeyMessages((ms) => [...ms, data.keyMessage]);
      flash("Key message added.");
      return true;
    } catch {
      setError("Network error — please try again.");
      return false;
    }
  }

  async function removeKeyMessage(id: string) {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/key-messages/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setError(typeof data.error === "string" ? data.error : "Failed to remove key message");
    setKeyMessages((ms) => ms.filter((m) => m.id !== id));
    flash("Key message removed.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Brand, competitor, key-message, and crisis-term configuration. Changes here affect monitoring and analysis
          for new mentions going forward — they don't retroactively re-analyze existing coverage.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {savedNotice && <p className="text-sm text-success">{savedNotice}</p>}

      <ProjectDetailsCard project={project} canEdit={canEdit} onSave={saveProjectDetails} />

      {primaryBrand && <PrimaryBrandCard brand={primaryBrand} canEdit={canEdit} onSave={saveBrand} />}

      <CompetitorsCard competitors={competitors} canEdit={canEdit} onAdd={addCompetitor} onRemove={removeCompetitor} onSave={saveBrand} />

      <KeyMessagesCard keyMessages={keyMessages} canEdit={canEdit} onAdd={addKeyMessage} onRemove={removeKeyMessage} />
    </div>
  );
}

function ProjectDetailsCard({
  project,
  canEdit,
  onSave,
}: {
  project: ProjectLike;
  canEdit: boolean;
  onSave: (form: { timezone: string; languages: string; regions: string; focusCities: string; crisisTerms: string }) => void;
}) {
  const [form, setForm] = useState({
    timezone: project.timezone,
    languages: project.languages.join(", "),
    regions: project.regions.join(", "),
    focusCities: project.focusCities.join(", "),
    crisisTerms: project.crisisTerms.join(", "),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Project details</CardTitle>
        <CardDescription>Timezone, languages, geography, and crisis/risk terms used by the AI analysis pipeline.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Timezone</Label>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            value={form.timezone}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          >
            {CANADIAN_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Languages to monitor (comma-separated: en, fr)</Label>
          <Input disabled={!canEdit} value={form.languages} onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Regions</Label>
          <Input disabled={!canEdit} value={form.regions} onChange={(e) => setForm((f) => ({ ...f, regions: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Focus cities</Label>
          <Input disabled={!canEdit} value={form.focusCities} onChange={(e) => setForm((f) => ({ ...f, focusCities: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Crisis / risk terms</Label>
          <Input disabled={!canEdit} value={form.crisisTerms} onChange={(e) => setForm((f) => ({ ...f, crisisTerms: e.target.value }))} />
        </div>
      </CardContent>
      <CardFooter>
        <Button size="sm" disabled={!canEdit} onClick={() => onSave(form)}>
          Save project details
        </Button>
      </CardFooter>
    </Card>
  );
}

function PrimaryBrandCard({
  brand,
  canEdit,
  onSave,
}: {
  brand: BrandLike;
  canEdit: boolean;
  onSave: (
    brandId: string,
    form: { name: string; aliases: string; websites: string; handles: string; executives: string; products: string; campaigns: string }
  ) => void;
}) {
  const [form, setForm] = useState({
    name: brand.name,
    aliases: brand.aliases.join(", "),
    websites: brand.websites.join(", "),
    handles: jsonList(brand.handles, "handles").join(", "),
    executives: jsonList(brand.executives, "executives").join(", "),
    products: brand.products.join(", "),
    campaigns: brand.campaigns.join(", "),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Primary brand</CardTitle>
        <CardDescription>The brand being monitored. Aliases feed the Boolean query builder and share-of-voice matching.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Name</Label>
          <Input disabled={!canEdit} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Aliases / alternate spellings</Label>
          <Input disabled={!canEdit} value={form.aliases} onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Websites</Label>
          <Input disabled={!canEdit} value={form.websites} onChange={(e) => setForm((f) => ({ ...f, websites: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Social handles</Label>
          <Input disabled={!canEdit} value={form.handles} onChange={(e) => setForm((f) => ({ ...f, handles: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Executives / spokespeople</Label>
          <Input disabled={!canEdit} value={form.executives} onChange={(e) => setForm((f) => ({ ...f, executives: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Products</Label>
          <Input disabled={!canEdit} value={form.products} onChange={(e) => setForm((f) => ({ ...f, products: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Campaigns</Label>
          <Input disabled={!canEdit} value={form.campaigns} onChange={(e) => setForm((f) => ({ ...f, campaigns: e.target.value }))} />
        </div>
      </CardContent>
      <CardFooter>
        <Button size="sm" disabled={!canEdit} onClick={() => onSave(brand.id, form)}>
          Save primary brand
        </Button>
      </CardFooter>
    </Card>
  );
}

function CompetitorsCard({
  competitors,
  canEdit,
  onAdd,
  onRemove,
  onSave,
}: {
  competitors: BrandLike[];
  canEdit: boolean;
  onAdd: (name: string, aliases: string) => Promise<boolean>;
  onRemove: (brandId: string) => void;
  onSave: (
    brandId: string,
    form: { name: string; aliases: string; websites: string; handles: string; executives: string; products: string; campaigns: string }
  ) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newAliases, setNewAliases] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Competitors</CardTitle>
        <CardDescription>Tracked for share-of-voice comparison and competitor coverage-spike alerts.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {competitors.length === 0 && <p className="text-sm text-muted-foreground">No competitors tracked yet.</p>}
        {competitors.map((c) => (
          <CompetitorRow key={c.id} brand={c} canEdit={canEdit} onRemove={onRemove} onSave={onSave} />
        ))}
        {canEdit && (
          <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>New competitor name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Second Cup" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Aliases (comma-separated)</Label>
              <Input value={newAliases} onChange={(e) => setNewAliases(e.target.value)} />
            </div>
            <Button
              size="sm"
              onClick={async () => {
                const ok = await onAdd(newName, newAliases);
                if (ok) {
                  setNewName("");
                  setNewAliases("");
                }
              }}
            >
              Add competitor
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompetitorRow({
  brand,
  canEdit,
  onRemove,
  onSave,
}: {
  brand: BrandLike;
  canEdit: boolean;
  onRemove: (brandId: string) => void;
  onSave: (
    brandId: string,
    form: { name: string; aliases: string; websites: string; handles: string; executives: string; products: string; campaigns: string }
  ) => void;
}) {
  const [aliases, setAliases] = useState(brand.aliases.join(", "));

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-3">
        <Badge variant="secondary">{brand.name}</Badge>
        <Input
          disabled={!canEdit}
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          placeholder="Aliases"
          className="max-w-xs"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!canEdit}
          onClick={() =>
            onSave(brand.id, {
              name: brand.name,
              aliases,
              websites: brand.websites.join(", "),
              handles: jsonList(brand.handles, "handles").join(", "),
              executives: jsonList(brand.executives, "executives").join(", "),
              products: brand.products.join(", "),
              campaigns: brand.campaigns.join(", "),
            })
          }
        >
          Save
        </Button>
        <Button size="sm" variant="destructive" disabled={!canEdit} onClick={() => onRemove(brand.id)}>
          Remove
        </Button>
      </div>
    </div>
  );
}

function KeyMessagesCard({
  keyMessages,
  canEdit,
  onAdd,
  onRemove,
}: {
  keyMessages: KeyMessageLike[];
  canEdit: boolean;
  onAdd: (text: string, aliases: string) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [aliases, setAliases] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Key messages</CardTitle>
        <CardDescription>Used by AI analysis to score message pull-through in coverage.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {keyMessages.length === 0 && <p className="text-sm text-muted-foreground">No key messages defined yet.</p>}
        {keyMessages.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
            <p className="text-sm">{m.text}</p>
            <Button size="sm" variant="destructive" disabled={!canEdit} onClick={() => onRemove(m.id)}>
              Remove
            </Button>
          </div>
        ))}
        {canEdit && (
          <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>New key message</Label>
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="We source 100% Canadian ingredients." />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Aliases / paraphrases (comma-separated)</Label>
              <Input value={aliases} onChange={(e) => setAliases(e.target.value)} />
            </div>
            <Button
              size="sm"
              onClick={async () => {
                const ok = await onAdd(text, aliases);
                if (ok) {
                  setText("");
                  setAliases("");
                }
              }}
            >
              Add key message
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
