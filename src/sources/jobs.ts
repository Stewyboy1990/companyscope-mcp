/**
 * Job postings discovery via website scraping.
 * Scrapes /careers, /jobs, /about/careers pages for open positions.
 * Also checks common job board patterns.
 * No API keys required.
 */

import * as cheerio from "cheerio";

export interface JobPosting {
  title: string;
  department: string | null;
  location: string | null;
  url: string | null;
  source: string;
}

export interface JobsSummary {
  totalFound: number;
  jobs: JobPosting[];
  careersUrl: string | null;
  hiringSignal: string; // "actively hiring", "some openings", "no openings found"
}

const CAREERS_PATHS = [
  "/careers",
  "/jobs",
  "/about/careers",
  "/company/careers",
  "/join",
  "/work-with-us",
  "/open-positions",
];

export async function fetchJobPostings(
  domain: string
): Promise<JobsSummary> {
  const jobs: JobPosting[] = [];
  const seen = new Set<string>();
  let careersUrl: string | null = null;

  // Try each careers path until we find one that works
  for (const path of CAREERS_PATHS) {
    const url = `https://${domain}${path}`;
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CompanyScope/1.0; +https://companyscope.dev)",
          Accept: "text/html",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) continue;

      const html = await resp.text();
      const $ = cheerio.load(html);

      // Check if this looks like a careers page
      const pageText = $("body").text().toLowerCase();
      if (
        !pageText.includes("career") &&
        !pageText.includes("job") &&
        !pageText.includes("position") &&
        !pageText.includes("opening") &&
        !pageText.includes("hiring")
      ) {
        continue;
      }

      careersUrl = url;
      const extracted = extractJobs($, url, domain);
      for (const job of extracted) {
        const key = job.title.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          jobs.push(job);
        }
      }

      if (jobs.length > 0) break; // Found jobs, stop searching
    } catch {
      continue;
    }
  }

  // Also check for links to external job boards on the main page
  if (jobs.length === 0) {
    try {
      const resp = await fetch(`https://${domain}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CompanyScope/1.0; +https://companyscope.dev)",
          Accept: "text/html",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });

      if (resp.ok) {
        const html = await resp.text();
        const $ = cheerio.load(html);

        // Look for career/job links
        $("a[href]").each((_, el) => {
          const href = $(el).attr("href") || "";
          const text = $(el).text().trim().toLowerCase();
          if (
            (text.includes("career") ||
              text.includes("job") ||
              text.includes("hiring") ||
              text.includes("join us")) &&
            !careersUrl
          ) {
            if (href.startsWith("http")) {
              careersUrl = href;
            } else if (href.startsWith("/")) {
              careersUrl = `https://${domain}${href}`;
            }
          }
        });

        // Check for common job board embeds
        const lowerHtml = html.toLowerCase();
        if (lowerHtml.includes("lever.co")) {
          careersUrl = careersUrl || `https://jobs.lever.co/${domain.split(".")[0]}`;
        }
        if (lowerHtml.includes("greenhouse.io")) {
          careersUrl =
            careersUrl ||
            `https://boards.greenhouse.io/${domain.split(".")[0]}`;
        }
        if (lowerHtml.includes("ashbyhq.com")) {
          careersUrl =
            careersUrl ||
            `https://jobs.ashbyhq.com/${domain.split(".")[0]}`;
        }
      }
    } catch {
      // OK
    }
  }

  const totalFound = jobs.length;
  let hiringSignal: string;
  if (totalFound >= 10) hiringSignal = "actively hiring";
  else if (totalFound > 0) hiringSignal = "some openings";
  else hiringSignal = "no openings found";

  return {
    totalFound,
    jobs: jobs.slice(0, 30),
    careersUrl,
    hiringSignal,
  };
}

function extractJobs(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  domain: string
): JobPosting[] {
  const jobs: JobPosting[] = [];

  // Strategy 1: Look for structured job listing patterns
  const jobSelectors = [
    '[class*="job"]',
    '[class*="position"]',
    '[class*="opening"]',
    '[class*="career"]',
    '[class*="role"]',
    '[data-testid*="job"]',
    "li:has(a[href*='job'])",
    "li:has(a[href*='position'])",
    "li:has(a[href*='career'])",
  ];

  for (const selector of jobSelectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      // Skip if this is just a navigation link or header
      if ($el.closest("nav, header, footer").length > 0) return;

      const title = extractJobTitle($el, $);
      if (!title) return;

      const location = extractJobMeta($el, $, [
        "location",
        "city",
        "office",
        "region",
      ]);
      const department = extractJobMeta($el, $, [
        "department",
        "team",
        "category",
        "group",
      ]);

      // Get link
      let url: string | null = $el.find("a").first().attr("href") || null;
      if (url && !url.startsWith("http")) {
        url = url.startsWith("/")
          ? `https://${domain}${url}`
          : `${pageUrl}/${url}`;
      }

      jobs.push({
        title,
        department,
        location,
        url,
        source: `https://${domain}`,
      });
    });

    if (jobs.length >= 3) break; // Found a working selector
  }

  // Strategy 2: If no structured listings, look for heading + list patterns
  if (jobs.length === 0) {
    $("h2, h3, h4").each((_, heading) => {
      const headingText = $(heading).text().trim();
      // Check if heading looks like a department name
      if (headingText.length > 3 && headingText.length < 60) {
        const $next = $(heading).next("ul, ol, div");
        if ($next.length) {
          $next.find("li, a").each((_, item) => {
            const text = $(item).text().trim();
            if (text.length > 5 && text.length < 120 && looksLikeJobTitle(text)) {
              let url: string | null = $(item).is("a")
                ? $(item).attr("href") || null
                : $(item).find("a").first().attr("href") || null;
              if (url && !url.startsWith("http")) {
                url = url.startsWith("/")
                  ? `https://${domain}${url}`
                  : null;
              }
              jobs.push({
                title: text,
                department: headingText,
                location: null,
                url,
                source: `https://${domain}`,
              });
            }
          });
        }
      }
    });
  }

  return jobs;
}

function extractJobTitle(
  $el: cheerio.Cheerio<any>,
  $: cheerio.CheerioAPI
): string | null {
  // Look for title in heading or specific class
  const candidates = [
    $el.find("h2, h3, h4, h5").first().text().trim(),
    $el.find('[class*="title"], [class*="name"]').first().text().trim(),
    $el.find("a").first().text().trim(),
  ];

  for (const text of candidates) {
    if (text && text.length > 3 && text.length < 120 && looksLikeJobTitle(text)) {
      return text;
    }
  }

  return null;
}

function extractJobMeta(
  $el: cheerio.Cheerio<any>,
  $: cheerio.CheerioAPI,
  keywords: string[]
): string | null {
  for (const kw of keywords) {
    const found = $el.find(`[class*="${kw}"]`).first().text().trim();
    if (found && found.length > 1 && found.length < 80) return found;
  }
  return null;
}

function looksLikeJobTitle(text: string): boolean {
  const jobKeywords =
    /engineer|developer|designer|manager|director|lead|analyst|scientist|coordinator|specialist|architect|consultant|intern|associate|vp|head of|chief/i;
  const antiKeywords =
    /^(about|home|contact|privacy|terms|cookie|sign|log in|register|search|menu|close)/i;
  return jobKeywords.test(text) && !antiKeywords.test(text);
}
