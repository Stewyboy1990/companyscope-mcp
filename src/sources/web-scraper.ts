import * as cheerio from "cheerio";
import type { CompanyProfile, Person } from "../types.js";

/**
 * Scrapes a company's website for basic info: name, description, social links, key people.
 * This is the foundation data source — free, no API key needed.
 */
export async function scrapeCompanyWebsite(
  domain: string
): Promise<Partial<CompanyProfile>> {
  const result: Partial<CompanyProfile> = {
    domain,
    socialProfiles: { linkedin: null, twitter: null, github: null },
    techStack: [],
    sources: [],
  };

  try {
    const url = `https://${domain}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CompanyScope/1.0; +https://companyscope.dev)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return result;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract name from <title> or og:site_name
    result.name =
      $('meta[property="og:site_name"]').attr("content") ||
      $("title").text().split(/[|\-–—]/)[0]?.trim() ||
      null;

    // Extract description
    result.description =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      null;

    // Extract social profiles from links
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes("linkedin.com/company"))
        result.socialProfiles!.linkedin = href;
      if (href.includes("twitter.com/") || href.includes("x.com/"))
        result.socialProfiles!.twitter = href;
      if (href.includes("github.com/"))
        result.socialProfiles!.github = href;
    });

    // Detect tech stack from HTML
    result.techStack = detectTechFromHTML(html, response.headers);

    result.website = url;
    result.sources!.push(`https://${domain}`);
  } catch {
    // Website unreachable — that's fine, we have other sources
  }

  // Try /about page for more info
  try {
    const aboutResponse = await fetch(`https://${domain}/about`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CompanyScope/1.0; +https://companyscope.dev)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });

    if (aboutResponse.ok) {
      const aboutHtml = await aboutResponse.text();
      const $about = cheerio.load(aboutHtml);

      // Try to find founding year
      const yearMatch = aboutHtml.match(
        /(?:founded|established|since|started)\s+(?:in\s+)?(\d{4})/i
      );
      if (yearMatch) result.founded = yearMatch[1];

      // Look for team/people
      result.keyPeople = extractPeople($about);
      result.sources!.push(`https://${domain}/about`);
    }
  } catch {
    // About page doesn't exist or is unreachable
  }

  return result;
}

function detectTechFromHTML(
  html: string,
  headers: Headers
): string[] {
  const tech: string[] = [];
  const lowerHtml = html.toLowerCase();

  // Framework detection from HTML
  const signatures: Record<string, string> = {
    React: "__next|react-root|_reactroot|react.production",
    "Next.js": "__next|_next/static|next/script",
    Vue: "__vue|vue.runtime|vue-app",
    Nuxt: "__nuxt|_nuxt",
    Angular: "ng-version|ng-app|angular",
    Svelte: "svelte",
    "Tailwind CSS": "tailwind",
    WordPress: "wp-content|wp-includes|wordpress",
    Shopify: "cdn.shopify.com|shopify",
    Webflow: "webflow",
    Wix: "wix.com|wixsite",
    Squarespace: "squarespace",
    "Google Analytics": "google-analytics|gtag|googletagmanager",
    "Google Tag Manager": "googletagmanager.com",
    Segment: "analytics.js|segment.com|cdn.segment.com",
    Intercom: "intercom|widget.intercom",
    HubSpot: "hubspot|hs-scripts",
    Stripe: "js.stripe.com",
    Cloudflare: "cloudflare",
    Vercel: "vercel",
  };

  for (const [name, pattern] of Object.entries(signatures)) {
    if (new RegExp(pattern, "i").test(lowerHtml)) {
      tech.push(name);
    }
  }

  // Server header detection
  const server = headers.get("server") || "";
  const poweredBy = headers.get("x-powered-by") || "";
  if (server) tech.push(`Server: ${server}`);
  if (poweredBy) tech.push(poweredBy);

  return [...new Set(tech)];
}

function extractPeople($: cheerio.CheerioAPI): Person[] {
  const people: Person[] = [];

  // Look for common team section patterns
  const teamSelectors = [
    ".team-member",
    ".team-card",
    '[class*="team"]',
    '[class*="leadership"]',
    '[class*="founder"]',
  ];

  for (const selector of teamSelectors) {
    $(selector).each((_, el) => {
      const name =
        $(el).find("h2, h3, h4, .name, [class*='name']").first().text().trim();
      const title =
        $(el)
          .find("p, .title, .role, [class*='title'], [class*='role']")
          .first()
          .text()
          .trim() || null;
      if (name && name.length > 2 && name.length < 60) {
        people.push({ name, title, source: "website" });
      }
    });
    if (people.length > 0) break;
  }

  return people.slice(0, 10);
}
