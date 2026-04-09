# CompanyScope MCP Server

[![Stewyboy1990/companyscope-mcp MCP server](https://glama.ai/mcp/servers/Stewyboy1990/companyscope-mcp/badges/score.svg)](https://glama.ai/mcp/servers/Stewyboy1990/companyscope-mcp)
[![npm](https://img.shields.io/npm/v/companyscope-mcp)](https://www.npmjs.com/package/companyscope-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Install in Cursor](https://img.shields.io/badge/Install_in-Cursor-blue?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgZmlsbD0id2hpdGUiIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMThjLTQuNDIgMC04LTMuNTgtOC04czMuNTgtOCA4LTggOCAzLjU4IDggOC0zLjU4IDgtOCA4eiIvPjwvc3ZnPg==)](cursor://anysphere.cursor-deeplink/mcp/install?name=companyscope&config=eyJtY3BTZXJ2ZXJzIjp7ImNvbXBhbnlzY29wZSI6eyJ1cmwiOiJodHRwczovL2NvbXBhbnlzY29wZS1tY3Auc3Rld3dpbGxpLndvcmtlcnMuZGV2L21jcCJ9fX0=)
[![Apify Actor](https://img.shields.io/badge/Apify-Actor-blue?logo=apify)](https://apify.com/constructive_wainscot/companyscope-mcp)

Company intelligence in one tool call. Get comprehensive company profiles — financials, tech stacks, competitors, patents, key people, job postings, domain intel, social presence, and news — from any domain or company name. Aggregates **10 free public data sources** in parallel. Works with **Claude, ChatGPT, Cursor, Windsurf, Cline**, and any MCP-compatible client.

> **Want cloud-hosted, always-on access with all 11 tools?** Use the [Apify Actor](https://apify.com/constructive_wainscot/companyscope-mcp) — pay only for what you use, no infrastructure to manage.

## Tools

| Tool | Description |
|------|-------------|
| `lookup_company` | Full company profile — founding info, description, tech stack, key people, news, corporate data, financials |
| `get_tech_stack` | Detect 19+ frameworks, languages, hosting, and analytics from website + GitHub |
| `get_key_people` | Find founders, executives, and team members with titles |
| `get_company_news` | Recent news articles about a company |
| `get_corporate_registry` | Corporate registry data — incorporation, jurisdiction, officers (140+ countries) |
| `get_financials` | SEC EDGAR financial data — revenue, net income, assets, liabilities, stock tickers, recent filings |
| `get_competitors` | Discover competing companies via web search |
| `get_patents` | Search US patents by company assignee via Google Patents |
| `get_domain_intel` | DNS records, WHOIS/RDAP, hosting provider, email service detection |
| `get_job_postings` | Open positions from careers pages — titles, departments, locations |
| `get_social_presence` | Social media across 12 platforms + GitHub org stats |

## Quick Start

### Option 1: Apify Actor (cloud-hosted, all 11 tools)

Use CompanyScope on [Apify](https://apify.com/constructive_wainscot/companyscope-mcp) — always-on, pay-per-use, no setup required:

```bash
# Claude Code
claude mcp add companyscope --transport http \
  https://constructive-wainscot--companyscope-mcp.apify.actor/mcp \
  --header "Authorization:Bearer YOUR_APIFY_TOKEN"
```

```json
// Claude Desktop (claude_desktop_config.json)
{
  "mcpServers": {
    "companyscope": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://constructive-wainscot--companyscope-mcp.apify.actor/mcp",
        "--header", "Authorization:Bearer YOUR_APIFY_TOKEN"
      ]
    }
  }
}
```

### Option 2: Free hosted server (all 11 tools, 25 calls/day)

Connect to the free Cloudflare Workers endpoint:

```bash
# Claude Code
claude mcp add companyscope --transport http https://companyscope-mcp.stewwilli.workers.dev/mcp
```

```json
// Claude Desktop
{
  "mcpServers": {
    "companyscope": {
      "command": "npx",
      "args": ["mcp-remote", "https://companyscope-mcp.stewwilli.workers.dev/mcp"]
    }
  }
}
```

### Option 3: ChatGPT (Pro, Team, Enterprise, Edu)

Connect CompanyScope directly in ChatGPT — no installation required:

1. Open ChatGPT → **Settings** → **Apps & Connectors** → **Advanced settings**
2. Toggle **Developer Mode** to ON
3. Click **Add new connector**
4. Enter:
   - **Name:** `CompanyScope`
   - **URL:** `https://companyscope-mcp.stewwilli.workers.dev/mcp`
   - **Authentication:** Select **No Auth**
5. Check "I trust this application" → **Create**
6. In any chat, enable Developer Mode and CompanyScope's 11 tools are available

### Option 4: npm (local, stdio transport)

```bash
npx companyscope-mcp
```

### Option 5: Self-host on Cloudflare Workers

```bash
git clone https://github.com/Stewyboy1990/companyscope-mcp.git
cd companyscope-mcp && npm install
wrangler kv namespace create CACHE
# Update wrangler.toml with your KV namespace ID
npm run deploy
```

## Data Sources

All data is aggregated from **10 free public sources** — no paid API keys required:

| Source | Data Provided |
|--------|--------------|
| Wikipedia / Wikidata | Company description, founding year, HQ, employees, industry, revenue, founders, CEO |
| GitHub API | Organization profile, top repos, programming languages, stars, contributors |
| SEC EDGAR | Revenue, net income, total assets, liabilities, stock tickers, recent filings |
| Web scraping | Company name, description, tech stack (19+ frameworks), social links |
| OpenCorporates | Incorporation date, jurisdiction, registered officers (140+ countries) |
| RDAP | Domain registrar, registration date, nameservers, domain age |
| DNS (Cloudflare DoH) | A, MX, NS, TXT records; hosting provider and email service detection |
| Brave Search | Competitor discovery, patent search, company news |
| Google Patents | US patents by company assignee — titles, IDs, dates |
| Careers pages | Job postings, departments, locations, ATS platform detection |

## Example Output

```
> lookup_company("anthropic.com")
```

Returns a structured profile with:
- Company name, description, industry
- Founded date, headquarters, employee count
- Tech stack (from website + GitHub)
- Key people (from corporate registry, website, Wikipedia)
- Recent news
- Social profiles
- Confidence score (0-1 based on data sources that returned data)

## Pricing

| Option | Tools | Calls/Day | Price |
|--------|-------|-----------|-------|
| Free (Cloudflare) | 6 core | 25 | $0 |
| Free (npm) | 6 core | Unlimited | $0 |
| [Apify Actor](https://apify.com/constructive_wainscot/companyscope-mcp) | **All 11** | Unlimited | Pay-per-use |

## Use Cases

- **Sales prospecting** — Research target companies before outreach. Get tech stack, team size, financials.
- **Due diligence** — Pull SEC filings, corporate registry, patent portfolios in one call.
- **Competitive intelligence** — Discover competitors, compare tech stacks and hiring activity.
- **AI agent workflows** — Let your AI assistant autonomously research and enrich company data.

## Also Available

- **[Apify Actor](https://apify.com/constructive_wainscot/companyscope-mcp)** — Cloud-hosted, pay-per-use, all 11 tools
- **[npm](https://www.npmjs.com/package/companyscope-mcp)** — `npx companyscope-mcp`
- **[Official MCP Registry](https://github.com/modelcontextprotocol/servers)** — `io.github.Stewyboy1990/companyscope-mcp`
- **[Smithery](https://smithery.ai/server/stewyboy1990/companyscope-mcp)** — One-click install
- **[Glama](https://glama.ai/mcp/servers/Stewyboy1990/companyscope-mcp)** — AAA score

## License

MIT
