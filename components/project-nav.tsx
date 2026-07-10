import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "query-builder", label: "Query builder" },
  { key: "sources", label: "Sources" },
  { key: "coverage", label: "Coverage feed" },
  { key: "alerts", label: "Alerts" },
  { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings" },
] as const;

export function ProjectNav({ projectId, active }: { projectId: string; active: string }) {
  return (
    <div className="mb-6 flex gap-1 border-b">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/projects/${projectId}/${tab.key}`}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            active === tab.key
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
