import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const FEATURES = [
  {
    title: "Boolean media search",
    description:
      "Visual and expert-mode query builder with AND/OR/NOT, phrases, wildcards, bilingual brand aliases, and a query validator that flags overly broad or ambiguous terms before you save.",
  },
  {
    title: "Multi-source ingestion",
    description:
      "RSS/Atom, Google News (English & French Canadian editions), GDELT, CSV upload, and manual URL submission, deduplicated with canonical-URL and simhash clustering so syndicated wire copy never inflates your story count.",
  },
  {
    title: "AI-assisted analysis",
    description:
      "Relevance, sentiment, coverage type, prominence, key-message pull-through, and reputational risk scoring with a transparent explanation for every score — always reviewable and correctable by an analyst.",
  },
  {
    title: "Share of voice & competitors",
    description:
      "Track your brand against a defined competitive set with total-placement and unique-story share of voice, and a documented, transparent methodology.",
  },
  {
    title: "Anomaly & spike detection",
    description:
      "Rolling-average/z-score volume monitoring flags real coverage spikes and sentiment deterioration — without crying wolf on ordinary day-to-day variation.",
  },
  {
    title: "Alerts, digests & reporting",
    description:
      "Configurable alert rules (in-app, email, Slack, Teams), daily briefs, and executive reports exportable to CSV, XLSX, and print-ready PDF.",
  },
];

export default async function LandingPage() {
  const session = await getCurrentSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16">
      <header className="flex items-center justify-between">
        <div className="text-xl font-bold tracking-tight">SignalWatch</div>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <section className="flex flex-col items-start gap-6">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          Built for Canadian communications teams — English &amp; French
        </span>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Media monitoring and PR intelligence, without the black box.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          SignalWatch helps Canadian communications teams, agencies, and nonprofits track coverage, understand
          sentiment and risk, benchmark against competitors, and report on what matters — with every AI judgment
          shown, reviewable, and correctable by a human analyst.
        </p>
        <div className="flex gap-3">
          <Button asChild size="lg">
            <Link href="/register">Create your workspace</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/demo">Explore the demo workspace</Link>
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardTitle className="text-base">{f.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{f.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="border-t pt-6 text-sm text-muted-foreground">
        SignalWatch is an original media-monitoring platform. Reach and audience-value figures are only ever shown
        when licensed or manually entered by your team, and are always labelled by confidence level — nothing is
        fabricated.
      </footer>
    </main>
  );
}
