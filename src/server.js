import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://companyscope-mcp.stewwilli.workers.dev";

/**
 * Call a tool on the remote CompanyScope MCP server via Streamable HTTP.
 * Sends a JSON-RPC tools/call request and extracts the result.
 */
async function callRemoteTool(toolName, args) {
  const requestId = Math.floor(Math.random() * 1e9);

  // First initialize
  const initRes = await fetch(`${API_BASE}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: requestId,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "companyscope-mcp-npm", version: "1.1.0" },
      },
    }),
  });
  const initData = await initRes.json();
  if (initData.error) {
    throw new Error(`Init failed: ${JSON.stringify(initData.error)}`);
  }

  // Then call the tool
  const callRes = await fetch(`${API_BASE}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: requestId + 1,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });
  const callData = await callRes.json();
  if (callData.error) {
    throw new Error(
      callData.error.message || JSON.stringify(callData.error)
    );
  }
  return callData.result;
}

function createServer() {
  const server = new McpServer({
    name: "CompanyScope",
    version: "1.1.0",
  });

  // Tool 1: Full company profile
  server.tool(
    "lookup_company",
    "Get a comprehensive company profile by aggregating data from Wikipedia, GitHub, SEC EDGAR, OpenCorporates, and web scraping. Returns founding year, description, headquarters, employee count, industry, tech stack, key people, and recent news. Use this as the primary entry point for any company research — it calls all other data sources automatically. Input can be a domain (stripe.com) or company name (Stripe). Returns a JSON object with confidence scores and source attribution.",
    {
      query: z
        .string()
        .describe(
          "Company domain (e.g. 'stripe.com') or company name (e.g. 'Stripe'). Domains produce richer results because they enable website scraping and DNS analysis."
        ),
    },
    async ({ query }) => {
      const result = await callRemoteTool("lookup_company", { query });
      return result;
    }
  );

  // Tool 2: Tech stack only
  server.tool(
    "get_tech_stack",
    "Detect a company's technology stack by analyzing HTTP headers, DNS records, and GitHub repositories. Returns frameworks, programming languages, hosting providers, analytics tools, and CDNs. Use this instead of lookup_company when you only need technology information. Requires a domain name — company names are not supported for this tool.",
    {
      domain: z
        .string()
        .describe(
          "Company website domain without protocol (e.g. 'vercel.com', 'github.com'). Must be a valid domain, not a company name."
        ),
    },
    async ({ domain }) => {
      const result = await callRemoteTool("get_tech_stack", { domain });
      return result;
    }
  );

  // Tool 3: Key people
  server.tool(
    "get_key_people",
    "Find key people at a company including founders, C-suite executives, and team members. Scrapes the company's website (e.g. /about, /team pages), checks Wikipedia, and cross-references GitHub org members. Returns names, titles, and sources. Use this when you need leadership or team information specifically. Requires a domain name.",
    {
      domain: z
        .string()
        .describe(
          "Company website domain without protocol (e.g. 'openai.com'). The tool will scrape the site's about/team pages."
        ),
    },
    async ({ domain }) => {
      const result = await callRemoteTool("get_key_people", { domain });
      return result;
    }
  );

  // Tool 4: Recent news
  server.tool(
    "get_company_news",
    "Get recent news articles about a company from Brave Search and NewsAPI. Returns article titles, descriptions, sources, and publication dates sorted by recency. Use company name, not domain. Coverage depends on server-side API key configuration.",
    {
      company_name: z
        .string()
        .describe(
          "Company name as it would appear in news articles (e.g. 'Anthropic', 'OpenAI', 'Tesla'). Do not pass a domain."
        ),
    },
    async ({ company_name }) => {
      const result = await callRemoteTool("get_company_news", {
        company_name,
      });
      return result;
    }
  );

  // Tool 5: Corporate registry lookup
  server.tool(
    "get_corporate_registry",
    "Look up corporate registry data from OpenCorporates — incorporation date, status, jurisdiction, registered address, and company officers. Covers companies in 140+ jurisdictions worldwide. Use the company's legal name for best results. Note: this may return no results for very new or small private companies.",
    {
      company_name: z
        .string()
        .describe(
          "Company legal name as registered (e.g. 'Stripe, Inc.', 'Alphabet Inc.'). Legal names with suffixes like Inc/Ltd/GmbH produce more accurate results."
        ),
    },
    async ({ company_name }) => {
      const result = await callRemoteTool("get_corporate_registry", {
        company_name,
      });
      return result;
    }
  );

  // Tool 6: SEC Financial data
  server.tool(
    "get_financials",
    "Get financial data for US public companies from SEC EDGAR filings. Returns revenue, net income, total assets, total liabilities, stockholders' equity, stock exchange tickers, SIC industry code, and recent SEC filings (10-K, 10-Q, 8-K). Only works for companies that file with the SEC — private companies and non-US companies will return no results. Data is updated as companies file new reports.",
    {
      company_name: z
        .string()
        .describe(
          "Company name or stock ticker symbol (e.g. 'Apple', 'AAPL', 'Tesla', 'MSFT'). Both common names and ticker symbols are supported."
        ),
    },
    async ({ company_name }) => {
      const result = await callRemoteTool("get_financials", {
        company_name,
      });
      return result;
    }
  );

  // Tool 7: Competitor discovery
  server.tool(
    "get_competitors",
    "Find competitors and alternatives for a company using web search. Returns a list of competing companies with names, URLs, and descriptions. Requires the server to have a Brave Search API key configured. Use company name for best results.",
    {
      company_name: z
        .string()
        .describe(
          "Company name (e.g. 'Stripe', 'Notion', 'Datadog'). Use the common brand name, not the legal entity name."
        ),
    },
    async ({ company_name }) => {
      const result = await callRemoteTool("get_competitors", {
        company_name,
      });
      return result;
    }
  );

  // Tool 8: Patent search
  server.tool(
    "get_patents",
    "Search US patents assigned to a company via the USPTO PatentsView API. Returns patent numbers, titles, dates, abstracts, and inventors. Free, no API key needed. Covers 8M+ US patents. Only returns patents from 2020 onwards. Works best with the company's legal name as it appears on patent filings.",
    {
      company_name: z
        .string()
        .describe(
          "Company name as it appears on patent filings (e.g. 'Apple Inc.', 'Google LLC', 'Microsoft Corporation'). Legal names with suffixes produce better results."
        ),
    },
    async ({ company_name }) => {
      const result = await callRemoteTool("get_patents", { company_name });
      return result;
    }
  );

  // Tool 9: Domain intelligence
  server.tool(
    "get_domain_intel",
    "Full domain analysis: DNS records (A, AAAA, MX, NS, TXT, CNAME), WHOIS/RDAP registration data, inferred hosting provider and email service. No API keys needed. Use this when you need infrastructure-level intelligence about a company — who hosts them, what email provider they use, when the domain was registered, and what DNS configuration they have.",
    {
      domain: z
        .string()
        .describe(
          "Domain name without protocol (e.g. 'stripe.com', 'anthropic.com'). Must be a valid domain."
        ),
    },
    async ({ domain }) => {
      const result = await callRemoteTool("get_domain_intel", { domain });
      return result;
    }
  );

  // Tool 10: Job postings
  server.tool(
    "get_job_postings",
    "Discover open job positions at a company by scraping their careers/jobs pages. Returns job titles, departments, locations, and links. Also detects external job board usage (Lever, Greenhouse, Ashby). Hiring activity is a strong signal of company growth and priorities. No API keys needed.",
    {
      domain: z
        .string()
        .describe(
          "Company website domain (e.g. 'anthropic.com', 'stripe.com'). The tool will try /careers, /jobs, and other common paths."
        ),
    },
    async ({ domain }) => {
      const result = await callRemoteTool("get_job_postings", { domain });
      return result;
    }
  );

  // Tool 11: Social presence
  server.tool(
    "get_social_presence",
    "Map a company's social media presence across 12 platforms (LinkedIn, Twitter/X, Facebook, Instagram, YouTube, TikTok, Reddit, Discord, Slack, Mastodon, Bluesky, Crunchbase) plus GitHub organization stats (repos, stars, languages, followers). No API keys needed. Use this to understand a company's community engagement and developer relations.",
    {
      domain: z
        .string()
        .describe(
          "Company website domain (e.g. 'vercel.com', 'linear.app'). Social links are scraped from the company's homepage."
        ),
    },
    async ({ domain }) => {
      const result = await callRemoteTool("get_social_presence", { domain });
      return result;
    }
  );

  return server;
}

export { createServer };

// Start if run directly
const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
