/**
 * Patent discovery via Brave Search.
 * Searches Google Patents for company patents.
 * Requires BRAVE_API_KEY.
 */

export interface Patent {
  title: string;
  url: string;
  patentId: string | null;
  date: string | null;
  snippet: string | null;
}

export interface PatentSummary {
  company: string;
  totalFound: number;
  patents: Patent[];
  googlePatentsUrl: string;
}

export async function fetchPatents(
  companyName: string,
  braveApiKey?: string
): Promise<PatentSummary | null> {
  const googlePatentsUrl = `https://patents.google.com/?assignee=${encodeURIComponent(companyName)}&sort=new`;

  if (!braveApiKey) {
    return {
      company: companyName,
      totalFound: 0,
      patents: [],
      googlePatentsUrl,
    };
  }

  try {
    // Quote company name to avoid generic term matches (e.g., "stripe" → magnetic stripe)
    const query = `"${companyName}" assignee patent site:patents.google.com`;
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20`;
    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": braveApiKey,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      web?: {
        results?: {
          title: string;
          url: string;
          description: string;
          age?: string;
        }[];
      };
    };

    const results = data.web?.results || [];
    const patents: Patent[] = [];
    const lowerName = companyName.toLowerCase();

    for (const r of results) {
      if (!r.url.includes("patents.google.com/patent/")) continue;

      // Post-filter: require the company name to appear in the title or snippet
      // to avoid false positives (e.g., "magnetic stripe" patents for Stripe Inc)
      const textToCheck = `${r.title} ${r.description || ""}`.toLowerCase();
      if (!textToCheck.includes(lowerName)) continue;

      const patentMatch = r.url.match(
        /patents\.google\.com\/patent\/([A-Z]{2}\d+)/
      );
      const patentId = patentMatch ? patentMatch[1] : null;

      const title = r.title
        .replace(/\s*[-–—]\s*Google Patents.*$/i, "")
        .trim();

      patents.push({
        title,
        url: r.url,
        patentId,
        date: r.age || null,
        snippet: r.description || null,
      });
    }

    return {
      company: companyName,
      totalFound: patents.length,
      patents: patents.slice(0, 20),
      googlePatentsUrl,
    };
  } catch {
    return null;
  }
}
