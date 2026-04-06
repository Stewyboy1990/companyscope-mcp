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
    const query = `${companyName} patent site:patents.google.com`;
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

    for (const r of results) {
      // Only keep Google Patents results
      if (!r.url.includes("patents.google.com/patent/")) continue;

      // Extract patent ID from URL
      const patentMatch = r.url.match(
        /patents\.google\.com\/patent\/([A-Z]{2}\d+)/
      );
      const patentId = patentMatch ? patentMatch[1] : null;

      // Clean title — remove " - Google Patents" suffix
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
