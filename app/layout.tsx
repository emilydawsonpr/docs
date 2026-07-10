import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "SignalWatch — Media Monitoring & Intelligence",
  description:
    "Media monitoring and PR intelligence for Canadian communications teams: Boolean search, ingestion, sentiment & risk analysis, share of voice, alerts, and reporting.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
