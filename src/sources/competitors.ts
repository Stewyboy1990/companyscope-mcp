/**
 * Competitor discovery via Brave Search API.
 * Searches for "[company] competitors" and "[company] alternatives"
 * and extracts company names from results.
 * Requires BRAVE_API_KEY.
 */

export interface Competitor {
  name: string;
  url: string | null;
  description: string | null;
  source: string;
}

export async function findCompetitors(
  companyName: string,
  braveApiKey?: string
): Promise<Competitor[]> {
  if (!braveApiKey) return [];

  const competitors: Competitor[] = [];
  const seen = new Set<string>();

  // Run two searches in parallel for better coverage
  const queries = [
    `${companyName} competitors`,
    `${companyName} alternatives`,
  ];

  const results = await Promise.allSettled(
    queries.map((q) => braveSearch(q, braveApiKey))
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      // Skip results that are about the company itself
      const lowerTitle = item.title.toLowerCase();
      const lowerName = companyName.toLowerCase();
      if (lowerTitle.startsWith(lowerName) && !lowerTitle.includes("vs")) continue;

      // Extract competitor names from "X vs Y" patterns in titles
      const vsMatch = item.title.match(/(.+?)\s+vs\.?\s+(.+?)(?:\s*[-:|]|$)/i);
      if (vsMatch) {
        for (const name of [vsMatch[1].trim(), vsMatch[2].trim()]) {
          if (name.toLowerCase() !== lowerName && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            competitors.push({
              name,
              url: null,
              description: null,
              source: "brave_search",
            });
          }
        }
        continue;
      }

      // Use the result itself as a potential competitor
      const domain = extractDomain(item.url);
      if (domain && !seen.has(domain)) {
        seen.add(domain);
        // Clean up the title — remove "- Company Name" suffixes
        const cleanTitle = item.title.replace(/\s*[-|].*$/, "").trim();
        // Skip list articles
        if (/^\d+\s+(best|top)/i.test(cleanTitle)) continue;
        if (cleanTitle.length > 0 && cleanTitle.length < 80) {
          competitors.push({
            name: cleanTitle,
            url: item.url,
            description: item.description || null,
            source: "brave_search",
          });
        }
      }
    }
  }

  return competitors.slice(0, 15);
}

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

async function braveSearch(query: string, apiKey: string): Promise<BraveResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
  const resp = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!resp.ok) return [];

  const data = (await resp.json()) as {
    web?: { results?: { title: string; url: string; description: string }[] };
  };

  return (data.web?.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
