/**
 * NewsAPI.org — free tier: 100 requests/day.
 * Returns recent news articles about a company.
 */

import type { NewsItem } from "../types.js";

export async function fetchCompanyNews(
  companyName: string,
  apiKey: string | undefined
): Promise<NewsItem[]> {
  if (!apiKey || !companyName) return [];

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
