#!/usr/bin/env node

/**
 * CompanyScope MCP Server — Stdio Transport
 *
 * A local MCP server that proxies tool calls to the hosted CompanyScope API.
 * 6 tools, 8 data sources, no API keys needed.
 *
 * Usage:
 *   npx companyscope-mcp
 *
 * Or add to your MCP client config:
 *   {
 *     "mcpServers": {
 *       "companyscope": {
 *         "command": "npx",
 *         "args": ["companyscope-mcp"]
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://companyscope-mcp.stewwilli.workers.dev";

/**
 * Call a tool on the remote CompanyScope MCP server via Streamable HTTP.
 */
async function callRemoteTool(toolName, args) {
  const requestId = Math.floor(Math.random() * 1e9);

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
  if (initData.error) throw new Error(`Init: ${JSON.stringify(initData.error)}`);

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
  if (callData.error) throw new Error(callData.error.message || JSON.stringify(callData.error));
  return callData.result;
}

const server = new McpServer({ name: "CompanyScope", version: "1.1.0" });

server.tool(
  "lookup_company",
  "Get a comprehensive company profile by aggregating data from Wikipedia, GitHub, SEC EDGAR, OpenCorporates, and web scraping. Returns founding year, description, headquarters, employee count, industry, tech stack, key people, and recent news. Use this as the primary entry point for any company research — it calls all other data sources automatically. Input can be a domain (stripe.com) or company name (Stripe). Returns a JSON object with confidence scores and source attribution.",
  { query: z.string().describe("Company domain (e.g. 'stripe.com') or company name (e.g. 'Stripe'). Domains produce richer results because they enable website scraping and DNS analysis.") },
  async ({ query }) => callRemoteTool("lookup_company", { query })
);

server.tool(
  "get_tech_stack",
  "Detect a company's technology stack by analyzing HTTP headers, DNS records, and GitHub repositories. Returns frameworks, programming languages, hosting providers, analytics tools, and CDNs. Use this instead of lookup_company when you only need technology information. Requires a domain name — company names are not supported for this tool.",
  { domain: z.string().describe("Company website domain without protocol (e.g. 'vercel.com', 'github.com'). Must be a valid domain, not a company name.") },
  async ({ domain }) => callRemoteTool("get_tech_stack", { domain })
);

server.tool(
  "get_key_people",
  "Find key people at a company including founders, C-suite executives, and team members. Scrapes the company's website (e.g. /about, /team pages), checks Wikipedia, and cross-references GitHub org members. Returns names, titles, and sources. Use this when you need leadership or team information specifically. Requires a domain name.",
  { domain: z.string().describe("Company website domain without protocol (e.g. 'openai.com'). The tool will scrape the site's about/team pages.") },
  async ({ domain }) => callRemoteTool("get_key_people", { domain })
);

server.tool(
  "get_company_news",
  "Get recent news articles about a company from Brave Search and NewsAPI. Returns article titles, descriptions, sources, and publication dates sorted by recency. Use company name, not domain. Coverage depends on server-side API key configuration.",
  { company_name: z.string().describe("Company name as it would appear in news articles (e.g. 'Anthropic', 'OpenAI', 'Tesla'). Do not pass a domain.") },
  async ({ company_name }) => callRemoteTool("get_company_news", { company_name })
);

server.tool(
  "get_corporate_registry",
  "Look up corporate registry data from OpenCorporates — incorporation date, status, jurisdiction, registered address, and company officers. Covers companies in 140+ jurisdictions worldwide. Use the company's legal name for best results. Note: this may return no results for very new or small private companies.",
  { company_name: z.string().describe("Company legal name as registered (e.g. 'Stripe, Inc.', 'Alphabet Inc.'). Legal names with suffixes like Inc/Ltd/GmbH produce more accurate results.") },
  async ({ company_name }) => callRemoteTool("get_corporate_registry", { company_name })
);

server.tool(
  "get_financials",
  "Get financial data for US public companies from SEC EDGAR filings. Returns revenue, net income, total assets, total liabilities, stockholders' equity, stock exchange tickers, SIC industry code, and recent SEC filings (10-K, 10-Q, 8-K). Only works for companies that file with the SEC — private companies and non-US companies will return no results. Data is updated as companies file new reports.",
  { company_name: z.string().describe("Company name or stock ticker symbol (e.g. 'Apple', 'AAPL', 'Tesla', 'MSFT'). Both common names and ticker symbols are supported.") },
  async ({ company_name }) => callRemoteTool("get_financials", { company_name })
);

const transport = new StdioServerTransport();
await server.connect(transport);
