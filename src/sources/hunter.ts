/**
 * Hunter.io API — free tier: 25 searches/month.
 * Returns email patterns and key people at a company.
 */

export interface HunterResult {
  emailPattern: string | null;
  people: { name: string; title: string | null; email: string | null }[];
  totalEmails: number;
}

export async function fetchHunterData(
  domain: string,
  apiKey: string | undefined
): Promise<HunterResult | null> {
  if (!apiKey) return null;

  try {
    const resp = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      data: {
        pattern: string | null;
        emails: {
          value: string;
          first_name: string | null;
          last_name: string | null;
          position: string | null;
        }[];
        organization: string | null;
      };
      meta: { results: number };
    };

    return {
      emailPattern: data.data.pattern,
      people: data.data.emails.slice(0, 10).map((e) => ({
        name: [e.first_name, e.last_name].filter(Boolean).join(" "),
        title: e.position,
        email: e.value,
      })),
      totalEmails: data.meta.results,
    };
  } catch {
    return null;
  }
}
