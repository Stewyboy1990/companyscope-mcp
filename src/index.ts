import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import type { Env } from "./types.js";
import {
  buildCompanyProfile,
  buildTechStack,
  buildKeyPeople,
  normalizeDomain,
} from "./aggregator.js";
import { fetchCompanyNews } from "./sources/news.js";
import { searchOpenCorporates } from "./sources/opencorporates.js";
import { fetchSECData } from "./sources/sec-edgar.js";
import { checkRateLimit } from "./cache.js";

const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CompanyScope — Company Intelligence MCP Server</title>
<meta name="description" content="One MCP tool call returns a full company profile: founding info, tech stack, key people, news, competitors. Free tier available.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;background:#f8f9fc;line-height:1.6}
.hero{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:3rem 1.5rem;text-align:center}
.hero h1{font-size:2.2rem;margin-bottom:.5rem}
.hero p{font-size:1.1rem;opacity:.9;max-width:600px;margin:0 auto}
.badge{display:inline-block;background:rgba(255,255,255,.2);padding:.25rem .75rem;border-radius:20px;font-size:.85rem;margin-top:1rem}
.container{max-width:800px;margin:0 auto;padding:2rem 1.5rem}
.card{background:#fff;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.card h2{font-size:1.3rem;margin-bottom:.75rem;color:#333}
.tools{display:grid;gap:.75rem}
.tool{background:#f0f4ff;border-radius:8px;padding:1rem}
.tool code{font-weight:700;color:#4a5aba;font-size:.95rem}
.tool p{font-size:.85rem;color:#555;margin-top:.25rem}
.connect{background:#1a1a2e;color:#e0e0e0;border-radius:8px;padding:1.25rem;font-family:monospace;font-size:.85rem;overflow-x:auto;white-space:pre;line-height:1.5}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin:1rem 0}
.stat{text-align:center;padding:.75rem}
.stat .num{font-size:1.8rem;font-weight:700;color:#667eea}
.stat .label{font-size:.8rem;color:#777;text-transform:uppercase}
.data-sources{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.5rem}
.src{background:#e8f5e9;color:#2e7d32;padding:.25rem .6rem;border-radius:6px;font-size:.8rem}
a{color:#667eea}
.cta{display:inline-block;background:#667eea;color:#fff;padding:.6rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600;margin-top:1rem}
.cta:hover{background:#5a6fd6}
.example{background:#f8f9fc;border:1px solid #e0e4ef;border-radius:8px;padding:1rem;font-family:monospace;font-size:.8rem;overflow-x:auto;white-space:pre;max-height:300px;overflow-y:auto;line-height:1.4}
footer{text-align:center;padding:2rem;color:#999;font-size:.85rem}
</style>
</head>
<body>
<div class="hero">
  <h1>CompanyScope</h1>
  <p>Company intelligence for AI agents. One tool call = full company profile from 8 data sources.</p>
  <span class="badge">MCP Server &mdash; Free Tier: 25 calls/day</span>
</div>
<div class="container">
  <div class="stats">
    <div class="stat"><div class="num">8</div><div class="label">Data Sources</div></div>
    <div class="stat"><div class="num">6</div><div class="label">MCP Tools</div></div>
    <div class="stat"><div class="num">25</div><div class="label">Free Calls/Day</div></div>
    <div class="stat"><div class="num">0</div><div class="label">API Keys Needed</div></div>
  </div>

  <div class="card">
    <h2>Available Tools</h2>
    <div class="tools">
      <div class="tool"><code>lookup_company</code><p>Full profile: description, founding, HQ, employees, tech stack, key people, news</p></div>
      <div class="tool"><code>get_tech_stack</code><p>Detect frameworks, hosting, analytics, languages from website + GitHub</p></div>
      <div class="tool"><code>get_key_people</code><p>Founders, executives, team members with titles from 4 sources</p></div>
      <div class="tool"><code>get_company_news</code><p>Recent news articles (requires NewsAPI key on server)</p></div>
      <div class="tool"><code>get_corporate_registry</code><p>Corporate registry: incorporation, jurisdiction, officers (140+ countries)</p></div>
      <div class="tool"><code>get_financials</code><p>SEC EDGAR: revenue, net income, assets, stock tickers, recent filings (US public companies)</p></div>
    </div>
  </div>

  <div class="card">
    <h2>Data Sources</h2>
    <div class="data-sources">
      <span class="src">Wikipedia</span>
      <span class="src">GitHub API</span>
      <span class="src">Web Scraping</span>
      <span class="src">OpenCorporates</span>
      <span class="src">Hunter.io</span>
      <span class="src">NewsAPI</span>
      <span class="src">SEC EDGAR</span>
      <span class="src">RDAP (Domain)</span>
    </div>
    <p style="margin-top:.75rem;font-size:.9rem;color:#555">All free-tier APIs. No API keys needed to get started &mdash; Wikipedia, GitHub, SEC EDGAR, and web scraping provide rich profiles out of the box.</p>
  </div>

  <div class="card">
    <h2>Connect in 30 Seconds</h2>
    <p style="font-size:.9rem;color:#555;margin-bottom:.75rem">Add to Claude Desktop, Cursor, or any MCP client:</p>
    <div class="connect">{
  "mcpServers": {
    "companyscope": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://companyscope-mcp.stewwilli.workers.dev/mcp"
      ]
    }
  }
}</div>
    <p style="margin-top:.75rem;font-size:.85rem;color:#777">Or connect directly via Streamable HTTP at <code>/mcp</code></p>
  </div>

  <div class="card">
    <h2>Example: lookup_company("anthropic.com")</h2>
    <div class="example">{
  "domain": "anthropic.com",
  "name": "Anthropic",
  "description": "AI safety company building reliable AI systems...",
  "founded": "2021",
  "employeeCount": "1000+",
  "industry": "Artificial intelligence",
  "headquarters": "San Francisco, California",
  "techStack": ["Python", "TypeScript", "React", "Rust"],
  "keyPeople": [
    {"name": "Dario Amodei", "title": "CEO"},
    {"name": "Daniela Amodei", "title": "President"}
  ],
  "confidence": 0.83,
  "sources": ["wikipedia.org", "github.com", "anthropic.com"]
}</div>
  </div>

  <div class="card" style="text-align:center">
    <h2>Open Source</h2>
    <p style="font-size:.9rem;color:#555">Built with Cloudflare Workers + MCP SDK. MIT licensed.</p>
    <a class="cta" href="https://github.com/Stewyboy1990/companyscope-mcp">View on GitHub</a>
  </div>
</div>
<footer>
  CompanyScope MCP Server &mdash; Built by <a href="https://github.com/Stewyboy1990">Stewyboy1990</a>
</footer>
</body>
</html>`;

function createServer(): McpServer {
  const server = new McpServer({
    name: "CompanyScope",
    version: "1.0.0",
  });

  return server;
}

function registerTools(server: McpServer, env: Env) {
  // Tool 1: Full company profile
  server.tool(
    "lookup_company",
    "Get a comprehensive company profile by aggregating data from Wikipedia, GitHub, SEC EDGAR, OpenCorporates, and web scraping. Returns founding year, description, headquarters, employee count, industry, tech stack, key people, and recent news. Use this as the primary entry point for any company research — it calls all other data sources automatically. Input can be a domain (stripe.com) or company name (Stripe). Returns a JSON object with confidence scores and source attribution.",
    { query: z.string().describe("Company domain (e.g. 'stripe.com') or company name (e.g. 'Stripe'). Domains produce richer results because they enable website scraping and DNS analysis.") },
    async ({ query }) => {
      const profile = await buildCompanyProfile(query, env);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(profile, null, 2),
          },
        ],
      };
    }
  );

  // Tool 2: Tech stack only
  server.tool(
    "get_tech_stack",
    "Detect a company's technology stack by analyzing HTTP headers, DNS records, and GitHub repositories. Returns frameworks, programming languages, hosting providers, analytics tools, and CDNs. Use this instead of lookup_company when you only need technology information. Requires a domain name — company names are not supported for this tool.",
    { domain: z.string().describe("Company website domain without protocol (e.g. 'vercel.com', 'github.com'). Must be a valid domain, not a company name.") },
    async ({ domain }) => {
      const result = await buildTechStack(domain, env);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Tool 3: Key people
  server.tool(
    "get_key_people",
    "Find key people at a company including founders, C-suite executives, and team members. Scrapes the company's website (e.g. /about, /team pages), checks Wikipedia, and cross-references GitHub org members. Returns names, titles, and sources. Use this when you need leadership or team information specifically. Requires a domain name.",
    { domain: z.string().describe("Company website domain without protocol (e.g. 'openai.com'). The tool will scrape the site's about/team pages.") },
    async ({ domain }) => {
      const result = await buildKeyPeople(domain, env);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Tool 4: Recent news
  server.tool(
    "get_company_news",
    "Get recent news articles about a company from NewsAPI. Returns article titles, descriptions, sources, and publication dates sorted by recency. Note: this tool requires a NewsAPI key to be configured on the server — if no key is set, it returns an empty result. Use company name, not domain.",
    { company_name: z.string().describe("Company name as it would appear in news articles (e.g. 'Anthropic', 'OpenAI', 'Tesla'). Do not pass a domain.") },
    async ({ company_name }) => {
      const news = await fetchCompanyNews(company_name, env.NEWS_API_KEY);
      return {
        content: [
          {
            type: "text" as const,
            text: news.length > 0
              ? JSON.stringify(news, null, 2)
              : `No recent news found for "${company_name}". This may be because no NewsAPI key is configured or the free tier limit has been reached.`,
          },
        ],
      };
    }
  );

  // Tool 5: Corporate registry lookup
  server.tool(
    "get_corporate_registry",
    "Look up corporate registry data from OpenCorporates — incorporation date, status, jurisdiction, registered address, and company officers. Covers companies in 140+ jurisdictions worldwide. Use the company's legal name for best results. Note: this may return no results for very new or small private companies.",
    { company_name: z.string().describe("Company legal name as registered (e.g. 'Stripe, Inc.', 'Alphabet Inc.'). Legal names with suffixes like Inc/Ltd/GmbH produce more accurate results.") },
    async ({ company_name }) => {
      const result = await searchOpenCorporates(
        company_name,
        env.OPENCORPORATES_TOKEN
      );
      return {
        content: [
          {
            type: "text" as const,
            text: result
              ? JSON.stringify(result, null, 2)
              : `No corporate registry data found for "${company_name}".`,
          },
        ],
      };
    }
  );

  // Tool 6: SEC Financial data
  server.tool(
    "get_financials",
    "Get financial data for US public companies from SEC EDGAR filings. Returns revenue, net income, total assets, total liabilities, stockholders' equity, stock exchange tickers, SIC industry code, and recent SEC filings (10-K, 10-Q, 8-K). Only works for companies that file with the SEC — private companies and non-US companies will return no results. Data is updated as companies file new reports.",
    { company_name: z.string().describe("Company name or stock ticker symbol (e.g. 'Apple', 'AAPL', 'Tesla', 'MSFT'). Both common names and ticker symbols are supported.") },
    async ({ company_name }) => {
      const secData = await fetchSECData(company_name);
      return {
        content: [
          {
            type: "text" as const,
            text: secData
              ? JSON.stringify(secData, null, 2)
              : `No SEC EDGAR data found for "${company_name}". This tool only works for US publicly-traded companies.`,
          },
        ],
      };
    }
  );
}

// CORS headers for cross-origin MCP clients
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, mcp-session-id, mcp-protocol-version",
};

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Health check (JSON)
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          name: "CompanyScope MCP Server",
          version: "1.0.0",
          status: "ok",
          mcp_endpoint: "/mcp",
        }),
        {
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    // MCP discovery (well-known)
    if (url.pathname === "/.well-known/mcp.json") {
      return new Response(
        JSON.stringify({
          mcp_version: "2025-03-26",
          name: "CompanyScope",
          description: "Company intelligence aggregator — one tool call returns a full company profile with founding info, tech stack, key people, news, and more.",
          url: `${url.origin}/mcp`,
          transport: "streamable-http",
          capabilities: {
            tools: true,
          },
        }),
        {
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    // Landing page
    if (url.pathname === "/") {
      const accept = request.headers.get("accept") || "";
      if (accept.includes("application/json") && !accept.includes("text/html")) {
        return new Response(
          JSON.stringify({
            name: "CompanyScope MCP Server",
            version: "1.0.0",
            status: "ok",
            mcp_endpoint: "/mcp",
          }),
          {
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          }
        );
      }
      return new Response(LANDING_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS },
      });
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // Rate limiting: identify by IP or API key
      const identifier =
        request.headers.get("x-api-key") ||
        request.headers.get("cf-connecting-ip") ||
        "anonymous";

      const FREE_TIER_LIMIT = 25; // calls per day
      const rateCheck = await checkRateLimit(env, identifier, FREE_TIER_LIMIT);

      if (!rateCheck.allowed) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded",
            message: `Free tier allows ${FREE_TIER_LIMIT} calls/day. Resets at ${rateCheck.resetAt}. Upgrade to Pro for unlimited access.`,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": rateCheck.resetAt,
              ...CORS_HEADERS,
            },
          }
        );
      }

      const server = createServer();
      registerTools(server, env);

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
        enableJsonResponse: true,
      });

      await server.connect(transport);

      const response = await transport.handleRequest(request);

      // Add CORS + rate limit headers to response
      const newHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        newHeaders.set(key, value);
      }
      newHeaders.set(
        "X-RateLimit-Remaining",
        String(rateCheck.remaining)
      );

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
};
