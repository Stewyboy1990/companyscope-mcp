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
  const lowerName = companyName.toLowerCase();

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
      const lowerTitle = item.title.toLowerCase();
      // Skip results about the company itself
      if (lowerTitle.startsWith(lowerName) && !lowerTitle.includes("vs")) continue;

      const domain = extractDomain(item.url);
      // Skip review/comparison aggregator sites — they aren't competitors
      if (domain && isReviewSite(domain)) continue;

      // Extract competitor names from "X vs Y" patterns in titles
      const vsMatch = item.title.match(/(.+?)\s+vs\.?\s+(.+?)(?:\s*[-:|]|$)/i);
      if (vsMatch) {
        for (const name of [vsMatch[1].trim(), vsMatch[2].trim()]) {
          if (name.toLowerCase() !== lowerName && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            competitors.push({ name, url: null, description: null, source: "brave_search" });
          }
        }
        continue;
      }

      if (!domain || seen.has(domain)) continue;

      // Homepage results (short path) are likely actual competitor sites
      if (isHomepage(item.url)) {
        seen.add(domain);
        const brand = domainToBrand(domain);
        if (brand.toLowerCase() !== lowerName) {
          competitors.push({
            name: brand,
            url: item.url,
            description: item.description || null,
            source: "brave_search",
          });
        }
        continue;
      }

      // Non-homepage results: skip if the title looks like an article
      const cleanTitle = item.title.replace(/\s*[-|–—].*$/, "").trim();
      if (isArticleTitle(cleanTitle)) continue;

      // Only accept short, clean titles that look like brand names
      if (cleanTitle.length > 0 && cleanTitle.length < 40 && !cleanTitle.includes("?")) {
        seen.add(domain);
        competitors.push({
          name: cleanTitle,
          url: item.url,
          description: item.description || null,
          source: "brave_search",
        });
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

function isHomepage(url: string): boolean {
  try {
    const path = new URL(url).pathname.replace(/\/$/, "");
    return path === "" || path === "/about" || path === "/pricing";
  } catch {
    return false;
  }
}

function domainToBrand(domain: string): string {
  const name = domain.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const REVIEW_SITES = new Set([
  "g2.com", "capterra.com", "trustradius.com", "getapp.com",
  "softwareadvice.com", "sourceforge.net", "alternativeto.net",
  "slant.co", "producthunt.com", "techradar.com", "pcmag.com",
  "forbes.com", "businessinsider.com", "techcrunch.com",
  "merchantmaverick.com", "nerdwallet.com", "investopedia.com",
  "medium.com", "reddit.com", "quora.com", "wikipedia.org",
  "youtube.com", "linkedin.com",
]);

function isReviewSite(domain: string): boolean {
  if (REVIEW_SITES.has(domain)) return true;
  for (const site of REVIEW_SITES) {
    if (domain.endsWith("." + site)) return true;
  }
  return false;
}

function isArticleTitle(title: string): boolean {
  return (
    /^\d+\s+/i.test(title) ||
    /\b(best|top|leading|ultimate|complete|definitive)\s+(alternatives?|competitors?|tools?|platforms?|solutions?|software|options?|picks?)/i.test(title) ||
    /\b(alternatives?|competitors?)\s+(to|for|of|in)\b/i.test(title) ||
    /\b(comparison|review|guide|roundup|list|ranked|compared)\b/i.test(title) ||
    /\b(you\s+should|to\s+consider|to\s+try|worth\s+checking|you\s+need)\b/i.test(title)
  );
}
