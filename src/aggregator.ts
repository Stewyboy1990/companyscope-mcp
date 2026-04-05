/**
 * Aggregation layer — merges data from all sources into a single CompanyProfile.
 */

import type { CompanyProfile, Env, Person } from "./types.js";
import { scrapeCompanyWebsite } from "./sources/web-scraper.js";
import { fetchGitHubProfile } from "./sources/github.js";
import { fetchHunterData } from "./sources/hunter.js";
import { fetchCompanyNews } from "./sources/news.js";
import { searchOpenCorporates } from "./sources/opencorporates.js";
import { fetchWikipediaData } from "./sources/wikipedia.js";
import { fetchSECData } from "./sources/sec-edgar.js";
import { fetchRDAPData } from "./sources/rdap.js";
import { getCachedProfile, cacheProfile, getCachedJSON, setCachedJSON } from "./cache.js";

/**
 * Pick the best company name from multiple sources.
 * Prefers short, clean names (not taglines or full legal names).
 */
function pickBestName(...candidates: (string | null | undefined)[]): string {
  const names = candidates.filter(
    (n): n is string => !!n && n.trim().length > 0
  );
  if (names.length === 0) return "Unknown";

  // Filter out names that look like taglines (too long, contain action verbs)
  const clean = names.filter(
    (n) => n.length <= 60 && !/\b(build|connect|protect|make|get|start|create)\b/i.test(n)
  );

  // Prefer the shortest clean name (likely the actual company name, not a tagline)
  const pool = clean.length > 0 ? clean : names;
  return pool.reduce((a, b) => (a.length <= b.length ? a : b));
}

/**
 * Normalize a domain: strip protocol, www, trailing slash.
 */
export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.replace(/\/.*$/, "");
  return d;
}

/**
 * Build a full company profile by aggregating all data sources.
 */
export async function buildCompanyProfile(
  domainOrName: string,
  env: Env
): Promise<CompanyProfile> {
  const domain = normalizeDomain(domainOrName);

  // Check cache first
  const cached = await getCachedProfile(env, domain);
  if (cached) return cached;

  const companyNameGuess = domain.split(".")[0];

  // Fire all data sources in parallel
  const [webData, ghData, hunterData, newsData, corpData, wikiData, secData, rdapData] =
    await Promise.allSettled([
      scrapeCompanyWebsite(domain),
      fetchGitHubProfile(domain, env.GITHUB_TOKEN),
      fetchHunterData(domain, env.HUNTER_API_KEY),
      fetchCompanyNews(companyNameGuess, env.NEWS_API_KEY),
      searchOpenCorporates(companyNameGuess, env.OPENCORPORATES_TOKEN),
      fetchWikipediaData(companyNameGuess),
      fetchSECData(companyNameGuess),
      fetchRDAPData(domain),
    ]);

  const web = webData.status === "fulfilled" ? webData.value : {};
  const gh = ghData.status === "fulfilled" ? ghData.value : null;
  const hunter = hunterData.status === "fulfilled" ? hunterData.value : null;
  const news = newsData.status === "fulfilled" ? newsData.value : [];
  const corp = corpData.status === "fulfilled" ? corpData.value : null;
  const wiki = wikiData.status === "fulfilled" ? wikiData.value : null;
  let sec = secData.status === "fulfilled" ? secData.value : null;
  const rdap = rdapData.status === "fulfilled" ? rdapData.value : null;

  // Sanity check: if SEC entity name doesn't closely match the query, discard it
  // to prevent cross-contamination (e.g., "stripe" matching "AT&T" via short ticker,
  // or "openai" matching "Opendoor" via shared "open" prefix)
  if (sec?.entityName) {
    const query = companyNameGuess.toLowerCase().replace(/[^a-z0-9]/g, "");
    const secName = sec.entityName.toLowerCase().replace(/[^a-z0-9]/g, "");
    // Require the query to be a prefix of the SEC name, or vice versa,
    // with at least 60% character overlap
    const isPrefix = secName.startsWith(query) || query.startsWith(secName);
    const shorter = Math.min(query.length, secName.length);
    const longer = Math.max(query.length, secName.length);
    const overlapRatio = shorter / longer;
    if (!isPrefix || overlapRatio < 0.4) {
      sec = null; // SEC match is for a different company — discard
    }
  }

  // Merge people from all sources
  const allPeople: Person[] = [];
  const seenNames = new Set<string>();

  // OpenCorporates officers
  if (corp?.officers) {
    for (const o of corp.officers) {
      if (!seenNames.has(o.name.toLowerCase())) {
        seenNames.add(o.name.toLowerCase());
        allPeople.push({
          name: o.name,
          title: o.position,
          source: "opencorporates",
        });
      }
    }
  }

  // Hunter.io people
  if (hunter?.people) {
    for (const p of hunter.people) {
      if (p.name && !seenNames.has(p.name.toLowerCase())) {
        seenNames.add(p.name.toLowerCase());
        allPeople.push({
          name: p.name,
          title: p.title,
          source: "hunter.io",
        });
      }
    }
  }

  // Website people
  if (web.keyPeople) {
    for (const p of web.keyPeople) {
      if (!seenNames.has(p.name.toLowerCase())) {
        seenNames.add(p.name.toLowerCase());
        allPeople.push(p);
      }
    }
  }

  // Merge tech stack: website + GitHub languages
  const techStack = new Set<string>(web.techStack || []);
  if (gh?.topLanguages) {
    for (const lang of gh.topLanguages) {
      techStack.add(lang);
    }
  }

  // Wikipedia people (founders, CEO)
  if (wiki?.founders) {
    for (const f of wiki.founders) {
      if (!seenNames.has(f.toLowerCase())) {
        seenNames.add(f.toLowerCase());
        allPeople.push({ name: f, title: "Founder", source: "wikipedia" });
      }
    }
  }
  if (wiki?.ceo) {
    const ceoName = wiki.ceo.split(",")[0].trim();
    if (ceoName && !seenNames.has(ceoName.toLowerCase())) {
      seenNames.add(ceoName.toLowerCase());
      allPeople.push({ name: ceoName, title: "CEO", source: "wikipedia" });
    }
  }

  // Calculate sources and confidence
  const sources: string[] = [...(web.sources || [])];
  let dataPoints = 0;
  const maxPoints = 8; // web, github, hunter, news, corp, wiki, sec, rdap

  if (web.name) dataPoints++;
  if (gh) {
    dataPoints++;
    sources.push("github.com");
  }
  if (hunter) {
    dataPoints++;
    sources.push("hunter.io");
  }
  if (news.length > 0) {
    dataPoints++;
    sources.push("newsapi.org");
  }
  if (corp) {
    dataPoints++;
    sources.push("opencorporates.com");
  }
  if (wiki) {
    dataPoints++;
    if (wiki.wikipediaUrl) sources.push(wiki.wikipediaUrl);
    else sources.push("wikipedia.org");
  }
  if (sec) {
    dataPoints++;
    sources.push(sec.secUrl);
  }
  if (rdap) {
    dataPoints++;
    sources.push("rdap.org");
  }

  const profile: CompanyProfile = {
    domain,
    name: pickBestName(web.name, gh?.orgName, corp?.companyName, sec?.entityName, companyNameGuess),
    description: wiki?.summary || web.description || gh?.description || null,
    founded: web.founded || wiki?.founded || corp?.incorporationDate || rdap?.registrationDate || null,
    employeeCount: wiki?.employeeCount || web.employeeCount || null,
    industry: sec?.sicDescription || wiki?.industry || null,
    headquarters:
      wiki?.headquarters || web.headquarters || corp?.registeredAddress || (sec?.stateOfIncorporation ? `Incorporated in ${sec.stateOfIncorporation}` : null),
    website: web.website || `https://${domain}`,
    socialProfiles: web.socialProfiles || {
      linkedin: null,
      twitter: null,
      github: gh
        ? `https://github.com/${gh.orgName}`
        : null,
    },
    techStack: Array.from(techStack),
    recentNews: news,
    keyPeople: allPeople.slice(0, 15),
    fundingHistory: [],
    competitors: [],
    stockTickers: sec?.tickers || [],
    exchanges: sec?.exchanges || [],
    financials: sec?.financials || null,
    recentFilings: sec?.recentFilings || [],
    sicCode: sec?.sic || null,
    domainRegistration: rdap
      ? {
          registrar: rdap.registrar,
          registrationDate: rdap.registrationDate,
          expirationDate: rdap.expirationDate,
          domainAge: rdap.domainAge,
          nameservers: rdap.nameservers,
        }
      : null,
    confidence: dataPoints / maxPoints,
    sources,
    fetchedAt: new Date().toISOString(),
  };

  // Cache the result
  await cacheProfile(env, domain, profile);

  return profile;
}

/**
 * Build a lighter tech stack result.
 */
export async function buildTechStack(
  domainOrName: string,
  env: Env
): Promise<{ domain: string; techStack: string[]; sources: string[] }> {
  const domain = normalizeDomain(domainOrName);

  const cacheKey = `techstack:${domain}`;
  const cached = await getCachedJSON<{ domain: string; techStack: string[]; sources: string[] }>(env, cacheKey);
  if (cached) return cached;

  const [webData, ghData] = await Promise.allSettled([
    scrapeCompanyWebsite(domain),
    fetchGitHubProfile(domain),
  ]);

  const web = webData.status === "fulfilled" ? webData.value : {};
  const gh = ghData.status === "fulfilled" ? ghData.value : null;

  const techStack = new Set<string>(web.techStack || []);
  if (gh?.topLanguages) {
    for (const lang of gh.topLanguages) techStack.add(lang);
  }
  if (gh?.topRepos) {
    for (const repo of gh.topRepos) {
      if (repo.language) techStack.add(repo.language);
    }
  }

  const result = {
    domain,
    techStack: Array.from(techStack),
    sources: [
      ...(web.sources || []),
      ...(gh ? ["github.com"] : []),
    ],
  };

  await setCachedJSON(env, cacheKey, result);
  return result;
}

/**
 * Build a key people result.
 */
export async function buildKeyPeople(
  domainOrName: string,
  env: Env
): Promise<{
  domain: string;
  people: Person[];
  sources: string[];
}> {
  const domain = normalizeDomain(domainOrName);

  const cacheKey = `keypeople:${domain}`;
  const cached = await getCachedJSON<{ domain: string; people: Person[]; sources: string[] }>(env, cacheKey);
  if (cached) return cached;

  const companyNameGuess = domain.split(".")[0];

  const [webData, hunterData, corpData] = await Promise.allSettled([
    scrapeCompanyWebsite(domain),
    fetchHunterData(domain, env.HUNTER_API_KEY),
    searchOpenCorporates(companyNameGuess, env.OPENCORPORATES_TOKEN),
  ]);

  const web = webData.status === "fulfilled" ? webData.value : {};
  const hunter = hunterData.status === "fulfilled" ? hunterData.value : null;
  const corp = corpData.status === "fulfilled" ? corpData.value : null;

  const people: Person[] = [];
  const seen = new Set<string>();

  for (const source of [
    corp?.officers?.map((o) => ({
      name: o.name,
      title: o.position,
      source: "opencorporates" as const,
    })) || [],
    hunter?.people?.map((p) => ({
      name: p.name,
      title: p.title,
      source: "hunter.io" as const,
    })) || [],
    web.keyPeople || [],
  ]) {
    for (const p of source) {
      if (p.name && !seen.has(p.name.toLowerCase())) {
        seen.add(p.name.toLowerCase());
        people.push(p);
      }
    }
  }

  const result = {
    domain,
    people: people.slice(0, 20),
    sources: [
      ...(web.sources || []),
      ...(hunter ? ["hunter.io"] : []),
      ...(corp ? ["opencorporates.com"] : []),
    ],
  };

  await setCachedJSON(env, cacheKey, result);
  return result;
}
