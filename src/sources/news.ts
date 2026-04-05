/**
 * Company news — fetches recent news articles about a company.
 * Uses Brave Search API (free with existing key) as primary,
 * falls back to NewsAPI.org if configured.
 */

import type { NewsItem } from "../types.js";

/**
 * Fetch company news from the best available source.
 * Priority: Brave Search API → NewsAPI.org → empty
 */
export async function fetchCompanyNews(
  companyName: string,
  newsApiKey: string | undefined,
  braveApiKey?: string | undefined
): Promise<NewsItem[]> {
  if (!companyName) return [];

  // Try Brave Search first (no extra cost — shared key with Beta)
  if (braveApiKey) {
    const results = await fetchBraveNews(companyName, braveApiKey);
    if (results.length > 0) return results;
  }

  // Fall back to NewsAPI
  if (newsApiKey) {
    return fetchNewsAPI(companyName, newsApiKey);
  }

  return [];
}

async function fetchBraveNews(
  companyName: string,
  apiKey: string
): Promise<NewsItem[]> {
  try {
    const query = encodeURIComponent(`${companyName} news`);
    const resp = await fetch(
      `https://api.search.brave.com/res/v1/news/search?q=${query}&count=5&freshness=pw`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!resp.ok) return [];

    const data = (await resp.json()) as {
      results?: {
        title: string;
        url: string;
        meta_url?: { hostname: string };
        age?: string;
        description?: string;
      }[];
    };

    return (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      source: r.meta_url?.hostname || "web",
      publishedAt: r.age || "",
      snippet: r.description || "",
    }));
  } catch {
    return [];
  }
}

async function fetchNewsAPI(
  companyName: string,
  apiKey: string
): Promise<NewsItem[]> {
  try {
    const query = encodeURIComponent(companyName);
    const resp = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=5&language=en&apiKey=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!resp.ok) return [];

    const data = (await resp.json()) as {
      articles: {
        title: string;
        url: string;
        source: { name: string };
        publishedAt: string;
        description: string | null;
      }[];
    };

    return data.articles.map((a) => ({
      title: a.title,
      url: a.url,
      source: a.source.name,
      publishedAt: a.publishedAt,
      snippet: a.description || "",
    }));
  } catch {
    return [];
  }
}
