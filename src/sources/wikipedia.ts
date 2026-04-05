/**
 * Wikipedia / Wikidata — completely free, no API key.
 * Returns company description, founding year, headquarters, employee count,
 * industry, revenue, and key people from the Wikipedia infobox.
 */

export interface WikiCompanyData {
  summary: string | null;
  founded: string | null;
  headquarters: string | null;
  employeeCount: string | null;
  industry: string | null;
  revenue: string | null;
  founders: string[];
  ceo: string | null;
  parentCompany: string | null;
  subsidiaries: string[];
  wikipediaUrl: string | null;
}

/**
 * Search Wikipedia for a company and extract structured data.
 */
export async function fetchWikipediaData(
  companyName: string
): Promise<WikiCompanyData | null> {
  try {
    const UA = { "User-Agent": "CompanyScope/1.0 (https://github.com/Stewyboy1990/companyscope-mcp)" };

    // Step 1: Search for the company page
    const searchResp = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        companyName + " company"
      )}&srlimit=3&format=json&origin=*`,
      { headers: UA, signal: AbortSignal.timeout(6000) }
    );

    if (!searchResp.ok) return null;

    const searchData = (await searchResp.json()) as {
      query: { search: { title: string; pageid: number }[] };
    };

    const results = searchData.query?.search;
    if (!results || results.length === 0) return null;

    // Use the first result (most relevant)
    const pageTitle = results[0].title;

    // Step 2: Get the page extract (summary) and full wikitext for infobox parsing
    const [summaryResp, parseResp] = await Promise.all([
      fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
          pageTitle
        )}`,
        { headers: UA, signal: AbortSignal.timeout(6000) }
      ),
      fetch(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
          pageTitle
        )}&prop=wikitext&format=json&origin=*`,
        { headers: UA, signal: AbortSignal.timeout(6000) }
      ),
    ]);

    const result: WikiCompanyData = {
      summary: null,
      founded: null,
      headquarters: null,
      employeeCount: null,
      industry: null,
      revenue: null,
      founders: [],
      ceo: null,
      parentCompany: null,
      subsidiaries: [],
      wikipediaUrl: null,
    };

    // Extract summary
    if (summaryResp.ok) {
      const summaryData = (await summaryResp.json()) as {
        extract: string;
        content_urls: { desktop: { page: string } };
      };
      result.summary = summaryData.extract || null;
      result.wikipediaUrl = summaryData.content_urls?.desktop?.page || null;
    }

    // Extract infobox data from wikitext
    if (parseResp.ok) {
      const parseData = (await parseResp.json()) as {
        parse: { wikitext: { "*": string } };
      };
      const wikitext = parseData.parse?.wikitext?.["*"] || "";
      Object.assign(result, extractInfobox(wikitext));
    }

    // Only return if we got meaningful data
    if (result.summary || result.founded || result.headquarters) {
      return result;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract key fields from a Wikipedia infobox in wikitext format.
 */
function extractInfobox(wikitext: string): Partial<WikiCompanyData> {
  const data: Partial<WikiCompanyData> = {};

  // Helper to extract a value from an infobox field
  const getField = (fieldNames: string[]): string | null => {
    for (const name of fieldNames) {
      // Match: | field_name = value (with optional spaces, wiki markup)
      const pattern = new RegExp(
        `\\|\\s*${name}\\s*=\\s*(.+?)(?=\\n\\|\\s*\\w|\\n\\}\\})`,
        "is"
      );
      const match = wikitext.match(pattern);
      if (match) {
        return cleanWikiText(match[1]);
      }
    }
    return null;
  };

  data.founded = getField(["founded", "foundation", "established"]);
  data.headquarters = getField([
    "headquarters",
    "hq_location",
    "location",
    "location_city",
  ]);
  data.industry = getField(["industry", "industries"]);
  data.revenue = getField(["revenue"]);
  data.employeeCount = getField([
    "num_employees",
    "employees",
    "number_of_employees",
  ]);
  data.ceo = getField(["ceo", "key_people"]);
  data.parentCompany = getField(["parent", "parent_company"]);

  // Extract founders
  const foundersRaw = getField(["founders", "founder"]);
  if (foundersRaw) {
    data.founders = foundersRaw
      .split(/[,&]|<br\s*\/?>|\n/)
      .map((f) => f.trim())
      .filter((f) => f.length > 1 && f.length < 60);
  }

  return data;
}

/**
 * Clean wiki markup from a text value.
 */
function cleanWikiText(text: string): string {
  return (
    text
      // Remove wiki links: [[Target|Display]] -> Display, [[Target]] -> Target
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
      // Remove HTML tags
      .replace(/<[^>]+>/g, " ")
      // Remove ref tags and their content
      .replace(/<ref[^>]*>.*?<\/ref>/gs, "")
      .replace(/<ref[^>]*\/>/g, "")
      // Remove templates like {{foo|bar}}
      .replace(/\{\{[^}]*\}\}/g, "")
      // Remove bold/italic markup
      .replace(/'{2,}/g, "")
      // Clean up whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}
