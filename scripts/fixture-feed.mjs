// Minimal local HTTP server serving a real RSS 2.0 XML document, used to
// prove the RSS adapter's fetch+parse pipeline against a genuine HTTP
// response when the sandbox's egress policy blocks public news domains.
import http from "node:http";

const now = new Date();
const items = [
  {
    title: "Northstar Coffee opens its newest cafe in downtown Toronto",
    link: "https://example-press.ca/northstar-coffee-toronto-opening",
    pubDate: new Date(now.getTime() - 2 * 60 * 60 * 1000).toUTCString(),
    description: "The Canadian-owned chain says the new location will create forty jobs.",
    guid: "example-press-001",
  },
  {
    title: "Second Cup announces new sustainability initiative",
    link: "https://example-press.ca/second-cup-sustainability",
    pubDate: new Date(now.getTime() - 5 * 60 * 60 * 1000).toUTCString(),
    description: "Competitor coverage: Second Cup unveils a new compostable cup program.",
    guid: "example-press-002",
  },
  {
    title: "Northstar Coffee opens its newest cafe in downtown Toronto (syndicated)",
    link: "https://example-wire.ca/syndicated/northstar-coffee-toronto-opening",
    pubDate: new Date(now.getTime() - 1 * 60 * 60 * 1000).toUTCString(),
    description: "Wire pickup: the Canadian-owned chain says the new location will create forty jobs, the company said.",
    guid: "example-wire-001",
  },
];

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Example Press Wire</title>
<link>https://example-press.ca</link>
<description>Local fixture feed for SignalWatch RSS adapter testing</description>
${items
  .map(
    (i) => `<item>
  <title>${i.title}</title>
  <link>${i.link}</link>
  <guid>${i.guid}</guid>
  <pubDate>${i.pubDate}</pubDate>
  <description>${i.description}</description>
</item>`
  )
  .join("\n")}
</channel></rss>`;

const port = Number(process.argv[2] ?? 4001);
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/rss+xml" });
    res.end(rss);
  })
  .listen(port, () => console.log(`Fixture RSS feed serving on http://localhost:${port}/feed.xml`));
