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
import { checkRateLimit } from "./cache.js";

function createServer(): McpServer {
  const server = new McpServer({
    name: "CompanyScope",
    version: "0.1.0",
  });

  return server;
}

function registerTools(server: McpServer, env: Env) {
  // Tool 1: Full company profile
  server.tool(
    "lookup_company",
    "Get a comprehensive company profile from a domain or company name. Returns founding info, tech stack, key people, recent news, and more.",
    { query: z.string().describe("Company domain (e.g. 'stripe.com') or name (e.g. 'Stripe')") },
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
    "Detect the technology stack a company uses — frameworks, hosting, analytics, etc.",
    { domain: z.string().describe("Company domain (e.g. 'vercel.com')") },
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
    "Find key people at a company — founders, executives, and team members with titles and contact info.",
    { domain: z.string().describe("Company domain (e.g. 'openai.com')") },
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
    "Get recent news articles about a company.",
    { company_name: z.string().describe("Company name (e.g. 'Anthropic')") },
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
    "get_funding_history",
    "Look up corporate registry information — incorporation date, status, jurisdiction, and officers.",
    { company_name: z.string().describe("Company legal name (e.g. 'Stripe, Inc.')") },
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

    // Health check
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          name: "CompanyScope MCP Server",
          version: "0.1.0",
          status: "ok",
          mcp_endpoint: "/mcp",
        }),
        {
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
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
